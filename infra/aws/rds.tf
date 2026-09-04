resource "aws_db_subnet_group" "main" {
  name       = "dataflow-guardian-${var.environment}-db"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]
  tags       = { Name = "dataflow-guardian-${var.environment}-db-subnet-group" }
}

resource "aws_db_instance" "postgres" {
  identifier              = "dataflow-guardian-${var.environment}-db"
  engine                  = "postgres"
  engine_version          = "16"
  instance_class          = "db.t3.micro" # smallest viable tier for a resume project — not production sizing
  allocated_storage       = 20
  storage_encrypted       = true
  db_name                 = "dataflow_guardian"
  username                = "dataflow"
  password                = var.db_password # supplied via a Terraform variable at apply time, never hardcoded — see secrets.tf for how it then flows into the running containers
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  skip_final_snapshot     = true  # acceptable for a demo/resume project; a real deployment should set this false and configure automated backups explicitly
  publicly_accessible     = false # only reachable from inside the VPC (and in practice, only from aws_security_group.ecs_tasks — see security_groups.tf), never the open internet
  deletion_protection     = false # same reasoning as skip_final_snapshot — flip both for a real deployment
  backup_retention_period = 7
}
