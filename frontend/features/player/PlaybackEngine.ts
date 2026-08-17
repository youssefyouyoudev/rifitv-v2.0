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
  private retryTimer: number | null = null;
  private lastProgressAt = Date.now();
  private lastCurrentTime = 0;
  private startupStartedAt = 0;
  private loadGeneration = 0;
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
    if (this.destroyed) {
      return;
    }

    if (!this.sourceManager) {
      const protocols = await supportedProtocols();
      if (this.destroyed) {
        return;
      }
      this.sourceManager = new SourceManager(this.sources, protocols, this.config.max_source_failures_per_session);
    }

    const source = this.sourceManager.select(preferredSourceId);
    if (!source) {
      this.fail("No compatible sources are available.");
      return;
    }

    await this.loadSource(source, this.currentSource ? "switching_source" : "loading");
  }

  async selectSource(sourceId: number): Promise<void> {
    this.clearRetryTimer();
    this.recovery.reset(sourceId);
    this.sourceManager?.reset(sourceId);

    if (!this.sourceManager) {
      await this.load(sourceId);
      return;
    }

    const source = this.sourceManager.select(sourceId);
    if (!source || source.id !== sourceId) {
      this.fail("This broadcast is not compatible with this browser.");
      return;
    }

    await this.loadSource(source, "switching_source");
  }

  async retry(): Promise<void> {
    this.clearRetryTimer();
    const source = this.currentSource;
    if (!source) {
      await this.load();
      return;
    }

    this.recovery.reset(source.id);
    this.sourceManager?.reset(source.id);
    await this.loadSource(source, "recovering");
  }

  async play(): Promise<void> {
    try {
      await this.adapter?.play();
    } catch (error) {
      await this.handleIssue(normalizeIssue(error));
    }
  }

  pause(): void {
    if (!this.adapter) {
      return;
    }
    this.adapter.pause();
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
    this.loadGeneration += 1;
    this.clearRetryTimer();
    this.clearStallTimer();
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

    const generation = ++this.loadGeneration;
    this.clearRetryTimer();
    this.clearStallTimer();
    const previous = this.currentSource;
    this.setState(state, state === "switching_source" ? "Switching broadcast..." : "Connecting...");
    this.adapter?.destroy();
    this.adapter = null;
    this.currentSource = source;
    this.emit({ type: "source", source });
    this.metrics.emit(previous ? { name: "source_switched", from: previous, to: source } : { name: "source_selected", source });
    this.startupStartedAt = performance.now();

    let adapter: PlaybackAdapter | null = null;
    adapter = await createAdapter(source.protocol, {
      onReady: () => {
        if (this.isActive(generation, adapter)) this.setState("ready");
      },
      onPlaying: () => {
        if (!this.isActive(generation, adapter)) return;
        this.metrics.emit({ name: "playback_started", source });
        this.metrics.emit({ name: "startup_duration", source, durationMs: performance.now() - this.startupStartedAt });
        this.setState("playing");
      },
      onBuffering: () => {
        if (!this.isActive(generation, adapter)) return;
        this.metrics.emit({ name: "buffering_started", source: this.currentSource });
        this.setState("buffering", "Buffering...");
      },
      onEnded: () => {
        if (!this.isActive(generation, adapter)) return;
        if (this.config.is_live_event) {
          void this.handleIssue({ kind: "network", fatal: true, message: "Unexpected live stream EOF." }, generation);
          return;
        }
        this.setState("ended");
      },
      onIssue: (issue) => {
        if (this.isActive(generation, adapter)) void this.handleIssue(issue, generation);
      },
      onQualities: (qualities) => {
        if (this.isActive(generation, adapter)) this.emit({ type: "qualities", qualities });
      },
    });

    if (!this.isCurrentGeneration(generation)) {
      adapter.destroy();
      return;
    }

    this.adapter = adapter;
    try {
      await adapter.load(this.video, source);
      if (!this.isActive(generation, adapter)) {
        adapter.destroy();
        return;
      }
      this.startStallWatchdog(generation);
      await adapter.play();
    } catch (error) {
      await this.handleIssue(normalizeIssue(error), generation);
    }
  }

  private async handleIssue(issue: PlaybackIssue, generation = this.loadGeneration): Promise<void> {
    if (!this.isCurrentGeneration(generation)) {
      return;
    }

    this.metrics.emit({ name: "recovery_attempted", source: this.currentSource, issue });
    this.setState(navigator.onLine ? "recovering" : "offline", navigator.onLine ? "Reconnecting..." : "You appear to be offline.");
    if (!navigator.onLine) {
      return;
    }

    const source = this.currentSource;
    const decision = this.recovery.decide(source, issue);

    if (decision.action === "recover_media") {
      this.adapter?.recoverMedia?.();
      return;
    }

    if (decision.action === "retry_current" && source) {
      this.clearRetryTimer();
      this.retryTimer = window.setTimeout(() => {
        this.retryTimer = null;
        if (this.isCurrentGeneration(generation)) {
          void this.loadSource(source, "recovering");
        }
      }, decision.delayMs);
      return;
    }

    if (decision.action === "switch_source") {
      const next = source && this.sourceManager?.nextAfter(source.id);
      if (next) {
        await this.loadSource(next, "switching_source");
        return;
      }
    }

    this.metrics.emit({ name: "playback_failed", source, issue });
    this.fail("Broadcast temporarily unavailable. Try another channel or retry in a moment.");
  }

  private startStallWatchdog(generation: number): void {
    this.clearStallTimer();
    this.lastCurrentTime = this.video.currentTime;
    this.lastProgressAt = Date.now();
    this.stallTimer = window.setInterval(() => {
      if (!this.isCurrentGeneration(generation) || this.stateMachine.state() !== "playing") {
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
        void this.handleIssue({ kind: "stall", fatal: false, message: "Playback stalled." }, generation);
      }
    }, 1000);
  }

  private checkLiveDrift(): void {
    if (!this.config.is_live_event || !Number.isFinite(this.video.duration)) {
      return;
    }

    this.emit({ type: "live-drift", behindLive: this.video.duration - this.video.currentTime > 25 });
  }

  private bindNetwork(): void {
    window.addEventListener("offline", this.handleOffline);
    window.addEventListener("online", this.handleOnline);
  }

  private readonly handleOffline = (): void => {
    this.clearRetryTimer();
    this.setState("offline", "You appear to be offline.");
  };

  private readonly handleOnline = (): void => {
    if (this.currentSource) {
      void this.retry();
    }
  };

  private setState(state: PlaybackState, message?: string): void {
    this.stateMachine.transition(state);
    this.emit({ type: "state", state: this.stateMachine.state(), message });
  }

  private fail(message: string): void {
    this.setState("error", "Broadcast temporarily unavailable");
    this.emit({ type: "error", message });
  }

  private isCurrentGeneration(generation: number): boolean {
    return !this.destroyed && generation === this.loadGeneration;
  }

  private isActive(generation: number, adapter: PlaybackAdapter | null): boolean {
    return this.isCurrentGeneration(generation) && adapter !== null && this.adapter === adapter;
  }

  private clearRetryTimer(): void {
    if (this.retryTimer !== null) {
      window.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private clearStallTimer(): void {
    if (this.stallTimer !== null) {
      window.clearInterval(this.stallTimer);
      this.stallTimer = null;
    }
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
