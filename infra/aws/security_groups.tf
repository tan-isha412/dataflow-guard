# The ALB is the only thing in this architecture with an ingress rule
# from the open internet — everything else's security group only ever
# allows traffic FROM another security group in this list, never from
# 0.0.0.0/0. This is what "no unnecessary internet exposure" actually
# means at the infrastructure level, not just a policy statement.

resource "aws_security_group" "alb" {
  name        = "dataflow-guardian-${var.environment}-alb"
  description = "Public HTTPS/HTTP entry point for the API"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTPS from the internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP from the internet — the listener (alb.tf) redirects this straight to 443, never serves plaintext"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "To the ECS tasks (and nowhere else the ALB needs to initiate traffic to)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "dataflow-guardian-${var.environment}-alb-sg" }
}

# Tradeoff, documented rather than hidden: the ECS tasks (api + worker)
# run in the PUBLIC subnets (network.tf) with a public IP, instead of
# private subnets behind a NAT Gateway. A NAT Gateway is the "more
# correct" answer for a task that shouldn't be internet-reachable at
# all, but it's also a real recurring cost (~$32/mo plus data processing)
# for a project at this scale, and Phase 9 explicitly asks for a simple,
# explainable architecture over a maximally hardened one. What actually
# keeps these tasks locked down is this security group: NOTHING reaches
# port 5000 except the ALB, in either direction traffic can still only
# originate from inside this SG or the ALB's — a public IP being
# assigned doesn't matter if nothing is allowed to talk to it.
# Residual risk: an attacker who already has AWS API access to this
# account (a much bigger problem on its own) could see the task's public
# IP; anyone who does not still cannot reach port 5000 without also
# being inside this security group. A larger deployment should move
# these to private subnets + a NAT Gateway (or VPC endpoints for ECR/
# CloudWatch/Secrets Manager, which removes the need for a NAT Gateway
# entirely) once the cost is justified.
resource "aws_security_group" "ecs_tasks" {
  name        = "dataflow-guardian-${var.environment}-ecs-tasks"
  description = "API and worker Fargate tasks — inbound only from the ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "API traffic from the ALB only"
    from_port       = 5000
    to_port         = 5000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "RDS, ElastiCache, ECR (image pulls), Secrets Manager, CloudWatch Logs — all reached over the internet gateway from this public subnet since there's no VPC endpoint/NAT here"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "dataflow-guardian-${var.environment}-ecs-tasks-sg" }
}

resource "aws_security_group" "rds" {
  name        = "dataflow-guardian-${var.environment}-rds"
  description = "Postgres — inbound only from the ECS tasks' security group, never a CIDR block"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Postgres from API/worker tasks only"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "dataflow-guardian-${var.environment}-rds-sg" }
}

resource "aws_security_group" "redis" {
  name        = "dataflow-guardian-${var.environment}-redis"
  description = "Redis — inbound only from the ECS tasks' security group, never a CIDR block"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Redis from API/worker tasks only"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "dataflow-guardian-${var.environment}-redis-sg" }
}
