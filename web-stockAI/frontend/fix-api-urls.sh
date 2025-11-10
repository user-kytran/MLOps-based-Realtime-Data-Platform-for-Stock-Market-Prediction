#!/bin/bash

# Script để replace tất cả localhost:8005 sang dùng config

echo "Fixing API URLs in remaining files..."

# Function to add import and replace URLs
fix_file() {
    local file=$1
    echo "Processing: $file"
    
    # Check if already has import
    if ! grep -q "from.*@/lib/config" "$file"; then
        # Add import after first import line
        sed -i '1a import { API_URL, WS_URL } from "@/lib/config"' "$file"
    fi
    
    # Replace HTTP URLs
    sed -i 's|http://localhost:8005|${API_URL}|g' "$file"
    # Replace WebSocket URLs
    sed -i 's|ws://localhost:8005|${WS_URL}|g' "$file"
}

# Fix hooks
for file in hooks/useStocksVN30WS.ts hooks/useStocksRealtimeWS.ts hooks/useTopMoversWS.ts hooks/useStocksWS.ts; do
    if [ -f "$file" ]; then
        fix_file "$file"
    fi
done

# Fix components
for file in components/news/*.tsx; do
    if [ -f "$file" ] && grep -q "localhost:8005" "$file"; then
        fix_file "$file"
    fi
done

echo "Done! Please review changes and restart containers."
echo "Run: docker compose down && docker compose up -d --build"
