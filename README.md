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

## Run automatically at logon (Windows)

`scripts/run-forever.ps1` loops forever, restarting the bot 10 seconds after
it exits for any reason (crash, Discord/MQTT drop, etc.) — no separate
service manager needed. Registering it as a scheduled task that fires at
logon makes it come up automatically every time you sign in.

`scripts/run-hidden.vbs` is a small wrapper that launches
`run-forever.ps1` fully detached with no visible window — PowerShell's own
`-WindowStyle Hidden` is unreliable when launched via Task Scheduler (the
window can still show up, and closing it kills the bot); `WScript.Shell.Run`
with window style `0` is the robust way to actually hide it. The scheduled
task points at the `.vbs`, not directly at `powershell.exe`.

1. Build first, so `dist/index.js` exists: `npm run build`
2. Register the task (run once, from an **elevated** PowerShell — right-click
   PowerShell → "Run as Administrator"; creating the task needs admin rights,
   but it runs as your normal user afterward since it's registered with
   `/RL LIMITED`):

   ```
   schtasks /Create /TN "DiscordOnAir" /TR "wscript.exe C:\Dev\bots\discord-onair\scripts\run-hidden.vbs" /SC ONLOGON /RL LIMITED /F
   ```

   Adjust the paths in `run-hidden.vbs` and the command above if the repo
   lives somewhere else. (If you're in Git Bash rather than PowerShell,
   prefix the command with `MSYS_NO_PATHCONV=1` — Git Bash otherwise
   mangles the `/Create`-style flags.)

3. It'll start on your next logon. To start it immediately without
   logging out: `schtasks /Run /TN "DiscordOnAir"`

Useful follow-ups:

- Check status: `schtasks /Query /TN "DiscordOnAir" /V /FO LIST`
- Stop the running instance: find and kill the `node.exe dist\index.js`
  process (e.g. `Get-Process node | Stop-Process`) — the task itself only
  controls the logon trigger, not a live process handle.
- Remove entirely: `schtasks /Delete /TN "DiscordOnAir" /F`

Whenever you change the code, rerun `npm run build` — the scheduled task
always runs the compiled `dist/index.js`, not the TypeScript source.
