terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.0"
}

provider "aws" {
  region = var.aws_region
}

# Variables
variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}

variable "key_name" {
  description = "Name of the SSH key pair"
  type        = string
  default     = "nebuladen-key-v2"
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed to SSH into the instance"
  type        = string
  default     = "0.0.0.0/0"
}

variable "alert_email" {
  description = "Email address for CloudWatch alerts"
  type        = string
  default     = "dtutika1998@outlook.com"
}

# Data source for latest Ubuntu 22.04 AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "state"
    values = ["available"]
  }
}

# IAM Role for EC2 to access S3
resource "aws_iam_role" "nebuladen_ec2_role" {
  name = "nebuladen-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name        = "nebuladen-ec2-role"
    Project     = "nebuladen"
    Environment = "production"
  }
}

# Attach S3 access policy to IAM role
resource "aws_iam_role_policy_attachment" "s3_access" {
  role       = aws_iam_role.nebuladen_ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}

# IAM Instance Profile
resource "aws_iam_instance_profile" "nebuladen_ec2_profile" {
  name = "nebuladen-ec2-profile"
  role = aws_iam_role.nebuladen_ec2_role.name

  tags = {
    Project     = "nebuladen"
    Environment = "production"
  }
}

# S3 Backup Bucket
resource "aws_s3_bucket" "nebuladen_backups" {
  bucket = "nebuladen-backups-639163294452"

  tags = {
    Name        = "nebuladen-backups"
    Project     = "nebuladen"
    Environment = "production"
  }
}

# Enable versioning on backup bucket
resource "aws_s3_bucket_versioning" "nebuladen_backups_versioning" {
  bucket = aws_s3_bucket.nebuladen_backups.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Security Group
resource "aws_security_group" "nebuladen_sg" {
  name        = "nebuladen-sg"
  description = "NebulaDen agent security group"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
    description = "SSH access"
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP traffic"
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS traffic"
  }

  ingress {
    from_port   = 4000
    to_port     = 4000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "NebulaDen backend API"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }

  tags = {
    Name        = "nebuladen-sg"
    Project     = "nebuladen"
    Environment = "production"
  }
}

# EC2 Instance
resource "aws_instance" "nebuladen_agent" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.nebuladen_sg.id]
  iam_instance_profile   = aws_iam_instance_profile.nebuladen_ec2_profile.name

  user_data = <<-EOF
    #!/bin/bash
    apt-get update -y
    apt-get install -y unzip
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip awscliv2.zip
    ./aws/install
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs git nginx
    npm install -g pm2
    pm2 startup systemd -u ubuntu --hp /home/ubuntu
    pm2 install pm2-logrotate
    pm2 set pm2-logrotate:max_size 10M
    pm2 set pm2-logrotate:retain 7
    pm2 set pm2-logrotate:compress true
  EOF

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
    encrypted   = true
  }

  tags = {
    Name        = "nebuladen-agent"
    Project     = "nebuladen"
    Environment = "production"
  }
}

# Elastic IP
resource "aws_eip" "nebuladen_eip" {
  instance = aws_instance.nebuladen_agent.id
  domain   = "vpc"

  tags = {
    Name        = "nebuladen-eip"
    Project     = "nebuladen"
    Environment = "production"
  }
}

# SNS Topic for alerts
resource "aws_sns_topic" "nebuladen_alerts" {
  name = "nebuladen-alerts"

  tags = {
    Project     = "nebuladen"
    Environment = "production"
  }
}

# SNS Email Subscription
resource "aws_sns_topic_subscription" "email_alert" {
  topic_arn = aws_sns_topic.nebuladen_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# CloudWatch CPU Alarm
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "nebuladen-high-cpu"
  alarm_description   = "EC2 CPU usage above 80%"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  statistic           = "Average"
  period              = 300
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2

  dimensions = {
    InstanceId = aws_instance.nebuladen_agent.id
  }

  alarm_actions = [aws_sns_topic.nebuladen_alerts.arn]
  ok_actions    = [aws_sns_topic.nebuladen_alerts.arn]

  tags = {
    Project     = "nebuladen"
    Environment = "production"
  }
}

# CloudWatch Status Check Alarm
resource "aws_cloudwatch_metric_alarm" "status_check" {
  alarm_name          = "nebuladen-status-check"
  alarm_description   = "EC2 instance status check failed"
  metric_name         = "StatusCheckFailed"
  namespace           = "AWS/EC2"
  statistic           = "Maximum"
  period              = 60
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2

  dimensions = {
    InstanceId = aws_instance.nebuladen_agent.id
  }

  alarm_actions = [aws_sns_topic.nebuladen_alerts.arn]

  tags = {
    Project     = "nebuladen"
    Environment = "production"
  }
}

# Outputs
output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.nebuladen_agent.id
}

output "public_ip" {
  description = "Elastic IP address"
  value       = aws_eip.nebuladen_eip.public_ip
}

output "instance_type" {
  description = "EC2 instance type"
  value       = aws_instance.nebuladen_agent.instance_type
}

output "security_group_id" {
  description = "Security group ID"
  value       = aws_security_group.nebuladen_sg.id
}

output "backup_bucket" {
  description = "S3 backup bucket name"
  value       = aws_s3_bucket.nebuladen_backups.bucket
}
