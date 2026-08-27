#!/bin/bash

KEYSPACE="${1:-stock_data}"
TABLE="${2:-stock_prices}"
HOSTNAME="${3:-localhost}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/target/release/scylla-cdc-printer" \
  -k "$KEYSPACE" \
  -t "$TABLE" \
  -h "$HOSTNAME" \
  --window-size 1 \
  --safety-interval 0 \
  --sleep-interval 0