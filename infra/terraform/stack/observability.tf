resource "aws_sns_topic" "operations" {
  name = "${local.name}-operations"
}

resource "aws_sns_topic_policy" "operations" {
  arn = aws_sns_topic.operations.arn
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow", Principal = { AWS = "arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action = "sns:*", Resource = aws_sns_topic.operations.arn
      },
      {
        Effect = "Allow", Principal = { Service = "cloudwatch.amazonaws.com" }
        Action = "sns:Publish", Resource = aws_sns_topic.operations.arn
        Condition = {
          StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id }
          ArnLike      = { "aws:SourceArn" = "arn:${data.aws_partition.current.partition}:cloudwatch:${var.region}:${data.aws_caller_identity.current.account_id}:alarm:${local.name}-*" }
        }
      }
    ]
  })
}

resource "aws_sns_topic_subscription" "operations" {
  count     = var.notify_email == null ? 0 : 1
  topic_arn = aws_sns_topic.operations.arn
  protocol  = "email"
  endpoint  = var.notify_email
}

resource "aws_sns_topic" "environmental" {
  count = local.institutional ? 1 : 0
  name  = "${local.name}-environmental"
}

resource "aws_sns_topic_subscription" "environmental_email" {
  count     = local.institutional && var.environmental_email != null ? 1 : 0
  topic_arn = aws_sns_topic.environmental[0].arn
  protocol  = "email"
  endpoint  = var.environmental_email
}

resource "aws_sqs_queue_policy" "channels" {
  for_each  = local.channels
  queue_url = aws_sqs_queue.main["notify-${each.key}"].url
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow", Principal = { Service = "sns.amazonaws.com" }
      Action    = "sqs:SendMessage", Resource = aws_sqs_queue.main["notify-${each.key}"].arn
      Condition = { ArnEquals = { "aws:SourceArn" = aws_sns_topic.environmental[0].arn } }
    }]
  })
}

resource "aws_sns_topic_subscription" "channels" {
  for_each             = local.channels
  topic_arn            = aws_sns_topic.environmental[0].arn
  protocol             = "sqs"
  endpoint             = aws_sqs_queue.main["notify-${each.key}"].arn
  raw_message_delivery = true
  depends_on           = [aws_sqs_queue_policy.channels]
}

resource "aws_cloudwatch_metric_alarm" "dlq" {
  for_each            = aws_sqs_queue.dead
  alarm_name          = "${local.name}-dlq-${each.key}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  threshold           = 1
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  statistic           = "Maximum"
  period              = 60
  dimensions          = { QueueName = each.value.name }
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.operations.arn]
}

resource "aws_cloudwatch_metric_alarm" "age" {
  for_each            = aws_sqs_queue.main
  alarm_name          = "${local.name}-age-${each.key}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 1800
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateAgeOfOldestMessage"
  statistic           = "Maximum"
  period              = 300
  dimensions          = { QueueName = each.value.name }
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.operations.arn]
}

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each            = aws_lambda_function.jobs
  alarm_name          = "${local.name}-lambda-${each.key}-errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  threshold           = 1
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  statistic           = "Sum"
  period              = 300
  dimensions          = { FunctionName = each.value.function_name }
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.operations.arn]
}

locals {
  application_alarms = merge(
    !contains(local.lambda_names, "gis") ? {} : {
      probe      = { metric = "ProbeFailed", period = 300, periods = 3, threshold = 1, comparison = "GreaterThanOrEqualToThreshold", missing = var.schedule_enabled ? "breaching" : "notBreaching" }
      stale      = { metric = "PlannedWithoutManifest", period = 900, periods = 1, threshold = 1, comparison = "GreaterThanOrEqualToThreshold", missing = "notBreaching" }
      gis_failed = { metric = "GISFailed", period = 300, periods = 1, threshold = 1, comparison = "GreaterThanOrEqualToThreshold", missing = "notBreaching" }
    }
  )
}

resource "aws_cloudwatch_metric_alarm" "application" {
  for_each            = local.application_alarms
  alarm_name          = "${local.name}-app-${each.key}"
  comparison_operator = each.value.comparison
  evaluation_periods  = each.value.periods
  threshold           = each.value.threshold
  namespace           = local.name
  metric_name         = each.value.metric
  statistic           = "Maximum"
  period              = each.value.period
  treat_missing_data  = each.value.missing
  alarm_actions       = [aws_sns_topic.operations.arn]
}

locals {
  database_alarms = local.institutional ? {
    cpu     = { metric = "CPUUtilization", statistic = "Average", threshold = 80, comparison = "GreaterThanThreshold" }
    storage = { metric = "FreeStorageSpace", statistic = "Minimum", threshold = 5368709120, comparison = "LessThanThreshold" }
  } : {}
}

resource "aws_cloudwatch_metric_alarm" "db" {
  for_each            = local.database_alarms
  alarm_name          = "${local.name}-rds-${each.key}"
  comparison_operator = each.value.comparison
  evaluation_periods  = 2
  threshold           = each.value.threshold
  namespace           = "AWS/RDS"
  metric_name         = each.value.metric
  statistic           = each.value.statistic
  period              = 300
  dimensions          = { DBInstanceIdentifier = aws_db_instance.platform[0].identifier }
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.operations.arn]
}

resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  count               = local.institutional ? 1 : 0
  alarm_name          = "${local.name}-api-5xx-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 2
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.operations.arn]
  metric_query {
    id          = "rate"
    expression  = "IF(requests >= 20, 100 * FILL(errors,0) / requests, 0)"
    return_data = true
  }
  metric_query {
    id = "errors"
    metric {
      metric_name = "5xx"
      namespace   = "AWS/ApiGateway"
      period      = 600
      stat        = "Sum"
      dimensions  = { ApiId = aws_apigatewayv2_api.http[0].id }
    }
  }
  metric_query {
    id = "requests"
    metric {
      metric_name = "Count"
      namespace   = "AWS/ApiGateway"
      period      = 600
      stat        = "SampleCount"
      dimensions  = { ApiId = aws_apigatewayv2_api.http[0].id }
    }
  }
}

resource "aws_budgets_budget" "monthly" {
  count        = var.notify_email == null ? 0 : 1
  name         = local.name
  budget_type  = "COST"
  time_unit    = "MONTHLY"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"

  # Account-level backing data. Cost allocation tags must be activated separately.
  dynamic "notification" {
    for_each = toset([70, 90, 100])
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = [var.notify_email]
    }
  }
}
