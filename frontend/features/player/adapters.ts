import type { PlaybackSource, StreamProtocol } from "@/lib/types";
import { DEFAULT_MPEGTS_PROFILE, MPEGTS_PROFILES, playbackUrl } from "./config";
import type { AdapterEvents, PlaybackAdapter, PlaybackIssue, QualityLevel } from "./types";

type HlsErrorData = {
  fatal: boolean;
  type?: string;
  details?: string;
};

type HlsInstance = {
  loadSource(url: string): void;
  attachMedia(video: HTMLVideoElement): void;
  destroy(): void;
  recoverMediaError(): void;
  on(event: string, callback: (event: string, data: HlsErrorData) => void): void;
  levels: Array<{ height?: number; bitrate?: number }>;
  currentLevel: number;
  liveSyncPosition?: number | null;
};

type HlsConstructor = {
  isSupported(): boolean;
  Events: Record<"ERROR" | "MANIFEST_PARSED" | "LEVEL_LOADED", string>;
  new (config: Record<string, unknown>): HlsInstance;
};

type MpegTsPlayer = {
  attachMediaElement(video: HTMLVideoElement): void;
  load(): void;
  play(): Promise<void>;
  pause(): void;
  unload(): void;
  detachMediaElement(): void;
  destroy(): void;
  on(event: string, callback: (event: string, data: unknown) => void): void;
};

type MpegTsModule = {
  getFeatureList(): { mseLivePlayback: boolean };
  createPlayer(config: Record<string, unknown>, options: Record<string, unknown>): MpegTsPlayer;
  Events: Record<"ERROR" | "LOADING_COMPLETE", string>;
};

export async function supportedProtocols(): Promise<Set<StreamProtocol>> {
  const protocols = new Set<StreamProtocol>();

  if (typeof document === "undefined") {
    return protocols;
  }

  const video = document.createElement("video");
  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    protocols.add("hls");
  } else {
    const Hls = await loadHls();
    if (Hls.isSupported()) {
      protocols.add("hls");
    }
  }

  const mpegts = await loadMpegTs();
  if (mpegts.getFeatureList().mseLivePlayback) {
    protocols.add("mpegts");
  }

  return protocols;
}

export async function createAdapter(protocol: StreamProtocol, events: AdapterEvents): Promise<PlaybackAdapter> {
  if (protocol === "hls") {
    return new HlsAdapter(events);
  }

  return new MpegTsAdapter(events);
}

class HlsAdapter implements PlaybackAdapter {
  readonly protocol = "hls" as const;
  private video: HTMLVideoElement | null = null;
  private hls: HlsInstance | null = null;
  private native = false;

  constructor(private readonly events: AdapterEvents) {}

  async load(video: HTMLVideoElement, source: PlaybackSource): Promise<void> {
    this.destroy();
    this.video = video;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      this.native = true;
      video.src = playbackUrl(source);
      this.bindVideoEvents(video);
      video.load();
      return;
    }

    const Hls = await loadHls();
    if (!Hls.isSupported()) {
      throw unsupported("HLS is not supported in this browser.");
    }

    this.hls = new Hls({
      liveSyncDurationCount: 3,
      liveMaxLatencyDurationCount: 5,
      maxBufferLength: 30,
      backBufferLength: 30,
      enableWorker: true,
      lowLatencyMode: false,
      fragLoadingTimeOut: 15_000,
      manifestLoadingTimeOut: 10_000,
      levelLoadingTimeOut: 10_000,
    });
    this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
      this.events.onReady();
      this.events.onQualities(this.qualities());
    });
    this.hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) {
        return;
      }
      this.events.onIssue({
        kind: data.type?.includes("MEDIA") ? "media" : "network",
        fatal: data.fatal,
        message: data.details ?? "HLS playback error",
      });
    });
    this.bindVideoEvents(video);
    this.hls.loadSource(playbackUrl(source));
    this.hls.attachMedia(video);
  }

  async play(): Promise<void> {
    await this.video?.play();
  }

  pause(): void {
    this.video?.pause();
  }

  destroy(): void {
    if (this.video) {
      clearVideoEvents(this.video);
      this.video.removeAttribute("src");
      this.video.load();
    }
    this.hls?.destroy();
    this.hls = null;
    this.video = null;
    this.native = false;
  }

  recoverMedia(): void {
    this.hls?.recoverMediaError();
  }

  seekToLiveEdge(): void {
    if (this.hls?.liveSyncPosition && this.video) {
      this.video.currentTime = this.hls.liveSyncPosition;
    }
  }

  qualities(): QualityLevel[] {
    const levels = this.hls?.levels ?? [];
    return levels.map((level, index) => ({
      id: index,
      label: level.height ? `${level.height}p` : `${Math.round((level.bitrate ?? 0) / 1000)} kbps`,
    }));
  }

  setQuality(qualityId: number): void {
    if (this.hls) {
      this.hls.currentLevel = qualityId;
    }
  }

  private bindVideoEvents(video: HTMLVideoElement): void {
    video.oncanplay = () => this.events.onReady();
    video.onplaying = () => this.events.onPlaying();
    video.onwaiting = () => this.events.onBuffering();
    video.onended = () => this.events.onEnded();
    video.onerror = () => this.events.onIssue({ kind: "media", fatal: true, message: "Video playback error" });
  }
}

class MpegTsAdapter implements PlaybackAdapter {
  readonly protocol = "mpegts" as const;
  private video: HTMLVideoElement | null = null;
  private player: MpegTsPlayer | null = null;

  constructor(private readonly events: AdapterEvents) {}

  async load(video: HTMLVideoElement, source: PlaybackSource): Promise<void> {
    this.destroy();
    const mpegts = await loadMpegTs();

    if (!mpegts.getFeatureList().mseLivePlayback) {
      throw unsupported("MPEG-TS is not supported in this browser.");
    }

    this.video = video;
    this.player = mpegts.createPlayer(
      { type: "mpegts", isLive: true, url: playbackUrl(source) },
      MPEGTS_PROFILES[DEFAULT_MPEGTS_PROFILE],
    );
    this.player.on(mpegts.Events.ERROR, (_event, data) => {
      this.events.onIssue({ kind: "network", fatal: true, message: String(data) });
    });
    this.player.on(mpegts.Events.LOADING_COMPLETE, () => {
      this.events.onIssue({ kind: "network", fatal: true, message: "Unexpected MPEG-TS loader EOF." });
    });
    this.bindVideoEvents(video);
    this.player.attachMediaElement(video);
    this.player.load();
  }

  async play(): Promise<void> {
    await this.player?.play();
  }

  pause(): void {
    this.player?.pause();
  }

  destroy(): void {
    this.player?.pause();
    this.player?.unload();
    this.player?.detachMediaElement();
    this.player?.destroy();
    if (this.video) {
      clearVideoEvents(this.video);
      this.video.removeAttribute("src");
      this.video.load();
    }
    this.player = null;
    this.video = null;
  }

  private bindVideoEvents(video: HTMLVideoElement): void {
    video.oncanplay = () => this.events.onReady();
    video.onplaying = () => this.events.onPlaying();
    video.onwaiting = () => this.events.onBuffering();
    video.onended = () => this.events.onEnded();
    video.onerror = () => this.events.onIssue({ kind: "media", fatal: true, message: "Video playback error" });
  }
}

function clearVideoEvents(video: HTMLVideoElement): void {
  video.oncanplay = null;
  video.onplaying = null;
  video.onwaiting = null;
  video.onended = null;
  video.onerror = null;
}

async function loadHls(): Promise<HlsConstructor> {
  const hlsModule = await import("hls.js");
  return hlsModule.default as unknown as HlsConstructor;
}

async function loadMpegTs(): Promise<MpegTsModule> {
  const mpegTsModule = await import("mpegts.js");
  return mpegTsModule as unknown as MpegTsModule;
}

function unsupported(message: string): PlaybackIssue & Error {
  const error = new Error(message) as PlaybackIssue & Error;
  error.kind = "unsupported";
  error.fatal = true;
  error.message = message;
  return error;
}
