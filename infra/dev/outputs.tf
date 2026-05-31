output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = module.vpc.private_subnet_ids
}

output "backend_ecr_url" {
  description = "ECR repository URL for the backend image"
  value       = module.ecr.backend_repository_url
}

output "frontend_ecr_url" {
  description = "ECR repository URL for the frontend image"
  value       = module.ecr.frontend_repository_url
}

output "ecs_task_execution_role_arn" {
  description = "ARN of the ECS task execution IAM role"
  value       = module.iam.ecs_task_execution_role_arn
}

output "github_actions_role_arn" {
  description = "ARN of the GitHub Actions deploy/build OIDC IAM role"
  value       = module.iam.github_actions_role_arn
}

output "github_actions_infra_role_arn" {
  description = "ARN of the GitHub Actions infra/apply OIDC IAM role"
  value       = module.iam.github_actions_infra_role_arn
}

output "db_password_secret_arn" {
  description = "ARN of the RDS master password secret"
  value       = module.secrets.db_password_secret_arn
}

output "alb_security_group_id" {
  description = "ID of the ALB security group"
  value       = module.security.alb_security_group_id
}

output "ecs_security_group_id" {
  description = "ID of the ECS tasks security group"
  value       = module.security.ecs_security_group_id
}

output "rds_security_group_id" {
  description = "ID of the RDS security group"
  value       = module.security.rds_security_group_id
}

output "alb_dns_name" {
  description = "DNS name of the application load balancer"
  value       = module.alb.alb_dns_name
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = module.ecs.cluster_name
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = module.rds.db_instance_endpoint
}

output "backend_ecs_service_name" {
  description = "Name of the backend ECS service"
  value       = module.ecs.backend_service_name
}

output "frontend_ecs_service_name" {
  description = "Name of the frontend ECS service"
  value       = module.ecs.frontend_service_name
}

output "database_url_secret_arn" {
  description = "ARN of the backend DATABASE_URL secret"
  value       = module.rds.database_url_secret_arn
}
