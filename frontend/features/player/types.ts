import type { PlaybackPolicy, PlaybackSource, StreamProtocol } from "@/lib/types";

export type PlaybackState =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "buffering"
  | "recovering"
  | "switching_source"
  | "offline"
  | "error"
  | "ended";

export type PlaybackIssueKind = "network" | "media" | "unsupported" | "stall" | "unknown";

export type PlaybackIssue = {
  kind: PlaybackIssueKind;
  fatal: boolean;
  message: string;
};

export type QualityLevel = {
  id: number;
  label: string;
};

export type PlayerEvent =
  | { type: "state"; state: PlaybackState; message?: string }
  | { type: "source"; source: PlaybackSource | null }
  | { type: "qualities"; qualities: QualityLevel[] }
  | { type: "live-drift"; behindLive: boolean }
  | { type: "error"; message: string };

export type PlayerConfig = PlaybackPolicy & {
  is_live_event: boolean;
};

export type PlaybackAdapter = {
  readonly protocol: StreamProtocol;
  load(video: HTMLVideoElement, source: PlaybackSource): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  destroy(): void;
  recoverMedia?(): void;
  seekToLiveEdge?(): void;
  qualities?(): QualityLevel[];
  setQuality?(qualityId: number): void;
};

export type AdapterEvents = {
  onReady(): void;
  onPlaying(): void;
  onBuffering(): void;
  onEnded(): void;
  onIssue(issue: PlaybackIssue): void;
  onQualities(qualities: QualityLevel[]): void;
};
