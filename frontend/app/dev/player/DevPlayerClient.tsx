"use client";

import { PlayerUI } from "@/features/player/PlayerUI";
import type { PlaybackPayload } from "@/lib/types";

const labPayload: PlaybackPayload = {
  match_slug: "dev-player-lab",
  status: "open",
  server_time: "2026-08-14T19:55:00Z",
  kickoff_at: "2026-08-14T20:00:00Z",
  playback_opens_at: "2026-08-14T19:50:00Z",
  playback_closes_at: "2026-08-14T22:00:00Z",
  window: {
    status: "open",
    server_time: "2026-08-14T19:55:00Z",
    kickoff_at: "2026-08-14T20:00:00Z",
    actual_started_at: null,
    opens_at: "2026-08-14T19:50:00Z",
    closes_at: "2026-08-14T22:00:00Z",
    seconds_until_open: 0,
    seconds_until_kickoff: 300,
    seconds_until_close: 7500,
    open_before_minutes: 10,
    duration_minutes: 120,
  },
  is_live_event: true,
  default_source_id: 1,
  policy: {
    max_recovery_attempts_per_source: 2,
    max_source_failures_per_session: 1,
    stall_detection_ms: 3000,
    retry_backoff_ms: [500, 1000],
  },
  sources: [
    {
      id: 1,
      channel_id: 1,
      channel_name: "Broken Main",
      name: "Failure simulation",
      protocol: "hls",
      url: "http://localhost:65534/missing.m3u8",
      priority: 1,
      is_backup: false,
      last_known_status: "unknown",
      health_score: 50,
    },
    {
      id: 2,
      channel_id: 2,
      channel_name: "Backup HLS",
      name: "Mux test stream",
      protocol: "hls",
      url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
      priority: 2,
      is_backup: true,
      last_known_status: "healthy",
      health_score: 96,
    },
    {
      id: 3,
      channel_id: 3,
      channel_name: "MPEG-TS Placeholder",
      name: "Local TS",
      protocol: "mpegts",
      url: "http://localhost:8080/dev/live.ts",
      priority: 3,
      is_backup: true,
      last_known_status: "unknown",
      health_score: 50,
    },
  ],
};

export function DevPlayerClient() {
  return (
    <div className="min-h-screen bg-neutral-950 p-4 text-neutral-100 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-red-300">Development only</p>
          <h1 className="text-2xl font-bold text-white">Player Lab</h1>
        </div>
        <PlayerUI playback={labPayload} title="Development player lab" />
      </div>
    </div>
  );
}
