variable "name_prefix" {
  description = "Prefix for all resource names"
  type        = string
}

variable "secrets_arns" {
  description = "ARNs of Secrets Manager secrets that ECS task execution role can read"
  type        = list(string)
  default     = []
}

variable "github_repo" {
  description = "GitHub repository in owner/repo format for OIDC trust (e.g. acme/yummy)"
  type        = string
}

variable "remote_state_bucket_name" {
  description = "S3 bucket name used for OpenTofu remote state"
  type        = string
}

variable "remote_state_lock_table_name" {
  description = "DynamoDB table name used for OpenTofu remote state locking"
  type        = string
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
