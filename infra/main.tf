terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend local por defecto (el state queda en infra/terraform.tfstate, ignorado por git).
  # Para compartir el state entre máquinas, crear antes un bucket S3 + tabla DynamoDB
  # para locking y descomentar esto:
  # backend "s3" {
  #   bucket         = "librosfera-terraform-state"
  #   key            = "librosfera/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "librosfera-terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "librosfera"
      ManagedBy = "terraform"
    }
  }
}

module "compute" {
  source = "./modules/compute"

  project_name              = var.project_name
  instance_type             = var.instance_type
  key_pair_name             = var.key_pair_name
  my_ip                     = var.my_ip
  create_eip                = var.create_eip
  iam_instance_profile_name = aws_iam_instance_profile.backend.name
}
