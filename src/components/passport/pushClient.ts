"use client";

import { postJson } from "./ui";
import type { PushStatus } from "@/lib/passport/types";

/**
 * File 13: notifications on this device (web push), the browser's side.
 *
 * Passport's helper (public/passport/sw.js) is registered with scope "/passport" only, so it never touches the rest of
 * the site. The browser's own permission box only ever opens after the member taps our button (turnOn). The key used
 * to subscribe is the Bible's PUBLIC key, fetched through the website; the private key never leaves the Bible.
 */

export type PushState = "unsupported" | "needs-install" | "blocked" | "on" | "off";

const SW_URL = "/passport/sw.js";
const SCOPE = "/passport";

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return false;
  // iPads report themselves as a Mac with a touch screen.
  return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
export function standalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}
function supported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}
function label(): string {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/iphone/i.test(ua)) return "iPhone";
  if (/ipad/i.test(ua) || (isIos() && !/iphone/i.test(ua))) return "iPad";
  if (/android/i.test(ua)) return "Android";
  if (/mac os x|macintosh/i.test(ua)) return "Mac";
  if (/windows/i.test(ua)) return "Windows";
  return "This browser";
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(SCOPE);
  if (existing) return existing;
  return navigator.serviceWorker.register(SW_URL, { scope: SCOPE });
}

function keyBytes(base64url: string): Uint8Array {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getStatus(endpoint = ""): Promise<PushStatus | null> {
  try {
    const res = await fetch(`/api/passport/push${endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : ""}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { push?: PushStatus };
    return data.push ?? null;
  } catch {
    return null;
  }
}

/** Where this device stands, without asking the member anything. */
export async function pushState(): Promise<PushState> {
  if (isIos() && !standalone()) return "needs-install";
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "off";
  try {
    const reg = await navigator.serviceWorker.getRegistration(SCOPE);
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (!sub) return "off";
    const s = await getStatus(sub.endpoint);
    // The browser has a subscription the Bible doesn't (removed as gone, or a different member signed in): send it again.
    if (s && !s.subscribed) {
      const r = await postJson<{ push: PushStatus }>("/api/passport/push", { subscription: sub.toJSON(), label: label() });
      return r.ok ? "on" : "off";
    }
    return "on";
  } catch {
    return "off";
  }
}

/** Turn notifications on for this device. Only call this from a tap on our own button. */
export async function turnOn(): Promise<{ state: PushState; error?: string }> {
  if (isIos() && !standalone()) return { state: "needs-install" };
  if (!supported()) return { state: "unsupported" };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { state: permission === "denied" ? "blocked" : "off" };
  try {
    const status = await getStatus();
    if (!status?.public_key) return { state: "off", error: "Passport couldn't be reached. Please try again." };
    const reg = await registration();
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(status.public_key) as BufferSource });
    const r = await postJson<{ push: PushStatus }>("/api/passport/push", { subscription: sub.toJSON(), label: label() });
    if (!r.ok) return { state: "off", error: r.data.error || "Couldn't turn notifications on. Please try again." };
    return { state: "on" };
  } catch {
    return { state: "off", error: "This browser couldn't turn notifications on. Please try again." };
  }
}

/** Turn notifications off for this device (the browser forgets it, and so does the Bible). */
export async function turnOff(): Promise<{ state: PushState; error?: string }> {
  try {
    const reg = supported() ? await navigator.serviceWorker.getRegistration(SCOPE) : undefined;
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      await postJson("/api/passport/push", { endpoint: sub.endpoint }, "DELETE");
      await sub.unsubscribe().catch(() => false);
    }
    return { state: "off" };
  } catch {
    return { state: "off", error: "Couldn't turn notifications off. Please try again." };
  }
}

// ── "Used the app for a bit": the Home prompt never shows on a first open ─────
const OPENS = "cg-passport-opens";
const PROMPT = "cg-passport-push-prompt";
function read(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function store(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* storage blocked */ } }

/** Counted once per page load of the app: how many opens, and on how many different days. */
export function countOpen(today = new Date().toLocaleDateString("en-CA")): void {
  let v: { n: number; days: string[] } = { n: 0, days: [] };
  try { const p = JSON.parse(read(OPENS) || "null"); if (p && typeof p.n === "number" && Array.isArray(p.days)) v = p; } catch { /* new */ }
  v.n += 1;
  if (!v.days.includes(today)) v.days = [...v.days, today].slice(-10);
  store(OPENS, JSON.stringify(v));
}
/** At least four opens on at least two different days. */
export function usedForABit(): boolean {
  try {
    const p = JSON.parse(read(OPENS) || "null");
    return !!p && p.n >= 4 && Array.isArray(p.days) && p.days.length >= 2;
  } catch { return false; }
}
export const promptDone = () => !!read(PROMPT);
export const markPromptDone = (how: "dismissed" | "answered") => store(PROMPT, how);
