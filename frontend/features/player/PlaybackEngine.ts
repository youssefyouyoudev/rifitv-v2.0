import type { PlaybackSource } from "@/lib/types";
import { createAdapter, supportedProtocols } from "./adapters";
import { PlayerMetrics } from "./PlayerMetrics";
import { RecoveryManager } from "./RecoveryManager";
import { SourceManager } from "./SourceManager";
import { PlaybackStateMachine } from "./PlaybackStateMachine";
import type { PlaybackAdapter, PlaybackIssue, PlayerConfig, PlayerEvent, PlaybackState } from "./types";

type Listener = (event: PlayerEvent) => void;

export class PlaybackEngine {
  private readonly stateMachine = new PlaybackStateMachine();
  private readonly recovery: RecoveryManager;
  private readonly metrics = new PlayerMetrics();
  private readonly listeners = new Set<Listener>();
  private sourceManager: SourceManager | null = null;
  private adapter: PlaybackAdapter | null = null;
  private currentSource: PlaybackSource | null = null;
  private stallTimer: number | null = null;
  private lastProgressAt = Date.now();
  private lastCurrentTime = 0;
  private startupStartedAt = 0;
  private destroyed = false;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly sources: PlaybackSource[],
    private readonly config: PlayerConfig,
  ) {
    this.recovery = new RecoveryManager(config.max_recovery_attempts_per_source, config.retry_backoff_ms);
    this.bindNetwork();
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);

    return () => this.listeners.delete(listener);
  }

  async load(preferredSourceId?: number | null): Promise<void> {
    const protocols = await supportedProtocols();
    this.sourceManager = new SourceManager(this.sources, protocols, this.config.max_source_failures_per_session);
    const source = this.sourceManager.select(preferredSourceId);

    if (!source) {
      this.setState("error", "Broadcast temporarily unavailable");
      this.emit({ type: "error", message: "No compatible sources are available." });
      return;
    }

    await this.loadSource(source, preferredSourceId ? "switching_source" : "loading");
  }

  async selectSource(sourceId: number): Promise<void> {
    await this.load(sourceId);
  }

  async retry(): Promise<void> {
    this.recovery.reset(this.currentSource?.id ?? 0);
    await this.load(this.currentSource?.id);
  }

  async play(): Promise<void> {
    try {
      await this.adapter?.play();
    } catch (error) {
      await this.handleIssue(normalizeIssue(error));
    }
  }

  pause(): void {
    this.adapter?.pause();
    this.setState("ready");
  }

  seekToLiveEdge(): void {
    this.adapter?.seekToLiveEdge?.();
    this.emit({ type: "live-drift", behindLive: false });
  }

  setQuality(qualityId: number): void {
    this.adapter?.setQuality?.(qualityId);
  }

  destroy(): void {
    this.destroyed = true;
    if (this.stallTimer) {
      window.clearInterval(this.stallTimer);
    }
    this.adapter?.destroy();
    this.adapter = null;
    this.currentSource = null;
    this.listeners.clear();
    window.removeEventListener("offline", this.handleOffline);
    window.removeEventListener("online", this.handleOnline);
  }

  private async loadSource(source: PlaybackSource, state: PlaybackState): Promise<void> {
    if (this.destroyed) {
      return;
    }

    const previous = this.currentSource;
    this.setState(state, state === "switching_source" ? "Switching to backup..." : "Connecting...");
    this.adapter?.destroy();
    this.currentSource = source;
    this.emit({ type: "source", source });
    this.metrics.emit(previous ? { name: "source_switched", from: previous, to: source } : { name: "source_selected", source });

    this.startupStartedAt = performance.now();
    this.adapter = await createAdapter(source.protocol, {
      onReady: () => this.setState("ready"),
      onPlaying: () => {
        this.metrics.emit({ name: "playback_started", source });
        this.metrics.emit({ name: "startup_duration", source, durationMs: performance.now() - this.startupStartedAt });
        this.setState("playing");
      },
      onBuffering: () => {
        this.metrics.emit({ name: "buffering_started", source: this.currentSource });
        this.setState("buffering", "Reconnecting...");
      },
      onEnded: () => {
        if (this.config.is_live_event) {
          void this.handleIssue({ kind: "network", fatal: true, message: "Unexpected live stream EOF." });
          return;
        }

        this.setState("ended");
      },
      onIssue: (issue) => void this.handleIssue(issue),
      onQualities: (qualities) => this.emit({ type: "qualities", qualities }),
    });

    try {
      await this.adapter.load(this.video, source);
      this.startStallWatchdog();
      await this.adapter.play();
    } catch (error) {
      await this.handleIssue(normalizeIssue(error));
    }
  }

  private async handleIssue(issue: PlaybackIssue): Promise<void> {
    if (this.destroyed) {
      return;
    }

    this.metrics.emit({ name: "recovery_attempted", source: this.currentSource, issue });
    this.setState(navigator.onLine ? "recovering" : "offline", navigator.onLine ? "Reconnecting..." : "You appear to be offline.");

    const decision = this.recovery.decide(this.currentSource, issue);

    if (decision.action === "recover_media") {
      this.adapter?.recoverMedia?.();
      return;
    }

    if (decision.action === "retry_current") {
      window.setTimeout(() => void this.load(this.currentSource?.id), decision.delayMs);
      return;
    }

    if (decision.action === "switch_source") {
      const next = this.currentSource && this.sourceManager?.nextAfter(this.currentSource.id);
      if (next) {
        await this.loadSource(next, "switching_source");
        return;
      }
    }

    this.metrics.emit({ name: "playback_failed", source: this.currentSource, issue });
    this.setState("error", "Broadcast temporarily unavailable");
    this.emit({ type: "error", message: "Broadcast temporarily unavailable. Try again in a moment." });
  }

  private startStallWatchdog(): void {
    if (this.stallTimer) {
      window.clearInterval(this.stallTimer);
    }

    this.lastCurrentTime = this.video.currentTime;
    this.lastProgressAt = Date.now();
    this.stallTimer = window.setInterval(() => {
      if (this.stateMachine.state() !== "playing") {
        return;
      }

      const progressed = Math.abs(this.video.currentTime - this.lastCurrentTime) > 0.25;
      if (progressed) {
        this.lastCurrentTime = this.video.currentTime;
        this.lastProgressAt = Date.now();
        this.checkLiveDrift();
        return;
      }

      if (Date.now() - this.lastProgressAt >= this.config.stall_detection_ms) {
        this.lastProgressAt = Date.now();
        void this.handleIssue({ kind: "stall", fatal: false, message: "Playback stalled." });
      }
    }, 1000);
  }

  private checkLiveDrift(): void {
    if (!this.config.is_live_event || !Number.isFinite(this.video.duration)) {
      return;
    }

    const behindLive = this.video.duration - this.video.currentTime > 25;
    this.emit({ type: "live-drift", behindLive });
  }

  private bindNetwork(): void {
    window.addEventListener("offline", this.handleOffline);
    window.addEventListener("online", this.handleOnline);
  }

  private readonly handleOffline = (): void => {
    this.setState("offline", "You appear to be offline.");
  };

  private readonly handleOnline = (): void => {
    void this.handleIssue({ kind: "network", fatal: false, message: "Network restored." });
  };

  private setState(state: PlaybackState, message?: string): void {
    try {
      this.stateMachine.transition(state);
    } catch {
      this.stateMachine.force(state);
    }
    this.emit({ type: "state", state: this.stateMachine.state(), message });
  }

  private emit(event: PlayerEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}

function normalizeIssue(error: unknown): PlaybackIssue {
  if (typeof error === "object" && error !== null && "kind" in error && "fatal" in error && "message" in error) {
    return error as PlaybackIssue;
  }

  return {
    kind: "unknown",
    fatal: true,
    message: error instanceof Error ? error.message : "Playback failed.",
  };
}
