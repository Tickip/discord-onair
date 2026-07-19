import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import { Client, CUSTOM_RPC_ERROR_CODE } from "@xhayper/discord-rpc";

const RETRY_MS = 10_000;
const SCOPES = ["rpc", "rpc.voice.read"] as const;
const REFRESH_TOKEN_FILE = path.join(__dirname, "..", "tmp", ".refresh_token");

export const STATE_CHANGE = "STATE_CHANGE";

interface VoiceState {
  inChannel: boolean;
  channelId: string | null;
  mute: boolean;
  deaf: boolean;
  mode: "PUSH_TO_TALK" | "VOICE_ACTIVITY";
  speaking: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isCouldNotConnect(e: unknown): boolean {
  return e instanceof Error && (e as { code?: unknown }).code === CUSTOM_RPC_ERROR_CODE.COULD_NOT_CONNECT;
}

function readCachedRefreshToken(): string | null {
  try {
    const token = fs.readFileSync(REFRESH_TOKEN_FILE, "utf8").trim();
    return token || null;
  } catch {
    return null;
  }
}

function writeCachedRefreshToken(token: string): void {
  fs.mkdirSync(path.dirname(REFRESH_TOKEN_FILE), { recursive: true });
  fs.writeFileSync(REFRESH_TOKEN_FILE, token, "utf8");
}

function clearCachedRefreshToken(): void {
  fs.rmSync(REFRESH_TOKEN_FILE, { force: true });
}

export class DiscordBridge extends EventEmitter {
  private client!: Client;
  private state: VoiceState = {
    inChannel: false,
    channelId: null,
    mute: false,
    deaf: false,
    mode: "VOICE_ACTIVITY",
    speaking: false,
  };
  private onAir = false;
  private unsubscribeSpeaking: (() => Promise<void>) | null = null;
  private lastCachedRefreshToken: string | null = null;
  private refreshWatcher: NodeJS.Timeout | null = null;

  constructor(private clientId: string, private clientSecret: string) {
    super();
  }

  async start(): Promise<void> {
    await this.loginWithRetry();
    this.emit("connected");
    await this.subscribeToVoiceEvents();
  }

  // Each retry attempt uses a fresh Client: this library's connect()/login()
  // is only safe to call once per instance (a second call on an already-
  // connected client hangs for 10s waiting for a handshake event that never
  // fires again), so recreating the client is the reliable way to retry.
  private async loginWithRetry(): Promise<void> {
    for (;;) {
      this.client = new Client({
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        transport: { type: "ipc" },
      });
      this.wireDisconnectHandler();

      try {
        await this.login();
        return;
      } catch (e) {
        if (isCouldNotConnect(e)) {
          await sleep(RETRY_MS);
          continue;
        }
        throw e;
      }
    }
  }

  private wireDisconnectHandler(): void {
    this.client.on("disconnected", () => {
      this.stopRefreshTokenWatcher();
      this.emit("disconnect");
      this.state.inChannel = false;
      this.state.channelId = null;
      this.unsubscribeSpeaking = null;
      this.recompute();
      void this.start().catch((err) => this.emit("error", err));
    });
  }

  // @xhayper/discord-rpc auto-refreshes the access token internally before it
  // expires, silently rotating this.refreshToken in the process (no event is
  // emitted). Without this, our cached copy goes stale as soon as that fires,
  // and the next process start fails to log in with an invalid_grant error.
  private startRefreshTokenWatcher(): void {
    this.stopRefreshTokenWatcher();
    this.refreshWatcher = setInterval(() => {
      const current = (this.client as unknown as { refreshToken?: string }).refreshToken;
      if (current && current !== this.lastCachedRefreshToken) {
        writeCachedRefreshToken(current);
        this.lastCachedRefreshToken = current;
      }
    }, 60_000);
    this.refreshWatcher.unref();
  }

  private stopRefreshTokenWatcher(): void {
    if (this.refreshWatcher) {
      clearInterval(this.refreshWatcher);
      this.refreshWatcher = null;
    }
  }

  private async login(): Promise<void> {
    const cached = readCachedRefreshToken();

    try {
      await this.client.login(cached ? { scopes: [...SCOPES], refreshToken: cached } : { scopes: [...SCOPES] });
    } catch (e) {
      if (cached) {
        clearCachedRefreshToken();
        console.warn("Cached refresh token was rejected; cleared it. Rerun to re-authorize.");
      }
      throw e;
    }

    const refreshToken = (this.client as unknown as { refreshToken?: string }).refreshToken;
    if (refreshToken) {
      writeCachedRefreshToken(refreshToken);
      this.lastCachedRefreshToken = refreshToken;
    }
    this.startRefreshTokenWatcher();
  }

  private async subscribeToVoiceEvents(): Promise<void> {
    await this.client.subscribe("VOICE_CHANNEL_SELECT");
    await this.client.subscribe("VOICE_SETTINGS_UPDATE");

    this.client.on("VOICE_CHANNEL_SELECT", (data: any) => {
      void this.onVoiceChannelSelect(data.channel_id ?? null);
    });

    this.client.on("VOICE_SETTINGS_UPDATE", (data: any) => {
      this.state.mute = Boolean(data.mute);
      this.state.deaf = Boolean(data.deaf);
      this.state.mode = data.mode?.type === "PUSH_TO_TALK" ? "PUSH_TO_TALK" : "VOICE_ACTIVITY";
      this.recompute();
    });

    this.client.on("SPEAKING_START", (data: any) => {
      if (data.channel_id !== this.state.channelId) return;
      if (data.user_id !== this.client.user?.id) return;
      this.state.speaking = true;
      this.recompute();
    });

    this.client.on("SPEAKING_STOP", (data: any) => {
      if (data.channel_id !== this.state.channelId) return;
      if (data.user_id !== this.client.user?.id) return;
      this.state.speaking = false;
      this.recompute();
    });
  }

  private async onVoiceChannelSelect(channelId: string | null): Promise<void> {
    if (this.unsubscribeSpeaking) {
      await this.unsubscribeSpeaking();
      this.unsubscribeSpeaking = null;
    }

    this.state.channelId = channelId;
    this.state.inChannel = channelId !== null;
    this.state.speaking = false;

    if (channelId) {
      const { unsubscribe: unsubStart } = await this.client.subscribe("SPEAKING_START", { channel_id: channelId });
      const { unsubscribe: unsubStop } = await this.client.subscribe("SPEAKING_STOP", { channel_id: channelId });
      this.unsubscribeSpeaking = async () => {
        await unsubStart();
        await unsubStop();
      };
    }

    this.recompute();
  }

  private recompute(): void {
    const onAir =
      this.state.inChannel &&
      !this.state.mute &&
      !this.state.deaf &&
      (this.state.mode === "VOICE_ACTIVITY" || this.state.speaking);

    if (onAir !== this.onAir) {
      this.onAir = onAir;
      this.emit(STATE_CHANGE, onAir);
    }
  }
}
