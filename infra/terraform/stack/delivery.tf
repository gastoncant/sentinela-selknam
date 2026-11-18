locals {
  web_publish_permissions = [
    { Effect = "Allow", Action = ["s3:ListBucket", "s3:GetBucketLocation"], Resource = aws_s3_bucket.storage["web"].arn },
    { Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject"], Resource = "${aws_s3_bucket.storage["web"].arn}/*" },
    { Effect = "Allow", Action = ["cloudfront:CreateInvalidation"], Resource = aws_cloudfront_distribution.web.arn }
  ]
}

resource "aws_iam_role" "github_web" {
  count = local.releases ? 1 : 0
  name  = "${local.name}-github-web"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRoleWithWebIdentity"
      Principal = { Federated = var.github_oidc_provider_arn }
      Condition = { StringEquals = {
        "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:environment:${var.environment}"
      } }
    }]
  })
}

resource "aws_iam_role_policy" "github_web" {
  count = local.releases ? 1 : 0
  role  = aws_iam_role.github_web[0].id
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = local.web_publish_permissions
  })
}

locals {
  use_codepipeline = var.delivery == "codepipeline"
  build_projects   = local.use_codepipeline ? toset(["build", "release"]) : toset([])
  artifact_permissions = local.use_codepipeline ? [
    { Effect = "Allow", Action = ["s3:GetBucketVersioning", "s3:GetBucketLocation", "s3:ListBucket"], Resource = aws_s3_bucket.storage["artifacts"].arn },
    { Effect = "Allow", Action = ["s3:GetObject", "s3:GetObjectVersion", "s3:PutObject"], Resource = "${aws_s3_bucket.storage["artifacts"].arn}/*" }
  ] : []
}

resource "aws_iam_role" "codebuild" {
  for_each = local.build_projects
  name     = "${local.name}-cb-${each.key}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "codebuild.amazonaws.com" }
      Condition = { StringEquals = {
        "aws:SourceAccount" = data.aws_caller_identity.current.account_id
        "aws:SourceArn"     = "arn:${data.aws_partition.current.partition}:codebuild:${var.region}:${data.aws_caller_identity.current.account_id}:project/${local.name}-${each.key}"
      } }
    }]
  })
}

resource "aws_cloudwatch_log_group" "codebuild" {
  for_each          = local.build_projects
  name              = "/aws/codebuild/${local.name}-${each.key}"
  retention_in_days = local.log_days
}

resource "aws_iam_role_policy" "codebuild" {
  for_each = local.build_projects
  role     = aws_iam_role.codebuild[each.key].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(local.artifact_permissions, [{
      Effect   = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "${aws_cloudwatch_log_group.codebuild[each.key].arn}:*"
    }], each.key == "release" ? local.web_publish_permissions : [])
  })
}

resource "aws_codebuild_project" "web" {
  for_each       = local.build_projects
  name           = "${local.name}-${each.key}"
  service_role   = aws_iam_role.codebuild[each.key].arn
  build_timeout  = 20
  queued_timeout = 30

  artifacts {
    type = "CODEPIPELINE"
  }
  environment {
    compute_type = "BUILD_GENERAL1_SMALL"
    image        = "aws/codebuild/standard:7.0"
    type         = "LINUX_CONTAINER"

    dynamic "environment_variable" {
      for_each = each.key == "release" ? {
        WEB_BUCKET      = aws_s3_bucket.storage["web"].id
        DISTRIBUTION_ID = aws_cloudfront_distribution.web.id
      } : {}
      content {
        name  = environment_variable.key
        value = environment_variable.value
      }
    }
  }
  source {
    type      = "CODEPIPELINE"
    buildspec = file("${path.module}/buildspec-${each.key}.yml")
  }
  logs_config {
    cloudwatch_logs {
      group_name = aws_cloudwatch_log_group.codebuild[each.key].name
    }
  }
  depends_on = [aws_iam_role_policy.codebuild]
}

resource "aws_iam_role" "codepipeline" {
  count = local.use_codepipeline ? 1 : 0
  name  = "${local.name}-codepipeline"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow", Action = "sts:AssumeRole", Principal = { Service = "codepipeline.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "codepipeline" {
  count = local.use_codepipeline ? 1 : 0
  role  = aws_iam_role.codepipeline[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(local.artifact_permissions, [
      { Effect = "Allow", Action = ["codeconnections:UseConnection", "codestar-connections:UseConnection"], Resource = var.codeconnection_arn },
      { Effect = "Allow", Action = ["codebuild:StartBuild", "codebuild:BatchGetBuilds"], Resource = [for project in aws_codebuild_project.web : project.arn] }
    ])
  })
}

resource "aws_codepipeline" "web" {
  count          = local.use_codepipeline ? 1 : 0
  name           = "${local.name}-web"
  role_arn       = aws_iam_role.codepipeline[0].arn
  pipeline_type  = "V2"
  execution_mode = "QUEUED"
  artifact_store {
    location = aws_s3_bucket.storage["artifacts"].id
    type     = "S3"
  }
  stage {
    name = "Source"
    action {
      name             = "GitHub"
      category         = "Source"
      owner            = "AWS"
      provider         = "CodeStarSourceConnection"
      version          = "1"
      output_artifacts = ["source"]
      configuration = {
        ConnectionArn    = var.codeconnection_arn
        FullRepositoryId = var.github_repository
        BranchName       = var.github_branch
        DetectChanges    = "true"
      }
    }
  }
  stage {
    name = "Build"
    action {
      name             = "TestAndBuild"
      category         = "Build"
      owner            = "AWS"
      provider         = "CodeBuild"
      version          = "1"
      input_artifacts  = ["source"]
      output_artifacts = ["web"]
      configuration    = { ProjectName = aws_codebuild_project.web["build"].name }
    }
  }
  dynamic "stage" {
    for_each = var.environment == "prod" ? [1] : []
    content {
      name = "Approve"
      action {
        name     = "ApproveRelease"
        category = "Approval"
        owner    = "AWS"
        provider = "Manual"
        version  = "1"
      }
    }
  }
  stage {
    name = "Release"
    action {
      name            = "PublishWeb"
      category        = "Build"
      owner           = "AWS"
      provider        = "CodeBuild"
      version         = "1"
      input_artifacts = ["web"]
      configuration   = { ProjectName = aws_codebuild_project.web["release"].name }
    }
  }
  depends_on = [aws_iam_role_policy.codepipeline]
}
