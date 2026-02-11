# Tally Konnect v2 — Code Overview

## What It Does

Tally Konnect is a Node.js web application that fetches payment transactions from the **Konnect API** and imports them as accounting vouchers into **TallyERP / TallyPrime**. It works from any OS and supports both on-premise Tally and Cloud ERP deployments.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Server | Express.js |
| HTTP Client | node-fetch |
| Config | dotenv |
| Frontend | Vanilla HTML/CSS/JS (single file) |
| Data Format | JSON (Konnect API) → XML (Tally Import) |

---

## Project Structure

```
src/
├── server.js              # Express server, API routes, orchestration
├── config.js              # Loads .env variables into a config object
├── mapper.js              # Transforms Konnect transactions → Tally vouchers
├── konnect/
│   └── client.js          # Fetches transaction history from Konnect API
├── tally/
│   ├── client.js          # Posts XML to Tally, parses import results
│   └── xmlBuilder.js      # Builds Tally Import Data XML envelopes
└── public/
    └── index.html         # Web UI (dark theme, date picker, connection tabs)
```

---

## Data Flow

```
Browser (localhost:3333)
    │
    ▼  HTTP
Express Server (server.js)
    │
    ├──► Konnect API ──► JSON transactions
    │         │
    │         ▼
    │    mapper.js ──► normalize & filter
    │         │
    │         ▼
    │    xmlBuilder.js ──► Tally XML vouchers
    │         │
    │         ▼
    └──► Tally (On-Prem or Cloud) ──► Import result
```

1. User selects a date range in the browser UI
2. Server calls Konnect API to fetch transactions for that range
3. `mapper.js` normalizes transactions (handles different field names, type aliases, zero-amount filtering)
4. `xmlBuilder.js` converts each transaction into a Tally Receipt or Payment voucher (double-entry XML)
5. `tally/client.js` POSTs the XML envelope to Tally and parses the CREATED/ALTERED/ERRORS counts

---

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Serve the web UI |
| GET | `/api/connection-defaults` | Return default Tally URLs from env config |
| POST | `/api/test-connection` | Verify Tally is reachable, return company name |
| POST | `/api/import` | Full pipeline: fetch → map → build XML → import to Tally |
| GET | `/api/preview` | Fetch Konnect transactions only (no Tally import) |

---

## Module Responsibilities

### `server.js`
Entry point. Sets up Express, serves static files, defines all API routes, orchestrates the fetch-map-import pipeline.

### `config.js`
Reads `.env` and exports a config object with Konnect URLs/keys, Tally URLs, and ledger names.

### `mapper.js`
- Maps varying field names (`id`/`paymentId`/`transactionId`) to a standard schema
- Normalizes type strings (`credit`/`cr`/`in` → credit; `debit`/`dr`/`out` → debit)
- Infers type from amount sign when type is missing
- Filters out zero-amount transactions
- Defaults missing dates to today

### `konnect/client.js`
- Calls the Konnect History API with `fromDate` and `toDate` query params
- Handles Bearer token auth
- Normalizes response shapes (array, `{ transactions }`, `{ data }`, `{ payments }`)

### `tally/client.js`
- Posts XML to Tally's HTTP endpoint (port 9000 on-prem, or cloud URL)
- Parses XML response to extract CREATED, ALTERED, and ERRORS counts
- Provides `testConnection()` to verify connectivity and retrieve the active company name

### `tally/xmlBuilder.js`
- Builds Tally Import Data XML envelopes containing multiple vouchers
- Creates **Receipt** vouchers for credit transactions (money in)
- Creates **Payment** vouchers for debit transactions (money out)
- Implements double-entry bookkeeping (debit Konnect ledger ↔ credit Cash ledger)
- Escapes XML entities in descriptions and ledger names
- Converts dates to Tally's `YYYYMMDD` format

### `public/index.html`
- Dark-themed single-page UI
- Tabs for On-Prem vs Cloud connection settings
- Date range picker (defaults to last 30 days)
- Fetch & Import / Preview buttons
- Persists connection settings via `localStorage`

---

## Configuration

Key environment variables (see `.env.example`):

```
KONNECT_BASE_URL       # Konnect API base URL
KONNECT_API_KEY        # Bearer token for Konnect
KONNECT_HISTORY_PATH   # API path for transaction history

TALLY_URL              # On-prem Tally endpoint (default: http://localhost:9000)
TALLY_CLOUD_URL        # Cloud ERP endpoint
TALLY_KONNECT_LEDGER   # Ledger name for the Konnect side of entries
TALLY_DEFAULT_CREDIT_LEDGER  # Counter-ledger (e.g., "Cash")

PORT                   # Server port (default: 3333)
HOST                   # Server host (default: 127.0.0.1)
```

---

## Running

```bash
npm install        # Install dependencies
npm start          # Start production server
npm run dev        # Start with --watch for live reload
```

Server runs at `http://localhost:3333` by default.
