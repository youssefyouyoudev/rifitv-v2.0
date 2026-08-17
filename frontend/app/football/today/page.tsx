import { permanentRedirect } from "next/navigation";

export default async function FootballTodayPage() {
  permanentRedirect("/matches/today");
}
