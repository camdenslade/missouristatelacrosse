#!/bin/bash
# First-boot setup for the team password manager (Vaultwarden) and document store (Nextcloud),
# both behind the same Caddy, sharing one small server. Runs once as root.
# Rendered by Terraform: domains, admin_cidr, backup_bucket and the image versions are filled in.
set -euxo pipefail

dnf install -y docker sqlite
systemctl enable --now docker

mkdir -p /opt/vault/data /opt/vault/caddy-data /opt/vault/caddy-config /etc/vault /var/backups/vault

# The document store's data lives on its own attached disk, never on the same volume as the
# password vault's database. Find it by elimination (the root disk's parent device, excluded),
# since Nitro instances expose EBS volumes as /dev/nvme*n1 regardless of the device name Terraform
# requested, so a hardcoded device path would be wrong here.
mkdir -p /opt/nextcloud/html
ROOT_DISK=$(lsblk -ndo PKNAME "$(findmnt -n -o SOURCE /)")
DATA_DEV="/dev/$(lsblk -ndo NAME,TYPE | awk -v root="$ROOT_DISK" '$2=="disk" && $1!=root {print $1; exit}')"
if ! blkid "$DATA_DEV" >/dev/null 2>&1; then
  mkfs -t xfs "$DATA_DEV"
fi
mountpoint -q /opt/nextcloud/html || mount "$DATA_DEV" /opt/nextcloud/html
DATA_UUID=$(blkid -s UUID -o value "$DATA_DEV")
grep -q "$DATA_UUID" /etc/fstab || echo "UUID=$DATA_UUID /opt/nextcloud/html xfs defaults,nofail 0 2" >> /etc/fstab

# A one-time admin password for the document store. Log in, change it immediately, and store the
# new one in Vaultwarden - this file is only so the first login is possible.
NEXTCLOUD_ADMIN_PASSWORD=$(openssl rand -base64 24)
mkdir -p /etc/vault
echo "$NEXTCLOUD_ADMIN_PASSWORD" > /etc/vault/nextcloud-admin-password.txt
chmod 600 /etc/vault/nextcloud-admin-password.txt

cat > /etc/vault/nextcloud.env <<EOF
SQLITE_DATABASE=nextcloud
NEXTCLOUD_ADMIN_USER=admin
NEXTCLOUD_ADMIN_PASSWORD=$NEXTCLOUD_ADMIN_PASSWORD
NEXTCLOUD_TRUSTED_DOMAINS=${docs_domain}
OVERWRITEPROTOCOL=https
TRUSTED_PROXIES=172.16.0.0/12
EOF
chmod 600 /etc/vault/nextcloud.env

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

mkdir -p /opt/vault/data/templates/scss

# Brand the web vault with the team logo (documented override point:
# https://github.com/dani-garcia/vaultwarden/wiki/Customize-Vaultwarden-CSS). Points at the
# live site's logo asset rather than a copy, so it stays in sync automatically. Full color
# re-theming isn't attempted here - Bitwarden's web client doesn't expose a stable, documented
# variable for it, so hand-guessed selectors would just break on the next Vaultwarden upgrade.
cat > /opt/vault/data/templates/scss/user.vaultwarden.scss.hbs <<'EOF'
$logo-default: url('https://missouristatelacrosse.com/missouri-state.png');
$logo-admin:   url('https://missouristatelacrosse.com/missouri-state.png');

@mixin hide-element { display: none !important; }

app-root img.new-logo-themed { content: $logo-default !important; }

auth-anon-layout bit-landing-header bit-svg {
  > svg { @include hide-element; }
  &::before {
    display: block !important;
    content: "" !important;
    width: 100% !important;
    height: 42px !important;
    background: $logo-default no-repeat center left !important;
    background-size: contain !important;
  }
}

bit-nav-logo bit-svg {
  > svg { @include hide-element; }
  &::before {
    display: block !important;
    content: "" !important;
    width: 100% !important;
    height: 42px !important;
    background-repeat: no-repeat !important;
    background-size: auto 42px !important;
    background-position: center left !important;
  }
}

app-user-layout bit-nav-logo bit-svg::before { background-image: $logo-default !important; }
app-organization-layout bit-nav-logo bit-svg::before { background-image: $logo-admin !important; }

#bit-side-nav[style*="4.5rem"] bit-nav-logo bit-svg::before { display: none !important; }
EOF

cat > /etc/vault/Caddyfile <<'EOF'
${domain} {
    @blocked not remote_ip ${admin_cidr}
    respond @blocked "Not available" 403

    encode zstd gzip
    reverse_proxy vaultwarden:80
}

${docs_domain} {
    @blocked not remote_ip ${admin_cidr}
    respond @blocked "Not available" 403

    encode zstd gzip
    reverse_proxy nextcloud:80
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

cat > /etc/systemd/system/nextcloud.service <<'EOF'
[Unit]
Description=Nextcloud (document store)
After=vault-network.service
Requires=vault-network.service

[Service]
Restart=always
RestartSec=5
ExecStartPre=-/usr/bin/docker rm -f nextcloud
ExecStart=/usr/bin/docker run --rm --name nextcloud --network vault --env-file /etc/vault/nextcloud.env -v /opt/nextcloud/html:/var/www/html nextcloud:${nextcloud_version}
ExecStop=/usr/bin/docker stop nextcloud

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/vault-caddy.service <<'EOF'
[Unit]
Description=Caddy (HTTPS in front of Vaultwarden and Nextcloud)
After=vaultwarden.service nextcloud.service
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

# Nightly backup: a consistent copy of each database (taken with SQLite's own backup, so it is
# safe while the servers are running), then both data folders to S3.
cat > /usr/local/bin/vault-backup.sh <<'EOF'
#!/bin/bash
set -euo pipefail
ts=$(date -u +%Y%m%dT%H%M%SZ)
sqlite3 /opt/vault/data/db.sqlite3 ".backup '/opt/vault/data/db-backup.sqlite3'"
tar -C /opt/vault -czf /var/backups/vault/vault-$ts.tar.gz --exclude=data/icon_cache --exclude=data/tmp data
aws s3 cp /var/backups/vault/vault-$ts.tar.gz s3://${backup_bucket}/vault/vault-$ts.tar.gz --only-show-errors

sqlite3 /opt/nextcloud/html/data/nextcloud.db ".backup '/opt/nextcloud/html/data/nextcloud-backup.db'" || true
tar -C /opt/nextcloud -czf /var/backups/vault/nextcloud-$ts.tar.gz --exclude=html/data/appdata_*/preview html
aws s3 cp /var/backups/vault/nextcloud-$ts.tar.gz s3://${backup_bucket}/vault/nextcloud-$ts.tar.gz --only-show-errors

find /var/backups/vault -type f -mtime +3 -delete
echo "backup ok: vault-$ts.tar.gz, nextcloud-$ts.tar.gz"
EOF
chmod 700 /usr/local/bin/vault-backup.sh

cat > /etc/systemd/system/vault-backup.service <<'EOF'
[Unit]
Description=Back up the password manager and document store to S3

[Service]
Type=oneshot
ExecStart=/usr/local/bin/vault-backup.sh
EOF

cat > /etc/systemd/system/vault-backup.timer <<'EOF'
[Unit]
Description=Nightly password manager and document store backup

[Timer]
OnCalendar=*-*-* 07:30:00 UTC
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now vault-network.service vaultwarden.service nextcloud.service vault-caddy.service vault-backup.timer
