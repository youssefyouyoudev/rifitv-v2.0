import type { Competition, HomePayload, Match, PlaybackPayload, SearchPayload, TeamPayload } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_RIFITV_API_BASE ?? "http://127.0.0.1:8000/api/v1";
const API_ORIGIN = apiOrigin(API_BASE);

type ApiEnvelope<T> = { data: T };
type Paginated<T> = {
  data: T[];
  meta?: {
    current_page?: number;
    last_page?: number;
  };
};
type ApiRequestOptions = RequestInit & { timeoutMs?: number };

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function apiOrigin(base: string): string {
  const url = new URL(base);
  url.pathname = "";
  url.search = "";
  url.hash = "";

  return url.toString().replace(/\/$/, "");
}

function xsrfToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookie = document.cookie
    .split("; ")
    .find((value) => value.startsWith("XSRF-TOKEN="));

  return cookie ? decodeURIComponent(cookie.slice("XSRF-TOKEN=".length)) : null;
}

export async function csrfCookie(signal?: AbortSignal): Promise<void> {
  const response = await fetch(`${API_ORIGIN}/sanctum/csrf-cookie`, {
    credentials: "include",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new ApiError("Unable to initialize CSRF protection.", response.status);
  }
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const controller = options.signal ? null : new AbortController();
  const timeout = controller ? window.setTimeout(() => controller.abort(), options.timeoutMs ?? 15000) : null;
  const headers = new Headers(options.headers);
  const method = (options.method ?? "GET").toUpperCase();

  headers.set("Accept", headers.get("Accept") ?? "application/json");
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = xsrfToken();
  if (token && method !== "GET" && method !== "HEAD") {
    headers.set("X-XSRF-TOKEN", token);
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: "include",
      signal: options.signal ?? controller?.signal,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => undefined);
      const message = typeof payload === "object" && payload && "message" in payload
        ? String(payload.message)
        : `RiFiTV API request failed: ${response.status}`;

      throw new ApiError(message, response.status, payload);
    }

    return (await response.json()) as T;
  } finally {
    if (timeout) {
      window.clearTimeout(timeout);
    }
  }
}

async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => undefined);
    const message = typeof payload === "object" && payload && "message" in payload
      ? String(payload.message)
      : `RiFiTV API request failed: ${response.status}`;

    throw new ApiError(message, response.status, payload);
  }

  return (await response.json()) as T;
}

export async function getHome(): Promise<HomePayload> {
  return (await apiGet<ApiEnvelope<HomePayload>>("/home")).data;
}

async function getMatchesPage(status?: string, competition?: string, date?: string, search?: string, territory?: string, page = 1): Promise<Paginated<Match>> {
  const params = new URLSearchParams();
  if (status) {
    params.set("status", status);
  }
  if (competition) {
    params.set("competition", competition);
  }
  if (date) {
    params.set("date", date);
  }
  if (search) {
    params.set("search", search);
  }
  if (territory) {
    params.set("territory", territory);
  }
  params.set("per_page", "50");
  params.set("page", String(page));
  const query = params.toString() ? `?${params.toString()}` : "";

  return apiGet<Paginated<Match>>(`/matches${query}`);
}

export async function getMatches(status?: string, competition?: string, date?: string, search?: string, territory?: string): Promise<Match[]> {
  const firstPage = await getMatchesPage(status, competition, date, search, territory);
  const lastPage = firstPage.meta?.last_page ?? 1;

  if (lastPage <= 1) {
    return firstPage.data;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: lastPage - 1 }, (_, index) => getMatchesPage(status, competition, date, search, territory, index + 2)),
  );

  return [firstPage, ...remainingPages].flatMap((page) => page.data);
}

export async function getAllMatchesForSitemap(): Promise<Match[]> {
  const firstPage = await getMatchesPage();
  const lastPage = firstPage.meta?.last_page ?? 1;

  if (lastPage <= 1) {
    return firstPage.data;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: lastPage - 1 }, (_, index) => getMatchesPage(undefined, undefined, undefined, undefined, undefined, index + 2)),
  );

  return [firstPage, ...remainingPages].flatMap((page) => page.data);
}

export async function getMatch(slug: string, signal?: AbortSignal): Promise<Match> {
  return (await apiGet<ApiEnvelope<Match>>(`/matches/${slug}`, signal)).data;
}

export async function getPlayback(slug: string): Promise<PlaybackPayload> {
  return (await apiGet<ApiEnvelope<PlaybackPayload>>(`/matches/${slug}/playback`)).data;
}

export async function getCompetitions(): Promise<Competition[]> {
  return (await apiGet<Paginated<Competition>>("/competitions")).data;
}

export async function getCompetition(slug: string): Promise<Competition> {
  return (await apiGet<ApiEnvelope<Competition>>(`/competitions/${slug}`)).data;
}

export async function getTeam(slug: string): Promise<TeamPayload> {
  return (await apiGet<ApiEnvelope<TeamPayload>>(`/teams/${slug}`)).data;
}

export async function searchPublic(query: string): Promise<SearchPayload> {
  return (await apiGet<ApiEnvelope<SearchPayload>>(`/search?q=${encodeURIComponent(query)}`)).data;
}

export { API_BASE, API_ORIGIN };
