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

# Security Group
resource "aws_security_group" "nebuladen_sg" {
  name        = "nebuladen-sg"
  description = "NebulaDen agent security group"

  # SSH
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
    description = "SSH access"
  }

  # HTTP
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP traffic"
  }

  # HTTPS
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS traffic"
  }

  # Backend API
  ingress {
    from_port   = 4000
    to_port     = 4000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "NebulaDen backend API"
  }

  # Allow all outbound
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

  user_data = <<-EOF
    #!/bin/bash
    apt-get update -y
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs git nginx
    npm install -g pm2
    pm2 startup systemd -u ubuntu --hp /home/ubuntu
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
  endpoint  = "dtutika1998@outlook.com"
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
