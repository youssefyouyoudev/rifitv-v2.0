import type { Metadata } from "next";
import { AdPlacement } from "@/components/AdPlacement";
import { SidebarAd } from "@/components/ads/SidebarAd";
import { AppShell } from "@/components/AppShell";
import { CompetitionLogo } from "@/components/CompetitionLogo";
import { Countdown } from "@/components/Countdown";
import { JsonLd } from "@/components/JsonLd";
import { MatchPreferences } from "@/components/MatchPreferences";
import { TeamMark } from "@/components/TeamMark";
import { PreWatchAdGate } from "@/components/PreWatchAdGate";
import { ShareButton } from "@/components/ShareButton";
import { getMatch, getPlayback } from "@/lib/api";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { formatClockTime, formatMatchDateLabel } from "@/lib/time";
import type { Match, PlaybackPayload } from "@/lib/types";
import Link from "next/link";
import { permanentRedirect } from "next/navigation";
import { LiveMatchSummary } from "./LiveMatchSummary";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/match/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const match = await getMatch(slug);
  const title = `مباراة ${match.home_team.name} ضد ${match.away_team.name} - الموعد والقنوات الناقلة`;
  const channels = match.channels.map((channel) => channel.name).join(", ");
  const matchDate = formatMatchDateLabel(match);
  const description = `${match.home_team.name} ضد ${match.away_team.name} في ${match.competition.name}: الموعد ${matchDate}${channels ? ` والقنوات الناقلة ${channels}` : " ومعلومات التغطية"} على RiFiTV.`;
  const url = absoluteUrl(`/match/${match.slug}`);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "article", siteName: SITE_NAME, title, description, url, locale: "ar_MA" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function MatchPage({ params }: PageProps<"/match/[slug]">) {
  const { slug } = await params;
  const match = await getMatch(slug);
  if (match.slug !== slug) {
    permanentRedirect(`/match/${match.slug}`);
  }
  const playback = await getPlayback(match.slug);
  const sportsEventJsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${match.home_team.name} vs ${match.away_team.name}`,
    startDate: match.kickoff_at ?? match.scheduled_date,
    eventStatus: match.status === "finished" ? "https://schema.org/EventCompleted" : match.status === "postponed" ? "https://schema.org/EventPostponed" : match.status === "cancelled" ? "https://schema.org/EventCancelled" : match.status === "live" || match.status === "halftime" ? "https://schema.org/EventInProgress" : "https://schema.org/EventScheduled",
    url: absoluteUrl(`/match/${match.slug}`),
    competitor: [
      { "@type": "SportsTeam", name: match.home_team.name },
      { "@type": "SportsTeam", name: match.away_team.name },
    ],
    organizer: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
    sport: "Soccer",
    inLanguage: "ar-MA",
    superEvent: { "@type": "SportsEvent", name: match.competition.name },
    description: `${match.competition.name} match on ${formatMatchDateLabel(match)}.`,
  };

  const canPlay = playback.status === "open" && playback.sources.length > 0;

  return (
    <AppShell>
      <JsonLd id={`sports-event-${match.id}`} data={sportsEventJsonLd} />
      <JsonLd id={`match-breadcrumb-${match.id}`} data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Matches", item: absoluteUrl("/matches") },
          { "@type": "ListItem", position: 3, name: `${match.home_team.name} vs ${match.away_team.name}`, item: absoluteUrl(`/match/${match.slug}`) },
        ],
      }} />
      <section className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <Link href={`/competition/${match.competition.slug}`} className="text-sm font-semibold uppercase text-[var(--muted)] hover:text-[var(--foreground)]">{match.competition.name}</Link>
          <h1 className="mt-1 text-2xl font-black text-[var(--foreground)]">{match.home_team.name} vs {match.away_team.name}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{formatMatchDateLabel(match)} - {match.status_label ?? match.status}</p>
          <div className="mt-3"><MatchPreferences matchSlug={match.slug} homeTeam={match.home_team} awayTeam={match.away_team} competition={match.competition} kickoffAt={match.kickoff_at} /></div>
        </div>
        <ShareButton title={`${match.home_team.name} vs ${match.away_team.name}`} text={`${match.home_team.name} vs ${match.away_team.name} - ${match.competition.name}`} url={absoluteUrl(`/match/${match.slug}`)} />
      </section>
      <div className="match-layout">
        <section className="space-y-4">
          {canPlay ? (
            <PreWatchAdGate playback={playback} title={`${match.home_team.name} vs ${match.away_team.name}`} />
          ) : (
            <PrematchPanel match={match} playback={playback} />
          )}
          <AdPlacement name="match_below_player" />
        </section>
        <aside className="space-y-4">
          <SidebarAd />
          <LiveMatchSummary initialMatch={match} />
          <BroadcastPanel match={match} playback={playback} />
          <AdPlacement name="match_sidebar" />
          <MatchLinks match={match} />
        </aside>
      </div>
    </AppShell>
  );
}

function MatchLinks({ match }: { match: Match }) {
  return (
    <nav className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5" aria-label="Related match pages">
      <h2 className="text-sm font-semibold uppercase tracking-normal text-[var(--muted)]">Related pages</h2>
      <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
        <Link href={`/team/${match.home_team.slug}`} className="rounded-md border border-[var(--border)] px-3 py-2 text-[var(--foreground)] hover:bg-[var(--surface-muted)]">{match.home_team.name}</Link>
        <Link href={`/team/${match.away_team.slug}`} className="rounded-md border border-[var(--border)] px-3 py-2 text-[var(--foreground)] hover:bg-[var(--surface-muted)]">{match.away_team.name}</Link>
        <Link href={`/competition/${match.competition.slug}`} className="rounded-md border border-[var(--border)] px-3 py-2 text-[var(--foreground)] hover:bg-[var(--surface-muted)]">More {match.competition.name}</Link>
        <Link href="/matches/today" className="rounded-md border border-[var(--border)] px-3 py-2 text-[var(--foreground)] hover:bg-[var(--surface-muted)]">Today&apos;s matches</Link>
      </div>
    </nav>
  );
}

function PrematchPanel({ match, playback }: { match: Match; playback: PlaybackPayload }) {
  const status = playback.status;
  const title = match.status === "finished" || status === "ended"
    ? "Broadcast ended"
    : status === "tbc"
      ? "Kickoff time will be announced"
      : status === "unavailable"
        ? "Broadcast unavailable"
        : "Stream available soon";
  const subtitle = status === "tbc"
    ? "Broadcast access will become available when the kickoff time is confirmed."
    : status === "unavailable"
      ? "No compatible authorized sources are available right now."
      : status === "ended"
        ? "This broadcast window has closed."
        : `Kickoff - ${formatClockTime(match.kickoff_at)}`;

  return (
    <div className="grid min-h-72 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-center sm:min-h-[420px] sm:p-6">
      <div className="mx-auto max-w-xl space-y-5">
        <div className="mx-auto flex w-fit items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-semibold uppercase text-[var(--muted)]">
          <CompetitionLogo competition={match.competition} />
          {match.competition.name}
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <PanelTeam team={match.home_team} />
          <span className="text-sm font-semibold text-[var(--muted)]">VS</span>
          <PanelTeam team={match.away_team} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[var(--foreground)]">{title}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{subtitle}</p>
        </div>
        {status === "locked" || status === "opening_soon" ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <Countdown seconds={playback.window.seconds_until_open} label="Stream available in" />
          </div>
        ) : status === "open" ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <Countdown seconds={playback.window.seconds_until_kickoff} label="Match starts in" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PanelTeam({ team }: { team: Match["home_team"] }) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="mx-auto w-fit"><TeamMark team={team} size="lg" /></div>
      <p className="truncate text-base font-semibold text-[var(--foreground)]">{team.name}</p>
    </div>
  );
}

function BroadcastPanel({ match, playback }: { match: Match; playback: PlaybackPayload }) {
  const hasBroadcasts = (match.broadcasts?.length ?? 0) > 0 || playback.sources.length > 0;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="text-sm font-semibold uppercase tracking-normal text-[var(--muted)]">Available broadcasts</h2>
      <div className="mt-4 space-y-3">
        {match.broadcasts?.map((broadcast) => (
          <div key={broadcast.id} className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-[var(--foreground)]">{broadcast.broadcaster.name}</span>
              <span className="text-xs uppercase text-[var(--muted)]">{broadcast.territory}</span>
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">{broadcast.channel?.name ?? "Channel assignment TBC"}</p>
          </div>
        ))}
        {playback.sources.map((source) => (
          <div key={source.id} className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-[var(--foreground)]">{source.channel_name}</span>
              <span className="text-xs uppercase text-[var(--muted)]">{source.quality ?? source.protocol}</span>
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">{source.name}{source.is_backup ? " backup" : ""}</p>
          </div>
        ))}
        {!hasBroadcasts ? <p className="text-sm text-[var(--muted)]">No authorized broadcast has been assigned yet.</p> : null}
      </div>
    </div>
  );
}
