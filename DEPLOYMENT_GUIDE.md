# GoalKick Lite - Production Deployment Guide

> Complete step-by-step guide to deploy your ticketing system to production.

---

## Quick Overview

| Step | What You'll Do |
|------|----------------|
| 1 | Get a VPS server (DigitalOcean, Vultr, etc.) |
| 2 | Install Node.js and PostgreSQL |
| 3 | Upload your code |
| 4 | Configure environment variables |
| 5 | Set up Nginx reverse proxy |
| 6 | Enable HTTPS with Let's Encrypt |
| 7 | Run with PM2 process manager |

---

## Step 1: Get a VPS Server

Choose a cloud provider and create a VPS:

| Provider | Recommended Plan | Cost |
|----------|------------------|------|
| [DigitalOcean](https://digitalocean.com) | Basic Droplet (1GB RAM) | $6/month |
| [Vultr](https://vultr.com) | Cloud Compute (1GB RAM) | $6/month |
| [Linode](https://linode.com) | Nanode 1GB | $5/month |

**Recommended OS:** Ubuntu 22.04 LTS

After creating your VPS, note the IP address (e.g., `123.45.67.89`).

---

## Step 2: Connect to Your Server

```bash
# From your local Mac terminal
ssh root@YOUR_SERVER_IP
```

When prompted, enter the password from your VPS provider.

---

## Step 3: Initial Server Setup

```bash
# Update system packages
apt update && apt upgrade -y

# Create a non-root user (replace 'goalkick' with your preferred username)
adduser goalkick
usermod -aG sudo goalkick

# Switch to new user
su - goalkick
```

---

## Step 4: Install Node.js

```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version   # Should show v20.x.x
npm --version    # Should show 10.x.x
```

---

## Step 5: Install PostgreSQL

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql
```

Inside the PostgreSQL prompt:

```sql
-- Create database
CREATE DATABASE goalkick;

-- Create user with password (CHANGE THIS PASSWORD!)
CREATE USER goalkick_user WITH ENCRYPTED PASSWORD 'your_secure_password_here';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE goalkick TO goalkick_user;

-- Connect to database and grant schema permissions
\c goalkick
GRANT ALL ON SCHEMA public TO goalkick_user;

-- Exit
\q
```

---

## Step 6: Upload Your Code

**Option A: Using Git (Recommended)**

```bash
# On your server
cd ~
git clone https://github.com/YOUR_USERNAME/qr_ticketing.git
cd qr_ticketing
```

**Option B: Using SCP (From your Mac)**

```bash
# From your Mac terminal (not server)
cd ~/Desktop
scp -r qr_ticketing goalkick@YOUR_SERVER_IP:~/
```

---

## Step 7: Install Dependencies

```bash
cd ~/qr_ticketing
npm install --production
```

---

## Step 8: Configure Environment Variables

```bash
# Copy example env file
cp .env.example .env

# Edit with nano
nano .env
```

Update these values:

```env
# Database - use your PostgreSQL credentials
DATABASE_URL=postgresql://goalkick_user:your_secure_password_here@localhost:5432/goalkick

# Session - generate a random secret
SESSION_SECRET=generate_a_random_32_character_string_here

# Environment
NODE_ENV=production

# eSewa Configuration (Manual Mode for non-profit)
ESEWA_MODE=manual
ESEWA_PERSONAL_ID=9821446561
```

**Generate a secure session secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save and exit nano: `Ctrl+X`, then `Y`, then `Enter`

---

## Step 9: Initialize Database Tables

```bash
# Run the database setup
psql -d goalkick -f db/schema.sql

# Or if using DATABASE_URL
psql $DATABASE_URL -f db/schema.sql
```

---

## Step 10: Create Admin User

```bash
node scripts/create-admin.js
```

> ⚠️ **Important:** Use a strong password, not the default `admin123`!

---

## Step 11: Install PM2 Process Manager

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start your application
pm2 start server.js --name goalkick

# Save PM2 configuration
pm2 save

# Enable PM2 to start on boot
pm2 startup
# Run the command it outputs (starts with sudo)
```

**Useful PM2 Commands:**
```bash
pm2 status          # Check app status
pm2 logs goalkick   # View logs
pm2 restart goalkick # Restart app
pm2 stop goalkick   # Stop app
```

---

## Step 12: Install Nginx

```bash
sudo apt install -y nginx
```

---

## Step 13: Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/goalkick
```

Paste this configuration (replace `yourdomain.com` with your actual domain):

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/goalkick /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## Step 14: Point Domain to Server

In your domain registrar (GoDaddy, Namecheap, etc.), add these DNS records:

| Type | Name | Value |
|------|------|-------|
| A | @ | YOUR_SERVER_IP |
| A | www | YOUR_SERVER_IP |

Wait 5-30 minutes for DNS propagation.

---

## Step 15: Enable HTTPS with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts:
1. Enter your email
2. Agree to terms
3. Choose to redirect HTTP to HTTPS (option 2)

**Auto-renewal is automatic!** Test with:
```bash
sudo certbot renew --dry-run
```

---

## Step 16: Configure Firewall

```bash
# Enable UFW firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

# Verify
sudo ufw status
```

---

## 🎉 You're Live!

Your GoalKick Lite is now running at `https://yourdomain.com`

---

## Post-Deployment Checklist

- [ ] Change admin password from default
- [ ] Test complete purchase flow
- [ ] Test admin login and payment verification
- [ ] Test gatekeeper QR scanning
- [ ] Set up database backups (see below)
- [ ] Monitor logs: `pm2 logs goalkick`

---

## Database Backup (Recommended)

Create a daily backup script:

```bash
nano ~/backup-db.sh
```

Add:
```bash
#!/bin/bash
BACKUP_DIR=~/backups
mkdir -p $BACKUP_DIR
pg_dump goalkick > $BACKUP_DIR/goalkick_$(date +%Y%m%d).sql
# Keep only last 7 days
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
```

Make executable and schedule:
```bash
chmod +x ~/backup-db.sh

# Add to crontab (runs daily at 2am)
crontab -e
# Add this line:
0 2 * * * ~/backup-db.sh
```

---

## Troubleshooting

### App not loading?
```bash
pm2 logs goalkick --lines 50
```

### Database connection error?
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U goalkick_user -d goalkick -h localhost
```

### Nginx error?
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `pm2 status` | Check app status |
| `pm2 restart goalkick` | Restart application |
| `pm2 logs goalkick` | View application logs |
| `sudo systemctl restart nginx` | Restart Nginx |
| `sudo certbot renew` | Renew SSL certificate |

---

**Need help?** Check the logs first: `pm2 logs goalkick`

Good luck with your football event! ⚽🇳🇵
