const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const urlContainer = document.getElementById('url-container');
const connectBtn = document.getElementById('connect-btn');
const statusBadge = document.getElementById('status-badge'); // New element

let isConnected = false;

// Helper to set status
function setStatus(type, text) {
    statusDot.className = 'status-dot'; // Reset
    statusBadge.style.backgroundColor = '#F5F5F5';
    statusBadge.style.color = '#666';

    if (type === 'active') {
        statusDot.classList.add('active');
        statusBadge.style.backgroundColor = '#FFF8E1'; // Light Amber
        statusBadge.style.color = '#F57F17';
    } else if (type === 'success') {
        statusDot.classList.add('connected');
        statusBadge.style.backgroundColor = '#E8F5E9'; // Light Green
        statusBadge.style.color = '#0A8647';
    } else if (type === 'error') {
        statusDot.classList.add('error');
        statusBadge.style.backgroundColor = '#FFEBEE'; // Light Red
        statusBadge.style.color = '#D93025';
    }

    statusText.innerText = text;
}

connectBtn.addEventListener('click', async () => {
    if (isConnected) {
        // Disconnect logic
        connectBtn.disabled = true;
        const result = await window.electronAPI.stopTunnel();
        connectBtn.disabled = false;

        if (result.success) {
            updateStatus(false);
        }
    } else {
        // Connect logic
        setStatus('active', 'Checking Tally...');
        connectBtn.disabled = true;

        // 1. Check Tally
        const tallyCheck = await window.electronAPI.checkTally(9000); // Default port
        if (!tallyCheck.success) {
            setStatus('error', 'Tally Not Found');
            connectBtn.disabled = false;
            return;
        }

        // 2. Start Tunnel
        setStatus('active', 'Starting Tunnel...');
        const tunnel = await window.electronAPI.startTunnel(9000);

        connectBtn.disabled = false;

        if (tunnel.success) {
            updateStatus(true, tunnel.url);
        } else {
            setStatus('error', 'Tunnel Failed');
        }
    }
});

function updateStatus(connected, url = '') {
    isConnected = connected;
    if (connected) {
        setStatus('success', 'Connected');
        urlContainer.innerText = url;
        urlContainer.style.display = 'block';
        connectBtn.innerText = 'Stop Connection';
        connectBtn.classList.remove('btn-primary');
        connectBtn.classList.add('btn-secondary');
        // Make stop button red text? Novus secondary is usually gray/black.
        connectBtn.style.color = '#D93025';
    } else {
        setStatus('default', 'Disconnected');
        urlContainer.style.display = 'none';
        connectBtn.innerText = 'Start Connection';
        connectBtn.classList.add('btn-primary');
        connectBtn.classList.remove('btn-secondary');
        connectBtn.style.color = '';
    }
}

