output "backend_public_ip" {
  description = "The backend's fixed address. The api DNS record points here."
  value       = aws_eip.backend.public_ip
}

output "cloudfront_domain" {
  description = "Point the apex and www CNAMEs in Cloudflare at this."
  value       = aws_cloudfront_distribution.site.domain_name
}

output "cloudfront_distribution_id" {
  description = "Used by the deploy workflow to clear the cache."
  value       = aws_cloudfront_distribution.site.id
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "cognito_web_client_id" {
  value = aws_cognito_user_pool_client.web.id
}

output "certificate_validation_records" {
  description = "DNS records to create in Cloudflare if the certificate ever needs re-validating."
  value = {
    for o in aws_acm_certificate.site.domain_validation_options : o.domain_name => {
      name  = o.resource_record_name
      type  = o.resource_record_type
      value = o.resource_record_value
    }
  }
}
