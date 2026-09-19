terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }

  # State lives in a private, versioned, encrypted bucket in the same account. Locking uses an S3
  # lock file, so there is no separate database to run.
  backend "s3" {
    bucket       = "mostatelax-prod-tfstate"
    key          = "prod/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region = "us-east-1"

  # Credentials come from the environment (AWS_PROFILE=org locally). Nothing secret lives here.
  # These match the tags the account already used before Terraform.
  default_tags {
    tags = {
      Project     = "mostate-lacrosse"
      Environment = "prod"
      ManagedBy   = "terraform"
    }
  }
}
