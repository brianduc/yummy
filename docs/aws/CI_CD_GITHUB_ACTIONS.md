# CI/CD — GitHub Actions pipeline

This document covers the automated pipeline defined in `.github/workflows/deploy-aws.yml`. It builds, tests, and deploys YUMMY to AWS ECS Fargate using GitHub OIDC — no long-lived AWS credentials are stored.

> **Legacy note**: `docs/aws/APP_RUNNER_AMPLIFY.md` documents the previous App Runner + Amplify path. It is no longer the primary deployment target. The ECS Fargate path described here (and in `AWS_DEPLOYMENT_ECS_FARGATE.md`) is the current approach.

## Pipeline overview

```
Push to main / PR
        │
        ├── backend-test ──────────┐
        │   (Vitest + Postgres)    │
        │                          ├── docker-build ──► tofu-plan ──► deploy-dev ──► smoke-dev
        └── frontend-test ─────────┘   (ECR push)      (plan only)   (approval)     (health)
              (Vitest + next build)
```

Jobs `backend-test` and `frontend-test` run in parallel. `docker-build` and `tofu-plan` both wait for both test jobs to pass. `deploy-dev` requires both `docker-build` and `tofu-plan`, plus a manual approval via the `dev` GitHub Environment. `smoke-dev` runs after deployment.

PRs run `backend-test`, `frontend-test`, and `tofu-plan` only — no image push or deployment.

## One-time setup

### 1. Apply the OpenTofu foundation

Follow `docs/aws/AWS_DEPLOYMENT_ECS_FARGATE.md` through Step 3 to create all AWS resources. After `tofu apply` you will have:

- ECR repositories (`yummy-backend`, `yummy-frontend`)
- GitHub Actions IAM roles (OIDC trust for deploy/build and infra/apply)
- ALB DNS name

### 2. Set GitHub repository variables

Go to **Settings → Secrets and variables → Actions → Variables** and add:

| Variable | Value | Example |
|---|---|---|
| `AWS_REGION` | AWS region for all resources | `ap-southeast-1` |
| `AWS_ACCOUNT_ID` | 12-digit AWS account ID | `123456789012` |
| `ACTIONS_ROLE_ARN` | Deploy/build role ARN from `tofu output github_actions_role_arn` | `arn:aws:iam::123456789012:role/yummy-dev-github-actions` |
| `ACTIONS_INFRA_ROLE_ARN` | Infra/apply role ARN from `tofu output github_actions_infra_role_arn` | `arn:aws:iam::123456789012:role/yummy-dev-github-actions-infra` |
| `NEXT_PUBLIC_API_URL` | Public URL for the backend API | `http://<alb-dns-name>` or `https://api.yourdomain.com` |
| `TOFU_STATE_BUCKET` | OpenTofu remote state bucket name | `yummy-tofu-state-123456789012` |
| `TOFU_LOCK_TABLE` | OpenTofu remote state lock table | `yummy-tofu-locks` |
| `OIDC_REPO` | Repo trusted by the OIDC role | `your-org/yummy-monorepo` |
| `AVAILABILITY_ZONES_JSON` | JSON array for required OpenTofu AZ input | `["ap-southeast-1a","ap-southeast-1b"]` |

No AWS secrets are stored in GitHub. OIDC replaces `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` entirely.

### 3. Create the `dev` GitHub Environment

Go to **Settings → Environments → New environment**, name it `dev`, and add at least one required reviewer. This creates the manual approval gate that must be passed before `deploy-dev` runs.

### 4. Configure the OIDC trust in AWS

The OpenTofu IAM module creates the OIDC provider and both GitHub Actions roles automatically (see `infra/modules/iam`). The `github_repo` variable in `infra/dev/variables.tf` must match your repository in `org/repo` format. After `tofu apply`, both roles trust exactly that repo.

## Job details

### `backend-test`

Runs `pnpm test` inside `backend-ts/` against a Postgres 16 Alpine service container.

- Service container: `postgres:16-alpine`, credentials `yummy/yummy`, database `yummy_test`, port 5432.
- Runs `pnpm db:migrate` before tests to apply the current schema.
- Uses `DATABASE_URL=postgres://yummy:yummy@localhost:5432/yummy_test`.
- Vitest config (`pool: forks`, `fileParallelism: false`) is preserved — tests run serially.

### `frontend-test`

Runs `npm test` and `npm run build` inside `frontend/`.

- `npm test` runs Vitest with jsdom.
- `npm run build` validates the Next.js standalone build. `NEXT_PUBLIC_API_URL` is baked in at this point using the `NEXT_PUBLIC_API_URL` repository variable (falls back to `http://localhost:8000` if not set).

### `docker-build`

Builds both Docker images and pushes to ECR. Runs only on push to `main`/`master`.

- Images are tagged with the git SHA (`github.sha`) and `latest`.
- Frontend build receives `NEXT_PUBLIC_API_URL` as a `--build-arg`.
- Uses `docker/build-push-action` with GitHub Actions cache (`type=gha`) for layer reuse.
- Outputs `backend_image` and `frontend_image` URIs for use by downstream jobs.
- Assumes `ACTIONS_ROLE_ARN` (the deploy/build role), which only needs ECR push access plus remote-state access used elsewhere in the workflow.

### `tofu-plan`

Runs `tofu init` + `tofu validate` + `tofu plan` in `infra/dev/`. Runs on push to `main` and on all PRs.

- Uses OIDC credentials — no stored AWS keys.
- Passes `backend_image_tag` and `frontend_image_tag` variables set to the current git SHA.
- The plan is saved to `tfplan` but not published as a PR comment automatically (add `infracost` or `tofu show` steps if desired).
- Assumes `ACTIONS_INFRA_ROLE_ARN` so plan and apply share the same higher-privilege infra/apply role.

### `deploy-dev`

Runs `tofu apply -auto-approve` in `infra/dev/`. Runs only on push to `main`/`master`, after manual approval.

- Requires the `dev` GitHub Environment with at least one required reviewer.
- After apply, captures the ALB DNS name and waits for ECS services to stabilise using `aws ecs wait services-stable`.
- Deployment is **dev only**. Production deployments are intentionally not automated.
- Assumes `ACTIONS_INFRA_ROLE_ARN`, the higher-privilege infra/apply role that can update IAM policies and the rest of the managed stack.

### `smoke-dev`

Runs health checks against the live dev environment after deployment.

| Check | Endpoint | Pass condition |
|---|---|---|
| Backend health | `GET /health` | `{"status":"ok","db":"ok"}` |
| Frontend reachability | `GET /` | HTTP 200 |
| SSE probe | `GET /health` with `Accept: text/event-stream` | Non-fatal — `continue-on-error: true` |

The smoke job retries the backend health check up to 10 times (10-second intervals) to allow ECS task warm-up.

## OIDC authentication

The workflow uses `aws-actions/configure-aws-credentials@v4` with `role-to-assume`. This exchanges the GitHub Actions OIDC token for temporary AWS credentials valid for the duration of the job. No `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` are stored anywhere.

The IAM resources created by `infra/modules/iam` now expose two GitHub OIDC roles:
- `github_actions_role_arn` — lower-privilege deploy/build role used by `docker-build` and `smoke-dev`
- `github_actions_infra_role_arn` — higher-privilege infra/apply role used by `tofu-plan` and `deploy-dev`

This split avoids the self-management deadlock where `tofu apply` tries to update inline policies on the same role it is currently assuming.

## Secrets management

| What | Where | How used |
|---|---|---|
| AWS credentials | Not stored — OIDC | Exchanged for temporary session tokens |
| `DATABASE_URL` | AWS Secrets Manager | ECS task injects via `secrets:` block |
| App secrets (API keys) | AWS Secrets Manager | ECS task injects via `secrets:` block |
| `NEXT_PUBLIC_API_URL` | GitHub repository variable | Baked into Docker image at build time |

Application secrets should be populated directly in AWS Secrets Manager after the first infrastructure apply. Avoid storing real secret values in `terraform.tfvars` or passing them on the command line.

## Rollback

**Revert to a previous deploy** by identifying the git SHA of the last good deployment and re-running the deploy workflow with that SHA:

```bash
git revert HEAD         # creates a new commit reverting the bad change
git push origin main    # triggers the pipeline → deploys the reverted SHA
```

Or manually apply the previous tag:

```bash
cd infra/dev
tofu apply \
  -var="backend_image_tag=<previous-sha>" \
  -var="frontend_image_tag=<previous-sha>"
```

For database issues, see the RDS point-in-time restore procedure in `docs/aws/AWS_DEPLOYMENT_ECS_FARGATE.md`.

## Adding a staging or production environment

1. Create a new directory `infra/staging/` or `infra/prod/` mirroring `infra/dev/`.
2. Add a new GitHub Environment (`staging`, `prod`) with appropriate reviewers and wait timers.
3. Duplicate the `deploy-dev` and `smoke-dev` jobs in the workflow, pointing at the new environment and infra directory.
4. Set `if:` conditions to restrict prod deploys to tagged releases (`startsWith(github.ref, 'refs/tags/')`) rather than branch pushes.

Production deployment should never be automatic.
