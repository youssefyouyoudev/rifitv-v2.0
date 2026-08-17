import { permanentRedirect } from "next/navigation";

export default async function FootballPage() {
  permanentRedirect("/matches");
}
