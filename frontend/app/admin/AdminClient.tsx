"use client";

import {
  Activity,
  Bell,
  Cable,
  CalendarDays,
  Check,
  ClipboardList,
  Gauge,
  Home,
  ListVideo,
  Lock,
  Menu,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Save,
  Search,
  ServerCog,
  Settings,
  Shield,
  Square,
  Trophy,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RiFiTVLogo } from "@/components/RiFiTVLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { apiFetch, ApiError, csrfCookie } from "@/lib/api";
import { addDays, adminDateFormatter, adminTimeFormatter, localDateKey, localDateTimeInput, localTodayDate } from "@/lib/footballDate";

type ApiList<T> = { data: T[]; admin_meta?: AdminMatchMeta; meta?: { current_page?: number; last_page?: number; total?: number; per_page?: number } };
type ApiOne<T> = { data: T };
type Entity = Record<string, unknown> & { id: number; name?: string; title?: string; slug?: string };
type Match = Entity & {
  home_team: Entity;
  away_team: Entity;
  competition: Entity;
  status: string;
  status_label?: string;
  status_rank?: number;
  home_score: number | null;
  away_score: number | null;
  minute: number | null;
  featured: boolean;
  published_at: string | null;
  kickoff_at: string | null;
  scheduled_date?: string | null;
  kickoff_precision?: string;
  verification_status?: string;
  channels?: Entity[];
  channels_count?: number;
  playback_window?: PlaybackWindow;
  stream_available_from?: string | null;
  stream_closes_at?: string | null;
  admin?: {
    verification_label: string;
    stream_summary: { channels: number; sources: number; enabled_sources: number; healthy_sources: number };
    warnings: string[];
  };
};
type PlaybackWindow = {
  status: string;
  server_time: string;
  opens_at: string | null;
  closes_at: string | null;
  seconds_until_open: number | null;
  seconds_until_close: number | null;
};
type ControlChannel = Entity & {
  role: "main" | "backup";
  sort_order: number;
  playlist_group?: string | null;
  quality_label?: string | null;
  health: { sources: number; enabled: number; healthy: number; offline: number };
  stream_sources: Array<Entity & { protocol: string; enabled: boolean; is_backup: boolean; last_known_status: string | null; masked_url: string; health_score?: number | null }>;
};
type MatchControl = {
  match: Match;
  playback_window: PlaybackWindow;
  assigned_channels: ControlChannel[];
  stream_summary: { channels: number; sources: number; enabled_sources: number; healthy_sources: number; offline_sources: number };
  actions: { statuses: string[]; playback: string[] };
};
type AdminMatchMeta = {
  timezone: string;
  statuses: Array<{ value: string; label: string; rank: number }>;
  counters: Record<"today" | "live" | "upcoming" | "finished" | "needs_channel" | "needs_verification" | "featured", number>;
  attention: Match[];
};
type Playlist = Entity & {
  type: string;
  status: string;
  source_url: string | null;
  server_url: string | null;
  has_credentials: boolean;
  active: boolean;
  auto_sync: boolean;
  sync_interval_minutes: number;
  channel_count: number;
  group_count: number;
  last_sync_at: string | null;
  last_successful_sync_at: string | null;
  last_error_category: string | null;
  last_error_message: string | null;
  latest_sync_run?: Entity & { status: string; phase: string | null; imported_count: number; updated_count: number; failed_count: number; safe_message: string | null };
};
type PlaylistTestResult = {
  connected: boolean;
  valid_m3u: boolean;
  channel_count: number;
  group_count: number;
  groups: string[];
  samples: Array<{ channel: string; protocol: string; transport: string; browser_compatible: string }>;
};
type Dashboard = {
  counts: Record<string, number>;
  live_now: Match[];
  attention: { alerts?: Alert[]; stream_problems: Entity[]; unassigned_matches: Match[] };
  operations?: { scheduler_last_seen_at: string | null; last_fixture_sync: SyncRun | null; last_result_sync: SyncRun | null };
};
type Readiness = { state: "ready" | "warning" | "critical"; published: boolean; channels: number; healthy_source: boolean; source_count: number };
type TodayOps = {
  live: Match[];
  starting_soon: Match[];
  later_today: Match[];
  finished: Match[];
  readiness: Record<string, Readiness>;
};
type Alert = Entity & { type: string; severity: string; status: string; message: string | null; created_at: string | null; resolved_at: string | null };
type SyncRun = Entity & { type: string; provider: string | null; status: string; started_at: string | null; finished_at: string | null; created_count: number; updated_count: number; ignored_count: number; failed_count: number; error_summary: string | null };
type FixtureImport = Entity & { provider: string; external_id: string | null; home_name: string | null; away_name: string | null; competition_name: string | null; status: string; message: string | null; created_at: string | null };
type QueueHealth = {
  scheduler_last_seen_at: string | null;
  failed_jobs: number;
  pending_jobs: number;
  last_fixture_sync: SyncRun | null;
  last_result_sync: SyncRun | null;
  last_stream_check: string | null;
};
type DetailedHealth = Record<string, { status: "healthy" | "critical" | "warning"; [key: string]: unknown }>;

const sections = [
  { key: "dashboard", label: "Dashboard", group: "Dashboard", icon: Gauge, href: "/admin" },
  { key: "today", label: "Today", group: "Dashboard", icon: CalendarDays, href: "/admin/today" },
  { key: "upcoming", label: "Upcoming", group: "Dashboard", icon: CalendarDays, href: "/admin/upcoming" },
  { key: "matches", label: "Matches", group: "Football", icon: CalendarDays, href: "/admin/matches" },
  { key: "match-control", label: "Match Control", group: "Football", icon: Activity, href: "/admin/matches/control" },
  { key: "live", label: "Live Control", group: "Football", icon: Activity, href: "/admin/matches/live" },
  { key: "teams", label: "Teams", group: "Football", icon: Users, href: "/admin/teams" },
  { key: "competitions", label: "Competitions", group: "Football", icon: Trophy, href: "/admin/competitions" },
  { key: "homepage", label: "Homepage", group: "Content", icon: Home, href: "/admin/homepage" },
  { key: "announcements", label: "Announcements", group: "Content", icon: Bell, href: "/admin/announcements" },
  { key: "channels", label: "Channels", group: "Streaming", icon: Radio, href: "/admin/channels" },
  { key: "playlists", label: "Playlists", group: "Streaming", icon: ListVideo, href: "/admin/playlists" },
  { key: "sources", label: "Sources", group: "Streaming", icon: Cable, href: "/admin/stream-sources" },
  { key: "stream-health", label: "Stream Health", group: "Streaming", icon: Activity, href: "/admin/stream-health" },
  { key: "imports", label: "Imports", group: "Automation", icon: ClipboardList, href: "/admin/imports" },
  { key: "operations", label: "Operations", group: "Automation", icon: ServerCog, href: "/admin/system" },
  { key: "users", label: "Users", group: "System", icon: Shield, href: "/admin/users" },
  { key: "settings", label: "Settings", group: "System", icon: Settings, href: "/admin/settings" },
  { key: "audit", label: "Audit Log", group: "System", icon: ClipboardList, href: "/admin/audit-log" },
];

export function AdminClient({ initialSection = "dashboard" }: { initialSection?: string }) {
  const initialRoute = parseAdminSection(initialSection);
  const pathname = usePathname();
  const router = useRouter();
  const currentRoute = useMemo(() => parseAdminSection(pathname.replace(/^\/admin\/?/, "") || "dashboard"), [pathname]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authStatus, setAuthStatus] = useState<"checking" | "guest" | "authenticated" | "forbidden">("checking");
  const [activeOverride, setActiveOverride] = useState<string | null>(null);
  const [controlMatchId, setControlMatchId] = useState<number | null>(initialRoute.matchId);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Entity[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Entity[]>([]);
  const [competitions, setCompetitions] = useState<Entity[]>([]);
  const [channels, setChannels] = useState<Entity[]>([]);
  const [sources, setSources] = useState<Entity[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [matchControl, setMatchControl] = useState<MatchControl | null>(null);
  const [audit, setAudit] = useState<Entity[]>([]);
  const [today, setToday] = useState<TodayOps | null>(null);
  const [streamHealth, setStreamHealth] = useState<Entity[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [fixtureImports, setFixtureImports] = useState<FixtureImport[]>([]);
  const [queueHealth, setQueueHealth] = useState<QueueHealth | null>(null);
  const [detailedHealth, setDetailedHealth] = useState<DetailedHealth | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = activeOverride ?? currentRoute.active;
  const selectedControlMatchId = currentRoute.matchId ?? controlMatchId;

  function setActive(key: string) {
    setActiveOverride(key);
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        await adminGet<ApiOne<unknown>>("/auth/user");
        if (!mounted) return;
        setAuthStatus("authenticated");
      } catch (caught) {
        if (!mounted) return;
        if (caught instanceof ApiError && caught.status === 401) {
          setAuthStatus("guest");
          return;
        }
        if (caught instanceof ApiError && caught.status === 403) {
          setAuthStatus("forbidden");
          return;
        }
        setError(caught instanceof Error ? caught.message : "Unable to verify the admin session.");
        setAuthStatus("guest");
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
    // Bootstrap intentionally runs once; route changes reuse the same session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      return;
    }

    let mounted = true;

    loadActive().catch((caught) => {
      if (!mounted) return;
      handleApiFailure(caught);
    });

    return () => {
      mounted = false;
    };
    // loadActive intentionally uses current session state and active route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, active]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated" || searchQuery.length < 2) {
      return;
    }
    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      try {
        const payload = await adminGet<ApiList<Entity>>(`/admin/search?q=${encodeURIComponent(searchQuery)}`, controller.signal);
        setSearchResults(payload.data);
      } catch (caught) {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          setSearchResults([]);
          handleApiFailure(caught);
        }
      }
    }, 400);
    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [searchQuery, authStatus]);

  useEffect(() => {
    if (authStatus !== "authenticated" || active !== "match-control" || !selectedControlMatchId) {
      return;
    }
    void loadControl(selectedControlMatchId).catch(handleApiFailure);
    // loadControl intentionally uses current session state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, selectedControlMatchId, authStatus]);

  async function login() {
    setError(null);
    try {
      await csrfCookie();
      await adminSend("/auth/login", "POST", { email, password });
      await adminGet<ApiOne<unknown>>("/auth/user");
      setAuthStatus("authenticated");
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  async function logout() {
    await adminSend("/auth/logout", "POST").catch(() => undefined);
    setAuthStatus("guest");
    router.replace("/admin");
  }

  const syncAuthFromError = useCallback((caught: unknown) => {
    if (caught instanceof ApiError && caught.status === 401) {
      setAuthStatus("guest");
    }
    if (caught instanceof ApiError && caught.status === 403) {
      setAuthStatus("forbidden");
    }
  }, []);

  const adminGet = useCallback(async <T,>(path: string, signal?: AbortSignal): Promise<T> => {
    try {
      return await apiFetch<T>(path, { signal });
    } catch (caught) {
      syncAuthFromError(caught);
      throw caught;
    }
  }, [syncAuthFromError]);

  const adminSend = useCallback(async <T,>(path: string, method: string, body?: unknown): Promise<T> => {
    let csrfRetried = false;

    while (true) {
      try {
        return await apiFetch<T>(path, {
          method,
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 419 && !csrfRetried) {
          csrfRetried = true;
          await csrfCookie();
          continue;
        }
        syncAuthFromError(caught);
        throw caught;
      }
    }
  }, [syncAuthFromError]);

  const adminUpload = useCallback(async <T,>(path: string, body: FormData): Promise<T> => {
    let csrfRetried = false;

    while (true) {
      try {
        return await apiFetch<T>(path, { method: "POST", body });
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 419 && !csrfRetried) {
          csrfRetried = true;
          await csrfCookie();
          continue;
        }
        syncAuthFromError(caught);
        throw caught;
      }
    }
  }, [syncAuthFromError]);

  async function loadActive() {
    switch (active) {
      case "dashboard": {
        setDashboard((await adminGet<ApiOne<Dashboard>>("/admin/dashboard")).data);
        return;
      }
      case "today":
      case "upcoming": {
        setToday((await adminGet<ApiOne<TodayOps>>("/admin/today")).data);
        return;
      }
      case "matches": {
        const [matchList, teamList, competitionList, channelList] = await Promise.all([
          adminGet<ApiList<Match>>("/admin/matches?per_page=50"),
          adminGet<ApiList<Entity>>("/admin/teams?per_page=100"),
          adminGet<ApiList<Entity>>("/admin/competitions?per_page=100"),
          adminGet<ApiList<Entity>>("/admin/channels?per_page=100"),
        ]);
        setMatches(matchList.data);
        setTeams(teamList.data);
        setCompetitions(competitionList.data);
        setChannels(channelList.data);
        return;
      }
      case "match-control":
      case "live": {
        const [matchList, channelList] = await Promise.all([
          adminGet<ApiList<Match>>("/admin/matches?per_page=50"),
          adminGet<ApiList<Entity>>("/admin/channels?per_page=100"),
        ]);
        setMatches(matchList.data);
        setChannels(channelList.data);
        return;
      }
      case "teams": {
        setTeams((await adminGet<ApiList<Entity>>("/admin/teams?per_page=100")).data);
        return;
      }
      case "competitions": {
        const [competitionList, teamList] = await Promise.all([
          adminGet<ApiList<Entity>>("/admin/competitions?per_page=100"),
          adminGet<ApiList<Entity>>("/admin/teams?per_page=100"),
        ]);
        setCompetitions(competitionList.data);
        setTeams(teamList.data);
        return;
      }
      case "channels": {
        setChannels((await adminGet<ApiList<Entity>>("/admin/channels?per_page=100")).data);
        return;
      }
      case "playlists": {
        setPlaylists((await adminGet<ApiList<Playlist>>("/admin/playlists?per_page=100")).data);
        return;
      }
      case "sources": {
        const [sourceList, channelList] = await Promise.all([
          adminGet<ApiList<Entity>>("/admin/stream-sources?per_page=100"),
          adminGet<ApiList<Entity>>("/admin/channels?per_page=100"),
        ]);
        setSources(sourceList.data);
        setChannels(channelList.data);
        return;
      }
      case "stream-health": {
        setStreamHealth((await adminGet<ApiList<Entity>>("/admin/stream-health?per_page=100")).data);
        return;
      }
      case "imports": {
        const [importList, runList] = await Promise.all([
          adminGet<ApiList<FixtureImport>>("/admin/imports/fixtures"),
          adminGet<ApiList<SyncRun>>("/admin/sync-runs"),
        ]);
        setFixtureImports(importList.data);
        setSyncRuns(runList.data);
        return;
      }
      case "operations": {
        const [alertList, runList, queue, appHealth] = await Promise.all([
          adminGet<ApiList<Alert>>("/admin/alerts"),
          adminGet<ApiList<SyncRun>>("/admin/sync-runs"),
          adminGet<ApiOne<QueueHealth>>("/admin/queue-health"),
          adminGet<ApiOne<DetailedHealth>>("/admin/health"),
        ]);
        setAlerts(alertList.data);
        setSyncRuns(runList.data);
        setQueueHealth(queue.data);
        setDetailedHealth(appHealth.data);
        return;
      }
      case "homepage": {
        const [matchList, competitionList] = await Promise.all([
          adminGet<ApiList<Match>>("/admin/matches?per_page=50"),
          adminGet<ApiList<Entity>>("/admin/competitions?per_page=100"),
        ]);
        setMatches(matchList.data);
        setCompetitions(competitionList.data);
        return;
      }
      case "audit": {
        setAudit((await adminGet<ApiList<Entity>>("/admin/audit-logs?per_page=50")).data);
        return;
      }
      default:
        return;
    }
  }

  async function loadControl(matchId: number) {
    const payload = await adminGet<ApiOne<MatchControl>>(`/admin/matches/${matchId}/control`);
    setMatchControl(payload.data);
  }

  function handleApiFailure(caught: unknown) {
    const message = apiErrorMessage(caught);

    setError(message);
    syncAuthFromError(caught);
  }

  async function run(action: () => Promise<void>, success: string) {
    try {
      setError(null);
      await action();
      setNotice(success);
      await loadActive();
    } catch (caught) {
      handleApiFailure(caught);
    }
  }

  if (authStatus === "checking") {
    return <AdminLoadingShell />;
  }

  if (authStatus === "guest") {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--background)] p-4 text-[var(--foreground)]">
        <section className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-[var(--surface-muted)] text-[var(--brand-blue)]"><Lock className="h-5 w-5" /></div>
            <div>
              <h1 className="sr-only">Admin Login</h1>
              <RiFiTVLogo />
              <p className="text-sm text-[var(--muted)]">Manage RiFiTV without SSH or database edits.</p>
            </div>
          </div>
          <Input label="Email" type="email" autoComplete="username" value={email} onChange={setEmail} />
          <Input label="Password" type="password" autoComplete="current-password" value={password} onChange={setPassword} />
          {error ? <p className="mb-3 text-sm text-red-300">{error}</p> : null}
          <button className="h-11 rounded-md bg-[var(--brand-blue)] px-4 font-semibold text-white outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" onClick={() => void login()}>
            Sign in
          </button>
        </section>
      </div>
    );
  }

  if (authStatus === "forbidden") {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--background)] p-4 text-[var(--foreground)]">
        <section className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-[var(--surface-muted)] text-red-300"><Shield className="h-5 w-5" /></div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--foreground)]">Admin Access Required</h1>
              <p className="text-sm text-[var(--muted)]">{error ?? "Your account is signed in but is not allowed to manage RiFiTV."}</p>
            </div>
          </div>
          <button className="h-11 rounded-md border border-[var(--border)] px-4 font-semibold text-[var(--foreground)]" onClick={() => void logout()}>
            Sign out
          </button>
        </section>
      </div>
    );
  }

  const grouped = groupBy(sections, "group");

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--background)] px-4 lg:hidden">
        <button className="grid h-10 w-10 place-items-center rounded-md border border-[var(--border)]" onClick={() => setDrawerOpen(true)} aria-label="Open admin navigation"><Menu className="h-5 w-5" /></button>
        <RiFiTVLogo />
        <div className="ml-auto"><ThemeToggle /></div>
      </header>
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className={`${drawerOpen ? "fixed inset-0 z-50 block bg-[var(--background)] p-4" : "hidden"} border-[var(--border)] bg-[var(--surface)] lg:static lg:block lg:border-r lg:p-4`}>
          <div className="mb-6 flex items-center justify-between">
            <RiFiTVLogo />
            <div className="hidden lg:block"><ThemeToggle /></div>
            <button className="grid h-10 w-10 place-items-center rounded-md border border-[var(--border)] lg:hidden" onClick={() => setDrawerOpen(false)} aria-label="Close admin navigation"><X className="h-5 w-5" /></button>
          </div>
          <button className="mb-4 flex h-11 w-full items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 text-left text-sm text-[var(--muted)]" onClick={() => setSearchOpen(true)}>
            <Search className="h-4 w-4" /> Search admin...
          </button>
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="mb-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-normal text-[var(--muted)]">{group}</p>
              <nav className="grid gap-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  const href = item.key === "match-control" && selectedControlMatchId ? `/admin/matches/${selectedControlMatchId}/control` : item.href;
                  return (
                    <Link
                      key={item.key}
                      href={href}
                      className={`flex h-11 items-center gap-3 rounded-md px-3 text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${active === item.key ? "bg-[var(--brand-blue)] text-white" : "text-[var(--muted)] hover:bg-[var(--surface-muted)]"}`}
                      prefetch={item.group !== "Streaming"}
                      onClick={() => { setActiveOverride(null); setDrawerOpen(false); }}
                    >
                      <Icon className="h-4 w-4" /> {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </aside>
        <main className="min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-[var(--foreground)]">{sections.find((item) => item.key === active)?.label ?? "Dashboard"}</h1>
              <p className="text-sm text-[var(--muted)]">Daily football operation: add game, assign broadcast, publish, update score.</p>
            </div>
            <div className="flex gap-2">
              <button className="h-10 rounded-md border border-[var(--border)] px-3 text-sm text-[var(--foreground)]" onClick={() => void loadActive().catch(handleApiFailure)}><RotateCcw className="mr-2 inline h-4 w-4" />Refresh</button>
              <button className="h-10 rounded-md border border-[var(--border)] px-3 text-sm text-[var(--foreground)]" onClick={() => void logout()}>Logout</button>
            </div>
          </div>
          {notice ? <Toast tone="success" message={notice} onClose={() => setNotice(null)} /> : null}
          {error ? <Toast tone="error" message={error} onClose={() => setError(null)} /> : null}
          {active === "dashboard" ? <DashboardView dashboard={dashboard} setActive={setActive} /> : null}
          {active === "today" || active === "upcoming" ? <TodayOperationsView today={today} setActive={setActive} /> : null}
          {active === "matches" ? <MatchManager matches={matches} teams={teams} competitions={competitions} channels={channels} run={run} adminGet={adminGet} adminSend={adminSend} openControl={(matchId) => { setActiveOverride(null); setControlMatchId(matchId); router.push(`/admin/matches/${matchId}/control`); }} /> : null}
          {active === "match-control" ? <MatchControlCenter matches={matches} channels={channels} control={matchControl} selectedId={selectedControlMatchId} onSelectMatch={setControlMatchId} loadControl={loadControl} run={run} adminSend={adminSend} /> : null}
          {active === "live" ? <LiveControl matches={matches} run={run} adminSend={adminSend} /> : null}
          {active === "teams" ? <SimpleManager title="Teams" endpoint="/admin/teams" items={teams} fields={["name", "short_name", "country_code", "primary_color"]} toggles={["active", "featured"]} run={run} adminSend={adminSend} /> : null}
          {active === "competitions" ? <CompetitionManager competitions={competitions} teams={teams} run={run} adminSend={adminSend} /> : null}
          {active === "channels" ? <ChannelCatalog channels={channels} run={run} adminSend={adminSend} /> : null}
          {active === "playlists" ? <PlaylistManager playlists={playlists} run={run} adminSend={adminSend} adminUpload={adminUpload} /> : null}
          {active === "sources" ? <SourceManager sources={sources} channels={channels} run={run} adminSend={adminSend} /> : null}
          {active === "stream-health" ? <StreamHealthView sources={streamHealth} run={run} adminSend={adminSend} /> : null}
          {active === "imports" ? <ImportReviewView imports={fixtureImports} syncRuns={syncRuns} run={run} adminSend={adminSend} /> : null}
          {active === "operations" ? <OperationsView alerts={alerts} queueHealth={queueHealth} detailedHealth={detailedHealth} syncRuns={syncRuns} run={run} adminSend={adminSend} /> : null}
          {active === "homepage" ? <HomepageManager competitions={competitions} matches={matches} run={run} adminSend={adminSend} /> : null}
          {active === "announcements" ? <AnnouncementManager run={run} adminSend={adminSend} /> : null}
          {active === "users" ? <UserManager run={run} adminSend={adminSend} /> : null}
          {active === "settings" ? <SettingsManager run={run} adminSend={adminSend} /> : null}
          {active === "audit" ? <AuditLog items={audit} /> : null}
        </main>
      </div>
      {searchOpen ? (
        <div className="fixed inset-0 z-50 bg-black/70 p-4" role="dialog" aria-modal="true">
          <div className="mx-auto mt-16 max-w-xl rounded-lg border border-white/10 bg-neutral-900 p-4">
            <Input label="Search admin" value={searchQuery} onChange={(value) => { setSearchQuery(value); if (value.length < 2) setSearchResults([]); }} autoFocus />
            <div className="mt-3 grid gap-2">
              {searchResults.map((result) => (
                <button key={`${result.type}-${result.id}`} className="rounded-md bg-black/30 p-3 text-left" onClick={() => { setActiveOverride(null); setSearchOpen(false); router.push(String(result.href ?? "/admin/matches")); }}>
                  <span className="text-sm text-neutral-400">{String(result.type)}</span>
                  <strong className="block text-white">{String(result.label)}</strong>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AdminLoadingShell() {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--background)] p-4 text-[var(--foreground)]">
      <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
        <RiFiTVLogo />
        <div className="mt-5 space-y-3">
          <div className="h-4 w-40 rounded-md bg-[var(--surface-muted)]" />
          <div className="h-11 rounded-md bg-[var(--surface-muted)]" />
          <div className="h-11 rounded-md bg-[var(--surface-muted)]" />
        </div>
      </div>
    </div>
  );
}

function DashboardView({ dashboard, setActive }: { dashboard: Dashboard | null; setActive: (key: string) => void }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {Object.entries(dashboard?.counts ?? {}).slice(0, 6).map(([key, value]) => <Stat key={key} label={key.replaceAll("_", " ")} value={value} />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Live Now" action={<button onClick={() => setActive("live")} className="text-sm text-red-300">Control</button>}>
          <MatchRows matches={dashboard?.live_now ?? []} />
        </Panel>
        <Panel title="Attention">
          <div className="space-y-2">
            {(dashboard?.attention.alerts ?? []).map((alert) => <CardLine key={`a-${alert.id}`} title={alert.title ?? alert.type} meta={`${alert.severity} alert`} />)}
            {(dashboard?.attention.stream_problems ?? []).map((source) => <CardLine key={`s-${source.id}`} title={String(source.name)} meta="Stream source needs review" />)}
            {(dashboard?.attention.unassigned_matches ?? []).map((match) => <CardLine key={`m-${match.id}`} title={`${match.home_team.name} vs ${match.away_team.name}`} meta="No channel assigned" />)}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function TodayOperationsView({ today, setActive }: { today: TodayOps | null; setActive: (key: string) => void }) {
  const readiness = today?.readiness ?? {};
  const allMatches = [...(today?.live ?? []), ...(today?.starting_soon ?? []), ...(today?.later_today ?? []), ...(today?.finished ?? [])];
  const ready = allMatches.filter((match) => readiness[String(match.id)]?.state === "ready").length;
  const warning = allMatches.filter((match) => readiness[String(match.id)]?.state === "warning").length;
  const critical = allMatches.filter((match) => readiness[String(match.id)]?.state === "critical").length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="ready" value={ready} />
        <Stat label="warning" value={warning} />
        <Stat label="critical" value={critical} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Live & Starting Soon" action={<button onClick={() => setActive("live")} className="text-sm text-red-300">Live Control</button>}>
          <ReadinessRows matches={[...(today?.live ?? []), ...(today?.starting_soon ?? [])]} readiness={readiness} />
        </Panel>
        <Panel title="Later Today">
          <ReadinessRows matches={today?.later_today ?? []} readiness={readiness} />
        </Panel>
      </div>
      <Panel title="Finished">
        <ReadinessRows matches={today?.finished ?? []} readiness={readiness} />
      </Panel>
    </div>
  );
}

function StreamHealthView({ sources, run, adminSend }: ManagerProps & { sources: Entity[] }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="healthy" value={sources.filter((source) => source.last_known_status === "healthy").length} />
        <Stat label="degraded" value={sources.filter((source) => source.last_known_status === "degraded").length} />
        <Stat label="offline" value={sources.filter((source) => source.last_known_status === "offline").length} />
        <Stat label="unknown" value={sources.filter((source) => !source.last_known_status || source.last_known_status === "unknown").length} />
      </div>
      <Panel title="Stream Sources" action={<button className="text-sm text-red-300" onClick={() => run(async () => { await adminSend("/admin/operations/run", "POST", { action: "check_streams" }); }, "Stream health check queued")}>Check all</button>}>
        <div className="grid gap-2">
          {sources.map((source) => (
            <CardLine
              key={source.id}
              title={`${source.name} - ${source.protocol}`}
              meta={`${source.last_known_status ?? "unknown"} | score ${source.health_score ?? "-"} | latency ${source.latency_ms ?? "-"}ms | ${source.last_error_type ?? "no error"}`}
              action={<button className="text-sm text-red-300" onClick={() => run(async () => { await adminSend(`/admin/stream-sources/${source.id}/test`, "POST"); }, "Source tested")}>Test</button>}
            />
          ))}
        </div>
      </Panel>
    </div>
  );
}

function ImportReviewView({ imports, syncRuns, run, adminSend }: ManagerProps & { imports: FixtureImport[]; syncRuns: SyncRun[] }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
      <Panel title="Fixture Import Review" action={<button className="text-sm text-red-300" onClick={() => run(async () => { await adminSend("/admin/operations/run", "POST", { action: "sync_fixtures" }); }, "Fixture sync queued")}>Sync</button>}>
        <div className="grid gap-2">
          {imports.map((item) => <CardLine key={item.id} title={`${item.home_name ?? "Unknown"} vs ${item.away_name ?? "Unknown"}`} meta={`${item.status} | ${item.competition_name ?? item.provider} | ${item.message ?? ""}`} />)}
          {imports.length === 0 ? <Empty message="No import decisions logged yet." /> : null}
        </div>
      </Panel>
      <Panel title="Recent Sync Runs">
        <SyncRunRows syncRuns={syncRuns.filter((item) => item.type === "fixtures").slice(0, 8)} />
      </Panel>
    </div>
  );
}

function OperationsView({ alerts, queueHealth, detailedHealth, syncRuns, run, adminSend }: ManagerProps & { alerts: Alert[]; queueHealth: QueueHealth | null; detailedHealth: DetailedHealth | null; syncRuns: SyncRun[] }) {
  const actions = [
    ["sync_fixtures", "Sync Fixtures"],
    ["sync_results", "Sync Results"],
    ["check_streams", "Check Streams"],
    ["refresh_homepage", "Refresh Home"],
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="pending jobs" value={queueHealth?.pending_jobs ?? 0} />
        <Stat label="failed jobs" value={queueHealth?.failed_jobs ?? 0} />
        <Stat label="open alerts" value={alerts.length} />
        <Stat label="sync runs" value={syncRuns.length} />
      </div>
      <Panel title="Manual Operations">
        <div className="grid gap-2 sm:grid-cols-4">
          {actions.map(([action, label]) => (
            <button key={action} className="h-11 rounded-md bg-red-600 px-3 text-sm font-semibold text-white" onClick={() => run(async () => { await adminSend("/admin/operations/run", "POST", { action }); }, `${label} queued`)}>
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-2 text-sm text-neutral-400 md:grid-cols-3">
          <span>Scheduler: {queueHealth?.scheduler_last_seen_at ?? "not seen"}</span>
          <span>Last stream check: {queueHealth?.last_stream_check ?? "none"}</span>
          <span>Last fixture sync: {queueHealth?.last_fixture_sync?.status ?? "none"}</span>
        </div>
      </Panel>
      <Panel title="System Health">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(detailedHealth ?? {}).map(([name, item]) => (
            <div key={name} className="rounded-md border border-white/10 bg-black/20 p-3">
              <span className="block text-sm capitalize text-neutral-400">{name.replaceAll("_", " ")}</span>
              <strong className={`mt-1 block text-sm uppercase ${item.status === "healthy" ? "text-green-300" : "text-red-300"}`}>{item.status}</strong>
            </div>
          ))}
        </div>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Open Alerts">
          <div className="grid gap-2">
            {alerts.map((alert) => <CardLine key={alert.id} title={alert.title ?? alert.type} meta={`${alert.severity} | ${alert.message ?? ""}`} />)}
            {alerts.length === 0 ? <Empty message="No open operational alerts." /> : null}
          </div>
        </Panel>
        <Panel title="Sync Runs">
          <SyncRunRows syncRuns={syncRuns.slice(0, 10)} />
        </Panel>
      </div>
    </div>
  );
}

function MatchManager({ matches, teams, competitions, channels, run, adminGet, adminSend, openControl }: ManagerProps & { adminGet: <T>(path: string, signal?: AbortSignal) => Promise<T>; matches: Match[]; teams: Entity[]; competitions: Entity[]; channels: Entity[]; openControl: (matchId: number) => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Match[]>(matches);
  const [meta, setMeta] = useState<AdminMatchMeta | null>(null);
  const [page, setPage] = useState({ current_page: 1, last_page: 1, total: matches.length, per_page: 50 });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [assignMatch, setAssignMatch] = useState<Match | null>(null);
  const [channelSearch, setChannelSearch] = useState("");
  const [selectedChannelIds, setSelectedChannelIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState("verify");
  const [bulkCompetition, setBulkCompetition] = useState("");
  const [bulkStatus, setBulkStatus] = useState("scheduled");
  const [filters, setFilters] = useState(() => ({
    date: searchParams.get("date") ?? localTodayDate(),
    competition_id: searchParams.get("competition_id") ?? "",
    team_id: searchParams.get("team_id") ?? "",
    status: searchParams.get("status") ?? "",
    featured: searchParams.get("featured") ?? "",
    channel: searchParams.get("channel") ?? "",
    verification: searchParams.get("verification") ?? "",
    stream_status: searchParams.get("stream_status") ?? "",
    search: searchParams.get("search") ?? "",
    page: searchParams.get("page") ?? "1",
  }));
  const [form, setForm] = useState({ competition_id: "", home_team_id: "", away_team_id: "", kickoff_at: localDateTime(), featured: true, published: true, channel_ids: [] as number[] });

  useEffect(() => {
    setItems(matches);
  }, [matches]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadMatches() {
      const params = matchQuery(filters);
      const payload = await adminGet<ApiList<Match>>(`/admin/matches?${params.toString()}`, controller.signal);
      setItems(payload.data);
      setMeta(payload.admin_meta ?? null);
      setPage({
        current_page: payload.meta?.current_page ?? 1,
        last_page: payload.meta?.last_page ?? 1,
        total: payload.meta?.total ?? payload.data.length,
        per_page: payload.meta?.per_page ?? 50,
      });
      setSelectedIds((ids) => ids.filter((id) => payload.data.some((match) => match.id === id)));
    }

    loadMatches().catch((caught) => {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) {
        console.error(caught);
      }
    });

    return () => controller.abort();
  }, [adminGet, filters]);

  function updateFilters(next: Partial<typeof filters>) {
    const merged = { ...filters, ...next, page: next.page ?? "1" };
    setFilters(merged);
    router.replace(`${pathname}?${matchQuery(merged, false).toString()}`);
  }

  async function refreshMatches() {
    const payload = await adminGet<ApiList<Match>>(`/admin/matches?${matchQuery(filters).toString()}`);
    setItems(payload.data);
    setMeta(payload.admin_meta ?? null);
  }

  function toggleSelected(id: number) {
    setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  }

  function openAssign(match: Match) {
    setAssignMatch(match);
    setSelectedChannelIds((match.channels ?? []).map((channel) => channel.id));
  }

  async function applyBulkAction() {
    if (selectedIds.length === 0) return;
    if (bulkAction === "delete" && !window.confirm(`Archive ${selectedIds.length} selected matches?`)) return;
    await run(async () => {
      await adminSend("/admin/matches/bulk", "POST", {
        ids: selectedIds,
        action: bulkAction,
        competition_id: bulkAction === "assign_competition" ? Number(bulkCompetition) : undefined,
        status: bulkAction === "set_status" ? bulkStatus : undefined,
        confirm_delete: bulkAction === "delete" ? true : undefined,
      });
      setSelectedIds([]);
      await refreshMatches();
    }, "Bulk match action applied");
  }

  const grouped = groupAdminMatches(items);
  const visibleChannels = channels
    .filter((channel) => String(channel.name ?? "").toLowerCase().includes(channelSearch.toLowerCase()))
    .slice(0, 40);
  const filterSummary = `${page.total} ${page.total === 1 ? "match" : "matches"} | ${meta?.timezone ?? "Africa/Casablanca"}`;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        {[
          ["Today", meta?.counters.today ?? 0, { date: localTodayDate() }],
          ["Live", meta?.counters.live ?? 0, { status: "live" }],
          ["Upcoming", meta?.counters.upcoming ?? 0, { status: "scheduled" }],
          ["Finished", meta?.counters.finished ?? 0, { status: "finished" }],
          ["Needs Channel", meta?.counters.needs_channel ?? 0, { channel: "missing" }],
          ["Needs Verification", meta?.counters.needs_verification ?? 0, { verification: "pending" }],
          ["Featured", meta?.counters.featured ?? 0, { featured: "1" }],
        ].map(([label, value, next]) => (
          <button key={String(label)} className="rounded-lg border border-white/10 bg-neutral-900 p-4 text-left hover:border-red-400/40" onClick={() => updateFilters(next as Partial<typeof filters>)}>
            <span className="text-sm text-neutral-400">{String(label)}</span>
            <strong className="mt-2 block text-2xl text-white">{Number(value)}</strong>
          </button>
        ))}
      </div>

      <Panel title="Needs Attention">
        <div className="grid gap-2 xl:grid-cols-2">
          {(meta?.attention ?? []).map((match) => (
            <AdminMatchLine key={match.id} match={match} action={<button className="h-9 rounded-md bg-red-600 px-3 text-xs font-semibold text-white" onClick={() => openControl(match.id)}>Manage</button>} />
          ))}
          {(meta?.attention ?? []).length === 0 ? <Empty message="No urgent match issues in this view." /> : null}
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <div className="space-y-5">
          <Panel title="Date">
            <div className="grid grid-cols-2 gap-2">
              <button className="h-10 rounded-md border border-white/10 bg-black/20 text-sm text-white" onClick={() => updateFilters({ date: addDays(filters.date || localTodayDate(), -1) })}>Previous day</button>
              <button className="h-10 rounded-md border border-white/10 bg-black/20 text-sm text-white" onClick={() => updateFilters({ date: addDays(filters.date || localTodayDate(), 1) })}>Next day</button>
              <button className="h-10 rounded-md bg-red-600 text-sm font-semibold text-white" onClick={() => updateFilters({ date: localTodayDate() })}>Today</button>
              <button className="h-10 rounded-md bg-neutral-800 text-sm font-semibold text-white" onClick={() => updateFilters({ date: addDays(localTodayDate(), 1) })}>Tomorrow</button>
            </div>
            <Input label="Jump to date" type="date" value={filters.date} onChange={(date) => updateFilters({ date })} />
          </Panel>

          <Panel title="Filters">
            <Input label="Search" value={filters.search} onChange={(search) => updateFilters({ search })} />
            <Select label="Competition" value={filters.competition_id} options={competitions} onChange={(competition_id) => updateFilters({ competition_id })} />
            <Select label="Team" value={filters.team_id} options={teams} onChange={(team_id) => updateFilters({ team_id })} />
            <SelectRaw label="Status" value={filters.status} options={["", "scheduled", "active", "live", "halftime", "finished", "postponed", "cancelled"]} onChange={(status) => updateFilters({ status })} />
            <SelectRaw label="Featured" value={filters.featured} options={["", "1", "0"]} onChange={(featured) => updateFilters({ featured })} />
            <SelectRaw label="Channel assigned" value={filters.channel} options={["", "has", "missing"]} onChange={(channel) => updateFilters({ channel })} />
            <SelectRaw label="Verification" value={filters.verification} options={["", "verified", "pending", "problem"]} onChange={(verification) => updateFilters({ verification })} />
            <SelectRaw label="Stream status" value={filters.stream_status} options={["", "healthy", "missing", "problem"]} onChange={(stream_status) => updateFilters({ stream_status })} />
          </Panel>

          <Panel title="+ Quick Match">
            <Select label="Competition" value={form.competition_id} options={competitions} onChange={(value) => setForm({ ...form, competition_id: value })} />
            <Select label="Home" value={form.home_team_id} options={teams} onChange={(value) => setForm({ ...form, home_team_id: value })} />
            <Select label="Away" value={form.away_team_id} options={teams} onChange={(value) => setForm({ ...form, away_team_id: value })} />
            <Input label="Kickoff" type="datetime-local" value={form.kickoff_at} onChange={(value) => setForm({ ...form, kickoff_at: value })} />
            <Select label="Broadcast" value={String(form.channel_ids[0] ?? "")} options={channels} onChange={(value) => setForm({ ...form, channel_ids: value ? [Number(value)] : [] })} />
            <Toggle label="Featured" checked={form.featured} onChange={(featured) => setForm({ ...form, featured })} />
            <Toggle label="Published" checked={form.published} onChange={(published) => setForm({ ...form, published })} />
            <button className="mt-2 h-11 rounded-md bg-red-600 px-4 font-semibold text-white" onClick={() => run(async () => { await adminSend("/admin/matches", "POST", form); await refreshMatches(); }, "Match created and published")}>
              <Plus className="mr-2 inline h-4 w-4" />Create Match
            </button>
          </Panel>
        </div>

        <Panel title="Matches" action={<span className="text-sm text-neutral-400">{filterSummary}</span>}>
          {selectedIds.length > 0 ? (
            <div className="mb-3 grid gap-2 rounded-md border border-white/10 bg-black/20 p-3 md:grid-cols-[1fr_1fr_1fr_auto]">
              <SelectRaw label={`${selectedIds.length} selected`} value={bulkAction} options={["verify", "feature", "unfeature", "assign_competition", "set_status", "delete"]} onChange={setBulkAction} />
              <Select label="Competition" value={bulkCompetition} options={competitions} onChange={setBulkCompetition} />
              <SelectRaw label="Status" value={bulkStatus} options={["scheduled", "live", "halftime", "finished", "postponed", "cancelled"]} onChange={setBulkStatus} />
              <button className="h-11 self-end rounded-md bg-red-600 px-4 text-sm font-semibold text-white" onClick={() => void applyBulkAction()}>Apply</button>
            </div>
          ) : null}
          <div className="space-y-6">
            {grouped.map((group) => (
              <section key={group.key} className="space-y-3">
                <h3 className="border-b border-white/10 pb-2 text-sm font-semibold uppercase text-neutral-400">{group.title}</h3>
                <div className="grid gap-3">
                  {group.matches.map((match) => (
                    <AdminMatchCard
                      key={match.id}
                      match={match}
                      checked={selectedIds.includes(match.id)}
                      onCheck={() => toggleSelected(match.id)}
                      openControl={openControl}
                      openAssign={() => openAssign(match)}
                      run={run}
                      adminSend={adminSend}
                      refreshMatches={refreshMatches}
                    />
                  ))}
                </div>
              </section>
            ))}
            {grouped.length === 0 ? <Empty message="No matches match these filters." /> : null}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
            <button className="h-9 rounded-md border border-white/10 px-3 text-sm text-white disabled:opacity-40" disabled={page.current_page <= 1} onClick={() => updateFilters({ page: String(page.current_page - 1) })}>Previous</button>
            <span className="text-sm text-neutral-400">Page {page.current_page} of {page.last_page}</span>
            <button className="h-9 rounded-md border border-white/10 px-3 text-sm text-white disabled:opacity-40" disabled={page.current_page >= page.last_page} onClick={() => updateFilters({ page: String(page.current_page + 1) })}>Next</button>
          </div>
        </Panel>
      </div>

      {assignMatch ? (
        <div className="fixed inset-0 z-50 bg-black/70 p-4" role="dialog" aria-modal="true">
          <div className="mx-auto mt-10 max-w-2xl rounded-lg border border-white/10 bg-neutral-900 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-white">Assign Channels</h2>
                <p className="text-sm text-neutral-400">{assignMatch.home_team.name} vs {assignMatch.away_team.name}</p>
              </div>
              <button className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-white" onClick={() => setAssignMatch(null)} aria-label="Close channel assignment"><X className="h-4 w-4" /></button>
            </div>
            <Input label="Search Channels" value={channelSearch} onChange={setChannelSearch} />
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
              {visibleChannels.map((channel) => {
                const checked = selectedChannelIds.includes(channel.id);
                return (
                  <label key={channel.id} className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/20 p-3 text-sm text-white">
                    <span className="min-w-0 truncate">{channel.name}</span>
                    <input type="checkbox" checked={checked} onChange={(event) => setSelectedChannelIds((ids) => event.target.checked ? [...ids, channel.id] : ids.filter((id) => id !== channel.id))} />
                  </label>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap justify-between gap-2">
              <p className="text-sm text-neutral-400">First selected channel becomes primary.</p>
              <button className="h-10 rounded-md bg-red-600 px-4 text-sm font-semibold text-white" onClick={() => run(async () => { await adminSend(`/admin/matches/${assignMatch.id}/control/channels`, "POST", { channel_ids: selectedChannelIds }); setAssignMatch(null); await refreshMatches(); }, "Channels assigned")}>Save Channels</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AdminMatchCard({ match, checked, onCheck, openControl, openAssign, run, adminSend, refreshMatches }: {
  match: Match;
  checked: boolean;
  onCheck: () => void;
  openControl: (matchId: number) => void;
  openAssign: () => void;
  run: ManagerProps["run"];
  adminSend: ManagerProps["adminSend"];
  refreshMatches: () => Promise<void>;
}) {
  const channels = match.channels ?? [];
  const summary = match.admin?.stream_summary;
  const warnings = match.admin?.warnings ?? [];
  const score = match.status === "finished" || match.status === "live" || match.status === "halftime"
    ? `${match.home_score ?? 0} - ${match.away_score ?? 0}`
    : "vs";

  return (
    <article className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[28px_72px_minmax(0,1fr)_auto] sm:items-start">
          <input aria-label={`Select ${match.home_team.name} vs ${match.away_team.name}`} type="checkbox" checked={checked} onChange={onCheck} className="mt-1" />
          <div className="text-sm font-semibold tabular-nums text-white">{adminClock(match)}</div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase text-neutral-400">{match.competition.name}</span>
              <AdminBadge tone={statusTone(match.status)}>{match.status_label ?? labelize(match.status)}</AdminBadge>
              {match.featured ? <AdminBadge tone="cyan">Featured</AdminBadge> : null}
              <AdminBadge tone={verificationTone(match.verification_status)}>{match.admin?.verification_label ?? "Pending verification"}</AdminBadge>
            </div>
            <h4 className="mt-1 truncate text-base font-semibold text-white">{match.home_team.name} <span className="text-neutral-500">{score}</span> {match.away_team.name}</h4>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-400">
              <span>Channels: {summary?.channels ?? channels.length}</span>
              <span>Sources: {summary?.healthy_sources ?? 0}/{summary?.enabled_sources ?? 0} healthy</span>
              <span>Stream opens {adminClock({ kickoff_at: match.stream_available_from ?? match.playback_window?.opens_at ?? null, scheduled_date: null })}</span>
              <span>Closes {adminClock({ kickoff_at: match.stream_closes_at ?? match.playback_window?.closes_at ?? null, scheduled_date: null })}</span>
            </div>
            {channels.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {channels.slice(0, 4).map((channel, index) => <AdminBadge key={channel.id} tone={index === 0 ? "green" : "neutral"}>{index === 0 ? "Primary: " : ""}{String(channel.name)}</AdminBadge>)}
                {channels.length > 4 ? <AdminBadge tone="neutral">+{channels.length - 4}</AdminBadge> : null}
              </div>
            ) : null}
            {warnings.length > 0 ? (
              <div className="mt-2 grid gap-1">
                {warnings.slice(0, 3).map((warning) => <span key={warning} className="text-xs font-medium text-yellow-100">{warning}</span>)}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
          <button className="h-9 rounded-md bg-red-600 px-3 text-xs font-semibold text-white" onClick={() => openControl(match.id)}>Manage</button>
          <button className="h-9 rounded-md border border-white/10 px-3 text-xs text-white" onClick={openAssign}>Assign Channel</button>
          <button className="h-9 rounded-md border border-white/10 px-3 text-xs text-white" onClick={() => run(async () => { await adminSend(`/admin/matches/${match.id}/control/feature`, "PATCH", { featured: !match.featured }); await refreshMatches(); }, match.featured ? "Match unfeatured" : "Match featured")}>{match.featured ? "Unfeature" : "Feature"}</button>
          {["live", "halftime", "finished", "postponed"].map((status) => (
            <button key={status} className="h-9 rounded-md border border-white/10 px-3 text-xs text-white" onClick={() => run(async () => { await adminSend(`/admin/matches/${match.id}/control/status`, "PATCH", { status, override_transition: true }); await refreshMatches(); }, `Marked ${status}`)}>{labelize(status)}</button>
          ))}
          <button className="h-9 rounded-md border border-white/10 px-3 text-xs text-white" onClick={() => run(async () => { await adminSend(`/admin/matches/${match.id}/duplicate`, "POST"); await refreshMatches(); }, "Match duplicated")}>Duplicate</button>
          <button className="h-9 rounded-md border border-red-500/30 px-3 text-xs text-red-200" onClick={() => { if (window.confirm("Archive this match?")) void run(async () => { await adminSend(`/admin/matches/${match.id}`, "DELETE"); await refreshMatches(); }, "Match archived"); }}>Delete</button>
        </div>
      </div>
    </article>
  );
}

function AdminMatchLine({ match, action }: { match: Match; action?: ReactNode }) {
  const warning = match.admin?.warnings?.[0] ?? "Needs attention";
  return <CardLine title={`${adminClock(match)} ${match.home_team.name} vs ${match.away_team.name}`} meta={`${match.competition.name} | ${warning}`} action={action} />;
}

function AdminBadge({ tone, children }: { tone: "red" | "yellow" | "green" | "cyan" | "neutral"; children: ReactNode }) {
  const classes = {
    red: "bg-red-500/15 text-red-100",
    yellow: "bg-yellow-500/15 text-yellow-100",
    green: "bg-green-500/15 text-green-100",
    cyan: "bg-cyan-500/15 text-cyan-100",
    neutral: "bg-white/10 text-neutral-200",
  };

  return <span className={`rounded-md px-2 py-1 text-[11px] font-semibold ${classes[tone]}`}>{children}</span>;
}

function groupAdminMatches(matches: Match[]): Array<{ key: string; title: string; matches: Match[] }> {
  const groups = new Map<string, Match[]>();

  for (const match of matches) {
    const key = adminDateKey(match);
    groups.set(key, [...(groups.get(key) ?? []), match]);
  }

  return [...groups.entries()].map(([key, values]) => ({ key, title: adminDateHeading(key), matches: values }));
}

function matchQuery(filters: Record<string, string>, includePagination = true): URLSearchParams {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (!value) return;
    if (!includePagination && key === "page") return;
    params.set(key, value);
  });
  if (includePagination) {
    params.set("per_page", "50");
  }

  return params;
}

function adminDateKey(match: Pick<Match, "kickoff_at" | "scheduled_date">): string {
  if (match.kickoff_at) return localDateKey(new Date(match.kickoff_at));
  return match.scheduled_date ?? "tbc";
}

function adminDateHeading(key: string): string {
  if (key === "tbc") return "Date TBC";
  if (key === localTodayDate()) return `Today - ${adminDateFormatter.format(new Date(`${key}T12:00:00Z`))}`;
  if (key === addDays(localTodayDate(), 1)) return `Tomorrow - ${adminDateFormatter.format(new Date(`${key}T12:00:00Z`))}`;
  return adminDateFormatter.format(new Date(`${key}T12:00:00Z`));
}

function adminClock(match: Pick<Match, "kickoff_at" | "scheduled_date">): string {
  if (match.kickoff_at) return adminTimeFormatter.format(new Date(match.kickoff_at));
  return match.scheduled_date ? "Time TBC" : "TBC";
}

function statusTone(status: string): "red" | "yellow" | "green" | "cyan" | "neutral" {
  if (status === "live") return "red";
  if (status === "halftime") return "yellow";
  if (status === "finished") return "green";
  if (status === "scheduled") return "cyan";
  return "neutral";
}

function verificationTone(status?: string): "red" | "yellow" | "green" | "cyan" | "neutral" {
  if (status === "verified" || status === "manual_verified") return "green";
  if (status === "pending_verification") return "yellow";
  return "red";
}

function MatchControlCenter({ matches, channels, control, selectedId, onSelectMatch, loadControl, run, adminSend }: ManagerProps & { matches: Match[]; channels: Entity[]; control: MatchControl | null; selectedId: number | null; onSelectMatch: (matchId: number) => void; loadControl: (matchId: number) => Promise<void> }) {
  const selected = control?.match;
  const [channelId, setChannelId] = useState("");
  const [channelSearch, setChannelSearch] = useState("");
  const [assignGroup, setAssignGroup] = useState("Favorites");

  useEffect(() => {
    if (!selectedId && matches[0]) {
      onSelectMatch(matches[0].id);
    }
  }, [matches, onSelectMatch, selectedId]);

  const assignGroups = ["Favorites", "beIN Sports", "Sports", "Morocco", "SSC", "Other"];
  const visibleChannels = channels
    .filter((channel) => assignGroup === "Favorites" ? Boolean(channel.favorite) : String(channel.normalized_group ?? channel.playlist_group ?? "Other") === assignGroup)
    .filter((channel) => String(channel.name ?? "").toLowerCase().includes(channelSearch.toLowerCase()))
    .slice(0, 50);

  return (
    <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <Panel title="Match Picker">
        <Select label="Match" value={String(selectedId ?? "")} options={matches} onChange={(value) => onSelectMatch(Number(value))} />
        {selected ? (
          <div className="grid gap-2 text-sm text-neutral-300">
            <span>{selected.competition.name}</span>
            <span>Kickoff: {selected.kickoff_at ?? selected.scheduled_date ?? "TBC"}</span>
            <span>Status: {selected.status}</span>
            <span>Playback: {control?.playback_window.status ?? "unknown"}</span>
          </div>
        ) : <Empty message="Choose a match to load the control center." />}
      </Panel>
      {selected ? (
        <div className="space-y-5">
          <Panel title={`${selected.home_team.name} vs ${selected.away_team.name}`} action={<button className="text-sm text-red-300" onClick={() => void loadControl(selected.id)}>Refresh</button>}>
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label="channels" value={control?.stream_summary.channels ?? 0} />
              <Stat label="sources" value={control?.stream_summary.sources ?? 0} />
              <Stat label="enabled" value={control?.stream_summary.enabled_sources ?? 0} />
              <Stat label="healthy" value={control?.stream_summary.healthy_sources ?? 0} />
            </div>
            <MatchScoreEditor key={`${selected.id}-${selected.home_score ?? 0}-${selected.away_score ?? 0}-${selected.minute ?? 0}`} selected={selected} run={run} adminSend={adminSend} loadControl={loadControl} />
            <div className="grid gap-2 sm:grid-cols-4">
              {["live", "halftime", "finished", "scheduled"].map((status) => (
                <button key={status} className="h-11 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-white" onClick={() => run(async () => { await adminSend(`/admin/matches/${selected.id}/control/status`, "PATCH", { status, override_transition: true }); await loadControl(selected.id); }, `Marked ${status}`)}>
                  {status === "live" ? <Play className="mr-2 inline h-4 w-4" /> : null}{status}
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Playback Window">
            <div className="grid gap-2 text-sm text-neutral-300 sm:grid-cols-3">
              <span>Status: {control?.playback_window.status}</span>
              <span>Opens: {control?.playback_window.opens_at ?? "auto"}</span>
              <span>Closes: {control?.playback_window.closes_at ?? "auto"}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-5">
              {[
                ["open_now", "Open"],
                ["close_now", "Close"],
                ["extend_15", "+15 min"],
                ["extend_30", "+30 min"],
                ["reopen_30", "Reopen"],
              ].map(([action, label]) => (
                <button key={action} className="h-11 rounded-md bg-neutral-800 px-3 text-sm font-semibold text-white" onClick={() => run(async () => { await adminSend(`/admin/matches/${selected.id}/control/playback`, "POST", { action }); await loadControl(selected.id); }, "Playback window updated")}>
                  {action === "close_now" ? <Square className="mr-2 inline h-4 w-4" /> : null}{label}
                </button>
              ))}
            </div>
            <Toggle label="Featured" checked={selected.featured} onChange={(featured) => void run(async () => { await adminSend(`/admin/matches/${selected.id}/control/feature`, "PATCH", { featured }); await loadControl(selected.id); }, featured ? "Match featured" : "Match unfeatured")} />
          </Panel>
          <Panel title="IPTV Channel Assignment">
            <div className="flex flex-wrap gap-2">
              {assignGroups.map((item) => (
                <button key={item} className={`h-9 rounded-md px-3 text-sm ${assignGroup === item ? "bg-red-600 text-white" : "bg-black/20 text-neutral-300"}`} onClick={() => setAssignGroup(item)}>{item}</button>
              ))}
            </div>
            <Input label="Search Channels" value={channelSearch} onChange={setChannelSearch} />
            <Select label="Assign Channel" value={channelId} options={visibleChannels} onChange={setChannelId} />
            <button className="h-11 rounded-md bg-red-600 px-4 font-semibold text-white" onClick={() => run(async () => { await adminSend(`/admin/matches/${selected.id}/control/channels`, "POST", { channel_id: Number(channelId) }); setChannelId(""); await loadControl(selected.id); }, "Channel assigned")}>
              <Plus className="mr-2 inline h-4 w-4" />Assign
            </button>
            <div className="grid gap-2">
              {(control?.assigned_channels ?? []).map((channel) => (
                <div key={channel.id} className="rounded-md border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <strong className="block truncate text-white">{channel.name}</strong>
                      <span className="text-sm text-neutral-400">{channel.role} | {channel.health.enabled}/{channel.health.sources} enabled | healthy {channel.health.healthy}</span>
                    </div>
                    <div className="flex gap-2">
                      <button className="h-9 rounded-md border border-white/10 px-2 text-xs text-white" onClick={() => run(async () => { await adminSend(`/admin/matches/${selected.id}/control/channels/${channel.id}/promote`, "POST"); await loadControl(selected.id); }, "Channel promoted")}>Main</button>
                      <button className="h-9 rounded-md border border-white/10 px-2 text-xs text-red-200" onClick={() => run(async () => { await adminSend(`/admin/matches/${selected.id}/control/channels/${channel.id}`, "DELETE"); await loadControl(selected.id); }, "Channel removed")}>Remove</button>
                    </div>
                  </div>
                  <div className="mt-2 grid gap-1">
                    {channel.stream_sources.map((source) => (
                      <CardLine key={source.id} title={`${source.name} - ${source.protocol}`} meta={`${source.last_known_status ?? "unknown"} | ${source.masked_url}`} action={<button className="text-sm text-red-300" onClick={() => run(async () => { await adminSend(`/admin/stream-sources/${source.id}/test`, "POST"); await loadControl(selected.id); }, "Source tested")}>Test</button>} />
                    ))}
                  </div>
                </div>
              ))}
              {(control?.assigned_channels ?? []).length === 0 ? <Empty message="No IPTV channels assigned yet." /> : null}
            </div>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

function MatchScoreEditor({ selected, run, adminSend, loadControl }: ManagerProps & { selected: Match; loadControl: (matchId: number) => Promise<void> }) {
  const [score, setScore] = useState({ home_score: selected.home_score ?? 0, away_score: selected.away_score ?? 0, minute: selected.minute ?? 0 });

  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        <ScoreStepper label={String(selected.home_team.short_name ?? selected.home_team.name)} value={score.home_score} onChange={(home_score) => setScore({ ...score, home_score })} />
        <ScoreStepper label={String(selected.away_team.short_name ?? selected.away_team.name)} value={score.away_score} onChange={(away_score) => setScore({ ...score, away_score })} />
        <ScoreStepper label="Minute" value={score.minute} onChange={(minute) => setScore({ ...score, minute })} />
      </div>
      <button className="h-11 rounded-md bg-red-600 px-4 font-semibold text-white" onClick={() => run(async () => { await adminSend(`/admin/matches/${selected.id}/control/score`, "PATCH", score); await loadControl(selected.id); }, "Score saved")}>
        <Save className="mr-2 inline h-4 w-4" />Save Score
      </button>
    </>
  );
}

function LiveControl({ matches, run, adminSend }: ManagerProps & { matches: Match[] }) {
  const liveCandidates = matches.filter((match) => ["live", "halftime", "scheduled"].includes(match.status));
  const controllableMatches = liveCandidates.length ? liveCandidates : matches;
  const [id, setId] = useState(String(liveCandidates[0]?.id ?? ""));
  const selected = matches.find((match) => String(match.id) === id) ?? controllableMatches[0];
  const [score, setScore] = useState({ home_score: selected?.home_score ?? 0, away_score: selected?.away_score ?? 0, minute: selected?.minute ?? 0, status: selected?.status ?? "live", featured: selected?.featured ?? false });
  if (!selected) return <Empty message="No controllable matches." />;
  function chooseMatch(value: string) {
    setId(value);
    const next = matches.find((match) => String(match.id) === value);
    if (next) {
      setScore({ home_score: next.home_score ?? 0, away_score: next.away_score ?? 0, minute: next.minute ?? 0, status: next.status, featured: next.featured });
    }
  }
  return (
    <Panel title={`${selected.home_team.name} vs ${selected.away_team.name}`}>
      <Select label="Match" value={id || String(selected.id)} options={controllableMatches} onChange={chooseMatch} />
      <ScoreStepper label={String(selected.home_team.short_name ?? selected.home_team.name)} value={score.home_score} onChange={(home_score) => setScore({ ...score, home_score })} />
      <ScoreStepper label={String(selected.away_team.short_name ?? selected.away_team.name)} value={score.away_score} onChange={(away_score) => setScore({ ...score, away_score })} />
      <ScoreStepper label="Minute" value={score.minute} onChange={(minute) => setScore({ ...score, minute })} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {["live", "halftime", "finished", "postponed"].map((status) => <button key={status} className={`h-11 rounded-md border border-white/10 ${score.status === status ? "bg-red-600" : "bg-black/20"}`} onClick={() => setScore({ ...score, status })}>{status}</button>)}
      </div>
      <Toggle label="Featured" checked={score.featured} onChange={(featured) => setScore({ ...score, featured })} />
      <button className="h-12 rounded-md bg-red-600 px-4 font-semibold text-white" onClick={() => run(async () => { await adminSend(`/admin/matches/${selected.id}/live-control`, "PATCH", score); }, "Live match saved")}>
        <Save className="mr-2 inline h-4 w-4" />Save
      </button>
    </Panel>
  );
}

function SimpleManager({ title, endpoint, items, fields, toggles, run, adminSend }: ManagerProps & { title: string; endpoint: string; items: Entity[]; fields: string[]; toggles: string[] }) {
  const empty = Object.fromEntries(fields.map((field) => [field, ""]));
  const [form, setForm] = useState<Record<string, string | boolean>>({ ...empty, ...Object.fromEntries(toggles.map((toggle) => [toggle, true])) });
  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <Panel title={`Add ${title.slice(0, -1)}`}>
        {fields.map((field) => <Input key={field} label={labelize(field)} value={String(form[field] ?? "")} onChange={(value) => setForm({ ...form, [field]: value })} />)}
        {toggles.map((toggle) => <Toggle key={toggle} label={labelize(toggle)} checked={Boolean(form[toggle])} onChange={(value) => setForm({ ...form, [toggle]: value })} />)}
        <button className="h-11 rounded-md bg-red-600 px-4 font-semibold text-white" onClick={() => run(async () => { await adminSend(endpoint, "POST", form); }, `${title} saved`)}>
          <Plus className="mr-2 inline h-4 w-4" />Save
        </button>
      </Panel>
      <Panel title={title}>
        <EntityGrid items={items} />
      </Panel>
    </div>
  );
}

function ChannelCatalog({ channels, run, adminSend }: ManagerProps & { channels: Entity[] }) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("All");
  const [quality, setQuality] = useState("All");
  const [health, setHealth] = useState("All");
  const important = ["All", "Favorites", "Assigned", "beIN Sports", "Sports", "Morocco", "SSC", "News", "Entertainment", "Other"];
  const existingGroups = Array.from(new Set(channels.map((channel) => String(channel.normalized_group ?? channel.playlist_group ?? "Other"))));
  const groups = important.filter((item) => item === "All" || item === "Favorites" || item === "Assigned" || existingGroups.includes(item));
  const filtered = channels
    .filter((channel) => group === "All" || (group === "Favorites" ? Boolean(channel.favorite) : group === "Assigned" ? Number(channel.matches_count ?? 0) > 0 : String(channel.normalized_group ?? channel.playlist_group ?? "Other") === group))
    .filter((channel) => quality === "All" || String(channel.quality_label ?? "UNKNOWN") === quality)
    .filter((channel) => health === "All" || String(channel.health_status ?? "unknown") === health)
    .filter((channel) => String(channel.name ?? "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="grid gap-5 xl:grid-cols-[240px_1fr]">
      <Panel title="Groups">
        <div className="grid gap-1">
          {groups.map((item) => (
            <button key={item} className={`flex h-10 items-center justify-between rounded-md px-3 text-left text-sm ${group === item ? "bg-red-600 text-white" : "bg-black/20 text-neutral-300"}`} onClick={() => setGroup(item)}>
              <span>{item}</span>
              <span>{item === "All" ? channels.length : item === "Favorites" ? channels.filter((channel) => channel.favorite).length : channels.filter((channel) => String(channel.normalized_group ?? channel.playlist_group ?? "Other") === item).length}</span>
            </button>
          ))}
        </div>
      </Panel>
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-5">
          <Stat label="channels" value={channels.length} />
          <Stat label="healthy" value={channels.filter((channel) => channel.health_status === "healthy").length} />
          <Stat label="degraded" value={channels.filter((channel) => channel.health_status === "degraded").length} />
          <Stat label="offline" value={channels.filter((channel) => channel.health_status === "offline").length} />
          <Stat label="unknown" value={channels.filter((channel) => !channel.health_status || channel.health_status === "unknown").length} />
        </div>
        <Panel title="Channels">
          <div className="grid gap-2 lg:grid-cols-[1fr_160px_180px]">
            <Input label="Search" value={search} onChange={setSearch} />
            <SelectRaw label="Quality" value={quality} options={["All", "4K", "FHD", "HD", "SD", "UNKNOWN"]} onChange={setQuality} />
            <SelectRaw label="Health" value={health} options={["All", "healthy", "degraded", "offline", "unknown", "browser_incompatible"]} onChange={setHealth} />
          </div>
          <div className="grid gap-1">
            {filtered.map((channel) => (
              <div key={channel.id} className="grid gap-2 rounded-md border border-white/10 bg-black/20 p-3 md:grid-cols-[1fr_160px_120px_110px] md:items-center">
                <div className="min-w-0">
                  <strong className="block truncate text-white">{String(channel.name)}</strong>
                  <span className="text-sm text-neutral-400">{String(channel.normalized_group ?? channel.playlist_group ?? "Other")} | {String(channel.quality_label ?? "UNKNOWN")} | {String(channel.protocol ?? "unknown").toUpperCase()}</span>
                </div>
                <span className="text-sm text-neutral-300">{String(channel.browser_compatible ?? "unknown")}</span>
                <span className={`text-sm font-semibold ${channel.health_status === "healthy" ? "text-green-300" : channel.health_status === "offline" ? "text-red-300" : "text-yellow-200"}`}>{String(channel.health_status ?? "unknown")}</span>
                <button className="h-9 rounded-md border border-white/10 px-2 text-sm text-white" onClick={() => run(async () => { await adminSend(`/admin/channels/${channel.id}`, "PUT", { name: channel.name, active: channel.active ?? true, favorite: !channel.favorite }); }, channel.favorite ? "Removed from favorites" : "Added to favorites")}>
                  {channel.favorite ? "Starred" : "Star"}
                </button>
              </div>
            ))}
            {filtered.length === 0 ? <Empty message="No channels match these filters." /> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function CompetitionManager({ competitions, teams, run, adminSend }: ManagerProps & { competitions: Entity[]; teams: Entity[] }) {
  const [form, setForm] = useState({ name: "", short_name: "", country_code: "", active: true, featured: true, selection_mode: "featured_teams_only", featured_team_ids: [] as number[] });
  return (
    <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <Panel title="Competition Rules">
        <Input label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
        <Input label="Short name" value={form.short_name} onChange={(short_name) => setForm({ ...form, short_name })} />
        <SelectRaw label="Selection mode" value={form.selection_mode} options={["all_matches", "featured_teams_only", "manual_only"]} onChange={(selection_mode) => setForm({ ...form, selection_mode })} />
        <Select label="Featured club" value={String(form.featured_team_ids[0] ?? "")} options={teams} onChange={(value) => setForm({ ...form, featured_team_ids: value ? [Number(value)] : [] })} />
        <button className="h-11 rounded-md bg-red-600 px-4 font-semibold text-white" onClick={() => run(async () => { await adminSend("/admin/competitions", "POST", form); }, "Competition saved")}>Save Competition</button>
      </Panel>
      <Panel title="Competitions"><EntityGrid items={competitions} /></Panel>
    </div>
  );
}

function PlaylistManager({ playlists, run, adminSend, adminUpload }: ManagerProps & { playlists: Playlist[]; adminUpload: <T>(path: string, body: FormData) => Promise<T> }) {
  const [form, setForm] = useState({ name: "", type: "m3u_url", source_url: "", server_url: "", username: "", password: "", auto_sync: false, sync_interval_minutes: 360 });
  const [file, setFile] = useState<File | null>(null);
  const [testResult, setTestResult] = useState<PlaylistTestResult | null>(null);

  async function submit() {
    if (form.type === "uploaded_m3u") {
      const body = new FormData();
      body.append("name", form.name);
      body.append("type", form.type);
      body.append("auto_sync", String(form.auto_sync ? 1 : 0));
      body.append("sync_interval_minutes", String(form.sync_interval_minutes));
      if (file) body.append("file", file);
      await adminUpload("/admin/playlists", body);
      return;
    }

    await adminSend("/admin/playlists", "POST", form);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <Panel title="Add Playlist">
        <Input label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
        <SelectRaw label="Type" value={form.type} options={["m3u_url", "xtream", "uploaded_m3u"]} onChange={(type) => setForm({ ...form, type })} />
        {form.type === "m3u_url" ? <Input label="M3U URL" value={form.source_url} onChange={(source_url) => setForm({ ...form, source_url })} /> : null}
        {form.type === "xtream" ? (
          <>
            <Input label="Server URL" value={form.server_url} onChange={(server_url) => setForm({ ...form, server_url })} />
            <Input label="Username" value={form.username} onChange={(username) => setForm({ ...form, username })} />
            <Input label="Password" type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} />
          </>
        ) : null}
        {form.type === "uploaded_m3u" ? (
          <label className="block text-sm font-medium text-neutral-300">M3U File<input type="file" accept=".m3u,.m3u8,text/plain" className="mt-1 block w-full rounded-md border border-white/10 bg-black px-3 py-2 text-white" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
        ) : null}
        <Toggle label="Auto Sync" checked={form.auto_sync} onChange={(auto_sync) => setForm({ ...form, auto_sync })} />
        <Input label="Sync Interval Minutes" type="number" value={String(form.sync_interval_minutes)} onChange={(sync_interval_minutes) => setForm({ ...form, sync_interval_minutes: Number(sync_interval_minutes) })} />
        {form.type === "m3u_url" ? (
          <button className="h-11 rounded-md border border-white/10 px-4 font-semibold text-white" onClick={() => run(async () => { const result = await adminSend<ApiOne<PlaylistTestResult>>("/admin/playlists/test", "POST", { source_url: form.source_url }); setTestResult(result.data); }, "Playlist connection tested")}>
            Test Connection
          </button>
        ) : null}
        {testResult ? (
          <div className="rounded-md border border-white/10 bg-black/20 p-3 text-sm text-neutral-300">
            <strong className="block text-white">{testResult.connected && testResult.valid_m3u ? "Valid M3U" : "Needs attention"}</strong>
            <span>{testResult.channel_count} channels | {testResult.group_count} groups</span>
            <div className="mt-2 grid gap-1">
              {testResult.samples.slice(0, 3).map((sample) => <span key={sample.channel}>{sample.channel} | {sample.protocol} | {sample.transport}</span>)}
            </div>
          </div>
        ) : null}
        <button className="h-11 rounded-md bg-red-600 px-4 font-semibold text-white" onClick={() => run(submit, "Playlist saved and sync queued")}>
          <Plus className="mr-2 inline h-4 w-4" />Save Playlist
        </button>
      </Panel>
      <Panel title="Playlists">
        <div className="grid gap-2">
          {playlists.map((playlist) => (
            <div key={playlist.id} className="rounded-md border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <strong className="block truncate text-white">{playlist.name}</strong>
                  <span className="text-sm text-neutral-400">{playlist.type} | {playlist.status} | {playlist.channel_count} channels | {playlist.group_count} groups</span>
                  {playlist.last_error_message ? <span className="block text-sm text-red-200">{playlist.last_error_message}</span> : null}
                </div>
                <div className="flex gap-2">
                  <button className="h-9 rounded-md border border-white/10 px-2 text-xs text-white" onClick={() => run(async () => { await adminSend(`/admin/playlists/${playlist.id}/sync`, "POST"); }, "Playlist sync queued")}>Sync</button>
                  <button className="h-9 rounded-md border border-white/10 px-2 text-xs text-white" onClick={() => run(async () => { await adminSend(`/admin/playlists/${playlist.id}/sync`, "POST"); }, "Playlist reparse queued")}>Reparse</button>
                </div>
              </div>
              <div className="mt-2 grid gap-2 text-xs text-neutral-400 sm:grid-cols-3">
                <span>Source: {playlist.source_url ?? playlist.server_url ?? "private upload"}</span>
                <span>Credentials: {playlist.has_credentials ? "stored" : "none"}</span>
                <span>Last success: {playlist.last_successful_sync_at ?? "never"}</span>
              </div>
            </div>
          ))}
          {playlists.length === 0 ? <Empty message="No playlists connected yet." /> : null}
        </div>
      </Panel>
    </div>
  );
}

function SourceManager({ sources, channels, run, adminSend }: ManagerProps & { sources: Entity[]; channels: Entity[] }) {
  const [form, setForm] = useState({ channel_id: "", name: "", protocol: "hls", url: "", priority: 10, enabled: true, is_backup: false });
  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <Panel title="Stream Source">
        <Select label="Channel" value={form.channel_id} options={channels} onChange={(channel_id) => setForm({ ...form, channel_id })} />
        <Input label="Source Name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
        <SelectRaw label="Protocol" value={form.protocol} options={["hls", "mpegts"]} onChange={(protocol) => setForm({ ...form, protocol })} />
        <Input label="URL" value={form.url} onChange={(url) => setForm({ ...form, url })} />
        <Input label="Priority" type="number" value={String(form.priority)} onChange={(priority) => setForm({ ...form, priority: Number(priority) })} />
        <Toggle label="Enabled" checked={form.enabled} onChange={(enabled) => setForm({ ...form, enabled })} />
        <Toggle label="Backup" checked={form.is_backup} onChange={(is_backup) => setForm({ ...form, is_backup })} />
        <button className="h-11 rounded-md bg-red-600 px-4 font-semibold text-white" onClick={() => run(async () => { await adminSend("/admin/stream-sources", "POST", form); }, "Source saved")}>Save Source</button>
      </Panel>
      <Panel title="Sources">
        <div className="grid gap-2">
          {sources.map((source) => <CardLine key={source.id} title={`${source.name} - ${source.protocol}`} meta={`${source.masked_url ?? ""} ${source.last_known_status ?? ""}`} action={<div className="flex gap-3"><button className="text-sm text-red-300" onClick={() => run(async () => { await adminSend(`/admin/stream-sources/${source.id}/test`, "POST"); }, "Source tested")}>Test</button><button className="text-sm text-cyan-300" onClick={() => run(async () => { await adminSend(`/admin/stream-sources/${source.id}/pipeline-test`, "POST"); }, "Pipeline tested")}>Pipeline</button></div>} />)}
        </div>
      </Panel>
    </div>
  );
}

function HomepageManager({ competitions, matches, run, adminSend }: ManagerProps & { competitions: Entity[]; matches: Match[] }) {
  const [hero, setHero] = useState("");
  const [competition, setCompetition] = useState(String(competitions[0]?.id ?? ""));
  return <Panel title="Homepage Sections">
    <Select label="Hero Match" value={hero} options={matches} onChange={setHero} />
    <Select label="Featured Competition" value={competition} options={competitions} onChange={setCompetition} />
    <button className="h-11 rounded-md bg-red-600 px-4 font-semibold text-white" onClick={() => run(async () => { await adminSend("/admin/homepage", "PUT", { sections: [
      { key: "live_now", title: "Live Now", type: "live_now", enabled: true, sort_order: 10, limit: 8, hero_match_id: hero ? Number(hero) : null },
      { key: "featured_competition", title: "Featured Competition", type: "competition", enabled: true, sort_order: 20, limit: 8, competition_id: Number(competition) },
    ] }); }, "Homepage updated")}>Save Homepage</button>
  </Panel>;
}

function AnnouncementManager({ run, adminSend }: ManagerProps) {
  const [form, setForm] = useState({ title: "", message: "", type: "info", active: true });
  return <Panel title="Announcement"><Input label="Title" value={form.title} onChange={(title) => setForm({ ...form, title })} /><Input label="Message" value={form.message} onChange={(message) => setForm({ ...form, message })} /><SelectRaw label="Type" value={form.type} options={["info", "warning", "maintenance"]} onChange={(type) => setForm({ ...form, type })} /><button className="h-11 rounded-md bg-red-600 px-4 font-semibold text-white" onClick={() => run(async () => { await adminSend("/admin/announcements", "POST", form); }, "Announcement saved")}>Save Announcement</button></Panel>;
}

function UserManager({ run, adminSend }: ManagerProps) {
  const [form, setForm] = useState({ name: "", email: "", password: "", active: true, role_ids: [] as number[] });
  return <Panel title="Create Admin User"><Input label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} /><Input label="Email" value={form.email} onChange={(email) => setForm({ ...form, email })} /><Input label="Password" type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} /><button className="h-11 rounded-md bg-red-600 px-4 font-semibold text-white" onClick={() => run(async () => { await adminSend("/admin/users", "POST", form); }, "User created")}>Create User</button></Panel>;
}

function SettingsManager({ run, adminSend }: ManagerProps) {
  const [siteName, setSiteName] = useState("RiFiTV");
  const [timezone, setTimezone] = useState("Africa/Casablanca");
  return <Panel title="Site Settings"><Input label="Site Name" value={siteName} onChange={setSiteName} /><Input label="Timezone" value={timezone} onChange={setTimezone} /><button className="h-11 rounded-md bg-red-600 px-4 font-semibold text-white" onClick={() => run(async () => { await adminSend("/admin/settings", "PUT", { settings: [{ key: "site_name", value: siteName }, { key: "display_timezone", value: timezone }] }); }, "Settings saved")}>Save Settings</button></Panel>;
}

function AuditLog({ items }: { items: Entity[] }) {
  return <Panel title="Audit Log"><div className="grid gap-2">{items.map((item) => <CardLine key={item.id} title={String(item.action)} meta={String(item.created_at ?? "")} />)}</div></Panel>;
}

type ManagerProps = {
  run: (action: () => Promise<void>, success: string) => Promise<void>;
  adminSend: <T>(path: string, method: string, body?: unknown) => Promise<T>;
  adminGet?: <T>(path: string, signal?: AbortSignal) => Promise<T>;
};
function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) { return <section className="rounded-lg border border-white/10 bg-neutral-900 p-4"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-semibold text-white">{title}</h2>{action}</div><div className="space-y-3">{children}</div></section>; }
function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-lg border border-white/10 bg-neutral-900 p-4"><span className="text-sm capitalize text-neutral-400">{label}</span><strong className="mt-2 block text-2xl text-white">{value}</strong></div>; }
function Input({ label, value, onChange, type = "text", autoFocus = false, autoComplete }: { label: string; value: string; onChange: (value: string) => void; type?: string; autoFocus?: boolean; autoComplete?: string }) { return <label className="block text-sm font-medium text-neutral-300">{label}<input autoFocus={autoFocus} autoComplete={autoComplete} type={type} className="mt-1 h-11 w-full rounded-md border border-white/10 bg-black px-3 text-white outline-none focus-visible:ring-2 focus-visible:ring-red-300" value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function Select({ label, value, options, onChange }: { label: string; value: string; options: Entity[]; onChange: (value: string) => void }) { return <label className="block text-sm font-medium text-neutral-300">{label}<select className="mt-1 h-11 w-full rounded-md border border-white/10 bg-black px-3 text-white outline-none focus-visible:ring-2 focus-visible:ring-red-300" value={value} onChange={(event) => onChange(event.target.value)}><option value="">Choose...</option>{options.map((option) => <option key={option.id} value={option.id}>{String(option.name ?? option.title ?? option.slug ?? option.id)}</option>)}</select></label>; }
function SelectRaw({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <label className="block text-sm font-medium text-neutral-300">{label}<select className="mt-1 h-11 w-full rounded-md border border-white/10 bg-black px-3 text-white" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex h-11 items-center justify-between rounded-md border border-white/10 bg-black/30 px-3 text-sm text-neutral-300">{label}<input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>; }
function ScoreStepper({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-center"><p className="font-semibold text-white">{label}</p><strong className="block py-3 text-4xl text-white">{value}</strong><div className="grid grid-cols-2 gap-2"><button className="h-12 rounded-md bg-neutral-800" onClick={() => onChange(Math.max(0, value - 1))}>-</button><button className="h-12 rounded-md bg-red-600" onClick={() => onChange(value + 1)}>+</button></div></div>; }
function MatchRows({ matches, controls = false, onControl }: { matches: Match[]; controls?: boolean; onControl?: (matchId: number) => void }) { return <div className="grid gap-2">{matches.length ? matches.map((match) => <CardLine key={match.id} title={`${match.home_team.name} ${match.home_score ?? "-"} - ${match.away_score ?? "-"} ${match.away_team.name}`} meta={`${match.competition.name} | ${match.status} | ${match.minute ?? ""}`} action={controls ? <button className="h-9 rounded-md bg-red-600 px-3 text-xs font-semibold text-white" onClick={() => onControl?.(match.id)}>Control</button> : undefined} />) : <Empty message="No matches here yet." />}</div>; }
function ReadinessRows({ matches, readiness }: { matches: Match[]; readiness: Record<string, Readiness> }) { return <div className="grid gap-2">{matches.length ? matches.map((match) => { const state = readiness[String(match.id)]; return <CardLine key={match.id} title={`${match.home_team.name} vs ${match.away_team.name}`} meta={`${match.status} | ${state?.state ?? "unknown"} | ${state?.source_count ?? 0} sources | healthy ${state?.healthy_source ? "yes" : "no"}`} action={<span className={`rounded-md px-2 py-1 text-xs font-semibold ${state?.state === "ready" ? "bg-green-500/15 text-green-200" : state?.state === "critical" ? "bg-red-500/15 text-red-200" : "bg-yellow-500/15 text-yellow-100"}`}>{state?.state ?? "unknown"}</span>} />; }) : <Empty message="No matches in this bucket." />}</div>; }
function SyncRunRows({ syncRuns }: { syncRuns: SyncRun[] }) { return <div className="grid gap-2">{syncRuns.length ? syncRuns.map((run) => <CardLine key={run.id} title={`${run.type} - ${run.status}`} meta={`created ${run.created_count} | updated ${run.updated_count} | ignored ${run.ignored_count} | failed ${run.failed_count}`} />) : <Empty message="No sync runs yet." />}</div>; }
function EntityGrid({ items }: { items: Entity[] }) { return <div className="grid gap-2 md:grid-cols-2">{items.map((item) => <CardLine key={item.id} title={String(item.name ?? item.title ?? item.slug)} meta={String(item.slug ?? item.short_name ?? "")} />)}</div>; }
function CardLine({ title, meta, action }: { title: string; meta: string; action?: ReactNode }) { return <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/20 p-3"><div className="min-w-0"><strong className="block truncate text-white">{title}</strong><span className="text-sm text-neutral-400">{meta}</span></div>{action}</div>; }
function Empty({ message }: { message: string }) { return <p className="rounded-md border border-white/10 bg-black/20 p-4 text-sm text-neutral-400">{message}</p>; }
function Toast({ tone, message, onClose }: { tone: "success" | "error"; message: string; onClose: () => void }) { return <div className={`mb-4 flex items-center justify-between rounded-md border p-3 text-sm ${tone === "success" ? "border-green-500/30 bg-green-500/10 text-green-200" : "border-red-500/30 bg-red-500/10 text-red-200"}`}><span>{tone === "success" ? <Check className="mr-2 inline h-4 w-4" /> : null}{message}</span><button onClick={onClose}><X className="h-4 w-4" /></button></div>; }
function groupBy<T extends Record<string, unknown>>(items: T[], key: keyof T): Record<string, T[]> { return items.reduce((groups, item) => { const value = String(item[key]); groups[value] ??= []; groups[value].push(item); return groups; }, {} as Record<string, T[]>); }
function labelize(value: string): string { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function localDateTime(): string { return localDateTimeInput(); }
function apiErrorMessage(caught: unknown): string {
  if (!(caught instanceof ApiError)) {
    return caught instanceof Error ? caught.message : "Something went wrong.";
  }

  const firstValidationMessage = validationMessage(caught.payload);
  if (firstValidationMessage) {
    return firstValidationMessage;
  }

  if (caught.status === 401) return "Please sign in to continue.";
  if (caught.status === 403) return caught.message || "Your account is not allowed to access this admin area.";
  if (caught.status === 419) return "Your secure session expired. Please try again.";
  if (caught.status === 422) return caught.message || "Please check the form and try again.";
  if (caught.status === 429) return caught.message || "Too many attempts. Please wait and try again.";
  if (caught.status >= 500) return "RiFiTV is having trouble completing that request. Please try again shortly.";

  return caught.message;
}
function validationMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("errors" in payload)) {
    return null;
  }

  const errors = (payload as { errors?: Record<string, unknown> }).errors;
  const first = errors ? Object.values(errors)[0] : null;

  return Array.isArray(first) && first.length > 0 ? String(first[0]) : null;
}
function parseAdminSection(value: string): { active: string; matchId: number | null } {
  const parts = value.split("/").filter(Boolean);
  if (parts[0] === "matches" && parts[2] === "control" && Number(parts[1])) {
    return { active: "match-control", matchId: Number(parts[1]) };
  }
  if (parts[0] === "matches" && parts.includes("live")) {
    return { active: "live", matchId: Number(parts[1]) || null };
  }
  if (parts[0] === "matches" && parts[1] === "control") {
    return { active: "match-control", matchId: null };
  }
  if (parts[0] === "matches" && parts[1] === "live") {
    return { active: "live", matchId: null };
  }
  if (parts[0] === "stream-sources") {
    return { active: "sources", matchId: null };
  }
  if (parts[0] === "audit-log") {
    return { active: "audit", matchId: null };
  }
  if (parts[0] === "system") {
    return { active: "operations", matchId: null };
  }
  return { active: parts[0] ?? "dashboard", matchId: null };
}
