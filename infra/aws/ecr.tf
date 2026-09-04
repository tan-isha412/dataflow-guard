resource "aws_ecr_repository" "api" {
  name                 = "dataflow-guardian-api"
  image_tag_mutability = "IMMUTABLE" # a given tag (e.g. a commit SHA) always refers to the same image — "latest" being re-pushed is still allowed as its own separate, mutable-in-effect tag
  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "worker" {
  name                 = "dataflow-guardian-worker"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
}

# The React app is deployed to S3 + CloudFront (see cloudfront.tf), not
# a container, so it doesn't need an ECR repo — apps/web/Dockerfile
# still exists for the self-hosted docker-compose.prod.yml path, which
# is its own thing, not this repo.
