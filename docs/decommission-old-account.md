# Retiring the old AWS account's lacrosse resources

Everything the site needs now lives in the org account (864145505327). The old account
(390402548152) still holds leftovers. This is the checklist, written 2026-09-19.

The old account also holds other projects (an instance named `versa-kimbu`, a `tabup-images`
bucket and an empty Elastic Beanstalk bucket). They are not part of the lacrosse site. Leave them.

## Done

- Old backend service stopped 2026-09-18, and the DNS moved to the new server.
- The old server (`lacrosse-backend`, `i-0800e9fce88ebd384`) was stopped on 2026-09-19. Stopped
  costs nothing for compute and can be started again if ever needed.
- Its remaining state is archived and verified in the new account, in the private backup bucket
  under `archive/old-server-2026-09-19/`: a final database dump and a tarball of its nginx,
  MediaMTX and systemd configuration and old local dumps. The `.env` file was left out on purpose
  (it holds secrets); every setting in it exists in the new secret.
- The 6.9 GB image bucket was copied to the new account and every object verified.
- Nothing irreplaceable was on the box: its recordings folder was empty and its database is a
  13 MB copy of what is now in the new account.

## To do in the old account (console, not scriptable from here)

Wait about a week after 2026-09-19 so any surprise has time to show. Then, in this order:

| Step | What | Notes |
|---|---|---|
| 1 | Terminate the instance `lacrosse-backend` (`i-0800e9fce88ebd384`) | Its 30 GB disk is deleted with it |
| 2 | Release the Elastic IP `34.194.0.119` (`eipalloc-023c166bc63535768`) | An unattached IP is billed |
| 3 | Delete the 7 daily disk snapshots, and the snapshot policy `policy-0acce6aad21afa825` | Optional safety net for the first couple of weeks. They hold the old disk, so do not keep them for long |
| 4 | Empty and delete the bucket `mostatelacrosse-general-images` | Everything was copied. If you want the old nightly database history, download `db-backups/` first |
| 5 | Secrets Manager: delete `backend-prod` and `firebase-service-account` | They hold live payment keys, so remove them rather than leave them lying around |
| 6 | SES: remove the `missouristatelacrosse.com` identity | Sending now goes through the new account |
| 7 | Delete any lacrosse alarms, Lambda health check, SNS topic or budget | Anything named for lacrosse |
| 8 | IAM: deactivate then delete the `backenddeploy` user's access keys | Also remove those keys from your `~/.aws/credentials` `default` profile and from GitHub secrets |

## Cloudflare (DNS for missouristatelacrosse.com)

**Delete now** (old account's email signing, no longer used):

- CNAME `6wsw2bkyqrycg3qlrvk4ikfchk2gqazm._domainkey`
- CNAME `p5oomta7cdv6dgadquvy3ql74cctjeav._domainkey`
- CNAME `wpndmqfvwvxpeeochxlpudjfk2ffmxs2._domainkey`

**Delete after step 8 above** (validation for a certificate in the old account):

- CNAME `_89aa56331070d90646b82fbec255c35c.api`

**Delete after removing the domains from Firebase Hosting** (Firebase console, Hosting, remove
custom domains `missouristatelacrosse.com` and `www`):

- TXT `missouristatelacrosse.com` with value `hosting-site=missouristatelacrosse-cc913`

**Keep. Deleting any of these breaks something:**

- The two certificate validation CNAMEs `_779b594ff47958fc29da3c3edcecfd55` and
  `_762f977da83bba33a729d47487f0f0cd.www`. The new HTTPS certificate renews using them.
- The three current DKIM CNAMEs `ojrjxtqeisy2plaglzxewagzskbqatkq`, `g3ccoqhduyldaydob3y5hfqzhg3dlltu`
  and `3yq6rgzm6h2vb6cpnniokhri43dzzvqz` (all under `_domainkey`), and the `no-reply` MX and TXT.
- `api` (A), `vault` (A), and the apex and `www` CNAMEs pointing at CloudFront.
- Everything for Outlook and Microsoft (MX, `autodiscover`, `enterprise*`, `MS=` TXT, SPF), the
  Stripe records, `google-site-verification`, and the DMARC records.

Optional email hardening for later: `_dmarc` is `p=none` (monitor only). Once you are confident all
legitimate mail passes, moving to `p=quarantine` makes spoofing your domain harder.

## Also outstanding

- Backend deploys from GitHub now go through Systems Manager (no SSH). Delete the unused repository
  secrets `EC2_HOST`, `EC2_USER` and `EC2_SSH_KEY`.
- Firebase: once everyone has signed in through Cognito, retire the Firebase login (see
  `docs/cognito-migration-plan.md`) and delete the Firebase project's Hosting.
