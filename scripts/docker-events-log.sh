#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="${1:-/home/obito/Desktop/main/main/logs/docker-events.log}"
mkdir -p "$(dirname "$LOG_FILE")"

docker events \
  --since 0s \
  --filter type=container \
  --format '{{.Time}} {{.Type}} {{.Action}} {{.Actor.Attributes.name}}' \
  >> "$LOG_FILE"
