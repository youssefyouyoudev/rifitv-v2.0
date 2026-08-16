import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { getCompetitions } from "@/lib/api";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Football Competitions",
  description: "Explore the supported football competitions tracked by RiFiTV with fixtures and match information.",
  alternates: { canonical: absoluteUrl("/competitions") },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "Football Competitions",
    description: "Supported football competitions with fixtures and match information.",
    url: absoluteUrl("/competitions"),
  },
  twitter: { card: "summary_large_image", title: "Football Competitions", description: "Supported football competitions on RiFiTV." },
};

export default async function CompetitionsPage() {
  const competitions = await getCompetitions();

  return (
    <AppShell>
      <section className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Competitions</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {competitions.map((competition) => (
            <Link
              key={competition.id}
              href={`/competition/${competition.slug}`}
              className="rounded-lg border border-white/10 bg-neutral-900 p-5 outline-none transition hover:border-red-400/40 hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-red-300"
            >
              <span className="text-lg font-semibold text-white">{competition.name}</span>
              <span className="mt-2 block text-sm text-neutral-400">{competition.short_name}</span>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
