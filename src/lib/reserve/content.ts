import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ReserveContent, ReserveFaq } from "./types";

/**
 * The Reserve page's own content (title, photo, intro, FAQ), edited at
 * /admin/reserve and stored in the single-row `reserve_page` table.
 * Booking rules and policies live in the CG Bible, not here.
 */

export const DEFAULT_RESERVE_CONTENT: ReserveContent = {
  title: "Reserve the Upper Room at Common Good",
  intro:
    "Our Upper Room is a small space above the bar for groups of 6 to 15. You can reserve it for your group at no charge.",
  imageUrl: "",
  imageAlt: "",
  faq: [
    { id: "faq-fee", question: "Is there a fee to reserve?", answer: "No. Reservations are free." },
    {
      id: "faq-food",
      question: "Can we bring food or a cake?",
      answer: "Yes. Outside food is welcome. We ask that you clean up after yourselves and bring your own plates and utensils.",
    },
    {
      id: "faq-decorate",
      question: "Can we decorate?",
      answer: "Decorations, or moving furniture, need our approval ahead of time. Email hello@cgcocktails.com.",
    },
    {
      id: "faq-late",
      question: "What if we're running late?",
      answer:
        "Use the Running Late button on your reservation page or call the bar. If you're more than 15 minutes late and we haven't heard from you, we may release the room.",
    },
    {
      id: "faq-final",
      question: "When is my reservation final?",
      answer: "Once our staff confirm it. You'll get an email, usually within 24 hours.",
    },
    {
      id: "faq-window",
      question: "Can I book the same day or further ahead?",
      answer: "Online booking covers the next two weeks, up to 24 hours ahead. For anything else, give us a call.",
    },
  ],
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

/** Coerce untrusted JSON into ReserveContent, keeping defaults for anything missing. */
export function normalizeReserveContent(raw: unknown): ReserveContent {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const faq: ReserveFaq[] | undefined = Array.isArray(d.faq)
    ? d.faq
        .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
        .slice(0, 50)
        .map((f, i) => ({
          id: str(f.id, 80) || `faq-${i}`,
          question: str(f.question, 300) ?? "",
          answer: str(f.answer, 3000) ?? "",
        }))
        .filter((f) => f.question.trim() || f.answer.trim())
    : undefined;
  return {
    title: str(d.title, 200)?.trim() || DEFAULT_RESERVE_CONTENT.title,
    intro: str(d.intro, 5000) ?? DEFAULT_RESERVE_CONTENT.intro,
    imageUrl: str(d.imageUrl, 2000) ?? "",
    imageAlt: str(d.imageAlt, 300) ?? "",
    faq: faq ?? DEFAULT_RESERVE_CONTENT.faq,
  };
}

/**
 * Saved content merged over the defaults. Falls back to the defaults when the
 * table doesn't exist yet (db/reserve-page.sql not run) or Supabase is unreachable.
 */
export async function getReserveContent(): Promise<ReserveContent> {
  noStore();
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from("reserve_page").select("data").eq("id", 1).maybeSingle();
    if (error || !data?.data) return DEFAULT_RESERVE_CONTENT;
    return normalizeReserveContent(data.data);
  } catch {
    return DEFAULT_RESERVE_CONTENT;
  }
}
