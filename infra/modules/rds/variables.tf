variable "name_prefix" {
  description = "Prefix for all resource names"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for the RDS subnet group"
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group ID attached to the RDS instance"
  type        = string
}

variable "database_name" {
  description = "Initial database name"
  type        = string
  default     = "yummy"
}

variable "master_username" {
  description = "RDS master username"
  type        = string
  default     = "yummy"
}

variable "master_password" {
  description = "RDS master password"
  type        = string
  sensitive   = true
}

variable "engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "16"
}

variable "instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "allocated_storage" {
  description = "Initial allocated storage in GiB"
  type        = number
  default     = 20
}

variable "max_allocated_storage" {
  description = "Maximum autoscaled storage in GiB"
  type        = number
  default     = 100
}

variable "multi_az" {
  description = "Whether to deploy the RDS instance as Multi-AZ"
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Number of days to retain automated backups"
  type        = number
  default     = 7
}

variable "backup_window" {
  description = "Preferred backup window"
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "Preferred maintenance window"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

variable "deletion_protection" {
  description = "Whether deletion protection is enabled"
  type        = bool
  default     = false
}

variable "skip_final_snapshot" {
  description = "Whether to skip a final snapshot on deletion"
  type        = bool
  default     = true
}

variable "secret_recovery_window_days" {
  description = "Number of days before a deleted generated DATABASE_URL secret can be permanently deleted"
  type        = number
  default     = 7
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
