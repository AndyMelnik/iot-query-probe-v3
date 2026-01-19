#!/usr/bin/env python3
"""
IoT Query Probe - Application Launcher

Starts auth server and Streamlit. Nginx handles reverse proxy routing.

Navixy App Connect Flow:
1. User accesses: https://dashboard.tools.datahub.navixy.com/?session_key=XXX&target=YOUR_APP
2. Navixy validates session and calls POST /api/auth/login
3. Auth server stores credentials
4. Streamlit app uses stored credentials to connect to IoT database
"""

import os
import sys
import subprocess
import threading
import time

# Configuration - internal ports (nginx proxies to these)
AUTH_SERVER_PORT = int(os.getenv("AUTH_SERVER_PORT", "8001"))
STREAMLIT_PORT = int(os.getenv("STREAMLIT_INTERNAL_PORT", "8502"))


def run_auth_server():
    """Run the FastAPI auth server."""
    import uvicorn
    from auth_server import app
    
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=AUTH_SERVER_PORT,
        log_level="info"
    )


def run_streamlit():
    """Run the Streamlit application."""
    subprocess.run([
        sys.executable, "-m", "streamlit", "run",
        "app.py",
        "--server.port", str(STREAMLIT_PORT),
        "--server.address", "127.0.0.1",
        "--server.headless", "true",
        "--server.enableCORS", "false",
        "--server.enableXsrfProtection", "false",
        "--server.enableWebsocketCompression", "false"
    ])


def check_config():
    """Check configuration."""
    warnings = []
    
    if not os.getenv("JWT_SECRET"):
        warnings.append("JWT_SECRET not set - using temporary secret (will change on restart)")
    
    return warnings


def main():
    """Start backend servers (nginx handles external routing)."""
    print("=" * 60)
    print("IoT Query Probe - Starting Application")
    print("=" * 60)
    print()
    print("Navixy App Connect Integration")
    print("Access via: https://dashboard.tools.datahub.navixy.com/")
    print("            ?session_key=YOUR_KEY")
    print("            &target=YOUR_APP_URL")
    print()
    
    warnings = check_config()
    
    if warnings:
        print("⚠️  Warnings:")
        for w in warnings:
            print(f"   - {w}")
        print()
    
    print(f"Auth Server: 127.0.0.1:{AUTH_SERVER_PORT}")
    print(f"  POST /api/auth/login - Receives credentials from Navixy")
    print(f"  GET  /api/auth/status - Check server status")
    print(f"  GET  /health - Health check")
    print()
    print(f"Streamlit App: 127.0.0.1:{STREAMLIT_PORT}")
    print()
    print("Nginx proxies external requests to these services.")
    print("=" * 60)
    
    # Start auth server in background thread
    auth_thread = threading.Thread(target=run_auth_server, daemon=True)
    auth_thread.start()
    
    # Give auth server time to start
    time.sleep(2)
    
    # Run Streamlit in main thread
    try:
        run_streamlit()
    except KeyboardInterrupt:
        print("\nShutting down...")
        sys.exit(0)


if __name__ == "__main__":
    main()
