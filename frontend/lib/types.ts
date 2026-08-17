export type MatchStatus =
  | "scheduled"
  | "live"
  | "halftime"
  | "finished"
  | "postponed"
  | "cancelled";

export type StreamProtocol = "hls" | "mpegts";
export type PlaybackTransport = "direct" | "gateway" | "hls_relay";
export type KickoffPrecision = "confirmed" | "date_only" | "provisional" | "tbc";

export type Team = {
  id: number;
  name: string;
  slug: string;
  short_name: string | null;
  logo_path: string | null;
  country_code: string | null;
  primary_color: string | null;
  aliases?: string[];
};

export type Competition = {
  id: number;
  name: string;
  slug: string;
  short_name: string | null;
  logo_path: string | null;
  country_code: string | null;
  active: boolean;
  sort_order: number;
  matches?: Match[];
};

export type Channel = {
  id: number;
  name: string;
  slug: string;
  logo_path: string | null;
  active: boolean;
  sort_order: number;
};

export type Match = {
  id: number;
  slug: string;
  competition: Competition;
  home_team: Team;
  away_team: Team;
  kickoff_at: string | null;
  actual_started_at: string | null;
  playback_open_override_at: string | null;
  playback_close_override_at: string | null;
  scheduled_date: string | null;
  kickoff_precision: KickoffPrecision;
  source_timezone: string | null;
  source_matchday: number | null;
  source_round_label: string | null;
  verification_status?: string;
  status: MatchStatus;
  status_label?: string;
  status_rank?: number;
  home_score: number | null;
  away_score: number | null;
  minute: number | null;
  featured: boolean;
  channels: Channel[];
  channels_count?: number;
  broadcasts: Array<{
    id: number;
    territory: string;
    assignment_status: string;
    languages: string[] | null;
    broadcaster: { id: number | null; name: string | null; slug: string | null; territory: string | null };
    channel: Channel | null;
  }>;
  playback_window: PlaybackWindow;
  stream_available_from?: string | null;
  stream_closes_at?: string | null;
  admin?: {
    verification_label: string;
    stream_summary: {
      channels: number;
      sources: number;
      enabled_sources: number;
      healthy_sources: number;
    };
    warnings: string[];
  };
  updated_at?: string | null;
};

export type PlaybackSource = {
  id: number;
  channel_id: number;
  channel_name: string;
  name: string;
  protocol: StreamProtocol;
  transport?: PlaybackTransport;
  playback_url?: string;
  url: string;
  quality?: string | null;
  browser_compatible?: "compatible" | "likely_compatible" | "unsupported_codec" | "unknown" | null;
  priority: number;
  is_backup: boolean;
  last_known_status: "healthy" | "degraded" | "offline" | "unknown" | "checking" | "browser_incompatible" | "disabled" | null;
  health_score?: number | null;
  relay?: {
    status: string;
    segment_count: number;
    last_segment_at: string | null;
  };
};

export type PlaybackPolicy = {
  max_recovery_attempts_per_source: number;
  max_source_failures_per_session: number;
  stall_detection_ms: number;
  retry_backoff_ms: number[];
};

export type PlaybackPayload = {
  match_slug: string;
  status: PlaybackAccessStatus;
  window: PlaybackWindow;
  server_time: string;
  kickoff_at: string | null;
  playback_opens_at: string | null;
  playback_closes_at: string | null;
  is_live_event: boolean;
  default_source_id: number | null;
  sources: PlaybackSource[];
  policy: PlaybackPolicy;
};

export type PlaybackAccessStatus = "tbc" | "locked" | "opening_soon" | "open" | "ended" | "unavailable";

export type PlaybackWindow = {
  status: PlaybackAccessStatus;
  server_time: string;
  kickoff_at: string | null;
  actual_started_at: string | null;
  opens_at: string | null;
  closes_at: string | null;
  seconds_until_open: number | null;
  seconds_until_kickoff: number | null;
  seconds_until_close: number | null;
  open_before_minutes: number;
  duration_minutes: number;
};

export type HomePayload = {
  server_time: string;
  date: string;
  date_label: string;
  timezone: string;
  live_count: number;
  today_count: number;
  matches: Match[];
  next_match: Match | null;
  announcements: Array<{
    id: number;
    title: string;
    message: string;
    type: "info" | "warning" | "maintenance";
    active: boolean;
  }>;
  competitions: Competition[];
};

export type TeamPayload = {
  team: Team;
  live: Match[];
  upcoming: Match[];
  recent_results: Match[];
};

export type SearchPayload = {
  teams: Team[];
  matches: Match[];
  competitions: Competition[];
};
