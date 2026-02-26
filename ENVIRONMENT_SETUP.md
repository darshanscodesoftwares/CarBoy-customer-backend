# 🌍 Multi-Environment Configuration

## Files Created/Modified

### ✅ Environment Files
- **`.env`** - Development configuration (local)
- **`.env.production`** - Production configuration (IONOS)
- **`.env.example`** - Template for reference

### ✅ Configuration Files
- **`src/config/env.js`** - Enhanced with dynamic loading and validation
- **`src/server.js`** - Updated with environment logging
- **`package.json`** - Added npm scripts for both environments

### ✅ Services
- **`src/services/adminAuth.service.js`** - JWT authentication with token caching
- **`src/services/vehicleMaster.service.js`** - Uses auth for Admin API calls

### ✅ Documentation
- **`DEPLOYMENT.md`** - Complete deployment guide

---

## How It Works

### Development Mode
```bash
npm run dev
# Loads .env automatically
# PORT: 5005
# Admin: http://localhost:5000
# Credentials: admin@carboy.dev / Admin@123456
```

### Production Mode (Local Testing)
```bash
npm run dev:prod
# Loads .env.production
# PORT: 5000
# Admin: https://api.mycarboy.in
# Credentials: admin@carboy.com / Admin@123456
```

### Production Mode (IONOS)
```bash
NODE_ENV=production pm2 start src/server.js
# Automatically loads .env.production
# Uses IONOS MongoDB and Admin Backend
```

---

## Key Enhancements

### 🔒 Dynamic Environment Loading
```javascript
// Automatically selects based on NODE_ENV
const envFile = nodeEnv === 'production' ? '.env.production' : '.env';
dotenv.config({ path: path.resolve(__dirname, '../../', envFile) });
```

### ✅ Environment Validation
```javascript
// Throws error in production if required vars missing
validateEnv(); // Checks: MONGODB_URI, ADMIN_BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
```

### 🔐 JWT Token Caching
- Authenticates once with Admin Backend
- Caches token with 1-minute refresh buffer
- Automatically refreshes before expiry

### 📊 Environment Logging
```
Starting Customer Backend in DEVELOPMENT mode
✅ Server running on port 5005
```

---

## Configuration Comparison

| Setting | Development | Production |
|---------|-------------|-----------|
| NODE_ENV | development | production |
| PORT | 5005 | 5000 |
| Database | localhost:27017 | 127.0.0.1:27017 |
| Admin URL | http://localhost:5000 | https://api.mycarboy.in |
| Email | admin@carboy.dev | admin@carboy.com |
| CORS | localhost:* | render.com |

---

## NPM Scripts

```json
{
  "start": "node src/server.js",           // Production start
  "start:prod": "NODE_ENV=production node src/server.js",
  "dev": "nodemon src/server.js",          // Dev with reload
  "dev:prod": "NODE_ENV=production nodemon src/server.js"
}
```

---

## Deployment Checklist

- [ ] Update `.env.production` with correct credentials
- [ ] Ensure MongoDB is running on IONOS
- [ ] Verify Admin Backend is accessible at https://api.mycarboy.in
- [ ] Deploy code to IONOS
- [ ] Run `npm install --production`
- [ ] Start with PM2: `NODE_ENV=production pm2 start src/server.js`
- [ ] Configure Nginx reverse proxy
- [ ] Test endpoints from Render frontend
- [ ] Monitor logs: `pm2 logs carboy-customer-backend`

---

## Testing Different Environments

```bash
# Test locally with dev config
npm run dev

# Test locally with prod config (mock production)
npm run dev:prod

# Check which env is loaded
cat .env | grep NODE_ENV
cat .env.production | grep NODE_ENV
```

---

## API Endpoints

All endpoints are accessible through CORS-enabled paths:

### Vehicle Master (Public)
- `GET /api/customer/vehicle-master/brands`
- `GET /api/customer/vehicle-master/brands/:brandId/models`

### Inspection Requests
- `POST /api/customer/inspection-request`
- `GET /api/customer/inspection-requests`

---

## Troubleshooting

**Error: Missing required environment variables**
→ Ensure .env or .env.production has all required variables

**Error: Admin authentication failed**
→ Check ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_BASE_URL

**Error: MongoDB connection failed**
→ Verify MONGODB_URI is correct and MongoDB is running

**CORS errors**
→ Update CORS_ORIGINS in the appropriate .env file

