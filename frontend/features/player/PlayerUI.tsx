"use client";

import { Maximize, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import type { PlaybackPayload, PlaybackSource } from "@/lib/types";
import { PlaybackEngine } from "./PlaybackEngine";
import type { PlaybackState, QualityLevel } from "./types";

export function PlayerUI({ playback, title }: { playback: PlaybackPayload; title: string }) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const engineRef = useRef<PlaybackEngine | null>(null);
  const activeSourceRef = useRef<number | null>(playback.default_source_id);
  const lastStartedSourceRef = useRef<number | null>(null);
  const [state, setState] = useState<PlaybackState>("idle");
  const [message, setMessage] = useState("Connecting...");
  const [activeSourceId, setActiveSourceId] = useState<number | null>(playback.default_source_id);
  const [muted, setMuted] = useState(true);
  const [qualities, setQualities] = useState<QualityLevel[]>([]);
  const [behindLive, setBehindLive] = useState(false);
  const config = useMemo(() => ({ ...playback.policy, is_live_event: playback.is_live_event }), [playback]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const engine = new PlaybackEngine(video, playback.sources, config);
    engineRef.current = engine;
    const unsubscribe = engine.on((event) => {
      if (event.type === "state") {
        setState(event.state);
        setMessage(event.message ?? stateLabel(event.state));
        if (event.state === "playing" && lastStartedSourceRef.current !== activeSourceRef.current) {
          lastStartedSourceRef.current = activeSourceRef.current;
          trackEvent("playback_started", { match_slug: playback.match_slug, source_id: activeSourceRef.current });
          void reportPlaybackEvent("playback_started", playback.match_slug, activeSourceRef.current);
        }
      }
      if (event.type === "source") {
        activeSourceRef.current = event.source?.id ?? null;
        setActiveSourceId(event.source?.id ?? null);
        setQualities([]);
      }
      if (event.type === "qualities") {
        setQualities(event.qualities);
      }
      if (event.type === "live-drift") {
        setBehindLive(event.behindLive);
      }
      if (event.type === "error") {
        setMessage(event.message);
        trackEvent("playback_failed", { match_slug: playback.match_slug, source_id: activeSourceRef.current });
        void reportPlaybackEvent("recovery_failed", playback.match_slug, activeSourceRef.current);
      }
    });

    void engine.load(playback.default_source_id);

    return () => {
      unsubscribe();
      engine.destroy();
      engineRef.current = null;
    };
  }, [config, playback.default_source_id, playback.match_slug, playback.sources]);

  const playing = state === "playing";
  const transitioning = state === "loading" || state === "recovering" || state === "switching_source";
  const recoverableError = state === "error" || state === "offline";

  function selectSource(source: PlaybackSource): void {
    if (source.id === activeSourceId || transitioning) {
      return;
    }

    activeSourceRef.current = source.id;
    lastStartedSourceRef.current = null;
    trackEvent("channel_switched", { match_slug: playback.match_slug, source_id: source.id });
    void engineRef.current?.selectSource(source.id);
  }

  async function enterFullscreen(): Promise<void> {
    const shell = shellRef.current;
    const video = videoRef.current as IOSVideoElement | null;

    try {
      if (shell?.requestFullscreen) {
        await shell.requestFullscreen();
      } else if (video?.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      } else {
        setMessage("Fullscreen is not available in this browser.");
      }
    } catch {
      setMessage("Fullscreen could not be opened.");
    }
  }

  return (
    <div ref={shellRef} className="rifitv-player-shell overflow-hidden rounded-lg border border-white/10 bg-black" aria-label={`${title} player`}>
      <div className="rifitv-player-stage relative bg-black">
        <video
          ref={videoRef}
          className="h-full w-full bg-black object-contain"
          playsInline
          controls={false}
          muted={muted}
          preload="none"
          aria-label={title}
        />
        {state !== "playing" ? (
          <div className="absolute inset-0 grid place-items-center bg-black/65 text-center" role="status" aria-live="polite">
            <div className="space-y-3 px-6">
              {!recoverableError ? <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-red-500" aria-hidden="true" /> : null}
              <p className="text-sm font-medium text-white">{message}</p>
              {recoverableError ? (
                <button
                  type="button"
                  className="min-h-11 rounded-md bg-red-600 px-4 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                  onClick={() => void engineRef.current?.retry()}
                >
                  Try again
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-white/10 bg-neutral-950 px-3 py-3 sm:px-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase text-neutral-400">Broadcasts</span>
          <span className="inline-flex min-h-8 items-center rounded-md border border-red-400/30 px-2 text-xs font-semibold text-red-200">{playback.is_live_event ? "LIVE" : "OPEN"}</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Available broadcast sources">
          {playback.sources.map((source) => {
            const active = source.id === activeSourceId;
            return (
              <button
                key={source.id}
                type="button"
                className={`min-h-12 min-w-40 shrink-0 rounded-md border px-3 py-2 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-red-300 ${active ? "border-red-400 bg-red-600/20 text-white" : "border-white/10 bg-neutral-900 text-neutral-200 hover:bg-neutral-800"}`}
                aria-pressed={active}
                disabled={transitioning && !active}
                onClick={() => selectSource(source)}
              >
                <span className="block truncate text-sm font-semibold">{source.channel_name}</span>
                <span className="mt-0.5 block truncate text-xs text-neutral-400">{source.quality ?? source.name}{source.is_backup ? " - Backup" : ""}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-h-16 flex-wrap items-center gap-2 border-t border-white/10 bg-neutral-950 p-3 sm:px-4">
        <IconButton label={playing ? "Pause" : "Play"} onClick={() => (playing ? engineRef.current?.pause() : void engineRef.current?.play())}>
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </IconButton>
        <IconButton label={muted ? "Unmute" : "Mute"} onClick={() => setMuted((value) => !value)}>
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </IconButton>
        {behindLive ? (
          <button
            type="button"
            className="min-h-11 rounded-md bg-red-600 px-3 text-sm font-semibold text-white outline-none hover:bg-red-500 focus-visible:ring-2 focus-visible:ring-red-300"
            onClick={() => engineRef.current?.seekToLiveEdge()}
          >
            Go Live
          </button>
        ) : null}
        {qualities.length > 0 ? (
          <select
            className="min-h-11 min-w-28 rounded-md border border-white/10 bg-neutral-900 px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            aria-label="Quality"
            defaultValue={qualities[0]?.id}
            onChange={(event) => engineRef.current?.setQuality(Number(event.target.value))}
          >
            {qualities.map((quality) => (
              <option key={quality.id} value={quality.id}>{quality.label}</option>
            ))}
          </select>
        ) : null}
        <span className="min-w-0 flex-1 truncate px-1 text-xs text-neutral-400" aria-live="polite">{stateLabel(state)}</span>
        <IconButton label="Retry" disabled={transitioning} onClick={() => void engineRef.current?.retry()}>
          <RotateCcw className="h-5 w-5" />
        </IconButton>
        <IconButton label="Fullscreen" onClick={() => void enterFullscreen()}>
          <Maximize className="h-5 w-5" />
        </IconButton>
      </div>
    </div>
  );
}

type IOSVideoElement = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
};

async function reportPlaybackEvent(eventType: string, matchSlug: string, sourceId: number | null): Promise<void> {
  await fetch(`${API_BASE}/playback/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ event_type: eventType, match_slug: matchSlug, source_id: sourceId }),
    keepalive: true,
  }).catch(() => undefined);
}

function IconButton({ label, children, disabled = false, onClick }: { label: string; children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-white/10 bg-neutral-900 text-white outline-none transition hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function stateLabel(state: PlaybackState): string {
  const labels: Record<PlaybackState, string> = {
    idle: "Ready",
    loading: "Connecting...",
    ready: "Ready",
    playing: "Live",
    buffering: "Buffering...",
    recovering: "Reconnecting...",
    switching_source: "Switching broadcast...",
    offline: "Waiting for network...",
    error: "Broadcast temporarily unavailable",
    ended: "Broadcast ended",
  };

  return labels[state];
}
