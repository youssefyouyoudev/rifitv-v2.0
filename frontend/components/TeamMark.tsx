import Image from "next/image";
import type { Team } from "@/lib/types";

export function TeamMark({ team, size = "md" }: { team: Team; size?: "sm" | "md" | "lg" }) {
  const dimensions = size === "lg" ? "h-14 w-14 text-sm" : size === "sm" ? "h-10 w-10 text-[11px]" : "h-11 w-11 text-xs";
  const imageSize = size === "lg" ? 48 : size === "sm" ? 34 : 38;

  return (
    <div
      className={`${dimensions} grid shrink-0 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-1.5 font-semibold text-[var(--foreground)]`}
      style={{ backgroundColor: team.primary_color ?? undefined }}
      aria-label={team.name}
    >
      {team.logo_path ? (
        <Image src={team.logo_path} alt="" width={imageSize} height={imageSize} className="max-h-full max-w-full object-contain" />
      ) : (
        <span className={team.primary_color === "#ffffff" ? "text-neutral-950" : ""}>
          {team.short_name ?? team.name.slice(0, 3).toUpperCase()}
        </span>
      )}
    </div>
  );
}
