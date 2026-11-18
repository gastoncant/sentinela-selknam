locals {
  db_environment = local.institutional ? {
    DB_HOST = aws_db_instance.platform[0].address
    DB_NAME = aws_db_instance.platform[0].db_name
    DB_PORT = "5432"
  } : {}
  db_user_arn = local.institutional ? "arn:${data.aws_partition.current.partition}:rds-db:${var.region}:${data.aws_caller_identity.current.account_id}:dbuser:${aws_db_instance.platform[0].resource_id}" : null
}

resource "aws_service_discovery_private_dns_namespace" "api" {
  count = local.institutional ? 1 : 0
  name  = "${local.name}.internal"
  vpc   = aws_vpc.platform[0].id
}

resource "aws_service_discovery_service" "api" {
  count = local.institutional ? 1 : 0
  name  = "api"

  dns_config {
    namespace_id   = aws_service_discovery_private_dns_namespace.api[0].id
    routing_policy = "MULTIVALUE"
    dns_records {
      ttl  = 30
      type = "SRV"
    }
  }

  health_check_custom_config {}
}

resource "aws_iam_role" "ecs" {
  for_each = local.institutional ? toset(["execution", "api"]) : toset([])
  name     = "${local.name}-ecs-${each.key}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Condition = { StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id } }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  count      = local.institutional ? 1 : 0
  role       = aws_iam_role.ecs["execution"].name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "api" {
  count = local.institutional ? 1 : 0
  role  = aws_iam_role.ecs["api"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["rds-db:connect"], Resource = "${local.db_user_arn}/sentinela_api" },
      { Effect = "Allow", Action = ["s3:GetObject"], Resource = "${aws_s3_bucket.storage["products"].arn}/runs/*" },
      { Effect = "Allow", Action = ["sqs:SendMessage"], Resource = aws_sqs_queue.main["jobs"].arn },
      { Effect = "Allow", Action = ["sns:Publish"], Resource = aws_sns_topic.environmental[0].arn }
    ]
  })
}

resource "aws_cloudwatch_log_group" "ecs" {
  count             = local.institutional ? 1 : 0
  name              = "/ecs/${local.name}"
  retention_in_days = local.log_days
}

resource "aws_ecs_cluster" "api" {
  count = local.institutional ? 1 : 0
  name  = local.name
}

resource "aws_ecs_task_definition" "api" {
  count                    = local.institutional ? 1 : 0
  family                   = "${local.name}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs["execution"].arn
  task_role_arn            = aws_iam_role.ecs["api"].arn
  container_definitions = jsonencode([{
    name                   = "api"
    image                  = var.api_image
    essential              = true
    readonlyRootFilesystem = true
    portMappings           = [{ containerPort = 8080, protocol = "tcp" }]
    healthCheck = {
      command     = ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/healthz', timeout=2)"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 45
    }
    environment = [for name, value in merge(local.db_environment, {
      DB_USER             = "sentinela_api"
      JOB_QUEUE_URL       = aws_sqs_queue.main["jobs"].url
      PRODUCTS_BUCKET     = aws_s3_bucket.storage["products"].id
      ENVIRONMENTAL_TOPIC = aws_sns_topic.environmental[0].arn
      COGNITO_ISSUER      = local.cognito_issuer
      COGNITO_CLIENT_ID   = aws_cognito_user_pool_client.operators[0].id
    }) : { name = name, value = value }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.ecs[0].name
        awslogs-region        = var.region
        awslogs-stream-prefix = "api"
      }
    }
  }])
  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }
}

resource "aws_ecs_service" "api" {
  count                         = local.institutional ? 1 : 0
  name                          = "api"
  cluster                       = aws_ecs_cluster.api[0].id
  task_definition               = aws_ecs_task_definition.api[0].arn
  launch_type                   = "FARGATE"
  desired_count                 = local.redundant ? 2 : 1
  availability_zone_rebalancing = "ENABLED"

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = [for subnet in aws_subnet.public : subnet.id]
    security_groups  = [aws_security_group.platform["api"].id]
    assign_public_ip = true
  }

  service_registries {
    registry_arn = aws_service_discovery_service.api[0].arn
    port         = 8080
  }

  # Terraform owns the initial task definition; release automation promotes revisions.
  lifecycle {
    ignore_changes = [task_definition]
  }

  depends_on = [aws_route_table_association.public, aws_iam_role_policy_attachment.ecs_execution, aws_vpc_security_group_egress_rule.api_https]
}

resource "aws_cognito_user_pool" "operators" {
  count                    = local.institutional ? 1 : 0
  name                     = local.name
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  deletion_protection      = var.environment == "prod" ? "ACTIVE" : "INACTIVE"

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }
}

resource "aws_cognito_user_pool_domain" "operators" {
  count        = local.institutional ? 1 : 0
  domain       = "${local.name}-${data.aws_caller_identity.current.account_id}"
  user_pool_id = aws_cognito_user_pool.operators[0].id
}

resource "aws_cognito_resource_server" "api" {
  count        = local.institutional ? 1 : 0
  identifier   = "sentinela"
  name         = "Sentinela API"
  user_pool_id = aws_cognito_user_pool.operators[0].id

  scope {
    scope_name        = "api"
    scope_description = "Access operator API routes"
  }
}

resource "aws_cognito_user_pool_client" "operators" {
  count                                = local.institutional ? 1 : 0
  name                                 = "sentinela-web"
  user_pool_id                         = aws_cognito_user_pool.operators[0].id
  generate_secret                      = false
  prevent_user_existence_errors        = "ENABLED"
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = concat(["openid", "email"], aws_cognito_resource_server.api[0].scope_identifiers)
  callback_urls                        = ["${local.web_url}/"]
  logout_urls                          = ["${local.web_url}/"]
  supported_identity_providers         = ["COGNITO"]
}

locals {
  cognito_issuer = local.institutional ? "https://cognito-idp.${var.region}.${data.aws_partition.current.dns_suffix}/${aws_cognito_user_pool.operators[0].id}" : null
}

resource "aws_apigatewayv2_api" "http" {
  count                        = local.institutional ? 1 : 0
  name                         = local.name
  protocol_type                = "HTTP"
  disable_execute_api_endpoint = var.api_hostname != null
  cors_configuration {
    allow_origins = [local.web_url]
    allow_headers = ["authorization", "content-type"]
    allow_methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    max_age       = 300
  }
}

resource "aws_apigatewayv2_vpc_link" "api" {
  count              = local.institutional ? 1 : 0
  name               = local.name
  security_group_ids = [aws_security_group.platform["link"].id]
  subnet_ids         = [for subnet in aws_subnet.private : subnet.id]
}

resource "aws_apigatewayv2_integration" "api" {
  count                  = local.institutional ? 1 : 0
  api_id                 = aws_apigatewayv2_api.http[0].id
  integration_type       = "HTTP_PROXY"
  integration_method     = "ANY"
  connection_type        = "VPC_LINK"
  connection_id          = aws_apigatewayv2_vpc_link.api[0].id
  integration_uri        = aws_service_discovery_service.api[0].arn
  payload_format_version = "1.0"
  timeout_milliseconds   = 10000
  request_parameters     = { "overwrite:path" = "$request.path" }
}

resource "aws_apigatewayv2_authorizer" "operators" {
  count            = local.institutional ? 1 : 0
  api_id           = aws_apigatewayv2_api.http[0].id
  name             = "cognito"
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  jwt_configuration {
    issuer   = local.cognito_issuer
    audience = [aws_cognito_user_pool_client.operators[0].id]
  }
}

resource "aws_apigatewayv2_route" "api" {
  for_each             = local.institutional ? toset(["ANY /{proxy+}", "GET /healthz"]) : toset([])
  api_id               = aws_apigatewayv2_api.http[0].id
  route_key            = each.key
  target               = "integrations/${aws_apigatewayv2_integration.api[0].id}"
  authorization_type   = each.key == "GET /healthz" ? "NONE" : "JWT"
  authorizer_id        = each.key == "GET /healthz" ? null : aws_apigatewayv2_authorizer.operators[0].id
  authorization_scopes = each.key == "GET /healthz" ? null : aws_cognito_resource_server.api[0].scope_identifiers
}

resource "aws_cloudwatch_log_group" "gateway" {
  count             = local.institutional ? 1 : 0
  name              = "/apigateway/${local.name}"
  retention_in_days = local.log_days
}

resource "aws_apigatewayv2_stage" "api" {
  count       = local.institutional ? 1 : 0
  api_id      = aws_apigatewayv2_api.http[0].id
  name        = "$default"
  auto_deploy = true
  default_route_settings {
    throttling_burst_limit = 40
    throttling_rate_limit  = 20
  }
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.gateway[0].arn
    format = jsonencode({
      request_id = "$context.requestId"
      route      = "$context.routeKey"
      status     = "$context.status"
      latency_ms = "$context.responseLatency"
    })
  }
}
