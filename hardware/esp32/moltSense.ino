#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#define LED_PIN        25   // LED indicator
#define BUTTON_PIN     26   // IR receiver module (acknowledge)
#define BUZZER_PIN     27   // Active buzzer
#define BOLT_SIGNAL    34   // Copper bolt electrode (signal)
#define SOIL_SENSOR    35   // Soil moisture sensor

const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char* BASE_URL  = "https://molt-sense.vercel.app";

// Thresholds and timers (updated from backend config when available)
volatile int conductivityThresholdStart = 1400;   // ADC lower bound for molt conductivity
volatile int conductivityThresholdEnd = 2200;     // ADC upper bound for molt conductivity
volatile int moistureThresholdLow = 45;           // Moisture low watermark
volatile int moistureThresholdHigh = 80;          // Moisture high watermark
volatile unsigned long moltCooldownMs = 30UL * 60UL * 1000UL; // 30 min
volatile unsigned long moistureIntervalMs = 5000;
volatile unsigned long conductivityIntervalMs = 300;
volatile unsigned long errorAfterMs = 7UL * 24UL * 60UL * 60UL * 1000UL; // 1 week

// State
String macAddress;
String lastMoltEventId = "";
unsigned long lastMoistureReadMs = 0;
unsigned long lastConductivityReadMs = 0;
unsigned long lastHeartbeatMs = 0;
unsigned long lastMoltMs = 0;
unsigned long zeroSinceMs = 0;
unsigned long buzzerUntilMs = 0;
unsigned long ledBlinkMs = 0;
String desiredLedStatus = "off";

float lastMoisture = 55.0f;
int lastConductivity = 0;

volatile bool ackRequested = false;

void IRAM_ATTR onAcknowledge() {
  ackRequested = true;
}

void setup() {
  Serial.begin(115200);

  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), onAcknowledge, FALLING);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  macAddress = WiFi.macAddress();
  Serial.print("Connected. MAC: ");
  Serial.println(macAddress);
}

float mockTemperatureC() {
  return 23.0f + (float)random(0, 300) / 100.0f; // 23.0 - 26.0 C
}

float mockHumidity() {
  return 72.0f + (float)random(0, 800) / 100.0f; // 72 - 80%
}

float readMoisturePercent(int analogValue) {
  // Simple scale for MVP; calibrate later
  float normalized = (float)analogValue / 4095.0f;
  return normalized * 100.0f;
}

void applyLedStatus(const String& status) {
  if (status == "on") {
    digitalWrite(LED_PIN, HIGH);
    return;
  }
  if (status == "off") {
    digitalWrite(LED_PIN, LOW);
    return;
  }
  // blinking
  unsigned long now = millis();
  if (now - ledBlinkMs > 500) {
    ledBlinkMs = now;
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
  }
}

void setLedStatus(const String& status) {
  desiredLedStatus = status;
  if (status == "on" || status == "off") {
    applyLedStatus(status);
  }
}

bool postJson(const String& url, const String& payload, String& response) {
  HTTPClient http;
  WiFiClientSecure client;
  client.setInsecure(); // TODO: replace with CA cert for production

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(payload);

  if (code > 0) {
    response = http.getString();
    http.end();
    return true;
  }

  http.end();
  return false;
}

void updateConfigFromResponse(const String& responseJson) {
  StaticJsonDocument<768> doc;
  DeserializationError err = deserializeJson(doc, responseJson);
  if (err) return;

  JsonObject config = doc["config"];
  if (!config.isNull()) {
    conductivityThresholdStart = config["conductivityThresholdStart"] | conductivityThresholdStart;
    conductivityThresholdEnd = config["conductivityThresholdEnd"] | conductivityThresholdEnd;
    moistureThresholdLow = config["moistureThresholdLow"] | moistureThresholdLow;
    moistureThresholdHigh = config["moistureThresholdHigh"] | moistureThresholdHigh;
    moltCooldownMs = config["moltCooldownMs"] | moltCooldownMs;
    moistureIntervalMs = config["moistureIntervalMs"] | moistureIntervalMs;
    conductivityIntervalMs = config["conductivityIntervalMs"] | conductivityIntervalMs;
    errorAfterMs = config["errorAfterMs"] | errorAfterMs;

    if (conductivityThresholdStart > conductivityThresholdEnd) {
      int temp = conductivityThresholdStart;
      conductivityThresholdStart = conductivityThresholdEnd;
      conductivityThresholdEnd = temp;
    }

    if (moistureThresholdLow > moistureThresholdHigh) {
      int temp = moistureThresholdLow;
      moistureThresholdLow = moistureThresholdHigh;
      moistureThresholdHigh = temp;
    }
  }

  const char* ledStatus = doc["ledConfig"]["status"] | "";
  if (strlen(ledStatus) > 0) {
    setLedStatus(String(ledStatus));
  }

  const char* moltId = doc["moltEventId"] | "";
  if (strlen(moltId) > 0) {
    lastMoltEventId = String(moltId);
  }
}

void sendHeartbeat(bool moltDetected, bool errorDetected) {
  const String url = String(BASE_URL) + "/api/esp32/heartbeat";

  float mockPressure = 1100.0f + (float)random(-50, 50);

  StaticJsonDocument<512> doc;
  doc["macAddress"] = macAddress;
  doc["pressure"] = mockPressure;
  doc["moisture"] = lastMoisture;
  doc["conductivity"] = lastConductivity;
  doc["temperature"] = mockTemperatureC();
  doc["humidity"] = mockHumidity();
  doc["moltDetected"] = moltDetected;
  doc["errorDetected"] = errorDetected;
  doc["signalStrength"] = WiFi.RSSI();

  String payload;
  serializeJson(doc, payload);

  String response;
  if (postJson(url, payload, response)) {
    updateConfigFromResponse(response);
  }
}

void sendAcknowledge() {
  if (lastMoltEventId.length() == 0) return;

  const String url = String(BASE_URL) + "/api/molt/acknowledge";
  StaticJsonDocument<256> doc;
  doc["moltEventId"] = lastMoltEventId;
  doc["macAddress"] = macAddress;

  String payload;
  serializeJson(doc, payload);

  String response;
  if (postJson(url, payload, response)) {
    lastMoltEventId = "";
  }
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    delay(500);
    return;
  }

  unsigned long now = millis();

  if (now - lastMoistureReadMs >= moistureIntervalMs) {
    lastMoistureReadMs = now;
    int moistureRaw = analogRead(SOIL_SENSOR);
    lastMoisture = readMoisturePercent(moistureRaw);
  }

  if (now - lastConductivityReadMs >= conductivityIntervalMs) {
    lastConductivityReadMs = now;
    lastConductivity = analogRead(BOLT_SIGNAL);
  }

  bool errorDetected = false;
  if (lastConductivity == 0) {
    if (zeroSinceMs == 0) zeroSinceMs = now;
    if (now - zeroSinceMs > errorAfterMs) {
      errorDetected = true;
      setLedStatus("blinking");
    }
  } else {
    zeroSinceMs = 0;
  }

  bool moltDetected = false;
  bool conductivityInRange =
    lastConductivity >= conductivityThresholdStart &&
    lastConductivity <= conductivityThresholdEnd;

  if (conductivityInRange && (now - lastMoltMs > moltCooldownMs)) {
    moltDetected = true;
    lastMoltMs = now;
    buzzerUntilMs = now + 30000; // 30 seconds
    setLedStatus("on");
  }

  if (now - lastHeartbeatMs >= moistureIntervalMs) {
    lastHeartbeatMs = now;
    sendHeartbeat(moltDetected, errorDetected);
  }

  if (buzzerUntilMs > 0 && now < buzzerUntilMs) {
    digitalWrite(BUZZER_PIN, HIGH);
  } else {
    digitalWrite(BUZZER_PIN, LOW);
  }

  if (ackRequested) {
    ackRequested = false;
    sendAcknowledge();
    setLedStatus("off");
  }

  applyLedStatus(desiredLedStatus);

  delay(10);
}
