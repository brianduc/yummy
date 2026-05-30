variable "name_prefix" {
  description = "Prefix for all resource names"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where ALB target groups are created"
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet IDs for the ALB"
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group ID attached to the ALB"
  type        = string
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

variable "backend_health_check_path" {
  description = "Backend health check path"
  type        = string
  default     = "/health"
}

variable "backend_listener_rules" {
  description = "Map of backend ALB path patterns to listener priorities"
  type        = map(number)
  default = {
    "/api/*"        = 100
    "/ask*"         = 110
    "/config*"      = 120
    "/docs*"        = 130
    "/help*"        = 140
    "/health"       = 150
    "/kb*"          = 160
    "/metrics*"     = 170
    "/openapi.json" = 180
    "/sdlc*"        = 190
    "/sessions*"    = 200
    "/world*"       = 210
  }
}

variable "frontend_health_check_path" {
  description = "Frontend health check path"
  type        = string
  default     = "/"
}

variable "health_check_interval_seconds" {
  description = "Target group health check interval in seconds"
  type        = number
  default     = 30
}

variable "idle_timeout_seconds" {
  description = "ALB idle timeout in seconds; keep above 65 seconds for SSE"
  type        = number
  default     = 4000
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
