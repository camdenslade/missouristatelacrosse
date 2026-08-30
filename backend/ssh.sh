#!/usr/bin/env bash
set -euo pipefail

PEM="${PEM:-./laxsite-key.pem}"
HOST="${HOST:-ec2-user@api.missouristatelacrosse.com}"

exec ssh -i "$PEM" "$HOST" "$@"
