// src/services/ws-relay.service.js
// Manages the persistent WebSocket connection from the local KonnectBridge app.
// The bridge connects HERE; the cloud app then routes Tally XML through the socket.

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const PING_INTERVAL_MS = 25000; // 25s — Render idles at 30s
const REQUEST_TIMEOUT_MS = 20000; // 20s per proxied Tally request

class WsRelayService extends EventEmitter {
    constructor() {
        super();
        this._bridgeSocket = null;   // The one active bridge WebSocket
        this._pendingRequests = new Map(); // id → { resolve, reject, timer }
        this._pingTimer = null;
        this._wss = null;
    }

    /**
     * Call once from server.js after creating the WebSocketServer.
     * @param {import('ws').WebSocketServer} wss
     */
    attach(wss) {
        this._wss = wss;

        wss.on('connection', (ws, req) => {
            // ── Authenticate ──────────────────────────────────────────────────────────
            const bridgeKey = req.headers['x-bridge-key'];
            if (!BRIDGE_API_KEY || bridgeKey !== BRIDGE_API_KEY) {
                logger.warn('[WS Relay] Rejected connection — bad bridge key');
                ws.close(4001, 'Unauthorized');
                return;
            }

            // ── Accept — only one bridge allowed at a time ────────────────────────────
            if (this._bridgeSocket) {
                logger.info('[WS Relay] Replacing existing bridge connection');
                this._bridgeSocket.terminate();
                this._clearPing();
            }

            this._bridgeSocket = ws;
            logger.info('[WS Relay] Bridge connected — authenticated');
            this.emit('connected');

            // ── Start keepalive ping ──────────────────────────────────────────────────
            this._startPing(ws);

            // ── Handle messages from bridge ───────────────────────────────────────────
            ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());

                    // Bridge sends back: { id, type: 'response', xml } or { id, type: 'error', error }
                    if (msg.type === 'response' && msg.id) {
                        const pending = this._pendingRequests.get(msg.id);
                        if (pending) {
                            clearTimeout(pending.timer);
                            this._pendingRequests.delete(msg.id);
                            pending.resolve(msg.xml);
                        }
                    } else if (msg.type === 'error' && msg.id) {
                        const pending = this._pendingRequests.get(msg.id);
                        if (pending) {
                            clearTimeout(pending.timer);
                            this._pendingRequests.delete(msg.id);
                            pending.reject(new Error(msg.error || 'Bridge returned an error'));
                        }
                    } else if (msg.type === 'pong') {
                        // keepalive — ignore
                    }
                } catch (err) {
                    logger.warn({ err }, '[WS Relay] Could not parse message from bridge');
                }
            });

            // ── Handle disconnect ─────────────────────────────────────────────────────
            ws.on('close', (code, reason) => {
                logger.warn({ code, reason: reason.toString() }, '[WS Relay] Bridge disconnected');
                this._clearPing();
                this._bridgeSocket = null;
                // Reject all pending requests
                for (const [id, pending] of this._pendingRequests) {
                    clearTimeout(pending.timer);
                    pending.reject(new Error('Bridge disconnected while waiting for Tally response'));
                    this._pendingRequests.delete(id);
                }
                this.emit('disconnected');
            });

            ws.on('error', (err) => {
                logger.error({ err }, '[WS Relay] Bridge socket error');
            });
        });
    }

    /**
     * Is the bridge currently connected?
     */
    isConnected() {
        const { WebSocket } = require('ws');
        return !!(this._bridgeSocket && this._bridgeSocket.readyState === WebSocket.OPEN);
    }

    /**
     * Proxy a raw Tally XML request through the bridge.
     * @param {string} xmlPayload - Raw XML string to send to Tally
     * @param {number} [timeoutMs] - Optional override for timeout
     * @returns {Promise<string>} - Raw XML response from Tally
     */
    proxyRequest(xmlPayload, timeoutMs = REQUEST_TIMEOUT_MS) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected()) {
                return reject(new Error('Bridge not connected. Is KonnectBridge running?'));
            }

            const id = uuidv4();

            const timer = setTimeout(() => {
                this._pendingRequests.delete(id);
                reject(new Error(`Tally relay request timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            this._pendingRequests.set(id, { resolve, reject, timer });

            try {
                this._bridgeSocket.send(JSON.stringify({
                    id,
                    type: 'request',
                    xml: xmlPayload,
                }));
            } catch (err) {
                clearTimeout(timer);
                this._pendingRequests.delete(id);
                reject(err);
            }
        });
    }

    // ── Private helpers ───────────────────────────────────────────────────────────

    _startPing(ws) {
        this._pingTimer = setInterval(() => {
            if (ws.readyState === ws.OPEN) {
                try {
                    ws.send(JSON.stringify({ type: 'ping' }));
                } catch (_) { }
            } else {
                this._clearPing();
            }
        }, PING_INTERVAL_MS);
    }

    _clearPing() {
        if (this._pingTimer) {
            clearInterval(this._pingTimer);
            this._pingTimer = null;
        }
    }
}

// Singleton — required by both server.js and tally.client.js
module.exports = new WsRelayService();
