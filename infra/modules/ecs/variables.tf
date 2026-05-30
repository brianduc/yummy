variable "name_prefix" {
  description = "Prefix for all resource names"
  type        = string
}

variable "aws_region" {
  description = "AWS region for CloudWatch log configuration"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs where ECS tasks run"
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group ID attached to ECS tasks"
  type        = string
}

variable "task_execution_role_arn" {
  description = "IAM role ARN used by ECS task execution"
  type        = string
}

variable "backend_image" {
  description = "Backend container image URI"
  type        = string
}

variable "frontend_image" {
  description = "Frontend container image URI"
  type        = string
}

variable "backend_target_group_arn" {
  description = "Backend ALB target group ARN"
  type        = string
}

variable "frontend_target_group_arn" {
  description = "Frontend ALB target group ARN"
  type        = string
}

variable "database_url_secret_arn" {
  description = "Secrets Manager secret ARN containing the full backend DATABASE_URL"
  type        = string
}

variable "backend_secret_arns" {
  description = "Map of backend environment variable names to Secrets Manager secret ARNs"
  type        = map(string)
  default     = {}
}

variable "frontend_secret_arns" {
  description = "Map of frontend environment variable names to Secrets Manager secret ARNs"
  type        = map(string)
  default     = {}
}

variable "backend_environment" {
  description = "Plaintext backend environment variables"
  type        = map(string)
  default     = {}
}

variable "frontend_environment" {
  description = "Plaintext frontend environment variables"
  type        = map(string)
  default     = {}
}

variable "backend_port" {
  description = "Backend container port"
  type        = number
  default     = 8000
}

variable "frontend_port" {
  description = "Frontend container port"
  type        = number
  default     = 3000
}

variable "backend_cpu" {
  description = "Backend task CPU units"
  type        = number
  default     = 256
}

variable "backend_memory" {
  description = "Backend task memory in MiB"
  type        = number
  default     = 512
}

variable "frontend_cpu" {
  description = "Frontend task CPU units"
  type        = number
  default     = 256
}

variable "frontend_memory" {
  description = "Frontend task memory in MiB"
  type        = number
  default     = 512
}

variable "backend_desired_count" {
  description = "Desired number of backend tasks"
  type        = number
  default     = 1
}

variable "frontend_desired_count" {
  description = "Desired number of frontend tasks"
  type        = number
  default     = 1
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
}

variable "health_check_grace_period_seconds" {
  description = "ECS service health check grace period in seconds"
  type        = number
  default     = 60
}

variable "container_insights_enabled" {
  description = "Whether ECS container insights are enabled"
  type        = bool
  default     = false
}

variable "enable_execute_command" {
  description = "Whether ECS Exec is enabled on services"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
