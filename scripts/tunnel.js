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
let keepaliveTimer = null;
let consecutiveFailures = 0;
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

  if (keepaliveTimer) {
    clearInterval(keepaliveTimer);
    keepaliveTimer = null;
  }

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
  consecutiveFailures = 0;

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
      scheduleReconnect(2000);
    });

    tunnel.on('error', (err) => {
      console.error('[TUNNEL ERROR] Tunnel socket error:', err.message || err);
      scheduleReconnect(3000);
    });

    // Active Health Monitor & Anti-Zombie Keepalive Ping every 10 seconds
    keepaliveTimer = setInterval(() => {
      if (!activeTunnel) return;

      const client = activeTunnel.url.startsWith('https') ? https : http;
      const req = client.get(
        `${activeTunnel.url}/health`,
        {
          headers: { 'bypass-tunnel-reminder': 'true' },
          timeout: 4000
        },
        (res) => {
          if (res.statusCode === 200) {
            consecutiveFailures = 0;
          } else {
            consecutiveFailures++;
            console.warn(`[TUNNEL WARN] Ping returned HTTP ${res.statusCode} (${consecutiveFailures}/2 failures)`);
            if (consecutiveFailures >= 2) {
              console.error('[TUNNEL UNRESPONSIVE] Detected zombie tunnel (503/error). Recycling immediately...');
              scheduleReconnect(1000);
            }
          }
        }
      );

      req.on('timeout', () => {
        req.destroy();
        consecutiveFailures++;
        console.warn(`[TUNNEL WARN] Ping timed out (${consecutiveFailures}/2 failures)`);
        if (consecutiveFailures >= 2) {
          console.error('[TUNNEL TIMEOUT] Tunnel unresponsive. Recycling immediately...');
          scheduleReconnect(1000);
        }
      });

      req.on('error', (err) => {
        consecutiveFailures++;
        console.warn(`[TUNNEL WARN] Ping network error: ${err.message} (${consecutiveFailures}/2 failures)`);
        if (consecutiveFailures >= 2) {
          console.error('[TUNNEL NETWORK FAILURE] Recycling immediately...');
          scheduleReconnect(1000);
        }
      });
    }, 10000);

  } catch (err) {
    console.error('[TUNNEL INIT ERROR]:', err.message);
    scheduleReconnect(3000);
  }
}

process.on('SIGINT', () => {
  if (activeTunnel) activeTunnel.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (activeTunnel) activeTunnel.close();
  process.exit(0);
});

startTunnel();
