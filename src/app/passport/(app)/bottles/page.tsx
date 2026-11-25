import { redirect } from "next/navigation";

/** File 06: My bottles now lives in the Inbox tab. */
export default function BottlesRoute() {
  redirect("/passport/inbox");
}
