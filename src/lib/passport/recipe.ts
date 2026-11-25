import "server-only";
import type { NextResponse } from "next/server";
import { bad, text } from "./route";

/**
 * File 04: a bespoke recipe from the browser: only the name, notes and plain-text lines are passed on
 * (the Bible decides who made it and checks everything again).
 */
export function recipeBody(b: Record<string, unknown>): { body: Record<string, unknown> } | { error: NextResponse } {
  const name = text(b.name, 81).trim();
  if (!name) return { error: bad("Give the recipe a name.") };
  const raw = Array.isArray(b.lines) ? b.lines.slice(0, 31) : [];
  if (raw.length > 30) return { error: bad("A recipe can have up to 30 lines.") };
  const lines = raw.map((x) => {
    const l = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
    return { quantity: text(l.quantity, 13), unit: text(l.unit, 20), name: text(l.name, 81), sub_recipe: text(l.sub_recipe, 1001) };
  });
  return { body: { name, notes: text(b.notes, 2001), lines } };
}
