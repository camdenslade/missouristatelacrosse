#!/bin/bash
# One-time maintenance job: replaces the prod backend's unencrypted root volume with an
# encrypted copy. Run from a machine with AWS CLI + `--profile org` access (NOT on the server
# itself - it stops the instance and swaps its own boot volume). Causes a real outage: API,
# staging backend and both databases are down while the instance is stopped (typically 3-6
# minutes). The website's static pages stay up (CloudFront/S3), only /api/* calls fail.
#
# Safety: the OLD volume is only detached, never deleted. If the new volume fails to boot
# healthy, the script re-attaches the old one automatically. If it succeeds, the old volume is
# left around (stopped, unattached, still billed a few cents/month) for a few days as a manual
# fallback - delete it by hand once you've confirmed everything is solid.
#
# Ran once already on 2026-09-20 against mostatelax-prod-backend. It aborted partway through
# (see the MSYS_NO_PATHCONV note below) and was finished by hand; this version has that fixed,
# for whenever a volume needs encrypting again (e.g. a freshly built instance).
set -euo pipefail

# On Windows Git Bash, MSYS silently rewrites args that look like Unix paths (like /dev/xvda)
# into Windows paths, which breaks the --device value passed to attach-volume. This must be set
# before any `aws` calls below. Harmless on real Unix shells.
export MSYS_NO_PATHCONV=1

REGION=us-east-1
PROFILE=org
INSTANCE_ID=i-0a9fa6a3486e95c86
OLD_VOLUME_ID=vol-06c94e75f4f5272ef
DEVICE_NAME=/dev/xvda
AZ=us-east-1c
HEALTH_URL=https://api.missouristatelacrosse.com/actuator/health
WAIT_HEALTHY_SECONDS=180

aws() { command aws --profile "$PROFILE" --region "$REGION" "$@"; }

log() { echo "[$(date -u +%H:%M:%S)] $*"; }

wait_healthy() {
  for _ in $(seq 1 $((WAIT_HEALTHY_SECONDS / 5))); do
    if curl -sf --max-time 4 "$HEALTH_URL" | grep -q '"status":"UP"'; then
      return 0
    fi
    sleep 5
  done
  return 1
}

# --- sanity checks: refuse to run against the wrong resource ---
actual_name=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].Tags[?Key==`Name`]|[0].Value' --output text)
[ "$actual_name" = "mostatelax-prod-backend" ] || { echo "REFUSING: instance name mismatch ($actual_name)"; exit 1; }
attached=$(aws ec2 describe-volumes --volume-ids "$OLD_VOLUME_ID" \
  --query 'Volumes[0].Attachments[0].InstanceId' --output text)
[ "$attached" = "$INSTANCE_ID" ] || { echo "REFUSING: volume is not attached to the expected instance"; exit 1; }
already_encrypted=$(aws ec2 describe-volumes --volume-ids "$OLD_VOLUME_ID" --query 'Volumes[0].Encrypted' --output text)
[ "$already_encrypted" = "False" ] || { echo "Volume is already encrypted ($already_encrypted). Nothing to do."; exit 0; }
VOL_SIZE=$(aws ec2 describe-volumes --volume-ids "$OLD_VOLUME_ID" --query 'Volumes[0].Size' --output text)
VOL_TYPE=$(aws ec2 describe-volumes --volume-ids "$OLD_VOLUME_ID" --query 'Volumes[0].VolumeType' --output text)
VOL_IOPS=$(aws ec2 describe-volumes --volume-ids "$OLD_VOLUME_ID" --query 'Volumes[0].Iops' --output text)
VOL_THROUGHPUT=$(aws ec2 describe-volumes --volume-ids "$OLD_VOLUME_ID" --query 'Volumes[0].Throughput' --output text)

log "starting: instance=$INSTANCE_ID old_volume=$OLD_VOLUME_ID size=${VOL_SIZE}GB type=$VOL_TYPE"

# --- 1. snapshot the current (running) volume, wait for it, copy it encrypted ---
log "snapshotting current volume"
SNAP_ID=$(aws ec2 create-snapshot --volume-id "$OLD_VOLUME_ID" \
  --description "Pre-encryption snapshot of $OLD_VOLUME_ID ($(date -u +%Y-%m-%d))" \
  --tag-specifications "ResourceType=snapshot,Tags=[{Key=Name,Value=mostatelax-prod-backend-pre-encrypt}]" \
  --query SnapshotId --output text)
aws ec2 wait snapshot-completed --snapshot-ids "$SNAP_ID"
log "snapshot $SNAP_ID ready, copying with encryption"
ENC_SNAP_ID=$(aws ec2 copy-snapshot --source-region "$REGION" --source-snapshot-id "$SNAP_ID" \
  --encrypted --description "Encrypted copy of $SNAP_ID" --query SnapshotId --output text)
aws ec2 wait snapshot-completed --snapshot-ids "$ENC_SNAP_ID"
log "encrypted snapshot $ENC_SNAP_ID ready"

# --- 2. build the new encrypted volume from it, in the same AZ ---
NEW_VOLUME_ID=$(aws ec2 create-volume --availability-zone "$AZ" --snapshot-id "$ENC_SNAP_ID" \
  --volume-type "$VOL_TYPE" --iops "$VOL_IOPS" --throughput "$VOL_THROUGHPUT" \
  --tag-specifications "ResourceType=volume,Tags=[{Key=Name,Value=mostatelax-prod-backend},{Key=SnapshotPolicy,Value=daily}]" \
  --query VolumeId --output text)
aws ec2 wait volume-available --volume-ids "$NEW_VOLUME_ID"
log "new encrypted volume $NEW_VOLUME_ID ready"

# --- 3. the outage window: stop, swap, start ---
log "stopping the instance (outage begins)"
aws ec2 stop-instances --instance-ids "$INSTANCE_ID" >/dev/null
aws ec2 wait instance-stopped --instance-ids "$INSTANCE_ID"

log "detaching the old volume"
aws ec2 detach-volume --volume-id "$OLD_VOLUME_ID" >/dev/null
aws ec2 wait volume-available --volume-ids "$OLD_VOLUME_ID"

log "attaching the new encrypted volume"
aws ec2 attach-volume --volume-id "$NEW_VOLUME_ID" --instance-id "$INSTANCE_ID" --device "$DEVICE_NAME" >/dev/null
aws ec2 wait volume-in-use --volume-ids "$NEW_VOLUME_ID"
aws ec2 modify-instance-attribute --instance-id "$INSTANCE_ID" \
  --block-device-mappings "[{\"DeviceName\":\"$DEVICE_NAME\",\"Ebs\":{\"DeleteOnTermination\":true}}]"

log "starting the instance"
aws ec2 start-instances --instance-ids "$INSTANCE_ID" >/dev/null
aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"

log "waiting for the API to report healthy (up to ${WAIT_HEALTHY_SECONDS}s)"
if wait_healthy; then
  log "SUCCESS: new encrypted volume is live and healthy. Outage over."
  log "Old volume $OLD_VOLUME_ID is detached but NOT deleted - a safety net. Delete it by hand"
  log "in a few days once you've confirmed everything is solid (EC2 console -> Volumes)."
  log "Snapshots $SNAP_ID and $ENC_SNAP_ID are also left behind; safe to delete once comfortable."
  exit 0
fi

log "FAILED: new volume did not come up healthy within ${WAIT_HEALTHY_SECONDS}s. Rolling back."
aws ec2 stop-instances --instance-ids "$INSTANCE_ID" >/dev/null
aws ec2 wait instance-stopped --instance-ids "$INSTANCE_ID"
aws ec2 detach-volume --volume-id "$NEW_VOLUME_ID" >/dev/null
aws ec2 wait volume-available --volume-ids "$NEW_VOLUME_ID"
aws ec2 attach-volume --volume-id "$OLD_VOLUME_ID" --instance-id "$INSTANCE_ID" --device "$DEVICE_NAME" >/dev/null
aws ec2 wait volume-in-use --volume-ids "$OLD_VOLUME_ID"
aws ec2 modify-instance-attribute --instance-id "$INSTANCE_ID" \
  --block-device-mappings "[{\"DeviceName\":\"$DEVICE_NAME\",\"Ebs\":{\"DeleteOnTermination\":true}}]"
aws ec2 start-instances --instance-ids "$INSTANCE_ID" >/dev/null
aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"
if wait_healthy; then
  log "Rolled back: original unencrypted volume is back and healthy. NEEDS ATTENTION before retrying."
else
  log "ROLLBACK ALSO UNHEALTHY. The server needs immediate manual attention."
fi
exit 1
