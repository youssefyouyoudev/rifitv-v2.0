import { describe, expect, it, vi } from "vitest";
import { RecoveryManager } from "../RecoveryManager";
import { SourceManager } from "../SourceManager";
import { PlaybackStateMachine } from "../PlaybackStateMachine";
import { DEFAULT_MPEGTS_PROFILE, MPEGTS_PROFILES } from "../config";
import { reportPlaybackEvent } from "../PlayerUI";
import type { PlaybackSource } from "@/lib/types";

const sources: PlaybackSource[] = [
  { id: 1, channel_id: 1, channel_name: "Main", name: "Broken", protocol: "hls", url: "broken", priority: 1, is_backup: false, last_known_status: "offline" },
  { id: 2, channel_id: 1, channel_name: "Main", name: "Healthy", protocol: "hls", url: "ok", priority: 2, is_backup: true, last_known_status: "healthy" },
  { id: 3, channel_id: 1, channel_name: "TS", name: "Unsupported", protocol: "mpegts", url: "ts", priority: 3, is_backup: true, last_known_status: "healthy" },
  { id: 4, channel_id: 1, channel_name: "Codec", name: "Unsupported codec", protocol: "hls", url: "codec", priority: 0, is_backup: false, last_known_status: "browser_incompatible", browser_compatible: "unsupported_codec" },
];

describe("player core", () => {
  it("allows connectivity loss but prevents impossible state transitions", () => {
    const machine = new PlaybackStateMachine();
    machine.transition("loading");
    machine.transition("ready");
    machine.transition("offline");

    expect(machine.state()).toBe("offline");
    expect(() => machine.transition("idle")).toThrow();
  });

  it("orders compatible healthy sources before unhealthy sources", () => {
    const manager = new SourceManager(sources, new Set(["hls"]), 1);

    expect(manager.orderedSources().map((source) => source.id)).toEqual([2, 1]);
  });

  it("does not bounce forever after source failure", () => {
    const manager = new SourceManager(sources, new Set(["hls"]), 1);
    const first = manager.select();
    const second = first ? manager.nextAfter(first.id) : null;

    expect(first?.id).toBe(2);
    expect(second?.id).toBe(1);
    if (second) {
      manager.markFailed(second.id);
    }
    expect(manager.select()).toBeNull();
  });

  it("allows an explicit retry to rehabilitate a failed source", () => {
    const manager = new SourceManager(sources, new Set(["hls"]), 1);
    manager.markFailed(2);
    expect(manager.select()?.id).toBe(1);

    manager.reset(2);
    expect(manager.select()?.id).toBe(2);
  });

  it("switches source after recovery limits are exhausted", () => {
    const recovery = new RecoveryManager(2, [100, 200]);
    const source = sources[1];

    expect(recovery.decide(source, { kind: "media", fatal: true, message: "fail" }).action).toBe("recover_media");
    expect(recovery.decide(source, { kind: "media", fatal: true, message: "fail" }).action).toBe("recover_media");
    expect(recovery.decide(source, { kind: "media", fatal: true, message: "fail" }).action).toBe("switch_source");
  });

  it("limits network transport failures to one retry before source cooldown", () => {
    const recovery = new RecoveryManager(3, [100, 200], 45_000);
    const source = sources[1];

    expect(recovery.decide(source, { kind: "network", fatal: true, message: "HTTP 502" }).action).toBe("retry_current");
    expect(recovery.decide(source, { kind: "network", fatal: true, message: "HTTP 502" })).toMatchObject({
      action: "switch_source",
      cooldownMs: 45_000,
    });
  });

  it("temporarily cools a failed source instead of retrying it in a storm", () => {
    const manager = new SourceManager(sources, new Set(["hls"]), 1);
    manager.markFailed(2, 45_000);

    expect(manager.select()?.id).toBe(1);
  });

  it("does not retry deterministic playback telemetry errors", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue(new Response("expired", { status: 419 }));
    globalThis.fetch = fetchMock;

    await reportPlaybackEvent("recovery_failed", "match", 1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    globalThis.fetch = originalFetch;
  });

  it("uses a stability-first raw MPEG-TS profile", () => {
    expect(DEFAULT_MPEGTS_PROFILE).toBe("stable");
    expect(MPEGTS_PROFILES.stable.enableWorker).toBe(false);
    expect(MPEGTS_PROFILES.stable.enableStashBuffer).toBe(true);
    expect(MPEGTS_PROFILES.stable.lazyLoad).toBe(false);
    expect(MPEGTS_PROFILES.stable.liveBufferLatencyChasing).toBe(false);
  });
});
