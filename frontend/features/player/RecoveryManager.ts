import type { PlaybackSource } from "@/lib/types";
import type { PlaybackIssue } from "./types";

export type RecoveryDecision =
  | { action: "retry_current"; attempt: number; delayMs: number }
  | { action: "recover_media"; attempt: number }
  | { action: "switch_source"; reason: string }
  | { action: "fail"; reason: string };

export class RecoveryManager {
  private readonly attempts = new Map<number, number>();

  constructor(
    private readonly maxAttemptsPerSource: number,
    private readonly retryBackoffMs: number[],
  ) {}

  decide(source: PlaybackSource | null, issue: PlaybackIssue): RecoveryDecision {
    if (!source) {
      return { action: "fail", reason: "No active source." };
    }

    const nextAttempt = (this.attempts.get(source.id) ?? 0) + 1;
    this.attempts.set(source.id, nextAttempt);

    if (nextAttempt > this.maxAttemptsPerSource) {
      return { action: "switch_source", reason: issue.message };
    }

    if (issue.kind === "media" && nextAttempt <= 2) {
      return { action: "recover_media", attempt: nextAttempt };
    }

    return {
      action: "retry_current",
      attempt: nextAttempt,
      delayMs: this.retryBackoffMs[Math.min(nextAttempt - 1, this.retryBackoffMs.length - 1)] ?? 1000,
    };
  }

  reset(sourceId: number): void {
    this.attempts.delete(sourceId);
  }
}
