import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { randomUUID } from "crypto";

// ─── Simple in-memory rate limiter — limits form spam per IP ─────────────────
const submits = new Map<string, { count: number; resetAt: number }>();
const MAX_SUBMISSIONS = 5;
const WINDOW_MS       = 60 * 60 * 1000; // 1 hour

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function checkSpam(ip: string): boolean {
  const now = Date.now();
  const entry = submits.get(ip);
  if (!entry || now > entry.resetAt) {
    submits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false; // not spam
  }
  if (entry.count >= MAX_SUBMISSIONS) return true; // blocked
  entry.count++;
  return false;
}

// POST — accept a form submission from a public visitor
export async function POST(req: NextRequest) {
  const ip = getIp(req);
  if (checkSpam(ip)) {
    return NextResponse.json({ error: "Too many submissions. Try again later." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { formId, formName, data } = body;

    if (!formId || typeof data !== "object" || data === null) {
      return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
    }

    // Sanitise: cap data payload size (prevent huge JSON blobs)
    const dataStr = JSON.stringify(data);
    if (dataStr.length > 10_000) {
      return NextResponse.json({ error: "Submission too large" }, { status: 413 });
    }

    const id = randomUUID();

    try {
      const sb = getSupabaseAdmin();
      const { error } = await sb.from("form_submissions").insert({
        id,
        form_id:      formId,
        form_name:    formName ?? formId,
        data,
        submitted_at: new Date().toISOString(),
      });
      if (error) throw error;
    } catch (dbErr) {
      // If Supabase is unavailable, log and return success anyway
      // (don't expose DB errors to the public)
      console.error("[forms/submit] DB error:", dbErr);
    }

    return NextResponse.json({ success: true, id });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// GET is intentionally not exported — form submissions are admin-only data.
// Retrieve them via the authenticated /api/admin/forms endpoint.
