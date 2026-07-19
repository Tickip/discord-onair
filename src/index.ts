import { config } from "./config";
import { DiscordBridge, STATE_CHANGE } from "./discordBridge";
import { MqttClient } from "./mqttClient";

async function main(): Promise<void> {
  const mqttClient = new MqttClient(
    config.mqttUsername,
    config.mqttPassword,
    config.mqttBrokerUrl,
    config.mqttTopic,
    config.mqttMessageOn,
    config.mqttMessageOff
  );
  mqttClient.on("connected", () => console.log("mqtt connected"));

  const bridge = new DiscordBridge(config.discordClientId, config.discordClientSecret);
  bridge.on("connected", () => console.log("discord connected"));
  bridge.on("disconnect", () => console.log("discord disconnected"));
  bridge.on("error", (err) => console.error("discord bridge error", err));
  bridge.on(STATE_CHANGE, (onAir: boolean) => {
    console.log("on-air state changed:", onAir);
    mqttClient.publishState(onAir);
  });

  await bridge.start();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
