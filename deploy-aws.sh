#!/usr/bin/env bash
# ============================================================
# YUMMY - AWS / OpenTofu bootstrap + deploy helper
#
# Usage:
#   bash deploy-aws.sh [OPTIONS]
#
# Options (all optional; script prompts for missing values):
#   --profile   <aws-profile>      AWS CLI named profile (default: none / env default)
#   --region    <aws-region>       AWS region (default: us-east-1)
#   --bucket    <s3-bucket>        Tofu state S3 bucket name
#   --table     <dynamo-table>     Tofu lock DynamoDB table name
#   --project   <name>             Project prefix (default: yummy)
#   --env       <env>              Environment label (default: dev)
#   --repo      <owner/repo>       GitHub repo for OIDC trust (e.g. acme/yummy)
#   --azs       <az1,az2,...>      Comma-separated AZs (e.g. us-east-1a,us-east-1b)
#   --backend-tag  <tag>           Backend ECR image tag (default: latest)
#   --frontend-tag <tag>           Frontend ECR image tag (default: latest)
#   --secrets   <NAME,NAME,...>    Comma-separated app secret names (optional)
#   --yes                          Skip tofu apply confirmation (auto-approve)
#   --non-interactive              Never prompt; require all needed values via flags/env
#   --plan-only                    Run init/validate/plan but do NOT apply
#   --help | -h                    Print this help and exit
# ============================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$ROOT_DIR/infra/dev"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── helpers ────────────────────────────────────────────────

info()    { echo -e "${CYAN}[deploy-aws]${NC} $*"; }
success() { echo -e "${GREEN}[deploy-aws]${NC} $*"; }
warn()    { echo -e "${YELLOW}[deploy-aws] WARN:${NC} $*"; }
die()     { echo -e "${RED}[deploy-aws] ERROR:${NC} $*" >&2; exit 1; }

prompt() {
  # prompt <var_name> <display_label> [default_value]
  local var="$1" label="$2" default="${3:-}"
  if [ -n "$default" ]; then
    read -r -p "$(echo -e "${BOLD}$label${NC} [${default}]: ")" input
    printf -v "$var" '%s' "${input:-$default}"
  else
    read -r -p "$(echo -e "${BOLD}$label${NC}: ")" input
    printf -v "$var" '%s' "${input}"
  fi
}

prompt_yn() {
  # prompt_yn <display_label> — returns 0 for yes, 1 for no
  local label="$1"
  local answer
  read -r -p "$(echo -e "${BOLD}$label${NC} [y/N]: ")" answer
  [[ "$answer" =~ ^[Yy]$ ]]
}

require_value() {
  local flag="$1"
  local value="${2:-}"
  [ -n "$value" ] || die "Missing value for $flag"
}

trim() {
  printf '%s' "$1" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//'
}

escape_hcl_string() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  value="${value//$'\r'/\\r}"
  printf '%s' "$value"
}

validate_regex() {
  local label="$1"
  local value="$2"
  local pattern="$3"
  [[ "$value" =~ $pattern ]] || die "Invalid $label: $value"
}

# ── defaults ───────────────────────────────────────────────

OPT_PROFILE=""
OPT_REGION=""
OPT_BUCKET=""
OPT_TABLE=""
OPT_PROJECT=""
OPT_ENV=""
OPT_REPO=""
OPT_AZS=""
OPT_BACKEND_TAG=""
OPT_FRONTEND_TAG=""
OPT_SECRETS=""
OPT_YES=false
OPT_NON_INTERACTIVE=false
OPT_PLAN_ONLY=false

# ── parse flags ────────────────────────────────────────────

show_help() {
  cat <<'EOF'
YUMMY - AWS / OpenTofu bootstrap + deploy helper

Usage:
  bash deploy-aws.sh [OPTIONS]

Options (all optional; script prompts for missing values):
  --profile <aws-profile>      AWS CLI named profile (default: none / env default)
  --region <aws-region>        AWS region (default: us-east-1)
  --bucket <s3-bucket>         Tofu state S3 bucket name
  --table <dynamo-table>       Tofu lock DynamoDB table name
  --project <name>             Project prefix (default: yummy)
  --env <env>                  Environment label (default: dev)
  --repo <owner/repo>          GitHub repo for OIDC trust (e.g. acme/yummy)
  --azs <az1,az2,...>          Comma-separated AZs (e.g. us-east-1a,us-east-1b)
  --backend-tag <tag>          Backend ECR image tag (default: latest)
  --frontend-tag <tag>         Frontend ECR image tag (default: latest)
  --secrets <NAME,NAME,...>    Comma-separated app secret names (optional)
  --yes                        Skip tofu apply confirmation (auto-approve)
  --non-interactive            Never prompt; require all needed values via flags/env
  --plan-only                  Run init/validate/plan but do NOT apply
  --help | -h                  Print this help and exit

Examples:
  bash deploy-aws.sh
  bash deploy-aws.sh --region ap-southeast-1 --repo your-org/yummy-monorepo --azs ap-southeast-1a,ap-southeast-1b --yes
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h)   show_help ;;
    --profile)   require_value "$1" "${2:-}"; OPT_PROFILE="$2";     shift 2 ;;
    --region)    require_value "$1" "${2:-}"; OPT_REGION="$2";      shift 2 ;;
    --bucket)    require_value "$1" "${2:-}"; OPT_BUCKET="$2";      shift 2 ;;
    --table)     require_value "$1" "${2:-}"; OPT_TABLE="$2";       shift 2 ;;
    --project)   require_value "$1" "${2:-}"; OPT_PROJECT="$2";     shift 2 ;;
    --env)       require_value "$1" "${2:-}"; OPT_ENV="$2";         shift 2 ;;
    --repo)      require_value "$1" "${2:-}"; OPT_REPO="$2";        shift 2 ;;
    --azs)       require_value "$1" "${2:-}"; OPT_AZS="$2";         shift 2 ;;
    --backend-tag)  require_value "$1" "${2:-}"; OPT_BACKEND_TAG="$2";  shift 2 ;;
    --frontend-tag) require_value "$1" "${2:-}"; OPT_FRONTEND_TAG="$2"; shift 2 ;;
    --secrets)   require_value "$1" "${2:-}"; OPT_SECRETS="$2";     shift 2 ;;
    --yes)       OPT_YES=true;         shift ;;
    --non-interactive) OPT_NON_INTERACTIVE=true; shift ;;
    --plan-only) OPT_PLAN_ONLY=true;   shift ;;
    *) die "Unknown option: $1  (run with --help)" ;;
  esac
done

if [ ! -t 0 ]; then
  OPT_NON_INTERACTIVE=true
fi

# ── banner ─────────────────────────────────────────────────

echo ""
echo -e "${CYAN}${BOLD}YUMMY — AWS / OpenTofu Bootstrap${NC}"
echo "========================================"
echo ""

# ── prereq checks ──────────────────────────────────────────

for cmd in aws tofu; do
  if ! command -v "$cmd" &>/dev/null; then
    die "'$cmd' not found in PATH. Install it before running this script."
  fi
done

if command -v docker &>/dev/null; then
  info "Docker : $(docker --version)"
else
  warn "Docker not found in PATH. Infra bootstrap can proceed, but image build/push steps will not work later."
fi

AWS_VERSION="$(aws --version 2>&1 | head -1)"
TOFU_VERSION="$(tofu version | head -1)"
info "AWS CLI : $AWS_VERSION"
info "OpenTofu: $TOFU_VERSION"
echo ""

# ── interactive prompts ────────────────────────────────────

# AWS profile (optional — blank means use ambient credentials)
if [ -z "$OPT_PROFILE" ] && [ -n "${AWS_PROFILE:-}" ]; then
  OPT_PROFILE="$AWS_PROFILE"
fi

if [ -z "$OPT_PROFILE" ] && ! $OPT_NON_INTERACTIVE; then
  read -r -p "$(echo -e "${BOLD}AWS CLI profile${NC} (leave blank for default/env credentials): ")" OPT_PROFILE
fi

# Set AWS_PROFILE if provided
if [ -n "$OPT_PROFILE" ]; then
  export AWS_PROFILE="$OPT_PROFILE"
  info "Using AWS profile: $OPT_PROFILE"
fi

# Verify credentials
if ! aws sts get-caller-identity &>/dev/null; then
  die "AWS credentials not valid. Configure '~/.aws/credentials' or set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY."
fi
IDENTITY="$(aws sts get-caller-identity --query 'Arn' --output text 2>/dev/null)"
success "Authenticated as: $IDENTITY"
echo ""

# Region
if [ -z "$OPT_REGION" ]; then
  if $OPT_NON_INTERACTIVE; then
    OPT_REGION="us-east-1"
  else
    prompt OPT_REGION "AWS region" "us-east-1"
  fi
fi
export AWS_DEFAULT_REGION="$OPT_REGION"

# State bucket / table
if [ -z "$OPT_BUCKET" ]; then
  if $OPT_NON_INTERACTIVE; then
    die "--bucket is required in non-interactive mode"
  else
    prompt OPT_BUCKET "Tofu state S3 bucket name" "yummy-tofu-state"
  fi
fi
if [ -z "$OPT_TABLE" ]; then
  if $OPT_NON_INTERACTIVE; then
    die "--table is required in non-interactive mode"
  else
    prompt OPT_TABLE "Tofu lock DynamoDB table" "yummy-tofu-locks"
  fi
fi

# Project / environment
if [ -z "$OPT_PROJECT" ]; then
  if $OPT_NON_INTERACTIVE; then
    OPT_PROJECT="yummy"
  else
    prompt OPT_PROJECT "Project name (resource prefix)" "yummy"
  fi
fi
if [ -z "$OPT_ENV" ]; then
  if $OPT_NON_INTERACTIVE; then
    OPT_ENV="dev"
  else
    prompt OPT_ENV "Environment label" "dev"
  fi
fi

# GitHub repo
if [ -z "$OPT_REPO" ] && ! $OPT_NON_INTERACTIVE; then
  prompt OPT_REPO "GitHub repo for OIDC trust (owner/repo)" ""
fi
[ -z "$OPT_REPO" ] && die "github_repo is required."

# Availability zones
if [ -z "$OPT_AZS" ]; then
  if $OPT_NON_INTERACTIVE; then
    die "--azs is required in non-interactive mode"
  else
    DEFAULT_AZS="${OPT_REGION}a,${OPT_REGION}b"
    prompt OPT_AZS "Availability zones (comma-separated, ≥2)" "$DEFAULT_AZS"
  fi
fi

# Image tags
if [ -z "$OPT_BACKEND_TAG" ]; then
  if $OPT_NON_INTERACTIVE; then
    OPT_BACKEND_TAG="latest"
  else
    prompt OPT_BACKEND_TAG "Backend ECR image tag" "latest"
  fi
fi
if [ -z "$OPT_FRONTEND_TAG" ]; then
  if $OPT_NON_INTERACTIVE; then
    OPT_FRONTEND_TAG="latest"
  else
    prompt OPT_FRONTEND_TAG "Frontend ECR image tag" "latest"
  fi
fi

# Optional app secret names only (values must be populated later in Secrets Manager)
if [ -z "$OPT_SECRETS" ] && ! $OPT_NON_INTERACTIVE; then
  echo ""
  echo -e "${YELLOW}App secrets are optional secret names. The script creates empty Secrets Manager entries only.${NC}"
  echo -e "${YELLOW}Populate real values later with 'aws secretsmanager put-secret-value'.${NC}"
  read -r -p "$(echo -e "${BOLD}App secret names${NC} (comma-separated, leave blank to skip): ")" OPT_SECRETS
fi

OPT_REGION="$(trim "$OPT_REGION")"
OPT_BUCKET="$(trim "$OPT_BUCKET")"
OPT_TABLE="$(trim "$OPT_TABLE")"
OPT_PROJECT="$(trim "$OPT_PROJECT")"
OPT_ENV="$(trim "$OPT_ENV")"
OPT_REPO="$(trim "$OPT_REPO")"
OPT_AZS="$(trim "$OPT_AZS")"
OPT_BACKEND_TAG="$(trim "$OPT_BACKEND_TAG")"
OPT_FRONTEND_TAG="$(trim "$OPT_FRONTEND_TAG")"
OPT_SECRETS="$(trim "$OPT_SECRETS")"

validate_regex "AWS region" "$OPT_REGION" '^[a-z]{2}-[a-z0-9-]+-[0-9]+$'
validate_regex "state bucket name" "$OPT_BUCKET" '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$'
validate_regex "lock table name" "$OPT_TABLE" '^[A-Za-z0-9_.-]+$'
validate_regex "project name" "$OPT_PROJECT" '^[A-Za-z0-9][A-Za-z0-9_-]*$'
validate_regex "environment label" "$OPT_ENV" '^[A-Za-z0-9][A-Za-z0-9_-]*$'
validate_regex "GitHub repo" "$OPT_REPO" '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'
validate_regex "backend image tag" "$OPT_BACKEND_TAG" '^[A-Za-z0-9][A-Za-z0-9._-]*$'
validate_regex "frontend image tag" "$OPT_FRONTEND_TAG" '^[A-Za-z0-9][A-Za-z0-9._-]*$'

AZ_VALUES=()
IFS=',' read -ra RAW_AZS <<< "$OPT_AZS"
for raw_az in "${RAW_AZS[@]}"; do
  az="$(trim "$raw_az")"
  [ -n "$az" ] || continue
  validate_regex "availability zone" "$az" '^[a-z]{2}-[a-z0-9-]+-[0-9][a-z]$'
  AZ_VALUES+=("$az")
done
[ "${#AZ_VALUES[@]}" -ge 2 ] || die "At least two availability zones are required"

SECRET_NAMES=()
if [ -n "$OPT_SECRETS" ]; then
  IFS=',' read -ra RAW_SECRET_NAMES <<< "$OPT_SECRETS"
  for raw_name in "${RAW_SECRET_NAMES[@]}"; do
    secret_name="$(trim "$raw_name")"
    [ -n "$secret_name" ] || continue
    validate_regex "app secret name" "$secret_name" '^[A-Za-z_][A-Za-z0-9_]*$'
    SECRET_NAMES+=("$secret_name")
  done
fi

echo ""

# ── S3 remote state bootstrap (idempotent) ─────────────────

info "=== Remote state bootstrap ==="

bucket_exists() {
  aws s3api head-bucket --bucket "$1" --region "$OPT_REGION" &>/dev/null
}

if bucket_exists "$OPT_BUCKET"; then
  success "S3 bucket '$OPT_BUCKET' already exists — reusing."
else
  info "Creating S3 bucket '$OPT_BUCKET' in $OPT_REGION ..."

  if [ "$OPT_REGION" = "us-east-1" ]; then
    # us-east-1 must NOT use --create-bucket-configuration (AWS quirk)
    aws s3api create-bucket \
      --bucket "$OPT_BUCKET" \
      --region "$OPT_REGION" \
      --output text >/dev/null
  else
    aws s3api create-bucket \
      --bucket "$OPT_BUCKET" \
      --region "$OPT_REGION" \
      --create-bucket-configuration "LocationConstraint=$OPT_REGION" \
      --output text >/dev/null
  fi

  success "Bucket created."
  aws s3api wait bucket-exists --bucket "$OPT_BUCKET"
fi

info "Enabling versioning on '$OPT_BUCKET' ..."
aws s3api put-bucket-versioning \
  --bucket "$OPT_BUCKET" \
  --versioning-configuration Status=Enabled \
  --region "$OPT_REGION"

info "Enabling AES256 encryption on '$OPT_BUCKET' ..."
aws s3api put-bucket-encryption \
  --bucket "$OPT_BUCKET" \
  --region "$OPT_REGION" \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      },
      "BucketKeyEnabled": true
    }]
  }'

info "Blocking public access on '$OPT_BUCKET' ..."
aws s3api put-public-access-block \
  --bucket "$OPT_BUCKET" \
  --region "$OPT_REGION" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

success "S3 bucket configured."

# DynamoDB lock table
table_exists() {
  aws dynamodb describe-table --table-name "$1" --region "$OPT_REGION" &>/dev/null
}

if table_exists "$OPT_TABLE"; then
  success "DynamoDB table '$OPT_TABLE' already exists — reusing."
else
  info "Creating DynamoDB lock table '$OPT_TABLE' ..."
  aws dynamodb create-table \
    --table-name "$OPT_TABLE" \
    --attribute-definitions "AttributeName=LockID,AttributeType=S" \
    --key-schema "AttributeName=LockID,KeyType=HASH" \
    --billing-mode PAY_PER_REQUEST \
    --region "$OPT_REGION" \
    --output text >/dev/null
  aws dynamodb wait table-exists --table-name "$OPT_TABLE" --region "$OPT_REGION"
  success "DynamoDB table created."
fi

echo ""

# ── Generate terraform.tfvars ──────────────────────────────

TFVARS_FILE="$INFRA_DIR/terraform.tfvars"

info "=== Generating $TFVARS_FILE ==="

if [ -f "$TFVARS_FILE" ]; then
  if $OPT_NON_INTERACTIVE; then
    warn "Overwriting existing $TFVARS_FILE"
  else
    prompt_yn "Overwrite existing $TFVARS_FILE?" || die "Aborted to avoid overwriting $TFVARS_FILE"
  fi
fi

cat > "$TFVARS_FILE" <<TFVARS
# ============================================================
# terraform.tfvars — YUMMY dev environment
# Generated by deploy-aws.sh on $(date -u '+%Y-%m-%dT%H:%M:%SZ')
# DO NOT COMMIT — this file is in .gitignore
# ============================================================

# ── Core ──────────────────────────────────────────────────
aws_region  = "$(escape_hcl_string "$OPT_REGION")"
project     = "$(escape_hcl_string "$OPT_PROJECT")"
environment = "$(escape_hcl_string "$OPT_ENV")"

# ── Availability zones (must supply ≥2) ───────────────────
availability_zones = [
$(for i in "${!AZ_VALUES[@]}"; do
  az="${AZ_VALUES[$i]}"
  suffix=","; [ "$i" -eq $((${#AZ_VALUES[@]} - 1)) ] && suffix=""
  printf '  "%s"%s\n' "$(escape_hcl_string "$az")" "$suffix"
done)
]

# ── GitHub OIDC trust ─────────────────────────────────────
github_repo = "$(escape_hcl_string "$OPT_REPO")"

# ── ECR image tags ────────────────────────────────────────
backend_image_tag  = "$(escape_hcl_string "$OPT_BACKEND_TAG")"
frontend_image_tag = "$(escape_hcl_string "$OPT_FRONTEND_TAG")"

# ── App secret names (values stay empty until you populate Secrets Manager after apply)
$(if [ "${#SECRET_NAMES[@]}" -gt 0 ]; then
  echo "app_secrets = {"
  for secret_name in "${SECRET_NAMES[@]}"; do
    printf '  %s = ""\n' "$secret_name"
  done
  echo "}"
else
  echo "# app_secrets = {}"
  echo "#   GEMINI_API_KEY = \"\""
  echo "# }"
fi)

# ── RDS (defaults are sensible for dev) ───────────────────
# rds_instance_class          = "db.t4g.micro"
# rds_multi_az                = false
# rds_backup_retention_days   = 7

# ── ALB (SSE keep-alive requires ≥65 s; default 4000) ─────
# alb_idle_timeout_seconds    = 4000

# ── ECS task counts ───────────────────────────────────────
# backend_desired_count  = 1
# frontend_desired_count = 1
TFVARS

success "Generated $TFVARS_FILE"
echo ""

# ── tofu init (backend-config overrides) ──────────────────

info "=== tofu init (reconfigure) ==="
cd "$INFRA_DIR"

tofu init \
  -reconfigure \
  -backend-config="bucket=$OPT_BUCKET" \
  -backend-config="key=${OPT_ENV}/terraform.tfstate" \
  -backend-config="region=$OPT_REGION" \
  -backend-config="dynamodb_table=$OPT_TABLE" \
  -backend-config="encrypt=true" \
  ${OPT_PROFILE:+-backend-config="profile=$OPT_PROFILE"} \
  -input=false

success "tofu init OK"
echo ""

# ── tofu validate ──────────────────────────────────────────

info "=== tofu validate ==="
tofu validate
success "tofu validate OK"
echo ""

# ── tofu plan ──────────────────────────────────────────────

PLAN_FILE="/tmp/yummy-tofu-${OPT_ENV}.plan"
info "=== tofu plan (output: $PLAN_FILE) ==="
tofu plan \
  -var-file="$TFVARS_FILE" \
  -out="$PLAN_FILE" \
  -input=false

success "tofu plan OK — plan saved to $PLAN_FILE"
echo ""

# ── tofu apply (optional) ──────────────────────────────────

if $OPT_PLAN_ONLY; then
  info "--plan-only set. Skipping apply."
else
  DO_APPLY=false
  if $OPT_YES; then
    DO_APPLY=true
  else
    echo -e "${YELLOW}Review the plan above before applying.${NC}"
    if prompt_yn "Apply the plan now?"; then
      DO_APPLY=true
    fi
  fi

  if $DO_APPLY; then
    info "=== tofu apply ==="
    tofu apply -input=false "$PLAN_FILE"
    success "tofu apply complete!"
    echo ""

    # ── Print key outputs ──────────────────────────────────
    echo ""
    echo -e "${CYAN}${BOLD}=== Key Outputs ===${NC}"
    tofu output -json 2>/dev/null | \
      python3 -c "
import sys, json
data = json.load(sys.stdin)
keys = ['backend_ecr_url','frontend_ecr_url','alb_dns_name','ecs_cluster_name',
        'backend_ecs_service_name','frontend_ecs_service_name','rds_endpoint',
        'github_actions_role_arn','github_actions_infra_role_arn']
for k in keys:
  if k in data:
    print(f'  {k} = {data[k][\"value\"]}')
" 2>/dev/null || tofu output

    echo ""
    echo -e "${GREEN}${BOLD}=== Next Steps ===${NC}"
    echo ""
    echo -e "1. ${BOLD}Push backend image:${NC}"
    echo -e "   AWS_ACCOUNT_ID=\$(aws sts get-caller-identity --query Account --output text)"
    echo -e "   ECR_REGISTRY=\"\${AWS_ACCOUNT_ID}.dkr.ecr.${OPT_REGION}.amazonaws.com\""
    echo -e "   aws ecr get-login-password --region $OPT_REGION | \\"
    echo -e "     docker login --username AWS --password-stdin \$ECR_REGISTRY"
    echo -e "   docker build -t backend ./backend-ts"
    echo -e "   docker tag backend:latest \$(tofu -chdir=infra/dev output -raw backend_ecr_url):$OPT_BACKEND_TAG"
    echo -e "   docker push \$(tofu -chdir=infra/dev output -raw backend_ecr_url):$OPT_BACKEND_TAG"
    echo ""
    echo -e "2. ${BOLD}Push frontend image:${NC}"
    echo -e "   docker build --build-arg NEXT_PUBLIC_API_URL=http://\$(tofu -chdir=infra/dev output -raw alb_dns_name) -t frontend ./frontend"
    echo -e "   docker tag frontend:latest \$(tofu -chdir=infra/dev output -raw frontend_ecr_url):$OPT_FRONTEND_TAG"
    echo -e "   docker push \$(tofu -chdir=infra/dev output -raw frontend_ecr_url):$OPT_FRONTEND_TAG"
    echo ""
    echo -e "3. ${BOLD}Force ECS rollout (after pushing new images):${NC}"
    echo -e "   CLUSTER=\$(tofu -chdir=infra/dev output -raw ecs_cluster_name)"
    echo -e "   aws ecs update-service --cluster \$CLUSTER --service \$(tofu -chdir=infra/dev output -raw backend_ecs_service_name) --force-new-deployment"
    echo -e "   aws ecs update-service --cluster \$CLUSTER --service \$(tofu -chdir=infra/dev output -raw frontend_ecs_service_name) --force-new-deployment"
    echo ""
    echo -e "4. ${BOLD}Populate app secrets in AWS Secrets Manager:${NC}"
    if [ "${#SECRET_NAMES[@]}" -gt 0 ]; then
      for secret_name in "${SECRET_NAMES[@]}"; do
        echo -e "   aws secretsmanager put-secret-value --secret-id ${OPT_PROJECT}-${OPT_ENV}/${secret_name} --secret-string '<set-real-value>' --region $OPT_REGION"
      done
    else
      echo -e "   No app secret names were requested. Re-run with --secrets NAME,NAME if you want placeholder secrets created."
    fi
    echo ""
    AVAILABILITY_ZONES_JSON="[$(printf '"%s",' "${AZ_VALUES[@]}")]"
    AVAILABILITY_ZONES_JSON="${AVAILABILITY_ZONES_JSON/,]/]}"
    echo -e "5. ${BOLD}Configure GitHub Actions variables:${NC}"
    echo -e "   AWS_REGION=$OPT_REGION"
    echo -e "   AWS_ACCOUNT_ID=\$(aws sts get-caller-identity --query Account --output text)"
    echo -e "   ACTIONS_ROLE_ARN=\$(tofu -chdir=infra/dev output -raw github_actions_role_arn)"
    echo -e "   ACTIONS_INFRA_ROLE_ARN=\$(tofu -chdir=infra/dev output -raw github_actions_infra_role_arn)"
    echo -e "   NEXT_PUBLIC_API_URL=http://\$(tofu -chdir=infra/dev output -raw alb_dns_name)"
    echo -e "   TOFU_STATE_BUCKET=$OPT_BUCKET"
    echo -e "   TOFU_LOCK_TABLE=$OPT_TABLE"
    echo -e "   OIDC_REPO=$OPT_REPO"
    echo -e "   AVAILABILITY_ZONES_JSON=$AVAILABILITY_ZONES_JSON"
    echo ""
    echo -e "6. ${BOLD}App URL:${NC}"
    echo -e "   http://\$(tofu -chdir=infra/dev output -raw alb_dns_name)"
    echo ""
    echo -e "7. ${BOLD}All tofu outputs:${NC}"
    echo -e "   tofu -chdir=infra/dev output"
    echo ""
  else
    info "Apply skipped. Re-run without --plan-only or answer 'y' at the prompt to apply."
    echo ""
    echo -e "${YELLOW}To apply manually later:${NC}"
    echo "  cd infra/dev && tofu apply \"$PLAN_FILE\""
    echo ""
  fi
fi

# ── plan-only next steps ───────────────────────────────────

if $OPT_PLAN_ONLY; then
  echo -e "${YELLOW}=== Plan-only run complete ===${NC}"
  echo ""
  echo -e "To apply the saved plan:"
  echo "  cd infra/dev && tofu apply \"$PLAN_FILE\""
  echo ""
  echo -e "Or re-run with --yes to auto-approve:"
  echo "  bash deploy-aws.sh --yes [other flags...]"
  echo ""
fi

success "Done."
