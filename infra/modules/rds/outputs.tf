output "db_instance_identifier" {
  description = "Identifier of the RDS instance"
  value       = aws_db_instance.this.identifier
}

output "db_instance_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.this.endpoint
}

output "db_instance_address" {
  description = "RDS instance hostname"
  value       = aws_db_instance.this.address
}

output "db_instance_port" {
  description = "RDS instance port"
  value       = aws_db_instance.this.port
}

output "db_subnet_group_name" {
  description = "Name of the RDS subnet group"
  value       = aws_db_subnet_group.this.name
}

output "database_url_secret_arn" {
  description = "ARN of the generated DATABASE_URL secret"
  value       = aws_secretsmanager_secret.database_url.arn
}
