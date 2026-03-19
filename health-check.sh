#!/bin/bash

echo "======================================"
echo "🏥 HEALTH CHECK"
echo "======================================"

cd /root/GNS

# Check containers
echo ""
echo "Container Status:"
docker-compose ps

# Check backend
echo ""
echo "Backend Health:"
curl -s http://localhost:3001/health | jq . || echo "❌ Backend not responding"

# Check frontend
echo ""
echo "Frontend Status:"
curl -s http://localhost:3000/ > /dev/null && echo "✅ Frontend is running" || echo "❌ Frontend not responding"

# Check database
echo ""
echo "Database Status:"
docker exec gns-postgres psql -U gns_user -d gns_database -c "SELECT version();" 2>/dev/null && echo "✅ Database is running" || echo "❌ Database not responding"

echo ""
echo "======================================"
