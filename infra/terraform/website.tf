# The public website: static files in a private S3 bucket, served worldwide by CloudFront on
# missouristatelacrosse.com and www. CloudFront also forwards /api/* to the backend.
#
# DNS is at Cloudflare, not AWS, so two things are done by hand there and are not in Terraform:
#   - the validation CNAMEs for the certificate (see the ACM console or `terraform output`)
#   - the apex and www CNAMEs pointing at the distribution's domain name (output below)

# The certificate has to be in us-east-1 for CloudFront, which is also this stack's only region.
resource "aws_acm_certificate" "site" {
  domain_name               = "missouristatelacrosse.com"
  subject_alternative_names = ["missouristatelacrosse.com", "www.missouristatelacrosse.com"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_cloudfront_origin_access_control" "web" {
  name                              = "mostatelax-prod-web"
  description                       = "S3 origin for the site"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Makes every page URL serve the single-page app, redirects the old /recruit link, and sends www to
# the bare domain so search engines see one site. Done here
# rather than with CloudFront's error pages so that API errors are not rewritten into HTML.
resource "aws_cloudfront_function" "spa" {
  name    = "mostatelax-prod-spa"
  runtime = "cloudfront-js-2.0"
  comment = "SPA fallback, recruit redirect, www to apex redirect"
  publish = true

  code = <<-EOT
    function handler(event) {
      var request = event.request;
      var uri = request.uri;
      var host = request.headers.host ? request.headers.host.value : '';
      if (host === 'www.missouristatelacrosse.com') {
        var query = '';
        var keys = Object.keys(request.querystring);
        if (keys.length > 0) {
          query = '?' + keys.map(function (k) { return k + '=' + request.querystring[k].value; }).join('&');
        }
        return { statusCode: 301, statusDescription: 'Moved Permanently', headers: { location: { value: 'https://missouristatelacrosse.com' + uri + query } } };
      }
      if (uri === '/recruit' || uri === '/recruit/') {
        return { statusCode: 301, statusDescription: 'Moved Permanently', headers: { location: { value: '/recruitment' } } };
      }
      var last = uri.substring(uri.lastIndexOf('/') + 1);
      if (last.indexOf('.') === -1) {
        request.uri = '/index.html';
      }
      return request;
    }
  EOT
}

resource "aws_cloudfront_response_headers_policy" "security" {
  name    = "mostatelax-prod-security-headers"
  comment = "HSTS, nosniff, frame and referrer protections"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = false
      preload                    = false
      override                   = true
    }

    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "SAMEORIGIN"
      override     = true
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
  }
}

# The same protections, plus a header telling search engines not to list the page. Applied to the
# women's site and to every page that is private, account-related or a payment step. This works
# without any JavaScript, unlike the tag the site also sets in the page itself.
resource "aws_cloudfront_response_headers_policy" "security_noindex" {
  name    = "mostatelax-prod-security-headers-noindex"
  comment = "Security headers plus X-Robots-Tag noindex"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = false
      preload                    = false
      override                   = true
    }

    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "SAMEORIGIN"
      override     = true
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
  }

  custom_headers_config {
    items {
      header   = "X-Robots-Tag"
      value    = "noindex, nofollow"
      override = true
    }
  }
}

# Keep in step with noindexPrefixes in src/Global/seo/routeMeta.json.
locals {
  noindex_paths = [
    "/women*",
    "/manage*",
    "/portal*",
    "/payments*",
    "/settings*",
    "/admin*",
    "/dues*",
    "/checkout*",
    "/pending-approval*",
    "/set-password*",
    "/reset-password*",
    "/alumni-join*",
    "/alumni-budget*",
    "/recruitment/submissions*",
    "/order-lookup*",
    "/donate/success*",
    "/fundraiser/*/success*",
  ]
}

data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_but_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_distribution" "site" {
  comment             = "Missouri State Lacrosse site"
  enabled             = true
  is_ipv6_enabled     = true
  http_version        = "http2and3"
  price_class         = "PriceClass_100"
  default_root_object = "index.html"
  aliases             = ["missouristatelacrosse.com", "www.missouristatelacrosse.com"]

  origin {
    origin_id                = "s3-web"
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  origin {
    origin_id   = "api"
    domain_name = "api.missouristatelacrosse.com"

    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "https-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_read_timeout      = 60
      origin_keepalive_timeout = 5
    }
  }

  # Pages: never cached, so a deploy shows up immediately.
  default_cache_behavior {
    target_origin_id           = "s3-web"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.disabled.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa.arn
    }
  }

  # Hashed asset files never change, so they are cached for a year.
  ordered_cache_behavior {
    path_pattern               = "/assets/*"
    target_origin_id           = "s3-web"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.optimized.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
  }

  # API calls pass straight through to the backend, uncached, with every header intact.
  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = "api"
    viewer_protocol_policy   = "https-only"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = true
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_but_host.id
  }

  # Private and non-public pages: served like any page, but marked noindex.
  dynamic "ordered_cache_behavior" {
    for_each = local.noindex_paths

    content {
      path_pattern               = ordered_cache_behavior.value
      target_origin_id           = "s3-web"
      viewer_protocol_policy     = "redirect-to-https"
      allowed_methods            = ["GET", "HEAD"]
      cached_methods             = ["GET", "HEAD"]
      compress                   = true
      cache_policy_id            = data.aws_cloudfront_cache_policy.disabled.id
      response_headers_policy_id = aws_cloudfront_response_headers_policy.security_noindex.id

      function_association {
        event_type   = "viewer-request"
        function_arn = aws_cloudfront_function.spa.arn
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.site.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}
