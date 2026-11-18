terraform {
  required_version = ">= 1.11, < 2.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = local.tags
  }
}

provider "aws" {
  alias  = "edge"
  region = "us-east-1"
  default_tags {
    tags = local.tags
  }
}

data "aws_partition" "current" {}
data "aws_caller_identity" "current" {}

locals {
  name          = "sentinela-${var.environment}"
  tags          = { Project = "sentinela-selknam", Environment = var.environment }
  institutional = contains(["pilot", "redundant"], var.profile)
  redundant     = var.profile == "redundant"
  supabase      = var.profile == "supabase"
  releases      = var.github_oidc_provider_arn != null && var.delivery == "github"
  channels      = local.institutional ? var.channel_secret_arns : {}
  log_days      = var.environment == "prod" ? 30 : 14
  lambda_names = toset(concat(
    var.profile == "static" ? [] : ["planner", "gis", "probe"],
    local.institutional ? ["ingest"] : [],
    [for channel in keys(local.channels) : "notify-${channel}"]
  ))
  scheduled_functions = {
    for name in ["planner", "probe"] : name => (
      name == "planner" ? var.analysis_schedule : "rate(5 minutes)"
    ) if contains(local.lambda_names, name)
  }
}

resource "terraform_data" "profile_contract" {
  lifecycle {
    precondition {
      condition     = alltrue([for name in local.lambda_names : contains(keys(var.lambda_images), startswith(name, "notify-") ? "notify" : name)])
      error_message = "Provide one digest-pinned container image per enabled function type in lambda_images."
    }
    precondition {
      condition     = !local.institutional || var.api_image != null
      error_message = "The pilot and redundant profiles require a digest-pinned API container image."
    }
    precondition {
      condition     = !local.supabase || var.supabase_secret_arn != null
      error_message = "The Supabase profile requires a secret ARN for the server-side integration."
    }
    precondition {
      condition     = !var.enable_canary || contains(local.lambda_names, "gis")
      error_message = "The Lambda deployment group requires a GIS profile."
    }
    precondition {
      condition     = var.delivery != "codepipeline" || (var.codeconnection_arn != null && var.github_repository != null)
      error_message = "CodePipeline requires an authorized CodeConnections ARN and GitHub repository."
    }
    precondition {
      condition     = !local.releases || var.github_repository != null
      error_message = "GitHub federation requires the exact owner/repository."
    }
    precondition {
      condition     = (var.web_hostname == null || var.route53_zone_id != null) && (var.api_hostname == null || (local.institutional && var.route53_zone_id != null))
      error_message = "Managed custom domains require an existing Route 53 zone; api_hostname also requires an institutional profile."
    }
  }
}
