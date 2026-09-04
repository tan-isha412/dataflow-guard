resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "dataflow-guardian-${var.environment}-vpc" }
}

# Public subnets: the ALB, and (see the tradeoff note on aws_security_group.ecs_tasks
# in security_groups.tf) the ECS tasks themselves — no NAT Gateway is
# provisioned, which keeps this a "simple, explainable" architecture per
# Phase 9's guidance and avoids a real recurring cost for a project at
# this scale, at the cost of the ECS tasks having a public IP. The
# security group is what actually keeps them locked down, not the
# subnet's placement (see security_groups.tf's comment for the detailed
# tradeoff and what a larger deployment would do instead).
resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true
  tags                    = { Name = "dataflow-guardian-${var.environment}-public-a" }
}

resource "aws_subnet" "public_b" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "${var.aws_region}b"
  map_public_ip_on_launch = true
  tags                    = { Name = "dataflow-guardian-${var.environment}-public-b" }
}

# Private subnets: RDS and ElastiCache ONLY. No route to the internet
# gateway at all — nothing in these subnets can be reached from, or can
# reach, the public internet. This is the one piece of network isolation
# this architecture doesn't compromise on, since the database and cache
# are exactly the "never expose to the public internet unnecessarily"
# assets Phase 9's security review calls out by name.
resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.11.0/24"
  availability_zone = "${var.aws_region}a"
  tags              = { Name = "dataflow-guardian-${var.environment}-private-a" }
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.12.0/24"
  availability_zone = "${var.aws_region}b"
  tags              = { Name = "dataflow-guardian-${var.environment}-private-b" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "dataflow-guardian-${var.environment}-igw" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = { Name = "dataflow-guardian-${var.environment}-public-rt" }
}

resource "aws_route_table_association" "public_a" {
  subnet_id      = aws_subnet.public_a.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_b" {
  subnet_id      = aws_subnet.public_b.id
  route_table_id = aws_route_table.public.id
}

# Private subnets deliberately get NO route table association beyond
# the default (local VPC traffic only) — no route to the internet
# gateway, no NAT. RDS/ElastiCache never need outbound internet access.

resource "aws_lb" "api" {
  name               = "dataflow-guardian-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_b.id]
  security_groups    = [aws_security_group.alb.id]

  # Access logs are worth turning on for a real deployment (an S3
  # bucket + `access_logs { ... }` block) — omitted here since it needs
  # a bucket this Terraform doesn't otherwise provision, not because it
  # isn't worth having.
}
