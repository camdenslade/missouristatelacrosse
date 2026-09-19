# The backend server: one EC2 instance running the Spring Boot app, Postgres, nginx and MediaMTX,
# with a fixed public address, daily EBS snapshots, and a firewall that only exposes what it serves.

variable "admin_ssh_cidr" {
  description = "The only address allowed to SSH to the backend. Update it when your home IP changes."
  type        = string
  default     = "45.20.241.15/32"
}

data "aws_vpc" "default" {
  default = true
}

resource "aws_security_group" "backend" {
  name        = "mostatelax-prod-backend-sg"
  description = "Missouri State Lacrosse backend (prod): web, RTMP, restricted SSH"
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

  # RTMP ingest for live streaming.
  ingress {
    protocol    = "tcp"
    from_port   = 1935
    to_port     = 1935
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    protocol    = "tcp"
    from_port   = 22
    to_port     = 22
    cidr_blocks = [var.admin_ssh_cidr]
  }

  egress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "mostatelax-prod-backend-sg"
  }
}

resource "aws_instance" "backend" {
  ami                         = "ami-008deafd6f62cdfc8"
  instance_type               = "t3.medium"
  key_name                    = "mostatelax-prod-key"
  subnet_id                   = "subnet-0b1e9ed1d2a4d06ad"
  vpc_security_group_ids      = [aws_security_group.backend.id]
  iam_instance_profile        = aws_iam_instance_profile.ec2.name
  associate_public_ip_address = true

  # Instance metadata v2 only (blocks SSRF-style credential theft).
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  # Note: "unlimited" lets a busy instance burst past its CPU credits and be billed for it.
  # Switch to "standard" if the bill ever surprises you.
  credit_specification {
    cpu_credits = "unlimited"
  }

  # TODO: this volume is not encrypted. Turning it on means replacing the volume (snapshot,
  # encrypted copy, swap), which needs a short outage, so it is not changed here.
  root_block_device {
    volume_size           = 30
    volume_type           = "gp3"
    iops                  = 3000
    throughput            = 125
    delete_on_termination = true

    # The snapshot policy below selects volumes by this tag. Do not remove it.
    tags = {
      Name           = "mostatelax-prod-backend"
      SnapshotPolicy = "daily"
    }
  }

  tags = {
    Name = "mostatelax-prod-backend"
  }

  lifecycle {
    # OS image upgrades should be deliberate, not a side effect of a config change.
    ignore_changes = [ami, user_data, user_data_base64]
  }
}

resource "aws_eip" "backend" {
  domain = "vpc"

  tags = {
    Name = "mostatelax-prod-backend"
  }
}

resource "aws_eip_association" "backend" {
  allocation_id = aws_eip.backend.id
  instance_id   = aws_instance.backend.id
}

# Daily snapshots of every volume tagged SnapshotPolicy=daily, keeping a week.
resource "aws_dlm_lifecycle_policy" "ebs_snapshots" {
  description        = "mostatelax-prod daily EBS snapshots"
  execution_role_arn = aws_iam_role.dlm.arn
  state              = "ENABLED"

  policy_details {
    policy_type    = "EBS_SNAPSHOT_MANAGEMENT"
    resource_types = ["VOLUME"]

    target_tags = {
      SnapshotPolicy = "daily"
    }

    schedule {
      name      = "daily-ebs-snapshot"
      copy_tags = true

      tags_to_add = {
        CreatedBy = "DLM"
        Project   = "mostate-lacrosse"
      }

      create_rule {
        interval      = 24
        interval_unit = "HOURS"
        times         = ["08:00"]
      }

      retain_rule {
        count = 7
      }
    }
  }
}
