# 🚀 CarBoy Customer Backend - Deployment Guide

## Environment Setup

This backend supports **two environments**:
- **Development** (local): `.env` file
- **Production** (IONOS): `.env.production` file

### Environment Variables

#### Development (.env)
```bash
NODE_ENV=development
PORT=5005
MONGODB_URI=mongodb://localhost:27017/carboy_dev
ADMIN_BASE_URL=http://localhost:5000/api/admin
CORS_ORIGINS=http://localhost:5173,http://localhost:5174
ADMIN_EMAIL=admin@carboy.dev
ADMIN_PASSWORD=Admin@123456
```

#### Production (.env.production)
```bash
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/mycarboy_prod
ADMIN_BASE_URL=https://api.mycarboy.in/api/admin
CORS_ORIGINS=https://carboy-customer.onrender.com
ADMIN_EMAIL=admin@carboy.com
ADMIN_PASSWORD=Admin@123456
PUBLIC_BASE_URL=https://api.mycarboy.in
```

## Running Locally

```bash
# Install dependencies
npm install

# Development mode with hot reload
npm run dev

# Production mode (local)
npm run dev:prod

# Standard start
npm start
```

The server will automatically load the correct `.env` file based on `NODE_ENV`.

## Deploying to IONOS

### 1. SSH into IONOS VPS
```bash
ssh user@api.mycarboy.in
```

### 2. Clone/Update Repository
```bash
cd /var/www/carboy-customer-backend
git pull origin main
```

### 3. Install Dependencies
```bash
npm install --production
```

### 4. Set Environment
Ensure `.env.production` is in the root directory with correct credentials.

### 5. Start with PM2 (Recommended)
```bash
# Install PM2 globally (if not already installed)
npm install -g pm2

# Start the application
NODE_ENV=production pm2 start src/server.js --name "carboy-customer-backend"

# Save PM2 config for auto-restart
pm2 save

# Monitor logs
pm2 logs carboy-customer-backend
```

### 6. Configure Nginx Reverse Proxy
```nginx
server {
    listen 80;
    server_name api.mycarboy.in;

    location /api/customer {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Environment Variables

| Variable | Dev | Prod | Description |
|----------|-----|------|-------------|
| NODE_ENV | development | production | Environment mode |
| PORT | 5005 | 5000 | Server port |
| MONGODB_URI | localhost | 127.0.0.1 | Database connection |
| ADMIN_BASE_URL | localhost:5000 | api.mycarboy.in | Admin service URL |
| ADMIN_EMAIL | admin@carboy.dev | admin@carboy.com | Service account email |
| ADMIN_PASSWORD | Admin@123456 | Admin@123456 | Service account password |
| CORS_ORIGINS | localhost:* | render.com | Allowed CORS origins |

## Key Features

✅ **Dynamic Environment Loading**: Automatically loads correct `.env` based on NODE_ENV  
✅ **Environment Validation**: Throws error if required variables are missing (production)  
✅ **Service-to-Service Auth**: Authenticates with Admin Backend using JWT  
✅ **Token Caching**: Caches auth tokens with 1-minute refresh buffer  
✅ **Production Logging**: Enhanced logs showing environment and configuration  

## Troubleshooting

### Token Not Provided Error
- Check ADMIN_EMAIL and ADMIN_PASSWORD are correct
- Verify ADMIN_BASE_URL is accessible
- Check Admin Backend is running

### Connection Refused
- Verify MongoDB is running
- Check firewall rules allow connections
- Ensure port 5000 is not in use

### CORS Errors
- Update CORS_ORIGINS in appropriate `.env` file
- Restart the server
- Clear browser cache

## API Endpoints

**Vehicle Master (Public - No Auth Required)**
```
GET /api/customer/vehicle-master/brands
GET /api/customer/vehicle-master/brands/:brandId/models
```

**Inspection Requests**
```
POST /api/customer/inspection-request
GET /api/customer/inspection-requests
```

## Monitoring

View logs in production:
```bash
pm2 logs carboy-customer-backend

# Or with tail
pm2 logs carboy-customer-backend --lines 100
```

Monitor with PM2 Dashboard:
```bash
pm2 web  # Access at http://localhost:9615
```
