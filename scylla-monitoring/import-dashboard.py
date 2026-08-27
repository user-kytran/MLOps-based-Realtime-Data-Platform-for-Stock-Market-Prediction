#!/usr/bin/env python3
import json
import requests
import sys

dashboard_file = 'grafana/stock-cdc-latency.json'
grafana_url = 'http://localhost:3000'
username = 'admin'
password = 'admin'

try:
    with open(dashboard_file, 'r') as f:
        dashboard_json = json.load(f)
    
    # Wrap dashboard in required format
    payload = {
        "dashboard": dashboard_json,
        "overwrite": True,
        "folderId": 0
    }
    
    response = requests.post(
        f'{grafana_url}/api/dashboards/db',
        json=payload,
        auth=(username, password),
        headers={'Content-Type': 'application/json'}
    )
    
    if response.status_code in [200, 201]:
        result = response.json()
        print(f"✅ Dashboard imported successfully!")
        print(f"📊 URL: {grafana_url}{result.get('url', '/d/stock-cdc-latency')}")
    else:
        print(f"❌ Error: {response.status_code}")
        print(f"Response: {response.text}")
        sys.exit(1)
        
except FileNotFoundError:
    print(f"❌ File not found: {dashboard_file}")
    sys.exit(1)
except json.JSONDecodeError as e:
    print(f"❌ Invalid JSON: {e}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
