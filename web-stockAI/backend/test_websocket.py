#!/usr/bin/env python3
"""
Script để test WebSocket connection
"""

import asyncio
import websockets
import json
import sys

async def test_websocket():
    uri = "ws://localhost:8000/stocks/ws/stocks_realtime"
    
    print("=" * 60)
    print("WebSocket Test Tool")
    print("=" * 60)
    print(f"Connecting to: {uri}")
    print()
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ Connected to WebSocket")
            print("Waiting for messages...")
            print("-" * 60)
            
            message_count = 0
            start_time = asyncio.get_event_loop().time()
            
            try:
                async for message in websocket:
                    elapsed = asyncio.get_event_loop().time() - start_time
                    message_count += 1
                    
                    try:
                        data = json.loads(message)
                        if message_count <= 5:
                            print(f"[{elapsed:.1f}s] Message {message_count}: {json.dumps(data, ensure_ascii=False)[:200]}")
                        elif message_count == 6:
                            print(f"[{elapsed:.1f}s] ... (showing first 5 messages only)")
                    
                    except json.JSONDecodeError:
                        print(f"[{elapsed:.1f}s] Raw message: {message[:200]}")
                    
                    if message_count >= 20:
                        print(f"\n✅ Received {message_count} messages in {elapsed:.1f}s")
                        print("WebSocket is working!")
                        break
                    
            except websockets.exceptions.ConnectionClosed:
                print(f"\n⚠️  Connection closed after {message_count} messages")
            except KeyboardInterrupt:
                print(f"\n✓ Received {message_count} messages before interruption")
                print("WebSocket is working!")
                
    except ConnectionRefusedError:
        print("❌ Cannot connect to WebSocket")
        print("   Make sure the backend server is running on localhost:8000")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    try:
        asyncio.run(test_websocket())
    except KeyboardInterrupt:
        print("\n✓ Test interrupted by user")
