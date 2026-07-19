import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  discordClientId: required("DISCORD_BOT_CLIENT_ID"),
  discordClientSecret: required("DISCORD_BOT_CLIENT_SECRET"),
  mqttUsername: required("MQTT_USERNAME"),
  mqttPassword: required("MQTT_PASSWORD"),
  mqttBrokerUrl: required("MQTT_BROKER_URL"),
  mqttTopic: required("MQTT_TOPIC"),
  mqttMessageOn: required("MQTT_MESSAGE_ON"),
  mqttMessageOff: required("MQTT_MESSAGE_OFF"),
};
