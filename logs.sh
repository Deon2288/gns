#!/bin/bash

if [ "$1" == "backend" ]; then
  docker logs gns-backend -f
elif [ "$1" == "frontend" ]; then
  docker logs gns-frontend -f
elif [ "$1" == "postgres" ]; then
  docker logs gns-postgres -f
else
  echo "Usage: ./logs.sh [backend|frontend|postgres]"
  exit 1
fi
