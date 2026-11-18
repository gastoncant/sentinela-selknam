locals {
  buckets = toset(concat(["web"], length(local.lambda_names) == 0 ? [] : ["products"], var.delivery == "codepipeline" ? ["artifacts"] : []))
}

resource "aws_s3_bucket" "storage" {
  for_each = local.buckets
  bucket   = "${local.name}-${data.aws_caller_identity.current.account_id}-${var.region}-${each.key}"
}

resource "aws_s3_bucket_public_access_block" "storage" {
  for_each                = aws_s3_bucket.storage
  bucket                  = each.value.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "storage" {
  for_each = aws_s3_bucket.storage
  bucket   = each.value.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "storage" {
  for_each = aws_s3_bucket.storage
  bucket   = each.value.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "storage" {
  for_each = aws_s3_bucket.storage
  bucket   = each.value.id

  rule {
    id     = "cleanup"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
    noncurrent_version_expiration {
      noncurrent_days = each.key == "products" ? 90 : 30
    }
  }

  depends_on = [aws_s3_bucket_versioning.storage]
}

resource "aws_s3_bucket_policy" "storage" {
  for_each = aws_s3_bucket.storage
  bucket   = each.value.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat([{
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [each.value.arn, "${each.value.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
      }], each.key == "web" ? [{
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${each.value.arn}/*"
      Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.web.arn } }
    }] : [])
  })

  depends_on = [aws_s3_bucket_public_access_block.storage]
}
