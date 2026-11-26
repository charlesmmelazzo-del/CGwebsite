import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

// File 14, Part 4: see websitePhotosCore.ts for where the public site's photos live and what the Bible may fetch.
export * from "./websitePhotosCore";

/** The Bible's Bearer key, compared in constant time. */
export function fromBible(req: Request): boolean {
  const key = process.env.PASSPORT_SYNC_KEY || "";
  const got = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (key.length < 24 || !got) return false;
  const a = createHash("sha256").update(key).digest();
  const b = createHash("sha256").update(got).digest();
  return timingSafeEqual(a, b);
}
