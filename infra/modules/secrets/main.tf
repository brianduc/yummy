resource "random_password" "db_master" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "db_password" {
  name                    = "${var.name_prefix}/db/master-password"
  description             = "RDS master password for ${var.name_prefix}"
  recovery_window_in_days = var.recovery_window_days

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db_master.result
}

resource "aws_secretsmanager_secret" "app_secrets" {
  for_each = nonsensitive(toset(keys(var.app_secrets)))

  name                    = "${var.name_prefix}/${each.key}"
  description             = "Application secret: ${each.key}"
  recovery_window_in_days = var.recovery_window_days

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  for_each = nonsensitive(toset(keys(var.app_secrets)))

  secret_id     = aws_secretsmanager_secret.app_secrets[each.key].id
  secret_string = each.value
}
