import type { ItemKind } from "@/lib/passport/bible";

/** File 04: shared by server pages and client pieces (no "use client" here, so server pages can call these). */
export const PRIVATE_LINE = "Only you and the Common Good team can see this.";

/** The page an item opens, or null when it can no longer be opened. */
export function itemHref(kind: ItemKind, id: number | null) {
  if (!id) return null;
  return kind === "cocktail" ? `/passport/library/${id}` : `/passport/spirits/${id}`;
}
