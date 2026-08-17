import { CalendarDays, Home, List, Radio, Search, Trophy } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { RiFiTVLogo } from "./RiFiTVLogo";
import { ThemeToggle } from "./ThemeToggle";

const nav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/football/today", label: "Today", icon: CalendarDays },
  { href: "/matches", label: "Matches", icon: List },
  { href: "/competitions", label: "Competitions", icon: Trophy },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1360px] items-center gap-5 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" aria-label="RiFiTV home">
            <RiFiTVLogo priority className="[&_.theme-logo-dark]:h-9 [&_.theme-logo-light]:h-9" />
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {nav.slice(1).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-[var(--muted)] outline-none transition hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <form action="/search" className="ml-auto hidden h-10 w-44 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--muted)] md:flex lg:w-56">
            <Search className="h-4 w-4" aria-hidden="true" />
            <input name="q" className="min-h-0 flex-1 bg-transparent text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]" placeholder="Search" />
          </form>
          <Link href="/search" className="ml-auto grid h-10 w-10 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] md:hidden" aria-label="Search">
            <Search className="h-4 w-4" />
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-[1360px] px-4 pb-24 pt-5 sm:px-6 lg:px-8">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[var(--border)] bg-[var(--background)] md:hidden" aria-label="Mobile">
        {nav.slice(0, 3).concat({ href: "/competitions", label: "More", icon: List }).map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              className="flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-[var(--muted)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
