# The team password manager (Vaultwarden, a Bitwarden-compatible server) for officers.
#
# It runs on its own small server, apart from the app, so a problem in one cannot reach the other.
# Hardening choices:
#   - No SSH at all. The server is managed through AWS Systems Manager, so there is no open admin
#     port and no key to lose.
#   - The disk is encrypted.
#   - The admin web panel is not enabled. People are added by inviting them from inside the app.
#   - Backups go to S3 every night, and the disk is snapshotted daily like the app server.
#
# Vault contents are encrypted in each person's browser before they reach the server, so even a
# stolen backup is unreadable without the users' master passwords.

variable "vault_domain" {
  description = "Public address of the password manager."
  type        = string
  default     = "vault.missouristatelacrosse.com"
}

variable "vaultwarden_version" {
  description = "Pinned Vaultwarden release. Change it deliberately to upgrade."
  type        = string
  default     = "1.37.3"
}

variable "caddy_version" {
  description = "Pinned Caddy release (handles HTTPS certificates)."
  type        = string
  default     = "2.11.4"
}

data "aws_ami" "al2023_arm" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023*-kernel-6.12-arm64"]
  }

  filter {
    name   = "state"
    values = ["available"]
  }
}

resource "aws_security_group" "vault" {
  name        = "mostatelax-prod-vault-sg"
  description = "Password manager: web only, no SSH"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    protocol    = "tcp"
    from_port   = 80
    to_port     = 80
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    protocol    = "tcp"
    from_port   = 443
    to_port     = 443
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    protocol    = "udp"
    from_port   = 443
    to_port     = 443
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "mostatelax-prod-vault-sg"
  }
}

resource "aws_iam_role" "vault" {
  name        = "mostatelax-prod-vault-role"
  description = "Password manager server: Systems Manager access and its own backup folder"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "vault_ssm" {
  role       = aws_iam_role.vault.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "vault_backups" {
  name = "vault-backups"
  role = aws_iam_role.vault.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "VaultBackupFolder"
      Effect   = "Allow"
      Action   = ["s3:PutObject"]
      Resource = "${aws_s3_bucket.backups.arn}/vault/*"
    }]
  })
}

resource "aws_iam_instance_profile" "vault" {
  name = aws_iam_role.vault.name
  role = aws_iam_role.vault.name
}

resource "aws_instance" "vault" {
  ami                         = data.aws_ami.al2023_arm.id
  instance_type               = "t4g.micro"
  subnet_id                   = aws_instance.backend.subnet_id
  vpc_security_group_ids      = [aws_security_group.vault.id]
  iam_instance_profile        = aws_iam_instance_profile.vault.name
  associate_public_ip_address = true

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  root_block_device {
    volume_size = 12
    volume_type = "gp3"
    encrypted   = true

    # Picked up by the daily snapshot policy in compute.tf.
    tags = {
      Name           = "mostatelax-prod-vault"
      SnapshotPolicy = "daily"
    }
  }

  user_data = templatefile("${path.module}/vault/cloud-init.sh.tpl", {
    domain              = var.vault_domain
    admin_cidr          = var.admin_ssh_cidr
    backup_bucket       = aws_s3_bucket.backups.id
    vaultwarden_version = var.vaultwarden_version
    caddy_version       = var.caddy_version
  })

  tags = {
    Name = "mostatelax-prod-vault"
  }

  lifecycle {
    # First-boot setup and OS image only matter when the server is created.
    ignore_changes = [ami, user_data, user_data_base64]
  }
}

resource "aws_eip" "vault" {
  domain = "vpc"

  tags = {
    Name = "mostatelax-prod-vault"
  }
}

resource "aws_eip_association" "vault" {
  allocation_id = aws_eip.vault.id
  instance_id   = aws_instance.vault.id
}

output "vault_public_ip" {
  description = "Point the vault DNS record (an A record) at this."
  value       = aws_eip.vault.public_ip
}

# Outgoing mail for the password manager (officer invites, sign-in notices), sent through the same
# SES domain as the site. Vaultwarden speaks SMTP, and SES's SMTP needs its own credential, so this
# is a dedicated user that can do exactly one thing: send mail from no-reply@. Its key is created
# by hand, converted to an SMTP password, and stored only in Secrets Manager. It is not in Terraform
# or git, and the raw key is discarded.
resource "aws_iam_user" "vault_smtp" {
  name = "mostatelax-prod-vault-smtp"
  path = "/service/"
}

resource "aws_iam_user_policy" "vault_smtp" {
  name = "send-as-no-reply"
  user = aws_iam_user.vault_smtp.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "SendFromNoReplyOnly"
      Effect   = "Allow"
      Action   = "ses:SendRawEmail"
      Resource = aws_sesv2_email_identity.domain.arn
      Condition = {
        StringEquals = { "ses:FromAddress" = "no-reply@missouristatelacrosse.com" }
      }
    }]
  })
}

resource "aws_secretsmanager_secret" "vault_smtp" {
  name        = "mostatelax/prod/vault-smtp"
  description = "SES SMTP username and password for the password manager"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_iam_role_policy" "vault_read_smtp" {
  name = "read-smtp-secret"
  role = aws_iam_role.vault.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "ReadOwnSmtpSecret"
      Effect   = "Allow"
      Action   = "secretsmanager:GetSecretValue"
      Resource = aws_secretsmanager_secret.vault_smtp.arn
    }]
  })
}
