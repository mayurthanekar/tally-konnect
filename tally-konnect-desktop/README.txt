============================================
  Tally Konnect Bridge - Quick Start
============================================

REQUIREMENTS:
  - Windows 10 or later
  - Node.js 18+ (https://nodejs.org)
  - Tally Prime running on this machine (Port 9000-9005 or 9999)

SETUP:
  1. Extract this zip to any folder
  2. Double-click "Setup-TallyKonnectBridge.bat"
  3. The setup script will:
     - Install required packages
     - Launch the Bridge application
  4. In the Bridge app, click "Connect to Cloud"
  5. Your Tally is now connected to the cloud via persistent WebSocket!

ENVIRONMENT VARIABLES (optional):
  CLOUD_URL        - Cloud dashboard URL (default: https://tally-konnect.onrender.com)
  BRIDGE_API_KEY   - API key for secure communication
  TALLY_HOST       - Tally host (default: http://localhost)
  TALLY_PORT       - Tally port (default: 9000)

HOW IT WORKS:
  The Bridge establishes an outbound WebSocket connection to the Tally Konnect
  cloud server. All communication is encrypted and happens over standard HTTP/S
  ports, requiring no firewall changes or public IP on your local network.

NEED HELP?
  Visit: https://github.com/mayurthanekar/tally-konnect