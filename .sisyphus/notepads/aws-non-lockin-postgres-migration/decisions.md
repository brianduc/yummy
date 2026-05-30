### AWS Migration Architecture Lock
- Target: ECS Fargate + ALB + RDS PostgreSQL + OpenTofu + OCI images.
- Scope: Standardized on Fargate for compute and RDS for database.
- Legacy: App Runner/Amplify docs marked as reference only.
- Guardrails: Explicitly excluded Aurora, EKS, Redis, SQS, and other high-complexity/lock-in services.
- Governance: Selected OpenTofu to maintain vendor-neutral infrastructure management.

