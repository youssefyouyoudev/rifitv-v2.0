import { ImageResponse } from "next/og";
import { getMatch } from "@/lib/api";
import { absoluteUrl } from "@/lib/site";
import { formatClockTime, formatMatchDateLabel } from "@/lib/time";
import type { Team } from "@/lib/types";

export const alt = "RiFiTV match preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function MatchOpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const match = await getMatch(slug);

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#050910", color: "#f5fbff", padding: "58px 68px", borderTop: "12px solid #06d7c6" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "#9aabba", fontSize: "28px" }}>
        <span>{match.competition.name}</span>
        <span>RiFiTV</span>
      </div>
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", gap: "46px" }}>
        <TeamPreview team={match.home_team} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "210px" }}>
          <span style={{ fontSize: "54px", fontWeight: 800 }}>{match.status === "live" || match.status === "halftime" ? `${match.home_score ?? 0} - ${match.away_score ?? 0}` : formatClockTime(match.kickoff_at)}</span>
          <span style={{ marginTop: "12px", fontSize: "24px", color: match.status === "live" ? "#f87171" : "#9aabba" }}>{match.status_label ?? "Scheduled"}</span>
        </div>
        <TeamPreview team={match.away_team} />
      </div>
      <div style={{ display: "flex", justifyContent: "center", fontSize: "26px", color: "#9aabba" }}>{formatMatchDateLabel(match)} - Africa/Casablanca</div>
    </div>,
    size,
  );
}

function TeamPreview({ team }: { team: Team }) {
  return (
    <div style={{ width: "320px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      {team.logo_path ? (
        <div style={{ width: "142px", height: "142px", display: "flex", backgroundImage: `url(${absoluteUrl(team.logo_path)})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center" }} />
      ) : (
        <div style={{ width: "142px", height: "142px", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #243247", borderRadius: "12px", fontSize: "44px", fontWeight: 800 }}>{team.short_name ?? team.name.slice(0, 3).toUpperCase()}</div>
      )}
      <span style={{ marginTop: "22px", fontSize: "34px", fontWeight: 700 }}>{team.name}</span>
    </div>
  );
}
