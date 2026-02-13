const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const urlContainer = document.getElementById('url-container');
const connectBtn = document.getElementById('connect-btn');

let isConnected = false;

connectBtn.addEventListener('click', async () => {
    if (isConnected) {
        // Disconnect logic
        const result = await window.electronAPI.stopTunnel();
        if (result.success) {
            updateStatus(false);
        }
    } else {
        // Connect logic
        statusText.innerText = 'Checking Tally...';
        statusDot.style.backgroundColor = '#E07C00'; // Amber

        // 1. Check Tally
        const tallyCheck = await window.electronAPI.checkTally(9000); // Default port
        if (!tallyCheck.success) {
            statusText.innerText = 'Tally Not Found';
            statusDot.style.backgroundColor = '#CD3F3E'; // Red
            return;
        }

        // 2. Start Tunnel
        statusText.innerText = 'Starting Tunnel...';
        const tunnel = await window.electronAPI.startTunnel(9000);

        if (tunnel.success) {
            updateStatus(true, tunnel.url);
        } else {
            statusText.innerText = 'Tunnel Failed';
            statusDot.style.backgroundColor = '#CD3F3E';
        }
    }
});

function updateStatus(connected, url = '') {
    isConnected = connected;
    if (connected) {
        statusDot.style.backgroundColor = '#0A8647'; // Green
        statusText.innerText = 'Connected';
        urlContainer.innerText = url;
        urlContainer.style.display = 'block';
        connectBtn.innerText = 'Disconnect';
        connectBtn.style.backgroundColor = '#CD3F3E';
    } else {
        statusDot.style.backgroundColor = '#888';
        statusText.innerText = 'Disconnected';
        urlContainer.style.display = 'none';
        connectBtn.innerText = 'Connect to Tally';
        connectBtn.style.backgroundColor = '#2E31BE';
    }
}
