import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminClient } from "./AdminClient";

const pathnameState = vi.hoisted(() => ({ value: "/admin" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.value,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const emptyList = { data: [] };
const dashboard = {
  data: {
    counts: { today_matches: 0, live_now: 0 },
    live_now: [],
    attention: { alerts: [], stream_problems: [], unassigned_matches: [] },
  },
};

function mockGuest() {
  vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ message: "Authentication is required." }, 401)));
}

function mockLoginFlow(loginResponse: Response) {
  let authenticated = false;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.endsWith("/sanctum/csrf-cookie")) {
      return new Response(null, { status: 204 });
    }
    if (url.endsWith("/auth/login")) {
      authenticated = loginResponse.status < 400;
      return loginResponse.clone();
    }
    if (url.endsWith("/auth/user")) {
      if (!authenticated) {
        return jsonResponse({ message: "Authentication is required." }, 401);
      }

      return jsonResponse({ data: { id: 1, email: "owner@example.com", active: true, is_admin: true, roles: [] } });
    }
    if (url.endsWith("/admin/dashboard")) {
      return jsonResponse(dashboard);
    }
    if (url.endsWith("/admin/today")) {
      return jsonResponse({ data: { live: [], starting_soon: [], later_today: [], finished: [], readiness: {} } });
    }
    if (url.endsWith("/admin/queue-health")) {
      return jsonResponse({ data: { failed_jobs: 0, pending_jobs: 0 } });
    }
    if (url.endsWith("/admin/health")) {
      return jsonResponse({ data: {} });
    }

    return jsonResponse(emptyList);
  });

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

describe("AdminClient", () => {
  beforeEach(() => {
    pathnameState.value = "/admin";
    mockGuest();
  });

  it("renders the admin login for guests without prefilled credentials", async () => {
    render(<AdminClient />);

    expect(await screen.findByRole("heading", { name: "Admin Login" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("does not treat the expected initial 401 as a visible error", async () => {
    render(<AdminClient />);

    await screen.findByRole("heading", { name: "Admin Login" });
    expect(screen.queryByText("Authentication is required.")).not.toBeInTheDocument();
  });

  it("shows backend validation messages on failed login", async () => {
    mockLoginFlow(jsonResponse({
      message: "The given data was invalid.",
      errors: { email: ["The provided credentials could not be verified."] },
    }, 422));

    render(<AdminClient />);
    await screen.findByRole("heading", { name: "Admin Login" });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "owner@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("The provided credentials could not be verified.")).toBeInTheDocument();
  });

  it("loads the dashboard after successful login", async () => {
    const fetchMock = mockLoginFlow(jsonResponse({ data: { user: { email: "owner@example.com" } } }));

    render(<AdminClient />);
    await screen.findByRole("heading", { name: "Admin Login" });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "owner@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/admin/dashboard"), expect.any(Object)));
  });

  it("shows an authorization error when admin resources return 403", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/auth/user")) {
        return jsonResponse({ data: { id: 2, email: "limited@example.com", active: true, is_admin: true, roles: [] } });
      }

      return jsonResponse({ message: "This action is not allowed." }, 403);
    }));

    render(<AdminClient />);

    expect(await screen.findByRole("heading", { name: "Admin Access Required" })).toBeInTheDocument();
    expect(screen.getByText("This action is not allowed.")).toBeInTheDocument();
  });

  it("does not open keyboard search while unauthenticated", async () => {
    render(<AdminClient />);
    await screen.findByRole("heading", { name: "Admin Login" });

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("requires confirmation in a local delete modal before sending the archive request", async () => {
    pathnameState.value = "/admin/matches";
    const match = {
      id: 7,
      slug: "rc-deportivo-vs-elche",
      home_team: { id: 1, name: "RC Deportivo" },
      away_team: { id: 2, name: "Elche CF" },
      competition: { id: 1, name: "LALIGA EA SPORTS" },
      status: "scheduled",
      status_label: "Scheduled",
      home_score: null,
      away_score: null,
      minute: null,
      featured: false,
      published_at: "2026-08-17T18:00:00Z",
      kickoff_at: "2026-08-17T19:00:00Z",
      scheduled_date: "2026-08-17",
      verification_status: "manual_verified",
      channels: [],
      playback_window: { status: "locked", server_time: "2026-08-17T18:00:00Z", opens_at: null, closes_at: null, seconds_until_open: 3600, seconds_until_close: null },
      admin: { verification_label: "Verified", stream_summary: { channels: 0, sources: 0, enabled_sources: 0, healthy_sources: 0 }, warnings: [] },
    };
    const fetchMock = mockLoginFlow(jsonResponse({ data: { user: { email: "owner@example.com" } } }));
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/auth/user")) return jsonResponse({ data: { id: 1, email: "owner@example.com", active: true, is_admin: true, roles: [] } });
      if (url.includes("/admin/matches")) return jsonResponse({ data: [match], admin_meta: { timezone: "Africa/Casablanca", counters: { today: 1, live: 0, upcoming: 1, finished: 0, needs_channel: 1, needs_verification: 0, featured: 0 }, counter_labels: {}, attention: [] }, meta: { current_page: 1, last_page: 1, total: 1, per_page: 50 } });
      if (init?.method === "DELETE") return jsonResponse({ data: { message: "Match archived" } });
      return jsonResponse(emptyList);
    });

    render(<AdminClient />);
    expect(await screen.findByRole("heading", { level: 1, name: "Matches" })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "More match actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByRole("heading", { name: "Delete match?" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/admin/matches/7"), expect.objectContaining({ method: "DELETE" }));

    fireEvent.click(screen.getByRole("button", { name: "Delete Match" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/admin/matches/7"), expect.objectContaining({ method: "DELETE", body: JSON.stringify({ confirm_delete: true }) })));
    expect(await screen.findByText("Match deleted.")).toBeInTheDocument();
  });

  it("keeps delete validation inside the confirmation modal", async () => {
    pathnameState.value = "/admin/matches";
    const match = {
      id: 8,
      slug: "delete-validation-match",
      home_team: { id: 1, name: "Home" },
      away_team: { id: 2, name: "Away" },
      competition: { id: 1, name: "League" },
      status: "scheduled",
      status_label: "Scheduled",
      home_score: null,
      away_score: null,
      minute: null,
      featured: false,
      published_at: null,
      kickoff_at: "2026-08-17T19:00:00Z",
      scheduled_date: "2026-08-17",
      verification_status: "manual_verified",
      channels: [],
      playback_window: { status: "locked", server_time: "2026-08-17T18:00:00Z", opens_at: null, closes_at: null, seconds_until_open: 3600, seconds_until_close: null },
      admin: { verification_label: "Verified", stream_summary: { channels: 0, sources: 0, enabled_sources: 0, healthy_sources: 0 }, warnings: [] },
    };
    const fetchMock = mockLoginFlow(jsonResponse({ data: { user: { email: "owner@example.com" } } }));
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/auth/user")) return jsonResponse({ data: { id: 1, email: "owner@example.com", active: true, is_admin: true, roles: [] } });
      if (url.includes("/admin/matches")) {
        if (init?.method === "DELETE") return jsonResponse({ message: "The given data was invalid.", errors: { confirm_delete: ["The confirm delete field must be accepted."] } }, 422);
        return jsonResponse({ data: [match], admin_meta: { timezone: "Africa/Casablanca", counters: { today: 1, live: 0, upcoming: 1, finished: 0, needs_channel: 1, needs_verification: 0, featured: 0 }, counter_labels: {}, attention: [] }, meta: { current_page: 1, last_page: 1, total: 1, per_page: 50 } });
      }
      return jsonResponse(emptyList);
    });

    render(<AdminClient />);
    await screen.findByRole("heading", { level: 1, name: "Matches" });
    fireEvent.click(await screen.findByRole("button", { name: "More match actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Match" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The confirm delete field must be accepted.");
    expect(screen.getByRole("heading", { name: "Delete match?" })).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong.")).not.toBeInTheDocument();
  });
});
