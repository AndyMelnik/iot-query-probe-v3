#!/bin/bash
set -e

echo "=========================================="
echo "Starting IoT Query Probe - Report Builder"
echo "=========================================="

# Environment
BACKEND_PORT=${BACKEND_PORT:-8001}
FRONTEND_PORT=${FRONTEND_PORT:-3000}
MAIN_PORT=${PORT:-10000}

echo "Configuration:"
echo "  - Backend port: $BACKEND_PORT"
echo "  - Frontend port: $FRONTEND_PORT"
echo "  - Main port (nginx): $MAIN_PORT"
echo ""

# Update nginx config with actual PORT if different from default
if [ "$MAIN_PORT" != "10000" ]; then
    echo "Updating nginx to listen on port $MAIN_PORT..."
    sed -i "s/listen 10000/listen $MAIN_PORT/" /etc/nginx/nginx.conf
fi

# Start FastAPI backend
echo "Starting FastAPI backend on port $BACKEND_PORT..."
python -m uvicorn auth_server:app --host 127.0.0.1 --port $BACKEND_PORT &
BACKEND_PID=$!

# Start Next.js frontend (standalone mode)
echo "Starting Next.js frontend on port $FRONTEND_PORT..."
cd /app/frontend
PORT=$FRONTEND_PORT HOSTNAME=127.0.0.1 node server.js &
FRONTEND_PID=$!
cd /app

# Wait for backend to be ready
echo "Waiting for backend..."
for i in {1..60}; do
    if curl -sf http://127.0.0.1:$BACKEND_PORT/health > /dev/null 2>&1; then
        echo "✓ Backend ready"
        break
    fi
    if [ $i -eq 60 ]; then
        echo "✗ Backend failed to start"
        exit 1
    fi
    sleep 1
done

# Wait for frontend to be ready
echo "Waiting for frontend..."
for i in {1..60}; do
    if curl -sf http://127.0.0.1:$FRONTEND_PORT > /dev/null 2>&1; then
        echo "✓ Frontend ready"
        break
    fi
    if [ $i -eq 60 ]; then
        echo "✗ Frontend failed to start"
        exit 1
    fi
    sleep 1
done

echo ""
echo "=========================================="
echo "Starting nginx reverse proxy on port $MAIN_PORT"
echo "=========================================="
echo ""

# Start nginx in foreground (keeps container running)
exec nginx -g "daemon off;"
