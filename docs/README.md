## Documentation index

This repository is a **public** prototype of **YUMMY** — an AI-powered multi-agent SDLC platform (FastAPI backend + Next.js frontend).

### Getting started

- `../README.md`: quickstart (local dev)
- `product/FEATURES.md`: what the app does today
- `product/USER_GUIDE.md`: how to use the web UI (end-to-end)

### Deployment (AWS)

Start here (fastest path, no Docker needed on your machine):

- `aws/ROUTE53_DOMAIN.md`: register a domain in Route 53 + DNS fundamentals (beginner-friendly)
- **`aws/APP_RUNNER_AMPLIFY.md`**: **recommended** — deploy backend on App Runner + frontend on Amplify Hosting + custom domains in Route 53

Advanced / later (when you outgrow App Runner):

- `aws/AWS_DEPLOYMENT_ECS_FARGATE.md`: full ECS Fargate + ALB split deploy (VPC, ECR, task definitions)
- `aws/CI_CD_GITHUB_ACTIONS.md`: build and push container images from GitHub (for the ECS path)
- `aws/TROUBLESHOOTING.md`: common AWS issues

The Docker artifacts in the repo (`docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `.github/workflows/docker-build.yml`) are kept for the advanced path and for local container runs. You do NOT need them for the recommended fast path above.

### Architecture & roadmap

- `reference/ARCHITECTURE.md`: the “target architecture” vision (agents, MCP, data layer, integrations)
- `product/BACKLOG.md`: feature backlog synthesized from `resources/` docs
- `reference/ROADMAP_2_YEARS.md`: curated copy of the roadmap

### Open-core / monetization strategy

- `product/OPEN_CORE_STRATEGY.md`: how to split community vs enterprise features without confusing users

### Contributing

- `dev/CONTRIBUTING.md`

