import type { PlaybackSource } from "@/lib/types";
import type { PlaybackIssue } from "./types";

export type MetricEvent =
  | { name: "source_selected"; source: PlaybackSource }
  | { name: "playback_started"; source: PlaybackSource }
  | { name: "startup_duration"; source: PlaybackSource; durationMs: number }
  | { name: "buffering_started"; source: PlaybackSource | null }
  | { name: "buffering_ended"; source: PlaybackSource | null }
  | { name: "recovery_attempted"; source: PlaybackSource | null; issue: PlaybackIssue }
  | { name: "source_switched"; from: PlaybackSource | null; to: PlaybackSource }
  | { name: "playback_failed"; source: PlaybackSource | null; issue: PlaybackIssue };

export class PlayerMetrics {
  emit(event: MetricEvent): void {
    if (process.env.NODE_ENV === "development") {
      const sanitized = "source" in event && event.source ? { ...event, source: sanitizeSource(event.source) } : event;
      console.debug("[RiFiTV Player]", sanitized);
    }
  }
}

function sanitizeSource(source: PlaybackSource): PlaybackSource {
  return {
    ...source,
    url: redactUrl(source.url),
  };
}

function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return "[redacted]";
  }
}
