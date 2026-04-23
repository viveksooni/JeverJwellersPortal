# Jever Jwellers — Admin Panel

---

## Stack

| Layer    | Tech                                                    |
| -------- | ------------------------------------------------------- |
| Frontend | Vite + React 18 + TypeScript + Tailwind CSS + shadcn/ui |
| Backend  | Express.js + TypeScript                                 |
| Database | PostgreSQL + Drizzle ORM                                |
| PDF      | Puppeteer (server-side)                                 |
| WhatsApp | wa.me deep link                                         |
| Monorepo | npm workspaces + Turborepo                              |

---

## Local Development Setup

### 1. Prerequisites

- Node.js >= 20
- Docker + Docker Compose (for PostgreSQL)

### 2. Clone & Install

```bash
cd Jever_jwellers
npm install
```

### 3. Start PostgreSQL

```bash
docker-compose up -d
```

This starts PostgreSQL on `localhost:5432` and pgAdmin at `http://localhost:5050`.

### 4. Configure Environment

```bash
cp .env.example apps/server/.env
```

Edit `apps/server/.env` — the defaults work with docker-compose.

**Important:** Set a strong `JWT_SECRET` (minimum 32 characters).

### 5. Run Migrations + Seed

```bash
cd apps/server

# Generate migration files from schema
npm run db:generate

# Apply migrations to database
npm run db:migrate

# Seed categories, admin user, and sample metal rates
npm run db:seed
```

Default admin credentials: `admin@jever.com` / `admin123`

> Change the password immediately after first login via Settings.

### 6. Start Dev Servers

From the project root:

```bash
npm run dev
```

This starts both servers concurrently via Turborepo:

| Service        | URL                   |
| -------------- | --------------------- |
| Admin frontend | http://localhost:5173 |
| API server     | http://localhost:3001 |
| pgAdmin        | http://localhost:5050 |

---

## Production Deployment (VPS)

### Server Requirements

- Ubuntu 22.04+ (or any Linux with Node 20+)
- 2 GB RAM minimum (Puppeteer/Chromium needs ~300 MB)
- Nginx + Certbot for SSL

### 1. Install Dependencies on VPS

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2
npm install -g pm2

# Nginx
sudo apt-get install -y nginx certbot python3-certbot-nginx

# PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Chromium for Puppeteer
sudo apt-get install -y chromium-browser
```

### 2. Create PostgreSQL Database

```bash
sudo -u postgres psql
CREATE USER jever_app WITH PASSWORD 'your_strong_password';
CREATE DATABASE jever_db OWNER jever_app;
GRANT ALL PRIVILEGES ON DATABASE jever_db TO jever_app;
\q
```

### 3. Deploy Code

```bash
# On VPS
sudo mkdir -p /var/www/jever
sudo chown $USER:$USER /var/www/jever

# Copy files (from local machine)
rsync -avz --exclude node_modules --exclude .env \
  ./ user@your-vps:/var/www/jever/
```

### 4. Install & Build

```bash
cd /var/www/jever

# Install dependencies
npm install

# Create production .env
cp .env.example apps/server/.env
nano apps/server/.env   # Set DATABASE_URL, JWT_SECRET, PUBLIC_URL, etc.

# Build everything
npm run build

# Run migrations
cd apps/server && npm run db:migrate && npm run db:seed
```

### 5. Configure Nginx

```bash
# Edit domain names in nginx config
nano nginx/jever.conf   # Replace 'yourdomain.com' with your actual domain

sudo cp nginx/jever.conf /etc/nginx/sites-available/jever
sudo ln -s /etc/nginx/sites-available/jever /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. SSL with Certbot

```bash
sudo certbot --nginx -d admin.yourdomain.com -d api.yourdomain.com
```

### 7. Start with PM2

```bash
cd /var/www/jever
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup   # Follow the printed command to auto-start on reboot
```

### 8. Database Backups (Cron)

```bash
# Daily backup at 2 AM
crontab -e
# Add:
0 2 * * * pg_dump -U jever_app jever_db > /backups/jever_$(date +\%Y\%m\%d).sql
```

---

## Project Structure

```
jever-jwellers/
├── packages/shared/          # Shared TypeScript types & constants
├── apps/
│   ├── admin/                # Vite React admin panel
│   └── server/               # Express.js API
├── nginx/jever.conf          # Nginx config for VPS
├── ecosystem.config.js       # PM2 process config
└── docker-compose.yml        # Local PostgreSQL
```

## Key URLs (Production)

| URL                                                     | Purpose           |
| ------------------------------------------------------- | ----------------- |
| `https://admin.yourdomain.com`                          | Admin panel login |
| `https://api.yourdomain.com/health`                     | API health check  |
| `https://api.yourdomain.com/uploads/invoices/INV-*.pdf` | Generated PDFs    |

---

## Features

- **Invoice Generation** — Puppeteer PDF with shop logo, GST toggle (CGST + SGST), item breakdown, signature line
- **WhatsApp Sending** — One click opens WhatsApp with pre-filled message + PDF link
- **Product Catalog** — Gold / Silver / Diamond with image gallery, purity grades, making charges
- **Inventory Tracking** — Auto-updated on every sale/purchase, manual adjustments, low-stock alerts
- **All Transaction Types** — Sale, Purchase, Repair, Exchange, Custom Order
- **Analytics** — Revenue charts (day/week/month/year), traffic heatmap, top products, customer metrics
- **Metal Rates** — Daily rates for Gold 24K/22K/18K/14K, Silver 999/925, Platinum 950 with **future date scheduling**
- **Customers** — Profile, transaction history, WhatsApp integration

---

## Default Credentials

```
Email:    admin@jever.com
Password: admin123
```

> Change this immediately in Settings after first login.
> vivek soni
