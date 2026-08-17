"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTheme(document.documentElement.classList.contains("light") ? "light" : "dark");
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(next);
    window.localStorage.setItem("rifitv-theme", next);
    setTheme(next);
  }

  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-grid h-11 w-11 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground)] outline-none transition hover:border-[var(--brand-cyan)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
