# Remote State Bootstrap

Before running `tofu init` for the first time, create the S3 bucket and DynamoDB lock table that hold remote state. This is a one-time manual step per AWS account.

## Prerequisites

- AWS CLI configured with credentials that have S3 and DynamoDB permissions
- `aws` CLI v2 installed

## Step 1 — Create the S3 state bucket

```bash
aws s3api create-bucket \
  --bucket yummy-tofu-state \
  --region us-east-1

aws s3api put-bucket-versioning \
  --bucket yummy-tofu-state \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket yummy-tofu-state \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

aws s3api put-public-access-block \
  --bucket yummy-tofu-state \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

## Step 2 — Create the DynamoDB lock table

```bash
aws dynamodb create-table \
  --table-name yummy-tofu-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

## Step 3 — Initialize OpenTofu

```bash
cd infra/dev
tofu init
```

OpenTofu will connect to the S3 backend and confirm the state bucket is accessible.

## Step 4 — Create a tfvars file for dev

Copy the example and fill in your values:

```bash
cp infra/dev/terraform.tfvars.example infra/dev/terraform.tfvars
```

Minimum required variables:

```hcl
availability_zones = ["us-east-1a", "us-east-1b"]
github_repo        = "your-org/yummy"
```

Do NOT commit `terraform.tfvars` — it is in `.gitignore`.

## Bucket naming

If the default bucket name `yummy-tofu-state` is already taken (S3 names are globally unique), choose a unique name and update the `bucket` key in `infra/dev/terraform.tf` before bootstrapping.

## Cleanup (destroy state bucket)

Only do this if you are permanently decommissioning the environment:

```bash
aws s3 rm s3://yummy-tofu-state --recursive
aws s3api delete-bucket --bucket yummy-tofu-state --region us-east-1
aws dynamodb delete-table --table-name yummy-tofu-locks --region us-east-1
```
