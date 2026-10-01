import Editor from "@/components/compete/admin/Editor";

export default function AdminCompetitionPage({ params }: { params: { id: string } }) {
  return <Editor id={params.id} />;
}
