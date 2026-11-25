"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type { ItemKind } from "@/lib/passport/types";
import type { TabId } from "@/lib/passport/shell";

/** File 06: what the app frame offers the screens inside it. */
export type ViewName = "home" | "menu" | "index" | "events" | "inbox";
export interface ViewEntry<T = unknown> { data?: T; error?: string; loading: boolean; at: number; version: number }
export interface AddTarget { kind: ItemKind; id: number; name: string }

const EMPTY: ViewEntry = { loading: false, at: 0, version: 0 };
export const UNAVAILABLE = "Passport is temporarily unavailable. Please try again in a few minutes.";
const OFFLINE = "You seem to be offline. Check your connection and try again.";

/**
 * Each tab's data, kept for as long as the app is open (so moving between tabs never reloads a screen). Made fresh for
 * each signed-in member: the frame starts a new one when someone else signs in, and drops it on sign-out.
 */
export class ViewStore {
  private entries = new Map<ViewName, ViewEntry>();
  private listeners = new Map<ViewName, Set<() => void>>();
  private again = new Set<ViewName>();
  constructor(private onSignedOut: () => void) {}

  get = (name: ViewName): ViewEntry => this.entries.get(name) || EMPTY;
  loaded = (name: ViewName) => this.entries.has(name);
  subscribe = (name: ViewName, fn: () => void) => {
    let set = this.listeners.get(name);
    if (!set) { set = new Set(); this.listeners.set(name, set); }
    set.add(fn);
    return () => { set!.delete(fn); };
  };
  private set(name: ViewName, e: ViewEntry) {
    this.entries.set(name, e);
    this.listeners.get(name)?.forEach((fn) => fn());
  }
  /** Fetch a tab's data. silent: keep showing what is there (no placeholders) while it refreshes. */
  load = async (name: ViewName, { silent = false } = {}) => {
    const cur = this.get(name);
    if (cur.loading) { this.again.add(name); return; }
    this.set(name, { ...cur, loading: true, error: silent ? cur.error : undefined });
    let next: ViewEntry;
    try {
      const res = await fetch(`/api/passport/view/${name}`, { cache: "no-store", headers: { Accept: "application/json" } });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && data.signed_out) { this.onSignedOut(); return; }
      next = res.ok
        ? { data, loading: false, at: Date.now(), version: cur.version + 1 }
        : { ...this.get(name), loading: false, error: (data && data.error) || UNAVAILABLE };
    } catch {
      next = { ...this.get(name), loading: false, error: OFFLINE };
    }
    this.set(name, next);
    if (this.again.delete(name)) void this.load(name, { silent: true });
  };
}

export interface ShellApi {
  views: ViewStore;
  /** The tab on screen (or under the page that is open over it). */
  tab: TabId;
  /** Open the "+ add to list" sheet for a cocktail or bottle. */
  openAdd: (item: AddTarget) => void;
  /** A brief message at the bottom of the screen. */
  toast: (message: string) => void;
  /** Ask for the Inbox dot to be recomputed from this list (My bottles after an answer). */
  setInboxDot: (on: boolean) => void;
  /** File 08: the same for messages, requests and event inquiries (an unread reply, a question waiting). */
  setMessagesDot: (on: boolean) => void;
}

export const ShellContext = createContext<ShellApi | null>(null);
export const useShell = () => useContext(ShellContext);

/** A tab's data from the frame's store. */
export function useView<T>(name: ViewName): ViewEntry<T> {
  const shell = useContext(ShellContext);
  return useSyncExternalStore(
    (fn) => (shell ? shell.views.subscribe(name, fn) : () => {}),
    () => (shell ? shell.views.get(name) : EMPTY) as ViewEntry<T>,
    () => EMPTY as ViewEntry<T>,
  );
}
