# Deployment

Infrastructure is defined in `infra/aws/*.tf` (Terraform) and
`infra/aws/ecs-task-def-*.json` (ECS Fargate task definitions).

## First-time setup
1. `terraform init && terraform apply` inside `infra/aws/` — provisions
   the VPC, RDS Postgres, ElastiCache Redis, and Secrets Manager entries.
2. Build and push images: `docker build -f apps/api/Dockerfile -t <ecr-repo>/api .`
   (repeat for `worker` and `web`).
3. Register the ECS task definitions and create services pointing at
   the ALB provisioned by `network.tf`.

## Ongoing deploys
`.github/workflows/docker-build.yml` builds new images on every merge
to `main`. Wiring that to auto-deploy to ECS (via `aws ecs update-service
--force-new-deployment`) is the natural next step once the images are
pushed to a real registry.