"use client";

import { useEffect } from "react";
import { remember } from "./recent";
import type { ItemKind } from "@/lib/passport/types";

/** File 14: an item page notes itself for the Index's "Jump back in" (this device only). Draws nothing. */
export default function Remember({ kind, id, name }: { kind: ItemKind; id: number; name: string }) {
  useEffect(() => { remember({ kind, id, name }); }, [kind, id, name]);
  return null;
}
