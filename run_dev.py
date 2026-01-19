#!/usr/bin/env python3
"""
IoT Analytics Platform - Development Launcher

Starts the FastAPI backend server.
Frontend (Next.js) should be started separately with `npm run dev`.
"""

import os
import sys
import subprocess
import threading
import time

# Configuration
AUTH_SERVER_PORT = int(os.getenv("AUTH_SERVER_PORT", "8001"))


def run_backend():
    """Run the FastAPI backend server."""
    import uvicorn
    
    # Use import string for reload support
    uvicorn.run(
        "auth_server:app",
        host="0.0.0.0",
        port=AUTH_SERVER_PORT,
        log_level="info",
        reload=True,
        reload_dirs=[".", "api"],
    )


def check_config():
    """Check configuration."""
    warnings = []
    
    if not os.getenv("JWT_SECRET"):
        warnings.append("JWT_SECRET not set - using temporary secret")
    
    return warnings


def main():
    """Start the development server."""
    print("=" * 60)
    print("IoT Analytics Platform - Development Server")
    print("=" * 60)
    print()
    print("Backend API: http://localhost:8001")
    print("  - /api/entities - Entity metadata")
    print("  - /api/query/execute - Run queries")
    print("  - /api/reports - Saved reports")
    print("  - /api/auth/login - Navixy authentication")
    print()
    print("Frontend: Start separately with:")
    print("  cd frontend && npm install && npm run dev")
    print()
    print("Then open http://localhost:3000")
    print()
    
    warnings = check_config()
    if warnings:
        print("⚠️  Warnings:")
        for w in warnings:
            print(f"   - {w}")
        print()
    
    print("=" * 60)
    
    try:
        run_backend()
    except KeyboardInterrupt:
        print("\nShutting down...")
        sys.exit(0)


if __name__ == "__main__":
    main()

