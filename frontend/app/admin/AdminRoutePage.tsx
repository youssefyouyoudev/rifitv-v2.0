import { AdminClient } from "./AdminClient";

export function AdminRoutePage({ section }: { section?: string }) {
  return <AdminClient initialSection={section ?? "dashboard"} />;
}
