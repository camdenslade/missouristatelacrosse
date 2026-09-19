# Buckets. All are private and encrypted. Nothing is ever served straight from S3: images go out
# as short-lived presigned links, and the website goes through CloudFront.

# Player, team, gallery and raffle images. Versioned so an accidental overwrite can be undone.
resource "aws_s3_bucket" "images" {
  bucket = "mostatelax-prod-images"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_public_access_block" "images" {
  bucket                  = aws_s3_bucket.images.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "images" {
  bucket = aws_s3_bucket.images.id

  rule {
    blocked_encryption_types = ["SSE-C"]

    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "images" {
  bucket = aws_s3_bucket.images.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Nightly database dumps, kept 35 days.
resource "aws_s3_bucket" "backups" {
  bucket = "mostatelax-prod-backups"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket                  = aws_s3_bucket.backups.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    blocked_encryption_types = ["SSE-C"]

    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "expire-old-db-dumps"
    status = "Enabled"

    filter {
      prefix = "db/"
    }

    expiration {
      days = 35
    }
  }
}

# The built website. Only the CloudFront distribution can read it (see website.tf).
resource "aws_s3_bucket" "web" {
  bucket = "mostatelax-prod-web"
}

resource "aws_s3_bucket_public_access_block" "web" {
  bucket                  = aws_s3_bucket.web.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "web" {
  bucket = aws_s3_bucket.web.id

  rule {
    blocked_encryption_types = ["SSE-C"]

    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_policy" "web" {
  bucket = aws_s3_bucket.web.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "CloudFrontRead"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.web.arn}/*"
      Condition = {
        StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.site.arn }
      }
    }]
  })
}

# Terraform's own state. Versioned so a bad write can be rolled back. Losing this bucket means
# losing the record of what Terraform manages, so it cannot be destroyed by accident.
resource "aws_s3_bucket" "tfstate" {
  bucket = "mostatelax-prod-tfstate"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    blocked_encryption_types = ["SSE-C"]

    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  versioning_configuration {
    status = "Enabled"
  }
}

# The secret containers only. Their values (payment keys, database password, the Firebase service
# account) are entered by hand in the console and are never in Terraform or git.
resource "aws_secretsmanager_secret" "backend" {
  name        = "mostatelax/prod/backend"
  description = "Backend app secrets - Missouri State Lacrosse (prod)"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_secretsmanager_secret" "firebase" {
  name        = "mostatelax/prod/firebase-service-account"
  description = "Firebase Admin SDK service account JSON - Missouri State Lacrosse (prod)"

  lifecycle {
    prevent_destroy = true
  }
}
