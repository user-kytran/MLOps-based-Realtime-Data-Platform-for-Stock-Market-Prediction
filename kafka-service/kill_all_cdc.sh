#!/bin/bash

CONNECT_URL="http://localhost:8083/connectors"

echo "🗑️  Killing all CDC Connectors..."
echo "=================================================="

# Lấy danh sách tất cả connectors
echo "📋 Fetching list of all connectors..."
connectors=$(curl -s $CONNECT_URL)

if [ -z "$connectors" ] || [ "$connectors" = "[]" ]; then
    echo "✅ No connectors found. Nothing to delete."
    exit 0
fi

# Parse JSON array và xóa từng connector
echo "$connectors" | grep -o '"[^"]*"' | tr -d '"' | while read -r connector_name; do
    if [ ! -z "$connector_name" ]; then
        echo ""
        echo "🔴 Deleting connector: $connector_name"
        
        # Xóa connector
        response=$(curl -s -X DELETE "$CONNECT_URL/$connector_name")
        
        if [ -z "$response" ]; then
            echo "   ✅ Successfully deleted $connector_name"
        else
            echo "   ⚠️  Response: $response"
        fi
        
        # Đợi một chút để đảm bảo connector bị xóa hoàn toàn
        sleep 1
    fi
done

echo ""
echo "=================================================="
echo "⏳ Waiting for all connectors to be terminated..."
sleep 3

# Verify connectors đã bị xóa
echo ""
echo "📋 Verifying remaining connectors..."
remaining=$(curl -s $CONNECT_URL)

if [ "$remaining" = "[]" ]; then
    echo "✅ All connectors have been successfully deleted!"
else
    echo "⚠️  Some connectors may still exist:"
    echo "$remaining"
fi

echo ""
echo "🏁 Cleanup complete!"
