#!/bin/bash
set -e

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-gns_user}"
DB_PASSWORD="${DB_PASSWORD:-secure_password}"
DB_NAME="${DB_NAME:-gns_database}"

echo "Waiting for PostgreSQL to be ready..."
until PGPASSWORD="$DB_PASSWORD" pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; do
    echo "PostgreSQL is not ready yet — sleeping 2s"
    sleep 2
done

echo "PostgreSQL is ready. Initializing database..."

# Create the database if it doesn't exist
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -tc \
    "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
    -c "CREATE DATABASE $DB_NAME;"

echo "Running schema migrations..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -f "$(dirname "$0")/database/schema.sql"

echo "Database initialization complete."
