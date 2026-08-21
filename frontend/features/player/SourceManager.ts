import type { PlaybackSource, StreamProtocol } from "@/lib/types";

export class SourceManager {
  private readonly failures = new Map<number, { count: number; cooldownUntil: number }>();
  private readonly manualSourceId: number | null = null;

  constructor(
    private readonly sources: PlaybackSource[],
    private readonly supportedProtocols: Set<StreamProtocol>,
    private readonly maxFailuresPerSource: number,
  ) {}

  orderedSources(): PlaybackSource[] {
    return [...this.sources]
      .filter((source) => this.supportedProtocols.has(source.protocol))
      .filter((source) => source.last_known_status !== "browser_incompatible" && source.last_known_status !== "disabled")
      .filter((source) => source.browser_compatible !== "unsupported_codec")
      .sort((left, right) => {
        const health = healthRank(left) - healthRank(right);

        if (health !== 0) {
          return health;
        }

        return left.priority - right.priority || Number(left.is_backup) - Number(right.is_backup) || left.id - right.id;
      });
  }

  select(preferredId?: number | null): PlaybackSource | null {
    const ordered = this.orderedSources();

    if (preferredId) {
      const preferred = ordered.find((source) => source.id === preferredId);

      if (preferred && !this.hasExhausted(preferred.id)) {
        return preferred;
      }
    }

    return ordered.find((source) => !this.hasExhausted(source.id)) ?? null;
  }

  nextAfter(currentId: number, cooldownMs = 0): PlaybackSource | null {
    this.markFailed(currentId, cooldownMs);

    return this.select(this.manualSourceId);
  }

  markFailed(sourceId: number, cooldownMs = 0): void {
    const current = this.failures.get(sourceId);
    this.failures.set(sourceId, {
      count: (current?.count ?? 0) + 1,
      cooldownUntil: cooldownMs > 0 ? Date.now() + cooldownMs : (current?.cooldownUntil ?? 0),
    });
  }

  reset(sourceId: number): void {
    this.failures.delete(sourceId);
  }

  hasExhausted(sourceId: number): boolean {
    const failure = this.failures.get(sourceId);
    if (!failure) {
      return false;
    }

    if (failure.cooldownUntil > 0 && failure.cooldownUntil <= Date.now()) {
      this.failures.delete(sourceId);

      return false;
    }

    return failure.count >= this.maxFailuresPerSource;
  }
}

function healthRank(source: PlaybackSource): number {
  if (source.last_known_status === "offline") {
    return 3;
  }

  if (source.last_known_status === "browser_incompatible" || source.last_known_status === "disabled") {
    return 5;
  }

  if (source.last_known_status === "degraded") {
    return 1;
  }

  return 0;
}
