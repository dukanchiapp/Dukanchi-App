#!/bin/bash
# G-AI — Hostinger VPS Deploy Script
# Run once on a fresh Ubuntu 22.04 VPS as root:
#   chmod +x deploy.sh && ./deploy.sh

set -e

DOMAIN="YOUR_DOMAIN"          # e.g. gai.in
APP_DIR="/var/www/g-ai"
REPO="https://github.com/manmohanbakshi211/G-ai.git"

echo "=== [1/9] System update ==="
apt-get update -y && apt-get upgrade -y

echo "=== [2/9] Install Node.js 22 ==="
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

echo "=== [3/9] Install PostgreSQL 14 ==="
apt-get install -y postgresql postgresql-contrib
systemctl enable postgresql && systemctl start postgresql

echo "=== [4/9] Install Redis ==="
apt-get install -y redis-server
systemctl enable redis-server && systemctl start redis-server

echo "=== [5/9] Install Nginx + Certbot ==="
apt-get install -y nginx certbot python3-certbot-nginx
systemctl enable nginx

echo "=== [6/9] Install PM2 ==="
npm install -g pm2 tsx
pm2 startup systemd -u root --hp /root | tail -1 | bash

echo "=== [7/9] Clone repo & install deps ==="
mkdir -p $APP_DIR
git clone $REPO $APP_DIR || (cd $APP_DIR && git pull)
cd $APP_DIR

npm ci
cd admin-panel && npm ci && cd ..

echo "=== [8/9] Setup PostgreSQL database ==="
sudo -u postgres psql -c "CREATE USER g_ai_user WITH PASSWORD 'CHANGE_THIS_PASSWORD';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE g_ai OWNER g_ai_user;" 2>/dev/null || true

echo "=== [9/9] Build frontends ==="
cd $APP_DIR
npx prisma migrate deploy
npx prisma generate
npm run build 2>/dev/null || true
cd admin-panel && npm run build && cd ..

echo "=== Configure Nginx ==="
mkdir -p /var/log/g-ai
cp $APP_DIR/nginx.conf /etc/nginx/sites-available/g-ai
sed -i "s/YOUR_DOMAIN/$DOMAIN/g" /etc/nginx/sites-available/g-ai
ln -sf /etc/nginx/sites-available/g-ai /etc/nginx/sites-enabled/g-ai
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "=== SSL Certificate ==="
certbot --nginx -d $DOMAIN -d www.$DOMAIN -d admin.$DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN

echo "=== Start App with PM2 ==="
cd $APP_DIR
pm2 start ecosystem.config.js --env production
pm2 save

echo ""
echo "========================================="
echo " DEPLOY COMPLETE"
echo " Main app:    https://$DOMAIN"
echo " Admin panel: https://admin.$DOMAIN"
echo "========================================="
echo ""
echo "NEXT: Create a .env file at $APP_DIR/.env with:"
echo "  DATABASE_URL=postgresql://g_ai_user:CHANGE_THIS_PASSWORD@localhost:5432/g_ai"
echo "  REDIS_URL=redis://localhost:6379"
echo "  JWT_SECRET=$(openssl rand -hex 32)"
echo "  NODE_ENV=production"
