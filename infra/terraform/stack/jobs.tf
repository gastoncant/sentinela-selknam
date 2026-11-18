locals {
  queue_names = toset(concat(
    length(local.lambda_names) > 0 ? ["jobs"] : [],
    [for channel in keys(local.channels) : "notify-${channel}"]
  ))
  dlq_names = toset(concat(tolist(local.queue_names),
    length(local.lambda_names) > 0 ? ["scheduler"] : [],
    local.institutional ? ["ingest"] : []
  ))
  consumers = { for queue in local.queue_names : queue => (queue == "jobs" ? "gis" : queue) }
}

resource "aws_sqs_queue" "dead" {
  for_each                  = local.dlq_names
  name                      = "${local.name}-${each.key}-dlq"
  sqs_managed_sse_enabled   = true
  message_retention_seconds = 1209600
}

resource "aws_sqs_queue" "main" {
  for_each                   = local.queue_names
  name                       = "${local.name}-${each.key}"
  sqs_managed_sse_enabled    = true
  message_retention_seconds  = 345600
  visibility_timeout_seconds = each.key == "jobs" ? 3600 : 180
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dead[each.key].arn
    maxReceiveCount     = 5
  })
}

resource "aws_sqs_queue_redrive_allow_policy" "dead" {
  for_each  = aws_sqs_queue.main
  queue_url = aws_sqs_queue.dead[each.key].url
  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [each.value.arn]
  })
}

resource "aws_cloudwatch_log_group" "lambda" {
  for_each          = local.lambda_names
  name              = "/aws/lambda/${local.name}-${each.key}"
  retention_in_days = local.log_days
}

resource "aws_iam_role" "lambda" {
  for_each = local.lambda_names
  name     = "${local.name}-lambda-${each.key}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow", Action = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

locals {
  products_arn = try(aws_s3_bucket.storage["products"].arn, "")
  product_settings = length(local.lambda_names) == 0 ? {} : {
    PRODUCTS_BUCKET = aws_s3_bucket.storage["products"].id
  }
  metrics_policy = {
    Effect    = "Allow", Action = ["cloudwatch:PutMetricData"], Resource = "*"
    Condition = { StringEquals = { "cloudwatch:namespace" = local.name } }
  }
  lambda_access = merge(
    {
      planner = [
        { Effect = "Allow", Action = ["sqs:SendMessage"], Resource = try(aws_sqs_queue.main["jobs"].arn, null) },
        { Effect = "Allow", Action = ["s3:GetObject"], Resource = ["${local.products_arn}/configuration/*", "${local.products_arn}/runs/*", "${local.products_arn}/planned/*"] },
        { Effect = "Allow", Action = ["s3:PutObject"], Resource = "${local.products_arn}/planned/*" },
        { Effect = "Allow", Action = ["s3:ListBucket"], Resource = local.products_arn, Condition = { StringLike = { "s3:prefix" = ["planned/*"] } } },
        local.metrics_policy
      ]
      gis = concat([
        { Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject", "s3:AbortMultipartUpload"], Resource = "${local.products_arn}/runs/*" },
        local.metrics_policy
        ], local.supabase ? [
        { Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = var.supabase_secret_arn }
      ] : [])
      probe = [local.metrics_policy]
      ingest = [
        { Effect = "Allow", Action = ["s3:GetObject", "s3:GetObjectVersion"], Resource = "${local.products_arn}/runs/*" },
        { Effect = "Allow", Action = ["rds-db:connect"], Resource = local.institutional ? "${local.db_user_arn}/sentinela_ingest" : null },
        { Effect = "Allow", Action = ["sqs:SendMessage"], Resource = try(aws_sqs_queue.dead["ingest"].arn, null) }
      ]
    },
    { for channel, secret in local.channels : "notify-${channel}" => [
      { Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = secret },
      { Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject"], Resource = "${local.products_arn}/deliveries/${channel}/*" }
    ] }
  )
}

resource "aws_iam_role_policy" "lambda" {
  for_each = local.lambda_names
  role     = aws_iam_role.lambda[each.key].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat([{
      Effect   = "Allow"
      Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "${aws_cloudwatch_log_group.lambda[each.key].arn}:*"
      }], local.lambda_access[each.key], contains(keys(local.consumers), each.key == "gis" ? "jobs" : each.key) ? [{
      Effect   = "Allow"
      Action   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
      Resource = aws_sqs_queue.main[each.key == "gis" ? "jobs" : each.key].arn
    }] : [])
  })
}

resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  count      = local.institutional ? 1 : 0
  role       = aws_iam_role.lambda["ingest"].name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "deny_runtime_eni_management" {
  count = local.institutional ? 1 : 0
  role  = aws_iam_role.lambda["ingest"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Deny"
      Action   = ["ec2:CreateNetworkInterface", "ec2:DeleteNetworkInterface", "ec2:AssignPrivateIpAddresses", "ec2:UnassignPrivateIpAddresses"]
      Resource = "*"
      Condition = { ArnEquals = {
        "lambda:SourceFunctionArn" = "arn:${data.aws_partition.current.partition}:lambda:${var.region}:${data.aws_caller_identity.current.account_id}:function:${local.name}-ingest"
      } }
    }]
  })
}

locals {
  function_settings = {
    planner = merge(local.product_settings, {
      JOB_QUEUE_URL = try(aws_sqs_queue.main["jobs"].url, "")
      CONFIG_KEY    = "configuration/sectors.json"
    })
    gis = merge(local.product_settings, {
      PROCESSOR_MODE      = local.supabase ? "supabase" : "manifest"
      SUPABASE_SECRET_ARN = coalesce(var.supabase_secret_arn, "disabled")
      STAC_ENDPOINT       = "https://earth-search.aws.element84.com/v1"
    })
    ingest = merge(local.product_settings, local.db_environment, { DB_USER = "sentinela_ingest" })
    probe  = { URL = local.institutional ? "${local.api_url}/healthz" : "${local.web_url}/" }
  }
}

resource "aws_lambda_function" "jobs" {
  for_each                       = local.lambda_names
  function_name                  = "${local.name}-${each.key}"
  role                           = aws_iam_role.lambda[each.key].arn
  package_type                   = "Image"
  image_uri                      = lookup(var.lambda_images, startswith(each.key, "notify-") ? "notify" : each.key, "000000000000.dkr.ecr.us-west-2.amazonaws.com/missing:missing")
  architectures                  = ["x86_64"]
  timeout                        = each.key == "gis" ? 600 : each.key == "planner" ? 60 : 30
  memory_size                    = each.key == "gis" ? 2048 : each.key == "ingest" ? 512 : 256
  publish                        = each.key == "gis"
  reserved_concurrent_executions = each.key == "ingest" ? 2 : -1

  environment {
    variables = merge({ METRIC_NAMESPACE = local.name },
      startswith(each.key, "notify-") ? merge(local.product_settings, {
        CHANNEL    = trimprefix(each.key, "notify-")
        SECRET_ARN = local.channels[trimprefix(each.key, "notify-")]
      }) : local.function_settings[each.key]
    )
  }

  dynamic "vpc_config" {
    for_each = each.key == "ingest" ? [1] : []
    content {
      subnet_ids         = [for subnet in aws_subnet.private : subnet.id]
      security_group_ids = [aws_security_group.platform["ingest"].id]
    }
  }

  depends_on = [terraform_data.profile_contract, aws_iam_role_policy.lambda, aws_iam_role_policy_attachment.lambda_vpc, aws_iam_role_policy.deny_runtime_eni_management]
}

resource "aws_lambda_alias" "gis" {
  count            = contains(local.lambda_names, "gis") ? 1 : 0
  name             = "live"
  function_name    = aws_lambda_function.jobs["gis"].function_name
  function_version = aws_lambda_function.jobs["gis"].version

  # Release automation (direct promotion or CodeDeploy) owns live traffic.
  lifecycle {
    ignore_changes = [function_version, routing_config]
  }
}

resource "aws_lambda_event_source_mapping" "queues" {
  for_each                = local.consumers
  event_source_arn        = aws_sqs_queue.main[each.key].arn
  function_name           = each.key == "jobs" ? aws_lambda_alias.gis[0].arn : aws_lambda_function.jobs[each.value].arn
  batch_size              = 1
  function_response_types = ["ReportBatchItemFailures"]
  scaling_config {
    maximum_concurrency = 2
  }
}

resource "aws_lambda_permission" "s3_ingest" {
  count          = local.institutional ? 1 : 0
  statement_id   = "AllowProductsBucket"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.jobs["ingest"].function_name
  principal      = "s3.amazonaws.com"
  source_arn     = aws_s3_bucket.storage["products"].arn
  source_account = data.aws_caller_identity.current.account_id
}

resource "aws_s3_bucket_notification" "ingest" {
  count  = local.institutional ? 1 : 0
  bucket = aws_s3_bucket.storage["products"].id
  lambda_function {
    lambda_function_arn = aws_lambda_function.jobs["ingest"].arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "runs/"
    filter_suffix       = "/manifest.json"
  }
  depends_on = [aws_lambda_permission.s3_ingest]
}

resource "aws_lambda_function_event_invoke_config" "ingest" {
  count                        = local.institutional ? 1 : 0
  function_name                = aws_lambda_function.jobs["ingest"].function_name
  maximum_retry_attempts       = 2
  maximum_event_age_in_seconds = 3600
  destination_config {
    on_failure {
      destination = aws_sqs_queue.dead["ingest"].arn
    }
  }
  depends_on = [aws_iam_role_policy.lambda]
}

resource "aws_scheduler_schedule_group" "jobs" {
  count = length(local.scheduled_functions) > 0 ? 1 : 0
  name  = local.name
}

resource "aws_iam_role" "scheduler" {
  count = length(local.scheduled_functions) > 0 ? 1 : 0
  name  = "${local.name}-scheduler"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow", Action = "sts:AssumeRole", Principal = { Service = "scheduler.amazonaws.com" }
      Condition = { StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id, "aws:SourceArn" = aws_scheduler_schedule_group.jobs[0].arn } }
    }]
  })
}

resource "aws_iam_role_policy" "scheduler" {
  count = length(local.scheduled_functions) > 0 ? 1 : 0
  role  = aws_iam_role.scheduler[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = "lambda:InvokeFunction", Resource = [for name in keys(local.scheduled_functions) : aws_lambda_function.jobs[name].arn] },
      { Effect = "Allow", Action = "sqs:SendMessage", Resource = aws_sqs_queue.dead["scheduler"].arn }
    ]
  })
}

resource "aws_scheduler_schedule" "jobs" {
  for_each            = local.scheduled_functions
  name                = each.key
  group_name          = aws_scheduler_schedule_group.jobs[0].name
  schedule_expression = each.value
  state               = var.schedule_enabled ? "ENABLED" : "DISABLED"
  flexible_time_window {
    mode = "OFF"
  }
  target {
    arn      = aws_lambda_function.jobs[each.key].arn
    role_arn = aws_iam_role.scheduler[0].arn
    input    = jsonencode({ task = each.key, scheduled_at = "<aws.scheduler.scheduled-time>" })
    retry_policy {
      maximum_event_age_in_seconds = 3600
      maximum_retry_attempts       = 2
    }
    dead_letter_config {
      arn = aws_sqs_queue.dead["scheduler"].arn
    }
  }
  depends_on = [aws_iam_role_policy.scheduler]
}
