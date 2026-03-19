#!/bin/bash

BACKUP_DIR="/root/GNS/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

echo "======================================"
echo "💾 BACKING UP DATABASE"
echo "======================================"

# Backup PostgreSQL
echo "Backing up PostgreSQL..."
docker exec gns-postgres pg_dump -U gns_user -d gns_database > $BACKUP_DIR/gns_db_$TIMESTAMP.sql

# Compress backup
gzip $BACKUP_DIR/gns_db_$TIMESTAMP.sql

echo "✅ Backup saved to: $BACKUP_DIR/gns_db_$TIMESTAMP.sql.gz"

# Keep only last 7 backups
echo "Cleaning old backups..."
find $BACKUP_DIR -name "gns_db_*.sql.gz" -mtime +7 -delete

echo ""
echo "======================================"
