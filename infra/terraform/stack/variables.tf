variable "profile" {
  type    = string
  default = "static"
  validation {
    condition     = contains(["static", "portfolio", "supabase", "pilot", "redundant"], var.profile)
    error_message = "Choose static, portfolio, supabase, pilot or redundant."
  }
}

variable "environment" {
  type    = string
  default = "staging"
  validation {
    condition     = contains(["staging", "prod"], var.environment)
    error_message = "Choose staging or prod."
  }
}

variable "region" {
  type    = string
  default = "us-west-2"
}

variable "lambda_images" {
  type        = map(string)
  default     = {}
  description = "Digest-pinned Amazon ECR image URIs. Keys: planner, gis, probe, ingest and notify."
  validation {
    condition     = alltrue([for image in values(var.lambda_images) : can(regex("@sha256:[a-f0-9]{64}$", image))])
    error_message = "Pin each Lambda image by digest."
  }
}

variable "api_image" {
  type    = string
  default = null
  validation {
    condition     = var.api_image == null ? true : can(regex("@sha256:[a-f0-9]{64}$", var.api_image))
    error_message = "Pin the baseline ECS image by digest."
  }
}

variable "db_instance_class" {
  type        = string
  default     = "db.t4g.small"
  description = "Start with 2 GiB for IAM DB authentication and PostGIS. Resize after measurement."
}

variable "analysis_schedule" {
  type    = string
  default = "rate(1 day)"
}

variable "schedule_enabled" {
  type        = bool
  default     = false
  description = "Activate schedules only after staging smoke tests."
}

variable "notify_email" {
  type        = string
  default     = null
  description = "Optional destination for operational alarms; requires SNS confirmation."
}

variable "environmental_email" {
  type    = string
  default = null
}

variable "channel_secret_arns" {
  type        = map(string)
  default     = {}
  description = "Optional email/Slack/WhatsApp adapter credentials from Secrets Manager; values are ARNs."
  validation {
    condition     = alltrue([for channel in keys(var.channel_secret_arns) : contains(["email", "slack", "whatsapp"], channel)])
    error_message = "Supported channels are email, slack and whatsapp."
  }
}

variable "supabase_secret_arn" {
  type    = string
  default = null
}

variable "route53_zone_id" {
  type    = string
  default = null
}

variable "web_hostname" {
  type    = string
  default = null
}

variable "api_hostname" {
  type    = string
  default = null
}

variable "delivery" {
  type    = string
  default = "github"
  validation {
    condition     = contains(["github", "codepipeline"], var.delivery)
    error_message = "Choose github or codepipeline."
  }
}

variable "github_repository" {
  type    = string
  default = null
}

variable "github_branch" {
  type    = string
  default = "master"
}

variable "github_oidc_provider_arn" {
  type        = string
  default     = null
  description = "ARN of the account-wide GitHub OIDC provider; create or import it in the account bootstrap."
}

variable "codeconnection_arn" {
  type    = string
  default = null
}

variable "enable_canary" {
  type    = bool
  default = false
}

variable "monthly_budget_usd" {
  type    = number
  default = 45
  validation {
    condition     = var.monthly_budget_usd > 0
    error_message = "Set a positive budget in USD."
  }
}
