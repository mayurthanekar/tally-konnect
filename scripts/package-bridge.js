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
    'scripts/download-bin.js',
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
`.trim();
    fs.writeFileSync(path.join(STAGE_DIR, 'README.txt'), readme);
    console.log('  ✓ README.txt');

    // Create the zip using the system zip command (available on Linux/macOS)
    try {
        // Try using zip command (Linux/macOS)
        execSync(`cd "${path.join(ROOT, '.bridge-staging')}" && zip -r "${OUTPUT_FILE}" TallyKonnectBridge/`, { stdio: 'pipe' });
    } catch {
        // Fallback: try tar (creates .tar.gz instead) then rename
        try {
            execSync(`cd "${path.join(ROOT, '.bridge-staging')}" && tar -czf "${OUTPUT_FILE.replace('.zip', '.tar.gz')}" TallyKonnectBridge/`, { stdio: 'pipe' });
            // If tar worked but not zip, rename the output
            const tarFile = OUTPUT_FILE.replace('.zip', '.tar.gz');
            if (fs.existsSync(tarFile) && !fs.existsSync(OUTPUT_FILE)) {
                fs.renameSync(tarFile, OUTPUT_FILE);
            }
        } catch (err2) {
            // Manual zip fallback using Node.js
            console.log('  ⚠ System zip not available, using manual copy...');
            // Just copy the staging directory to the output
            const manualDir = path.join(OUTPUT_DIR, 'TallyKonnectBridge');
            if (fs.existsSync(manualDir)) fs.rmSync(manualDir, { recursive: true });
            fs.cpSync(STAGE_DIR, manualDir, { recursive: true });
            console.log('  ✓ Files copied to public/downloads/TallyKonnectBridge/');
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
