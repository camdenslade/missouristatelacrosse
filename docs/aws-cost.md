# AWS cost - findings & plan

## Progress (2026-08-30)

- **User deleted a 100 GiB EBS volume + stopped the versa-kimbu instance.** July's
  `EBS:VolumeUsage.gp3` was $11.20 = 140 GiB (40 live + that 100 GiB). Next month EBS
  drops to ~$3.20. Idle EIP ($2.63) also already gone. **Projected August: ~$24/mo**
  (down from the $40 Jun/Jul steady state), before any further changes.
- **Decided: t3.micro baseline + on-demand vertical scale-up for game nights** (no ALB,
  no autoscaling group - both cost more than the instance). Full detail:
  `docs/ec2-scaling.md`.
- **Box prepped for t3.micro** (live, reversible): 2 GB swapfile, Docker/containerd
  disabled (0 containers), journald capped at 100 MB, JVM bounded to `-Xmx256m` +
  SerialGC, systemd `MemoryMax=896M` + `Restart=always`. Box went from ~808 MB used to
  ~640 MB. Diagnostics: 0.00 CPU load, 146d uptime, never OOM'd, heap-used was 67 MB.
- **Built** `backend/scripts/scale-lax.sh` (`up`->t3.medium / `down`->t3.micro /
  `status`) + `scale-lax-iam-policy.json` (the one IAM permission `backenddeploy` is
  missing - `ec2:ModifyInstanceAttribute` scoped to the instance).

### Remaining for the user
1. Attach `scale-lax-iam-policy.json` to `backenddeploy`.
2. `./scale-lax.sh down` (first switch to t3.micro), watch it through one game night.
3. Console: add EC2 auto-recovery alarm (free).
4. Later: Compute Savings Plan sized to the t3.micro (~$0.004/hr, ~$1-2/mo more off).
5. Security cleanup: remove plaintext PayPal/Printify secrets from the systemd unit
   (app already reads them from Secrets Manager) and rotate them.
6. Decide on the stopped `versa-kimbu` instance + its 10 GiB volume (~$0.80/mo, not
   lacrosse).

---


Inventory taken 2026-08-30 with the `backenddeploy` IAM user (deploy-scoped, so
Cost Explorer / CloudWatch metrics / Route53 / ELB / RDS / ECS / Savings Plans calls
are all `AccessDenied` - those gaps are noted below). Account `390402548152`,
region `us-east-1`.

## Resources by project

Grouped by naming convention. The `backenddeploy` IAM user can enumerate EC2 / EBS /
EIP / ENI / SG / key pairs / snapshots / AMIs / S3 / CloudWatch Logs / ECR. It is
**blocked** from Lambda, CloudFront, DynamoDB, ECS, RDS, ELB, SNS, Secrets Manager,
Route53, Cost Explorer, Savings Plans - so anything in those services is invisible here
and needs an admin login to see.

### lacrosse  (~$18/mo)
| Kind | Id / name | Notes |
|---|---|---|
| EC2 | `i-0800e9fce88ebd384` "lacrosse-backend" | t3.small, running, us-east-1c |
| EBS | `vol-0df811d280fc673c2` | 30 GiB gp3, attached to above |
| Elastic IP | `34.194.0.119` (`eipassoc-079e7423fc91d27a2`) | = api.missouristatelacrosse.com, attached (free) |
| ENI | `eni-00b6be9ae1e4d53ee` | attached to the instance |
| Key pair | `laxsite-key` | matches `backend/laxsite-key.pem` |
| Security group | `launch-wizard-2` (`sg-03c5d35babdb32da8`) | on the instance |
| S3 | `mostatelacrosse-general-images` | 587 objects, 6.9 GB, no lifecycle |
| S3 | `elasticbeanstalk-us-east-1-390402548152` | **orphaned** - 0 objects, left from the dead EB env |
| CloudWatch Logs | `/aws/elasticbeanstalk/laxsite-backend-env/*` (9 groups) | **orphaned** - all 0 bytes, 7-day retention |

### versa / kimbu  (not lacrosse)
| Kind | Id / name | Notes |
|---|---|---|
| EC2 | `i-0d97e4b281fa10400` "versa-kimbu" | t3.small, **stopped** (no compute cost) |
| EBS | `vol-01ccefddb2d581c1c` | 10 GiB gp3, attached - still bills ~$0.80/mo while stopped |
| ENI | `eni-076943995f966249c` | attached to the stopped instance |
| Key pair | `versa-kimbu` | |
| Security group | `versa-kimbu-sg` (`sg-0aa44d42a228322f6`) | |
| CloudWatch Logs | `/ecs/kimbu-auth` (0.4 MB), `/ecs/versa-relay` (0.8 MB) | retention = never expire; **implies ECS/Fargate tasks** not visible to this user |

### tabup  (not lacrosse)
| Kind | Id / name | Notes |
|---|---|---|
| S3 | `tabup-images` | |
| Key pair | `tabup-key` | |
| ECR repo | `tabup-api` | container image repo -> **implies ECS/Fargate** not visible here |
| Security group | `launch-wizard-1` (`sg-089c0d073bee8af07`) | not attached to any running instance - likely tabup leftover |

### shared / account-level
| Kind | Id | Notes |
|---|---|---|
| VPC | `vpc-030c3eb8609e5e2aa` (default, 172.31.0.0/16) | everything runs here |
| Security group | `default` (`sg-0fbd01e7daccb25c7`) | also attached to lacrosse instance |
| IAM user | `backenddeploy` | deploy credentials used for this inventory + CI |
| IAM instance profile | `ec2-role` | assumed by the lacrosse box for SES / S3 / Secrets Manager |

**Not found anywhere:** RDS, NAT gateways, load balancers (ELB/ALB), custom AMIs, EBS
snapshots, custom VPCs. (RDS/ELB would be invisible to this user, but no security group
allows 5432 and no subnet routes suggest a NAT, so lacrosse almost certainly has none.)

**Invisible to this IAM user - check with an admin login:** the ECS clusters/services
behind `/ecs/kimbu-auth`, `/ecs/versa-relay`, and `tabup-api` (Fargate tasks are a
per-second charge and could be the bulk of the account bill); any Lambda, CloudFront,
DynamoDB; Route53 zones; existing Savings Plans / RIs.

## What's actually running (lacrosse)

| Resource | Detail | ~$/mo |
|---|---|---|
| EC2 `i-0800e9fce88ebd384` "lacrosse-backend" | `t3.small`, on-demand, us-east-1c, EIP `34.194.0.119` (= `api.missouristatelacrosse.com`) | **~15.20** |
| EBS `vol-0df811d280fc673c2` | 30 GiB gp3 (3000 IOPS / 125 MB/s baseline = free tier of gp3) | ~2.40 |
| Elastic IP | attached to the running instance | 0.00 |
| S3 `mostatelacrosse-general-images` | 587 objects, **6.9 GB**, no lifecycle, versioning off | ~0.16 storage |
| CloudWatch Logs | small | ~0 |
| **Lacrosse subtotal** | | **~$18/mo** |

**No RDS** - Postgres runs on the EC2 box itself (no security group anywhere allows
5432 inbound; the app connects to localhost). **No NAT gateway. No load balancer.**
nginx on the instance terminates TLS directly.

**Elastic Beanstalk is already gone** - `describe-environments` and
`describe-applications` both return `[]`. The `laxsite-backend-env` CloudWatch log
groups and the `elasticbeanstalk-us-east-1-390402548152` S3 bucket (0 objects) are
orphaned leftovers. This is why the `firebase.json` `/api` rewrite pointed at a
non-resolving URL (fixed in the professionalization pass - now points at the EC2 host).

## Not lacrosse (same account, other projects - flagged, not touched)

- EC2 `i-0d97e4b281fa10400` "versa-kimbu" - `t3.small`, **stopped** (no compute cost),
  but its 10 GiB gp3 volume still bills ~$0.80/mo.
- S3 `tabup-images`, CloudWatch `/ecs/kimbu-auth` + `/ecs/versa-relay` (retention
  "never expire") - there is ECS/Fargate somewhere for versa/kimbu that this IAM user
  can't see. **If the real monthly bill is well above ~$20, the difference is almost
  certainly versa/kimbu/tabup, not lacrosse.** Check Cost Explorer with an admin login.

## Recommendations, ranked by $ saved / risk

### 1. Compute Savings Plan on the t3.small - do this first
1-year, no-upfront Compute Savings Plan covering ~$0.011/hr of compute. Drops the
t3.small from ~$15.20 to **~$10.90/mo**. **Saves ~$4.30/mo. Zero migration, zero
downtime, fully reversible at renewal.** Only commitment is 1 year.
Console: Billing -> Savings Plans -> Purchase -> Compute, 1yr, No upfront, hourly
commitment ~$0.011. (Requires an admin login - `backenddeploy` can't buy it.)

### 2. Downsize t3.small -> t3.micro - biggest single saving, needs a window
`t3.micro` (1 GiB RAM) = **~$7.60/mo** (saves ~$7.60 vs t3.small; ~$3.30 on top of the
Savings Plan). Risk: Postgres + Spring Boot + JVM on 1 GiB is tight. Before switching:
- add a 2 GiB swapfile on the box
- set `JAVA_TOOL_OPTIONS="-Xmx512m -XX:MaxMetaspaceSize=128m"` in the systemd unit
- Postgres `shared_buffers=128MB`, `max_connections=20`
Then: stop instance -> change instance type -> start. Reversible in minutes.
Traffic is a low-volume club site, so 1 GiB is plausible - but verify with `free -m`
and a load test before calling it done. **Get CloudWatch mem/CPU history first**
(admin login) to de-risk.

### 3. Graviton (t4g) - only worth it if rebuilding the box anyway
`t4g.small` ~$12.25/mo or `t4g.micro` ~$6.15/mo. ~20% cheaper than the t3 equivalent.
Requires a fresh arm64 instance and migrating Postgres data + app + nginx + certs +
systemd (~1-2 hrs). The JVM is arch-neutral (Corretto has arm64). For a club site the
extra ~$1.50-3/mo saving over options 1+2 probably isn't worth the migration unless
you're rebuilding the instance for another reason.

### 4. Move streaming off EC2 egress -> YouTube (separate workstream)
Serving HLS video from the EC2 box is the one variable cost that can spike ($0.09/GB
egress after the first 100 GB/mo). If games get streamed regularly this can dwarf the
compute line. The YouTube migration removes it entirely. Tracked separately.

### 5. Housekeeping (near-$0, but do it)
- Delete the 8 orphaned `/aws/elasticbeanstalk/laxsite-backend-env/*` CloudWatch log
  groups.
- Delete the empty `elasticbeanstalk-us-east-1-390402548152` S3 bucket.
- Add an S3 lifecycle rule on `mostatelacrosse-general-images`: transition objects
  older than 90 days to `STANDARD_IA` (cheaper), and abort incomplete multipart
  uploads after 7 days. Storage is only ~$0.16/mo today so the saving is tiny, but the
  incomplete-multipart rule is free insurance.

### 6. The real image problem (perf + egress, not storage)
`men/galleries/media-day-2026/` contains ~**38 MB full-resolution DSLR JPEGs**, and
each appears **3x** (three upload batches - timestamps `17719604...`, `17719611...`,
`17719612...`). The frontend `<img src>`s presigned originals directly, so every
gallery view downloads tens of MB per photo. Fix:
- de-dupe the triplicates
- run gallery uploads through the existing `uploadCompressedImage()` path (or a
  server-side resize), cap long edge at ~2000px / ~400 KB
- consider serving a `?width=` thumbnail variant
This is a UX + egress fix, not a storage-cost fix.

## Bottom line

Lacrosse is already a lean footprint (~$18/mo: one small on-demand box + a disk).
Realistic target after **#1 + #2**: **~$8/mo for lacrosse.** The bigger opportunity, if
the total account bill is much higher than that, is auditing the versa/kimbu/tabup ECS
resources with an admin login - this deploy user can't see them.

## What needs an admin login (this IAM user is blocked)

- Cost Explorer breakdown by service (confirm the lacrosse vs other-projects split)
- CloudWatch CPU/memory history for `i-0800e9fce88ebd384` (de-risk the t3.micro move)
- Buy the Compute Savings Plan
- Route53 hosted zones (confirm none - DNS is on Cloudflare, so there likely is none)
- ECS/Fargate inventory for versa/kimbu
