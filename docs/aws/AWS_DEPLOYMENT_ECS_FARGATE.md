# AWS Deployment — ECS Fargate + ALB + RDS PostgreSQL

This is the **primary deployment target** for YUMMY. It replaces the legacy App Runner + Amplify path documented in `APP_RUNNER_AMPLIFY.md` (now legacy — retained for historical context only).

## Architecture overview

```
Internet
  │
  ▼
Route 53 (optional custom domain)
  │
  ▼
Application Load Balancer (public subnets, port 80/443)
  │  /health, /ask, /sdlc, /sessions, /kb, /config, /metrics, /world  ──► Backend ECS Fargate (private subnet, port 8000)
  │  /*                                                                 ──► Frontend ECS Fargate (private subnet, port 3000)
                                                                                │
                                                                                ▼
                                                                        RDS PostgreSQL 16 (private subnet, port 5432)
```

All compute runs in **private subnets**. Only the ALB lives in public subnets. The RDS instance is not publicly accessible.

## Prerequisites

| Requirement | Detail |
|---|---|
| AWS account | Billing enabled, us-east-1 or ap-southeast-1 recommended |
| IAM permissions | Ability to create VPC, ECS, RDS, ECR, ALB, IAM, Secrets Manager resources |
| OpenTofu ≥ 1.6 | `brew install opentofu` or see opentofu.org |
| Docker | For local image testing; CI builds run on GitHub-hosted runners |
| AWS CLI v2 | `aws configure` with admin credentials for bootstrap only |
| GitHub repo | Forked or cloned YUMMY monorepo |

## Quick start

For the fastest local bootstrap, use the interactive helper at repo root:

```bash
bash deploy-aws.sh
```

It will:

- prompt for AWS region, state bucket, lock table, GitHub repo, AZs, image tags, and optional app secret names
- create or reuse the S3 state bucket and DynamoDB lock table
- generate `infra/dev/terraform.tfvars`
- run `tofu init -reconfigure`, `tofu validate`, and `tofu plan`
- optionally run `tofu apply`

The remaining sections below document the same flow manually.

## Step 1 — Bootstrap remote state

OpenTofu stores state in S3 with a DynamoDB lock table. Create these once before any `tofu init`.

```bash
AWS_REGION=ap-southeast-1
STATE_BUCKET=yummy-tofu-state-$(aws sts get-caller-identity --query Account --output text)
LOCK_TABLE=yummy-tofu-locks

aws s3api create-bucket \
  --bucket "$STATE_BUCKET" \
  --region "$AWS_REGION" \
  --create-bucket-configuration LocationConstraint="$AWS_REGION"

aws s3api put-bucket-versioning \
  --bucket "$STATE_BUCKET" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket "$STATE_BUCKET" \
  --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

aws dynamodb create-table \
  --table-name "$LOCK_TABLE" \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "$AWS_REGION"
```

If you use `deploy-aws.sh`, it passes backend settings through `tofu init -reconfigure -backend-config=...`, so you do **not** need to edit `infra/dev/terraform.tf`.

## Step 2 — Configure variables

Copy `infra/dev/terraform.tfvars.example` (create it if absent) and fill in your values:

```hcl
aws_region     = "ap-southeast-1"
project        = "yummy"
environment    = "dev"
github_repo    = "your-org/yummy-monorepo"

# These must match the ECR image tags pushed by CI.
backend_image_tag  = "latest"
frontend_image_tag = "latest"

# App secret names to create in Secrets Manager. Populate real values after apply.
app_secrets = {
  GEMINI_API_KEY = ""
  AI_PROVIDER    = ""
}
```

Never commit `terraform.tfvars` — add it to `.gitignore`.

After the first apply, populate real values directly in AWS Secrets Manager instead of storing them in Terraform vars/state:

```bash
aws secretsmanager put-secret-value \
  --secret-id yummy-dev/GEMINI_API_KEY \
  --secret-string '<real-secret-value>' \
  --region ap-southeast-1
```

## Step 3 — First tofu apply (infrastructure only)

```bash
cd infra/dev
tofu init \
  -reconfigure \
  -backend-config="bucket=${STATE_BUCKET}" \
  -backend-config="key=dev/terraform.tfstate" \
  -backend-config="region=${AWS_REGION}" \
  -backend-config="dynamodb_table=${LOCK_TABLE}" \
  -backend-config="encrypt=true"
tofu validate
tofu plan -var="backend_image_tag=placeholder" -var="frontend_image_tag=placeholder"
tofu apply -var="backend_image_tag=placeholder" -var="frontend_image_tag=placeholder"
```

Using `placeholder` image tags on first apply is intentional — ECS services will fail to start until real images are pushed in Step 4. The ALB, VPC, RDS, and ECR repos are created and ready.

After apply, capture the outputs you will need:

```bash
tofu output github_actions_role_arn   # → set as ACTIONS_ROLE_ARN repo variable
tofu output backend_ecr_url           # → yummy-backend ECR repo
tofu output frontend_ecr_url          # → yummy-frontend ECR repo
tofu output alb_dns_name              # → your dev URL (until Route 53 is wired)
```

## Step 4 — Push initial Docker images

Run the CI pipeline (push to `main`) or push manually:

```bash
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=ap-southeast-1
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "$ECR_REGISTRY"

# Backend
docker build -t "${ECR_REGISTRY}/yummy-backend:latest" backend-ts/
docker push "${ECR_REGISTRY}/yummy-backend:latest"

# Frontend (NEXT_PUBLIC_API_URL baked at build time)
docker build \
  --build-arg NEXT_PUBLIC_API_URL="http://$(tofu -chdir=infra/dev output -raw alb_dns_name)" \
  -t "${ECR_REGISTRY}/yummy-frontend:latest" frontend/
docker push "${ECR_REGISTRY}/yummy-frontend:latest"
```

## Step 5 — Update ECS services

After pushing images, force a new ECS deployment:

```bash
CLUSTER=$(cd infra/dev && tofu output -raw ecs_cluster_name)
BACKEND_SVC=$(cd infra/dev && tofu output -raw backend_ecs_service_name)
FRONTEND_SVC=$(cd infra/dev && tofu output -raw frontend_ecs_service_name)

aws ecs update-service --cluster "$CLUSTER" --service "$BACKEND_SVC" --force-new-deployment
aws ecs update-service --cluster "$CLUSTER" --service "$FRONTEND_SVC" --force-new-deployment

aws ecs wait services-stable --cluster "$CLUSTER" --services "$BACKEND_SVC" "$FRONTEND_SVC"
```

## Step 6 — Verify

```bash
ALB_DNS=$(cd infra/dev && tofu output -raw alb_dns_name)

# Backend health (should return {"status":"ok","db":"ok"})
curl -fsS "http://${ALB_DNS}/health"

# Frontend (should return HTTP 200)
curl -o /dev/null -s -w "%{http_code}" "http://${ALB_DNS}/"
```

## Ongoing deployments

After the bootstrap, all deployments go through CI. The `.github/workflows/deploy-aws.yml` workflow:

1. Runs backend and frontend tests.
2. Builds and pushes Docker images tagged with the git SHA.
3. Runs `tofu plan` for review.
4. Gates on a manual approval via the GitHub `dev` environment.
5. Runs `tofu apply` with the new image tags.
6. Waits for ECS services to stabilise.
7. Runs smoke tests.

See `docs/aws/CI_CD_GITHUB_ACTIONS.md` for full CI/CD setup.

## Rollback

### Option A — Revert to previous image (fast, no infra change)

```bash
PREVIOUS_SHA=<the git sha of the last good deploy>
cd infra/dev

tofu apply \
  -var="backend_image_tag=${PREVIOUS_SHA}" \
  -var="frontend_image_tag=${PREVIOUS_SHA}"

aws ecs wait services-stable \
  --cluster "$(tofu output -raw ecs_cluster_name)" \
  --services \
    "$(tofu output -raw backend_ecs_service_name)" \
    "$(tofu output -raw frontend_ecs_service_name)"
```

### Option B — Revert code and redeploy via CI

```bash
git revert HEAD       # or git reset --hard <sha>
git push origin main  # triggers the deploy pipeline
```

### Option C — RDS point-in-time restore (data issue)

RDS automated backups are enabled (`backup_retention_days` variable, default 7 days in dev). To restore:

1. In the AWS console, go to RDS → Databases → your DB → Actions → Restore to point in time.
2. Choose a restore time before the bad data event.
3. The restored instance will have a new endpoint — update the `DATABASE_URL` secret in Secrets Manager.
4. Run `tofu apply` to pick up the new secret ARN if needed.

Warning: restoring RDS creates a new instance. The old instance remains until you delete it. ECS tasks must be restarted after the secret is updated.

## Cost estimates (dev, ap-southeast-1, ~2026 pricing)

| Resource | Config | Approx monthly |
|---|---|---|
| ECS Fargate — backend | 0.25 vCPU / 0.5 GB, 1 task | ~$5 |
| ECS Fargate — frontend | 0.25 vCPU / 0.5 GB, 1 task | ~$5 |
| RDS PostgreSQL | db.t3.micro, 20 GB, single-AZ | ~$15 |
| ALB | 1 ALB, low traffic | ~$20 |
| NAT Gateway | 1 NAT GW | ~$35 |
| ECR | < 10 images | ~$1 |
| Secrets Manager | 4 secrets | ~$2 |
| **Total** | | **~$83/month** |

The NAT Gateway dominates. For a cost-only dev environment, consider replacing private subnets with public subnets and assigning public IPs to Fargate tasks (remove NAT GW). Not recommended for production.

## Troubleshooting

**ECS task exits immediately on startup**
- Check CloudWatch logs: `/ecs/yummy-dev/backend` or `/ecs/yummy-dev/frontend`.
- Common cause: `DATABASE_URL` secret not found or RDS not accepting connections. Check the RDS security group allows the ECS security group on port 5432.

**ALB returns 502 Bad Gateway**
- ECS task is unhealthy. Check the target group health in EC2 → Target Groups.
- Backend health check path is `/health`; frontend is `/`.

**`tofu apply` fails: Backend configuration changed**
- You changed the S3 backend config. Run `tofu init -reconfigure`.

**RDS `FATAL: password authentication failed`**
- The `DATABASE_URL` secret may be stale. Verify the secret value in Secrets Manager, then force a new ECS deployment to pick up the updated secret.

## Legacy reference

`docs/aws/APP_RUNNER_AMPLIFY.md` documents the previous App Runner + Amplify deployment path. It is **no longer the primary target** and is retained for historical context only. App Runner's 120-second request timeout and limited VPC integration made it unsuitable for the YUMMY SSE-heavy workload.
