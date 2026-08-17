import { Home, List, Radio, Search, Trophy } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { RiFiTVLogo } from "./RiFiTVLogo";
import { ThemeToggle } from "./ThemeToggle";

const nav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/matches", label: "Matches", icon: List },
  { href: "/competitions", label: "Competitions", icon: Trophy },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[var(--background)] text-[var(--foreground)]">
      <a href="#main-content" className="skip-link" data-remote-skip>Skip to content</a>
      <header className="app-header sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur">
        <div className="site-container flex h-16 items-center gap-3 sm:gap-5">
          <Link href="/" className="inline-flex items-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" aria-label="RiFiTV home" data-remote-start>
            <RiFiTVLogo priority className="[&_.theme-logo-dark]:h-9 [&_.theme-logo-light]:h-9" />
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-[var(--muted)] outline-none transition hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <form action="/search" className="ml-auto hidden h-11 w-44 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--muted)] md:flex lg:w-56">
            <Search className="h-4 w-4" aria-hidden="true" />
            <label htmlFor="shell-search" className="sr-only">Search RiFiTV</label>
            <input id="shell-search" name="q" type="search" className="min-h-0 min-w-0 flex-1 bg-transparent text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]" placeholder="Search" />
          </form>
          <Link href="/search" className="ml-auto grid h-11 w-11 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] md:hidden" aria-label="Search">
            <Search className="h-4 w-4" />
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main id="main-content" className="app-main site-container flex-1 pt-5">{children}</main>
      <footer className="site-container hidden border-t border-[var(--border)] py-6 text-sm text-[var(--muted)] md:flex md:items-center md:justify-between">
        <span>RiFiTV</span>
        <nav className="flex items-center gap-5" aria-label="Footer">
          <Link href="/matches">Matches</Link>
          <Link href="/live">Live</Link>
          <Link href="/competitions">Competitions</Link>
          <Link href="/search">Search</Link>
        </nav>
      </footer>
      <nav className="app-mobile-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[var(--border)] bg-[var(--background)] shadow-[0_-8px_24px_rgba(0,0,0,0.28)] md:hidden" aria-label="Mobile">
        {nav.map((item) => {
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
