# Monitor de Aforo — Guía de Despliegue en Producción

> **Stack:** Frontend en **Vercel** · Backend en **servidor Ubuntu 22.04** con nginx + certbot

---

## Arquitectura

```
Internet
    │
    ├── https://aforo.pucv.cl          →  Vercel (CDN, HTTPS automático)
    │         (React SPA)
    │
    └── https://api.aforo.pucv.cl      →  Servidor PUCV
              nginx :443                    ↓
                ├── /api/*        →  FastAPI :8000
                ├── /video_feed/* →  FastAPI :8000  (MJPEG stream)
                └── /health       →  FastAPI :8000
```

---

## Parte 1 — Frontend en Vercel

### 1.1 Primer deploy

1. Sube el repositorio a GitHub (si no está ya).
2. Ve a [vercel.com](https://vercel.com) → **New Project** → importa el repo.
3. En la configuración del proyecto:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Agrega las **variables de entorno** en Vercel (Settings → Environment Variables):

| Variable | Valor |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Tu Client ID de Google OAuth |
| `VITE_SUPABASE_URL` | URL de tu proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon key de Supabase |
| `VITE_API_BASE` | `https://api.aforo.pucv.cl` (tu dominio del backend) |

5. **Deploy** — Vercel asigna automáticamente HTTPS y un dominio `*.vercel.app`.
6. En Settings → Domains, agrega tu dominio personalizado (ej: `aforo.pucv.cl`).

### 1.2 Deploys posteriores

Cada `git push` a `main` dispara un redeploy automático en Vercel.

---

## Parte 2 — Backend en servidor propio

### Requisitos del servidor

- Ubuntu 22.04 LTS (o Debian 12)
- Acceso root o sudo
- Dominio apuntando al servidor (ej: `api.aforo.pucv.cl` → IP del servidor)
- Puertos 80 y 443 abiertos en el firewall
- Cámaras accesibles desde el servidor (USB, IP, RTSP)

### 2.1 Subir el código al servidor

```bash
# Desde tu máquina de desarrollo
rsync -avz --exclude 'venv' --exclude '__pycache__' \
  backend/ usuario@api.aforo.pucv.cl:/opt/monitor-aforo/backend/
```

### 2.2 Configurar variables de entorno en el servidor

```bash
# En el servidor
nano /opt/monitor-aforo/backend/.env
```

Contenido:
```env
JWT_SECRET=<genera con: python3 -c "import secrets; print(secrets.token_hex(32))">
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
ALLOWED_ORIGINS=https://aforo.pucv.cl
```

```bash
# Protege el archivo (solo root lo lee)
chmod 600 /opt/monitor-aforo/backend/.env
```

### 2.3 Instalar dependencias del backend

```bash
cd /opt/monitor-aforo/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
```

### 2.4 Instalar nginx + SSL (script automatizado)

```bash
# Desde el directorio deploy/ del proyecto
chmod +x setup-ssl.sh
sudo ./setup-ssl.sh api.aforo.pucv.cl admin@pucv.cl
```

El script:
1. Instala nginx y certbot
2. Obtiene el certificado SSL de Let's Encrypt
3. Instala la config nginx (proxy al backend, streaming MJPEG)
4. Activa la renovación automática del certificado (cada 90 días)

### 2.5 Instalar el servicio systemd (backend como servicio)

```bash
sudo cp /opt/monitor-aforo/deploy/monitor-aforo.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable monitor-aforo   # arranca automáticamente al reiniciar
sudo systemctl start  monitor-aforo
```

Verificar que está corriendo:
```bash
sudo systemctl status monitor-aforo
sudo journalctl -u monitor-aforo -f    # logs en tiempo real
```

---

## Parte 3 — Verificar que todo funciona

```bash
# 1. Backend responde por HTTPS
curl https://api.aforo.pucv.cl/health

# 2. Certificado válido
curl -vI https://api.aforo.pucv.cl/health 2>&1 | grep -E "SSL|subject|expire"

# 3. Redirección HTTP → HTTPS
curl -I http://api.aforo.pucv.cl/health
# Debe devolver 301 → https://...

# 4. Video stream (con token JWT válido)
# Abre en el navegador: https://api.aforo.pucv.cl/video_feed/cam1?token=<jwt>
```

---

## Parte 4 — Google OAuth: agregar dominio de producción

En [Google Cloud Console](https://console.cloud.google.com/) → Tu proyecto → APIs & Services → Credentials → Tu OAuth Client ID:

- **Authorized JavaScript origins:** agrega `https://aforo.pucv.cl`
- **Authorized redirect URIs:** no aplica (usamos el flujo GSI con id_token, no code)

---

## Comandos de operación habituales

```bash
# Reiniciar el backend (tras actualizar el código)
sudo systemctl restart monitor-aforo

# Ver logs del backend
sudo journalctl -u monitor-aforo -f

# Recargar nginx (tras cambiar nginx.conf)
sudo nginx -t && sudo systemctl reload nginx

# Renovar certificado manualmente (normalmente es automático)
sudo certbot renew --dry-run   # prueba sin cambiar nada
sudo certbot renew             # renovación real

# Estado de todos los servicios
sudo systemctl status nginx monitor-aforo
```

---

## Seguridad post-deploy checklist

- [ ] `JWT_SECRET` generado con `secrets.token_hex(32)` (no el valor por defecto)
- [ ] `ALLOWED_ORIGINS` apunta solo al dominio real de producción
- [ ] Certificado SSL activo (A+ en [ssllabs.com/ssltest](https://www.ssllabs.com/ssltest/))
- [ ] Redirección HTTP → HTTPS funcionando
- [ ] Puerto 8000 **no** expuesto al exterior (solo accesible desde localhost)
- [ ] Firewall permite solo 22 (SSH), 80, 443
- [ ] `.env` con permisos 600 (`chmod 600 backend/.env`)
- [ ] Variables de entorno correctas en Vercel

---

## Firewall (ufw)

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (para certbot y redirección)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw deny 8000/tcp   # Backend: solo accesible desde nginx (localhost)
sudo ufw enable
sudo ufw status
```
