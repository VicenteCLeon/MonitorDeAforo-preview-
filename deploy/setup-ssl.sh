#!/usr/bin/env bash
# =============================================================================
#  Monitor de Aforo — setup-ssl.sh
#  Script de primera instalación en el servidor de producción (Ubuntu 22.04+)
#
#  Uso:
#    chmod +x setup-ssl.sh
#    sudo ./setup-ssl.sh TU_DOMINIO tu@correo.cl
#
#  Ejemplo:
#    sudo ./setup-ssl.sh aforo.pucv.cl admin@pucv.cl
# =============================================================================

set -euo pipefail

DOMAIN="${1:?Primer argumento requerido: dominio  (ej: aforo.pucv.cl)}"
EMAIL="${2:?Segundo argumento requerido: email    (ej: admin@pucv.cl)}"
APP_DIR="/var/www/monitor-aforo"
NGINX_CONF="/etc/nginx/sites-available/monitor-aforo"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Monitor de Aforo — instalación en producción"
echo "  Dominio : $DOMAIN"
echo "  Email   : $EMAIL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Dependencias del sistema ──────────────────────────────────────────────
echo "[1/7] Instalando dependencias del sistema..."
apt-get update -q
apt-get install -y nginx certbot python3-certbot-nginx

# Asegura que python3 y pip estén disponibles para el backend
apt-get install -y python3 python3-pip python3-venv

# ── 2. Crear directorio del frontend ────────────────────────────────────────
echo "[2/7] Preparando directorio del frontend..."
mkdir -p "$APP_DIR"
mkdir -p /var/www/certbot

# ── 3. Config nginx temporal (solo HTTP) para que certbot valide el dominio ─
echo "[3/7] Configurando nginx temporal (HTTP)..."
cat > "$NGINX_CONF" <<NGINX_TEMP
server {
    listen 80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 200 'ok'; }
}
NGINX_TEMP

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/monitor-aforo
nginx -t
systemctl reload nginx

# ── 4. Obtener certificado SSL con certbot ───────────────────────────────────
echo "[4/7] Obteniendo certificado SSL (Let's Encrypt)..."
certbot certonly \
    --webroot \
    --webroot-path /var/www/certbot \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN"

# ── 5. Instalar la config nginx definitiva ──────────────────────────────────
echo "[5/7] Instalando configuración nginx definitiva..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
sed "s/TU_DOMINIO/$DOMAIN/g" "$SCRIPT_DIR/nginx.conf" > "$NGINX_CONF"

nginx -t
systemctl reload nginx

# ── 6. Renovación automática del certificado (cron) ─────────────────────────
echo "[6/7] Configurando renovación automática del certificado..."
# Certbot ya instala un timer de systemd en Ubuntu 22.04+
# Este comando verifica que funcione
systemctl enable certbot.timer 2>/dev/null || true
systemctl start  certbot.timer 2>/dev/null || true

# Recarga nginx después de cada renovación
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<'HOOK'
#!/bin/bash
systemctl reload nginx
HOOK
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

# ── 7. Resumen ───────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ nginx + SSL configurados correctamente"
echo ""
echo "  Próximos pasos:"
echo ""
echo "  A. En tu máquina de desarrollo, compila el frontend:"
echo "     cd frontend && npm run build"
echo ""
echo "  B. Sube la carpeta dist/ al servidor:"
echo "     rsync -avz frontend/dist/ usuario@$DOMAIN:$APP_DIR/"
echo ""
echo "  C. En el servidor, arranca el backend:"
echo "     cd backend && python -m uvicorn main:app --host 127.0.0.1 --port 8000"
echo "     (o usa el servicio systemd; ver DEPLOY.md)"
echo ""
echo "  D. Ajusta las variables de entorno:"
echo "     backend/.env   → ALLOWED_ORIGINS=https://$DOMAIN"
echo "     frontend/.env  → VITE_API_BASE=https://$DOMAIN"
echo ""
echo "  🔒 Certificado válido por 90 días (renovación automática activada)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
