variable "name_prefix" {
  description = "Prefix for all resource names"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where security groups are created"
  type        = string
}

variable "backend_port" {
  description = "Port the backend ECS container listens on"
  type        = number
  default     = 8000
}

variable "frontend_port" {
  description = "Port the frontend ECS container listens on"
  type        = number
  default     = 3000
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
