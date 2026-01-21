/**
 * Aquametic Smart Irrigation System
 * Raspberry Pi Pico W Firmware with MQTT
 * 
 * Hardware Connections:
 * - Capacitive Soil Moisture Sensor V1.2 → GPIO26 (ADC0)
 * - Power: 3.3V and GND
 * 
 * Features:
 * - WiFi connectivity
 * - MQTT communication for efficient IoT messaging
 * - Soil moisture monitoring with calibration
 * - Low power operation with deep sleep
 * - Automatic reconnection
 * - Status LED indication
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ========== CONFIGURATION ==========
// WiFi Credentials - UPDATE THESE WITH YOUR MOBILE HOTSPOT
const char* WIFI_SSID = "YOUR_HOTSPOT_NAME";        // Your mobile hotspot name
const char* WIFI_PASSWORD = "YOUR_HOTSPOT_PASSWORD"; // Your mobile hotspot password

// MQTT Broker Settings - Your computer's IP on hotspot
const char* MQTT_BROKER = "172.23.83.181";  // Your computer's hotspot IP
const int MQTT_PORT = 1883;
const char* MQTT_USERNAME = "";                   // Optional
const char* MQTT_PASSWORD = "";                   // Optional

// Device Configuration
const char* DEVICE_ID = "PICO_01";               // Unique sensor ID (this is your sensor_id)

// MQTT Topics
String TOPIC_DATA = "aquametic/sensor/" + String(DEVICE_ID) + "/data";
String TOPIC_STATUS = "aquametic/sensor/" + String(DEVICE_ID) + "/status";
String TOPIC_ONLINE = "aquametic/device/" + String(DEVICE_ID) + "/online";
String TOPIC_COMMAND = "aquametic/device/" + String(DEVICE_ID) + "/command";

// Sensor Configuration
const int POWER_PIN = 15;           // Power control pin (VCC)
const int MOISTURE_PIN = 26;        // GPIO26 (ADC0) - Signal pin
const int LED_PIN = LED_BUILTIN;    // Onboard LED

// Calibration values (YOUR SENSOR - adjust based on your readings)
const int AIR_VALUE = 100;          // Sensor reading in dry air (DRY)
const int WATER_VALUE = 1800;       // Sensor reading in water (WET)
const int READINGS_COUNT = 10;      // Number of readings to average

// Timing Configuration
const unsigned long READING_INTERVAL = 10000;    // 10 seconds (milliseconds) - for testing
const unsigned long STATUS_INTERVAL = 600000;    // 10 minutes
const unsigned long RECONNECT_DELAY = 5000;      // 5 seconds

// ========== GLOBAL OBJECTS ==========
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

unsigned long lastReadingTime = 0;
unsigned long lastStatusTime = 0;
bool isConnected = false;

// ========== FUNCTION DECLARATIONS ==========
void setupWiFi();
void setupMQTT();
void reconnectMQTT();
void publishSensorData();
void publishStatus();
void publishOnlineStatus(bool online);
void mqttCallback(char* topic, byte* payload, unsigned int length);
float readMoisture();
void blinkLED(int times, int delayMs);

// ========== SETUP ==========
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n========================================");
  Serial.println("  Aquametic Smart Irrigation System");
  Serial.println("  Pico W with MQTT");
  Serial.println("========================================\n");
  
  // Initialize pins
  pinMode(LED_PIN, OUTPUT);
  pinMode(POWER_PIN, OUTPUT);
  pinMode(MOISTURE_PIN, INPUT);
  
  digitalWrite(LED_PIN, LOW);
  digitalWrite(POWER_PIN, LOW);  // Sensor OFF to save power
  
  // Initialize ADC
  analogReadResolution(12); // 12-bit resolution (0-4095)
  
  // Connect to WiFi
  setupWiFi();
  
  // Setup MQTT
  setupMQTT();
  
  // Publish online status
  publishOnlineStatus(true);
  
  // Initial sensor reading
  publishSensorData();
  publishStatus();
  
  Serial.println("\nSystem ready! Starting monitoring...\n");
  blinkLED(3, 200);
}

// ========== MAIN LOOP ==========
void loop() {
  // Maintain MQTT connection
  if (!mqttClient.connected()) {
    reconnectMQTT();
  }
  mqttClient.loop();
  
  unsigned long currentTime = millis();
  
  // Publish sensor data at regular intervals
  if (currentTime - lastReadingTime >= READING_INTERVAL) {
    publishSensorData();
    lastReadingTime = currentTime;
  }
  
  // Publish status at regular intervals
  if (currentTime - lastStatusTime >= STATUS_INTERVAL) {
    publishStatus();
    lastStatusTime = currentTime;
  }
  
  delay(100); // Small delay to prevent CPU hogging
}

// ========== WiFi SETUP ==========
void setupWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    blinkLED(1, 100);
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal Strength: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    isConnected = true;
    blinkLED(3, 200);
  } else {
    Serial.println("\n✗ WiFi connection failed!");
    Serial.println("Check your SSID and password");
  }
}

// ========== MQTT SETUP ==========
void setupMQTT() {
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setKeepAlive(60);
  
  Serial.print("\nConnecting to MQTT broker: ");
  Serial.println(MQTT_BROKER);
  
  reconnectMQTT();
}

// ========== MQTT RECONNECT ==========
void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Attempting MQTT connection... ");
    
    String clientId = "AquameticPico_" + String(DEVICE_ID);
    
    bool connected;
    if (strlen(MQTT_USERNAME) > 0) {
      connected = mqttClient.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD);
    } else {
      connected = mqttClient.connect(clientId.c_str());
    }
    
    if (connected) {
      Serial.println("✓ Connected!");
      
      // Subscribe to command topic
      mqttClient.subscribe(TOPIC_COMMAND.c_str());
      Serial.println("Subscribed to: " + TOPIC_COMMAND);
      
      blinkLED(2, 200);
      return;
    } else {
      Serial.print("✗ Failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" - Retrying in 5 seconds...");
      blinkLED(5, 100);
      delay(RECONNECT_DELAY);
    }
  }
}

// ========== MQTT CALLBACK (Handle incoming commands) ==========
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message received on topic: ");
  Serial.println(topic);
  
  // Parse JSON payload
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, payload, length);
  
  if (error) {
    Serial.print("JSON parse failed: ");
    Serial.println(error.c_str());
    return;
  }
  
  const char* command = doc["command"];
  
  if (strcmp(command, "read_now") == 0) {
    Serial.println("Command: Read sensor now");
    publishSensorData();
  }
  else if (strcmp(command, "status") == 0) {
    Serial.println("Command: Send status");
    publishStatus();
  }
  else if (strcmp(command, "calibrate") == 0) {
    Serial.println("Command: Calibration requested");
    // Add calibration logic here
  }
  else {
    Serial.println("Unknown command: " + String(command));
  }
}

// ========== READ SOIL MOISTURE ==========
float readMoisture() {
  // Turn sensor ON (power saving technique)
  digitalWrite(POWER_PIN, HIGH);
  delay(10);  // Let sensor stabilize
  
  // Take multiple readings and average them (reduces noise)
  long sum = 0;
  for (int i = 0; i < READINGS_COUNT; i++) {
    sum += analogRead(MOISTURE_PIN);
    delay(5);  // Small delay between readings
  }
  
  // Turn sensor OFF to save power
  digitalWrite(POWER_PIN, LOW);
  
  int avgReading = sum / READINGS_COUNT;
  
  // Convert to percentage (0-100%)
  // Lower analog value = more moisture
  float moisturePercent = map(avgReading, AIR_VALUE, WATER_VALUE, 0, 100);
  
  // Constrain to valid range
  moisturePercent = constrain(moisturePercent, 0, 100);
  
  Serial.print("Raw ADC: ");
  Serial.print(avgReading);
  Serial.print(" -> Moisture: ");
  Serial.print(moisturePercent, 1);
  Serial.println("%");
  
  return moisturePercent;
}

// ========== PUBLISH SENSOR DATA ==========
void publishSensorData() {
  if (!mqttClient.connected()) {
    Serial.println("MQTT not connected - skipping data publish");
    return;
  }
  
  Serial.println("\n--- Publishing Sensor Data ---");
  
  // Read sensor
  float moisture = readMoisture();
  
  // Create JSON payload
  JsonDocument doc;
  doc["sensorId"] = DEVICE_ID;
  doc["moisture"] = round(moisture * 10) / 10.0; // Round to 1 decimal
  doc["timestamp"] = millis() / 1000; // Seconds since boot
  doc["rssi"] = WiFi.RSSI();
  
  // Serialize to string
  char jsonBuffer[256];
  serializeJson(doc, jsonBuffer);
  
  // Publish to MQTT
  bool success = mqttClient.publish(TOPIC_DATA.c_str(), jsonBuffer, false);
  
  if (success) {
    Serial.println("✓ Data published successfully");
    Serial.println(jsonBuffer);
    blinkLED(1, 50);
  } else {
    Serial.println("✗ Failed to publish data");
  }
  
  Serial.println("------------------------------\n");
}

// ========== PUBLISH STATUS ==========
void publishStatus() {
  if (!mqttClient.connected()) {
    return;
  }
  
  Serial.println("Publishing status...");
  
  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  doc["status"] = "online";
  doc["uptime"] = millis() / 1000;
  doc["freeHeap"] = rp2040.getFreeHeap();
  doc["rssi"] = WiFi.RSSI();
  doc["ip"] = WiFi.localIP().toString();
  
  char jsonBuffer[256];
  serializeJson(doc, jsonBuffer);
  
  mqttClient.publish(TOPIC_STATUS.c_str(), jsonBuffer, false);
  Serial.println("✓ Status published");
}

// ========== PUBLISH ONLINE/OFFLINE STATUS ==========
void publishOnlineStatus(bool online) {
  if (!mqttClient.connected() && online) {
    return; // Can't publish if not connected
  }
  
  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  doc["online"] = online;
  doc["timestamp"] = millis() / 1000;
  
  char jsonBuffer[128];
  serializeJson(doc, jsonBuffer);
  
  mqttClient.publish(TOPIC_ONLINE.c_str(), jsonBuffer, true); // Retained message
  
  Serial.print("Published online status: ");
  Serial.println(online ? "ONLINE" : "OFFLINE");
}

// ========== BLINK LED ==========
void blinkLED(int times, int delayMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(delayMs);
    digitalWrite(LED_PIN, LOW);
    delay(delayMs);
  }
}
