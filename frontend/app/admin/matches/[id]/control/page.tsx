import { AdminRoutePage } from "../../../AdminRoutePage";

export default async function AdminMatchControlPage({ params }: PageProps<"/admin/matches/[id]/control">) {
  const { id } = await params;

  return <AdminRoutePage section={`matches/${id}/control`} />;
}
