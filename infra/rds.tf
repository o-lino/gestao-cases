
resource "aws_db_subnet_group" "main" {
  name       = "gestao-cases-db-subnet-group-${var.environment}"
  subnet_ids = [aws_subnet.public_1.id, aws_subnet.public_2.id]

  tags = {
    Name = "gestao-cases-db-subnet-group-${var.environment}"
  }
}

resource "aws_security_group" "rds" {
  name        = "gestao-cases-rds-sg-${var.environment}"
  description = "Allow PostgreSQL inbound traffic"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "PostgreSQL from VPC"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "gestao-cases-rds-sg-${var.environment}"
  }
}

resource "aws_db_instance" "main" {
  identifier           = "gestao-cases-db-${var.environment}"
  allocated_storage    = 20
  storage_type         = "gp2"
  engine               = "postgres"
  engine_version       = "15.3"
  instance_class       = "db.t3.micro"
  db_name              = "gestaocases"
  username             = "postgres"
  password             = var.db_password
  parameter_group_name = "default.postgres15"
  skip_final_snapshot  = true
  publicly_accessible  = true # For dev purposes only

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  tags = {
    Name = "gestao-cases-db-${var.environment}"
  }
}
