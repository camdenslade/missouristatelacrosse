#!/bin/bash
# One-time setup of the staging backend on the shared server. Safe to run again. Run as root through
# Systems Manager with these variables set: POOL_ID, CLIENT_ID (staging Cognito), and the two
# domains. It creates staging's own database login and database, a locked-down service, and the
# web server entry. It does not touch production's database, service or settings.
set -euo pipefail

: "${POOL_ID:?}" "${CLIENT_ID:?}" "${STAGING_DOMAIN:?}" "${STAGING_API_DOMAIN:?}"

# 1. Staging's own database and login. The password comes from the staging secret, so it is never
#    typed or stored anywhere else.
DB_PASSWORD="$(aws secretsmanager get-secret-value --region us-east-1 --secret-id mostatelax/staging/backend \
  --query SecretString --output text | python3 -c "import json,sys;print(json.load(sys.stdin)['DB_PASSWORD'])")"

if ! sudo -u postgres psql -Atc "select 1 from pg_roles where rolname='laxapp_staging'" | grep -q 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -q -c "CREATE ROLE laxapp_staging LOGIN PASSWORD '$DB_PASSWORD'"
else
  sudo -u postgres psql -v ON_ERROR_STOP=1 -q -c "ALTER ROLE laxapp_staging PASSWORD '$DB_PASSWORD'"
fi
if ! sudo -u postgres psql -Atc "select 1 from pg_database where datname='lacrosse_staging'" | grep -q 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE lacrosse_staging OWNER laxapp_staging"
fi
unset DB_PASSWORD

# 2. Where the staging jar lives.
install -d -o ec2-user -g ec2-user /home/ec2-user/staging

# 3. The service. Hard limits keep it from crowding production out of the shared server: it may use
#    at most 768 MB of memory and gets a low share of CPU when both are busy.
cat > /etc/systemd/system/laxsite-backend-staging.service <<EOF
[Unit]
Description=Missouri State Lacrosse backend (staging)
After=network.target postgresql.service

[Service]
User=ec2-user
WorkingDirectory=/home/ec2-user/staging
Environment=SPRING_PROFILES_ACTIVE=prod
Environment=PORT=8081
Environment=AWS_REGION=us-east-1
Environment=BACKEND_SECRET_ID=mostatelax/staging/backend
Environment=FIREBASE_SECRET_ID=mostatelax/staging/not-used
Environment=COGNITO_USER_POOL_ID=${POOL_ID}
Environment=COGNITO_CLIENT_ID=${CLIENT_ID}
Environment=APP_EMAIL_ENABLED=false
Environment=FRONTEND_BASE_URL=https://${STAGING_DOMAIN}
Environment=CORS_EXTRA_ORIGINS=https://${STAGING_DOMAIN}
Environment="JAVA_TOOL_OPTIONS=-Xms96m -Xmx512m -XX:MaxMetaspaceSize=256m -XX:+ExitOnOutOfMemoryError"
ExecStart=/usr/bin/java -jar /home/ec2-user/staging/laxsite-backend.jar --spring.profiles.active=prod
Restart=on-failure
RestartSec=10
MemoryHigh=640M
MemoryMax=768M
CPUWeight=20
Nice=10

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable laxsite-backend-staging.service

# 4. The web server entry for the staging backend's address. HTTPS is added afterwards with certbot,
#    once the DNS record points here.
cat > /etc/nginx/conf.d/laxsite-backend-staging.conf <<EOF
server {
    listen 80;
    server_name ${STAGING_API_DOMAIN};

    location / {
        proxy_pass         http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
        add_header         X-Robots-Tag "noindex, nofollow" always;
    }
}
EOF
nginx -t
systemctl reload nginx
echo "staging server setup complete"
