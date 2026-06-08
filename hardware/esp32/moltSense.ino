#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <IRremote.hpp>
#include <PubSubClient.h>
#include <HTTPUpdate.h>

#define LED_PIN 25
#define IR_RECEIVER 26
#define BUZZER_PIN 27
#define BOLT_SIGNAL 34
#define SOIL_SENSOR 35

// Moisture sensor calibration.
// Swap these if your board reports the opposite polarity.
// Dry soil/air gives higher raw (~2500-3500)
// Wet soil/water gives lower raw (~1200-1500)
#define MOISTURE_RAW_DRY 3500
#define MOISTURE_RAW_WET 1200

const char* WIFI_SSID = "ssid";
const char* WIFI_PASS = "password";
const char* BASE_URL = "https://molt-sense.vercel.app";
const char* MQTT_BROKER_HOST ="brokerulr";
const uint16_t MQTT_BROKER_PORT = 8883;
const char* MQTT_USERNAME = "mqtt";
const char* MQTT_PASSWORD = "mqttpassw";
const unsigned long HEARTBEAT_INTERVAL_MS = 60UL * 1000UL;
const unsigned long BUZZER_DURATION_MS = 5000UL;
const unsigned long LED_BLINK_INTERVAL_MS = 500UL;

String macAddress;
String mqttConfigTopic;
String mqttConfigRequestTopic;
String mqttConfigStateTopic;
String mqttOtaTopic;
String mqttClientId;

unsigned long lastMoistureReadMs = 0;
unsigned long lastConductivityReadMs = 0;
unsigned long lastHeartbeatMs = 0;
unsigned long lastMoltMs = 0;
unsigned long zeroSinceMs = 0;
unsigned long buzzerUntilMs = 0;
unsigned long ledBlinkMs = 0;
unsigned long lastIrActionMs = 0;
unsigned long lastMqttReconnectAttemptMs = 0;
String desiredLedStatus = "off";
bool wasConductivityAboveThreshold = false;

unsigned long conductivityThresholdLow = 200UL;
unsigned long conductivityThresholdHigh = 300UL;
unsigned long moltAlertCooldownMs = 0UL;
unsigned long moistureReadIntervalMs = 5000UL;
unsigned long conductivityReadIntervalMs = 500UL;
unsigned long errorAfterMs = 7UL * 24UL * 60UL * 60UL * 1000UL;
float moistureLowThreshold = 30.0f;
float moistureHighThreshold = 80.0f;

int lastMoistureRaw = 0;
float lastMoisture = 55.0f;
int lastConductivity = 0;

WiFiClientSecure mqttSecureClient;
PubSubClient mqttClient(mqttSecureClient);

bool postJson(const String& url, const String& payload, String& response);
bool acknowledgeMoltAlert();
void handleMqttMessage(char* topic, byte* payload, unsigned int length);
void applyMqttConfig(const JsonVariantConst& config);
void publishCurrentConfigState(const JsonVariantConst& requestPayload);
void handleMqttOta(const JsonVariantConst& payload);
void startFirmwareUpdate(const String& firmwareUrl);
void connectMqtt();
void updateMqttTopics();
String getMoistureStateLabel(float moisture);

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
  macAddress.toLowerCase();
  updateMqttTopics();

  mqttSecureClient.setInsecure();
  mqttClient.setServer(MQTT_BROKER_HOST, MQTT_BROKER_PORT);
  mqttClient.setCallback(handleMqttMessage);
  mqttClient.setBufferSize(2048);
  mqttClient.setKeepAlive(60);

  Serial.print("[WIFI] Connected. MAC: ");
  Serial.println(macAddress);
  connectMqtt();
}

void updateMqttTopics() {
  String clientMac = macAddress;
  clientMac.replace(":", "");
  mqttConfigTopic = "esp32/" + macAddress + "/config";
  mqttConfigRequestTopic = "esp32/" + macAddress + "/config/request";
  mqttConfigStateTopic = "esp32/" + macAddress + "/config/state";
  mqttOtaTopic = "esp32/" + macAddress + "/ota";
  mqttClientId = "moltsense-" + clientMac;
}

float readMockTemperatureC() { return 23.0f + (float)random(0, 300) / 100.0f; }
float readMockHumidity() { return 72.0f + (float)random(0, 800) / 100.0f; }
float readMockPressure() { return 1100.0f + (float)random(-50, 50); }

String getActualLedStatus() {
  return digitalRead(LED_PIN) == HIGH ? "on" : "off";
}

String getMoistureStateLabel(float moisture) {
  if (moisture <= moistureLowThreshold) return "low";
  if (moisture >= moistureHighThreshold) return "high";
  return "normal";
}

float readMoisturePercent(int analogValue) {
  const float dry = (float)MOISTURE_RAW_DRY;
  const float wet = (float)MOISTURE_RAW_WET;
  if (dry == wet) return 0.0f;

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
  client.setInsecure();

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
  doc["moistureState"] = getMoistureStateLabel(lastMoisture);
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

void applyMqttConfig(const JsonVariantConst& config) {
  if (config.isNull()) return;

  if (!config["conductivityThresholdStart"].isNull()) {
    conductivityThresholdHigh = config["conductivityThresholdStart"].as<unsigned long>();
  }
  if (!config["conductivityThresholdEnd"].isNull()) {
    conductivityThresholdLow = config["conductivityThresholdEnd"].as<unsigned long>();
  }
  if (conductivityThresholdHigh < conductivityThresholdLow) {
    unsigned long high = conductivityThresholdHigh;
    conductivityThresholdHigh = conductivityThresholdLow;
    conductivityThresholdLow = high;
  }

  if (!config["moistureThresholdLow"].isNull()) {
    moistureLowThreshold = config["moistureThresholdLow"].as<float>();
  }
  if (!config["moistureThresholdHigh"].isNull()) {
    moistureHighThreshold = config["moistureThresholdHigh"].as<float>();
  }
  if (moistureLowThreshold > moistureHighThreshold) {
    float low = moistureLowThreshold;
    moistureLowThreshold = moistureHighThreshold;
    moistureHighThreshold = low;
  }

  if (!config["moltCooldownMs"].isNull()) {
    moltAlertCooldownMs = config["moltCooldownMs"].as<unsigned long>();
  }
  if (!config["moistureIntervalMs"].isNull()) {
    moistureReadIntervalMs = max(1000UL, config["moistureIntervalMs"].as<unsigned long>());
  }
  if (!config["conductivityIntervalMs"].isNull()) {
    conductivityReadIntervalMs = max(250UL, config["conductivityIntervalMs"].as<unsigned long>());
  }
  if (!config["errorAfterMs"].isNull()) {
    errorAfterMs = max(1000UL, config["errorAfterMs"].as<unsigned long>());
  }

  Serial.printf(
    "[MQTT] Config applied conductivity trigger %lu/%lu uS/cm, moisture %.1f/%.1f%%, cooldown %lu ms, moisture poll %lu ms, conductivity poll %lu ms, error timeout %lu ms\n",
    conductivityThresholdHigh,
    conductivityThresholdLow,
    moistureLowThreshold,
    moistureHighThreshold,
    moltAlertCooldownMs,
    moistureReadIntervalMs,
    conductivityReadIntervalMs,
    errorAfterMs
  );
}

void publishCurrentConfigState(const JsonVariantConst& requestPayload) {
  StaticJsonDocument<512> doc;
  doc["macAddress"] = macAddress;
  doc["reportedAt"] = millis();
  doc["source"] = "esp32";

  if (!requestPayload["requestId"].isNull()) {
    doc["requestId"] = requestPayload["requestId"].as<const char*>();
  }
  if (!requestPayload["requestedAt"].isNull()) {
    doc["requestedAt"] = requestPayload["requestedAt"].as<const char*>();
  }

  JsonObject config = doc.createNestedObject("config");
  config["conductivityThresholdStart"] = conductivityThresholdHigh;
  config["conductivityThresholdEnd"] = conductivityThresholdLow;
  config["moistureThresholdLow"] = moistureLowThreshold;
  config["moistureThresholdHigh"] = moistureHighThreshold;
  config["moltCooldownMs"] = moltAlertCooldownMs;
  config["moistureIntervalMs"] = moistureReadIntervalMs;
  config["conductivityIntervalMs"] = conductivityReadIntervalMs;
  config["errorAfterMs"] = errorAfterMs;

  String payload;
  serializeJson(doc, payload);
  mqttClient.publish(mqttConfigStateTopic.c_str(), payload.c_str(), false);
  Serial.print("[MQTT] Published current config state to ");
  Serial.println(mqttConfigStateTopic);
}

void startFirmwareUpdate(const String& firmwareUrl) {
  WiFiClientSecure updateClient;
  updateClient.setInsecure();

  Serial.print("[OTA] Starting update from: ");
  Serial.println(firmwareUrl);

  t_httpUpdate_return result = httpUpdate.update(updateClient, firmwareUrl);
  switch (result) {
    case HTTP_UPDATE_FAILED:
      Serial.printf("[OTA] Failed: %d %s\n", httpUpdate.getLastError(), httpUpdate.getLastErrorString().c_str());
      break;
    case HTTP_UPDATE_NO_UPDATES:
      Serial.println("[OTA] No update available.");
      break;
    case HTTP_UPDATE_OK:
      Serial.println("[OTA] Update successful.");
      Serial.println("[OTA] Rebooting into updated firmware...");
      delay(1000);
      ESP.restart();
      break;
  }
}

void handleMqttOta(const JsonVariantConst& payload) {
  const char* firmwareUrl = payload["firmwareUrl"] | "";
  if (strlen(firmwareUrl) == 0) {
    Serial.println("[MQTT][OTA] Missing firmwareUrl.");
    return;
  }

  startFirmwareUpdate(String(firmwareUrl));
}

void handleMqttMessage(char* topic, byte* payload, unsigned int length) {
  String topicStr = String(topic);
  Serial.print("[MQTT] Message received on ");
  Serial.print(topicStr);
  Serial.print(" (");
  Serial.print(length);
  Serial.println(" bytes)");

  StaticJsonDocument<1024> doc;
  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) {
    Serial.print("[MQTT] JSON parse failed: ");
    Serial.println(err.c_str());
    return;
  }

  JsonVariantConst root = doc.as<JsonVariantConst>();
  if (topicStr == mqttConfigTopic) {
    JsonVariantConst configNode = root["config"];
    if (configNode.isNull()) {
      configNode = root;
    }
    Serial.println("[MQTT] Applying config payload.");
    applyMqttConfig(configNode);
  } else if (topicStr == mqttConfigRequestTopic) {
    Serial.println("[MQTT] Config snapshot requested.");
    publishCurrentConfigState(root);
  } else if (topicStr == mqttOtaTopic) {
    Serial.println("[MQTT] Dispatching OTA payload.");
    handleMqttOta(root);
  } else {
    Serial.println("[MQTT] Ignoring message on unknown topic.");
  }
}

void connectMqtt() {
  if (WiFi.status() != WL_CONNECTED || mqttClient.connected()) {
    return;
  }

  Serial.print("[MQTT] Connecting to broker ");
  Serial.print(MQTT_BROKER_HOST);
  Serial.print(":");
  Serial.println(MQTT_BROKER_PORT);

  if (mqttClient.connect(mqttClientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD)) {
    Serial.println("[MQTT] Connected.");
    mqttClient.subscribe(mqttConfigTopic.c_str());
    mqttClient.subscribe(mqttConfigRequestTopic.c_str());
    mqttClient.subscribe(mqttOtaTopic.c_str());
    Serial.print("[MQTT] Subscribed to ");
    Serial.println(mqttConfigTopic);
    Serial.print("[MQTT] Subscribed to ");
    Serial.println(mqttConfigRequestTopic);
    Serial.print("[MQTT] Subscribed to ");
    Serial.println(mqttOtaTopic);
  } else {
    Serial.print("[MQTT] Connect failed, state=");
    Serial.println(mqttClient.state());
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

  if (mqttClient.connected()) {
    mqttClient.loop();
  } else if (now - lastMqttReconnectAttemptMs >= 5000UL) {
    lastMqttReconnectAttemptMs = now;
    connectMqtt();
  }

  bool refreshedReadings = false;

  if (now - lastMoistureReadMs >= moistureReadIntervalMs) {
    lastMoistureReadMs = now;
    lastMoistureRaw = analogRead(SOIL_SENSOR);
    lastMoisture = readMoisturePercent(lastMoistureRaw);
    refreshedReadings = true;
  }

  if (now - lastConductivityReadMs >= conductivityReadIntervalMs) {
    lastConductivityReadMs = now;
    lastConductivity = analogRead(BOLT_SIGNAL);
    refreshedReadings = true;
  }

  float pressure = readMockPressure();
  float temperature = readMockTemperatureC();
  float humidity = readMockHumidity();

  if (refreshedReadings) {
    Serial.printf(
      "[SENSOR] moisture raw=%d mapped=%.1f%% conductivity=%d pressure=%.1f temp=%.1fC humidity=%.1f%% RSSI=%d\n",
      lastMoistureRaw,
      lastMoisture,
      lastConductivity,
      pressure,
      temperature,
      humidity,
      WiFi.RSSI()
    );
  }

  bool errorDetected = false;
  if (lastConductivity == 0) {
    if (zeroSinceMs == 0) zeroSinceMs = now;
    if (now - zeroSinceMs >= errorAfterMs) {
      errorDetected = true;
      setLedStatus("blinking");
    }
  } else {
    zeroSinceMs = 0;
  }

  bool conductivityLatchedHigh = wasConductivityAboveThreshold;
  if (lastConductivity >= (int)conductivityThresholdHigh) {
    conductivityLatchedHigh = true;
  } else if (lastConductivity <= (int)conductivityThresholdLow) {
    conductivityLatchedHigh = false;
  }

  bool moltDetected = false;
  bool risingEdge = conductivityLatchedHigh && !wasConductivityAboveThreshold;

  if (
    risingEdge &&
    (now - lastMoltMs >= moltAlertCooldownMs) &&
    (buzzerUntilMs == 0 || now >= buzzerUntilMs)
  ) {
    moltDetected = true;
    lastMoltMs = now;
    buzzerUntilMs = now + BUZZER_DURATION_MS;

    Serial.println("[MOLT] Detected! Buzzer ON for 5s, LED ON.");
    digitalWrite(BUZZER_PIN, HIGH);
    setLedStatus("on");

    sendHeartbeat(true, errorDetected, pressure, temperature, humidity);
    lastHeartbeatMs = now;
  }

  if (buzzerUntilMs > 0 && now < buzzerUntilMs) {
    digitalWrite(BUZZER_PIN, HIGH);
  } else {
    if (buzzerUntilMs > 0 && now >= buzzerUntilMs) {
      Serial.println("[BUZZER] OFF after 5s.");
      buzzerUntilMs = 0;
    }
    digitalWrite(BUZZER_PIN, LOW);
  }

  wasConductivityAboveThreshold = conductivityLatchedHigh;

  if (now - lastHeartbeatMs >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatMs = now;
    Serial.println("[HEARTBEAT] Timer triggered.");
    sendHeartbeat(moltDetected, errorDetected, pressure, temperature, humidity);
  }

  applyLedStatus(desiredLedStatus);
  delay(10);
}
