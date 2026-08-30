#!/usr/bin/env bash
# Resize the lacrosse backend EC2 instance for anticipated high load (e.g. game night).
#
#   ./scale-lax.sh up       -> resize to the BIG type (more RAM headroom)
#   ./scale-lax.sh down     -> resize back to the SMALL type (normal / cheap)
#   ./scale-lax.sh status   -> show current type + state, no changes
#
# A resize requires a stop/start, so expect ~2-3 minutes of downtime. Run "up" about
# an hour before the event, "down" the next day.
#
# Needs AWS credentials with: ec2:DescribeInstances (on *), and
# ec2:StopInstances / ec2:StartInstances / ec2:ModifyInstanceAttribute on this instance.
# See scale-lax-iam-policy.json.

set -euo pipefail

INSTANCE_ID="${LAX_INSTANCE_ID:-i-0800e9fce88ebd384}"
REGION="${AWS_REGION:-us-east-1}"
BIG="${LAX_BIG_TYPE:-t3.medium}"     # 4 GiB - game-night headroom
SMALL="${LAX_SMALL_TYPE:-t3.micro}"  # 1 GiB - normal
HEALTH_URL="${LAX_HEALTH_URL:-https://api.missouristatelacrosse.com/actuator/health}"

aws() { command aws --region "$REGION" "$@"; }

current_type() {
  aws ec2 describe-instances --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].InstanceType' --output text
}
current_state() {
  aws ec2 describe-instances --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].State.Name' --output text
}

action="${1:-}"
case "$action" in
  up)     target="$BIG" ;;
  down)   target="$SMALL" ;;
  status)
    echo "instance : $INSTANCE_ID ($REGION)"
    echo "type     : $(current_type)"
    echo "state    : $(current_state)"
    exit 0 ;;
  *)
    echo "usage: $0 {up|down|status}" >&2
    exit 2 ;;
esac

cur="$(current_type)"
echo "current type: $cur   ->   target: $target"
if [ "$cur" = "$target" ]; then
  echo "already $target, nothing to do."
  exit 0
fi

read -r -p "Stop, resize to $target, and start $INSTANCE_ID now? [y/N] " ok
[ "$ok" = "y" ] || [ "$ok" = "Y" ] || { echo "aborted."; exit 1; }

echo "[1/5] stopping..."
aws ec2 stop-instances --instance-ids "$INSTANCE_ID" >/dev/null
aws ec2 wait instance-stopped --instance-ids "$INSTANCE_ID"

echo "[2/5] resizing $cur -> $target ..."
aws ec2 modify-instance-attribute --instance-id "$INSTANCE_ID" \
  --attribute instanceType --value "$target"

echo "[3/5] starting..."
aws ec2 start-instances --instance-ids "$INSTANCE_ID" >/dev/null
aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"

echo "[4/5] instance running as $(current_type). waiting for the app..."
ok=""
for i in $(seq 1 40); do
  if curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null | grep -q '"status":"UP"'; then
    ok=1; echo "[5/5] backend healthy after ~$((i*5))s."; break
  fi
  sleep 5
done
[ -n "$ok" ] || { echo "[5/5] WARNING: app not healthy yet - check the box."; exit 1; }

echo "done. now $target."
