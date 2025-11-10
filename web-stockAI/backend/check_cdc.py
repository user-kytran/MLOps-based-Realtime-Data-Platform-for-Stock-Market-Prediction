#!/usr/bin/env python3
"""
Script để kiểm tra tình trạng CDC và WebSocket
"""

import os
import sys
import subprocess
import asyncio
from datetime import datetime, time
from zoneinfo import ZoneInfo

def check_cdc_binary():
    cdc_bin = os.getenv('CDC_PRINTER_PATH', '/home/obito/main/scylla-cdc-printer/target/release/scylla-cdc-printer')
    print(f"🔍 Checking CDC binary: {cdc_bin}")
    
    if not os.path.exists(cdc_bin):
        print(f"❌ CDC binary NOT FOUND at {cdc_bin}")
        print(f"   Please build scylla-cdc-printer or set CDC_PRINTER_PATH env var")
        return False
    
    print(f"✅ CDC binary found")
    
    try:
        result = subprocess.run([cdc_bin, '--help'], capture_output=True, text=True, timeout=5)
        print(f"✅ CDC binary is executable")
        return True
    except Exception as e:
        print(f"❌ CDC binary cannot execute: {e}")
        return False

def check_env():
    print("\n🔍 Checking environment variables:")
    cassandra_host = os.getenv('CASSANDRA_HOST', 'localhost')
    keyspace = os.getenv('CASSANDRA_KEYSPACE', 'stock_data')
    
    print(f"  CASSANDRA_HOST: {cassandra_host}")
    print(f"  CASSANDRA_KEYSPACE: {keyspace}")
    print(f"  CDC_PRINTER_PATH: {os.getenv('CDC_PRINTER_PATH', '/home/obito/main/scylla-cdc-printer/target/release/scylla-cdc-printer')}")

def check_trading_hours():
    print("\n🔍 Checking trading hours:")
    vn_tz = ZoneInfo("Asia/Ho_Chi_Minh")
    now = datetime.now(vn_tz)
    
    weekday = now.weekday()
    trading_time = now.time()
    
    print(f"  Current time (VN): {now.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Weekday: {weekday} ({'Weekend' if weekday >= 5 else 'Weekday'})")
    
    if weekday >= 5:
        print("  ❌ Weekend - not trading")
        return False
    
    start = time(9, 0)
    end = time(15, 0)
    is_trading = start <= trading_time < end
    
    print(f"  Trading hours: 09:00 - 15:00")
    print(f"  {'✅ IN trading hours' if is_trading else '❌ OUT of trading hours'}")
    
    return is_trading

async def test_cdc_process():
    print("\n🔍 Testing CDC process (dry run):")
    cdc_bin = os.getenv('CDC_PRINTER_PATH', '/home/obito/main/scylla-cdc-printer/target/release/scylla-cdc-printer')
    cassandra_host = os.getenv('CASSANDRA_HOST', 'localhost')
    keyspace = os.getenv('CASSANDRA_KEYSPACE', 'stock_data')
    
    args = [
        cdc_bin,
        "-k", keyspace,
        "-t", "stock_latest_prices",
        "-h", cassandra_host,
        "--window-size", "1",
        "--safety-interval", "0",
        "--sleep-interval", "0"
    ]
    
    print(f"  Command: {' '.join(args)}")
    
    try:
        process = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        await asyncio.sleep(2)
        
        if process.returncode is not None:
            stderr = await process.stderr.read()
            print(f"  ❌ CDC process exited immediately with code {process.returncode}")
            print(f"  stderr: {stderr.decode()}")
        else:
            print(f"  ✅ CDC process is running (PID: {process.pid})")
            print(f"  Checking for output...")
            
            try:
                line = await asyncio.wait_for(process.stdout.readline(), timeout=3)
                if line:
                    print(f"  ✅ CDC is producing output")
                    print(f"  Sample: {line.decode().strip()[:100]}")
                else:
                    print(f"  ⚠️  CDC is running but no output yet")
            except asyncio.TimeoutError:
                print(f"  ⚠️  No output from CDC in 3 seconds")
            
            try:
                process.terminate()
                await asyncio.wait_for(process.wait(), timeout=3)
            except:
                process.kill()
        
    except Exception as e:
        print(f"  ❌ Failed to start CDC process: {e}")
        import traceback
        traceback.print_exc()

async def main():
    print("=" * 60)
    print("CDC & WebSocket Debug Tool")
    print("=" * 60)
    
    check_env()
    print()
    
    if not check_cdc_binary():
        print("\n❌ CDC binary check failed. Cannot continue.")
        sys.exit(1)
    
    print()
    is_trading = check_trading_hours()
    
    if is_trading:
        await test_cdc_process()
    else:
        print("\n⚠️  Not in trading hours. CDC process will not run.")
        print("   You can still connect to WebSocket, but no data will be sent.")
    
    print("\n" + "=" * 60)
    print("Check complete!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
