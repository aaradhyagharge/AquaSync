/**
 * AQUASYNC AI - Pure Dual-Tank Cyber-Physical Hydro Simulation Engine
 * Dedicated 2-Tank Infrastructure: Rooftop Overhead Tank (OHT) & Underground Sump (UGT)
 * Simulates fluid mass-balance, hydrostatic head pressure, cavitation physics,
 * ultrasonic sonar echo, building fixture loads, and AI anomaly detection.
 */
const dbHelper = require('./db.js');

class HydroSimulator {
  constructor() {
    this.speed = 1.0;
    this.tickIntervalMs = 500; // 2 Hz physics cycle

    // TANK 1: Rooftop Overhead Tank (OHT) - Gravity Distribution Reservoir
    this.oht = {
      name: 'Rooftop Overhead Tank (OHT)',
      tag: 'OHT-2500',
      elevationMeters: 22.5, // 7-story building height
      capacityLiters: 2500,
      heightCm: 200,
      currentLiters: 1850,
      levelPct: 74.0,
      waterHeightCm: 148.0,
      sensorDistanceCm: 52.0, // 200 - 148
      bottomPressureKPa: 14.52, // rho * g * h
      gravityDeliveryPressureBar: 2.35, // Static head pressure to ground floor
      temperatureC: 24.5,
      material: 'Triple-Layer Food Grade XLPE'
    };

    // TANK 2: Underground Reservoir (UGT) - Municipal & Suction Sump
    this.sump = {
      name: 'Subterranean Sump Reservoir (UGT)',
      tag: 'UGT-6000',
      depthMeters: -3.5, // Basement depth
      capacityLiters: 6000,
      heightCm: 250,
      currentLiters: 5100,
      levelPct: 85.0,
      waterHeightCm: 212.5,
      sensorDistanceCm: 37.5,
      bottomPressureKPa: 20.85,
      temperatureC: 21.8,
      municipalValveOpen: false,
      municipalFlowRate: 0.0 // L/min
    };

    // 1.5 HP High-Head Submersible Motor & Actuator
    this.pump = {
      mode: 'AUTO', // 'AUTO', 'MANUAL', 'SOLAR_SYNC', 'EMERGENCY_DRAIN', 'OFF'
      state: 'OFF', // 'OFF', 'RUNNING', 'DRY_RUN_LOCKOUT', 'OVERHEAT', 'LEAK_LOCKOUT'
      manualOverride: false,
      ratedPowerHP: 1.5,
      ratedKw: 1.12,
      rpm: 0,
      targetRpm: 2880,
      voltage: 230.0,
      currentAmps: 0.0,
      powerKw: 0.0,
      powerFactor: 0.88,
      vibrationMmS: 1.1,
      bearingTempC: 32.0,
      transferRateLpm: 48.0, // Nominal transfer rate
      actualFlowLpm: 0.0,
      totalHoursRun: 143.2,
      lastStartedAt: null
    };

    // Solenoid Isolation Matrix (Strictly 2-Tank Network)
    this.valves = {
      v1_pumpFeed: false,              // Sump-to-Roof Transfer Riser
      v2_municipalInlet: false,         // Municipal Supply into Sump
      v3_domesticGravityLine: true,     // Rooftop Gravity Line to Building
      v4_emergencyIsolation: true       // AI Quick-Trip Emergency Solenoid
    };

    // Interactive Building Fixture Simulator
    this.fixtures = {
      bathrooms: false,     // +18 L/min
      kitchens: true,       // +10 L/min baseline
      irrigation: false,    // +15 L/min
      fireHydrant: false    // +55 L/min high flow test
    };

    // Hydraulic Flowmeters
    this.flowmeters = {
      inflowRate: 0.0,          // L/min pumped into OHT
      consumptionRate: 10.0,    // Total building demand L/min
      manualConsumptionOverride: null,
      pipeBurstLeakRate: 0.0
    };

    // Water Quality Spectrometry
    this.waterQuality = {
      tds: 185, // ppm
      ph: 7.35,
      turbidity: 1.6, // NTU
      orp: 360, // mV
      uvPurifierActive: true,
      safetyStatus: 'EXCELLENT DRINKING QUALITY'
    };

    // Solar PV Integration
    this.weather = {
      condition: 'Sunny High Solar',
      ambientTempC: 32.0,
      solarGenerationKw: 3.8,
      gridTariffTier: 'OFF_PEAK_SOLAR'
    };

    // AI Anomaly & Hydraulic Intelligence
    this.ai = {
      leakDetected: false,
      leakConfidence: 0.02,
      leakAcousticDivergence: 0.0,
      pipeBurstDetected: false,
      dryRunPredicted: false,
      hoursReserveLeft: 3.1, // Hours of gravity water left
      energySavedKwh: 42.6,
      waterSavedLiters: 16800,
      optimalSchedule: 'Next fill window: 11:45 AM (Peak 4.2 kW Solar Surplus)'
    };

    // Virtual Hardware Emulation
    this.hardware = {
      esp32UptimeSeconds: 9140,
      wifiRssiDbm: -56,
      mqttConnected: true,
      freeHeapBytes: 198400,
      relays: {
        relay1_pump: false,
        relay2_valve: true,
        relay3_buzzer: false
      },
      lastSerialLog: ''
    };

    // Active Hackathon Scenario
    this.activeScenario = 'NORMAL';
    this.scenarioTimer = 0;

    // Safety Thresholds
    this.thresholds = {
      ohtLowCutin: 25.0,
      ohtHighCutoff: 90.0,
      sumpCriticalCutout: 15.0,
      tdsMaxWarning: 450,
      turbidityMaxWarning: 5.0
    };

    // 2 Hz Physics Simulation Loop
    this.timer = setInterval(() => this.tick(), this.tickIntervalMs);
  }

  setSimulationSpeed(speed) {
    this.speed = Math.max(0.2, Math.min(10.0, speed));
  }

  setConsumptionRate(litersPerMin) {
    this.flowmeters.manualConsumptionOverride = Math.max(0, Math.min(150, litersPerMin));
  }

  getFixtureDemand() {
    let demand = 0;
    if (this.fixtures.bathrooms) demand += 18.0;
    if (this.fixtures.kitchens) demand += 10.0;
    if (this.fixtures.irrigation) demand += 15.0;
    if (this.fixtures.fireHydrant) demand += 55.0;
    return demand;
  }

  toggleFixture(name, state) {
    if (this.fixtures[name] !== undefined) {
      this.fixtures[name] = Boolean(state);
      this.flowmeters.manualConsumptionOverride = null; // Clear slider override so fixture switches directly drive demand!
      const demand = this.getFixtureDemand();
      this.flowmeters.consumptionRate = parseFloat(demand.toFixed(1));

      const friendlyNames = {
        bathrooms: 'Residential Bathrooms (+18 L/min)',
        kitchens: 'Kitchen Fixtures (+10 L/min)',
        irrigation: 'Landscape Irrigation (+15 L/min)',
        fireHydrant: 'Emergency Fire Hydrant (+55 L/min)'
      };
      const label = friendlyNames[name] || name;
      dbHelper.logAlert(
        'INFO',
        'FIXTURE_TOGGLE',
        `${label} ${state ? 'ACTIVATED' : 'SHUT OFF'}`,
        `Building fixture '${name}' switched to ${state ? 'ACTIVE' : 'IDLE'}. Total domestic draw: ${demand.toFixed(1)} L/min.`,
        state ? 'Rooftop OHT gravity draw accelerating' : 'Flow reduced'
      );

      return { success: true, fixtures: this.fixtures, consumptionRate: this.flowmeters.consumptionRate };
    }
    return { success: false, error: 'Unknown fixture' };
  }

  setPumpMode(mode) {
    this.pump.mode = mode;
    if (mode === 'OFF') {
      this.stopPump('User command: Mode set to OFF');
    }
  }

  togglePumpManual(state) {
    if (state) {
      if (this.sump.levelPct < this.thresholds.sumpCriticalCutout) {
        dbHelper.logAlert('WARNING', 'PUMP_LOCKOUT', 'Manual Start Rejected', 'Sump water level below 15% safety minimum. Dry-run prevention active.', 'Refill sump reservoir first');
        return { success: false, reason: 'Dry-run protection: Sump water below minimum cutoff threshold!' };
      }
      this.startPump('Manual operator override');
      return { success: true };
    } else {
      this.stopPump('Manual operator shutdown');
      return { success: true };
    }
  }

  toggleValve(valveId, state) {
    if (this.valves[valveId] !== undefined) {
      this.valves[valveId] = Boolean(state);
      dbHelper.logAlert('INFO', 'VALVE_TOGGLE', `Valve ${valveId} toggled`, `Solenoid state changed to ${state ? 'OPEN' : 'CLOSED'}`, 'N/A');
      return { success: true, state: this.valves[valveId] };
    }
    return { success: false, error: 'Unknown valve ID' };
  }

  startPump(reason) {
    if (this.pump.state === 'DRY_RUN_LOCKOUT' && this.sump.levelPct < this.thresholds.sumpCriticalCutout) {
      return;
    }
    this.pump.state = 'RUNNING';
    this.valves.v1_pumpFeed = true;
    this.hardware.relays.relay1_pump = true;
    this.pump.lastStartedAt = Date.now();
    dbHelper.logAlert('INFO', 'PUMP_START', '1.5 HP Transfer Pump Energized', `Pump activated. Trigger reason: ${reason}`, 'Monitoring suction head and current');
  }

  stopPump(reason) {
    if (this.pump.state === 'RUNNING') {
      this.pump.state = 'OFF';
      this.pump.rpm = 0;
      this.pump.currentAmps = 0;
      this.pump.powerKw = 0;
      this.valves.v1_pumpFeed = false;
      this.hardware.relays.relay1_pump = false;
      dbHelper.logAlert('INFO', 'PUMP_STOP', '1.5 HP Transfer Pump De-energized', `Pump stopped. Reason: ${reason}`, 'Idle stand-by');
    }
  }

  triggerScenario(scenarioName) {
    this.activeScenario = scenarioName;
    this.scenarioTimer = 0;

    switch (scenarioName) {
      case 'NORMAL':
        this.flowmeters.pipeBurstLeakRate = 0;
        this.flowmeters.manualConsumptionOverride = null;
        this.valves.v4_emergencyIsolation = true;
        this.valves.v3_domesticGravityLine = true;
        this.ai.pipeBurstDetected = false;
        this.ai.leakDetected = false;
        this.ai.leakConfidence = 0.02;
        this.waterQuality.tds = 180;
        this.waterQuality.turbidity = 1.6;
        this.waterQuality.safetyStatus = 'EXCELLENT DRINKING QUALITY';
        this.fixtures.bathrooms = false;
        this.fixtures.kitchens = true;
        this.fixtures.irrigation = false;
        this.fixtures.fireHydrant = false;
        if (this.pump.state === 'DRY_RUN_LOCKOUT') this.pump.state = 'OFF';
        dbHelper.logAlert('INFO', 'SCENARIO_RESET', 'Demo: Normal Dual-Tank Equilibrium', 'Dual-tank hydro-grid operating in autonomous equilibrium.', 'FSM active');
        break;

      case 'PIPE_BURST':
        this.flowmeters.pipeBurstLeakRate = 65.0; // Rapid loss
        this.ai.pipeBurstDetected = true;
        this.ai.leakConfidence = 0.98;
        this.ai.leakAcousticDivergence = 14.8;
        dbHelper.logAlert('CRITICAL', 'PIPE_BURST', 'Riser Mainline Burst Detected', 'Flowmeter divergence: Transfer riser line ruptured (65 L/min)! Differential pressure collapse.', 'AI Auto-Isolation: Tripping Solenoid V4 to protect building foundation.');
        break;

      case 'DRY_RUN':
        this.sump.currentLiters = 300; // Critical level
        this.sump.levelPct = 5.0;
        this.startPump('Forced dry-run scenario test');
        this.pump.currentAmps = 1.7; // Low current (air vortex)
        this.pump.vibrationMmS = 7.6;
        dbHelper.logAlert('EMERGENCY', 'DRY_RUN', 'Severe Pump Cavitation & Dry-Run Hazard', 'Sump water depleted (5.0%). Motor drawing 1.7A without liquid resistance. Thermal burn imminent!', 'Instant Hardware Interlock: Motor relay decoupled in 220ms.');
        break;

      case 'MORNING_PEAK':
        // Morning Peak Rush Hour Scenario (Replacing old rainwater)
        this.fixtures.bathrooms = true;
        this.fixtures.kitchens = true;
        this.fixtures.irrigation = true;
        this.oht.currentLiters = 800; // Drop rooftop to provoke refill
        this.oht.levelPct = 32.0;
        dbHelper.logAlert('INFO', 'PEAK_SURGE', '7:00 AM Morning Peak Demand Surge', 'Building consumption spiked to 55 L/min across all residential fixtures. AI Predictive Engine initiating fast recharge.', 'Dual-tank equilibrium maintained');
        break;

      case 'CONTAMINATION':
        this.waterQuality.tds = 980;
        this.waterQuality.turbidity = 24.5;
        this.waterQuality.safetyStatus = 'CONTAMINATED - BOIL WATER ADVISORY';
        this.waterQuality.uvPurifierActive = true;
        dbHelper.logAlert('CRITICAL', 'WATER_POLLUTION', 'Municipal Inflow Contamination Spike', 'Municipal inlet TDS surged to 980 ppm, Turbidity: 24.5 NTU. Silt / pipe intrusion detected.', 'Activating UV-C sterilization & notifying maintenance.');
        break;

      case 'SOLAR_PEAK':
        this.weather.solarGenerationKw = 4.8;
        this.pump.mode = 'SOLAR_SYNC';
        dbHelper.logAlert('INFO', 'SOLAR_ARBITRAGE', 'Solar Surplus Optimization Mode', 'Rooftop solar generating 4.8 kW clean surplus ($0.00/kWh). Pre-filling rooftop storage to 95%.', 'Zero grid cost pumping');
        break;
    }
  }

  tick() {
    this.scenarioTimer += 1;
    const dtSeconds = (this.tickIntervalMs / 1000) * this.speed;

    // 1. Calculate Total Building Consumption from Fixtures
    let currentDemand = 0;
    if (this.flowmeters.manualConsumptionOverride !== null) {
      currentDemand = this.flowmeters.manualConsumptionOverride;
    } else {
      currentDemand = this.getFixtureDemand();
    }
    
    // Add pipe burst leak rate if active
    if (this.flowmeters.pipeBurstLeakRate > 0) {
      currentDemand += this.flowmeters.pipeBurstLeakRate;
    }

    this.flowmeters.consumptionRate = parseFloat(currentDemand.toFixed(1));

    // Drain from OHT (Gravity distribution) if Solenoid V3 is open
    if (this.valves.v3_domesticGravityLine) {
      const litersDrained = (this.flowmeters.consumptionRate / 60) * dtSeconds;
      this.oht.currentLiters = Math.max(0, this.oht.currentLiters - litersDrained);
    }

    // 2. Scenario specific evolutions
    if (this.activeScenario === 'PIPE_BURST') {
      if (this.scenarioTimer > 5 && this.valves.v4_emergencyIsolation) {
        // AI Auto-mitigation
        this.valves.v4_emergencyIsolation = false;
        this.flowmeters.pipeBurstLeakRate = 0; // Isolated!
        this.stopPump('Emergency isolation triggered by AI Leak Guard');
        dbHelper.logAlert('CRITICAL', 'LEAK_ISOLATED', 'Riser Pipe Burst Safely Isolated by Autonomous AI', 'Solenoid Valve V4 automatically shut down within 1.2s of acoustic detection. Water loss averted: 450 Liters.', 'System safe. Awaiting plumbing inspection.');
      }
    } else if (this.activeScenario === 'DRY_RUN') {
      if (this.scenarioTimer > 4 && this.pump.state === 'RUNNING') {
        this.pump.state = 'DRY_RUN_LOCKOUT';
        this.pump.currentAmps = 0;
        this.pump.rpm = 0;
        this.pump.powerKw = 0;
        this.hardware.relays.relay1_pump = false;
        this.hardware.relays.relay3_buzzer = true;
        dbHelper.logAlert('EMERGENCY', 'FAILSAFE_TRIGGERED', 'Dry-Run Motor Cutout Engaged', 'Pump mechanically locked out by dry-run protection circuit. Zero damage sustained by impeller.', 'Buzzer active. Sump refill required before reset.');
      }
    }

    // 3. Universal Failsafe & Autonomous Cascade Logic
    const isSumpSafe = this.sump.levelPct > this.thresholds.sumpCriticalCutout;

    // Hardware Failsafe in all modes
    if (!isSumpSafe && this.pump.state === 'RUNNING') {
      this.pump.state = 'DRY_RUN_LOCKOUT';
      this.stopPump('CRITICAL: Sump water level breached safety minimum!');
    }
    if (this.oht.levelPct >= 100.0 && this.pump.state === 'RUNNING') {
      this.stopPump('OHT reached 100% capacity limit');
    }

    if (this.pump.mode === 'AUTO' || this.pump.mode === 'SOLAR_SYNC') {
      const isOhtLow = this.oht.levelPct <= this.thresholds.ohtLowCutin;
      const isOhtFull = this.oht.levelPct >= this.thresholds.ohtHighCutoff;

      const solarBoostTrigger = this.pump.mode === 'SOLAR_SYNC' && 
                                this.weather.solarGenerationKw > 2.5 && 
                                this.oht.levelPct < 95.0 && 
                                isSumpSafe;

      if ((isOhtLow || solarBoostTrigger) && this.pump.state === 'OFF' && isSumpSafe) {
        this.startPump(solarBoostTrigger ? 'Solar Surplus Pre-Fill Mode' : 'OHT reached low threshold (25%)');
      } else if (isOhtFull && this.pump.state === 'RUNNING') {
        this.stopPump('OHT reached maximum safety cutoff (90%)');
      }
    } else if (this.pump.mode === 'EMERGENCY_DRAIN') {
      const drainRate = (120.0 / 60) * dtSeconds;
      this.oht.currentLiters = Math.max(0, this.oht.currentLiters - drainRate);
    }

    // 4. Pump Execution & Hydrodynamics
    if (this.pump.state === 'RUNNING') {
      this.pump.rpm = Math.min(this.pump.targetRpm, this.pump.rpm + 400);
      
      const voltage = 230.0 + (Math.random() * 2.0 - 1.0);
      const amps = 4.2 + (Math.random() * 0.2 - 0.1);
      this.pump.voltage = parseFloat(voltage.toFixed(1));
      this.pump.currentAmps = parseFloat(amps.toFixed(2));
      this.pump.powerKw = parseFloat(((this.pump.voltage * this.pump.currentAmps * this.pump.powerFactor) / 1000).toFixed(2));
      this.pump.vibrationMmS = parseFloat((1.1 + Math.random() * 0.15).toFixed(2));
      this.pump.bearingTempC = Math.min(52.0, this.pump.bearingTempC + 0.05);

      // Mass balance transfer: Sump -> OHT
      const transferLiters = (this.pump.transferRateLpm / 60) * dtSeconds;
      this.sump.currentLiters = Math.max(0, this.sump.currentLiters - transferLiters);
      this.oht.currentLiters = Math.min(this.oht.capacityLiters, this.oht.currentLiters + transferLiters);
      this.flowmeters.inflowRate = parseFloat((this.pump.transferRateLpm * (this.pump.rpm / this.pump.targetRpm)).toFixed(1));
    } else {
      this.pump.rpm = Math.max(0, this.pump.rpm - 500);
      this.pump.currentAmps = 0.0;
      this.pump.powerKw = 0.0;
      this.flowmeters.inflowRate = 0.0;
      this.pump.bearingTempC = Math.max(26.0, this.pump.bearingTempC - 0.08);
    }

    // 5. Municipal Inflow Top-up to Sump
    if (this.sump.levelPct < 40.0) {
      this.sump.municipalValveOpen = true;
      const municipalInflow = (35.0 / 60) * dtSeconds;
      this.sump.currentLiters = Math.min(this.sump.capacityLiters, this.sump.currentLiters + municipalInflow);
    } else if (this.sump.levelPct > 85.0) {
      this.sump.municipalValveOpen = false;
    }

    // 6. Tank Metrics Recalculation
    this.oht.levelPct = parseFloat(((this.oht.currentLiters / this.oht.capacityLiters) * 100).toFixed(1));
    this.oht.waterHeightCm = parseFloat(((this.oht.levelPct / 100) * this.oht.heightCm).toFixed(1));
    this.oht.sensorDistanceCm = parseFloat((this.oht.heightCm - this.oht.waterHeightCm).toFixed(1));
    this.oht.bottomPressureKPa = parseFloat(((1000 * 9.81 * (this.oht.waterHeightCm / 100)) / 1000).toFixed(2));

    this.sump.levelPct = parseFloat(((this.sump.currentLiters / this.sump.capacityLiters) * 100).toFixed(1));
    this.sump.waterHeightCm = parseFloat(((this.sump.levelPct / 100) * this.sump.heightCm).toFixed(1));
    this.sump.sensorDistanceCm = parseFloat((this.sump.heightCm - this.sump.waterHeightCm).toFixed(1));
    this.sump.bottomPressureKPa = parseFloat(((1000 * 9.81 * (this.sump.waterHeightCm / 100)) / 1000).toFixed(2));

    // Hours of reserve left in OHT
    const demandPerMinute = Math.max(1, this.flowmeters.consumptionRate);
    this.ai.hoursReserveLeft = parseFloat((this.oht.currentLiters / (demandPerMinute * 60)).toFixed(1));

    // 7. Hardware Emulation Updates
    this.hardware.esp32UptimeSeconds += Math.round(dtSeconds);
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
    
    if (Math.random() > 0.6) {
      const logs = [
        `[${timeStr}] [ESP32_SR04] OHT Echo: ${Math.round(this.oht.sensorDistanceCm * 58.3)} µs -> Dist: ${this.oht.sensorDistanceCm} cm | Level: ${this.oht.levelPct}%`,
        `[${timeStr}] [ESP32_PUMP] Relay GPIO 23: ${this.pump.state === 'RUNNING' ? 'HIGH (CLOSED)' : 'LOW (OPEN)'} | Current: ${this.pump.currentAmps} A`,
        `[${timeStr}] [ESP32_FLOW] YF-S201 Pulse Count: ${Math.round(this.flowmeters.inflowRate * 7.5)} Hz -> Flow: ${this.flowmeters.inflowRate} L/min`,
        `[${timeStr}] [ESP32_MQTT] PUB aquasync/telemetry/dual_tank_node -> QoS 1 ACK (200 OK)`
      ];
      this.hardware.lastSerialLog = logs[Math.floor(Math.random() * logs.length)];
    }

    // 8. Log to SQLite
    if (this.scenarioTimer % 6 === 0) {
      dbHelper.logTelemetry(this.getSnapshot());
    }
  }

  resetSump() {
    this.sump.currentLiters = 5200;
    this.sump.levelPct = 86.6;
    if (this.pump.state === 'DRY_RUN_LOCKOUT') {
      this.pump.state = 'OFF';
      this.hardware.relays.relay3_buzzer = false;
      dbHelper.logAlert('INFO', 'SUMP_REFILLED', 'Sump Water Restored', 'Sump replenished to 5,200 Liters. Dry-run safety interlock cleared.', 'Ready for autonomous pumping');
    }
  }

  getSnapshot() {
    return {
      timestamp: Date.now(),
      speed: this.speed,
      activeScenario: this.activeScenario,
      oht: { ...this.oht },
      sump: { ...this.sump },
      pump: { ...this.pump },
      valves: { ...this.valves },
      fixtures: { ...this.fixtures },
      flowmeters: { ...this.flowmeters },
      waterQuality: { ...this.waterQuality },
      weather: { ...this.weather },
      ai: { ...this.ai },
      hardware: { ...this.hardware },
      thresholds: { ...this.thresholds }
    };
  }
}

const simulator = new HydroSimulator();
module.exports = simulator;
