/**
 * ==============================================================================
 * AQUASYNC AI - CLIENT APPLICATION & SOUND SYNTHESIS CORE
 * Connects SSE Real-time Feed, Manages SCADA Telemetry State,
 * Synthesizes Web Audio SFX (Pump Hum, Relay Clicks, Emergency Klaxon),
 * and coordinates 3D Digital Twin + Hardware Lab.
 * ==============================================================================
 */

// Synthesized Sound Engine (Pure Web Audio API - Zero external files)
class HydroSoundSynthesizer {
  constructor() {
    this.ctx = null;
    this.soundEnabled = false; // Start muted, enable on first user interaction
    this.pumpOsc = null;
    this.pumpGain = null;
    this.alarmInterval = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleSound(enable) {
    this.soundEnabled = enable;
    if (enable) {
      this.init();
    } else {
      this.stopPumpSound();
      this.stopAlarmSound();
    }
  }

  // Relay Clack Sound (Mechanical solenoid trigger)
  playRelayClick() {
    if (!this.soundEnabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.04);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {}
  }

  // Ultrasonic Sonar Ping
  playSonarPing() {
    if (!this.soundEnabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {}
  }

  // Continuous Low-Frequency Pump Motor Hum (55Hz + harmonics)
  startPumpSound() {
    if (!this.soundEnabled || !this.ctx || this.pumpOsc) return;
    try {
      const now = this.ctx.currentTime;
      this.pumpOsc = this.ctx.createOscillator();
      this.pumpGain = this.ctx.createGain();

      this.pumpOsc.type = 'sawtooth';
      this.pumpOsc.frequency.setValueAtTime(58, now);

      // Low pass filter to simulate motor enclosure
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, now);

      this.pumpGain.gain.setValueAtTime(0.01, now);
      this.pumpGain.gain.linearRampToValueAtTime(0.12, now + 0.6);

      this.pumpOsc.connect(filter);
      filter.connect(this.pumpGain);
      this.pumpGain.connect(this.ctx.destination);

      this.pumpOsc.start(now);
    } catch (e) {}
  }

  stopPumpSound() {
    if (this.pumpOsc) {
      try {
        const now = this.ctx.currentTime;
        this.pumpGain.gain.linearRampToValueAtTime(0.001, now + 0.3);
        setTimeout(() => {
          if (this.pumpOsc) {
            this.pumpOsc.stop();
            this.pumpOsc.disconnect();
            this.pumpOsc = null;
            this.pumpGain = null;
          }
        }, 320);
      } catch (e) {
        this.pumpOsc = null;
      }
    }
  }

  // High-Pitch Emergency Klaxon
  startAlarmSound() {
    if (!this.soundEnabled || !this.ctx || this.alarmInterval) return;
    let high = true;
    this.alarmInterval = setInterval(() => {
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(high ? 920 : 640, now);
        high = !high;

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.24);
      } catch (e) {}
    }, 280);
  }

  stopAlarmSound() {
    if (this.alarmInterval) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
  }
}

// Global App Orchestrator
class AquaSyncApp {
  constructor() {
    this.sound = new HydroSoundSynthesizer();
    this.twin = new DigitalTwin3D('digitalTwinCanvas');
    this.hardware = new HardwareStudio('virtualOledCanvas', 'terminalBody');
    this.chart = new TelemetryChart('telemetryChartCanvas');

    this.currentSnapshot = null;
    this.lastPumpState = 'OFF';

    this.initUIEvents();
    this.connectSSE();
    this.loadAlertsLog();
    setInterval(() => this.loadAlertsLog(), 4000);
  }

  // 1. Setup UI Listeners & Controls
  initUIEvents() {
    // Sound Toggle
    const btnSound = document.getElementById('btnToggleSound');
    btnSound.addEventListener('click', () => {
      const active = btnSound.classList.toggle('active');
      btnSound.innerHTML = active ? '🔊 Audio SFX: ON' : '🔇 Audio SFX: OFF';
      this.sound.toggleSound(active);
    });

    // Preset Scenarios
    const presetButtons = document.querySelectorAll('.preset-chip');
    presetButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const scenario = btn.getAttribute('data-scenario');
        this.sound.playRelayClick();
        this.triggerScenario(scenario);
      });
    });

    // Camera Preset Buttons
    const camButtons = document.querySelectorAll('[data-cam]');
    camButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        camButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.getAttribute('data-cam');
        if (mode) this.twin.setCameraMode(mode);
      });
    });

    // Drag Mode Toggle (Pan vs Rotate)
    const btnDragPan = document.getElementById('btnDragPan');
    const btnDragRotate = document.getElementById('btnDragRotate');
    if (btnDragPan && btnDragRotate) {
      btnDragPan.addEventListener('click', () => {
        btnDragPan.classList.add('active');
        btnDragPan.style.color = '#00e5ff';
        btnDragRotate.classList.remove('active');
        btnDragRotate.style.color = '';
        this.twin.setMouseMode('PAN');
      });
      btnDragRotate.addEventListener('click', () => {
        btnDragRotate.classList.add('active');
        btnDragRotate.style.color = '#00e5ff';
        btnDragPan.classList.remove('active');
        btnDragPan.style.color = '';
        this.twin.setMouseMode('ROTATE');
      });
    }

    // Directional D-Pad Buttons
    const btnPanUp = document.getElementById('btnPanUp');
    const btnPanDown = document.getElementById('btnPanDown');
    const btnPanLeft = document.getElementById('btnPanLeft');
    const btnPanRight = document.getElementById('btnPanRight');
    const btnZoomIn = document.getElementById('btnZoomIn');
    const btnZoomOut = document.getElementById('btnZoomOut');
    const btnResetView = document.getElementById('btnResetView');

    if (btnPanUp) btnPanUp.addEventListener('click', () => this.twin.panBy(0, 60));
    if (btnPanDown) btnPanDown.addEventListener('click', () => this.twin.panBy(0, -60));
    if (btnPanLeft) btnPanLeft.addEventListener('click', () => this.twin.panBy(60, 0));
    if (btnPanRight) btnPanRight.addEventListener('click', () => this.twin.panBy(-60, 0));
    if (btnZoomIn) btnZoomIn.addEventListener('click', () => this.twin.zoomBy(1.15));
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => this.twin.zoomBy(0.85));
    if (btnResetView) btnResetView.addEventListener('click', () => this.twin.resetView());

    // Render Style Select
    const selectStyle = document.getElementById('selectRenderStyle');
    if (selectStyle) {
      selectStyle.addEventListener('change', (e) => {
        this.twin.setRenderStyle(e.target.value);
      });
    }

    // Interactive Tap Demand Slider
    const sliderDemand = document.getElementById('sliderConsumption');
    const labelDemand = document.getElementById('labelDemandRate');
    if (sliderDemand) {
      sliderDemand.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        labelDemand.textContent = `${val.toFixed(0)} L/min`;
        this.setConsumptionRate(val);
      });
    }

    // Pump Mode Buttons (AUTO, MANUAL, SOLAR_SYNC, EMERGENCY_DRAIN)
    const modeButtons = document.querySelectorAll('.btn-mode');
    modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        this.sound.playRelayClick();
        this.setPumpMode(mode);
      });
    });

    // Pump Manual Toggle Switch
    const pumpSwitch = document.getElementById('pumpManualSwitch');
    if (pumpSwitch) {
      pumpSwitch.addEventListener('change', (e) => {
        this.sound.playRelayClick();
        this.togglePump(e.target.checked);
      });
    }

    // E-STOP Button
    const btnEstop = document.getElementById('btnEstop');
    if (btnEstop) {
      btnEstop.addEventListener('click', () => {
        this.sound.playRelayClick();
        this.triggerEmergencyStop();
      });
    }

    // Solenoid Valves Matrix
    const valveBtns = document.querySelectorAll('.valve-btn');
    valveBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const valveId = btn.getAttribute('data-valve');
        const currentState = btn.classList.contains('valve-open');
        this.sound.playRelayClick();
        this.toggleValve(valveId, !currentState);
      });
    });

    // Building Fixtures Demand Simulators
    const fixtureBtns = document.querySelectorAll('.fixture-btn');
    fixtureBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const fixtureName = btn.getAttribute('data-fixture');
        const currentState = btn.classList.contains('fixture-active');
        const nextState = !currentState;

        // Immediate optimistic UI response
        btn.classList.toggle('fixture-active', nextState);
        this.sound.playRelayClick();
        this.toggleFixture(fixtureName, nextState);
      });
    });

    // Sump Refill Button
    const btnRefillSump = document.getElementById('btnRefillSump');
    if (btnRefillSump) {
      btnRefillSump.addEventListener('click', () => {
        this.sound.playRelayClick();
        this.refillSump();
      });
    }

    // Firmware Code Modal
    const btnViewFirmware = document.getElementById('btnViewFirmware');
    const modalFirmware = document.getElementById('modalFirmware');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const btnCopyCode = document.getElementById('btnCopyCode');

    if (btnViewFirmware && modalFirmware) {
      btnViewFirmware.addEventListener('click', () => {
        this.openFirmwareModal();
      });
      btnCloseModal.addEventListener('click', () => {
        modalFirmware.classList.remove('open');
      });
      modalFirmware.addEventListener('click', (e) => {
        if (e.target === modalFirmware) modalFirmware.classList.remove('open');
      });
      btnCopyCode.addEventListener('click', () => {
        const codeText = document.getElementById('firmwareCodeDisplay').textContent;
        navigator.clipboard.writeText(codeText).then(() => {
          btnCopyCode.textContent = '✓ Copied to Clipboard!';
          setTimeout(() => { btnCopyCode.textContent = '📋 Copy Arduino C++ Code'; }, 2000);
        });
      });
    }
  }

  // 2. Real-time Telemetry Push via Server-Sent Events (SSE)
  connectSSE() {
    try {
      const evtSource = new EventSource('/events');

      evtSource.onmessage = (event) => {
        const snapshot = JSON.parse(event.data);
        this.onTelemetryUpdate(snapshot);
      };

      evtSource.onerror = () => {
        // Fallback to REST polling if SSE temporarily disconnects
        setTimeout(() => this.fallbackPoll(), 1000);
      };
    } catch (err) {
      this.fallbackPoll();
    }
  }

  fallbackPoll() {
    fetch('/api/status')
      .then(r => r.json())
      .then(snapshot => {
        this.onTelemetryUpdate(snapshot);
        setTimeout(() => this.fallbackPoll(), 500);
      })
      .catch(() => {
        setTimeout(() => this.fallbackPoll(), 2000);
      });
  }

  // 3. Central Telemetry Processor
  onTelemetryUpdate(snapshot) {
    this.currentSnapshot = snapshot;

    // A. Update 3D Digital Twin Canvas
    this.twin.updateData(snapshot);

    // B. Update Virtual Hardware OLED & Serial
    this.hardware.update(snapshot);

    // C. Update Real-time Chart
    this.chart.addDataPoint(snapshot);

    // D. Audio engine synchronization
    if (snapshot.pump.state === 'RUNNING' && this.lastPumpState !== 'RUNNING') {
      this.sound.startPumpSound();
    } else if (snapshot.pump.state !== 'RUNNING' && this.lastPumpState === 'RUNNING') {
      this.sound.stopPumpSound();
    }

    if (snapshot.pump.state === 'DRY_RUN_LOCKOUT' || snapshot.ai.pipeBurstDetected) {
      this.sound.startAlarmSound();
    } else {
      this.sound.stopAlarmSound();
    }

    this.lastPumpState = snapshot.pump.state;

    // E. Update UI Metrics & Badges
    this.renderMetrics(snapshot);
  }

  renderMetrics(s) {
    // Top Metric Cards
    document.getElementById('metricOhtLevel').textContent = s.oht.levelPct.toFixed(1);
    document.getElementById('metricOhtVolume').textContent = `${Math.round(s.oht.currentLiters)} / ${s.oht.capacityLiters} L`;
    document.getElementById('barOhtFill').style.width = `${s.oht.levelPct}%`;

    document.getElementById('metricSumpLevel').textContent = s.sump.levelPct.toFixed(1);
    document.getElementById('metricSumpVolume').textContent = `${Math.round(s.sump.currentLiters)} / ${s.sump.capacityLiters} L`;
    document.getElementById('barSumpFill').style.width = `${s.sump.levelPct}%`;

    // Pump specs
    document.getElementById('metricPumpAmps').textContent = s.pump.currentAmps.toFixed(1);
    document.getElementById('metricPumpPower').textContent = `${s.pump.powerKw.toFixed(2)} kW | ${s.pump.rpm} RPM`;
    document.getElementById('barPumpPower').style.width = `${(s.pump.currentAmps / 6.8) * 100}%`;

    // Flow rate
    document.getElementById('metricFlowRate').textContent = s.flowmeters.inflowRate.toFixed(1);
    document.getElementById('metricConsumption').textContent = `Demand: ${s.flowmeters.consumptionRate.toFixed(1)} L/min`;

    // Water Quality
    document.getElementById('valTds').textContent = `${s.waterQuality.tds} ppm`;
    document.getElementById('valPh').textContent = s.waterQuality.ph.toFixed(2);
    document.getElementById('valTurbidity').textContent = `${s.waterQuality.turbidity.toFixed(1)} NTU`;
    document.getElementById('valSafetyStatus').textContent = s.waterQuality.safetyStatus;

    const safetyBadge = document.getElementById('valSafetyStatus');
    if (s.waterQuality.tds > 500 || s.waterQuality.turbidity > 5.0) {
      safetyBadge.className = 'quality-val badge-sev EMERGENCY';
    } else {
      safetyBadge.className = 'quality-val badge-sev INFO';
    }

    // Weather & Solar
    document.getElementById('metricSolarKw').textContent = `${s.weather.solarGenerationKw.toFixed(1)} kW`;
    document.getElementById('metricSolarStatus').textContent = s.weather.condition;

    // Hydraulic Head & Autonomy Reserve
    const metricReserveHours = document.getElementById('metricReserveHours');
    if (metricReserveHours) {
      metricReserveHours.textContent = (s.ai && s.ai.hoursReserveLeft !== undefined) ? s.ai.hoursReserveLeft.toFixed(1) : '3.1';
    }
    const metricHeadPressure = document.getElementById('metricHeadPressure');
    if (metricHeadPressure) {
      metricHeadPressure.textContent = (s.oht && s.oht.gravityDeliveryPressureBar !== undefined) ? `${s.oht.gravityDeliveryPressureBar} BAR` : '2.35 BAR';
    }

    // Building Fixtures state sync
    if (s.fixtures) {
      for (const [fixName, isActive] of Object.entries(s.fixtures)) {
        const fBtn = document.querySelector(`[data-fixture="${fixName}"]`);
        if (fBtn) {
          fBtn.classList.toggle('fixture-active', !!isActive);
        }
      }
    }

    // Dynamic slider sync if user is not actively dragging it
    const sliderDemand = document.getElementById('sliderConsumption');
    const labelDemand = document.getElementById('labelDemandRate');
    if (sliderDemand && document.activeElement !== sliderDemand) {
      sliderDemand.value = s.flowmeters.consumptionRate;
      if (labelDemand) {
        labelDemand.textContent = `${s.flowmeters.consumptionRate.toFixed(0)} L/min`;
      }
    }

    // HUD overlays
    document.getElementById('hudOhtDist').textContent = `${s.oht.sensorDistanceCm} cm`;
    document.getElementById('hudPressure').textContent = `${s.oht.bottomPressureKPa} kPa`;
    document.getElementById('hudPumpVibration').textContent = `${s.pump.vibrationMmS} mm/s`;

    // Switch state
    const pumpSwitch = document.getElementById('pumpManualSwitch');
    if (pumpSwitch && document.activeElement !== pumpSwitch) {
      pumpSwitch.checked = (s.pump.state === 'RUNNING');
    }

    // Active preset chip highlight
    document.querySelectorAll('.preset-chip').forEach(btn => {
      const sc = btn.getAttribute('data-scenario');
      btn.classList.toggle('active', sc === s.activeScenario);
    });

    // Active mode button highlight
    document.querySelectorAll('.btn-mode').forEach(btn => {
      const m = btn.getAttribute('data-mode');
      btn.classList.toggle('active', m === s.pump.mode);
    });

    // Valve matrix buttons
    for (const [vKey, isOpen] of Object.entries(s.valves)) {
      const vBtn = document.querySelector(`[data-valve="${vKey}"]`);
      if (vBtn) {
        vBtn.classList.toggle('valve-open', isOpen);
        vBtn.classList.toggle('valve-shut', !isOpen);
        const statusSpan = vBtn.querySelector('.valve-state-text');
        if (statusSpan) {
          statusSpan.textContent = isOpen ? 'OPEN' : 'SHUT';
        }
      }
    }

    // Top SCADA grid status badge
    const gridStatusDot = document.getElementById('gridStatusDot');
    const gridStatusText = document.getElementById('gridStatusText');
    if (s.ai.pipeBurstDetected || s.pump.state === 'DRY_RUN_LOCKOUT') {
      gridStatusDot.className = 'status-dot alert';
      gridStatusText.textContent = s.ai.pipeBurstDetected ? 'AI: PIPE BURST DETECTED' : 'FAILSAFE: DRY-RUN LOCKOUT';
    } else {
      gridStatusDot.className = 'status-dot';
      gridStatusText.textContent = 'AUTONOMOUS GRID: OPTIMAL';
    }
  }

  // 4. API Remote Actions
  triggerScenario(scenario) {
    document.querySelectorAll('.preset-chip').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-scenario') === scenario);
    });
    fetch('/api/scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario })
    }).then(r => r.json()).then(() => {
      fetch('/api/status').then(r => r.json()).then(s => this.onTelemetryUpdate(s));
      this.loadAlertsLog();
    });
  }

  setPumpMode(mode) {
    document.querySelectorAll('.btn-mode').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
    });
    fetch('/api/pump/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    }).then(r => r.json()).then(() => {
      fetch('/api/status').then(r => r.json()).then(s => this.onTelemetryUpdate(s));
    });
  }

  togglePump(state) {
    fetch('/api/pump/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, mode: 'MANUAL' })
    }).then(r => r.json()).then(res => {
      if (!res.success && res.reason) {
        alert(res.reason);
        document.getElementById('pumpManualSwitch').checked = false;
      }
      fetch('/api/status').then(r => r.json()).then(s => this.onTelemetryUpdate(s));
      this.loadAlertsLog();
    });
  }

  triggerEmergencyStop() {
    fetch('/api/pump/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'OFF', state: false })
    }).then(r => r.json()).then(() => {
      fetch('/api/status').then(r => r.json()).then(s => this.onTelemetryUpdate(s));
      this.loadAlertsLog();
    });
  }

  toggleValve(valveId, state) {
    fetch('/api/valve/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valveId, state })
    }).then(r => r.json()).then(() => {
      fetch('/api/status').then(r => r.json()).then(s => this.onTelemetryUpdate(s));
      this.loadAlertsLog();
    });
  }

  toggleFixture(fixture, state) {
    fetch('/api/fixture/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: fixture, fixture, state })
    }).then(r => r.json()).then(res => {
      if (res && res.fixtures) {
        for (const [fixName, isActive] of Object.entries(res.fixtures)) {
          const fBtn = document.querySelector(`[data-fixture="${fixName}"]`);
          if (fBtn) fBtn.classList.toggle('fixture-active', !!isActive);
        }
      }
      fetch('/api/status').then(r => r.json()).then(s => this.onTelemetryUpdate(s));
      this.loadAlertsLog();
    }).catch(err => {
      console.error('Fixture toggle error:', err);
    });
  }

  setConsumptionRate(rate) {
    fetch('/api/consumption', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rate })
    });
  }

  refillSump() {
    fetch('/api/refill-sump', { method: 'POST' })
      .then(r => r.json())
      .then(() => {
        fetch('/api/status').then(r => r.json()).then(s => this.onTelemetryUpdate(s));
        this.loadAlertsLog();
      });
  }

  openFirmwareModal() {
    const modal = document.getElementById('modalFirmware');
    const display = document.getElementById('firmwareCodeDisplay');
    modal.classList.add('open');

    fetch('/api/firmware')
      .then(r => r.json())
      .then(data => {
        display.textContent = data.code || '// Firmware file not found';
      })
      .catch(() => {
        display.textContent = '// Error loading firmware';
      });
  }

  loadAlertsLog() {
    fetch('/api/alerts')
      .then(r => r.json())
      .then(alerts => {
        const tbody = document.getElementById('alertsTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        alerts.slice(0, 15).forEach(a => {
          const tr = document.createElement('tr');
          const d = new Date(a.timestamp);
          const timeStr = d.toTimeString().split(' ')[0];

          tr.innerHTML = `
            <td>${timeStr}</td>
            <td><span class="badge-sev ${a.severity}">${a.severity}</span></td>
            <td style="color:#f8fafc; font-weight:600;">${a.title}</td>
            <td>${a.message}</td>
            <td style="color:#00e5ff;">${a.mitigation || 'N/A'}</td>
          `;
          tbody.appendChild(tr);
        });
      });
  }
}

// Boot application upon DOM ready
window.addEventListener('DOMContentLoaded', () => {
  window.app = new AquaSyncApp();
});
