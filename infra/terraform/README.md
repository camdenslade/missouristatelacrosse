# Infrastructure as code

Everything in the Missouri State Lacrosse AWS account (864145505327, us-east-1) is described here.
`terraform plan` reports "No changes" when the code and the account agree, which is the normal
state. If it shows changes you did not make, someone edited the account by hand.

## Using it

```
export AWS_PROFILE=org          # the org account profile (see docs/HANDOFF.md)
cd infra/terraform
terraform init                  # first time only
terraform plan                  # shows what would change; changes nothing
terraform apply                 # makes the changes, after showing them and asking
```

Read every `plan` before applying. Anything marked "must be replaced" or "destroyed" needs a
second look: replacing the Cognito app client or the instance would take the site down.

Terraform 1.10 or newer. State is in the private `mostatelax-prod-tfstate` bucket (versioned and
encrypted), with locking, so two people cannot apply at once.

## What is here

| File | What it defines |
|---|---|
| `compute.tf` | The backend EC2 instance, its fixed IP, firewall, and daily snapshots |
| `iam.tf` | Every role and what it may do, including the GitHub deploy role |
| `storage.tf` | The four S3 buckets and the empty secret containers |
| `monitoring.tf` | Health-check Lambda, uptime alarm, alert topic, monthly budget |
| `email.tf` | The verified sending domain in SES |
| `auth.tf` | Cognito user pool, app client, and the Firebase migration Lambda |
| `website.tf` | The certificate, CloudFront, and its cache and header rules |
| `vault.tf` | The team password manager server (Vaultwarden), see below |
| `lambda/healthcheck/` | Source of the uptime Lambda |
| `../cognito-migrate/` | Source of the sign-in migration Lambda |

## What is deliberately not here

- **The human IAM user and the near-root `DO-NOT-ASSIGN` policy.** They are what runs Terraform, so
  Terraform should not be able to change them.
- **Secret values.** Only the empty containers are managed. Payment keys, the database password and
  the Firebase service account are entered in the Secrets Manager console and never touch git.
- **DNS.** It is in Cloudflare. Two things there depend on this stack: the certificate validation
  CNAMEs (`terraform output certificate_validation_records`) and the apex and `www` CNAMEs that point
  at `terraform output cloudfront_domain`.
- **SES production access.** That is an account-level approval from AWS Support, not a resource.
- **The SSH key pair** (`mostatelax-prod-key`): AWS does not return the key, so it is referenced by
  name only. The private key is kept offline.

## Changing common things

- **Your home IP changed and SSH stopped working:** set `admin_ssh_cidr` (in `compute.tf`, or pass
  `-var admin_ssh_cidr=1.2.3.4/32`) and apply.
- **Deploy the website:** that is the GitHub workflow, not Terraform. Terraform only defines where it
  goes.
- **Retire Firebase sign-in:** delete the `lambda_config` block in `auth.tf`, then the migration
  Lambda and its role and permission.

## Known gaps worth fixing

1. **The database volume is not encrypted.** Fixing it means replacing the volume (snapshot, encrypted
   copy, swap), which needs a short outage, so it was left as found. See the note in `compute.tf`.
2. **CPU credits are `unlimited`.** A busy instance can burst past its credits and be billed for it.
   Switch to `standard` if the bill surprises you.
3. **RTMP (port 1935) is open to the world.** Streaming needs it, but it should be limited to known
   encoders or gated by stream keys at the media server.
4. **Uptime monitoring only checks the API.** Nothing watches the website itself.
5. **Single server.** The backend, database and streaming server share one machine. The nightly
   dump and daily snapshots are the recovery path; a restore has been rehearsed but not on a
   schedule.

## Password manager (Vaultwarden)

Runs at https://vault.missouristatelacrosse.com on its own small server (`mostatelax-prod-vault`),
about $11 a month. It has no SSH and its admin panel is disabled. Contents are encrypted in each
person's browser, so the server and its backups never hold readable passwords.

- **Add an officer:** in the web vault, open the organization, then Members, then Invite. They
  register with the same email address. Public sign-up is off, and no email is sent (there is no
  mail server configured), so tell them directly.
- **Server access:** through AWS Systems Manager, not SSH. Console: Systems Manager, Session
  Manager. The DNS record is `vault` (A) pointing at `terraform output vault_public_ip`.
- **Backups:** nightly at 07:30 UTC to `s3://mostatelax-prod-backups/vault/` (kept 35 days), plus the
  daily disk snapshot. To restore, unpack a backup into `/opt/vault/data` and restart the
  `vaultwarden` service.
- **Upgrade:** change `vaultwarden_version` in `vault.tf`, then on the server run
  `docker pull vaultwarden/server:<version>` and `systemctl restart vaultwarden`. Terraform does not
  redeploy the server when versions change (first-boot settings only apply when it is created).
- **Rebuilding from scratch:** a new server starts with sign-ups open and the site limited to
  `admin_ssh_cidr`, so the first account can be created safely. Then close sign-ups by setting
  `SIGNUPS_ALLOWED=false` in `/etc/vault/vaultwarden.env`, drop the `remote_ip` rule from
  `/etc/vault/Caddyfile`, and restart the `vaultwarden` and `vault-caddy` services.
