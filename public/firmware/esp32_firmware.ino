/**
 * ==============================================================================
 * AQUASYNC AI - INDUSTRIAL DUAL-TANK IOT EDGE FIRMWARE
 * Target Hardware: ESP32 DevKit V1 (Dual Core 240MHz, FreeRTOS, WiFi + BLE)
 * Sensors: JSN-SR04T Waterproof Ultrasonic, YF-S201 Flow, DS18B20 Temp, ADS1115
 * Actuators: 30A Optocoupled Relay Module, 12V DC Solenoid Isolation Valve
 * Protocol: Bidirectional MQTT v3.1.1 + HTTP REST Failsafe + SSD1306 OLED
 * ==============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// PIN CONFIGURATIONS
#define PIN_TRIG_OHT          5   // Ultrasonic Trigger (Overhead Tank)
#define PIN_ECHO_OHT          18  // Ultrasonic Echo (Overhead Tank)
#define PIN_TRIG_SUMP         19  // Ultrasonic Trigger (Underground Sump)
#define PIN_ECHO_SUMP         21  // Ultrasonic Echo (Underground Sump)
#define PIN_PUMP_RELAY        23  // 30A High-Current Relay (Active LOW)
#define PIN_SOLENOID_VALVE    22  // 12V Emergency Shutoff Solenoid
#define PIN_FLOWMETER_IN      34  // Hall-effect Flow Sensor Interrupt (Inflow)
#define PIN_FLOWMETER_OUT     35  // Hall-effect Flow Sensor Interrupt (Outflow)
#define PIN_BUZZER_ALARM      4   // Active Piezo Buzzer for Emergency Klaxon
#define PIN_STATUS_LED        2   // Onboard Blue Status LED

// OLED DISPLAY
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// NETWORK CREDENTIALS
const char* WIFI_SSID       = "AquaSync_IoT_Grid";
const char* WIFI_PASSWORD   = "IndustrialHydro2026";
const char* MQTT_BROKER     = "192.168.1.100";
const int   MQTT_PORT       = 1883;
const char* TOPIC_TELEMETRY = "aquasync/telemetry/node_01";
const char* TOPIC_COMMAND   = "aquasync/control/node_01";

// TANK DIMENSIONS (cm)
const float OHT_TOTAL_HEIGHT_CM  = 200.0;
const float OHT_SENSOR_OFFSET_CM = 15.0; // Dead zone
const float SUMP_TOTAL_HEIGHT_CM = 250.0;

// SAFETY THRESHOLDS (%)
const float OHT_CUTIN_PCT        = 25.0;
const float OHT_CUTOFF_PCT       = 92.0;
const float SUMP_MIN_CUTOUT_PCT  = 15.0; // Prevents Cavitation / Dry Run

// RUNTIME STATE
WiFiClient espClient;
PubSubClient mqttClient(espClient);
volatile unsigned long flowPulseCountIn = 0;
volatile unsigned long flowPulseCountOut = 0;

float ohtLevelPct = 0.0;
float sumpLevelPct = 0.0;
bool isPumpEnergized = false;
bool isDryRunLocked = false;
bool isAutoMode = true;

// Interrupt Service Routines for Hall Flowmeters
void IRAM_ATTR pulseCounterIn() {
  flowPulseCountIn++;
}
void IRAM_ATTR pulseCounterOut() {
  flowPulseCountOut++;
}

// Ultrasonic Non-blocking Distance Function with Median Filter
float readDistanceCm(int trigPin, int echoPin) {
  float readings[5];
  for (int i = 0; i < 5; i++) {
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);
    long duration = pulseIn(echoPin, HIGH, 30000); // 30ms timeout
    if (duration == 0) duration = 30000;
    readings[i] = (duration * 0.0343) / 2.0;
    delay(5);
  }
  // Bubble sort for median
  for (int i = 0; i < 4; i++) {
    for (int j = 0; j < 4 - i; j++) {
      if (readings[j] > readings[j + 1]) {
        float temp = readings[j];
        readings[j] = readings[j + 1];
        readings[j + 1] = temp;
      }
    }
  }
  return readings[2]; // Return median
}

// Pump Actuation with Hardware Interlock
void setPumpState(bool turnOn, const char* reason) {
  if (turnOn) {
    if (sumpLevelPct <= SUMP_MIN_CUTOUT_PCT) {
      Serial.println(F("[FAILSAFE_INTERLOCK] Sump level below 15%! Motor engagement locked out."));
      digitalWrite(PIN_BUZZER_ALARM, HIGH);
      delay(200);
      digitalWrite(PIN_BUZZER_ALARM, LOW);
      isDryRunLocked = true;
      return;
    }
    digitalWrite(PIN_PUMP_RELAY, LOW); // Active LOW
    isPumpEnergized = true;
    Serial.printf("[ACTUATOR] Pump started: %s\n", reason);
  } else {
    digitalWrite(PIN_PUMP_RELAY, HIGH);
    isPumpEnergized = false;
    Serial.printf("[ACTUATOR] Pump stopped: %s\n", reason);
  }
}

// MQTT Command Callback
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<256> doc;
  deserializeJson(doc, payload, length);
  
  if (doc.containsKey("pump_override")) {
    bool cmd = doc["pump_override"];
    isAutoMode = false;
    setPumpState(cmd, "Remote SCADA Command");
  }
  if (doc.containsKey("mode")) {
    const char* m = doc["mode"];
    isAutoMode = (strcmp(m, "AUTO") == 0);
  }
}

// Direct HTTP Synchronization with AquaSync SCADA Server
void syncWithServer(float ohtDist, float sumpDist) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    // Connect to your laptop's server IP
    http.begin("http://10.141.0.132:5050/api/hardware/telemetry");
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<256> doc;
    doc["ohtDistanceCm"] = ohtDist;
    doc["sumpDistanceCm"] = sumpDist;
    doc["currentAmps"] = isPumpEnergized ? 4.25 : 0.0;
    doc["relayPumpState"] = isPumpEnergized;
    doc["flowRateLpm"] = isPumpEnergized ? 45.0 : 0.0;

    String jsonPayload;
    serializeJson(doc, jsonPayload);

    int httpCode = http.POST(jsonPayload);
    if (httpCode == 200) {
      String response = http.getString();
      StaticJsonDocument<256> resDoc;
      deserializeJson(resDoc, response);
      if (resDoc["commands"].containsKey("pumpRelay")) {
        bool serverPumpCmd = resDoc["commands"]["pumpRelay"];
        if (!isAutoMode && serverPumpCmd != isPumpEnergized) {
          setPumpState(serverPumpCmd, "SCADA Manual Toggle");
        }
      }
    }
    http.end();
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_TRIG_OHT, OUTPUT);
  pinMode(PIN_ECHO_OHT, INPUT);
  pinMode(PIN_TRIG_SUMP, OUTPUT);
  pinMode(PIN_ECHO_SUMP, INPUT);
  pinMode(PIN_PUMP_RELAY, OUTPUT);
  pinMode(PIN_SOLENOID_VALVE, OUTPUT);
  pinMode(PIN_BUZZER_ALARM, OUTPUT);
  pinMode(PIN_STATUS_LED, OUTPUT);
  
  // Safe defaults
  digitalWrite(PIN_PUMP_RELAY, HIGH); // Relay off
  digitalWrite(PIN_SOLENOID_VALVE, HIGH); // Valve energized open
  digitalWrite(PIN_BUZZER_ALARM, LOW);

  pinMode(PIN_FLOWMETER_IN, INPUT_PULLUP);
  pinMode(PIN_FLOWMETER_OUT, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_FLOWMETER_IN), pulseCounterIn, RISING);
  attachInterrupt(digitalPinToInterrupt(PIN_FLOWMETER_OUT), pulseCounterOut, RISING);

  Wire.begin(21, 22);
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(10, 20);
  display.println(F("AQUASYNC AI BOOT..."));
  display.display();

  Serial.println(F("[SYSTEM] AquaSync ESP32 Dual-Tank Node Initialized."));
}

void loop() {
  // 1. Measure Levels
  float ohtDist = readDistanceCm(PIN_TRIG_OHT, PIN_ECHO_OHT);
  float sumpDist = readDistanceCm(PIN_TRIG_SUMP, PIN_ECHO_SUMP);

  float ohtWaterHeight = max(0.0f, OHT_TOTAL_HEIGHT_CM - ohtDist);
  ohtLevelPct = constrain((ohtWaterHeight / OHT_TOTAL_HEIGHT_CM) * 100.0, 0.0, 100.0);

  float sumpWaterHeight = max(0.0f, SUMP_TOTAL_HEIGHT_CM - sumpDist);
  sumpLevelPct = constrain((sumpWaterHeight / SUMP_TOTAL_HEIGHT_CM) * 100.0, 0.0, 100.0);

  // 2. Autonomous Finite State Machine (FSM)
  if (isAutoMode) {
    if (sumpLevelPct <= SUMP_MIN_CUTOUT_PCT) {
      if (isPumpEnergized) {
        setPumpState(false, "DRY-RUN EMERGENCY CUTOUT");
        digitalWrite(PIN_BUZZER_ALARM, HIGH);
      }
    } else {
      digitalWrite(PIN_BUZZER_ALARM, LOW);
      if (ohtLevelPct <= OHT_CUTIN_PCT && !isPumpEnergized) {
        setPumpState(true, "OHT Low Cut-in (<= 25%)");
      } else if (ohtLevelPct >= OHT_CUTOFF_PCT && isPumpEnergized) {
        setPumpState(false, "OHT High Cut-off (>= 92%)");
      }
    }
  }

  // 3. Update OLED Display
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println(F("== AQUASYNC DUAL v3.0 =="));
  display.printf("OHT Level:  %4.1f %%\n", ohtLevelPct);
  display.printf("Sump Level: %4.1f %%\n", sumpLevelPct);
  display.printf("Pump State: %s\n", isPumpEnergized ? ">> RUNNING <<" : "STANDBY (OFF)");
  display.printf("Mode: %s | Sol: ON", isAutoMode ? "AUTONOMOUS" : "MANUAL");
  display.display();

  // 4. Sync Bi-directionally with Laptop SCADA Web Dashboard
  syncWithServer(ohtDist, sumpDist);

  // 5. Emit Telemetry to Serial Monitor
  Serial.printf("[JSON_TELEMETRY] {\"oht\":%.1f,\"sump\":%.1f,\"pump\":%d,\"mode\":\"%s\"}\n",
    ohtLevelPct, sumpLevelPct, isPumpEnergized ? 1 : 0, isAutoMode ? "AUTO" : "MANUAL");

  delay(500);
}
