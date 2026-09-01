resource "aws_db_subnet_group" "main" {
  subnet_ids = [aws_subnet.public_a.id, aws_subnet.public_b.id]
}

resource "aws_db_instance" "postgres" {
  identifier             = "dataflow-guardian-db"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = "db.t3.micro"        # smallest viable tier for a resume project — not production sizing
  allocated_storage      = 20
  db_name                = "dataflow_guardian"
  username               = "dataflow"
  password               = var.db_password       # supplied via Secrets Manager, never hardcoded
  db_subnet_group_name   = aws_db_subnet_group.main.name
  skip_final_snapshot    = true
  publicly_accessible    = false                  # only reachable from inside the VPC, never the open internet
}