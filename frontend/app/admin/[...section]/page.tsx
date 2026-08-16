import { AdminRoutePage } from "../AdminRoutePage";

export default async function AdminSectionPage({ params }: PageProps<"/admin/[...section]">) {
  const { section } = await params;
  const first = section?.[0] ?? "dashboard";
  const initialSection = first === "matches" && section?.includes("live") ? "live" : section?.join("/") ?? first;

  return <AdminRoutePage section={initialSection} />;
}
