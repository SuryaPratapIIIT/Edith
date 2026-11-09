import localtunnel from 'localtunnel';
import { exec } from 'child_process';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8000;
const SUBDOMAIN = 'velo-ai-copilot';

let activeTunnel = null;
let isReconnecting = false;

function recordActiveTunnel(tunnelUrl) {
  try {
    const filePath = path.join(__dirname, '..', 'backend', '.active_tunnel');
    fs.writeFileSync(filePath, tunnelUrl, 'utf8');
  } catch {
    // Ignore file write error
  }
}

function updateBolna(tunnelUrl) {
  console.log(`[TUNNEL] Syncing Bolna Cloud Agent to: ${tunnelUrl}`);
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  exec(`${pythonCmd} scripts/update_bolna_hangup.py ${tunnelUrl}`, (err, stdout, stderr) => {
    if (err) {
      console.error(`[TUNNEL ERROR] Failed to sync Bolna: ${stderr || err.message}`);
    } else {
      console.log(`[TUNNEL] Bolna synced successfully: ${stdout.trim()}`);
    }
  });
}

function scheduleReconnect(delayMs = 2000) {
  if (isReconnecting) return;
  isReconnecting = true;

  if (activeTunnel) {
    try {
      activeTunnel.close();
    } catch {}
    activeTunnel = null;
  }

  console.log(`[TUNNEL WARN] Tunnel reconnecting in ${delayMs / 1000}s...`);
  setTimeout(() => {
    isReconnecting = false;
    startTunnel();
  }, delayMs);
}

async function startTunnel() {
  console.log(`[TUNNEL] Launching self-healing localtunnel for port ${PORT} (subdomain: ${SUBDOMAIN})...`);

  try {
    const tunnel = await localtunnel({
      port: PORT,
      subdomain: SUBDOMAIN,
      local_host: '127.0.0.1'
    });

    activeTunnel = tunnel;
    console.log(`[TUNNEL ACTIVE] Public Tunnel Live: ${tunnel.url}`);
    recordActiveTunnel(tunnel.url);
    updateBolna(tunnel.url);

    tunnel.on('close', () => {
      console.warn('[TUNNEL CLOSED] Tunnel connection dropped.');
      scheduleReconnect(1500);
    });

    tunnel.on('error', (err) => {
      console.error('[TUNNEL ERROR] Tunnel socket error:', err.message || err);
      scheduleReconnect(2000);
    });
  } catch (err) {
    console.error('[TUNNEL INIT ERROR]:', err.message);
    scheduleReconnect(2500);
  }
}

// Keep Node.js event loop persistently active and ping tunnel health periodically
setInterval(async () => {
  if (activeTunnel && !isReconnecting) {
    try {
      // Periodic keepalive to ensure tunnel socket does not become idle
      const checkUrl = `${activeTunnel.url}/health`;
      const client = checkUrl.startsWith('https') ? https : http;
      client.get(checkUrl, { headers: { 'bypass-tunnel-reminder': 'true' } }, (res) => {
        res.resume();
      }).on('error', () => {
        // Handled by tunnel close/error events
      });
    } catch {}
  }
}, 15000);

const PRODUCTION_URL = 'https://velo-ai-u5tz.onrender.com';

function cleanupAndRestoreProduction() {
  console.log(`[TUNNEL] Restoring Bolna Cloud Agent to production: ${PRODUCTION_URL}...`);
  recordActiveTunnel(PRODUCTION_URL);
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  try {
    const { execSync } = import('child_process');
    exec(`${pythonCmd} scripts/update_bolna_hangup.py ${PRODUCTION_URL}`);
  } catch {}
}

process.on('SIGINT', () => {
  cleanupAndRestoreProduction();
  if (activeTunnel) activeTunnel.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanupAndRestoreProduction();
  if (activeTunnel) activeTunnel.close();
  process.exit(0);
});

process.on('exit', () => {
  recordActiveTunnel(PRODUCTION_URL);
});

startTunnel();
