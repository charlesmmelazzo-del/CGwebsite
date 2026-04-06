import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { FormSubmission } from "@/types";

// Simple file-based storage for submissions
// In production, this will be Supabase — swap in the Supabase client here
const SUBMISSIONS_FILE = join(process.cwd(), "data", "submissions.json");

function readSubmissions(): FormSubmission[] {
  try {
    if (!existsSync(SUBMISSIONS_FILE)) return [];
    return JSON.parse(readFileSync(SUBMISSIONS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeSubmissions(submissions: FormSubmission[]) {
  const dir = join(process.cwd(), "data");
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2));
  } catch {
    // silent in dev
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { formId, formName, data } = body;

    if (!formId || !data) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const submission: FormSubmission = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      formId,
      formName: formName ?? formId,
      data,
      submittedAt: new Date().toISOString(),
    };

    const existing = readSubmissions();
    writeSubmissions([...existing, submission]);

    return NextResponse.json({ success: true, id: submission.id });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const formId = searchParams.get("formId");

  const all = readSubmissions();
  const filtered = formId ? all.filter((s) => s.formId === formId) : all;

  return NextResponse.json(filtered);
}
