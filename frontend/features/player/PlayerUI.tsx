"use client";

import { Maximize, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import type { PlaybackPayload } from "@/lib/types";
import { PlaybackEngine } from "./PlaybackEngine";
import type { PlaybackState, QualityLevel } from "./types";

export function PlayerUI({ playback, title }: { playback: PlaybackPayload; title: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const engineRef = useRef<PlaybackEngine | null>(null);
  const [state, setState] = useState<PlaybackState>("idle");
  const [message, setMessage] = useState("Connecting...");
  const [activeSourceId, setActiveSourceId] = useState<number | null>(playback.default_source_id);
  const [muted, setMuted] = useState(false);
  const [qualities, setQualities] = useState<QualityLevel[]>([]);
  const [behindLive, setBehindLive] = useState(false);
  const activeSourceRef = useRef<number | null>(playback.default_source_id);
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
        if (event.state === "playing") {
          trackEvent("playback_started", { match_slug: playback.match_slug, source_id: activeSourceRef.current });
          void reportPlaybackEvent("playback_started", playback.match_slug, activeSourceRef.current);
        }
      }
      if (event.type === "source") {
        activeSourceRef.current = event.source?.id ?? null;
        setActiveSourceId(event.source?.id ?? null);
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

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-black">
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          className="h-full w-full bg-black"
          playsInline
          controls={false}
          muted={muted}
          aria-label={title}
        />
        {state !== "playing" ? (
          <div className="absolute inset-0 grid place-items-center bg-black/50 text-center">
            <div className="space-y-3 px-6">
              <div className="mx-auto h-8 w-8 rounded-full border-2 border-white/20 border-t-red-500" aria-hidden="true" />
              <p className="text-sm font-medium text-white">{message}</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-neutral-950 p-3">
        <IconButton
          label={playing ? "Pause" : "Play"}
          onClick={() => (playing ? engineRef.current?.pause() : void engineRef.current?.play())}
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </IconButton>
        <IconButton
          label={muted ? "Unmute" : "Mute"}
          onClick={() => setMuted((value) => !value)}
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </IconButton>
        <span className="inline-flex h-10 items-center rounded-md border border-white/10 px-3 text-sm font-semibold text-red-200">
          LIVE
        </span>
        {behindLive ? (
          <button
            className="h-10 rounded-md bg-red-600 px-3 text-sm font-semibold text-white outline-none hover:bg-red-500 focus-visible:ring-2 focus-visible:ring-red-300"
            onClick={() => engineRef.current?.seekToLiveEdge()}
          >
            Go Live
          </button>
        ) : null}
        <select
          className="h-10 min-w-40 rounded-md border border-white/10 bg-neutral-900 px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-red-300"
          value={activeSourceId ?? ""}
          aria-label="Broadcast source"
          onChange={(event) => void engineRef.current?.selectSource(Number(event.target.value))}
        >
          {playback.sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.channel_name} - {source.name}
            </option>
          ))}
        </select>
        {qualities.length > 0 ? (
          <select
            className="h-10 rounded-md border border-white/10 bg-neutral-900 px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            aria-label="Quality"
            onChange={(event) => engineRef.current?.setQuality(Number(event.target.value))}
          >
            {qualities.map((quality) => (
              <option key={quality.id} value={quality.id}>{quality.label}</option>
            ))}
          </select>
        ) : null}
        <IconButton label="Retry" onClick={() => void engineRef.current?.retry()}>
          <RotateCcw className="h-5 w-5" />
        </IconButton>
        <IconButton label="Fullscreen" onClick={() => void videoRef.current?.requestFullscreen()}>
          <Maximize className="h-5 w-5" />
        </IconButton>
      </div>
    </div>
  );
}

async function reportPlaybackEvent(eventType: string, matchSlug: string, sourceId: number | null): Promise<void> {
  await fetch(`${API_BASE}/playback/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ event_type: eventType, match_slug: matchSlug, source_id: sourceId }),
  }).catch(() => undefined);
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className="grid h-10 w-10 place-items-center rounded-md border border-white/10 bg-neutral-900 text-white outline-none transition hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-red-300"
      aria-label={label}
      title={label}
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
    buffering: "Reconnecting...",
    recovering: "Reconnecting...",
    switching_source: "Switching to backup...",
    offline: "Waiting for network...",
    error: "Broadcast temporarily unavailable",
    ended: "Broadcast ended",
  };

  return labels[state];
}
