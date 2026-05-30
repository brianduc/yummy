output "db_password_secret_arn" {
  description = "ARN of the DB master password secret"
  value       = aws_secretsmanager_secret.db_password.arn
}

output "db_password_secret_name" {
  description = "Name of the DB master password secret"
  value       = aws_secretsmanager_secret.db_password.name
}

output "db_password_value" {
  description = "Generated DB master password (sensitive)"
  value       = random_password.db_master.result
  sensitive   = true
}

output "app_secret_arns" {
  description = "Map of app secret name to ARN"
  value       = { for k, v in aws_secretsmanager_secret.app_secrets : k => v.arn }
}
