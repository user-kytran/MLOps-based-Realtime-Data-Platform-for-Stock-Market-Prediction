#!/usr/bin/env python3
import json
import os
import glob

def update_dashboard_timezone(file_path, timezone="Asia/Ho_Chi_Minh"):
    """Update timezone in a Grafana dashboard JSON file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            dashboard = json.load(f)
        
        current_timezone = dashboard.get('timezone', 'not set')
        
        # Always set timezone to Asia/Ho_Chi_Minh
        dashboard['timezone'] = timezone
        print(f"Updated: {file_path} (was: {current_timezone})")
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(dashboard, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    # Find all dashboard JSON files
    dashboard_dir = "/home/obito/main/scylla-monitoring/grafana/build"
    json_files = glob.glob(f"{dashboard_dir}/**/*.json", recursive=True)
    
    print(f"Found {len(json_files)} dashboard files")
    print(f"Updating timezone to Asia/Ho_Chi_Minh...")
    print("-" * 60)
    
    updated_count = 0
    for json_file in json_files:
        if update_dashboard_timezone(json_file):
            updated_count += 1
    
    print("-" * 60)
    print(f"Updated {updated_count} out of {len(json_files)} dashboards")

if __name__ == "__main__":
    main()
