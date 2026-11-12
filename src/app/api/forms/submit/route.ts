import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendFormNotification } from "@/lib/email";
import { randomUUID } from "crypto";
import { getIp, isRateLimited } from "@/lib/rateLimit";

// POST — accept a form submission from a public visitor
export async function POST(req: NextRequest) {
  const ip = getIp(req);
  if (isRateLimited("forms", ip)) {
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

    const resolvedName = formName ?? formId;

    // Persist the submission. If this fails, surface a real error to the visitor
    // instead of a false "Thank you" — otherwise the inquiry is lost silently.
    try {
      const sb = getSupabaseAdmin();
      const { error } = await sb.from("form_submissions").insert({
        id,
        form_id:      formId,
        form_name:    resolvedName,
        data,
        submitted_at: new Date().toISOString(),
      });
      if (error) throw error;
    } catch (dbErr) {
      console.error("[forms/submit] DB error:", dbErr);
      return NextResponse.json(
        { error: "We couldn't save your submission. Please try again or contact us directly." },
        { status: 500 }
      );
    }

    // Fire-and-forget email — never blocks or fails the response. The submission
    // is already saved above, so an email failure doesn't lose data, but log it
    // loudly so a misconfigured mailer is noticed.
    sendFormNotification(resolvedName, data).catch((err) =>
      console.error("[forms/submit] Email notification FAILED (submission was saved):", err)
    );

    return NextResponse.json({ success: true, id });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// GET is intentionally not exported — form submissions are admin-only data.
// Retrieve them via the authenticated /api/admin/forms endpoint.
