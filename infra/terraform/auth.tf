# Sign-in. Cognito holds the passwords; our database holds who each person is and what they may do.
#
# Invite-only: accounts are created by the backend when someone is onboarded, never by self
# sign-up. People who signed up under the old Firebase login are migrated the first time they sign
# in, by the Lambda below, which checks their password against Firebase once.

variable "firebase_web_api_key" {
  description = "Public web API key of the old Firebase project (the same value already ships in the old site bundle). Used only by the sign-in migration Lambda."
  type        = string
  default     = "AIzaSyC2tVXrGNBz_CPN5wxmRW5-mEDJ_h9UtWU"
}

resource "aws_cognito_user_pool" "main" {
  name                     = "mostatelax-prod-users"
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

  # Reset codes come from no-reply@ through SES, in the site's branding.
  email_configuration {
    email_sending_account  = "DEVELOPER"
    source_arn             = aws_sesv2_email_identity.domain.arn
    from_email_address     = "Missouri State Lacrosse <no-reply@missouristatelacrosse.com>"
    reply_to_email_address = "support@missouristatelacrosse.com"
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "Your Missouri State Lacrosse password reset code"
    email_message        = file("${path.module}/templates/reset-code-email.html")
  }

  lambda_config {
    user_migration = aws_lambda_function.cognito_migrate.arn
  }
}

# The website's app client. It is public (created without a secret, since a browser cannot keep
# one). Do not add generate_secret here: changing it forces a new client with a new id, which would
# sign everyone out and break the site until it is redeployed.
resource "aws_cognito_user_pool_client" "web" {
  name         = "mostatelax-web"
  user_pool_id = aws_cognito_user_pool.main.id

  # The plain password flow is required for the migration Lambda to run.
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

# Runs the first time a not-yet-migrated person signs in. Remove it (and the lambda_config above)
# once everyone has signed in through Cognito.
data "archive_file" "cognito_migrate" {
  type        = "zip"
  source_file = "${path.module}/../cognito-migrate/index.js"
  output_path = "${path.module}/build/cognito-migrate.zip"
}

resource "aws_iam_role" "cognito_migrate" {
  name = "mostatelax-cognito-migrate"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "cognito_migrate_logs" {
  role       = aws_iam_role.cognito_migrate.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "cognito_migrate" {
  function_name    = "mostatelax-cognito-migrate"
  role             = aws_iam_role.cognito_migrate.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  timeout          = 10
  memory_size      = 128
  filename         = data.archive_file.cognito_migrate.output_path
  source_code_hash = data.archive_file.cognito_migrate.output_base64sha256

  environment {
    variables = {
      FIREBASE_WEB_API_KEY = var.firebase_web_api_key
    }
  }
}

resource "aws_lambda_permission" "cognito_migrate" {
  statement_id  = "cognito-invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cognito_migrate.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}
