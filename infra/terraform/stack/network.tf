data "aws_availability_zones" "available" {
  count = local.institutional ? 1 : 0
  state = "available"
  filter {
    name   = "opt-in-status"
    values = ["opt-in-not-required"]
  }
}

locals {
  subnet_slots = local.institutional ? { a = 0, b = 1 } : {}
}

resource "aws_vpc" "platform" {
  count                = local.institutional ? 1 : 0
  cidr_block           = "10.71.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
}

resource "aws_internet_gateway" "api" {
  count  = local.institutional ? 1 : 0
  vpc_id = aws_vpc.platform[0].id
}

resource "aws_subnet" "public" {
  for_each          = local.subnet_slots
  vpc_id            = aws_vpc.platform[0].id
  availability_zone = data.aws_availability_zones.available[0].names[each.value]
  cidr_block        = cidrsubnet(aws_vpc.platform[0].cidr_block, 8, each.value)
}

resource "aws_subnet" "private" {
  for_each          = local.subnet_slots
  vpc_id            = aws_vpc.platform[0].id
  availability_zone = data.aws_availability_zones.available[0].names[each.value]
  cidr_block        = cidrsubnet(aws_vpc.platform[0].cidr_block, 8, 10 + each.value)
}

resource "aws_route_table" "public" {
  count  = local.institutional ? 1 : 0
  vpc_id = aws_vpc.platform[0].id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.api[0].id
  }
}

resource "aws_route_table" "private" {
  count  = local.institutional ? 1 : 0
  vpc_id = aws_vpc.platform[0].id
}

resource "aws_route_table_association" "public" {
  for_each       = aws_subnet.public
  subnet_id      = each.value.id
  route_table_id = aws_route_table.public[0].id
}

resource "aws_route_table_association" "private" {
  for_each       = aws_subnet.private
  subnet_id      = each.value.id
  route_table_id = aws_route_table.private[0].id
}

resource "aws_vpc_endpoint" "s3" {
  count             = local.institutional ? 1 : 0
  vpc_id            = aws_vpc.platform[0].id
  service_name      = "com.amazonaws.${var.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private[0].id]
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = "*"
      Action    = ["s3:GetObject", "s3:GetObjectVersion"]
      Resource  = "${aws_s3_bucket.storage["products"].arn}/runs/*"
    }]
  })
}

resource "aws_security_group" "platform" {
  for_each    = local.institutional ? toset(["link", "api", "ingest", "db"]) : toset([])
  name        = "${local.name}-${each.key}"
  description = "Sentinela ${each.key}"
  vpc_id      = aws_vpc.platform[0].id
}

resource "aws_vpc_security_group_ingress_rule" "api" {
  count                        = local.institutional ? 1 : 0
  security_group_id            = aws_security_group.platform["api"].id
  referenced_security_group_id = aws_security_group.platform["link"].id
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
}

resource "aws_vpc_security_group_egress_rule" "link" {
  count                        = local.institutional ? 1 : 0
  security_group_id            = aws_security_group.platform["link"].id
  referenced_security_group_id = aws_security_group.platform["api"].id
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
}

resource "aws_vpc_security_group_ingress_rule" "db" {
  for_each                     = local.institutional ? toset(["api", "ingest"]) : toset([])
  security_group_id            = aws_security_group.platform["db"].id
  referenced_security_group_id = aws_security_group.platform[each.key].id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}

resource "aws_vpc_security_group_egress_rule" "db_clients" {
  for_each                     = aws_vpc_security_group_ingress_rule.db
  security_group_id            = aws_security_group.platform[each.key].id
  referenced_security_group_id = aws_security_group.platform["db"].id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}

resource "aws_vpc_security_group_egress_rule" "api_https" {
  count             = local.institutional ? 1 : 0
  security_group_id = aws_security_group.platform["api"].id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

resource "aws_vpc_security_group_egress_rule" "ingest_s3" {
  count             = local.institutional ? 1 : 0
  security_group_id = aws_security_group.platform["ingest"].id
  prefix_list_id    = aws_vpc_endpoint.s3[0].prefix_list_id
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

resource "aws_db_subnet_group" "platform" {
  count      = local.institutional ? 1 : 0
  name       = local.name
  subnet_ids = [for subnet in aws_subnet.private : subnet.id]
}

resource "aws_db_instance" "platform" {
  count                               = local.institutional ? 1 : 0
  identifier                          = local.name
  engine                              = "postgres"
  engine_version                      = "17"
  instance_class                      = var.db_instance_class
  allocated_storage                   = 20
  max_allocated_storage               = 50
  storage_type                        = "gp3"
  storage_encrypted                   = true
  db_name                             = "sentinela"
  username                            = "sentinela_admin"
  manage_master_user_password         = true
  iam_database_authentication_enabled = true
  multi_az                            = local.redundant
  publicly_accessible                 = false
  db_subnet_group_name                = aws_db_subnet_group.platform[0].name
  vpc_security_group_ids              = [aws_security_group.platform["db"].id]
  backup_retention_period             = 7
  copy_tags_to_snapshot               = true
  deletion_protection                 = var.environment == "prod"
  skip_final_snapshot                 = var.environment != "prod"
  final_snapshot_identifier           = var.environment == "prod" ? "${local.name}-final" : null
  auto_minor_version_upgrade          = true
}
