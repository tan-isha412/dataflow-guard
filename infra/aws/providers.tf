terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # A real deployment should use a remote backend (S3 + DynamoDB lock
  # table) so state isn't only on one engineer's laptop — left as the
  # default local backend here since bootstrapping that backend's own
  # bucket is itself a chicken-and-egg first step a real deployer takes
  # once, not something to hardcode a bucket name for in source control.
  # backend "s3" {
  #   bucket         = "dataflow-guardian-tfstate"
  #   key            = "prod/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "dataflow-guardian-tfstate-lock"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region
}

# CloudFront requires its ACM certificate in us-east-1 specifically,
# regardless of where everything else is deployed.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
