mock_provider "aws" {
  mock_data "aws_availability_zones" {
    defaults = { names = ["us-west-2a", "us-west-2b"] }
  }
  mock_data "aws_caller_identity" {
    defaults = { account_id = "111122223333" }
  }
  mock_data "aws_partition" {
    defaults = { partition = "aws", dns_suffix = "amazonaws.com" }
  }
}

mock_provider "aws" {
  alias = "edge"
}

variables {
  api_image = "111122223333.dkr.ecr.us-west-2.amazonaws.com/api@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  lambda_images = {
    planner = "111122223333.dkr.ecr.us-west-2.amazonaws.com/jobs@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    gis     = "111122223333.dkr.ecr.us-west-2.amazonaws.com/jobs@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    probe   = "111122223333.dkr.ecr.us-west-2.amazonaws.com/jobs@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
    ingest  = "111122223333.dkr.ecr.us-west-2.amazonaws.com/jobs@sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
    notify  = "111122223333.dkr.ecr.us-west-2.amazonaws.com/jobs@sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
  }
}

run "static_minimal" {
  command = plan

  assert {
    condition     = length(aws_vpc.platform) == 0 && length(aws_lambda_function.jobs) == 0 && length(aws_s3_bucket.storage) == 1
    error_message = "Static must not create compute, VPC or product storage."
  }
  assert {
    condition     = aws_s3_bucket_public_access_block.storage["web"].block_public_policy && aws_cloudfront_origin_access_control.web.signing_behavior == "always"
    error_message = "The public site must use CloudFront OAC and private S3."
  }
}

run "portfolio_canary_gis_without_database" {
  command = plan
  variables {
    profile       = "portfolio"
    enable_canary = true
  }

  assert {
    condition     = length(aws_db_instance.platform) == 0 && length(aws_lambda_function.jobs) == 3 && length(aws_codedeploy_deployment_group.gis) == 1
    error_message = "Portfolio must have GIS and opt-in canary without RDS."
  }
  assert {
    condition     = aws_sqs_queue.main["jobs"].visibility_timeout_seconds >= 6 * aws_lambda_function.jobs["gis"].timeout
    error_message = "GIS queue must leave time for Lambda retries."
  }
}

run "supabase_without_database" {
  command = plan
  variables {
    profile             = "supabase"
    supabase_secret_arn = "arn:aws:secretsmanager:us-west-2:111122223333:secret:sentinela-example"
  }

  assert {
    condition     = length(aws_db_instance.platform) == 0 && aws_lambda_function.jobs["gis"].environment[0].variables.PROCESSOR_MODE == "supabase"
    error_message = "The hybrid profile must select Supabase mode instead of creating RDS."
  }
}

run "institutional_private_ingest" {
  command = plan
  variables {
    profile = "pilot"
    channel_secret_arns = {
      slack = "arn:aws:secretsmanager:us-west-2:111122223333:secret:slack-example"
    }
  }
  assert {
    condition     = length(aws_vpc.platform) == 1 && length(aws_subnet.private) == 2 && aws_vpc_endpoint.s3[0].vpc_endpoint_type == "Gateway"
    error_message = "Ingest and RDS require private subnets and a gateway S3 endpoint."
  }
  assert {
    condition     = !aws_db_instance.platform[0].publicly_accessible && aws_db_instance.platform[0].iam_database_authentication_enabled && aws_db_instance.platform[0].backup_retention_period == 7
    error_message = "The database must stay private with IAM auth and PITR retention."
  }
  assert {
    condition     = aws_ecs_service.api[0].desired_count == 1 && aws_apigatewayv2_integration.api[0].connection_type == "VPC_LINK"
    error_message = "The pilot requires a single API task behind a VPC Link."
  }
  assert {
    condition     = aws_apigatewayv2_route.api["ANY /{proxy+}"].authorization_type == "JWT" && aws_apigatewayv2_route.api["GET /healthz"].authorization_type == "NONE"
    error_message = "Only the health route should bypass JWT."
  }
  assert {
    condition     = length(aws_sns_topic_subscription.channels) == 1 && length(aws_sqs_queue.dead) == 4
    error_message = "The Slack channel and the job, scheduler and ingest paths need their own dead-letter handling."
  }
}

run "redundant_production" {
  command = plan
  variables {
    profile     = "redundant"
    environment = "prod"
  }
  assert {
    condition     = aws_db_instance.platform[0].multi_az && aws_db_instance.platform[0].deletion_protection && aws_ecs_service.api[0].desired_count == 2
    error_message = "Redundant production must have Multi-AZ RDS and two API replicas."
  }
}

run "optional_codepipeline" {
  command = plan
  variables {
    delivery           = "codepipeline"
    github_repository  = "gastoncant/sentinela-selknam"
    codeconnection_arn = "arn:aws:codeconnections:us-west-2:111122223333:connection/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    environment        = "prod"
  }
  assert {
    condition     = length(aws_codepipeline.web) == 1 && length(aws_codebuild_project.web) == 2 && length(aws_iam_role.github_web) == 0
    error_message = "The native pipeline and GitHub publication roles must be mutually exclusive."
  }
}

run "github_oidc" {
  command = plan
  variables {
    github_repository        = "gastoncant/sentinela-selknam"
    github_oidc_provider_arn = "arn:aws:iam::111122223333:oidc-provider/token.actions.githubusercontent.com"
  }
  assert {
    condition     = length(aws_iam_role.github_web) == 1 && length(aws_codepipeline.web) == 0
    error_message = "GitHub is the only publisher in the OIDC profile."
  }
}

run "optional_dashboards" {
  command = plan
  variables {
    enable_grafana    = true
    enable_prometheus = true
  }
  assert {
    condition     = length(aws_grafana_workspace.sentinela) == 1 && length(aws_prometheus_workspace.sentinela) == 1
    error_message = "Opt-in observability should create both workspaces."
  }
}

run "route53_custom_domains" {
  command = plan
  variables {
    profile         = "pilot"
    route53_zone_id = "Z0123456789EXAMPLE"
    web_hostname    = "sentinela.example.org"
    api_hostname    = "api.sentinela.example.org"
  }
  assert {
    condition     = length(aws_route53_record.web) == 2 && length(aws_apigatewayv2_api_mapping.api) == 1 && aws_apigatewayv2_api.http[0].disable_execute_api_endpoint
    error_message = "Custom domains should configure IPv4/IPv6 for CloudFront and use only the custom API endpoint."
  }
}

run "institutional_missing_images_rejected" {
  command = plan
  variables {
    profile       = "pilot"
    api_image     = null
    lambda_images = {}
  }
  expect_failures = [terraform_data.profile_contract]
}
