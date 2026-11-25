/**
 * ==============================================================================
 * AQUASYNC AI - REAL-TIME TELEMETRY CHARTING ENGINE
 * 60 FPS Canvas-based Multi-Channel Oscilloscope & Historian
 * Zero external libraries required: zero load lag, 100% hackathon proof!
 * ==============================================================================
 */

class TelemetryChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.maxPoints = 50;
    this.history = []; // Array of { time, oht, sump, amps, flow }

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const parent = this.canvas.parentElement;
    const rect = parent ? parent.getBoundingClientRect() : null;
    this.width = (rect && rect.width > 50) ? rect.width : (this.canvas.clientWidth || 600);
    this.height = (rect && rect.height > 50) ? rect.height : (this.canvas.clientHeight || 280);
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    if (this.ctx.resetTransform) {
      this.ctx.resetTransform();
    } else {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    this.ctx.scale(dpr, dpr);
  }

  addDataPoint(snapshot) {
    if (!snapshot) return;

    this.history.push({
      time: Date.now(),
      oht: snapshot.oht.levelPct,
      sump: snapshot.sump.levelPct,
      amps: snapshot.pump.currentAmps * 12, // Scaled for visibility on 0-100% chart
      flow: snapshot.flowmeters.inflowRate * 1.5,
      demand: Math.min(100, snapshot.flowmeters.consumptionRate * 1.2)
    });

    if (this.history.length > this.maxPoints) {
      this.history.shift();
    }

    this.render();
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    if (this.history.length < 2) return;

    const padLeft = 45;
    const padRight = 20;
    const padTop = 20;
    const padBottom = 30;
    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    // 1. Draw Grid lines and Y-axis labels
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.font = '9px monospace';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';

    const yTicks = [0, 25, 50, 75, 100];
    yTicks.forEach(val => {
      const yPos = padTop + plotH - (val / 100) * plotH;
      ctx.beginPath();
      ctx.moveTo(padLeft, yPos);
      ctx.lineTo(w - padRight, yPos);
      ctx.stroke();

      ctx.fillText(`${val}%`, padLeft - 8, yPos + 3);
    });

    // 2. Draw Series Lines
    const series = [
      { key: 'oht', color: '#00e5ff', label: 'OHT Level (%)', width: 2.5 },
      { key: 'sump', color: '#10b981', label: 'Sump Level (%)', width: 2 },
      { key: 'amps', color: '#a855f7', label: 'Motor Current (A)', width: 1.5 },
      { key: 'flow', color: '#f59e0b', label: 'Riser Inflow (L/m)', width: 1.5 },
      { key: 'demand', color: '#f43f5e', label: 'Demand (L/m)', width: 1.5 }
    ];

    series.forEach(s => {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.beginPath();

      for (let i = 0; i < this.history.length; i++) {
        const pt = this.history[i];
        const val = Math.max(0, Math.min(100, pt[s.key]));
        const xPos = padLeft + (i / (this.maxPoints - 1)) * plotW;
        const yPos = padTop + plotH - (val / 100) * plotH;

        if (i === 0) ctx.moveTo(xPos, yPos);
        else ctx.lineTo(xPos, yPos);
      }
      ctx.stroke();

      // Draw glowing end dot
      const lastPt = this.history[this.history.length - 1];
      const lastX = padLeft + ((this.history.length - 1) / (this.maxPoints - 1)) * plotW;
      const lastY = padTop + plotH - (Math.max(0, Math.min(100, lastPt[s.key])) / 100) * plotH;

      ctx.beginPath();
      ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // 3. Draw Legend at Top Right
    ctx.textAlign = 'left';
    ctx.font = '9px monospace';
    let legendX = padLeft + 10;
    series.forEach(s => {
      ctx.fillStyle = s.color;
      ctx.fillRect(legendX, 8, 8, 8);
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(s.label, legendX + 12, 15);
      legendX += ctx.measureText(s.label).width + 24;
    });
  }
}

window.TelemetryChart = TelemetryChart;
