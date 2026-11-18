output "web_url" {
  value = local.web_url
}

output "web_bucket" {
  value = aws_s3_bucket.storage["web"].id
}

output "distribution_id" {
  value = aws_cloudfront_distribution.web.id
}

output "api_url" {
  value = local.api_url
}

output "cognito" {
  value = local.institutional ? {
    issuer    = local.cognito_issuer
    client_id = aws_cognito_user_pool_client.operators[0].id
    domain    = aws_cognito_user_pool_domain.operators[0].domain
  } : null
}


output "jobs_queue_url" {
  value = try(aws_sqs_queue.main["jobs"].url, null)
}

output "gis_live_alias" {
  value = try(aws_lambda_alias.gis[0].arn, null)
}

output "web_release_role_arn" {
  value = try(aws_iam_role.github_web[0].arn, null)
}
