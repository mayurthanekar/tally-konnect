# Tally Konnect Bridge

The Tally Konnect Bridge is a lightweight desktop application that securely connects your local Tally Prime installation to the Tally Konnect Cloud Dashboard.

## Features
- **Auto-Discovery:** Automatically finds Tally Prime running on localhost ports (9000-9005).
- **Secure Tunnel:** Creates an encrypted Cloudflare Tunnel. No port forwarding required.
- **Background Mode:** Runs quietly in the system tray.

## Installation

1. **Download** the latest installer (`.exe`) from the Cloud Dashboard -> Desktop Bridge page.
2. **Run** the installer.
3. The app will launch automatically. It also adds itself to startup.

## Usage

1. **Open Tally Prime** and ensure the company is loaded.
   - Verify Tally is running on port 9000 (F1: Help -> Settings -> Connectivity).
2. **Launch Bridge App** (if not already running).
3. Click **Start Connection**.
   - Status will change to "Connected" (Green dot).
4. You can minimize the app to the tray by clicking "Minimize to Tray" or the window close button.
5. To quit completely, right-click the tray icon and select "Quit".

## Troubleshooting

- **Tally Not Found:** Ensure Tally is running and ODBC Server is enabled on port 9000.
- **Tunnel Failed:** Check your internet connection.
- **App Missing:** Check the system tray (near the clock) for the Tally icon.

## Design System

The app UI follows the **Novus Design Standards** (Fynd's Design System).
*Note: Due to package registry restrictions, the UI is implemented using custom CSS to match Novus aesthetics rather than importing the private `novus-web` library.*

## Digital Signature (Known Publisher)

To run the app as a **Known Publisher** on Windows, you must sign the binaries.

### 1. Electron App (.exe)
The `package.json` is configured to use environment variables for signing. Before running `npm run dist`, set these:

- `WIN_CSC_LINK`: Path to your `.pfx` certificate file.
- `WIN_CSC_KEY_PASSWORD`: Password for the `.pfx` file.

### 2. Setup Batch File (.bat)
Batch files cannot be signed natively as "Known Publisher" easily. We recommend wrapping it into an `.exe`:

1.  Use a tool like **Bat-To-Exe-Converter** or **iexpress** (built-in Windows tool).
2.  Once you have `Setup-TallyBridge.exe`, sign it using `signtool` (included in Windows SDK):
    ```bash
    signtool sign /f your-cert.pfx /p your-password /tr http://timestamp.digicert.com /td sha256 /fd sha256 Setup-TallyBridge.exe
    ```

## Development

```bash
# Install dependencies
npm install

# Run locally
npm start

# Build installer
npm run dist
```
