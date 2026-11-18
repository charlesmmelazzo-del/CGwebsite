// npm run test:reserve — the website → Bible client: timeouts, one retry,
// failure logging, the request Idempotency-Key, and rate-limit refunds (QA A2).
// A preload stubs "server-only" so it imports in plain Node.

import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { bible, BibleError, classifyFailure, mayRetry, createRequest, getSlots, idempotencyKeyFor } from "../bible";
import { fromError } from "../route";
import { isRateLimited, LIMITS } from "@/lib/rateLimit";
import type { CreateRequestBody } from "../types";

process.env.RESERVATIONS_SYNC_KEY = "test-key-0123456789abcdefghij";
process.env.BIBLE_API_URL = "https://bible.test";

let checks = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  checks++;
  console.log(`  ✓ ${name}`);
}

type Call = { url: string; init: RequestInit };
const realFetch = globalThis.fetch;
const logs: string[] = [];
console.error = (...a: unknown[]) => logs.push(a.join(" "));
console.warn = (...a: unknown[]) => logs.push(a.join(" "));

/** Replace fetch with a script: each entry answers one call (an Error rejects). */
function script(steps: (Error | { status: number; body: unknown })[]): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const step = steps.shift();
    if (!step) throw new Error("unexpected extra fetch");
    if (step instanceof Error) throw step;
    return new Response(JSON.stringify(step.body), { status: step.status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return calls;
}
const fetchFailed = (code: string) => Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error(code), { code }) });
const timeout = () => Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });

const body: CreateRequestBody = {
  date: "2026-11-25", start_time: "18:00", start_min: 1080, minutes: 120, party_size: 8, room_id: 1, table_id: null,
  occasion_note: "", policy_ack: true, guest: { first_name: "A", last_name: "B", email: "a@b.co", phone: "6305551234" },
};

(async () => {
  console.log("failure classification");
  await test("connect refusals and connect timeouts are 'connect'", () => {
    assert.equal(classifyFailure(fetchFailed("ECONNREFUSED")).kind, "connect");
    assert.equal(classifyFailure(fetchFailed("UND_ERR_CONNECT_TIMEOUT")).kind, "connect");
    assert.equal(classifyFailure(fetchFailed("EAI_AGAIN")).kind, "connect");
  });
  await test("our own per-attempt timeout and header timeouts are 'timeout'", () => {
    assert.equal(classifyFailure(timeout()).kind, "timeout");
    assert.equal(classifyFailure(fetchFailed("UND_ERR_HEADERS_TIMEOUT")).kind, "timeout");
  });
  await test("a reset mid-request is 'network'", () => {
    assert.equal(classifyFailure(fetchFailed("ECONNRESET")).kind, "network");
  });
  await test("retry rules: GETs retry on anything, plain writes only when nothing was sent, keyed writes on anything", () => {
    assert.equal(mayRetry("GET", "timeout", false), true);
    assert.equal(mayRetry("POST", "connect", false), true);
    assert.equal(mayRetry("POST", "timeout", false), false);
    assert.equal(mayRetry("POST", "network", false), false);
    assert.equal(mayRetry("POST", "timeout", true), true);
  });

  console.log("bible()");
  await test("a GET that times out once is retried and succeeds", async () => {
    logs.length = 0;
    const calls = script([timeout(), { status: 200, body: [{ room_id: 1 }] }]);
    const out = await getSlots("2026-11-25", 8);
    assert.equal(calls.length, 2);
    assert.deepEqual(out, [{ room_id: 1 }]);
    assert.match(logs[0], /\[reserve\] Bible GET \/slots failed: phase=timeout error=TimeoutError .*elapsed=\d+ms .*attempt=1 → retrying/);
  });
  await test("a GET failing twice gives up with 503, marked as never answered, and logs both attempts", async () => {
    logs.length = 0;
    const calls = script([fetchFailed("ECONNREFUSED"), fetchFailed("ECONNREFUSED")]);
    await assert.rejects(getSlots("2026-11-25", 8), (e: unknown) => e instanceof BibleError && e.status === 503 && e.reached === false);
    assert.equal(calls.length, 2);
    assert.equal(logs.filter((l) => l.includes("phase=connect error=TypeError/ECONNREFUSED")).length, 2);
  });
  await test("a plain write that times out is NOT retried (it may have arrived)", async () => {
    const calls = script([timeout()]);
    await assert.rejects(bible("POST", "/r/x/messages", { body: "hi" }), (e: unknown) => e instanceof BibleError && !e.reached);
    assert.equal(calls.length, 1);
  });
  await test("a plain write that never connected IS retried", async () => {
    const calls = script([fetchFailed("ECONNREFUSED"), { status: 201, body: { ok: true } }]);
    await bible("POST", "/r/x/messages", { body: "hi" });
    assert.equal(calls.length, 2);
  });
  await test("POST /requests sends an Idempotency-Key and retries a timeout with the same key", async () => {
    const calls = script([timeout(), { status: 200, body: { token: "t", status: "requested", replayed: true } }]);
    const out = await createRequest(body, "key-abcdefghijklmnop");
    assert.equal(out.token, "t");
    assert.equal(calls.length, 2);
    const keys = calls.map((c) => (c.init.headers as Record<string, string>)["Idempotency-Key"]);
    assert.deepEqual(keys, ["key-abcdefghijklmnop", "key-abcdefghijklmnop"]);
  });
  await test("a Bible error answer is not retried and keeps its message", async () => {
    const calls = script([{ status: 409, body: { error: "Sorry, that time is no longer available." } }]);
    await assert.rejects(createRequest(body, "key-abcdefghijklmnop"), (e: unknown) => e instanceof BibleError && e.status === 409 && e.reached);
    assert.equal(calls.length, 1);
  });

  console.log("idempotency key");
  await test("same submission + same request → same key; a changed request → a new key", () => {
    const a = idempotencyKeyFor("sub-12345678", body);
    assert.equal(a, idempotencyKeyFor("sub-12345678", body));
    assert.notEqual(a, idempotencyKeyFor("sub-12345678", { ...body, start_time: "19:00", start_min: 1140 }));
    assert.notEqual(a, idempotencyKeyFor("sub-87654321", body));
    assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  });
  await test("a missing or junk submission id still gets a usable, unique key", () => {
    const a = idempotencyKeyFor("", body);
    assert.match(a, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(a, idempotencyKeyFor("", body));
  });

  console.log("rate limit refund");
  await test("an attempt that never reached the Bible doesn't use up a guest's request", () => {
    const req = new NextRequest("https://site.test/api/reserve/request", { headers: { "x-forwarded-for": "203.0.113.9" } });
    const ip = "203.0.113.9";
    for (let i = 0; i < LIMITS.request.max - 1; i++) assert.equal(isRateLimited("request", ip), false);
    // The last allowed try fails without an answer from the Bible...
    assert.equal(isRateLimited("request", ip), false);
    fromError(new BibleError(503, "x", {}, false), { req, bucket: "request" });
    // ...so the guest can still try once more.
    assert.equal(isRateLimited("request", ip), false);
    assert.equal(isRateLimited("request", ip), true);
  });
  await test("a real answer from the Bible still counts", () => {
    const req = new NextRequest("https://site.test/api/reserve/request", { headers: { "x-forwarded-for": "203.0.113.10" } });
    const ip = "203.0.113.10";
    for (let i = 0; i < LIMITS.request.max; i++) isRateLimited("request", ip);
    fromError(new BibleError(409, "taken"), { req, bucket: "request" });
    assert.equal(isRateLimited("request", ip), true);
  });

  globalThis.fetch = realFetch;
  console.log(`\n${checks} passed`);
})().catch((e) => {
  globalThis.fetch = realFetch;
  process.stdout.write(`FAILED: ${e?.stack || e}\n`);
  process.exit(1);
});
