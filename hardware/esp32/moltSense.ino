
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <IRremote.hpp>

#define LED_PIN                       25
#define IR_RECEIVER                   26
#define BUZZER_PIN                    27
#define BOLT_SIGNAL                   34
#define SOIL_SENSOR                   35

// Adjustable thresholds.
// `CONDUCTIVITY_THRESHOLD_LOW` and `CONDUCTIVITY_THRESHOLD_HIGH` create a hysteresis window
// so the molt alert only fires once when the signal crosses into the high zone.
// Keep these low: around 200 is the intended molt trigger range.
/*
hysteresis logic
onductivity must cross above 200 to fire the molt alert.

It won’t fire again until conductivity drops back below 180 and then rises above 200 again.

This hysteresis prevents rapid toggling if the signal hovers around 200. change this
*/
#define CONDUCTIVITY_THRESHOLD_LOW    0
#define CONDUCTIVITY_THRESHOLD_HIGH   200
// `MOLT_ALERT_COOLDOWN_MS` blocks repeated molt alerts after a trigger.
// Keep this at 0 so the first molt alert is immediate; the 5-second buzzer window
// prevents interruption while the alarm is already active. CHANGE THIS TO MAKE IT FAST
#define MOLT_ALERT_COOLDOWN_MS        0UL
// `MOISTURE_READ_INTERVAL_MS` controls how often the raw moisture sensor is sampled.
#define MOISTURE_READ_INTERVAL_MS     5000UL
// `CONDUCTIVITY_READ_INTERVAL_MS` controls how often the conductivity probe is sampled.
#define CONDUCTIVITY_READ_INTERVAL_MS 500UL
// `HEARTBEAT_INTERVAL_MS` controls the regular telemetry heartbeat to the backend.
#define HEARTBEAT_INTERVAL_MS         (60UL * 1000UL)
// `BUZZER_DURATION_MS` is the active buzzer on-time after a molt trigger.
#define BUZZER_DURATION_MS            5000UL
// `LED_BLINK_INTERVAL_MS` is the blink rate used for warning/error blinking.
#define LED_BLINK_INTERVAL_MS         500UL
// `ERROR_AFTER_MS` is how long conductivity can stay at 0 before we treat it as a fault.
#define ERROR_AFTER_MS                (7UL * 24UL * 60UL * 60UL * 1000UL)

// Moisture sensor calibration.
// Swap these if your board reports the opposite polarity.
// Dry soil/air gives higher raw (~2500–3500)
// Wet soil/water gives lower raw (~1200–1500)
#define MOISTURE_RAW_DRY 3500
#define MOISTURE_RAW_WET 1200

const char* WIFI_SSID = "WIFISSID";
const char* WIFI_PASS = "WIFIPASSWORD";
const char* BASE_URL  = "https://molt-sense.vercel.app";

String macAddress;
unsigned long lastMoistureReadMs = 0;
unsigned long lastConductivityReadMs = 0;
unsigned long lastHeartbeatMs = 0;
unsigned long lastMoltMs = 0;
unsigned long zeroSinceMs = 0;
unsigned long buzzerUntilMs = 0;
unsigned long ledBlinkMs = 0;
unsigned long lastIrActionMs = 0;
String desiredLedStatus = "off";
bool wasConductivityAboveThreshold = false;

int lastMoistureRaw = 0;
float lastMoisture = 55.0f;
int lastConductivity = 0;

bool postJson(const String& url, const String& payload, String& response);
bool acknowledgeMoltAlert();

void setup() {
  Serial.begin(115200);

  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(IR_RECEIVER, INPUT);

  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  desiredLedStatus = digitalRead(LED_PIN) == HIGH ? "on" : "off";

  IrReceiver.begin(IR_RECEIVER, DISABLE_LED_FEEDBACK);
  Serial.println("[INIT] IR receiver ready.");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.print("[WIFI] Connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  macAddress = WiFi.macAddress();
  Serial.print("[WIFI] Connected. MAC: ");
  Serial.println(macAddress);
}

float readMockTemperatureC() { return 23.0f + (float)random(0, 300) / 100.0f; }
float readMockHumidity() { return 72.0f + (float)random(0, 800) / 100.0f; }
float readMockPressure() { return 1100.0f + (float)random(-50, 50); }
String getActualLedStatus() {
  return digitalRead(LED_PIN) == HIGH ? "on" : "off";
}

float readMoisturePercent(int analogValue) {
  const float dry = (float)MOISTURE_RAW_DRY;
  const float wet = (float)MOISTURE_RAW_WET;
  if (dry == wet) return 0.0f;

  // Automatically handles inversion: wet < dry
  float mapped = ((dry - analogValue) / (dry - wet)) * 100.0f;
  return constrain(mapped, 0.0f, 100.0f);
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
  unsigned long now = millis();
  if (now - ledBlinkMs > LED_BLINK_INTERVAL_MS) {
    ledBlinkMs = now;
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
  }
}

void setLedStatus(const String& status) {
  String current = getActualLedStatus();
  if (status == "on" && current != "on") {
    digitalWrite(LED_PIN, HIGH);
  } else if (status == "off" && current != "off") {
    digitalWrite(LED_PIN, LOW);
  } else if (status == "blinking") {
    // blinking handled separately in applyLedStatus()
    desiredLedStatus = "blinking";
    return;
  }
  desiredLedStatus = status;
}


bool acknowledgeMoltAlert() {
  const String url = String(BASE_URL) + "/api/molt/acknowledge";

  StaticJsonDocument<256> doc;
  doc["macAddress"] = macAddress;
  doc["ledStatus"] = getActualLedStatus();
  doc["source"] = "hardware";

  String payload;
  serializeJson(doc, payload);

  String response;
  const bool ok = postJson(url, payload, response);
  if (ok) {
    Serial.println("[ACK] Molt alerts acknowledged from hardware.");
  } else {
    Serial.println("[ACK] Failed to acknowledge molt alerts.");
  }
  return ok;
}

void turnOffLedFromRemote() {
  if (desiredLedStatus == "off") {
    Serial.println("[IR] Remote pressed but LED is already off.");
    return;
  }

  setLedStatus("off");
  Serial.println("[IR] LED turned OFF by remote.");
  acknowledgeMoltAlert();
}

bool postJson(const String& url, const String& payload, String& response) {
  HTTPClient http;
  WiFiClientSecure client;
  client.setInsecure(); // for debug; replace with CA cert in production

  Serial.print("[HTTP] Connecting to: ");
  Serial.println(url);
  Serial.print("[HTTP] Payload length: ");
  Serial.println(payload.length());
  Serial.println("[HTTP] Payload: " + payload);

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(payload);

  Serial.print("[HTTP] POST result code: ");
  Serial.println(code);

  if (code > 0) {
    response = http.getString();
    Serial.println("[HTTP] Response body:");
    Serial.println(response);
    http.end();
    return (code == 200);
  } else {
    Serial.print("[HTTP] Error: ");
    Serial.println(http.errorToString(code));
    http.end();
    return false;
  }
}

void sendHeartbeat(bool moltDetected, bool errorDetected, float pressure, float temperature, float humidity) {
  const String url = String(BASE_URL) + "/api/esp32/heartbeat";

  StaticJsonDocument<512> doc;
  doc["macAddress"] = macAddress;
  doc["pressure"] = pressure;
  doc["moisture"] = lastMoisture;
  doc["conductivity"] = lastConductivity;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["moltDetected"] = moltDetected;
  doc["errorDetected"] = errorDetected;
  doc["signalStrength"] = WiFi.RSSI();
  doc["ledStatus"] = getActualLedStatus();


  String payload;
  serializeJson(doc, payload);

  String response;
  bool ok = postJson(url, payload, response);
  if (ok) {
    Serial.println("[HEARTBEAT] Success.");
  } else {
    Serial.println("[HEARTBEAT] Failed to send.");
  }
}

void handleIrRemote() {
  if (!IrReceiver.decode()) return;
  Serial.println("[IR] ---- Remote decoded ----");
  IrReceiver.printIRResultShort(&Serial);
  unsigned long now = millis();
  if (now - lastIrActionMs >= 500UL) {
    lastIrActionMs = now;
    turnOffLedFromRemote();
  }
  IrReceiver.resume();
}

void loop() {
  handleIrRemote();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WIFI] Lost connection, reconnecting...");
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    delay(1000);
    return;
  }

  unsigned long now = millis();
  bool refreshedReadings = false;

  if (now - lastMoistureReadMs >= MOISTURE_READ_INTERVAL_MS) {
    lastMoistureReadMs = now;
    lastMoistureRaw = analogRead(SOIL_SENSOR);
    lastMoisture = readMoisturePercent(lastMoistureRaw);
    refreshedReadings = true;
  }

  if (now - lastConductivityReadMs >= CONDUCTIVITY_READ_INTERVAL_MS) {
    lastConductivityReadMs = now;
    lastConductivity = analogRead(BOLT_SIGNAL);
    refreshedReadings = true;
  }

  float pressure = readMockPressure();
  float temperature = readMockTemperatureC();
  float humidity = readMockHumidity();

  if (refreshedReadings) {
    Serial.printf("[SENSOR] moisture raw=%d mapped=%.1f%% conductivity=%d pressure=%.1f temp=%.1fC humidity=%.1f%% RSSI=%d\n",
                  lastMoistureRaw, lastMoisture, lastConductivity, pressure, temperature, humidity, WiFi.RSSI());
  }

  bool errorDetected = false;
  if (lastConductivity == 0) {
    if (zeroSinceMs == 0) zeroSinceMs = now;
    if (now - zeroSinceMs >= ERROR_AFTER_MS) {
      errorDetected = true;
      setLedStatus("blinking");
    }
  } else zeroSinceMs = 0;

  bool conductivityLatchedHigh = wasConductivityAboveThreshold;
  if (lastConductivity >= CONDUCTIVITY_THRESHOLD_HIGH) {
    conductivityLatchedHigh = true;
  } else if (lastConductivity <= CONDUCTIVITY_THRESHOLD_LOW) {
    conductivityLatchedHigh = false;
  }

  bool moltDetected = false;
  bool risingEdge = conductivityLatchedHigh && !wasConductivityAboveThreshold;

  // Only trigger new buzzer cycle if previous one has finished
  if (risingEdge && (now - lastMoltMs >= MOLT_ALERT_COOLDOWN_MS) &&
      (buzzerUntilMs == 0 || now >= buzzerUntilMs)) {
    moltDetected = true;
    lastMoltMs = now;
    buzzerUntilMs = now + BUZZER_DURATION_MS;

    Serial.println("[MOLT] Detected! Buzzer ON for 5s, LED ON.");
    digitalWrite(BUZZER_PIN, HIGH);   // immediate ON
    setLedStatus("on");

    // Send heartbeat AFTER buzzer is triggered
    sendHeartbeat(true, errorDetected, pressure, temperature, humidity);
    lastHeartbeatMs = now;
  }

  //  Buzzer timing control
  if (buzzerUntilMs > 0 && now < buzzerUntilMs) {
    digitalWrite(BUZZER_PIN, HIGH);
  } else {
    if (buzzerUntilMs > 0 && now >= buzzerUntilMs) {
      Serial.println("[BUZZER] OFF after 5s.");
      buzzerUntilMs = 0; // reset so next molt can trigger
    }
    digitalWrite(BUZZER_PIN, LOW);
  }

  // Update latch AFTER buzzer reset
  wasConductivityAboveThreshold = conductivityLatchedHigh;

  if (now - lastHeartbeatMs >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatMs = now;
    Serial.println("[HEARTBEAT] Timer triggered.");
    sendHeartbeat(moltDetected, errorDetected, pressure, temperature, humidity);
  }

  applyLedStatus(desiredLedStatus);
  delay(10);

}
