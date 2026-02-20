const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const urlContainer = document.getElementById('url-container');
const connectBtn = document.getElementById('connect-btn');
const tallyHostInput = document.getElementById('tally-host');
const tallyPortInput = document.getElementById('tally-port');

let isConnected = false;

// ── Live status updates from main process ─────────────────────────────────────
window.electronAPI.onRelayStatus(({ status, message }) => {
    switch (status) {
        case 'connected':
            setUi(true, 'Relay Active — Cloud Connected');
            break;
        case 'connecting':
        case 'reconnecting':
            setAmber(message || 'Connecting...');
            break;
        case 'disconnected':
            setUi(false);
            break;
        case 'error':
            setError(message || 'Error');
            break;
    }
});

// ── Button click ──────────────────────────────────────────────────────────────
connectBtn.addEventListener('click', async () => {
    if (isConnected) {
        // Disconnect
        connectBtn.disabled = true;
        const result = await window.electronAPI.stopRelay();
        connectBtn.disabled = false;
        if (result.success) setUi(false);
    } else {
        // Connect
        const host = tallyHostInput.value.trim() || 'http://localhost';
        const port = parseInt(tallyPortInput.value) || 9000;

        setAmber('Checking Tally...');
        connectBtn.disabled = true;
        tallyHostInput.disabled = true;
        tallyPortInput.disabled = true;

        // 1. Confirm Tally is running locally
        const tallyCheck = await window.electronAPI.checkTally(port, host);
        if (!tallyCheck.success) {
            setError(`Tally Not Found (${host}:${port})`);
            connectBtn.disabled = false;
            tallyHostInput.disabled = false;
            tallyPortInput.disabled = false;
            return;
        }

        // 2. Start relay connection
        setAmber('Connecting to Cloud...');
        const relay = await window.electronAPI.startRelay(tallyCheck.port, host);

        connectBtn.disabled = false;

        if (relay.success) {
            setUi(true, 'Relay Active — Cloud Connected');
        } else {
            setError(relay.error || 'Relay Connection Failed');
            tallyHostInput.disabled = false;
            tallyPortInput.disabled = false;
        }
    }
});

// ── UI helpers ────────────────────────────────────────────────────────────────

function setUi(connected, label = '') {
    isConnected = connected;
    if (connected) {
        statusDot.style.backgroundColor = '#0A8647';
        statusText.innerText = label || 'Connected';
        urlContainer.innerText = '🔗 Tally syncing via Encrypted Relay';
        urlContainer.style.display = 'block';
        connectBtn.innerText = 'Disconnect';
        connectBtn.style.backgroundColor = '#CD3F3E';
        tallyHostInput.disabled = true;
        tallyPortInput.disabled = true;
    } else {
        isConnected = false;
        statusDot.style.backgroundColor = '#888';
        statusText.innerText = 'Disconnected';
        urlContainer.style.display = 'none';
        connectBtn.innerText = 'Connect to Cloud';
        connectBtn.style.backgroundColor = '#2E31BE';
        tallyHostInput.disabled = false;
        tallyPortInput.disabled = false;
    }
}

function setAmber(msg) {
    statusDot.style.backgroundColor = '#E07C00';
    statusText.innerText = msg;
}

function setError(msg) {
    isConnected = false;
    statusDot.style.backgroundColor = '#CD3F3E';
    statusText.innerText = msg;
    urlContainer.style.display = 'none';
    connectBtn.innerText = 'Connect to Cloud';
    connectBtn.style.backgroundColor = '#2E31BE';
}
