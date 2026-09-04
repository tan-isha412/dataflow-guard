variable "aws_region" {
  description = "AWS region for everything except the CloudFront ACM cert (which must be us-east-1)."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Short environment name, used in resource names/tags."
  type        = string
  default     = "prod"
}

variable "domain_name" {
  description = "The domain the React dashboard/API are served from, e.g. \"dataflowguardian.example.com\". Used for the ACM certificate and CloudFront alias — leave as the placeholder until a real domain is available."
  type        = string
  default     = "dataflowguardian.example.com"
}

variable "api_subdomain" {
  description = "Subdomain the API is served from, e.g. \"api\" -> api.dataflowguardian.example.com."
  type        = string
  default     = "api"
}

variable "db_password" {
  description = "RDS Postgres master password. Never has a default — must be supplied at apply time (e.g. -var or a .tfvars file that is itself never committed) or, preferably, generated and stored directly in Secrets Manager out of band."
  type        = string
  sensitive   = true
}

variable "jwt_access_secret" {
  description = "JWT access token signing secret. No default, same reasoning as db_password."
  type        = string
  sensitive   = true
}

variable "jwt_refresh_secret" {
  description = "JWT refresh token signing secret. No default, same reasoning as db_password."
  type        = string
  sensitive   = true
}

variable "redis_auth_token" {
  description = "ElastiCache Redis AUTH token. Must be at least 16 characters if transit encryption is enabled (it is, see elasticache.tf). No default."
  type        = string
  sensitive   = true
}

variable "extension_origin" {
  description = "The browser extension's effective request origin for CORS — a Manifest V3 extension's background fetch to a host_permissions-covered origin is not subject to CORS at all (see apps/extension/README.md's Permissions section), so in practice this is usually left unset; it exists for a defense-in-depth allowlist entry if the extension architecture ever changes to rely on CORS instead."
  type        = string
  default     = ""
}

variable "container_image_tag" {
  description = "Image tag to deploy for the api/worker ECS services (an ECR tag pushed by CI, e.g. a commit SHA). \"latest\" is a reasonable default for a first deploy but should be pinned to a specific tag for anything you want to be able to roll back to."
  type        = string
  default     = "latest"
}

variable "api_desired_count" {
  description = "Number of API tasks to run. 1 is enough to prove the architecture works; a real production deployment would run >= 2 across AZs for availability during deploys."
  type        = number
  default     = 1
}

variable "worker_desired_count" {
  description = "Number of worker tasks to run. BullMQ workers are safe to run more than one of (jobs are claimed atomically), but 1 is enough for this project's actual job volume."
  type        = number
  default     = 1
}
