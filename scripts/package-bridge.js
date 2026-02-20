// scripts/package-bridge.js
// Packages the tally-konnect-desktop directory into a zip for download
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DESKTOP_DIR = path.join(ROOT, 'tally-konnect-desktop');
const OUTPUT_DIR = path.join(ROOT, 'public', 'downloads');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'TallyKonnectBridge.zip');

// Files to include in the package
const INCLUDE_FILES = [
    'main.js',
    'preload.js',
    'renderer.js',
    'index.html',
    'package.json',
    'Setup-TallyKonnectBridge.bat',
    'RUN_BRIDGE.bat',
    'scripts/download-bin.js',
    '.env.example',
];

function packageBridge() {
    console.log('📦 Packaging Desktop Bridge...');

    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Remove old zip if exists
    if (fs.existsSync(OUTPUT_FILE)) {
        fs.unlinkSync(OUTPUT_FILE);
    }

    // Create a temporary staging directory
    const STAGE_DIR = path.join(ROOT, '.bridge-staging', 'TallyKonnectBridge');
    if (fs.existsSync(path.join(ROOT, '.bridge-staging'))) {
        fs.rmSync(path.join(ROOT, '.bridge-staging'), { recursive: true });
    }
    fs.mkdirSync(STAGE_DIR, { recursive: true });
    fs.mkdirSync(path.join(STAGE_DIR, 'scripts'), { recursive: true });

    // Copy files
    for (const file of INCLUDE_FILES) {
        const src = path.join(DESKTOP_DIR, file);
        const dest = path.join(STAGE_DIR, file);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
            console.log(`  ✓ ${file}`);
        } else {
            console.warn(`  ⚠ ${file} not found, skipping`);
        }
    }

    // Create README.txt
    const readme = `
============================================
  Tally Konnect Bridge - Quick Start
============================================

REQUIREMENTS:
  - Windows 10 or later
  - Node.js 18+ (https://nodejs.org)
  - Tally Prime running on this machine (Port 9000)

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
`.trim();
    fs.writeFileSync(path.join(STAGE_DIR, 'README.txt'), readme);
    console.log('  ✓ README.txt');

    // Create the zip
    try {
        if (process.platform === 'win32') {
            // Windows: Use PowerShell Compress-Archive
            console.log('  📦 Zipping with PowerShell...');
            execSync(`powershell -Command "Compress-Archive -Path '${STAGE_DIR}\\*' -DestinationPath '${OUTPUT_FILE}' -Force"`, { stdio: 'pipe' });
        } else {
            // Linux/macOS: Use zip command
            console.log('  📦 Zipping with zip...');
            execSync(`cd "${path.join(ROOT, '.bridge-staging')}" && zip -r "${OUTPUT_FILE}" TallyKonnectBridge/`, { stdio: 'pipe' });
        }
    } catch (err) {
        console.warn('  ⚠ Zip command failed, trying tar fallback...');
        try {
            execSync(`cd "${path.join(ROOT, '.bridge-staging')}" && tar -czf "${OUTPUT_FILE.replace('.zip', '.tar.gz')}" TallyKonnectBridge/`, { stdio: 'pipe' });
            const tarFile = OUTPUT_FILE.replace('.zip', '.tar.gz');
            if (fs.existsSync(tarFile)) {
                fs.renameSync(tarFile, OUTPUT_FILE);
            }
        } catch (err2) {
            console.log('  ⚠ All zip methods failed, using manual copy fallback...');
            const manualDir = path.join(OUTPUT_DIR, 'TallyKonnectBridge');
            if (fs.existsSync(manualDir)) fs.rmSync(manualDir, { recursive: true });
            fs.cpSync(STAGE_DIR, manualDir, { recursive: true });
        }
    }

    // Clean up staging
    fs.rmSync(path.join(ROOT, '.bridge-staging'), { recursive: true });

    if (fs.existsSync(OUTPUT_FILE)) {
        const size = (fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1);
        console.log(`\n✅ Bridge package created: ${OUTPUT_FILE} (${size} KB)`);
    } else {
        console.log('\n✅ Bridge package files ready in public/downloads/');
    }
}

packageBridge();
