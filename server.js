/**
 * AQUASYNC AI - High Performance Node.js Server
 * Integrates REST API, Server-Sent Events (SSE) realtime push,
 * SQLite persistence, and physics simulator.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const simulator = require('./simulator.js');
const dbHelper = require('./db.js');

const PORT = process.env.PORT || 5050;
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ino': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

// SSE Active Client Connections
const sseClients = new Set();

// Broadcast snapshot to all SSE clients
setInterval(() => {
  if (sseClients.size === 0) return;
  const snapshot = simulator.getSnapshot();
  const payload = `data: ${JSON.stringify(snapshot)}\n\n`;
  for (const res of sseClients) {
    res.write(payload);
  }
}, 400); // ~2.5 updates per second for smooth rendering

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // 1. SSE Stream Endpoint
  if (pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(': connected\n\n');
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // 2. REST API Endpoints
  if (pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');

    // GET /api/status
    if (pathname === '/api/status' && req.method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify(simulator.getSnapshot()));
      return;
    }

    // GET /api/history
    if (pathname === '/api/history' && req.method === 'GET') {
      const limit = parseInt(parsedUrl.searchParams.get('limit') || '60', 10);
      const rows = dbHelper.getRecentTelemetry(limit);
      res.writeHead(200);
      res.end(JSON.stringify(rows));
      return;
    }

    // GET /api/alerts
    if (pathname === '/api/alerts' && req.method === 'GET') {
      const alerts = dbHelper.getRecentAlerts(40);
      res.writeHead(200);
      res.end(JSON.stringify(alerts));
      return;
    }

    // GET /api/firmware
    if (pathname === '/api/firmware' && req.method === 'GET') {
      const fwPath = path.join(PUBLIC_DIR, 'firmware', 'esp32_firmware.ino');
      try {
        const code = fs.readFileSync(fwPath, 'utf8');
        res.writeHead(200);
        res.end(JSON.stringify({ code }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // Parse JSON Body for POST requests
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let data = {};
        try {
          if (body) data = JSON.parse(body);
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Malformed JSON payload' }));
          return;
        }

        // POST /api/pump/control
        if (pathname === '/api/pump/control') {
          if (data.mode) simulator.setPumpMode(data.mode);
          if (data.state !== undefined) {
            const result = simulator.togglePumpManual(data.state);
            res.writeHead(200);
            res.end(JSON.stringify(result));
            return;
          }
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, mode: simulator.pump.mode }));
          return;
        }

        // POST /api/hardware/telemetry (Real ESP32 IoT Ingestion Endpoint)
        if (pathname === '/api/hardware/telemetry') {
          if (data.ohtDistanceCm !== undefined) {
            const h = Math.max(0, simulator.oht.heightCm - data.ohtDistanceCm);
            simulator.oht.waterHeightCm = parseFloat(h.toFixed(1));
            simulator.oht.levelPct = parseFloat(((h / simulator.oht.heightCm) * 100).toFixed(1));
            simulator.oht.currentLiters = Math.round((simulator.oht.levelPct / 100) * simulator.oht.capacityLiters);
            simulator.oht.sensorDistanceCm = parseFloat(Number(data.ohtDistanceCm).toFixed(1));
          }
          if (data.sumpDistanceCm !== undefined) {
            const h = Math.max(0, simulator.sump.heightCm - data.sumpDistanceCm);
            simulator.sump.waterHeightCm = parseFloat(h.toFixed(1));
            simulator.sump.levelPct = parseFloat(((h / simulator.sump.heightCm) * 100).toFixed(1));
            simulator.sump.currentLiters = Math.round((simulator.sump.levelPct / 100) * simulator.sump.capacityLiters);
            simulator.sump.sensorDistanceCm = parseFloat(Number(data.sumpDistanceCm).toFixed(1));
          }
          if (data.currentAmps !== undefined) {
            simulator.pump.currentAmps = parseFloat(Number(data.currentAmps).toFixed(2));
          }
          if (data.flowRateLpm !== undefined) {
            simulator.flowmeters.inflowRate = parseFloat(Number(data.flowRateLpm).toFixed(1));
          }
          if (data.relayPumpState !== undefined) {
            simulator.pump.state = data.relayPumpState ? 'RUNNING' : 'OFF';
          }
          if (data.tds !== undefined) {
            simulator.waterQuality.tds = Math.round(Number(data.tds));
          }

          // Return actuator commands back to the ESP32 in the HTTP response
          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            serverTimestamp: Date.now(),
            commands: {
              pumpRelay: simulator.pump.state === 'RUNNING',
              mode: simulator.pump.mode,
              emergencyShutoff: !simulator.valves.v4_emergencyIsolation
            }
          }));
          return;
        }

        // POST /api/valve/control
        if (pathname === '/api/valve/control') {
          const result = simulator.toggleValve(data.valveId, data.state);
          res.writeHead(200);
          res.end(JSON.stringify(result));
          return;
        }

        // POST /api/scenario
        if (pathname === '/api/scenario') {
          simulator.triggerScenario(data.scenario || 'NORMAL');
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, activeScenario: simulator.activeScenario }));
          return;
        }

        // POST /api/consumption
        if (pathname === '/api/consumption') {
          simulator.setConsumptionRate(data.rate);
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, rate: simulator.flowmeters.consumptionRate }));
          return;
        }

        // POST /api/fixture/toggle (Interactive building tap simulator)
        if (pathname === '/api/fixture/toggle') {
          const fixtureName = data.name || data.fixture;
          const result = simulator.toggleFixture(fixtureName, data.state);
          res.writeHead(200);
          res.end(JSON.stringify(result));
          return;
        }

        // POST /api/speed
        if (pathname === '/api/speed') {
          simulator.setSimulationSpeed(data.speed);
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, speed: simulator.speed }));
          return;
        }

        // POST /api/refill-sump
        if (pathname === '/api/refill-sump') {
          simulator.resetSump();
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, sumpLevel: simulator.sump.levelPct }));
          return;
        }

        // POST /api/alerts/clear
        if (pathname === '/api/alerts/clear') {
          dbHelper.clearAlerts();
          res.writeHead(200);
          res.end(JSON.stringify({ success: true }));
          return;
        }

        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Unknown API endpoint' }));
      });
      return;
    }

    res.writeHead(405);
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  // 3. Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`🌊 AQUASYNC AI - Next-Gen Smart Water Grid Digital Twin Running!`);
  console.log(`📡 Local SCADA Portal:   http://localhost:${PORT}`);
  console.log(`📊 Live Telemetry Stream: http://localhost:${PORT}/events`);
  console.log(`🔌 Embedded ESP32 Studio: Ready with Dual-Tank Simulation`);
  console.log(`================================================================`);
});
