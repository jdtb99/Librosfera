output "cloudfront_domain_name" {
  description = "Dominio público de la app (frontend + API + imágenes)"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.main.id
}

output "ec2_public_dns" {
  description = "DNS público actual del backend (origin configurado en CloudFront)"
  value       = module.compute.public_dns
}

output "ec2_public_ip" {
  value = module.compute.public_ip
}

output "ssh_command" {
  value = "ssh -i ~/.ssh/${var.key_pair_name}.pem ec2-user@${module.compute.public_ip}"
}
