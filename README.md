# CarBoy Customer Backend

## Purpose
CarBoy Customer Backend accepts inspection requests from the Customer Frontend, validates payloads, and stores them in MongoDB for admin-side processing.

### System relationship
- **Customer FE → Customer BE (this repo):** booking intake and validation.
- **Customer BE → Admin BE:** integration-ready for Admin job creation endpoint (`POST /api/admin/jobs`).
- **Admin BE → Technician system:** technician assignment remains fully in Admin/Technician systems.

> **Important:** Admin forwarding is currently disabled because Admin BE requires `technicianId`. Requests are stored locally with `status = PENDING`.

## Tech stack
- Node.js (LTS)
- Express
- MongoDB + Mongoose
- Axios
- Pino
- dotenv, cors, morgan

## Environment
Use `.env.example` for local and `.env.production` for production deployment.

```bash
cp .env.example .env
```

## Run locally
```bash
npm install
npm run dev
```

## Endpoints
### Health
- `GET /health`

### Customer APIs
- `POST /api/customer/inspection-request`
- `GET /api/customer/inspection-requests`

### Example create request payload
```json
{
  "serviceType": "PDI",
  "customerSnapshot": {
    "name": "Rahul",
    "phone": "9876543210",
    "email": "rahul@example.com"
  },
  "vehicleSnapshot": {
    "brand": "Chevrolet",
    "model": "Equinox",
    "year": 2019
  },
  "schedule": {
    "date": "2026-02-10",
    "slot": "11:00 Am-01:00 Pm"
  },
  "location": {
    "address": "HSR Layout, Bangalore",
    "coordinates": {
      "lat": 12.9128,
      "lng": 77.6451
    }
  }
}
```

### Current create response behavior
```json
{
  "success": true,
  "data": {
    "requestId": "REQ-000123",
    "adminJobId": null,
    "status": "PENDING"
  },
  "message": "Inspection request saved. Awaiting admin assignment."
}
```

## Notes
- Request numbering follows `REQ-000001`, `REQ-000002`, ...
- Payment placeholders are present in the schema for future integration.
- Admin forwarding client exists but is intentionally not invoked yet.
