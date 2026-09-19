# Who can do what. Each role gets only what its job needs.
#
# Not managed here on purpose: the human IAM user and the near-root DO-NOT-ASSIGN policy. Those
# are the bootstrap that runs Terraform, so they should not be something Terraform can change.

locals {
  account_id = "864145505327"
}

# The backend server's identity: reads its secrets, uses its own bucket, sends mail, manages
# sign-in accounts. Nothing else.
resource "aws_iam_role" "ec2" {
  name        = "mostatelax-prod-ec2-role"
  description = "EC2 instance role for the Missouri State Lacrosse backend (prod)"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_instance_profile" "ec2" {
  name = aws_iam_role.ec2.name
  role = aws_iam_role.ec2.name
}

resource "aws_iam_role_policy" "ec2_backend" {
  name = "backend-permissions"
  role = aws_iam_role.ec2.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ImagesBucket"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.images.arn}/*"
      },
      {
        Sid    = "AppSecrets"
        Effect = "Allow"
        Action = "secretsmanager:GetSecretValue"
        Resource = [
          "arn:aws:secretsmanager:us-east-1:${local.account_id}:secret:mostatelax/prod/backend-*",
          "arn:aws:secretsmanager:us-east-1:${local.account_id}:secret:mostatelax/prod/firebase-service-account-*",
        ]
      },
      {
        Sid      = "TransactionalEmail"
        Effect   = "Allow"
        Action   = ["ses:SendEmail", "ses:SendRawEmail"]
        Resource = aws_sesv2_email_identity.domain.arn
      },
      {
        Sid    = "CognitoUserPool"
        Effect = "Allow"
        Action = [
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminSetUserPassword",
          "cognito-idp:AdminUpdateUserAttributes",
        ]
        Resource = aws_cognito_user_pool.main.arn
      },
    ]
  })
}

resource "aws_iam_role_policy" "ec2_db_backups" {
  name = "db-backups"
  role = aws_iam_role.ec2.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "DbBackupsBucket"
      Effect   = "Allow"
      Action   = ["s3:PutObject", "s3:ListBucket"]
      Resource = [aws_s3_bucket.backups.arn, "${aws_s3_bucket.backups.arn}/*"]
    }]
  })
}

# Lets the snapshot service take EBS snapshots.
resource "aws_iam_role" "dlm" {
  name        = "mostatelax-prod-dlm-role"
  description = "DLM service role for EBS snapshot lifecycle (mostatelax prod)"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "dlm.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "dlm" {
  role       = aws_iam_role.dlm.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSDataLifecycleManagerServiceRole"
}

# GitHub Actions deploys the website without any stored keys: GitHub proves who it is to AWS with
# OIDC, and this role can only write the one site bucket and clear the one CDN cache, and only when
# the workflow runs from the main branch.
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

resource "aws_iam_role" "github_web_deploy" {
  name        = "mostatelax-github-web-deploy"
  description = "GitHub Actions deploys the website (main branch only)"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRoleWithWebIdentity"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = "repo:camdenslade/missouristatelacrosse:ref:refs/heads/main"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_web_deploy" {
  name = "deploy-website"
  role = aws_iam_role.github_web_deploy.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "WriteSiteBucket"
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.web.arn}/*"
      },
      {
        Sid      = "ListSiteBucket"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.web.arn
      },
      {
        Sid      = "InvalidateCdn"
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation"]
        Resource = aws_cloudfront_distribution.site.arn
      },
    ]
  })
}

# Backend deploys without SSH. GitHub uploads the built jar to a folder in the backup bucket, then
# tells the server to fetch and install it through AWS Systems Manager. The server itself only
# needs to read that one folder and be manageable by Systems Manager.
resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "ec2_deploy_artifacts" {
  name = "read-deploy-artifacts"
  role = aws_iam_role.ec2.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "ReadBackendJars"
      Effect   = "Allow"
      Action   = ["s3:GetObject"]
      Resource = "${aws_s3_bucket.backups.arn}/deploy/backend/*"
    }]
  })
}

# Trusted only from the main branch of this repository, like the website deploy role.
resource "aws_iam_role" "github_backend_deploy" {
  name        = "mostatelax-github-backend-deploy"
  description = "GitHub Actions deploys the backend through Systems Manager (main branch only)"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRoleWithWebIdentity"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = "repo:camdenslade/missouristatelacrosse:ref:refs/heads/main"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_backend_deploy" {
  name = "deploy-backend"
  role = aws_iam_role.github_backend_deploy.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "UploadJar"
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = "${aws_s3_bucket.backups.arn}/deploy/backend/*"
      },
      {
        Sid      = "RunOneCommandOnTheBackend"
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
