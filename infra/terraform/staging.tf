# A rehearsal copy of the site for testing changes before they reach the real one.
#
# What it is: a second website (staging.missouristatelacrosse.com) and a second backend
# (api-staging.missouristatelacrosse.com) with its own database, sign-in system, image bucket and
# secrets. The database is a copy of production with personal details scrubbed (see
# infra/staging/scrub.sql), email sending is switched off, and payments use sandbox keys.
#
# What it is not: a separate server. To stay inside the budget the staging backend runs on the same
# server as production, with hard memory and CPU limits so it cannot crowd production out. That means
# it tests code and data changes, not server changes (Terraform's plan covers those).
#
# Only people with the shared staging password can open the site, and search engines are told to
# ignore it.

variable "staging_domain" {
  description = "Address of the staging website."
  type        = string
  default     = "staging.missouristatelacrosse.com"
}

variable "staging_api_domain" {
  description = "Address of the staging backend."
  type        = string
  default     = "api-staging.missouristatelacrosse.com"
}

# The staging site sits behind one shared password. It is generated here and read with
# `terraform output -raw staging_site_password`.
resource "random_password" "staging_site" {
  length  = 24
  special = false
}

# Website files, private like production.
resource "aws_s3_bucket" "staging_web" {
  bucket = "mostatelax-staging-web"
}

resource "aws_s3_bucket_public_access_block" "staging_web" {
  bucket                  = aws_s3_bucket.staging_web.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "staging_web" {
  bucket = aws_s3_bucket.staging_web.id

  rule {
    blocked_encryption_types = ["SSE-C"]

    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_policy" "staging_web" {
  bucket = aws_s3_bucket.staging_web.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "CloudFrontRead"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.staging_web.arn}/*"
      Condition = {
        StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.staging.arn }
      }
    }]
  })
}

# Staging's own copy of the images, so testing an upload or a delete can never touch production's.
resource "aws_s3_bucket" "staging_images" {
  bucket = "mostatelax-staging-images"
}

resource "aws_s3_bucket_public_access_block" "staging_images" {
  bucket                  = aws_s3_bucket.staging_images.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "staging_images" {
  bucket = aws_s3_bucket.staging_images.id

  rule {
    blocked_encryption_types = ["SSE-C"]

    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_acm_certificate" "staging" {
  domain_name       = var.staging_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# Asks for the shared password, then behaves like the production site function (every page URL
# serves the single-page app).
resource "aws_cloudfront_function" "staging" {
  name    = "mostatelax-staging-site"
  runtime = "cloudfront-js-2.0"
  comment = "Staging: shared password and SPA fallback"
  publish = true

  code = <<-EOT
    function handler(event) {
      var request = event.request;
      var expected = 'Basic ${base64encode("staging:${random_password.staging_site.result}")}';
      var given = request.headers.authorization ? request.headers.authorization.value : '';
      if (given !== expected) {
        return {
          statusCode: 401,
          statusDescription: 'Unauthorized',
          headers: { 'www-authenticate': { value: 'Basic realm="Missouri State Lacrosse staging"' } }
        };
      }
      var last = request.uri.substring(request.uri.lastIndexOf('/') + 1);
      if (last.indexOf('.') === -1) {
        request.uri = '/index.html';
      }
      return request;
    }
  EOT
}

resource "aws_cloudfront_distribution" "staging" {
  comment             = "Missouri State Lacrosse staging site"
  enabled             = true
  is_ipv6_enabled     = true
  http_version        = "http2and3"
  price_class         = "PriceClass_100"
  default_root_object = "index.html"
  aliases             = [var.staging_domain]

  origin {
    origin_id                = "s3-staging"
    domain_name              = aws_s3_bucket.staging_web.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  # One behavior for everything: nothing is cached (traffic is tiny) and every response tells
  # search engines to stay away.
  default_cache_behavior {
    target_origin_id           = "s3-staging"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.disabled.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_noindex.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.staging.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.staging.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

# Staging's own sign-in system, so test accounts and passwords never mix with real ones. Same rules
# as production, minus the Firebase migration, and Cognito's built-in email so no real mail is sent.
resource "aws_cognito_user_pool" "staging" {
  name                     = "mostatelax-staging-users"
  mfa_configuration        = "OFF"
  deletion_protection      = "ACTIVE"
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  username_configuration {
    case_sensitive = false
  }

  password_policy {
    minimum_length                   = 8
    require_lowercase                = false
    require_uppercase                = false
    require_numbers                  = false
    require_symbols                  = false
    temporary_password_validity_days = 7
  }

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }
}

resource "aws_cognito_user_pool_client" "staging_web" {
  name         = "mostatelax-staging-web"
  user_pool_id = aws_cognito_user_pool.staging.id

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

# Secret containers only. Values are set by hand and never appear in Terraform or git.
resource "aws_secretsmanager_secret" "staging_backend" {
  name        = "mostatelax/staging/backend"
  description = "Staging backend settings: its own database login, sandbox payment keys, staging image bucket"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_secretsmanager_secret" "staging_test_admin" {
  name        = "mostatelax/staging/test-admin"
  description = "Login for the staging test admin account"

  lifecycle {
    prevent_destroy = true
  }
}

# What the shared server may do on staging's behalf. Staging's database and secrets are separate,
# but the server's identity is the same, so this list is deliberately short.
resource "aws_iam_role_policy" "ec2_staging" {
  name = "staging-access"
  role = aws_iam_role.ec2.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "StagingImages"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.staging_images.arn}/*"
      },
      {
        Sid      = "StagingSecret"
        Effect   = "Allow"
        Action   = "secretsmanager:GetSecretValue"
        Resource = "arn:aws:secretsmanager:us-east-1:${local.account_id}:secret:mostatelax/staging/backend-*"
      },
      {
        Sid    = "StagingSignIn"
        Effect = "Allow"
        Action = [
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminSetUserPassword",
          "cognito-idp:AdminUpdateUserAttributes",
        ]
        Resource = aws_cognito_user_pool.staging.arn
      },
      {
        Sid      = "StagingJars"
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${aws_s3_bucket.backups.arn}/deploy/backend-staging/*"
      },
    ]
  })
}

# GitHub deploys staging from the main branch or a branch called "staging", with the same keyless
# login as production. Keep "staging" protected in GitHub: a push there can run code on the shared
# server.
locals {
  staging_deploy_subjects = [
    "repo:camdenslade/missouristatelacrosse:ref:refs/heads/main",
    "repo:camdenslade/missouristatelacrosse:ref:refs/heads/staging",
  ]
}

resource "aws_iam_role" "github_staging_web_deploy" {
  name        = "mostatelax-github-staging-web-deploy"
  description = "GitHub Actions deploys the staging website (main or staging branch)"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRoleWithWebIdentity"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = local.staging_deploy_subjects
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_staging_web_deploy" {
  name = "deploy-staging-website"
  role = aws_iam_role.github_staging_web_deploy.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "WriteStagingBucket"
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.staging_web.arn}/*"
      },
      {
        Sid      = "ListStagingBucket"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.staging_web.arn
      },
      {
        Sid      = "InvalidateStagingCdn"
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation"]
        Resource = aws_cloudfront_distribution.staging.arn
      },
    ]
  })
}

resource "aws_iam_role" "github_staging_backend_deploy" {
  name        = "mostatelax-github-staging-backend-deploy"
  description = "GitHub Actions deploys the staging backend (main or staging branch)"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRoleWithWebIdentity"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = local.staging_deploy_subjects
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_staging_backend_deploy" {
  name = "deploy-staging-backend"
  role = aws_iam_role.github_staging_backend_deploy.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "UploadStagingJar"
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = "${aws_s3_bucket.backups.arn}/deploy/backend-staging/*"
      },
      {
        Sid      = "RunOneCommandOnTheServer"
        Effect   = "Allow"
        Action   = ["ssm:SendCommand"]
        Resource = [aws_instance.backend.arn, "arn:aws:ssm:us-east-1::document/AWS-RunShellScript"]
      },
      {
        Sid      = "ReadCommandResult"
        Effect   = "Allow"
        Action   = ["ssm:GetCommandInvocation", "ssm:ListCommandInvocations"]
        Resource = "*"
      },
    ]
  })
}

output "staging_cloudfront_domain" {
  description = "Point the staging CNAME in Cloudflare at this."
  value       = aws_cloudfront_distribution.staging.domain_name
}

output "staging_distribution_id" {
  value = aws_cloudfront_distribution.staging.id
}

output "staging_cognito_user_pool_id" {
  value = aws_cognito_user_pool.staging.id
}

output "staging_cognito_web_client_id" {
  value = aws_cognito_user_pool_client.staging_web.id
}

output "staging_certificate_validation_records" {
  description = "DNS records to create in Cloudflare so AWS can issue the staging certificate."
  value = {
    for o in aws_acm_certificate.staging.domain_validation_options : o.domain_name => {
      name  = o.resource_record_name
      type  = o.resource_record_type
      value = o.resource_record_value
    }
  }
}

output "staging_site_password" {
  description = "Shared password for the staging site (user name: staging)."
  value       = random_password.staging_site.result
  sensitive   = true
}
