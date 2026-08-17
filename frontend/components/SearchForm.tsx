"use client";

import type { FormEvent } from "react";
import { trackEvent } from "@/lib/analytics";

export function SearchForm({ query }: { query: string }) {
  function submit(event: FormEvent<HTMLFormElement>): void {
    const form = new FormData(event.currentTarget);
    const value = String(form.get("q") ?? "").trim();
    trackEvent("search_submitted", { query_length: value.length });
  }

  return (
    <form action="/search" className="flex max-w-2xl gap-2" onSubmit={submit}>
      <input
        name="q"
        defaultValue={query}
        minLength={2}
        maxLength={80}
        className="min-h-11 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        placeholder="Search Arsenal, La Liga..."
      />
      <button className="min-h-11 rounded-md bg-[var(--brand-blue)] px-4 font-semibold text-white">Search</button>
    </form>
  );
}
