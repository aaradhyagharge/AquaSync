/**
 * AQUASYNC AI - Native SQLite Persistence Engine
 * Uses Node 24's built-in node:sqlite DatabaseSync for zero-dependency persistence
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const DB_FILE = path.join(__dirname, 'aquasync.db');
const db = new DatabaseSync(DB_FILE);

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS telemetry_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    oht_level REAL NOT NULL,
    sump_level REAL NOT NULL,
    rainwater_level REAL NOT NULL,
    greywater_level REAL NOT NULL,
    pump_status TEXT NOT NULL,
    pump_amps REAL NOT NULL,
    flow_in REAL NOT NULL,
    flow_out REAL NOT NULL,
    tds REAL NOT NULL,
    ph REAL NOT NULL,
    turbidity REAL NOT NULL,
    solar_kw REAL NOT NULL,
    power_kw REAL NOT NULL,
    leak_score REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS alerts_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    severity TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    mitigation TEXT,
    resolved INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS pump_cycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    liters_pumped REAL DEFAULT 0,
    kwh_used REAL DEFAULT 0,
    cost_saved REAL DEFAULT 0,
    trigger_mode TEXT NOT NULL
  );
`);

// Default system configurations
const defaultConfigs = [
  ['auto_mode', 'true'],
  ['oht_low_threshold', '25.0'],
  ['oht_high_threshold', '92.0'],
  ['sump_critical_threshold', '15.0'],
  ['solar_sync_enabled', 'true'],
  ['ai_leak_guard_enabled', 'true'],
  ['acoustic_leak_threshold', '0.75'],
  ['simulation_speed', '1.0'],
  ['sound_enabled', 'true']
];

const insertConfigStmt = db.prepare(`
  INSERT OR IGNORE INTO system_config (key, value) VALUES (?, ?)
`);

for (const [k, v] of defaultConfigs) {
  insertConfigStmt.run(k, v);
}

// Helper methods
module.exports = {
  db,
  getConfig(key, defaultValue = null) {
    const row = db.prepare('SELECT value FROM system_config WHERE key = ?').get(key);
    return row ? row.value : defaultValue;
  },
  setConfig(key, value) {
    db.prepare(`
      INSERT INTO system_config (key, value, updated_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(key, String(value));
  },
  logTelemetry(telemetry) {
    db.prepare(`
      INSERT INTO telemetry_history (
        timestamp, oht_level, sump_level, rainwater_level, greywater_level,
        pump_status, pump_amps, flow_in, flow_out, tds, ph, turbidity,
        solar_kw, power_kw, leak_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      telemetry.timestamp || Date.now(),
      telemetry.oht.levelPct,
      telemetry.sump.levelPct,
      0.0, // Pure Dual-Tank Architecture (Rainwater removed)
      0.0,
      telemetry.pump.state,
      telemetry.pump.currentAmps,
      telemetry.flowmeters.inflowRate,
      telemetry.flowmeters.consumptionRate,
      telemetry.waterQuality.tds,
      telemetry.waterQuality.ph,
      telemetry.waterQuality.turbidity,
      telemetry.weather ? telemetry.weather.solarGenerationKw : 0.0,
      telemetry.pump.powerKw,
      telemetry.ai.leakConfidence
    );

    // Keep database lean: retain latest 1000 history rows
    db.exec(`
      DELETE FROM telemetry_history WHERE id IN (
        SELECT id FROM telemetry_history ORDER BY id DESC LIMIT -1 OFFSET 1000
      )
    `);
  },
  getRecentTelemetry(limit = 60) {
    return db.prepare(`
      SELECT * FROM telemetry_history ORDER BY id DESC LIMIT ?
    `).all(limit).reverse();
  },
  logAlert(severity, type, title, message, mitigation) {
    const res = db.prepare(`
      INSERT INTO alerts_log (timestamp, severity, type, title, message, mitigation)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(Date.now(), severity, type, title, message, mitigation);
    return res.lastInsertRowid;
  },
  getRecentAlerts(limit = 30) {
    return db.prepare(`
      SELECT * FROM alerts_log ORDER BY id DESC LIMIT ?
    `).all(limit);
  },
  clearAlerts() {
    db.exec('DELETE FROM alerts_log');
  }
};
