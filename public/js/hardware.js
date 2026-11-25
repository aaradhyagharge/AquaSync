/**
 * ==============================================================================
 * AQUASYNC AI - EMBEDDED HARDWARE LAB & ESP32 SIMULATOR
 * Renders virtual SSD1306 0.96" OLED display, status GPIO LEDs,
 * and high-baud UART serial terminal stream.
 * ==============================================================================
 */

class HardwareStudio {
  constructor(oledCanvasId, terminalBodyId) {
    this.oledCanvas = document.getElementById(oledCanvasId);
    this.oledCtx = this.oledCanvas.getContext('2d');
    this.terminalBody = document.getElementById(terminalBodyId);

    this.oledWidth = 128;
    this.oledHeight = 64;
    this.scale = 2; // Upscale for crisp pixel art

    this.oledCanvas.width = this.oledWidth * this.scale;
    this.oledCanvas.height = this.oledHeight * this.scale;

    this.serialLogs = [];
    this.maxLogs = 80;

    this.lastRenderTime = 0;
  }

  update(snapshot) {
    if (!snapshot) return;

    // 1. Render Virtual OLED
    this.renderOled(snapshot);

    // 2. Update Board LEDs
    const ledBlue = document.getElementById('ledBlueWifi');
    const ledRed = document.getElementById('ledRedPump');
    const ledAlarm = document.getElementById('ledBuzzerAlarm');

    if (ledBlue) {
      // Heartbeat blink
      const isBlink = Math.floor(Date.now() / 400) % 2 === 0;
      ledBlue.classList.toggle('on', isBlink);
    }

    if (ledRed) {
      ledRed.classList.toggle('on', snapshot.pump.state === 'RUNNING');
    }

    if (ledAlarm) {
      const isAlarm = snapshot.pump.state === 'DRY_RUN_LOCKOUT' || snapshot.ai.pipeBurstDetected;
      ledAlarm.classList.toggle('on', isAlarm);
    }

    // 3. Append Serial Log
    if (snapshot.hardware && snapshot.hardware.lastSerialLog) {
      this.appendSerialLog(snapshot.hardware.lastSerialLog);
    }
  }

  renderOled(snapshot) {
    const ctx = this.oledCtx;
    const w = this.oledWidth * this.scale;
    const h = this.oledHeight * this.scale;

    // Monochrome OLED deep black
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, w, h);

    // OLED cyan/white phosphor glow color
    ctx.fillStyle = '#67e8f9';
    ctx.font = 'bold 9px monospace';

    // Header bar
    ctx.fillRect(0, 0, w, 14);
    ctx.fillStyle = '#000';
    ctx.fillText('AQUASYNC DUAL-GRID v3.0', 6, 10);

    // WiFi icon
    ctx.fillText('📶', w - 24, 10);

    ctx.fillStyle = '#67e8f9';

    // OHT Level line
    const oht = snapshot.oht;
    ctx.fillText(`OHT:  ${oht.levelPct.toFixed(1)}% [${oht.currentLiters}L]`, 8, 28);
    this.drawOledProgressBar(ctx, 8, 32, 112 * this.scale, 6, oht.levelPct / 100);

    // Sump Level line
    const sump = snapshot.sump;
    ctx.fillText(`SUMP: ${sump.levelPct.toFixed(1)}% [${sump.currentLiters}L]`, 8, 48);
    this.drawOledProgressBar(ctx, 8, 52, 112 * this.scale, 6, sump.levelPct / 100);

    // Pump & Actuator State
    const pumpState = snapshot.pump.state;
    ctx.font = '8px monospace';
    ctx.fillText(`PUMP: ${pumpState} | ${snapshot.pump.currentAmps}A | ${snapshot.flowmeters.inflowRate}L/M`, 8, 70);

    // Solenoids & Gravity Line
    ctx.fillText(`MODE: ${snapshot.pump.mode} | SOL V4: ${snapshot.valves.v4_emergencyIsolation ? 'OPEN' : 'SHUT'}`, 8, 82);

    // Scanline CRT effect for OLED
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 1);
    }
  }

  drawOledProgressBar(ctx, x, y, width, height, ratio) {
    ctx.strokeStyle = '#67e8f9';
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = '#67e8f9';
    const fillW = Math.max(0, Math.min(width - 2, (width - 2) * ratio));
    ctx.fillRect(x + 1, y + 1, fillW, height - 2);
  }

  appendSerialLog(logText) {
    if (!this.terminalBody) return;
    if (this.serialLogs.length > 0 && this.serialLogs[this.serialLogs.length - 1] === logText) {
      return; // Deduplicate
    }

    this.serialLogs.push(logText);
    if (this.serialLogs.length > this.maxLogs) {
      this.serialLogs.shift();
    }

    const lineEl = document.createElement('div');
    lineEl.className = 'terminal-line';

    if (logText.includes('DRY_RUN') || logText.includes('RUPTURE') || logText.includes('FAILSAFE')) {
      lineEl.classList.add('alert');
    } else if (logText.includes('WARN') || logText.includes('Echo')) {
      lineEl.classList.add('warn');
    } else if (logText.includes('MQTT') || logText.includes('OK')) {
      lineEl.classList.add('succ');
    }

    lineEl.textContent = logText;
    this.terminalBody.appendChild(lineEl);

    // Auto scroll to bottom
    this.terminalBody.scrollTop = this.terminalBody.scrollHeight;
  }
}

window.HardwareStudio = HardwareStudio;
