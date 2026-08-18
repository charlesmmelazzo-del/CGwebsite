// ─── Preview-site password gate ──────────────────────────────────────────────
//
// Lets a staging copy of the site run on a public URL without being public.
//
// Entirely driven by the PREVIEW_PASSWORD environment variable:
//
//   * Set on the staging Railway service  → the whole site asks for a password
//     before it will show anything, via the browser's own sign-in box.
//   * Not set (production)                → this does nothing at all, and the
//     request continues exactly as it did before.
//
// HTTP Basic auth on purpose: no login page to build, no cookie to manage, and
// the browser remembers it for the session. It is a "keep the public out of the
// test site" measure, not a serious authentication system — the admin panel and
// guest accounts keep their own real protection underneath.

import { NextRequest, NextResponse } from "next/server";

const REALM = 'Basic realm="Common Good preview", charset="UTF-8"';

/** Length-safe comparison that doesn't leak the password through timing. */
function matches(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Returns a 401 challenge when the site is in preview mode and the request
 * hasn't supplied the password, or null to let the request through.
 */
export function previewGate(req: NextRequest): NextResponse | null {
  const expected = process.env.PREVIEW_PASSWORD;
  // Production has no PREVIEW_PASSWORD, so this is a single env read and out.
  if (!expected) return null;

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const sep = decoded.indexOf(":");
      // Any username is accepted — there's only one secret to get right.
      const supplied = sep >= 0 ? decoded.slice(sep + 1) : "";
      if (matches(supplied, expected)) return null;
    } catch {
      // Malformed header — fall through to the challenge below.
    }
  }

  return new NextResponse("This is a private preview of the Common Good site.", {
    status: 401,
    headers: {
      "WWW-Authenticate": REALM,
      // Belt and braces: a preview must never be indexed even if someone
      // guesses the password or a page slips out without the gate.
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

/** True when this deployment is a password-protected preview. */
export function isPreviewDeployment(): boolean {
  return Boolean(process.env.PREVIEW_PASSWORD);
}
