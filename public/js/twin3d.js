/**
 * ==============================================================================
 * AQUASYNC AI - HIGH-PRECISION DUAL-TANK 3D DIGITAL TWIN ENGINE
 * Pure Two-Tank Cyber-Physical Architecture:
 * 1. Rooftop Overhead Tank (OHT) - Gravity Distribution Reservoir
 * 2. Underground Sump Reservoir (UGT) - Municipal Intake & 1.5HP Submersible Station
 * 
 * Includes volumetric liquid shaders, wave harmonics, bobbing buoy physics,
 * ultrasonic sonar echo cones, high-pressure riser pipelines, and particle emitters.
 * 100% Zero external dependencies: offline hackathon resilient!
 * ==============================================================================
 */

class DigitalTwin3D {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    
    // Camera & Transform state
    this.yaw = 0.65; // Horizontal rotation angle (radians)
    this.pitch = 0.38; // Vertical tilt angle
    this.zoom = 0.92;
    this.targetZoom = 0.92;
    this.panX = 0;
    this.panY = -15; // Centered to frame both Rooftop and Sump tanks
    this.targetPanX = 0;
    this.targetPanY = -15;

    // View Preset Mode: 'ISOMETRIC', 'OHT_FOCUS', 'SUMP_FOCUS', 'CUTAWAY'
    this.cameraMode = 'ISOMETRIC';
    // Visual Style: 'REALISTIC', 'WIREFRAME', 'THERMAL'
    this.renderStyle = 'REALISTIC';
    // Mouse Interaction Mode: 'PAN' or 'ROTATE'
    this.mouseMode = 'PAN';

    // Particle systems
    this.pipeParticles = [];
    this.sonarWaves = [];
    this.leakParticles = [];
    this.sumpVortexParticles = [];
    this.fixtureParticles = [];
    this.bubbles = [];

    // Interaction flags
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.dragButton = 0;

    // Animation time
    this.time = 0;

    // Snapshot reference from backend
    this.snapshot = null;

    this.initEvents();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Start 60fps render loop
    requestAnimationFrame((t) => this.renderLoop(t));
  }

  resize() {
    const parent = this.canvas.parentElement;
    const rect = parent ? parent.getBoundingClientRect() : null;
    this.width = (rect && rect.width > 50) ? rect.width : (this.canvas.clientWidth || window.innerWidth * 0.65 || 800);
    this.height = (rect && rect.height > 50) ? rect.height : (this.canvas.clientHeight || 560);
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

  initEvents() {
    this.canvas.style.cursor = 'grab';

    // Prevent default context menu so right-click can be used for dragging
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.dragButton = e.button; // 0 = Left, 1 = Middle, 2 = Right
      this.canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.canvas.style.cursor = this.mouseMode === 'PAN' ? 'grab' : 'crosshair';
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;

      // If dragging with Right Button (2), Middle Button (1), holding Shift key, OR in PAN mode:
      if (this.dragButton === 2 || this.dragButton === 1 || e.shiftKey || this.mouseMode === 'PAN') {
        this.panX += dx;
        this.panY += dy;
        this.targetPanX = this.panX;
        this.targetPanY = this.panY;
      } else {
        // Orbit 3D Rotation
        this.yaw += dx * 0.008;
        this.pitch = Math.max(0.1, Math.min(1.3, this.pitch + dy * 0.008));
      }
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.09 : 0.91;
      this.targetZoom = Math.max(0.35, Math.min(2.8, this.targetZoom * zoomFactor));
    }, { passive: false });

    // Touch Event Handling for Mobile & Tablets
    let lastTouchX = 0;
    let lastTouchY = 0;
    let initialPinchDist = null;

    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDist = Math.hypot(dx, dy);
      }
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - lastTouchX;
        const dy = e.touches[0].clientY - lastTouchY;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;

        if (this.mouseMode === 'PAN') {
          this.panX += dx;
          this.panY += dy;
          this.targetPanX = this.panX;
          this.targetPanY = this.panY;
        } else {
          this.yaw += dx * 0.008;
          this.pitch = Math.max(0.1, Math.min(1.3, this.pitch + dy * 0.008));
        }
      } else if (e.touches.length === 2 && initialPinchDist) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDist = Math.hypot(dx, dy);
        const factor = currentDist / initialPinchDist;
        initialPinchDist = currentDist;
        this.targetZoom = Math.max(0.35, Math.min(2.8, this.targetZoom * factor));
      }
    }, { passive: true });
  }

  panBy(dx, dy) {
    this.panX += dx;
    this.panY += dy;
    this.targetPanX = this.panX;
    this.targetPanY = this.panY;
  }

  zoomBy(factor) {
    this.targetZoom = Math.max(0.35, Math.min(2.8, this.targetZoom * factor));
  }

  resetView() {
    this.setCameraMode('ISOMETRIC');
  }

  setMouseMode(mode) {
    this.mouseMode = mode;
    this.canvas.style.cursor = mode === 'PAN' ? 'grab' : 'crosshair';
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
    if (mode === 'ISOMETRIC') {
      this.yaw = 0.65;
      this.pitch = 0.38;
      this.targetZoom = 0.92;
      this.panX = 0;
      this.panY = -15; // Perfect framing of dual-tank system
    } else if (mode === 'OHT_FOCUS') {
      this.yaw = 0.40;
      this.pitch = 0.30;
      this.targetZoom = 1.45;
      this.panX = 100;
      this.panY = 150; // Focus high up on Rooftop OHT
    } else if (mode === 'SUMP_FOCUS') {
      this.yaw = 0.75;
      this.pitch = 0.50;
      this.targetZoom = 1.50;
      this.panX = -90;
      this.panY = -140; // Focus down on Sump & Submersible Pump
    } else if (mode === 'CUTAWAY') {
      this.yaw = 0.02; // Straight front architectural cutaway
      this.pitch = 0.12;
      this.targetZoom = 1.0;
      this.panX = 0;
      this.panY = 0;
    }
    this.targetPanX = this.panX;
    this.targetPanY = this.panY;
  }

  setRenderStyle(style) {
    this.renderStyle = style;
  }

  updateData(snapshot) {
    this.snapshot = snapshot;
  }

  // 3D Isometric projection math
  project3D(x, y, z) {
    const cx = this.width / 2 + this.panX;
    const cy = this.height / 2 + this.panY;

    // Yaw rotation
    const cosY = Math.cos(this.yaw);
    const sinY = Math.sin(this.yaw);
    const x1 = x * cosY - z * sinY;
    const z1 = x * sinY + z * cosY;

    // Pitch rotation
    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);
    const y1 = y * cosP - z1 * sinP;
    const z2 = y * sinP + z1 * cosP;

    const scale = this.zoom * 0.95;
    return {
      x: cx + x1 * scale,
      y: cy - y1 * scale,
      depth: z2
    };
  }

  renderLoop(timestamp) {
    this.time = timestamp * 0.001;
    this.zoom += (this.targetZoom - this.zoom) * 0.1;

    if (!this.width || this.width < 50) {
      this.resize();
    }

    this.ctx.clearRect(0, 0, this.width, this.height);

    // 1. Draw World Grid & Multi-Story Architectural Shaft
    this.drawWorldGrid();
    this.drawBuildingStructure();

    if (this.snapshot) {
      // 2. Draw TANK 2: Subterranean Sump Reservoir & Submersible Pump (Y = -180)
      this.drawSumpReservoir();

      // 3. Draw TANK 1: Rooftop Overhead Tank (OHT) & Tower (Y = 45)
      this.drawOverheadTank();

      // 4. Draw Interconnecting Riser & Gravity Piping with Flow Particles
      this.drawPipingSystem();

      // 4b. Draw Building Fixture Taps & Demand Sprays
      this.drawBuildingFixtures();

      // 5. Draw Sonar / Ultrasonic Acoustic Rays
      this.drawSonarTransducer();

      // 6. Draw Pipe Burst Spray if active
      if (this.snapshot.ai.pipeBurstDetected && this.snapshot.valves.v4_emergencyIsolation) {
        this.drawPipeBurstEffect();
      }
    }

    requestAnimationFrame((t) => this.renderLoop(t));
  }

  drawWorldGrid() {
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.04)';
    this.ctx.lineWidth = 1;

    const gridSize = 320;
    const step = 40;
    const yGround = -190;

    for (let x = -gridSize; x <= gridSize; x += step) {
      const p1 = this.project3D(x, yGround, -gridSize);
      const p2 = this.project3D(x, yGround, gridSize);
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();
    }
    for (let z = -gridSize; z <= gridSize; z += step) {
      const p1 = this.project3D(-gridSize, yGround, z);
      const p2 = this.project3D(gridSize, yGround, z);
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  // Draw Architectural Building Shaft connecting Rooftop to Basement
  drawBuildingStructure() {
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(100, 116, 139, 0.18)';
    this.ctx.lineWidth = 1;

    // Floor levels indicators
    const floorHeights = [ -180, -100, -20, 45 ];
    const floorLabels = [ 'BASEMENT / SUMP VAULT', 'GROUND UTILITY LEVEL', 'MID-RISER FLOOR 4', 'ROOFTOP RESERVOIR DECK' ];

    floorHeights.forEach((fy, idx) => {
      const pLeft = this.project3D(-160, fy, 0);
      const pRight = this.project3D(180, fy, 0);

      this.ctx.setLineDash([4, 6]);
      this.ctx.beginPath();
      this.ctx.moveTo(pLeft.x, pLeft.y);
      this.ctx.lineTo(pRight.x, pRight.y);
      this.ctx.stroke();

      this.ctx.setLineDash([]);
      this.ctx.font = '8px monospace';
      this.ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
      this.ctx.fillText(floorLabels[idx], pLeft.x - 10, pLeft.y - 4);
    });

    this.ctx.restore();
  }

  // Draw 3D Translucent Cylinder Tank
  drawCylinder(cx, cy, cz, radius, height, fillRatio, colorScheme, label, currentLiters, maxLiters) {
    const segments = 24;
    const fillHeight = height * Math.max(0.01, Math.min(1.0, fillRatio));
    const isWireframe = this.renderStyle === 'WIREFRAME';
    const isThermal = this.renderStyle === 'THERMAL';

    const bottomPts = [];
    const topPts = [];
    const waterPts = [];

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const px = cx + Math.cos(angle) * radius;
      const pz = cz + Math.sin(angle) * radius;

      bottomPts.push(this.project3D(px, cy, pz));
      topPts.push(this.project3D(px, cy + height, pz));
      
      // Dynamic fluid surface wave harmonics
      const wave = Math.sin(angle * 3 + this.time * 4.5) * (fillRatio > 0.05 ? 2.5 : 0);
      waterPts.push(this.project3D(px, cy + fillHeight + wave, pz));
    }

    // A. Glass outer cylinder
    this.ctx.save();
    if (isWireframe) {
      this.ctx.strokeStyle = '#00e5ff';
      this.ctx.lineWidth = 1.2;
    } else {
      this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      this.ctx.lineWidth = 1.5;
    }

    if (!isWireframe) {
      const glassGrad = this.ctx.createLinearGradient(
        bottomPts[0].x, bottomPts[0].y,
        bottomPts[Math.floor(segments / 2)].x, bottomPts[Math.floor(segments / 2)].y
      );
      glassGrad.addColorStop(0, 'rgba(15, 23, 42, 0.55)');
      glassGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.12)');
      glassGrad.addColorStop(1, 'rgba(15, 23, 42, 0.65)');
      this.ctx.fillStyle = glassGrad;

      this.ctx.beginPath();
      for (let i = 0; i < segments; i++) {
        this.ctx.moveTo(bottomPts[i].x, bottomPts[i].y);
        this.ctx.lineTo(topPts[i].x, topPts[i].y);
        this.ctx.lineTo(topPts[i + 1].x, topPts[i + 1].y);
        this.ctx.lineTo(bottomPts[i + 1].x, bottomPts[i + 1].y);
      }
      this.ctx.fill();
    }

    // B. Internal Liquid Body
    if (fillHeight > 2) {
      const waterGrad = this.ctx.createLinearGradient(
        bottomPts[0].x, bottomPts[0].y,
        waterPts[0].x, waterPts[0].y
      );

      if (isThermal) {
        waterGrad.addColorStop(0, '#ef4444'); // High hydrostatic pressure at base
        waterGrad.addColorStop(0.5, '#f59e0b');
        waterGrad.addColorStop(1, '#10b981'); // Surface pressure
      } else {
        waterGrad.addColorStop(0, 'rgba(2, 132, 199, 0.88)');
        waterGrad.addColorStop(1, 'rgba(0, 229, 255, 0.72)');
      }

      this.ctx.fillStyle = isWireframe ? 'rgba(0, 229, 255, 0.15)' : waterGrad;

      this.ctx.beginPath();
      for (let i = 0; i < segments; i++) {
        this.ctx.moveTo(bottomPts[i].x, bottomPts[i].y);
        this.ctx.lineTo(waterPts[i].x, waterPts[i].y);
        this.ctx.lineTo(waterPts[i + 1].x, waterPts[i + 1].y);
        this.ctx.lineTo(bottomPts[i + 1].x, bottomPts[i + 1].y);
      }
      this.ctx.fill();

      // Water Surface Ellipse
      this.ctx.beginPath();
      this.ctx.moveTo(waterPts[0].x, waterPts[0].y);
      for (let i = 1; i <= segments; i++) {
        this.ctx.lineTo(waterPts[i].x, waterPts[i].y);
      }
      this.ctx.closePath();
      this.ctx.fillStyle = isThermal ? 'rgba(16, 185, 129, 0.85)' : 'rgba(56, 189, 248, 0.88)';
      this.ctx.fill();
      this.ctx.strokeStyle = '#38bdf8';
      this.ctx.stroke();

      // Floating Sensor Buoy on water surface
      const buoyCenter = this.project3D(cx, cy + fillHeight + Math.sin(this.time * 4) * 2, cz);
      this.ctx.beginPath();
      this.ctx.arc(buoyCenter.x, buoyCenter.y, 6.5 * this.zoom, 0, Math.PI * 2);
      this.ctx.fillStyle = '#f59e0b';
      this.ctx.shadowColor = '#f59e0b';
      this.ctx.shadowBlur = 9;
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
    }

    // C. Top & Bottom Metallic Rims
    this.ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      if (i === 0) this.ctx.moveTo(topPts[i].x, topPts[i].y);
      else this.ctx.lineTo(topPts[i].x, topPts[i].y);
    }
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    this.ctx.stroke();

    this.ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      if (i === 0) this.ctx.moveTo(bottomPts[i].x, bottomPts[i].y);
      else this.ctx.lineTo(bottomPts[i].x, bottomPts[i].y);
    }
    this.ctx.stroke();

    // D. Vertical Calibrated Level Scale
    const rulerX = cx + radius + 10;
    const pRulerBottom = this.project3D(rulerX, cy, cz);
    const pRulerTop = this.project3D(rulerX, cy + height, cz);

    this.ctx.beginPath();
    this.ctx.moveTo(pRulerBottom.x, pRulerBottom.y);
    this.ctx.lineTo(pRulerTop.x, pRulerTop.y);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    [0.25, 0.50, 0.75, 0.90, 1.0].forEach(pct => {
      const pTick = this.project3D(rulerX, cy + height * pct, cz);
      this.ctx.beginPath();
      this.ctx.moveTo(pTick.x - 4, pTick.y);
      this.ctx.lineTo(pTick.x + 4, pTick.y);
      this.ctx.stroke();

      this.ctx.font = '9px monospace';
      this.ctx.fillStyle = pct === 0.90 ? '#f59e0b' : (pct === 0.25 ? '#ef4444' : 'rgba(255, 255, 255, 0.7)');
      this.ctx.fillText(`${Math.round(pct * 100)}%`, pTick.x + 8, pTick.y + 3);
    });

    // E. 3D Floating Nameplate
    const pLabel = this.project3D(cx, cy + height + 24, cz);
    this.ctx.font = 'bold 11px monospace';
    this.ctx.fillStyle = '#fff';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(label, pLabel.x, pLabel.y);

    this.ctx.font = '10px monospace';
    this.ctx.fillStyle = '#38bdf8';
    this.ctx.fillText(`${Math.round(currentLiters)} L / ${maxLiters} L (${(fillRatio * 100).toFixed(1)}%)`, pLabel.x, pLabel.y + 14);

    this.ctx.restore();
  }

  // Draw TANK 1: Rooftop Overhead Tank (OHT)
  drawOverheadTank() {
    const oht = this.snapshot.oht;
    const cx = -70;
    const cy = 45;
    const cz = 0;
    const radius = 62;
    const height = 120;
    const fillRatio = oht.levelPct / 100;

    // Structural steel tower scaffolding
    this.drawSupportScaffolding(cx, cy, cz, radius);

    // Render 3D Cylinder
    this.drawCylinder(cx, cy, cz, radius, height, fillRatio, 'blue', 'ROOFTOP TANK (OHT)', oht.currentLiters, oht.capacityLiters);
  }

  drawSupportScaffolding(cx, cy, cz, radius) {
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(71, 85, 105, 0.7)';
    this.ctx.lineWidth = 2;

    const baseFloorY = -20; // 4th floor girder platform
    const legOffsets = [
      [-radius * 0.8, -radius * 0.8],
      [radius * 0.8, -radius * 0.8],
      [radius * 0.8, radius * 0.8],
      [-radius * 0.8, radius * 0.8]
    ];

    legOffsets.forEach(([dx, dz]) => {
      const topP = this.project3D(cx + dx, cy, cz + dz);
      const btmP = this.project3D(cx + dx, baseFloorY, cz + dz);
      this.ctx.beginPath();
      this.ctx.moveTo(topP.x, topP.y);
      this.ctx.lineTo(btmP.x, btmP.y);
      this.ctx.stroke();
    });

    // Cross brace
    const p1 = this.project3D(cx + legOffsets[0][0], cy - 10, cz + legOffsets[0][1]);
    const p2 = this.project3D(cx + legOffsets[1][0], baseFloorY + 10, cz + legOffsets[1][1]);
    this.ctx.beginPath();
    this.ctx.moveTo(p1.x, p1.y);
    this.ctx.lineTo(p2.x, p2.y);
    this.ctx.stroke();

    this.ctx.restore();
  }

  // Draw TANK 2: Subterranean Sump Reservoir & 1.5HP Submersible Station
  drawSumpReservoir() {
    const sump = this.snapshot.sump;
    const cx = 90;
    const cy = -180;
    const cz = 0;
    const radius = 80;
    const height = 110;
    const fillRatio = sump.levelPct / 100;

    this.drawCylinder(cx, cy, cz, radius, height, fillRatio, 'blue', 'SUBTERRANEAN SUMP (UGT)', sump.currentLiters, sump.capacityLiters);

    // Submersible Pump at the base of the Sump
    const pumpX = cx;
    const pumpY = cy + 15;
    const pumpZ = cz;
    const pPump = this.project3D(pumpX, pumpY, pumpZ);

    this.ctx.save();
    // Pump Body
    const isRunning = this.snapshot.pump.state === 'RUNNING';
    const isLockout = this.snapshot.pump.state === 'DRY_RUN_LOCKOUT';

    this.ctx.fillStyle = isRunning ? '#10b981' : (isLockout ? '#ef4444' : '#475569');
    this.ctx.shadowColor = this.ctx.fillStyle;
    this.ctx.shadowBlur = isRunning ? 14 : 2;
    this.ctx.beginPath();
    this.ctx.arc(pPump.x, pPump.y, 15 * this.zoom, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.shadowBlur = 0;

    // Spinning impeller animation
    if (isRunning) {
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const bladeAngle = this.time * 20 + (i * Math.PI / 2);
        this.ctx.beginPath();
        this.ctx.moveTo(pPump.x, pPump.y);
        this.ctx.lineTo(
          pPump.x + Math.cos(bladeAngle) * (12 * this.zoom),
          pPump.y + Math.sin(bladeAngle) * (12 * this.zoom)
        );
        this.ctx.stroke();
      }

      // Suction Vortex Particles in Sump
      if (Math.random() > 0.4) {
        this.sumpVortexParticles.push({
          angle: Math.random() * Math.PI * 2,
          radius: 25 * this.zoom,
          life: 1.0
        });
      }

      for (let i = this.sumpVortexParticles.length - 1; i >= 0; i--) {
        const vp = this.sumpVortexParticles[i];
        vp.angle += 0.15;
        vp.radius -= 0.6;
        vp.life -= 0.04;

        if (vp.life <= 0 || vp.radius <= 2) {
          this.sumpVortexParticles.splice(i, 1);
          continue;
        }

        const vx = pPump.x + Math.cos(vp.angle) * vp.radius;
        const vy = pPump.y + Math.sin(vp.angle) * (vp.radius * 0.4);

        this.ctx.beginPath();
        this.ctx.arc(vx, vy, 1.8 * this.zoom, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(0, 229, 255, ${vp.life})`;
        this.ctx.fill();
      }
    }

    // Pump Label
    this.ctx.font = 'bold 9px monospace';
    this.ctx.fillStyle = '#f8fafc';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(isRunning ? '1.5HP SUBMERSIBLE' : (isLockout ? 'CAVITATION TRIP' : '1.5HP STANDBY'), pPump.x, pPump.y + 24);

    this.ctx.restore();
  }

  // Draw Vertical High-Pressure Riser & Domestic Gravity Lines
  drawPipingSystem() {
    const pumpRunning = this.snapshot.pump.state === 'RUNNING';
    const isIsolated = !this.snapshot.valves.v4_emergencyIsolation;

    this.ctx.save();
    this.ctx.lineWidth = 4.5 * this.zoom;
    this.ctx.lineCap = 'round';

    // 1. High-Pressure Transfer Riser: Sump -> Vertical Shaft -> Rooftop Intake
    const riserWaypoints = [
      { x: 90,  y: -165, z: 0 },    // Sump discharge
      { x: 90,  y: -60,  z: 0 },    // Basement ceiling
      { x: 10,  y: -15,  z: 0 },    // Mid building junction
      { x: -70, y: 20,   z: 0 },    // Below OHT
      { x: -70, y: 170,  z: 0 },    // High intake arch
      { x: -45, y: 160,  z: 0 }     // Inflow spout inside OHT
    ];

    this.ctx.strokeStyle = isIsolated ? '#ef4444' : 'rgba(56, 189, 248, 0.45)';
    this.ctx.beginPath();
    for (let i = 0; i < riserWaypoints.length; i++) {
      const p = this.project3D(riserWaypoints[i].x, riserWaypoints[i].y, riserWaypoints[i].z);
      if (i === 0) this.ctx.moveTo(p.x, p.y);
      else this.ctx.lineTo(p.x, p.y);
    }
    this.ctx.stroke();

    // 2. Solenoid Valve V1 & V4 on Riser Pipe
    const pValve = this.project3D(10, -15, 0);
    this.ctx.beginPath();
    this.ctx.arc(pValve.x, pValve.y, 8.5 * this.zoom, 0, Math.PI * 2);
    this.ctx.fillStyle = isIsolated ? '#ef4444' : '#10b981';
    this.ctx.shadowColor = this.ctx.fillStyle;
    this.ctx.shadowBlur = 10;
    this.ctx.fill();
    this.ctx.shadowBlur = 0;

    this.ctx.font = '8px monospace';
    this.ctx.fillStyle = '#fff';
    this.ctx.fillText(isIsolated ? 'V4:ISOLATED' : 'V1:FEED_OPEN', pValve.x + 14, pValve.y + 3);

    // 3. Domestic Gravity Downcomer Line (From OHT bottom down to building taps)
    const gravityWaypoints = [
      { x: -70, y: 45,  z: 0 },
      { x: -110, y: 45, z: 0 },
      { x: -110, y: -90, z: 0 },
      { x: -130, y: -90, z: 0 }
    ];

    this.ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
    this.ctx.beginPath();
    for (let i = 0; i < gravityWaypoints.length; i++) {
      const p = this.project3D(gravityWaypoints[i].x, gravityWaypoints[i].y, gravityWaypoints[i].z);
      if (i === 0) this.ctx.moveTo(p.x, p.y);
      else this.ctx.lineTo(p.x, p.y);
    }
    this.ctx.stroke();

    const pTapLabel = this.project3D(-130, -90, 0);
    this.ctx.font = '8px monospace';
    this.ctx.fillStyle = '#c084fc';
    this.ctx.fillText('🚰 GRAVITY MAINS', pTapLabel.x - 70, pTapLabel.y + 3);

    // 4. Animated Flowing Water Particles along Riser
    if (pumpRunning && !isIsolated) {
      if (Math.random() > 0.25) {
        this.pipeParticles.push({
          progress: 0,
          speed: 0.014 + Math.random() * 0.006,
          size: 3.5 + Math.random() * 2
        });
      }

      for (let i = this.pipeParticles.length - 1; i >= 0; i--) {
        const pt = this.pipeParticles[i];
        pt.progress += pt.speed;

        if (pt.progress >= 1.0) {
          this.pipeParticles.splice(i, 1);
          continue;
        }

        const totalSegments = riserWaypoints.length - 1;
        const currentSegment = Math.min(totalSegments - 1, Math.floor(pt.progress * totalSegments));
        const segT = (pt.progress * totalSegments) - currentSegment;

        const w1 = riserWaypoints[currentSegment];
        const w2 = riserWaypoints[currentSegment + 1];

        const interpX = w1.x + (w2.x - w1.x) * segT;
        const interpY = w1.y + (w2.y - w1.y) * segT;
        const interpZ = w1.z + (w2.z - w1.z) * segT;

        const pRender = this.project3D(interpX, interpY, interpZ);

        this.ctx.beginPath();
        this.ctx.arc(pRender.x, pRender.y, pt.size * this.zoom, 0, Math.PI * 2);
        this.ctx.fillStyle = '#00e5ff';
        this.ctx.shadowColor = '#00e5ff';
        this.ctx.shadowBlur = 9;
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
      }
    }

    this.ctx.restore();
  }

  // Draw Interactive Building Fixture Outlets & Water Spray along Shaft
  drawBuildingFixtures() {
    if (!this.snapshot || !this.snapshot.fixtures) return;

    const fixtures = [
      { key: 'bathrooms', label: '🚿 BATHROOMS (+18 L/m)', y: 15, color: '#38bdf8' },
      { key: 'kitchens', label: '🍳 KITCHENS (+10 L/m)', y: -40, color: '#34d399' },
      { key: 'irrigation', label: '🌱 IRRIGATION (+15 L/m)', y: -95, color: '#a3e635' },
      { key: 'fireHydrant', label: '🧯 FIRE HYDRANT (+55 L/m)', y: -150, color: '#f87171' }
    ];

    this.ctx.save();

    fixtures.forEach(fix => {
      const isActive = Boolean(this.snapshot.fixtures[fix.key]);
      const branchStartX = -110;
      const branchEndX = -155;
      const branchY = fix.y;

      const pStart = this.project3D(branchStartX, branchY, 0);
      const pEnd = this.project3D(branchEndX, branchY, 0);

      // Branch pipe from downcomer
      this.ctx.beginPath();
      this.ctx.moveTo(pStart.x, pStart.y);
      this.ctx.lineTo(pEnd.x, pEnd.y);
      this.ctx.strokeStyle = isActive ? fix.color : 'rgba(71, 85, 105, 0.45)';
      this.ctx.lineWidth = isActive ? 3.5 * this.zoom : 2 * this.zoom;
      this.ctx.stroke();

      // Nozzle / Tap
      this.ctx.beginPath();
      this.ctx.arc(pEnd.x, pEnd.y, (isActive ? 5.5 : 3.5) * this.zoom, 0, Math.PI * 2);
      this.ctx.fillStyle = isActive ? fix.color : '#64748b';
      if (isActive) {
        this.ctx.shadowColor = fix.color;
        this.ctx.shadowBlur = 10;
      }
      this.ctx.fill();
      this.ctx.shadowBlur = 0;

      // Fixture State Label
      this.ctx.font = isActive ? 'bold 9px monospace' : '8px monospace';
      this.ctx.fillStyle = isActive ? '#f8fafc' : 'rgba(148, 163, 184, 0.5)';
      this.ctx.textAlign = 'right';
      this.ctx.fillText(isActive ? `● ${fix.label}` : `○ ${fix.label.split(' (')[0]}: OFF`, pEnd.x - 8, pEnd.y + 3);

      // Spray particles if active
      if (isActive) {
        if (Math.random() > 0.3) {
          this.fixtureParticles.push({
            x: pEnd.x,
            y: pEnd.y,
            vx: -0.8 - Math.random() * 1.5,
            vy: 2.0 + Math.random() * 2.5,
            life: 1.0,
            color: fix.color
          });
        }
      }
    });

    // Update and draw fixture spray particles
    for (let i = this.fixtureParticles.length - 1; i >= 0; i--) {
      const p = this.fixtureParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.06;

      if (p.life <= 0) {
        this.fixtureParticles.splice(i, 1);
        continue;
      }

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, (2 * p.life) * this.zoom, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.life;
      this.ctx.fill();
      this.ctx.globalAlpha = 1.0;
    }

    this.ctx.restore();
  }

  // Draw Ultrasonic Sonar Acoustic Rings down into OHT
  drawSonarTransducer() {
    const oht = this.snapshot.oht;
    const cx = -70;
    const cz = 0;
    const sensorY = 45 + 120; // Top lid
    const waterY = 45 + (120 * (oht.levelPct / 100));

    const pSensor = this.project3D(cx, sensorY, cz);
    const pWater = this.project3D(cx, waterY, cz);

    this.ctx.save();
    // Transducer box
    this.ctx.fillStyle = '#f59e0b';
    this.ctx.fillRect(pSensor.x - 8, pSensor.y - 12, 16, 12);

    // Pulse Sonar Waves
    if (Math.random() > 0.65) {
      this.sonarWaves.push({ progress: 0 });
    }

    this.ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
    this.ctx.lineWidth = 1.5;

    for (let i = this.sonarWaves.length - 1; i >= 0; i--) {
      const sw = this.sonarWaves[i];
      sw.progress += 0.045;
      if (sw.progress >= 1.0) {
        this.sonarWaves.splice(i, 1);
        continue;
      }

      const waveY = sensorY - (sensorY - waterY) * sw.progress;
      const pWave = this.project3D(cx, waveY, cz);
      const waveRadius = 4 + sw.progress * 20;

      this.ctx.beginPath();
      this.ctx.ellipse(pWave.x, pWave.y, waveRadius * this.zoom, (waveRadius * 0.4) * this.zoom, 0, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    // Distance laser guideline
    this.ctx.setLineDash([4, 4]);
    this.ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    this.ctx.beginPath();
    this.ctx.moveTo(pSensor.x, pSensor.y);
    this.ctx.lineTo(pWater.x, pWater.y);
    this.ctx.stroke();

    this.ctx.setLineDash([]);
    this.ctx.font = '8px monospace';
    this.ctx.fillStyle = '#f59e0b';
    this.ctx.fillText(`Sonar: ${oht.sensorDistanceCm} cm`, pSensor.x + 14, (pSensor.y + pWater.y) / 2);

    this.ctx.restore();
  }

  // Draw Pipe Burst Leak Explosion on Riser
  drawPipeBurstEffect() {
    const burstPos = { x: 10, y: -15, z: 0 };
    const pBurst = this.project3D(burstPos.x, burstPos.y, burstPos.z);

    this.ctx.save();
    const flash = Math.sin(this.time * 20) > 0;
    this.ctx.beginPath();
    this.ctx.arc(pBurst.x, pBurst.y, 18 * this.zoom, 0, Math.PI * 2);
    this.ctx.fillStyle = flash ? 'rgba(239, 68, 68, 0.85)' : 'rgba(239, 68, 68, 0.25)';
    this.ctx.fill();

    for (let i = 0; i < 4; i++) {
      this.leakParticles.push({
        x: pBurst.x,
        y: pBurst.y,
        vx: (Math.random() - 0.5) * 9,
        vy: -Math.random() * 9,
        life: 1.0
      });
    }

    for (let i = this.leakParticles.length - 1; i >= 0; i--) {
      const lp = this.leakParticles[i];
      lp.x += lp.vx;
      lp.y += lp.vy;
      lp.vy += 0.4;
      lp.life -= 0.04;

      if (lp.life <= 0) {
        this.leakParticles.splice(i, 1);
        continue;
      }

      this.ctx.beginPath();
      this.ctx.arc(lp.x, lp.y, 2.5 * this.zoom, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(0, 229, 255, ${lp.life})`;
      this.ctx.fill();
    }

    this.ctx.font = 'bold 11px monospace';
    this.ctx.fillStyle = '#ef4444';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('🚨 RISER MAINLINE RUPTURE (65 L/min)', pBurst.x, pBurst.y - 28);
    this.ctx.restore();
  }
}

window.DigitalTwin3D = DigitalTwin3D;
