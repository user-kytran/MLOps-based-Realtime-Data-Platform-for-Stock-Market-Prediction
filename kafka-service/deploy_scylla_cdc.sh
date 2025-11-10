#!/bin/bash
set -e

CONNECT_URL="http://localhost:8083/connectors"
KAFKA_UI_URL="http://localhost:8080/api/clusters/kafka-cluster/topics"

CONNECTORS=(
  "scylla-cdc-stock_prices:scylla-cdc-stock_prices.json"
  "scylla-cdc-stock_latest_prices:scylla-cdc-stock_latest_prices.json"
)

TOPICS=(
  "cdc_stock_prices.stock_data.stock_prices:12:3"
  "cdc_stock_latest_prices.stock_data.stock_latest_prices:12:3"
)

echo "Checking Kafka Connect availability..."
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -sf "$CONNECT_URL" > /dev/null 2>&1; then
    echo "  Kafka Connect is ready!"
    curl -s http://localhost:8083/connectors
    echo ""
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "  Waiting for Kafka Connect... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "  ERROR: Kafka Connect is not available after $MAX_RETRIES attempts"
  exit 1
fi

echo "Creating Kafka Topics..."
for topic_info in "${TOPICS[@]}"; do
  IFS=':' read -r topic_name partitions replication <<< "$topic_info"
  
  if curl -sf "$KAFKA_UI_URL/$topic_name" > /dev/null 2>&1; then
    echo "  Topic exists: $topic_name"
  else
    echo "  Creating topic: $topic_name"
    curl -sf -X POST "$KAFKA_UI_URL" -H "Content-Type: application/json" \
      -d "{\"name\":\"$topic_name\",\"partitions\":$partitions,\"replicationFactor\":$replication}" > /dev/null
  fi
done

echo ""
echo "Deploying CDC Connectors..."
for connector_info in "${CONNECTORS[@]}"; do
  IFS=':' read -r connector_name json_file <<< "$connector_info"
  echo "  Processing: $connector_name"
  
  if curl -sf "$CONNECT_URL/$connector_name" > /dev/null 2>&1; then
    curl -s -X DELETE "$CONNECT_URL/$connector_name" > /dev/null
    sleep 2
  fi
  
  curl -s -X POST $CONNECT_URL -H "Content-Type: application/json" -d @"$json_file" > /dev/null 2>&1 || echo "    Warning: Failed to deploy $connector_name"
done

echo ""
echo "Waiting for connectors to start..."
curl -s http://localhost:8083/connectors
sleep 10
curl -s http://localhost:8083/connectors

echo ""
echo "Connector Status:"
for connector_info in "${CONNECTORS[@]}"; do
  IFS=':' read -r connector_name _ <<< "$connector_info"
  status=$(curl -s "$CONNECT_URL/$connector_name/status")
  state=$(echo "$status" | jq -r '.connector.state')
  tasks=$(echo "$status" | jq -r '.tasks | length')
  running=$(echo "$status" | jq -r '[.tasks[] | select(.state == "RUNNING")] | length')
  echo "  $connector_name: $state (Tasks: $running/$tasks running)"
done
