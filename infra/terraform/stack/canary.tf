resource "aws_iam_role" "codedeploy" {
  count = var.enable_canary ? 1 : 0
  name  = "${local.name}-codedeploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow", Action = "sts:AssumeRole", Principal = { Service = "codedeploy.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "codedeploy" {
  count      = var.enable_canary ? 1 : 0
  role       = aws_iam_role.codedeploy[0].name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/service-role/AWSCodeDeployRoleForLambda"
}

resource "aws_codedeploy_app" "gis" {
  count            = var.enable_canary ? 1 : 0
  name             = "${local.name}-gis"
  compute_platform = "Lambda"
}

resource "aws_codedeploy_deployment_group" "gis" {
  count                  = var.enable_canary ? 1 : 0
  app_name               = aws_codedeploy_app.gis[0].name
  deployment_group_name  = "live"
  service_role_arn       = aws_iam_role.codedeploy[0].arn
  deployment_config_name = "CodeDeployDefault.LambdaCanary10Percent5Minutes"

  deployment_style {
    deployment_option = "WITH_TRAFFIC_CONTROL"
    deployment_type   = "BLUE_GREEN"
  }
  alarm_configuration {
    enabled                   = true
    ignore_poll_alarm_failure = false
    alarms                    = [aws_cloudwatch_metric_alarm.lambda_errors["gis"].alarm_name, aws_cloudwatch_metric_alarm.application["gis_failed"].alarm_name]
  }
  auto_rollback_configuration {
    enabled = true
    events  = ["DEPLOYMENT_FAILURE", "DEPLOYMENT_STOP_ON_ALARM", "DEPLOYMENT_STOP_ON_REQUEST"]
  }
  depends_on = [aws_iam_role_policy_attachment.codedeploy]
}
