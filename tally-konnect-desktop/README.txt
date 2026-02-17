============================================
  Tally Konnect Bridge - Quick Start
============================================

REQUIREMENTS:
  - Windows 10 or later
  - Node.js 18+ (https://nodejs.org)
  - Tally Prime running on this machine

SETUP:
  1. Extract this zip to any folder
  2. Double-click "Setup-TallyKonnectBridge.bat"
  3. The setup script will:
     - Install required packages
     - Download the cloudflared tunnel binary
     - Launch the Bridge application
  4. In the Bridge app, click "Start Tunnel"
  5. Your Tally is now connected to the cloud!

ENVIRONMENT VARIABLES (optional):
  CLOUD_API_URL    - Cloud dashboard URL (default: https://tally-konnect.onrender.com)
  BRIDGE_API_KEY   - API key for secure communication
  TALLY_HOST       - Tally host (default: http://localhost)
  TALLY_PORT       - Tally port (default: 9000)

NEED HELP?
  Visit: https://github.com/mayurthanekar/tally-konnect