import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminClient } from "./AdminClient";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
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
});
