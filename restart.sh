#!/bin/bash

echo "======================================"
echo "🔄 RESTARTING SERVICES"
echo "======================================"

cd /root/GNS

docker-compose restart

sleep 5

echo ""
echo "Service Status:"
docker-compose ps

echo ""
echo "======================================"
echo "✅ SERVICES RESTARTED"
echo "======================================"
