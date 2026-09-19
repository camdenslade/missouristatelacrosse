#!/bin/bash
# Installs a new backend jar on the server and rolls back automatically if it does not come up
# healthy. Run by the deploy workflow through AWS Systems Manager (as root), never by hand.
#
# Usage: deploy-on-server.sh <s3-uri-of-jar> <expected-sha256>
#
# Steps: fetch the jar, refuse it unless its checksum matches the one computed in the build, keep
# the running jar as the rollback copy, install and restart, then wait for the health endpoint.
# If the new version never reports healthy, the previous jar is put back and restarted.
set -uo pipefail

S3_URI="${1:?usage: deploy-on-server.sh <s3-uri> <sha256>}"
EXPECTED="${2:?usage: deploy-on-server.sh <s3-uri> <sha256>}"

JAR=/home/ec2-user/backend/build/libs/laxsite-backend-0.0.1-SNAPSHOT.jar
PREVIOUS=/home/ec2-user/laxsite-backend.previous.jar
INCOMING=/tmp/laxsite-backend.incoming.jar
HEALTH_URL=http://localhost:8080/actuator/health
WAIT_SECONDS="${HEALTH_WAIT_SECONDS:-90}"

healthy() {
  curl -sf --max-time 5 "$HEALTH_URL" | grep -q '"status":"UP"'
}

wait_healthy() {
  local tries=$((WAIT_SECONDS / 3))
  for _ in $(seq 1 "$tries"); do
    healthy && return 0
    sleep 3
  done
  return 1
}

if ! aws s3 cp "$S3_URI" "$INCOMING" --only-show-errors --region us-east-1; then
  echo "download failed: nothing was changed"
  exit 1
fi

ACTUAL="$(sha256sum "$INCOMING" | cut -d' ' -f1)"
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "checksum mismatch (expected $EXPECTED, got $ACTUAL): refusing to install, nothing was changed"
  rm -f "$INCOMING"
  exit 1
fi

cp "$JAR" "$PREVIOUS"
install -o ec2-user -g ec2-user -m 644 "$INCOMING" "$JAR"
rm -f "$INCOMING"
systemctl restart laxsite-backend

if wait_healthy; then
  echo "deploy ok: new version is healthy"
  exit 0
fi

echo "new version did not become healthy within ${WAIT_SECONDS}s: rolling back"
install -o ec2-user -g ec2-user -m 644 "$PREVIOUS" "$JAR"
systemctl restart laxsite-backend
if wait_healthy; then
  echo "rolled back: previous version is healthy again"
else
  echo "ROLLBACK ALSO UNHEALTHY: the backend needs attention"
fi
exit 1
