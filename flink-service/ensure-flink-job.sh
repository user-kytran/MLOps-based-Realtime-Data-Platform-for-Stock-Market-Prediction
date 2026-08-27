#!/usr/bin/env bash
set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-${COMPOSE_DIR}/docker-compose.yml}"
FLINK_REST_URL="${FLINK_REST_URL:-http://localhost:8088}"
JOBMANAGER_CONTAINER="${JOBMANAGER_CONTAINER:-jobmanager}"
JOB_NAME="${JOB_NAME:-Stock Processing Pipeline - Java}"
JOB_CLASS="${JOB_CLASS:-com.stock.StockProcessingJob}"
JOB_JAR="${JOB_JAR:-/opt/flink/usrlib/jars/flink-consumer-1.0.jar}"
LOCK_FILE="${LOCK_FILE:-/tmp/flink-stock-job-watchdog.lock}"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S%z')" "$*"
}

with_lock() {
  exec 9>"${LOCK_FILE}"
  if ! flock -n 9; then
    log "another watchdog instance is already running"
    exit 0
  fi
}

ensure_network() {
  if ! docker network inspect financi-network >/dev/null 2>&1; then
    log "creating docker network financi-network"
    docker network create financi-network >/dev/null
  fi
}

ensure_cluster() {
  ensure_network
  log "ensuring Flink compose stack is up"
  docker compose -f "${COMPOSE_FILE}" up -d --build
}

wait_for_rest() {
  local attempt
  for attempt in $(seq 1 60); do
    if curl -fsS --max-time 5 "${FLINK_REST_URL}/overview" >/dev/null; then
      return 0
    fi
    sleep 2
  done

  log "Flink REST API did not become ready at ${FLINK_REST_URL}"
  return 1
}

active_job_status() {
  local overview
  overview="$(curl -fsS --max-time 5 "${FLINK_REST_URL}/jobs/overview")"

  OVERVIEW="${overview}" JOB_NAME="${JOB_NAME}" python3 - <<'PY'
import json
import os
import sys

active_states = {"CREATED", "RUNNING", "RESTARTING", "INITIALIZING", "SCHEDULED"}

try:
    overview = json.loads(os.environ["OVERVIEW"])
except Exception as exc:
    print(f"invalid Flink jobs overview JSON: {exc}", file=sys.stderr)
    sys.exit(2)

for job in overview.get("jobs", []):
    name = job.get("name", "")
    state = job.get("state", "")
    if name == os.environ["JOB_NAME"] and state in active_states:
        print(f"{name} is {state}")
        sys.exit(0)

print("no active stock Flink job")
sys.exit(1)
PY
}

submit_job() {
  log "submitting ${JOB_NAME}"
  docker exec "${JOBMANAGER_CONTAINER}" flink run -d -c "${JOB_CLASS}" "${JOB_JAR}"
}

main() {
  with_lock

  if active_job_status; then
    exit 0
  fi

  ensure_cluster
  wait_for_rest

  if active_job_status; then
    exit 0
  fi

  submit_job
  sleep 5
  active_job_status
}

main "$@"
