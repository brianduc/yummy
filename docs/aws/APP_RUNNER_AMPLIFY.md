# AWS deploy (fast path): App Runner + Amplify + Route 53

This is the **recommended** path for shipping YUMMY to AWS quickly:

- **Backend** (FastAPI) on **AWS App Runner**, built directly from this GitHub repo (no Docker on your machine).
- **Frontend** (Next.js) on **AWS Amplify Hosting**, built directly from GitHub.
- **DNS** on **Route 53** with two custom subdomains:
  - `api.yourdomain.com` -> App Runner
  - `app.yourdomain.com` -> Amplify

No VPC, no ALB, no ECS, no manual ACM work.

---

## 0) Prerequisites

- AWS account with billing enabled.
- This repo pushed to GitHub (public or private both work).
- A domain, OR plan to use the AWS-provided default URLs for now (see below).
- LLM API key (default: `GEMINI_API_KEY` from https://aistudio.google.com/app/apikey).

### Domain not active yet? (government / registry approval pending)

You can **still deploy today** using AWS-provided default URLs:

- App Runner gives you `https://<random>.<region>.awsapprunner.com`.
- Amplify gives you `https://main.<random>.amplifyapp.com` (or similar).

Do this:

1. **Skip section 1 (Route 53) for now.**
2. Follow section 2 (App Runner) but **skip step 2.6 (Custom domain)**. Note the App Runner default URL after the service is Running.
3. Follow section 3 (Amplify) but **skip step 3.3 (Custom domain)**. Note the Amplify default URL after the first build succeeds.
4. In Amplify env vars, set `NEXT_PUBLIC_API_URL` to the **App Runner default URL** (no custom domain yet).
5. In App Runner env vars, set `CORS_ORIGINS` to the **Amplify default URL**.
6. Smoke test (section 4) using the default URLs.

When your domain is activated later:

- Create the Route 53 hosted zone (section 1).
- Attach `api.yourdomain.com` to App Runner (section 2.6).
- Attach `app.yourdomain.com` to Amplify (section 3.3).
- Update `NEXT_PUBLIC_API_URL` in Amplify to `https://api.yourdomain.com` and **redeploy the frontend** (Next.js bakes this value at build time).
- Update `CORS_ORIGINS` in App Runner to `https://app.yourdomain.com`.

Nothing you set up today is wasted — you only add the custom-domain records later.

---

## 1) Route 53: hosted zone

If you registered the domain in Route 53, a public hosted zone already exists.

If the domain is at a different registrar:

1. Route 53 -> **Hosted zones** -> **Create hosted zone**.
2. Domain name: `yourdomain.com`. Type: **Public hosted zone**.
3. Copy the 4 NS records. Set them as nameservers at your registrar.
4. Wait until `nslookup -type=ns yourdomain.com` returns the Route 53 nameservers.

You do NOT need to create `api` / `app` records yet. App Runner and Amplify will give you the exact values later.

---

## 2) Backend: AWS App Runner (from GitHub source)

We already added [apprunner.yaml](../../apprunner.yaml) at the repo root. App Runner reads this file.

### 2.1 Create the service

1. AWS Console -> **App Runner** -> **Create service**.
2. Source type: **Source code repository** -> **GitHub**.
3. **Connect to GitHub** (first time only): authorize the AWS Connector, then select this repo and branch (`main`).
4. Deployment settings: **Automatic** (deploys on every push to `main`).

### 2.2 Configure build

- **Configuration source**: **Use a configuration file**.
- (The file `apprunner.yaml` at the repo root is auto-detected.)

### 2.3 Configure service

- **Service name**: `yummy-backend`.
- **Virtual CPU**: 1 vCPU.
- **Memory**: 2 GB.
- **Port**: 8080 (matches `apprunner.yaml`).
- **Auto scaling**: create a new custom config with:
  - **Min size**: 1
  - **Max size**: 1
  - **Concurrency**: 100

The Min/Max = 1 is important: YUMMY currently keeps sessions and the repo knowledge base in process memory (see `backend/config.py`). Multiple instances would desynchronize state.

### 2.4 Environment variables and secrets

The default provider is **OpenAI** (set in [apprunner.yaml](../../apprunner.yaml)). Set the following in the App Runner console:

| Key              | Value                                                   | Source              |
|------------------|---------------------------------------------------------|---------------------|
| `AI_PROVIDER`    | `openai` (already set in `apprunner.yaml`)              | Plain text          |
| `OPENAI_MODEL`   | `gpt-4o-mini` (already set in `apprunner.yaml`; override here if needed) | Plain text |
| `CORS_ORIGINS`   | `https://app.yourdomain.com` (or the Amplify default URL while waiting for the domain) | Plain text |
| `OPENAI_API_KEY` | your `sk-...` key                                       | **Secrets Manager** |

Secrets Manager setup for `OPENAI_API_KEY` (2 minutes):

1. AWS Console -> **Secrets Manager** -> **Store a new secret** -> **Other type** -> **Plaintext**.
2. Paste the OpenAI key as the value.
3. Name it `yummy/OPENAI_API_KEY`.
4. Back in App Runner -> service -> **Configuration** -> **Environment variables** -> add `OPENAI_API_KEY`, choose **Reference**, point at `yummy/OPENAI_API_KEY`.
5. The App Runner instance role needs `secretsmanager:GetSecretValue` on that secret ARN.

Other providers are optional. Switch anytime by changing `AI_PROVIDER` and adding the matching key:

- Gemini: `GEMINI_API_KEY`
- Copilot: `COPILOT_GITHUB_TOKEN`
- Bedrock: attach an IAM role with `bedrock:InvokeModel` (preferred) or set `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` + `AWS_REGION` + `BEDROCK_MODEL`.

### 2.5 Create

- Click **Create & deploy**. First build takes ~5-10 minutes.
- When status becomes **Running**, click the default URL. You should see:
  - `https://<random>.awsapprunner.com/health` -> `{"status":"ok"}`
  - `https://<random>.awsapprunner.com/docs` -> Swagger UI

### 2.6 Custom domain for the backend

1. App Runner -> your service -> **Custom domains** -> **Link domain**.
2. Enter `api.yourdomain.com`. App Runner returns:
   - 1 DNS target (CNAME) for the domain itself.
   - 2 certificate validation CNAMEs.
3. Route 53 -> your hosted zone -> add those 3 records exactly as shown.
4. Wait a few minutes. App Runner status changes to **Active**, AWS-managed TLS certificate is provisioned automatically.
5. Open `https://api.yourdomain.com/health` -> `{"status":"ok"}`.

After custom domain is live, you can tighten CORS:

- Update `CORS_ORIGINS` to `https://app.yourdomain.com` (already done if you set it in 2.4).

---

## 3) Frontend: AWS Amplify Hosting (from GitHub source)

### 3.1 Create the app

1. AWS Console -> **Amplify** -> **New app** -> **Deploy web app** -> **GitHub**.
2. Authorize Amplify, pick this repo, branch `main`.
3. **Monorepo**: enable it. Set **app root**: `frontend`.
4. Build settings: Amplify auto-detects Next.js. Accept defaults (the generated `amplify.yml` is fine).

### 3.2 Environment variables

Under **App settings -> Environment variables**, add:

| Key                   | Value                         |
|-----------------------|-------------------------------|
| `NEXT_PUBLIC_API_URL` | `https://api.yourdomain.com`  |

This is baked into the client bundle at build time. See `frontend/lib/api.ts`.

Trigger a redeploy after changing env vars.

### 3.3 Custom domain for the frontend

1. Amplify -> your app -> **Domain management** -> **Add domain**.
2. Enter `yourdomain.com`. Amplify auto-detects the Route 53 hosted zone (same AWS account).
3. Configure subdomains:
   - `app` -> your `main` branch
   - (optional) `www` -> redirect to apex, or leave for later
4. Amplify creates the ACM cert and Route 53 CNAMEs automatically. Wait ~5-15 minutes.
5. Open `https://app.yourdomain.com`. UI loads.

---

## 4) Smoke test

- `https://api.yourdomain.com/health` -> `200 OK`.
- `https://api.yourdomain.com/docs` -> Swagger UI.
- `https://app.yourdomain.com` -> UI loads.
- In the UI:
  1. Open `https://api.yourdomain.com/config/status`. Confirm:
     - `ai_provider: "bedrock"`, `fallback_provider: "openai"`
     - `bedrock_key_source: "iam_role"` (or `"env"` if you intentionally set keys)
     - `bedrock_region` matches the region where you enabled Bedrock model access
  2. In the UI Settings panel: leave Bedrock as the provider; nothing to type if the IAM role is attached.
  3. Setup a public GitHub repo (e.g. `https://github.com/tiangolo/fastapi`) with `max_scan_limit` = 20.
  4. Scan. Poll status.
  5. Ask a question in Chat. Should stream the answer. In Tracing, `provider` should be `bedrock` and `fallback_from` empty.
- Browser DevTools -> Network: confirm requests go to `https://api.yourdomain.com` and succeed without CORS errors.

---

## 5) Known risks (read once)

- **App Runner per-request timeout ~120s.** SSE `/ask` works fine for typical Q&A but very long streams get cut. Keep `max_scan_limit` small (20-200) for the first demos.
- **In-memory state.** Sessions and knowledge base live in process memory. A new deploy or instance restart = state reset. Keep Auto scaling Min/Max = 1.
- **No auth.** Anyone with the URL can call `/ask` and spend your LLM credits. Put the domain behind HTTP basic auth or at least keep `CORS_ORIGINS` strict. Plan to add real auth soon (see `docs/product/BACKLOG.md`).
- **Costs.** Rough order-of-magnitude for a PoC: App Runner ~$25-50/month for 1 vCPU + 2 GB running 24/7, Amplify free tier covers most small frontends, Route 53 ~$0.50/hosted zone/month + query fees.

---

## 6) Updating deploys

- **Backend**: push to `main` -> App Runner auto-deploys (~3-5 min).
- **Frontend**: push to `main` -> Amplify auto-builds and deploys (~3-5 min).
- Changing env vars in either service triggers a redeploy.

---

## 7) Rollback

- App Runner: your service page -> **Deployment history** -> select previous deployment -> **Redeploy**.
- Amplify: app -> **Hosting environments** -> branch -> pick previous build -> **Redeploy this version**.

---

## 8) When to graduate off this setup

This path is PoC-grade. Move to the ECS/ALB path (see `docs/aws/AWS_DEPLOYMENT_ECS_FARGATE.md`) when any of these become true:

- You need PostgreSQL + Redis (persistence).
- You need more than one backend instance (horizontal scale).
- You need SSE streams longer than 120s.
- You need VPC private networking.
- You need auth (SSO/SAML) and audit logs.
