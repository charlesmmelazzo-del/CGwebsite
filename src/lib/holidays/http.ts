import { NextResponse } from "next/server";
import { RoomsNotSetUp } from "./roomStore";
import { GameError } from "./types";

/** A game rule said no → 400 with its message; anything else is logged. */
export function failure(e: unknown) {
  if (e instanceof GameError) return NextResponse.json({ error: e.message }, { status: 400 });
  if (e instanceof RoomsNotSetUp) {
    console.error("[holidays]", e.message);
    return NextResponse.json({ error: "Group games aren't switched on yet." }, { status: 503 });
  }
  console.error("[holidays]", e);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
