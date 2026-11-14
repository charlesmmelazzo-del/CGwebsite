import { redirect } from "next/navigation";

// Retired — each page's header and colours now live in that page's own panel
// (the "Header & Style" tab).
export default function AdminPageTextRedirect() {
  redirect("/admin/menu/style");
}
