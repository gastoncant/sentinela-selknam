resource "aws_acm_certificate" "api" {
  count             = var.api_hostname == null ? 0 : 1
  domain_name       = var.api_hostname
  validation_method = "DNS"
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "api_validation" {
  count   = var.api_hostname == null ? 0 : 1
  zone_id = var.route53_zone_id
  name    = one(aws_acm_certificate.api[0].domain_validation_options).resource_record_name
  type    = one(aws_acm_certificate.api[0].domain_validation_options).resource_record_type
  records = [one(aws_acm_certificate.api[0].domain_validation_options).resource_record_value]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "api" {
  count                   = var.api_hostname == null ? 0 : 1
  certificate_arn         = aws_acm_certificate.api[0].arn
  validation_record_fqdns = [aws_route53_record.api_validation[0].fqdn]
}

resource "aws_apigatewayv2_domain_name" "api" {
  count       = var.api_hostname == null ? 0 : 1
  domain_name = var.api_hostname
  domain_name_configuration {
    certificate_arn = aws_acm_certificate_validation.api[0].certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}

resource "aws_apigatewayv2_api_mapping" "api" {
  count       = var.api_hostname == null ? 0 : 1
  api_id      = aws_apigatewayv2_api.http[0].id
  domain_name = aws_apigatewayv2_domain_name.api[0].id
  stage       = aws_apigatewayv2_stage.api[0].id
}

resource "aws_route53_record" "api" {
  count   = var.api_hostname == null ? 0 : 1
  zone_id = var.route53_zone_id
  name    = var.api_hostname
  type    = "A"
  alias {
    name                   = aws_apigatewayv2_domain_name.api[0].domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api[0].domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}

locals {
  api_url = local.institutional ? (var.api_hostname == null ? aws_apigatewayv2_api.http[0].api_endpoint : "https://${var.api_hostname}") : null
}
