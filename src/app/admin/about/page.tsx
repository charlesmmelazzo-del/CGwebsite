import ContentPagesEditor from "@/components/admin/ContentPagesEditor";

// Legacy route — kept so existing links/bookmarks still resolve.
// Renders the merged Content Pages editor pre-selected to About.
export default function AdminAboutPage() {
  return <ContentPagesEditor initialSlug="about" />;
}
