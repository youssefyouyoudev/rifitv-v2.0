import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminClient } from "./AdminClient";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

describe("AdminClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "Authentication is required." }), { status: 401 })));
  });

  it("renders the admin login for protected management", async () => {
    render(<AdminClient />);

    expect(await screen.findByRole("heading", { name: "Admin Login" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("admin@rifitv.local")).toBeInTheDocument();
  });

  it("does not open keyboard search while unauthenticated", async () => {
    render(<AdminClient />);
    await screen.findByRole("heading", { name: "Admin Login" });

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
