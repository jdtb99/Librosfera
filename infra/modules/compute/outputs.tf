output "instance_id" {
  value = aws_instance.backend.id
}

output "public_ip" {
  value = var.create_eip ? aws_eip.backend[0].public_ip : aws_instance.backend.public_ip
}

output "public_dns" {
  value = var.create_eip ? aws_eip.backend[0].public_dns : aws_instance.backend.public_dns
}

output "security_group_id" {
  value = aws_security_group.backend.id
}
