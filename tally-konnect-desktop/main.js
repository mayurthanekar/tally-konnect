require('dotenv').config();
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios');
const WebSocket = require('ws');

let mainWindow;
let bridgeWs = null;       // Active WebSocket to Render relay
let bridgePort = 9000;     // Local Tally port (set when relay starts)
let reconnectTimer = null;
let reconnectDelay = 1000; // Start at 1s, doubles up to 30s
let intentionalClose = false;
let pingTimer = null;

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 420,
        height: 620,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        title: 'Tally Konnect Bridge',
        resizable: false,
        autoHideMenuBar: true,
    });
    mainWindow.loadFile('index.html');
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.whenReady().then(() => {
        createWindow();
        app.setLoginItemSettings({
            openAtLogin: true,
            path: process.execPath,
            args: ['--process-start-args', '"--hidden"'],
        });
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// ── IPC: Check Tally ──────────────────────────────────────────────────────────

ipcMain.handle('check-tally', async (event, startPort = 9000) => {
    for (let port = startPort; port <= startPort + 5; port++) {
        try {
            await axios.get(`http://localhost:${port}`, { timeout: 500 });
            return { success: true, port, status: 200 };
        } catch (error) {
            if (error.response) {
                return { success: true, port, status: error.response.status };
            }
        }
    }
    return { success: false, error: 'Tally Prime not found on ports 9000-9005' };
});

// ── IPC: Start Relay ──────────────────────────────────────────────────────────

ipcMain.handle('start-relay', async (event, port = 9000) => {
    bridgePort = port;
    intentionalClose = false;
    reconnectDelay = 1000;

    return new Promise((resolve) => {
        connectToRelay(resolve);
    });
});

// ── IPC: Stop Relay ───────────────────────────────────────────────────────────

ipcMain.handle('stop-relay', async () => {
    intentionalClose = true;
    clearTimeout(reconnectTimer);
    clearInterval(pingTimer);
    if (bridgeWs) {
        bridgeWs.close();
        bridgeWs = null;
    }
    notifyRenderer('disconnected', 'Disconnected');
    return { success: true };
});

// ── IPC: Get Relay Status ─────────────────────────────────────────────────────

ipcMain.handle('get-relay-status', async () => {
    const connected = bridgeWs && bridgeWs.readyState === WebSocket.OPEN;
    return { connected };
});

// ── Core: Connect to Relay ────────────────────────────────────────────────────

function connectToRelay(initialResolve = null) {
    const cloudUrl = process.env.CLOUD_URL || 'https://tally-konnect.onrender.com';
    const bridgeKey = process.env.BRIDGE_API_KEY;

    if (!bridgeKey) {
        const msg = 'BRIDGE_API_KEY is not set in .env';
        console.error('[Bridge]', msg);
        notifyRenderer('error', msg);
        if (initialResolve) initialResolve({ success: false, error: msg });
        return;
    }

    // Convert https → wss, http → ws
    const wsUrl = cloudUrl.replace(/^https/, 'wss').replace(/^http/, 'ws') + '/ws/bridge';
    console.log(`[Bridge] Connecting to relay: ${wsUrl}`);
    notifyRenderer('connecting', 'Connecting to Cloud...');

    const ws = new WebSocket(wsUrl, {
        headers: { 'x-bridge-key': bridgeKey },
    });

    bridgeWs = ws;

    ws.on('open', () => {
        console.log('[Bridge] Relay connected');
        reconnectDelay = 1000; // Reset backoff on success
        notifyRenderer('connected', 'Connected');
        startPing(ws);
        if (initialResolve) {
            initialResolve({ success: true });
            initialResolve = null; // Only resolve once
        }
    });

    ws.on('message', async (data) => {
        let msg;
        try {
            msg = JSON.parse(data.toString());
        } catch {
            console.warn('[Bridge] Bad JSON from relay');
            return;
        }

        if (msg.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
            return;
        }

        if (msg.type === 'request' && msg.id && msg.xml) {
            // Forward XML to local Tally, return response
            try {
                const resp = await axios.post(`http://localhost:${bridgePort}`, msg.xml, {
                    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
                    timeout: 15000,
                    responseType: 'text',
                    validateStatus: () => true,
                });
                ws.send(JSON.stringify({ id: msg.id, type: 'response', xml: resp.data }));
            } catch (err) {
                console.error('[Bridge] Tally request failed:', err.message);
                ws.send(JSON.stringify({ id: msg.id, type: 'error', error: err.message }));
            }
        }
    });

    ws.on('close', (code, reason) => {
        console.warn(`[Bridge] Relay closed — code:${code} reason:${reason.toString()}`);
        clearInterval(pingTimer);
        bridgeWs = null;

        if (initialResolve) {
            // Failed on first connect attempt
            initialResolve({ success: false, error: `Could not connect to relay (code ${code})` });
            initialResolve = null;
        }

        if (!intentionalClose) {
            scheduleReconnect();
        }
    });

    ws.on('error', (err) => {
        console.error('[Bridge] WebSocket error:', err.message);
        notifyRenderer('error', `Error: ${err.message}`);
    });
}

// ── Reconnect with exponential backoff ────────────────────────────────────────

function scheduleReconnect() {
    const delay = Math.min(reconnectDelay, 30000);
    console.log(`[Bridge] Reconnecting in ${delay}ms...`);
    notifyRenderer('reconnecting', `Reconnecting in ${Math.round(delay / 1000)}s...`);
    reconnectTimer = setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 2, 30000);
        connectToRelay();
    }, delay);
}

// ── Keepalive ping ────────────────────────────────────────────────────────────

function startPing(ws) {
    clearInterval(pingTimer);
    pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
        }
    }, 25000);
}

// ── Helper: Push status to renderer ──────────────────────────────────────────

function notifyRenderer(status, message) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('relay-status', { status, message });
    }
}
