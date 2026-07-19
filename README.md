# discord-onair

Publishes an MQTT on-air signal based on your Discord voice state: connected to a channel, unmuted, and (for push-to-talk users) actively speaking. Useful for driving an on-air LED via Home Assistant or similar.

`onAir` is computed as:

```
inChannel && !mute && !deaf && (mode === "VOICE_ACTIVITY" || isSpeaking)
```

## Development

Copy `.env.example` to `.env` and fill in your Discord app and MQTT broker details.

```
npm install
npm run dev
```

On first run, Discord will show an authorize prompt requesting the `rpc` and `rpc.voice.read` scopes — accept it. Subsequent runs authorize silently.

## Build

```
npm run build
npm start
```
