import localtunnel from 'localtunnel';
import { exec } from 'child_process';
import http from 'http';
import https from 'https';

const PORT = 8000;
const SUBDOMAIN = 'velo-ai-copilot';

function updateBolna(tunnelUrl) {
  console.log(`[TUNNEL] Syncing Bolna Cloud Agent to: ${tunnelUrl}`);
  exec(`python scripts/update_bolna_hangup.py ${tunnelUrl}`, (err, stdout, stderr) => {
    if (err) {
      console.error(`[TUNNEL ERROR] Failed to sync Bolna: ${stderr || err.message}`);
    } else {
      console.log(`[TUNNEL] Bolna synced successfully: ${stdout.trim()}`);
    }
  });
}

async function startTunnel() {
  console.log('[TUNNEL] Starting localtunnel for port 8000...');
  try {
    const tunnel = await localtunnel({ port: PORT, subdomain: SUBDOMAIN });
    console.log(`[TUNNEL] Public Tunnel Active: ${tunnel.url}`);
    updateBolna(tunnel.url);

    tunnel.on('close', () => {
      console.warn('[TUNNEL WARN] Tunnel closed. Reconnecting in 3s...');
      setTimeout(startTunnel, 3000);
    });

    tunnel.on('error', (err) => {
      console.error('[TUNNEL ERROR]:', err);
      tunnel.close();
    });

    // Keepalive ping every 20 seconds
    const pingInterval = setInterval(() => {
      const client = tunnel.url.startsWith('https') ? https : http;
      const req = client.get(
        `${tunnel.url}/health`,
        { headers: { 'bypass-tunnel-reminder': 'true' } },
        (res) => {
          // Healthy keepalive response
        }
      );
      req.on('error', () => {
        // Quiet keepalive ping error
      });
      req.setTimeout(5000, () => req.destroy());
    }, 20000);

    tunnel.on('close', () => clearInterval(pingInterval));
  } catch (err) {
    console.error('[TUNNEL INIT ERROR]:', err.message);
    setTimeout(startTunnel, 3000);
  }
}

startTunnel();

