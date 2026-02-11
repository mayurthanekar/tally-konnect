# Tally Konnect v2.0 - Full Utility Suite

> 🔗 **Tally Prime ↔ Fynd Commerce** data integration platform.  
> Import sales data, generate Tally XML, sync inventory, manage B2B parties — all from a modern web UI.

## Features

- 🔄 **5 Sync Modules**: Closing Stock, Sales Orders, Return Orders, Sales Vouchers, Credit Notes
- 📊 **Dashboard**: Real-time status overview with connection monitoring
- 🔌 **API Configuration**: Per-module endpoint, auth (Bearer/API Key/Basic/OAuth2), headers
- 🗺️ **Field Mapping**: Visual drag-and-drop mapping between API JSON ↔ Tally XML keys
- 📥 **Data Import**: Upload Excel/CSV, preview data, generate Tally-compatible XML
- 🏢 **B2B Settings**: Auto-create party masters, GSTIN validation, buyer management
- ⏰ **Scheduler**: Cron-based auto-sync with preset frequencies
- 🔐 **Security**: AES-256-GCM encryption, Zod validation, Helmet, rate limiting

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, inline CSS (Fynd Nitrozen-inspired) |
| Backend | Node.js 18+, Express.js |
| Database | PostgreSQL (via Knex.js) |
| Security | AES-256-GCM, Helmet, express-rate-limit, Zod |
| Scheduler | node-cron |
| File Parsing | xlsx, papaparse |
| XML | fast-xml-parser, xmlbuilder2 |
| Logging | pino + pino-pretty |

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- PostgreSQL (local or Docker)

### 1. Clone & Install
```bash
git clone https://github.com/mayurthanekar/tally-konnect.git
cd tally-konnect
npm install
```

### 2. Set up PostgreSQL
```bash
# Option A: Using Docker
docker run --name tally-pg -e POSTGRES_DB=tally_konnect -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16

# Option B: Use your existing PostgreSQL
```

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env with your database URL and generate an encryption key:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Run
```bash
npm run dev       # Backend with nodemon
# or
npm start         # Runs migrations, seeds, then starts server
```

### 5. Build Frontend (if not already built)
```bash
npm run build:frontend
```

Open http://localhost:3001 in your browser.

## Deployment (Render.com)

### Automatic (via render.yaml)
1. Push to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com/) → New → Blueprint
3. Connect your GitHub repo
4. Render will use `render.yaml` to create the web service + database

### Manual Setup
1. **Create PostgreSQL Database** on Render (or use [Neon](https://neon.tech) for free)
2. **Create Web Service**:
   - Runtime: Node
   - Build: `npm install`
   - Start: `npm start`
   - Health Check: `/api/health`
3. **Set Environment Variables**:
   - `DATABASE_URL` — from your PostgreSQL provider
   - `ENCRYPTION_KEY` — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `JWT_SECRET` — any random string
   - `NODE_ENV` = `production`
   - `CORS_ORIGIN` = `*`
   - `LOG_LEVEL` = `info`
   - `LOG_FORMAT` = `json`

## Project Structure

```
├── src/
│   ├── server.js           # Express app + static file serving
│   ├── config/             # Centralised env config
│   ├── routes/             # API route definitions
│   ├── controllers/        # Request handlers
│   ├── services/           # Business logic (Tally XML, Fynd API, sync engine)
│   ├── middleware/         # Error handling, validation, uploads, rate limiting
│   ├── db/                 # Knex config, migrations, seeds
│   └── utils/              # Encryption, logging, validators, errors
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Main React application (1486 lines)
│   │   ├── api.js          # Frontend API bridge
│   │   └── index.js        # React entry point
│   └── public/
├── package.json            # Root package (backend deps + build scripts)
├── render.yaml             # Render deployment config
└── .env.example            # Environment template
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/tally-connection` | Get Tally connection settings |
| PUT | `/api/tally-connection` | Update Tally connection |
| POST | `/api/tally-connection/test` | Test Tally connectivity |
| GET | `/api/dashboard/stats` | Dashboard statistics |
| GET | `/api/configs` | Get all API configs |
| PUT | `/api/configs/:moduleId` | Save API config |
| PATCH | `/api/configs/:moduleId/toggle` | Toggle module |
| POST | `/api/configs/:moduleId/test` | Test module connection |
| GET | `/api/mappings` | Get field mappings |
| POST | `/api/mappings` | Save mappings |
| POST | `/api/mappings/upload` | Upload mapping file |
| POST | `/api/import/upload` | Upload import data |
| POST | `/api/import/generate-xml` | Generate Tally XML |
| POST | `/api/import/party-masters-xml` | Generate party XML |
| GET | `/api/b2b-settings` | Get B2B settings |
| PUT | `/api/b2b-settings` | Update B2B settings |
| GET | `/api/schedules` | Get all schedules |
| PUT | `/api/schedules/:moduleId` | Update schedule |
| POST | `/api/schedules/:moduleId/run` | Run sync now |
| POST | `/api/save-all` | Save all config at once |

## License

ISC
