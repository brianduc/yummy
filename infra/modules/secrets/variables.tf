variable "name_prefix" {
  description = "Prefix for all resource names"
  type        = string
}

variable "recovery_window_days" {
  description = "Number of days before a deleted secret can be permanently deleted (0 to disable recovery)"
  type        = number
  default     = 7
}

variable "app_secrets" {
  description = "Map of additional application secret names to their initial values (e.g. {\"openai-api-key\" = \"\"})"
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
