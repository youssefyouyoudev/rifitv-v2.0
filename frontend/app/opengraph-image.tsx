import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "RiFiTV football matches and broadcast information";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const icon = await readFile(join(process.cwd(), "public", "brand", "rifitv-icon-192.png"));
  const iconUrl = `data:image/png;base64,${icon.toString("base64")}`;

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#050910", color: "#f5fbff", padding: "72px", borderTop: "14px solid #06d7c6" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
        <div style={{ width: "96px", height: "96px", display: "flex", backgroundImage: `url(${iconUrl})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center" }} />
        <span style={{ fontSize: "64px", fontWeight: 800 }}>RiFiTV</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: "72px", fontWeight: 800 }}>Football is live here.</span>
        <span style={{ marginTop: "22px", fontSize: "34px", color: "#9aabba" }}>Matches, kickoff times and verified broadcasts in Morocco time</span>
      </div>
    </div>,
    size,
  );
}
