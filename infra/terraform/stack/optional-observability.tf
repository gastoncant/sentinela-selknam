variable "enable_grafana" {
  type        = bool
  default     = false
  description = "Optional portfolio or institutional dashboards. Requires IAM Identity Center and user assignment."
}

variable "enable_prometheus" {
  type        = bool
  default     = false
  description = "Optional AMP workspace. A collector with scoped remote-write access is configured separately."
}

resource "aws_prometheus_workspace" "sentinela" {
  count = var.enable_prometheus ? 1 : 0
  alias = local.name
}

resource "aws_iam_role" "grafana" {
  count = var.enable_grafana ? 1 : 0
  name  = "${local.name}-grafana"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow", Action = "sts:AssumeRole"
      Principal = { Service = "grafana.amazonaws.com" }
      Condition = {
        StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id }
        ArnLike      = { "aws:SourceArn" = "arn:${data.aws_partition.current.partition}:grafana:${var.region}:${data.aws_caller_identity.current.account_id}:/workspaces/*" }
      }
    }]
  })
}

resource "aws_iam_role_policy" "grafana" {
  count = var.enable_grafana ? 1 : 0
  role  = aws_iam_role.grafana[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat([{
      Effect   = "Allow"
      Action   = ["cloudwatch:DescribeAlarms", "cloudwatch:GetMetricData", "cloudwatch:ListMetrics", "ec2:DescribeRegions"]
      Resource = "*"
      }], var.enable_prometheus ? [{
      Effect   = "Allow"
      Action   = ["aps:QueryMetrics", "aps:GetLabels", "aps:GetSeries", "aps:GetMetricMetadata"]
      Resource = aws_prometheus_workspace.sentinela[0].arn
    }] : [])
  })
}

resource "aws_grafana_workspace" "sentinela" {
  count                    = var.enable_grafana ? 1 : 0
  name                     = local.name
  account_access_type      = "CURRENT_ACCOUNT"
  authentication_providers = ["AWS_SSO"]
  permission_type          = "CUSTOMER_MANAGED"
  data_sources             = concat(["CLOUDWATCH"], var.enable_prometheus ? ["PROMETHEUS"] : [])
  role_arn                 = aws_iam_role.grafana[0].arn
  depends_on               = [aws_iam_role_policy.grafana]
}

output "grafana_endpoint" {
  value = try(aws_grafana_workspace.sentinela[0].endpoint, null)
}

output "prometheus_workspace_arn" {
  value = try(aws_prometheus_workspace.sentinela[0].arn, null)
}
