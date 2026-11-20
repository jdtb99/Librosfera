#!/bin/bash
# Bootstrap del sistema operativo solamente (Node, Nginx, PM2).
# El despliegue de la app (git pull, .env, pm2 start) se hace a mano
# por SSH, igual que hasta ahora -- ver MANTENIMIENTO.md.
set -euo pipefail

dnf update -y
curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
dnf install -y nodejs git nginx
npm install -g pm2

# nginx.conf mínimo: evita el server block IPv6 por defecto que choca
# con nuestro vhost (el mismo problema que se encontró a mano en la
# Sesión 3 del deploy manual).
cat > /etc/nginx/nginx.conf <<'NGINXCONF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log;
pid /run/nginx.pid;

include /usr/share/nginx/modules/*.conf;

events {
    worker_connections 1024;
}

http {
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                     '$status $body_bytes_sent "$http_referer" '
                     '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    keepalive_timeout 65;
    types_hash_max_size 4096;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    include /etc/nginx/conf.d/*.conf;
}
NGINXCONF

cat > /etc/nginx/conf.d/librosfera.conf <<'NGINX'
server {
    listen 80 default_server;
    server_name _;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

systemctl enable nginx
systemctl restart nginx
