resource "aws_elasticache_subnet_group" "main" {
  name       = "dataflow-guardian-${var.environment}-redis"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]
}

# A replication group (not the plain aws_elasticache_cluster resource)
# specifically because AUTH tokens and in-transit encryption — both of
# which config/redis.js's REDIS_PASSWORD support (see apps/api/src/
# config/env.js) is meant to be used with in production — are only
# available on replication groups, even a single-node one like this.
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "dataflow-guardian-${var.environment}-redis"
  description          = "DataFlow Guardian rate limiting, BullMQ job queues, audit retention sweep"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = "cache.t3.micro" # smallest viable tier for a resume project — not production sizing
  num_cache_clusters   = 1                # single node; a real production deployment should run >=2 with automatic failover enabled
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.redis_auth_token

  tags = { Name = "dataflow-guardian-${var.environment}-redis" }
}
