# 🌊 AquaSync AI™ — Complete Project Guide & Hardware Specifications

> **Project:** Autonomous Dual-Tank Smart Water Grid with 3D Digital Twin & Variable-Pressure Fixture Demand Simulation  
> **Target Audience:** Hardware Team, Software Developers, Project Reviewers & Evaluators  

---

## 📑 Table of Contents
1. [Project Overview & Architecture](#1-project-overview--architecture)
2. [Software Web Portal & 3D Digital Twin](#2-software-web-portal--3d-digital-twin)
3. [Complete Hardware Bill of Materials (BOM) & Costs](#3-complete-hardware-bill-of-materials-bom--costs)
4. [Electrical Wiring & Pinout Guide](#4-electrical-wiring--pinout-guide)
5. [Mechanical & Plumbing Assembly](#5-mechanical--plumbing-assembly)
6. [Variable Pressure Fixture Demand Simulation](#6-variable-pressure-fixture-demand-simulation)
7. [Testing, Calibration & Bring-Up Checklist](#7-testing-calibration--bring-up-checklist)
8. [ESP32 Production Firmware (Arduino C++)](#8-esp32-production-firmware-arduino-c)

---

## 1. Project Overview & Architecture

AquaSync AI™ is a next-generation autonomous water grid system designed for high-rise residential and commercial buildings. It models and controls a closed-loop dual-tank infrastructure:
1. **Rooftop Overhead Tank (OHT-2500):** Elevated at $+22.5\,\text{m}$ for gravity distribution across domestic building fixtures.
2. **Subterranean Sump Reservoir (UGT-6000):** Located in the basement at $-3.5\,\text{m}$ for municipal intake buffer and high-head submersible pump suction.

### Closed-Loop Zero-Waste Recirculation
Unlike standard setups where water drains into the sewer, our hardware and software model uses **closed-loop recirculation**:
- Water transferred up from the Sump to the Rooftop Tank by Pump 1.
- Water drained by building fixtures (Bathrooms, Kitchens, Irrigation, Fire Hydrant) recirculates directly back down into the Sump.
- **Zero water waste, zero exterior plumbing, 100% continuous tabletop operation.**

---

## 2. Software Web Portal & 3D Digital Twin

- **Backend:** Node.js (v24 native runtime, zero external npm dependencies).
- **Frontend:** Pure HTML5 Canvas 3D rendering engine, Web Audio mechanical relay synthesizer, 5-channel real-time oscilloscope chart.
- **Telemetry Endpoints:**
  - `POST /api/hardware/telemetry` — Receives live sensor JSON from the ESP32.
  - `POST /api/fixture/toggle` — Controls building fixture demand loads.
  - `GET /events` — Real-time Server-Sent Events (SSE) telemetry stream.
- **Default Local URL:** `http://localhost:5050` (or local Wi-Fi IP `http://<IP>:5050`).

---

## 3. Complete Hardware Bill of Materials (BOM) & Costs

| Component | Exact Model / Spec | Qty | Purpose | Est. Cost (INR) |
|---|---|---|---|---|
| **Microcontroller** | ESP32 DevKit V1 (30-pin) | 1 | WiFi networking, PWM generation, FSM | **₹340** |
| **Level Sensors (×2)** | HC-SR04 Ultrasonic Sensors | 2 | Level tracking (OHT & Sump) | **₹136** |
| **Transfer Pump** | 5V DC Mini Submersible USB Pump | 1 | Transfers water Sump $\rightarrow$ Rooftop | **₹110** |
| **Transfer Relay** | 1-Channel or 2-Channel 5V Relay | 1 | Switches transfer pump ON/OFF | **₹60** |
| **Demand Drain Pump** | 5V/6V Mini DC Pump | 1 | Actuates fixture demand drain | **₹110** |
| **MOSFET Module** | IRF520 or AOD4184 Module | 1 | **PWM variable pressure control** | **₹45** |
| **Tanks (Enclosures)** | 2L/3L Transparent Plastic Jars | 2 | Physical Rooftop & Sump tanks | **₹80** |
| **Silicone Tubing** | 6mm ID / 8mm OD Clear Tube | 2m | Riser pipe & gravity drain line | **₹50** |
| **Breadboard & Wires**| 400-Point Breadboard + Jumpers | 1 | Solderless plug-and-play wiring | **₹110** |
| **Power Supply** | Standard 5V 2A Smartphone Charger | 1 | Powers ESP32, sensors & both pumps | **₹0** (Existing) |
| **Flyback Diode** | 1N4007 Diode | 2 | Snubber across pump motor terminals | **₹5** |
| **TOTAL** | | | | **~₹1,050 – ₹1,150 (~$13–$15)** |

---

## 4. Electrical Wiring & Pinout Guide

> **IMPORTANT:** Connect the ground (`GND`) of the 5V power supply, ESP32, Relay module, and MOSFET module together (Common Ground).

| Module | Pin | ESP32 GPIO | Description |
|---|---|---|---|
| **OHT Sensor** | `TRIG` | **`GPIO 5`** | Rooftop Sonar Trigger |
| | `ECHO` | **`GPIO 18`** | Rooftop Sonar Echo |
| **Sump Sensor** | `TRIG` | **`GPIO 19`** | Sump Sonar Trigger |
| | `ECHO` | **`GPIO 23`** | Sump Sonar Echo |
| **Transfer Relay** | `IN` | **`GPIO 26`** | 5V Relay trigger (Pump 1) |
| **PWM MOSFET** | `SIG` | **`GPIO 27`** | PWM pressure throttle (Pump 2) |
| **Piezo Buzzer** | `POS` | **`GPIO 4`** | Dry-run / Cavitation alarm |
| **Status LED** | `POS` | **`GPIO 2`** | ESP32 onboard blue status LED |
| **OLED (Optional)**| `SDA` | **`GPIO 21`** | I2C Data |
| | `SCL` | **`GPIO 22`** | I2C Clock |

---

## 5. Mechanical & Plumbing Assembly

1. **Elevation:** Place the Sump Jar flat on the table. Place the Rooftop Jar on a small stand $30\text{--}40\,\text{cm}$ above the Sump Jar.
2. **Sensors:** Cut a circular hole in the center of each jar lid. Mount the ultrasonic sensors pointing straight down at the water surface. Ensure at least $5\text{--}8\,\text{cm}$ air gap below the sensor at full level to avoid the ultrasonic dead zone.
3. **Pump 1 (Transfer Riser):** Submerge in the Sump Jar. Run tube up into the Rooftop Jar. Poke a tiny pinhole in the delivery tube right above the rooftop water line to serve as an **anti-siphon breaker**.
4. **Pump 2 (Demand Drain):** Submerge in the Rooftop Jar. Run tube down into the Sump Jar with a $2\,\text{mm}$ nozzle tip to produce a visible variable-pressure jet.
5. **Flyback Diodes:** Solder or connect a 1N4007 diode in reverse parallel across both pump terminals (Cathode/stripe to positive, Anode to negative) to prevent back-EMF voltage spikes from rebooting the ESP32.

---

## 6. Variable Pressure Fixture Demand Simulation

The ESP32 uses hardware PWM (`ledcWrite`) to control the MOSFET driving Pump 2:
- **Low Pressure (20% PWM):** Gentle trickle / low-flow bathroom fixture ($0.5\,\text{BAR}$ equivalent).
- **Standard Flow (60% PWM):** Steady kitchen sink stream ($1.5\text{--}2.0\,\text{BAR}$ equivalent).
- **High-Velocity Jet (100% PWM):** High-pressure fire hydrant jet stream ($3.0+\,\text{BAR}$ equivalent).

As water drains from the top tank, the ultrasonic sensor detects the falling level. When it breaches $25\%$, the autonomous state machine automatically energizes the transfer pump to replenish the tank.

---

## 7. Testing, Calibration & Bring-Up Checklist

1. **Dry Smoke Test:** Power on ESP32 via USB without pumps connected. Verify no hot components and 5V rail is stable.
2. **Sonar Verification:** Open Arduino Serial Monitor at 115200 baud. Move hand over sensors; verify linear distance output in centimeters.
3. **Level Calibration:** Measure jar heights in centimeters and update `OHT_TOTAL_HEIGHT_CM` and `SUMP_TOTAL_HEIGHT_CM` in the code.
4. **Wet Test:** Add water to Sump Jar. Test Pump 1 transfer. Verify rooftop level rises and sump level drops in real time.
5. **Closed-Loop Drain:** Test Pump 2 variable pressure. Verify continuous recirculation with zero water loss.
6. **Web Handshake:** Update Wi-Fi SSID and Server IP in `esp32_firmware.ino`. Watch the live 3D twin update dynamically on your browser.

---

## 8. ESP32 Production Firmware (Arduino C++)

The complete production firmware is ready to compile and flash. It is located at:
`hydroflow-smart-tank/public/firmware/esp32_firmware.ino`

*(Open in Arduino IDE, select board "ESP32 Dev Module", install Adafruit SSD1306 and ArduinoJson libraries, and hit Upload).*
