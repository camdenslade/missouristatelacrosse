# Uptime alerting and the cost guardrail.
#
# Every 5 minutes a small Lambda calls the backend's health endpoint and records 1 (up) or 0
# (down) as a CloudWatch metric. If it is not up for 3 checks in a row (or stops reporting), the
# alarm emails admin@. It only watches the API; the website itself is served by CloudFront.

variable "alert_email" {
  description = "Where uptime and budget alerts are sent."
  type        = string
  default     = "admin@missouristatelacrosse.com"
}

resource "aws_sns_topic" "alerts" {
  name = "mostatelax-prod-alerts"
}

resource "aws_sns_topic_subscription" "alerts_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

data "archive_file" "healthcheck" {
  type        = "zip"
  source_file = "${path.module}/lambda/healthcheck/index.py"
  output_path = "${path.module}/build/healthcheck.zip"
}

resource "aws_iam_role" "healthcheck" {
  name        = "mostatelax-prod-healthcheck-lambda-role"
  description = "Execution role for the uptime health-check Lambda (mostatelax prod)"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "healthcheck_logs" {
  role       = aws_iam_role.healthcheck.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "healthcheck_put_metric" {
  name = "put-metric"
  role = aws_iam_role.healthcheck.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "cloudwatch:PutMetricData"
      Resource = "*"
    }]
  })
}

resource "aws_lambda_function" "healthcheck" {
  function_name    = "mostatelax-prod-healthcheck"
  role             = aws_iam_role.healthcheck.arn
  runtime          = "python3.12"
  handler          = "index.handler"
  timeout          = 15
  memory_size      = 128
  filename         = data.archive_file.healthcheck.output_path
  source_code_hash = data.archive_file.healthcheck.output_base64sha256
}

resource "aws_cloudwatch_event_rule" "healthcheck" {
  name                = "mostatelax-prod-healthcheck-schedule"
  schedule_expression = "rate(5 minutes)"
}

resource "aws_cloudwatch_event_target" "healthcheck" {
  rule      = aws_cloudwatch_event_rule.healthcheck.name
  target_id = "1"
  arn       = aws_lambda_function.healthcheck.arn
}

resource "aws_lambda_permission" "healthcheck_events" {
  statement_id  = "eventbridge-invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.healthcheck.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.healthcheck.arn
}

resource "aws_cloudwatch_metric_alarm" "backend_down" {
  alarm_name          = "mostatelax-prod-backend-down"
  alarm_description   = "Missouri State Lacrosse backend health check failing"
  namespace           = "MostateLacrosse"
  metric_name         = "BackendUp"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 3
  threshold           = 1
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

# Emails at 75% of actual spend, and again at 100% of actual and of forecast spend.
resource "aws_budgets_budget" "monthly" {
  name         = "mostatelax-prod-monthly"
  budget_type  = "COST"
  limit_amount = "80.0"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 75
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
}
