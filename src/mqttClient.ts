import mqtt, { MqttClient as Mqtt } from "mqtt";
import { EventEmitter } from "events";

export class MqttClient extends EventEmitter {
  private client: Mqtt;
  private topic: string;
  private messageOn: string;
  private messageOff: string;

  constructor(
    username: string,
    password: string,
    brokerUrl: string,
    topic: string,
    messageOn: string,
    messageOff: string
  ) {
    super();

    this.topic = topic;
    this.messageOn = messageOn;
    this.messageOff = messageOff;

    this.client = mqtt.connect(brokerUrl, { username, password });
    this.client.on("connect", () => this.emit("connected"));
  }

  publishState(onAir: boolean): void {
    if (!this.client.connected) return;
    this.client.publish(this.topic, onAir ? this.messageOn : this.messageOff, { retain: true });
  }
}
