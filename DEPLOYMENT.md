# GNS Deployment Guide

## Production Deployment

### Prerequisites
- Ubuntu 20.04 LTS or higher
- Node.js v20+
- PostgreSQL 13+
- Nginx (reverse proxy)
- PM2 (process manager)

### Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx
