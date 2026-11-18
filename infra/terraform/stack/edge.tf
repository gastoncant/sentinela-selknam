resource "aws_acm_certificate" "web" {
  count             = var.web_hostname == null ? 0 : 1
  provider          = aws.edge
  domain_name       = var.web_hostname
  validation_method = "DNS"
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "web_validation" {
  count   = var.web_hostname == null ? 0 : 1
  zone_id = var.route53_zone_id
  name    = one(aws_acm_certificate.web[0].domain_validation_options).resource_record_name
  type    = one(aws_acm_certificate.web[0].domain_validation_options).resource_record_type
  records = [one(aws_acm_certificate.web[0].domain_validation_options).resource_record_value]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "web" {
  count                   = var.web_hostname == null ? 0 : 1
  provider                = aws.edge
  certificate_arn         = aws_acm_certificate.web[0].arn
  validation_record_fqdns = [aws_route53_record.web_validation[0].fqdn]
}

resource "aws_cloudfront_origin_access_control" "web" {
  name                              = local.name
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_cloudfront_cache_policy" "static" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "entry" {
  name = "Managed-CachingDisabled"
}

resource "aws_cloudfront_distribution" "web" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  aliases             = var.web_hostname == null ? [] : [var.web_hostname]

  origin {
    domain_name              = aws_s3_bucket.storage["web"].bucket_regional_domain_name
    origin_id                = "web"
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  default_cache_behavior {
    target_origin_id       = "web"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    viewer_protocol_policy = "redirect-to-https"
    cache_policy_id        = data.aws_cloudfront_cache_policy.entry.id
    compress               = true
  }

  ordered_cache_behavior {
    path_pattern           = "/assets/*"
    target_origin_id       = "web"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    viewer_protocol_policy = "redirect-to-https"
    cache_policy_id        = data.aws_cloudfront_cache_policy.static.id
    compress               = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = var.web_hostname == null
    acm_certificate_arn            = var.web_hostname == null ? null : aws_acm_certificate_validation.web[0].certificate_arn
    ssl_support_method             = var.web_hostname == null ? null : "sni-only"
    minimum_protocol_version       = var.web_hostname == null ? "TLSv1" : "TLSv1.2_2021"
  }
}

resource "aws_route53_record" "web" {
  for_each = var.web_hostname == null ? toset([]) : toset(["A", "AAAA"])
  zone_id  = var.route53_zone_id
  name     = var.web_hostname
  type     = each.key

  alias {
    name                   = aws_cloudfront_distribution.web.domain_name
    zone_id                = aws_cloudfront_distribution.web.hosted_zone_id
    evaluate_target_health = false
  }
}

locals {
  web_url = "https://${coalesce(var.web_hostname, aws_cloudfront_distribution.web.domain_name)}"
}
