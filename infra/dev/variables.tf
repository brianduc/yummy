variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name used as a prefix for all resources"
  type        = string
  default     = "yummy"
}

variable "environment" {
  description = "Deployment environment (dev / staging / prod)"
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of AZs to use — must supply at least 2 (data-source resolved at plan time)"
  type        = list(string)
}

variable "public_subnet_cidrs" {
  description = "One CIDR per AZ for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "One CIDR per AZ for private subnets"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24"]
}

variable "github_repo" {
  description = "GitHub repository for OIDC role trust in owner/repo format"
  type        = string
}

variable "app_secrets" {
  description = "Map of application secret names to placeholder values (populated post-deploy)"
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "secret_recovery_window_days" {
  description = "Number of days before deleted Secrets Manager secrets can be permanently deleted"
  type        = number
  default     = 7
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

variable "backend_image_tag" {
  description = "Backend ECR image tag to deploy"
  type        = string
  default     = "latest"
}

variable "frontend_image_tag" {
  description = "Frontend ECR image tag to deploy"
  type        = string
  default     = "latest"
}

variable "database_name" {
  description = "Initial RDS database name"
  type        = string
  default     = "yummy"
}

variable "database_username" {
  description = "RDS master username"
  type        = string
  default     = "yummy"
}

variable "rds_instance_class" {
  description = "RDS instance class for the dev database"
  type        = string
  default     = "db.t4g.micro"
}

variable "rds_multi_az" {
  description = "Whether the dev RDS instance is Multi-AZ"
  type        = bool
  default     = true
}

variable "rds_backup_retention_days" {
  description = "Number of days to retain RDS automated backups"
  type        = number
  default     = 7
}

variable "alb_idle_timeout_seconds" {
  description = "ALB idle timeout in seconds; must remain above 65 seconds for SSE"
  type        = number
  default     = 4000
}

variable "alb_health_check_interval_seconds" {
  description = "ALB target group health check interval in seconds"
  type        = number
  default     = 30
}

variable "backend_desired_count" {
  description = "Desired backend ECS task count"
  type        = number
  default     = 1
}

variable "frontend_desired_count" {
  description = "Desired frontend ECS task count"
  type        = number
  default     = 1
}

variable "backend_environment" {
  description = "Plaintext backend ECS environment variables"
  type        = map(string)
  default = {
    NODE_ENV = "production"
    PORT     = "8000"
  }
}

variable "frontend_environment" {
  description = "Plaintext frontend ECS environment variables"
  type        = map(string)
  default = {
    NODE_ENV = "production"
    PORT     = "3000"
    HOSTNAME = "0.0.0.0"
  }
}
