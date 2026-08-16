import Image from "next/image";
import type { Competition } from "@/lib/types";

export function CompetitionLogo({ competition, size = "sm" }: { competition: Competition; size?: "sm" | "md" }) {
  const box = size === "md" ? "h-7 w-7" : "h-5 w-5";
  const imageSize = size === "md" ? 28 : 20;

  return (
    <span className={`${box} grid shrink-0 place-items-center rounded-md bg-[var(--surface-muted)] p-0.5`}>
      {competition.logo_path ? (
        <Image src={competition.logo_path} alt="" width={imageSize} height={imageSize} className="h-full w-full object-contain" />
      ) : (
        <span className="text-[10px] font-semibold">{competition.short_name ?? competition.name.slice(0, 2)}</span>
      )}
    </span>
  );
}
