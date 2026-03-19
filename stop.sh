#!/bin/bash

echo "======================================"
echo "🛑 STOPPING SERVICES"
echo "======================================"

cd /root/GNS

docker-compose down

echo ""
echo "✅ SERVICES STOPPED"
echo "======================================"
