# Outgoing email. The whole domain is verified in SES, so any address at it can send (the app
# uses no-reply@). DKIM signing is on; the three DKIM records live in Cloudflare DNS.
#
# Production sending access (leaving the SES sandbox) was requested through AWS Support and is an
# account setting, not something Terraform manages.
resource "aws_sesv2_email_identity" "domain" {
  email_identity = "missouristatelacrosse.com"

  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }
}
