export type MpegTsProfileName = "stable" | "balanced" | "low_latency";

export const MPEGTS_PROFILES: Record<MpegTsProfileName, Record<string, unknown>> = {
  stable: {
    enableWorker: false,
    lazyLoad: false,
    enableStashBuffer: true,
    stashInitialSize: 1024 * 1024,
    autoCleanupSourceBuffer: true,
    autoCleanupMaxBackwardDuration: 90,
    autoCleanupMinBackwardDuration: 30,
    fixAudioTimestampGap: true,
    liveBufferLatencyChasing: false,
  },
  balanced: {
    enableWorker: true,
    lazyLoad: false,
    enableStashBuffer: true,
    stashInitialSize: 256,
    autoCleanupSourceBuffer: true,
    liveBufferLatencyChasing: true,
  },
  low_latency: {
    enableWorker: true,
    lazyLoad: false,
    enableStashBuffer: true,
    stashInitialSize: 128,
    autoCleanupSourceBuffer: true,
    liveBufferLatencyChasing: true,
  },
};

export const DEFAULT_MPEGTS_PROFILE: MpegTsProfileName = "stable";

export function playbackUrl(source: { playback_url?: string; url: string }): string {
  return source.playback_url ?? source.url;
}
