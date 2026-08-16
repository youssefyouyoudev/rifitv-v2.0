import { AppShell } from "@/components/AppShell";
import { MatchSection } from "@/components/MatchSection";
import { getMatches } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function LivePage() {
  const matches = await getMatches("live");

  return (
    <AppShell>
      <MatchSection title="Live Now" matches={matches} />
    </AppShell>
  );
}
