import { NextRequest, NextResponse } from "next/server";
import { forwardSubmission } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST — forward a single submission to an admin-chosen email address.
// Protected by middleware (matcher covers /api/admin/*).
export async function POST(req: NextRequest) {
  try {
    const { to, formName, data, submittedAt } = await req.json();

    if (typeof to !== "string" || !EMAIL_RE.test(to.trim())) {
      return NextResponse.json({ error: "A valid recipient email is required." }, { status: 400 });
    }
    if (typeof data !== "object" || data === null) {
      return NextResponse.json({ error: "Submission data is required." }, { status: 400 });
    }

    const result = await forwardSubmission({
      to: to.trim(),
      formName: typeof formName === "string" && formName ? formName : "Form Submission",
      data,
      submittedAt: typeof submittedAt === "string" ? submittedAt : undefined,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Failed to send email." }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[POST /api/admin/forms/email]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
