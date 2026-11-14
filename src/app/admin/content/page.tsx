import { redirect } from "next/navigation";

// Retired — About, Club and Shop each have their own panel now.
export default function AdminContentRedirect() {
  redirect("/admin/about");
}
