data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Key pair ya existente en AWS: Terraform solo lo referencia, nunca
# genera ni gestiona el material de la llave privada (.pem).
data "aws_key_pair" "this" {
  key_name = var.key_pair_name
}

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# IPs desde las que CloudFront contacta a los orígenes -> es lo único
# que necesita entrar por el puerto 80, nunca 0.0.0.0/0.
data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_security_group" "backend" {
  name = "${var.project_name}-backend-sg"
  # La descripción es inmutable en AWS (forces replacement si cambia):
  # se deja igual a la que ya tiene el SG real para no recrearlo.
  description = "Security group para backend Librosfera"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.my_ip]
  }

  ingress {
    description     = "HTTP desde CloudFront"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudfront.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-backend-sg"
  }
}

resource "aws_instance" "backend" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type
  key_name               = data.aws_key_pair.this.key_name
  subnet_id              = data.aws_subnets.default.ids[0]
  vpc_security_group_ids = [aws_security_group.backend.id]
  iam_instance_profile   = var.iam_instance_profile_name

  user_data = file("${path.module}/user_data.sh")

  tags = {
    Name = "${var.project_name}-backend"
  }

  lifecycle {
    # Esta instancia ya existe y está provisionada a mano: no queremos que
    # un AMI más nuevo del data source, o reordenar subnets, fuercen un
    # replace. user_data tampoco se re-ejecuta en una instancia existente.
    ignore_changes = [ami, subnet_id, user_data]
  }
}

resource "aws_eip" "backend" {
  count    = var.create_eip ? 1 : 0
  instance = aws_instance.backend.id
  domain   = "vpc"

  tags = {
    Name = "${var.project_name}-backend-eip"
  }
}
