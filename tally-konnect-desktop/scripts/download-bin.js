const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const BIN_DIR = path.join(__dirname, '..', 'bin');
const EXT = process.platform === 'win32' ? '.exe' : '';

if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR);
}

const PLATFORM_MAP = {
    'win32': 'windows',
    'darwin': 'darwin',
    'linux': 'linux'
};

const ARCH_MAP = {
    'x64': 'amd64',
    'arm64': 'arm64',
};

function download(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                file.close();
                fs.unlinkSync(dest);
                download(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }
            if (response.statusCode !== 200) {
                file.close();
                fs.unlinkSync(dest);
                reject(new Error(`Download failed with status ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(() => resolve());
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
}

function downloadText(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                downloadText(response.headers.location).then(resolve).catch(reject);
                return;
            }
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

function sha256File(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

async function main() {
    const platform = PLATFORM_MAP[process.platform];
    let arch = ARCH_MAP[process.arch] || 'amd64';

    // FIX: Windows on ARM64 fallback
    if (platform === 'windows' && arch === 'arm64') {
        console.log('Windows ARM64 detected. Using amd64 binary (emulation).');
        arch = 'amd64';
    }

    if (!platform) {
        console.error('Unsupported platform:', process.platform);
        process.exit(1);
    }


    const filename = `cloudflared-${platform}-${arch}${EXT}`;
    const downloadUrl = `https://github.com/cloudflare/cloudflared/releases/latest/download/${filename}`;
    const checksumUrl = `https://github.com/cloudflare/cloudflared/releases/latest/download/${filename}.sha256`;
    const destPath = path.join(BIN_DIR, `cloudflared${EXT}`);

    console.log(`Downloading ${filename}...`);

    try {
        // 1. Download the binary
        await download(downloadUrl, destPath);
        console.log(`Downloaded to ${destPath}`);

        // 2. Download the SHA256 checksum from GitHub
        console.log('Verifying SHA256 integrity...');
        try {
            const checksumData = await downloadText(checksumUrl);
            // Format is: "<hash>  <filename>" or just "<hash>"
            const expectedHash = checksumData.trim().split(/\s+/)[0].toLowerCase();

            // Fix: Check if we got HTML (e.g. 404 page) instead of a hash
            if (expectedHash.startsWith('<')) {
                console.warn('WARNING: Checksum file returned HTML (likely 404). Skipping integrity check.');
            } else {
                const actualHash = await sha256File(destPath);

                if (actualHash !== expectedHash) {
                    console.error(`INTEGRITY CHECK FAILED!`);
                    console.error(`  Expected: ${expectedHash}`);
                    console.error(`  Actual:   ${actualHash}`);
                    fs.unlinkSync(destPath);
                    process.exit(1);
                }
                console.log(`SHA256 verified: ${actualHash.substring(0, 16)}...`);
            }
        } catch (checksumErr) {
            console.warn('WARNING: Could not download checksum file. Skipping integrity check.');
            console.warn(`  Reason: ${checksumErr.message}`);
        }

        // 3. Make executable on Unix
        if (process.platform !== 'win32') {
            fs.chmodSync(destPath, 0o755);
            console.log('Made executable');
        }

        console.log('Done!');
    } catch (err) {
        console.error('Download failed:', err.message);
        process.exit(1);
    }
}

main();
