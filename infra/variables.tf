variable "aws_region" {
  description = "Región de AWS donde vive toda la infraestructura"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Prefijo usado para nombrar recursos"
  type        = string
  default     = "librosfera"
}

variable "my_ip" {
  description = "Tu IP pública actual en formato CIDR (ej. 203.0.113.10/32), para la regla SSH"
  type        = string
}

variable "key_pair_name" {
  description = "Nombre del key pair ya existente en AWS (no lo crea Terraform)"
  type        = string
  default     = "librosfera-key"
}

variable "instance_type" {
  description = "Tipo de instancia EC2"
  type        = string
  default     = "t3.micro" # la instancia actual es t3.micro, no t2.micro
}

variable "create_eip" {
  description = "Si es true, asigna una Elastic IP a la instancia. En false, la instancia usa su IP pública efímera (cambia en cada destroy/apply) y no se cobra por IP mientras no esté corriendo."
  type        = bool
  default     = true
}

variable "backend_origin_domain" {
  description = "IP o DNS público actual del EC2 backend, para el origin /api/* de CloudFront. Se actualiza a mano (ver output ec2_public_dns) después de levantar la instancia con 'terraform apply -target=module.compute'. Vacío = CloudFront usa un placeholder; mantiene este recurso desacoplado de module.compute para poder destruir/recrear el compute sin tocar CloudFront/S3."
  type        = string
  default     = ""
}

variable "bucket_frontend_name" {
  description = "Nombre del bucket S3 que sirve el build de React"
  type        = string
  default     = "librosfera-frontend-jdtb99-2026"
}

variable "bucket_uploads_name" {
  description = "Nombre del bucket S3 para imágenes de libros"
  type        = string
  default     = "librosfera-uploads-jdtb99"
}
