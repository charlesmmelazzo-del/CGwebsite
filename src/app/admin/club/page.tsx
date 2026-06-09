import ContentPagesEditor from "@/components/admin/ContentPagesEditor";

// Legacy route — kept so existing links/bookmarks still resolve.
// Renders the merged Content Pages editor pre-selected to Club.
export default function AdminClubPage() {
  return <ContentPagesEditor initialSlug="club" />;
}
