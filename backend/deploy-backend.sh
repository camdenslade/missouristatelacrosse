#!/usr/bin/env bash
set -euo pipefail


PEM="./laxsite-key.pem"
HOST="ec2-user@api.missouristatelacrosse.com"


echo "Running tests..."
./gradlew test
if [ $? -ne 0 ]; then
    echo " Tests failed! Deployment aborted."
    exit 1
fi
echo " All tests passed."

echo "Building..."
./gradlew clean build -x test

# Resolve the runnable boot jar (exclude the Gradle "-plain.jar" that has no manifest)
JAR=$(ls build/libs/*.jar | grep -v -- '-plain\.jar$' | head -n1)
if [ -z "$JAR" ] || [ ! -f "$JAR" ]; then
    echo "No boot jar found in build/libs/ - build failed?"
    exit 1
fi
echo "Uploading $JAR ..."
scp -i "$PEM" "$JAR" "$HOST:~/backend/build/libs/"

echo "Restarting service..."
ssh -i "$PEM" "$HOST" "sudo systemctl restart laxsite-backend && sleep 1 && sudo systemctl --no-pager --lines=5 status laxsite-backend"

echo "Done. Health check (remote localhost):"
ssh -i "$PEM" "$HOST" "curl -s --connect-timeout 5 --max-time 10 http://localhost:8080/actuator/health || true"
echo
echo "Health check (public):"
curl -s --connect-timeout 5 --max-time 10 "http://api.missouristatelacrosse.com:8080/actuator/health" || true
echo
