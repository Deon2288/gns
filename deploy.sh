#!/bin/bash
echo "======================================"
echo "🚀 GNS DEPLOYMENT SCRIPT"
echo "======================================"
cd /root/GNS

# Pull latest changes
echo "[1/5] Pulling latest code..."
git pull origin master

# Stop old containers
echo "[2/5] Stopping old containers..."
docker-compose down

# Rebuild images
echo "[3/5] Building Docker images..."
docker-compose build --no-cache

# Start services
echo "[4/5] Starting services..."
docker-compose up -d

# Wait for services
sleep 10

# Verify deployment
echo "[5/5] Verifying deployment..."
docker-compose ps

echo ""
echo "======================================"
echo "✅ DEPLOYMENT COMPLETE!"
echo "======================================"
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:3001"
echo "======================================"
