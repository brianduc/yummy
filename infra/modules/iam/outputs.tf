output "ecs_task_execution_role_arn" {
  description = "ARN of the ECS task execution IAM role"
  value       = aws_iam_role.ecs_task_execution.arn
}

output "ecs_task_execution_role_name" {
  description = "Name of the ECS task execution IAM role"
  value       = aws_iam_role.ecs_task_execution.name
}

output "github_actions_role_arn" {
  description = "ARN of the GitHub Actions deploy/build OIDC IAM role"
  value       = aws_iam_role.github_actions.arn
}

output "github_actions_infra_role_arn" {
  description = "ARN of the GitHub Actions infra/apply OIDC IAM role"
  value       = aws_iam_role.github_actions_infra.arn
}

output "github_oidc_provider_arn" {
  description = "ARN of the GitHub Actions OIDC provider"
  value       = aws_iam_openid_connect_provider.github.arn
}
