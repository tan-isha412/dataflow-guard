output "api_url" {
  description = "Production API base URL — this is what apps/extension's --production build needs as API_BASE_URL (with /api/v1 appended)."
  value       = "https://${var.api_subdomain}.${var.domain_name}"
}

output "dashboard_url" {
  description = "Production dashboard URL."
  value       = "https://${var.domain_name}"
}

output "alb_dns_name" {
  description = "Raw ALB DNS name, useful for debugging before Route53/ACM validation has propagated."
  value       = aws_lb.api.dns_name
}

output "cloudfront_domain_name" {
  description = "Raw CloudFront distribution domain, same use as alb_dns_name above."
  value       = aws_cloudfront_distribution.dashboard.domain_name
}

output "ecr_api_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "ecr_worker_repository_url" {
  value = aws_ecr_repository.worker.repository_url
}

output "dashboard_bucket_name" {
  description = "Where `aws s3 sync apps/web/dist/ s3://<this>/` uploads the built dashboard."
  value       = aws_s3_bucket.dashboard.bucket
}

output "rds_endpoint" {
  value     = aws_db_instance.postgres.endpoint
  sensitive = true # includes the port; not a secret by itself, but pairs with db_password to form a full connection string
}

output "redis_endpoint" {
  value     = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive = true
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}
