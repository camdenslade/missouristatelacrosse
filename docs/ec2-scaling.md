# EC2 sizing & game-night scaling

The backend runs on **one EC2 instance** (`i-0800e9fce88ebd384`, `lacrosse-backend`,
Elastic IP `34.194.0.119` = `api.missouristatelacrosse.com`). Postgres, nginx (TLS),
MediaMTX (RTMP/HLS) and the Spring Boot jar all run on it via systemd. There is no load
balancer, no RDS, no autoscaling group - and adding them would cost more than the whole
instance, so the plan is **vertical, on-demand**:

- **Normal:** `t3.micro` (1 GiB) - ~$7.60/mo
- **Anticipated high load** (game night stream + chat): resize to `t3.medium` (4 GiB)
  an hour before, resize back the next day. ~$2/mo of extra usage.

## The safety net (applied 2026-08-30, makes 1 GiB safe)

Live diagnostics showed the box idles at ~0.00 CPU, has never been OOM-killed in 146
days, and the JVM was using **67 MB of heap** out of a 499 MB default cap. So:

| Change | Where | Revert |
|---|---|---|
| 2 GB swapfile, `vm.swappiness=10` | `/swapfile`, `/etc/fstab`, `/etc/sysctl.d/99-swap.conf` | `sudo swapoff /swapfile && sudo rm /swapfile`, drop the fstab + sysctl lines |
| Disabled Docker + containerd (0 containers were running) | `systemctl` | `sudo systemctl enable --now containerd docker` |
| journald capped at 100 MB | `/etc/systemd/journald.conf.d/size.conf` | delete the file, `systemctl restart systemd-journald` |
| JVM bounded + systemd cgroup limits | `/etc/systemd/system/laxsite-backend.service.d/10-resources.conf` | delete the file, `sudo systemctl daemon-reload && sudo systemctl restart laxsite-backend` |

The drop-in sets: `JAVA_TOOL_OPTIONS=-Xms128m -Xmx256m -XX:+UseSerialGC
-XX:MaxMetaspaceSize=192m -XX:ReservedCodeCacheSize=96m -Xss512k
-XX:MaxDirectMemorySize=64m -XX:+ExitOnOutOfMemoryError -XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/home/ec2-user/oom.hprof`, plus `MemoryHigh=768M`, `MemoryMax=896M`
(hard ceiling for the backend cgroup only - if the JVM ever runs away, systemd
stops+restarts just the backend; Postgres and nginx are untouched), and
`Restart=always` was already set.

After all of this the box sits at **~640 MB used** (was ~808). On a t3.micro that
leaves ~380 MB for cache/headroom, backed by the 2 GB swapfile.

## Resizing: `backend/scripts/scale-lax.sh`

```
./scale-lax.sh up       # -> t3.medium  (run ~1 hr before the event)
./scale-lax.sh down     # -> t3.micro   (run the next day)
./scale-lax.sh status   # show current type/state
```

Each resize stops the instance, changes the type, starts it, and waits for
`/actuator/health` to go green - **~2-3 minutes of downtime**. Overridable via env vars
(`LAX_BIG_TYPE`, `LAX_SMALL_TYPE`, `LAX_INSTANCE_ID`, ...).

### One-time IAM setup

The `backenddeploy` user can describe and stop instances but not resize them. Attach
`backend/scripts/scale-lax-iam-policy.json` as an inline policy:

```
aws iam put-user-policy --user-name backenddeploy \
  --policy-name laxsite-scale \
  --policy-document file://backend/scripts/scale-lax-iam-policy.json
```

(or paste it in the IAM console). It grants `Stop/Start/ModifyInstanceAttribute` on
**only** that one instance, plus `DescribeInstances`.

## First switch to t3.micro (you, console or CLI)

Once the IAM policy is on:

```
./scale-lax.sh down
```

Then watch it through one real game night. If `free -m` on the box shows `available`
under ~120 MB or swap `used` climbing past ~500 MB during the event, either keep it on
`t3.medium` for events (via `scale-lax.sh up`) or move to `t4g.small` permanently.

## Recommended console add-ons (free, ~5 min)

1. **EC2 auto-recovery** - EC2 console -> the instance -> Actions -> Monitor and
   troubleshoot -> Manage CloudWatch alarms -> add the default
   *"Recover this instance"* alarm on `StatusCheckFailed_System`.
2. **Memory alarm** - needs the CloudWatch agent (not currently installed). Optional;
   without it you still get CPU + status-check alarms. If you want memory alerts,
   install `amazon-cloudwatch-agent`, publish `mem_used_percent`, alarm at > 85% for
   10 min -> SNS email.

## If game nights are on a fixed schedule

Instead of running the script by hand, an EventBridge Scheduler rule can call a tiny
Lambda that does the same stop/resize/start. Worth setting up only if the schedule is
predictable and recurring; otherwise the manual script is simpler.

## Related follow-ups (not done here)

- The systemd unit still has `PAYPAL_CLIENT_SECRET` and `PRINTIFY_API_TOKEN` in
  **plaintext** `Environment=` lines, and the app *also* loads them from AWS Secrets
  Manager. Remove the `Environment=` lines and rotate both credentials.
- `GOOGLE_APPLICATION_CREDENTIALS=firebase-service-account` in the unit looks wrong (it
  should be a file path); Firebase currently initializes from Secrets Manager instead,
  so it's inert - clean it up.
