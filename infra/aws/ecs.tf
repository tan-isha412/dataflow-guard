resource "aws_ecs_cluster" "main" {
  name = "dataflow-guardian-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/dataflow-guardian-api"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/dataflow-guardian-worker"
  retention_in_days = 30
}

# ---- IAM ----
# Two DIFFERENT roles, not one — the execution role is what ECS itself
# uses to pull the image and inject secrets BEFORE the container starts;
# the task role is what the application code inside the container
# assumes. This app doesn't currently call any AWS API from inside the
# container (Secrets Manager values arrive as plain env vars via the
# execution role, not fetched at runtime), so the task role is
# deliberately closer to empty — granting it the same broad permissions
# as the execution role "just in case" would be a real, unused privilege
# escalation path.

data "aws_iam_policy_document" "ecs_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_execution" {
  name               = "dataflow-guardian-${var.environment}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# The managed policy above covers ECR pulls + CloudWatch Logs, but NOT
# reading from Secrets Manager — that needs its own narrowly-scoped
# statement naming exactly the one secret this app uses, not
# "secretsmanager:GetSecretValue" on "*".
data "aws_iam_policy_document" "ecs_execution_secrets" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.app_secrets.arn]
  }
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name   = "read-app-secrets"
  role   = aws_iam_role.ecs_execution.id
  policy = data.aws_iam_policy_document.ecs_execution_secrets.json
}

resource "aws_iam_role" "ecs_task" {
  name               = "dataflow-guardian-${var.environment}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}

# ---- Task definitions ----
# Built from Terraform values (real secret ARNs, the ECR repo URLs
# above, the actual ElastiCache/RDS endpoints) rather than parsed from
# ecs-task-def-*.json — those JSON files stay as a readable, valid,
# standalone reference (e.g. for `aws ecs register-task-definition
# --cli-input-json` if someone wants to register a task def by hand
# without Terraform), but they use placeholder values Terraform doesn't
# need to resolve, so they aren't the source of truth for what's
# actually deployed.

locals {
  api_container_definitions = [
    {
      name      = "api"
      image     = "${aws_ecr_repository.api.repository_url}:${var.container_image_tag}"
      essential = true
      portMappings = [
        { containerPort = 5000, protocol = "tcp" }
      ]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "API_PORT", value = "5000" },
        { name = "API_PREFIX", value = "/api/v1" },
        { name = "REDIS_HOST", value = aws_elasticache_replication_group.redis.primary_endpoint_address },
        { name = "REDIS_PORT", value = "6379" },
        { name = "REDIS_TLS", value = "true" },
        {
          name = "ALLOWED_ORIGINS"
          # https://<domain> covers the dashboard (same-origin via
          # CloudFront's /api/* behavior — see cloudfront.tf — so this
          # is almost never actually exercised by the dashboard's own
          # requests, but cors() still needs a concrete allowlist rather
          # than "*"). var.extension_origin is appended only if set —
          # see its variable description for why that's normally unset.
          value = join(",", compact([
            "https://${var.domain_name}",
            var.extension_origin != "" ? var.extension_origin : null
          ]))
        },
        { name = "JWT_ACCESS_EXPIRES_IN", value = "15m" },
        { name = "JWT_REFRESH_EXPIRES_IN", value = "7d" }
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:DATABASE_URL::" },
        { name = "JWT_ACCESS_SECRET", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:JWT_ACCESS_SECRET::" },
        { name = "JWT_REFRESH_SECRET", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:JWT_REFRESH_SECRET::" },
        { name = "REDIS_PASSWORD", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:REDIS_AUTH_TOKEN::" }
      ]
      healthCheck = {
        command     = ["CMD-SHELL", "node -e \"fetch('http://localhost:5000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 15
      }
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "api"
        }
      }
    }
  ]

  worker_container_definitions = [
    {
      name      = "worker"
      image     = "${aws_ecr_repository.worker.repository_url}:${var.container_image_tag}"
      essential = true
      environment = [
        { name = "REDIS_HOST", value = aws_elasticache_replication_group.redis.primary_endpoint_address },
        { name = "REDIS_PORT", value = "6379" },
        { name = "REDIS_TLS", value = "true" }
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:DATABASE_URL::" },
        { name = "REDIS_PASSWORD", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:REDIS_AUTH_TOKEN::" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.worker.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "worker"
        }
      }
    }
  ]
}

resource "aws_ecs_task_definition" "api" {
  family                   = "dataflow-guardian-${var.environment}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn
  container_definitions    = jsonencode(local.api_container_definitions)
}

resource "aws_ecs_task_definition" "worker" {
  family                   = "dataflow-guardian-${var.environment}-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn
  container_definitions    = jsonencode(local.worker_container_definitions)
}

# ---- ALB target group + listeners ----

resource "aws_lb_target_group" "api" {
  name        = "dataflow-guardian-${var.environment}-api"
  port        = 5000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip" # required for awsvpc network mode (Fargate)

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    timeout             = 5
    matcher             = "200"
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.api.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# Plain HTTP is never served — the only thing port 80 does is redirect,
# so an extension/browser that somehow still requests http:// never gets
# a real (interceptable) response back over plaintext.
resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# ---- ECS services ----

resource "aws_ecs_service" "api" {
  name            = "dataflow-guardian-${var.environment}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public_a.id, aws_subnet.public_b.id]
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true # see security_groups.tf's tradeoff note on aws_security_group.ecs_tasks
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 5000
  }

  # ECS's own deployment circuit breaker: if new tasks never pass the
  # target group health check (e.g. a bad migration, a crash-looping
  # container), ECS rolls the service back automatically instead of
  # leaving it stuck deploying forever or, worse, draining the last
  # healthy tasks in favor of ones that never come up.
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  depends_on = [aws_lb_listener.https]
}

resource "aws_ecs_service" "worker" {
  name            = "dataflow-guardian-${var.environment}-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.worker_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public_a.id, aws_subnet.public_b.id]
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
}
