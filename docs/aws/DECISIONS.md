# Architecture Decisions & Scope Lock

This document locks the target architecture for the YUMMY AWS migration and defines the boundaries of the work.

## Target Architecture

The final deployment target is a containerized stack on AWS using modern, vendor-neutral tools where possible.

*   **Compute**: AWS ECS Fargate for both backend and frontend.
*   **Networking**: Application Load Balancer (ALB) for request routing and TLS termination.
*   **Database**: Amazon RDS for PostgreSQL (Standard Edition).
*   **Infrastructure as Code**: OpenTofu (for vendor-neutral governance over Terraform).
*   **Artifacts**: Standard OCI-compliant Docker images stored in Amazon ECR.

## Legacy Reference

The existing documentation in `docs/aws/APP_RUNNER_AMPLIFY.md` is now considered **legacy**. While it remains in the codebase for historical context or very small prototypes, it's not the primary implementation target for this migration. App Runner's limitations (such as the 120s timeout and lack of native VPC integration) make it unsuitable for the platform's growth.

## Scope Guardrails

To maintain focus and ensure a successful migration, the following items are explicitly **out of scope**:

*   **Database Alternatives**: No Amazon Aurora, DynamoDB, or other NoSQL variants.
*   **Orchestration Alternatives**: No EKS (Kubernetes) or App Runner (as primary).
*   **Caching & Messaging**: No Redis, Memcached, or SQS implementation.
*   **Advanced Security**: No WAF (Web Application Firewall) or Shield Advanced.
*   **Resiliency**: No multi-region or multi-AZ configuration (unless default to RDS).
*   **Refactoring**: No route refactors, dependency upgrades, or Lambda rewrites.
*   **Tooling**: No migration from OpenTofu to Terraform or CloudFormation.

## Future Documentation

The following guides will be created as part of the implementation phase:
*   `docs/aws/AWS_DEPLOYMENT_ECS_FARGATE.md`: Detailed ECS Fargate setup.
*   `docs/aws/CI_CD_GITHUB_ACTIONS.md`: Container build and deployment pipelines.
