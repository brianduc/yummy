## Documentation index

This repository is a **public** prototype of **YUMMY** — an AI-powered multi-agent SDLC platform (FastAPI backend + Next.js frontend).

### Getting started

- `../README.md`: quickstart (local dev)
- `product/FEATURES.md`: what the app does today
- `product/USER_GUIDE.md`: how to use the web UI (end-to-end)

### Deployment (AWS)

**Current recommended path** (ECS Fargate + RDS PostgreSQL, fully portable):

- `../deploy-aws.sh`: interactive AWS/OpenTofu bootstrap helper
- `aws/AWS_DEPLOYMENT_ECS_FARGATE.md`: full ECS Fargate + ALB + RDS PostgreSQL deploy with OpenTofu
- `aws/CI_CD_GITHUB_ACTIONS.md`: GitHub Actions CI/CD pipeline (OIDC, no long-lived keys)
- `aws/DECISIONS.md`: architecture decisions and scope guardrails
- `aws/REMOTE_STATE_BOOTSTRAP.md`: OpenTofu S3 + DynamoDB remote state setup

**Legacy** (preserved for reference only, not recommended for new deploys):

- `aws/APP_RUNNER_AMPLIFY.md`: legacy App Runner + Amplify path (AWS App Runner is no longer open to new customers)
- `aws/ROUTE53_DOMAIN.md`: register a domain in Route 53 + DNS fundamentals

For local development, use `docker compose up` (see `../README.md`).

### Architecture & roadmap

- `reference/ARCHITECTURE.md`: the “target architecture” vision (agents, MCP, data layer, integrations)
- `product/BACKLOG.md`: feature backlog synthesized from `resources/` docs
- `reference/ROADMAP_2_YEARS.md`: curated copy of the roadmap

### Open-core / monetization strategy

- `product/OPEN_CORE_STRATEGY.md`: how to split community vs enterprise features without confusing users

### Contributing

- `dev/CONTRIBUTING.md`
