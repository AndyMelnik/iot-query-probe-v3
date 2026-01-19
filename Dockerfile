# IoT Query Probe - Report Builder
# Multi-stage build: Next.js frontend + FastAPI backend with nginx

# =============================================================================
# Stage 1: Build Next.js frontend
# =============================================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build the Next.js app (standalone mode)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# =============================================================================
# Stage 2: Production image
# =============================================================================
FROM python:3.11-slim

WORKDIR /app

# Install nginx, nodejs, and curl
RUN apt-get update && \
    apt-get install -y nginx curl nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Python backend files
COPY auth_server.py ./
COPY api/ ./api/

# Copy Next.js standalone build
COPY --from=frontend-builder /app/frontend/.next/standalone ./frontend/
COPY --from=frontend-builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=frontend-builder /app/frontend/public ./frontend/public

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy startup script
COPY start.sh .
RUN chmod +x start.sh

# Create credential storage directory with secure permissions
RUN mkdir -p /tmp/iot-query-probe && chmod 700 /tmp/iot-query-probe

# Environment variables
ENV PORT=10000
ENV BACKEND_PORT=8001
ENV FRONTEND_PORT=3000
ENV PYTHONUNBUFFERED=1
ENV CREDENTIALS_DIR=/tmp/iot-query-probe
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Expose the main port (nginx)
EXPOSE 10000

# Health check through nginx
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Run startup script
CMD ["./start.sh"]
