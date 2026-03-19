#!/bin/bash

echo "======================================"
echo "▶️  STARTING SERVICES"
echo "======================================"

cd /root/GNS

docker-compose up -d

sleep 10

echo ""
echo "Service Status:"
docker-compose ps

echo ""
echo "======================================"
echo "✅ SERVICES STARTED"
echo "======================================"
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:3001"
echo "======================================"
