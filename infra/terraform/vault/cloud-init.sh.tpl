#!/bin/bash
# First-boot setup for the team password manager (Vaultwarden behind Caddy). Runs once as root.
# Rendered by Terraform: domain, admin_cidr, backup_bucket and the image versions are filled in.
set -euxo pipefail

dnf install -y docker sqlite
systemctl enable --now docker

mkdir -p /opt/vault/data /opt/vault/caddy-data /opt/vault/caddy-config /etc/vault /var/backups/vault

# Vaultwarden settings. Sign-ups start open only so the first account can be created, and the site
# is restricted to one address (see the Caddyfile). Both are tightened right after that.
cat > /etc/vault/vaultwarden.env <<'EOF'
DOMAIN=https://${domain}
SIGNUPS_ALLOWED=true
INVITATIONS_ALLOWED=true
SHOW_PASSWORD_HINT=false
LOG_LEVEL=warn
EOF
chmod 600 /etc/vault/vaultwarden.env

cat > /etc/vault/Caddyfile <<'EOF'
${domain} {
    @blocked not remote_ip ${admin_cidr}
    respond @blocked "Not available" 403

    encode zstd gzip
    reverse_proxy vaultwarden:80
}
EOF

cat > /etc/systemd/system/vault-network.service <<'EOF'
[Unit]
Description=Docker network for the password manager
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/sh -c 'docker network inspect vault >/dev/null 2>&1 || docker network create vault'
EOF

cat > /etc/systemd/system/vaultwarden.service <<'EOF'
[Unit]
Description=Vaultwarden
After=vault-network.service
Requires=vault-network.service

[Service]
Restart=always
RestartSec=5
ExecStartPre=-/usr/bin/docker rm -f vaultwarden
ExecStart=/usr/bin/docker run --rm --name vaultwarden --network vault --env-file /etc/vault/vaultwarden.env -v /opt/vault/data:/data vaultwarden/server:${vaultwarden_version}
ExecStop=/usr/bin/docker stop vaultwarden

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/vault-caddy.service <<'EOF'
[Unit]
Description=Caddy (HTTPS in front of Vaultwarden)
After=vaultwarden.service
Requires=vault-network.service

[Service]
Restart=always
RestartSec=5
ExecStartPre=-/usr/bin/docker rm -f caddy
ExecStart=/usr/bin/docker run --rm --name caddy --network vault -p 80:80 -p 443:443 -p 443:443/udp -v /etc/vault/Caddyfile:/etc/caddy/Caddyfile:ro -v /opt/vault/caddy-data:/data -v /opt/vault/caddy-config:/config caddy:${caddy_version}
ExecStop=/usr/bin/docker stop caddy

[Install]
WantedBy=multi-user.target
EOF

# Nightly backup: a consistent copy of the database (taken with SQLite's own backup, so it is safe
# while the server is running), then the whole data folder to S3.
cat > /usr/local/bin/vault-backup.sh <<'EOF'
#!/bin/bash
set -euo pipefail
ts=$(date -u +%Y%m%dT%H%M%SZ)
sqlite3 /opt/vault/data/db.sqlite3 ".backup '/opt/vault/data/db-backup.sqlite3'"
tar -C /opt/vault -czf /var/backups/vault/vault-$ts.tar.gz --exclude=data/icon_cache --exclude=data/tmp data
aws s3 cp /var/backups/vault/vault-$ts.tar.gz s3://${backup_bucket}/vault/vault-$ts.tar.gz --only-show-errors
find /var/backups/vault -type f -mtime +3 -delete
echo "backup ok: vault-$ts.tar.gz"
EOF
chmod 700 /usr/local/bin/vault-backup.sh

cat > /etc/systemd/system/vault-backup.service <<'EOF'
[Unit]
Description=Back up the password manager to S3

[Service]
Type=oneshot
ExecStart=/usr/local/bin/vault-backup.sh
EOF

cat > /etc/systemd/system/vault-backup.timer <<'EOF'
[Unit]
Description=Nightly password manager backup

[Timer]
OnCalendar=*-*-* 07:30:00 UTC
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now vault-network.service vaultwarden.service vault-caddy.service vault-backup.timer
