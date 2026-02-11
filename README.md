# Tally Konnect Import Addon (MVP)

**Web-based app** that works from **any OS** (Linux, Windows, macOS). Fetches transaction history from **Konnect History API** by date range and imports into **TallyERP / TallyPrime Live Company** via:

- **On-Prem TallyERP** – direct connection to Tally on your machine or LAN (e.g. `http://localhost:9000` or `http://192.168.1.10:9000`)
- **Cloud ERP** – connection to hosted Tally / Tally Cloud using a configurable URL and optional API key

## Prerequisites

- **Node.js** 18+
- **Tally** (TallyPrime or Tally.ERP 9) with company open and **Developer** / **Tally Connector** enabled (listening for XML on port 9000 for On-Prem), or **Tally Cloud ERP** URL
- **Konnect** API access: base URL and, if required, API key for the History API

## Setup

1. Clone or copy this project, then install dependencies:

   ```bash
   npm install
   ```

2. Copy environment configuration:

   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and set:

   - **KONNECT_BASE_URL** – Your Konnect API base URL (e.g. `https://api.konnect.network` or sandbox)
   - **KONNECT_API_KEY** – API key / Bearer token if the Konnect History API requires authentication
   - **KONNECT_HISTORY_PATH** – Path to the history/transactions endpoint (e.g. `/v1/transactions`). The addon appends `fromDate` and `toDate` as query parameters (YYYY-MM-DD).
   - **TALLY_URL** – Default On-Prem URL (e.g. `http://localhost:9000`)
   - **TALLY_CLOUD_URL** – (Optional) Default Cloud ERP URL for the web UI
   - **TALLY_KONNECT_LEDGER** – Ledger name in Tally for Konnect side of the entry (e.g. `Konnect Bank`). Create this ledger under Bank Accounts or Current Assets in Tally if it doesn’t exist.
   - **TALLY_DEFAULT_CREDIT_LEDGER** – Other side of the entry (e.g. `Cash` or `Sundry Debtors`)

## Konnect History API

The MVP expects a **date-filtered history** endpoint. The app calls:

- **URL:** `{KONNECT_BASE_URL}{KONNECT_HISTORY_PATH}?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD`
- **Method:** GET  
- **Headers:** `Authorization: Bearer {KONNECT_API_KEY}` if `KONNECT_API_KEY` is set

If your Konnect provider uses different parameter names (e.g. `startDate`/`endDate`) or a different response shape, update `src/konnect/client.js` (e.g. `normalizeResponse()` and the query params).

Expected response shape (one of):

- Array of transactions, or  
- `{ transactions: [ ... ] }`, or  
- `{ data: [ ... ] }`, or  
- `{ payments: [ ... ] }` (mapped to a standard transaction shape)

Each transaction should have (or be mapped to): `id`, `date`, `amount`, `type` (`credit`/`debit`), `description`.

## Run

1. **Open a terminal in the project folder** (the folder that contains `package.json`). For example:

   ```bash
   cd "/Users/Swami/Cursor/Tally Konnect v2"
   ```
   (On Windows, use the path to your project, e.g. `cd "C:\Users\YourName\Tally Konnect v2"`.)

2. Start the server:

   ```bash
   npm start
   ```

3. Open **http://localhost:3333** in a browser (Chrome, Firefox, Edge, etc.).

4. **Connection**
   - **On-Prem TallyERP**: Select “On-Prem TallyERP”, enter Tally URL (e.g. `http://localhost:9000` or `http://<LAN-IP>:9000`). Use **Test connection** to verify.
   - **Cloud ERP**: Select “Cloud ERP”, enter your Cloud ERP URL and optional API key, then **Test connection**.

5. **Import**: Set **From date** and **To date**, then click **Fetch & Import to Tally**. The app fetches from Konnect, maps to vouchers, and POSTs Import Data XML to the selected Tally (On-Prem or Cloud). Check Tally’s Day Book or registers to verify.

Connection choices are saved in the browser (localStorage) so you can use the same settings from any machine that can reach the server and Tally.

Use **Preview (fetch only)** to test Konnect and see transaction count without sending data to Tally.

## Project structure

- `src/config.js` – Reads `.env` (Konnect base URL, API key, Tally URL, ledger names).
- `src/konnect/client.js` – Fetches history from Konnect with `fromDate`/`toDate`.
- `src/tally/xmlBuilder.js` – Builds Tally Import Data XML (Receipt/Payment vouchers).
- `src/tally/client.js` – POSTs XML to Tally (On-Prem or Cloud URL); `testConnection()` for connection check.
- `src/mapper.js` – Maps Konnect transactions to voucher objects (date, amount, type, description).
- `src/server.js` – Express server: `/api/import`, `/api/preview`, `/api/connection-defaults`, `/api/test-connection`.
- `src/public/index.html` – Web UI: connection type (On-Prem / Cloud), URLs, Test connection, date range, import.

## Tally side

- Create a ledger for Konnect (e.g. **Konnect Bank**) under the appropriate group (e.g. Bank Accounts).
- Ensure the other ledger (e.g. **Cash**) exists.
- Vouchers are created as **Receipt** (for credits) and **Payment** (for debits) with Accounting Voucher View.

## License

MIT
