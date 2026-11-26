import { redirect } from "next/navigation";

/** File 06: the member's lists live in the Index tab; file 14: at their own level of the drill-down (Index › Lists). */
export default function ListsRoute() {
  redirect("/passport/library?at=lists");
}
