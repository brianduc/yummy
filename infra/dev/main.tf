locals {
  name_prefix = "${var.project}-${var.environment}"

  backend_port  = var.backend_port
  frontend_port = var.frontend_port

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
  recovery_window_days = var.secret_recovery_window_days
  app_secrets          = var.app_secrets
  tags                 = local.common_tags
}

module "security" {
  source = "../modules/security"

  name_prefix   = local.name_prefix
  vpc_id        = module.vpc.vpc_id
  backend_port  = local.backend_port
  frontend_port = local.frontend_port
  tags          = local.common_tags
}

module "rds" {
  source = "../modules/rds"

  name_prefix                 = local.name_prefix
  private_subnet_ids          = module.vpc.private_subnet_ids
  security_group_id           = module.security.rds_security_group_id
  database_name               = var.database_name
  master_username             = var.database_username
  master_password             = module.secrets.db_password_value
  instance_class              = var.rds_instance_class
  multi_az                    = var.rds_multi_az
  backup_retention_days       = var.rds_backup_retention_days
  secret_recovery_window_days = var.secret_recovery_window_days
  tags                        = local.common_tags

  depends_on = [module.security]
}

module "iam" {
  source = "../modules/iam"

  name_prefix = local.name_prefix
  github_repo = var.github_repo
  secrets_arns = concat(
    [module.secrets.db_password_secret_arn, module.rds.database_url_secret_arn],
    values(module.secrets.app_secret_arns)
  )
  tags = local.common_tags
}

module "alb" {
  source = "../modules/alb"

  name_prefix                   = local.name_prefix
  vpc_id                        = module.vpc.vpc_id
  public_subnet_ids             = module.vpc.public_subnet_ids
  security_group_id             = module.security.alb_security_group_id
  backend_port                  = local.backend_port
  frontend_port                 = local.frontend_port
  idle_timeout_seconds          = var.alb_idle_timeout_seconds
  health_check_interval_seconds = var.alb_health_check_interval_seconds
  tags                          = local.common_tags

  depends_on = [module.security]
}

module "ecs" {
  source = "../modules/ecs"

  name_prefix             = local.name_prefix
  aws_region              = var.aws_region
  private_subnet_ids      = module.vpc.private_subnet_ids
  security_group_id       = module.security.ecs_security_group_id
  task_execution_role_arn = module.iam.ecs_task_execution_role_arn

  backend_image  = "${module.ecr.backend_repository_url}:${var.backend_image_tag}"
  frontend_image = "${module.ecr.frontend_repository_url}:${var.frontend_image_tag}"

  backend_target_group_arn  = module.alb.backend_target_group_arn
  frontend_target_group_arn = module.alb.frontend_target_group_arn
  database_url_secret_arn   = module.rds.database_url_secret_arn
  backend_secret_arns       = module.secrets.app_secret_arns

  backend_environment    = var.backend_environment
  frontend_environment   = var.frontend_environment
  backend_port           = local.backend_port
  frontend_port          = local.frontend_port
  backend_desired_count  = var.backend_desired_count
  frontend_desired_count = var.frontend_desired_count
  tags                   = local.common_tags

  depends_on = [module.alb, module.iam, module.rds]
}
