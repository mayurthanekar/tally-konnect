const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const axios = require('axios');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let tray;
let tunnelProcess;
let isQuitting = false;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 400,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        title: 'Tally Konnect Bridge',
        resizable: false,
        autoHideMenuBar: true,
        icon: path.join(__dirname, 'icon.ico')
    });

    mainWindow.loadFile('index.html');

    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
        return false;
    });
}

function createTray() {
    const iconPath = path.join(__dirname, 'icon.ico');
    const trayIcon = nativeImage.createFromPath(iconPath);

    tray = new Tray(trayIcon.isEmpty() ? nativeImage.createEmpty() : trayIcon);

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Show App', click: () => mainWindow.show() },
        {
            label: 'Quit', click: () => {
                isQuitting = true;
                if (tunnelProcess) tunnelProcess.kill();
                app.quit();
            }
        }
    ]);

    tray.setToolTip('Tally Konnect Bridge');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        mainWindow.show();
    });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });

    app.whenReady().then(() => {
        createWindow();
        createTray();

        // Auto-start on login (visible)
        app.setLoginItemSettings({
            openAtLogin: true,
            path: process.execPath,
            args: []
        });

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });
}

// Don't quit when all windows are closed (we run in background)
app.on('window-all-closed', () => {
    // Do nothing, keep running in tray
});

app.on('before-quit', () => {
    isQuitting = true;
});

// IPC Handlers
ipcMain.handle('check-tally', async (event, startPort = 9000) => {
    // Scan ports 9000-9005
    for (let port = startPort; port <= startPort + 5; port++) {
        try {
            // Tally returns a specific response on root or has an open port
            await axios.get(`http://localhost:${port}`, { timeout: 500 });
            return { success: true, port, status: 200 };
        } catch (error) {
            if (error.response) {
                // If we get a response (even 404/500), something is listening there
                return { success: true, port, status: error.response.status };
            }
        }
    }
    return { success: false, error: 'Tally Prime not found on ports 9000-9005' };
});

ipcMain.handle('start-tunnel', async (event, port) => {
    return new Promise(async (resolve) => {
        try {
            const binName = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
            const binPath = path.join(__dirname, 'bin', binName);

            // 1. Check if binary exists
            if (!fs.existsSync(binPath)) {
                return resolve({ success: false, error: `Cloudflared binary not found at ${binPath}. Please run the install script.` });
            }

            // 2. Start Cloudflared (Quick Tunnel)
            console.log(`Starting tunnel: ${binPath} tunnel --url http://localhost:${port}`);
            tunnelProcess = spawn(binPath, ['tunnel', '--url', `http://localhost:${port}`]);

            let urlFound = false;

            const handleOutput = async (data) => {
                const output = data.toString();
                // Regex to find the trycloudflare.com URL
                const regex = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/;
                const match = output.match(regex);

                if (match && !urlFound) {
                    urlFound = true;
                    const tunnelUrl = match[0];
                    console.log('Tunnel URL Found:', tunnelUrl);

                    // 3. Register with Cloud App
                    // Using the production Render URL
                    const cloudUrl = 'https://tally-konnect.onrender.com';

                    try {
                        const bridgeKey = process.env.BRIDGE_API_KEY || 'dev-bridge-key'; // Should be same as server
                        await axios.put(`${cloudUrl}/api/tally-connection`, {
                            host: tunnelUrl,
                            port: '80',
                            platform: 'windows'
                        }, {
                            headers: { 'x-bridge-key': bridgeKey }
                        });
                        resolve({ success: true, url: tunnelUrl });
                    } catch (apiErr) {
                        console.error('API Update Failed:', apiErr.message);
                        resolve({ success: true, url: tunnelUrl, warning: 'Failed to update Cloud App' });
                    }
                }
            };

            tunnelProcess.stderr.on('data', handleOutput);
            tunnelProcess.stdout.on('data', handleOutput);

            tunnelProcess.on('error', (err) => {
                console.error('Failed to start tunnel process:', err);
                resolve({ success: false, error: 'Failed to start cloudflared.' });
            });

            // Timeout if URL not found in 15s
            setTimeout(() => {
                if (!urlFound) {
                    // Don't kill process yet, maybe it's just slow? 
                    // But we need to resolve the promise.
                    resolve({ success: false, error: 'Tunnel timed out. Could not find URL.' });
                }
            }, 15000);

        } catch (error) {
            console.error('Tunnel Error:', error.message);
            resolve({ success: false, error: error.message });
        }
    });
});

ipcMain.handle('stop-tunnel', async () => {
    if (tunnelProcess) {
        tunnelProcess.kill();
        tunnelProcess = null;
    }
    return { success: true };
});
