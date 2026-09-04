resource "aws_secretsmanager_secret" "app_secrets" {
  name = "dataflow-guardian-${var.environment}/app-secrets"
}

resource "aws_secretsmanager_secret_version" "app_secrets_version" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    JWT_ACCESS_SECRET  = var.jwt_access_secret
    JWT_REFRESH_SECRET = var.jwt_refresh_secret
    DATABASE_URL       = "postgresql://dataflow:${var.db_password}@${aws_db_instance.postgres.endpoint}/dataflow_guardian"
    # Matches infra/aws/elasticache.tf's auth_token — the ECS task
    # definitions (ecs.tf) inject this as REDIS_PASSWORD, which
    # config/redis.js reads.
    REDIS_AUTH_TOKEN = var.redis_auth_token
  })
}
