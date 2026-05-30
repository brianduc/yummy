locals {
  name_prefix = "${var.project}-${var.environment}"

  common_tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "opentofu"
  }
}

module "vpc" {
  source = "../modules/vpc"

  name_prefix          = local.name_prefix
  vpc_cidr             = var.vpc_cidr
  availability_zones   = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  tags                 = local.common_tags
}

module "ecr" {
  source = "../modules/ecr"

  name_prefix = local.name_prefix
  tags        = local.common_tags
}

module "secrets" {
  source = "../modules/secrets"

  name_prefix          = local.name_prefix
  recovery_window_days = 7
  app_secrets          = var.app_secrets
  tags                 = local.common_tags
}

module "security" {
  source = "../modules/security"

  name_prefix   = local.name_prefix
  vpc_id        = module.vpc.vpc_id
  backend_port  = 8000
  frontend_port = 3000
  tags          = local.common_tags
}

module "iam" {
  source = "../modules/iam"

  name_prefix  = local.name_prefix
  github_repo  = var.github_repo
  secrets_arns = concat(
    [module.secrets.db_password_secret_arn],
    values(module.secrets.app_secret_arns)
  )
  tags = local.common_tags
}
