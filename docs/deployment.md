# Deployment

## Architecture

```
Employee Browser
  └─ DataFlow Guardian Extension ──HTTPS──▶ api.<domain> (ALB) ──▶ ECS Fargate (api) ──▶ RDS Postgres (private subnet)
                                                                                    └──▶ ElastiCache Redis (private subnet, TLS+AUTH)
Administrator
  └─ Browser ──HTTPS──▶ <domain> (CloudFront) ──▶ S3 (dashboard static build)
                                             └─ /api/* ──▶ same ALB/API as above
                                                                                    ECS Fargate (worker) ──▶ same RDS/Redis
```

The dashboard and API share one origin (`https://<domain>`, `/api/*`
proxied by CloudFront straight to the ALB) — `apps/web/src/api/client.js`
uses the relative path `/api/v1` specifically so it never needs a
separate cross-origin URL, and never needs a CORS allowlist entry for
itself. The browser extension is the one real cross-origin caller in
this architecture, and even it doesn't need CORS: an MV3 background
service worker's `fetch` to a `host_permissions`-covered origin bypasses
CORS entirely (see `apps/extension/README.md`'s Permissions section).

Everything is defined in `infra/aws/*.tf` (Terraform) and
`infra/aws/ecs-task-def-*.json` (standalone reference task-definition
JSON — Terraform builds its own equivalents from real values rather than
parsing these; see the comment atop `infra/aws/ecs.tf`).

**Deliberate simplifications** (documented, not hidden — see each
file's own comments for the full reasoning):
- ECS tasks run in **public subnets** with a public IP, not private
  subnets behind a NAT Gateway — the security group (only the ALB can
  reach port 5000) is what actually locks them down; a NAT Gateway is a
  real recurring cost this project's scale doesn't need. RDS and
  ElastiCache **do** sit in private subnets with no internet route at
  all — that's the one place this architecture doesn't compromise.
- Single AZ pair, one task per service by default (`api_desired_count`/
  `worker_desired_count` variables) — enough to prove the architecture
  works, not sized for real production load.
- No remote Terraform state backend configured (see the commented-out
  `backend "s3"` block in `providers.tf`) — bootstrapping that bucket is
  itself a first manual step, not something to hardcode a bucket name
  for in source control.

## Prerequisites

- An AWS account with credentials configured (`aws configure` or
  equivalent) with permission to create VPC/RDS/ElastiCache/ECS/ALB/S3/
  CloudFront/ACM/Route53/Secrets Manager/IAM resources.
- A domain you control, with its DNS **already** delegated to a Route53
  public hosted zone (`infra/aws/dns.tf` looks this zone up by name —
  it does not register a domain or create the zone).
- Terraform >= 1.5, Docker, the AWS CLI.

## Step 1 — Generate secrets

```bash
# Never commit any of these. Store them in a password manager or
# generate-and-immediately-apply — the .tfvars file below should never
# be committed either (add it to a local, git-ignored path).
openssl rand -base64 48   # -> jwt_access_secret
openssl rand -base64 48   # -> jwt_refresh_secret
openssl rand -base64 32   # -> db_password
openssl rand -base64 24   # -> redis_auth_token (must end up >= 16 chars; base64 of 24 random bytes clears that easily)
```

## Step 2 — Provision infrastructure

```bash
cd infra/aws
terraform init
terraform apply \
  -var="domain_name=yourcompany.com" \
  -var="db_password=<generated>" \
  -var="jwt_access_secret=<generated>" \
  -var="jwt_refresh_secret=<generated>" \
  -var="redis_auth_token=<generated>"
```

This provisions the VPC (public + private subnets, no NAT Gateway — see
above), RDS Postgres, ElastiCache Redis (TLS + AUTH token required),
ECR repositories, the ECS cluster (with placeholder task definitions —
`container_image_tag` defaults to `"latest"`, which won't exist in ECR
yet on a first apply; see Step 3), the ALB with an HTTPS listener (HTTP
redirects to HTTPS, nothing is ever served over plaintext), ACM
certificates (one regional for the ALB, one in `us-east-1` for
CloudFront — `terraform apply` will pause on DNS validation until the
Route53 records it creates propagate, typically a few minutes), the S3
bucket + CloudFront distribution for the dashboard, and Secrets Manager
entries for everything the containers need.

Note `outputs.tf`'s `api_url`, `dashboard_url`, `ecr_*_repository_url`,
and `dashboard_bucket_name` — Steps 3–4 use them.

## Step 3 — Build and push images

```bash
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com

docker build -f apps/api/Dockerfile -t <ecr_api_repository_url>:latest .
docker push <ecr_api_repository_url>:latest

docker build -f apps/worker/Dockerfile -t <ecr_worker_repository_url>:latest .
docker push <ecr_worker_repository_url>:latest
```

Both builds use the **repo root** as the build context (`docker build
-f apps/api/Dockerfile .`, not `apps/api/Dockerfile apps/api`) — the
Dockerfiles need `packages/shared` and, for the worker, `apps/api/prisma`
(to generate a real Prisma client — see the comment in
`apps/worker/Dockerfile`). `.dockerignore` at the repo root keeps
`node_modules`/`.env`/`.git`/etc. out of the build context regardless.

After the first push, re-apply Terraform (or `aws ecs update-service
--cluster <cluster> --service <service> --force-new-deployment` for a
faster path once the task definition already references a real image)
so the ECS services actually pick up the pushed image instead of the
placeholder they started with.

## Step 4 — Run database migrations

```bash
DATABASE_URL="<from Secrets Manager, or construct from outputs.rds_endpoint + db_password>" \
  npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
```

Run from a machine that can reach the RDS instance — it's in a private
subnet, so this means either a bastion/VPN into the VPC, AWS Systems
Manager Session Manager port forwarding, or (simplest for a first
deploy) running this once as a one-off ECS task using the `api` task
definition with `CMD` overridden to
`npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma`.
`migrate deploy` (never `db push`, never `migrate dev`) is the only
migration command Terraform/this doc ever tells you to run against a
real database — `db push` has no migration history and can silently
diverge from what's in source control.

## Step 5 — Deploy the dashboard

```bash
npm run build --workspace=@dataflow-guardian/web
aws s3 sync apps/web/dist/ s3://<dashboard_bucket_name>/ --delete
aws cloudfront create-invalidation --distribution-id <id> --paths "/*"
```

## Step 6 — Build the production extension

```bash
API_BASE_URL=https://api.yourcompany.com/api/v1 \
  npm run build:production --workspace=@dataflow-guardian/extension
```

Refuses to build (see `apps/extension/scripts/build.js`) if
`API_BASE_URL` is unset, still the localhost default, or not `https://`.
Produces `apps/extension/dist/` — a clean, loadable, production-
configured extension (no dev URLs, no source outside `src/`, no test
files). See `apps/extension/README.md`'s "Load into Chrome / Edge" for
the unpacked-load flow; this repo does not publish to the Chrome Web
Store (that needs a developer account, review process, and listing
assets this repo doesn't own) — only the package + these instructions.

## Verifying a deployment

```bash
curl https://api.yourcompany.com/health          # {"status":"ok"} — liveness, no dependency checks
curl https://api.yourcompany.com/health/ready     # {"status":"ready","dependencies":{"database":"up","redis":"up"}}
```

Then the full smoke test: open `https://yourcompany.com`, register/log
in, create a policy, load the extension pointed at
`https://api.yourcompany.com/api/v1`, log in via the popup, and run
through ALLOW/BLOCK/REDACT/REQUIRE_APPROVAL on a supported site — see
the root README's "Demo script" section for the exact prompts.

## Local development

`docker-compose.yml` — Postgres + Redis only, for `npm run dev`.

`docker-compose.prod.yml` — the full stack containerized (api, worker,
nginx-fronted web, Postgres, Redis), useful for testing the production
Docker images and nginx's `/api/*` reverse-proxy path locally without
touching AWS at all:

```bash
DATABASE_URL=postgresql://dataflow:change_me@postgres:5432/dataflow_guardian \
POSTGRES_USER=dataflow POSTGRES_PASSWORD=change_me POSTGRES_DB=dataflow_guardian \
JWT_ACCESS_SECRET=<generated> JWT_REFRESH_SECRET=<generated> \
REDIS_PASSWORD=<generated> ALLOWED_ORIGINS=http://localhost \
  docker compose -f docker-compose.prod.yml up --build
```

No service in this file publishes a database or cache port to the
host — only `web` (80) is reachable, matching the "don't expose
internal services" principle the AWS path also follows.

## Ongoing deploys

`.github/workflows/docker-build.yml` builds (but does not push) images
on every merge to `main`. Wiring that to push to ECR and run
`aws ecs update-service --force-new-deployment` is the natural next
step once registry credentials are configured as repository secrets —
left as a documented next step rather than built speculatively.

## What has and hasn't actually been verified

- **Verified in this environment**: `terraform fmt -check` (valid HCL
  across every file), all three Dockerfiles reviewed for correctness
  (the worker's missing `prisma generate` step — a real pre-existing
  bug — was found and fixed this way), `npx prisma migrate deploy`
  against a real Postgres, the API running with `NODE_ENV=production`
  end-to-end (register → policy → ALLOW → BLOCK → dashboard summary →
  graceful SIGTERM shutdown), and the extension's `--production` build
  producing a correctly-rewritten `dist/`.
- **NOT verified**: `terraform init`/`validate`/`plan`/`apply` against
  a real AWS account. This sandbox's outbound network policy explicitly
  denies `registry.terraform.io` (confirmed via the proxy's own status
  endpoint — a deliberate policy denial, not a transient failure), so
  the Terraform provider plugin cannot be downloaded here, and the
  `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` present in this
  environment are not valid credentials for a real account
  (`aws sts get-caller-identity` returns `InvalidClientTokenId`). No
  AWS resource described in this document has actually been created —
  this is infrastructure-as-code that has been written and manually
  reviewed for correctness, not applied.
