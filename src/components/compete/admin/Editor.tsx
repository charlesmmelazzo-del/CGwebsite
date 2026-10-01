"use client";

// Admin → Competitions → one event. Tabs for everything from invitations to
// results; each tab saves its own slice of the event.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, ChevronUp, ExternalLink, Loader2, Plus, Printer, RotateCcw, Trash2, Eye, EyeOff } from "lucide-react";
import { TEMPLATE_KEYS, fillTemplate } from "@/lib/compete/defaults";
import { RichText } from "@/lib/compete/richtext";
import type { CompCode, CompEvent, Contestant, FieldDef, Recipe, Sponsor, SponsorProduct, Tier } from "@/lib/compete/types";
import {
  AdminPhoto,
  Badge,
  Btn,
  Card,
  Input,
  Label,
  LinkBox,
  TextArea,
  centralLocalToIso,
  isoToCentralLocal,
} from "./ui";

type Data = { event: CompEvent; sponsors: Sponsor[]; contestants: Contestant[]; codes: CompCode[] };
type TabId = "overview" | "details" | "partners" | "contestants" | "voting" | "tickets" | "rules" | "recipes" | "results";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "details", label: "Details" },
  { id: "partners", label: "Brand Partners" },
  { id: "contestants", label: "Contestants" },
  { id: "voting", label: "Voting" },
  { id: "tickets", label: "Tickets" },
  { id: "rules", label: "Rules & Questions" },
  { id: "recipes", label: "At-Home Recipes" },
  { id: "results", label: "Results" },
];

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || "Something went wrong.");
  return d;
}

export default function Editor({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<TabId>("overview");
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [origin, setOrigin] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await api(`/api/admin/competitions/${id}`, "GET"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    setOrigin(window.location.origin);
    load();
  }, [load]);

  const saveEvent = useCallback(
    async (patch: Partial<CompEvent>) => {
      setError("");
      try {
        await api(`/api/admin/competitions/${id}`, "PATCH", patch);
        await load();
        setFlash("Saved");
        setTimeout(() => setFlash(""), 1600);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [id, load]
  );

  const entry = useCallback(
    async (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) => {
      setError("");
      try {
        const r = await api(`/api/admin/competitions/${id}/entries`, method, body);
        await load();
        return r;
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [id, load]
  );

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-12 justify-center">
        {error ? <span className="text-red-600">{error}</span> : <><Loader2 size={16} className="animate-spin" /> Loading…</>}
      </div>
    );
  }

  const ev = data.event;
  const ctx = { data, ev, origin, saveEvent, entry, reload: load, setError };

  return (
    <div className="max-w-5xl pb-24">
      <Link href="/admin/competitions" className="inline-flex items-center gap-1.5 text-[11px] tracking-wider uppercase text-gray-400 hover:text-gray-700">
        <ArrowLeft size={12} /> All competitions
      </Link>
      <header className="mt-3 mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Badge status={ev.status} />
            {ev.isDemo && <span className="px-2 py-0.5 text-[10px] tracking-wider uppercase bg-purple-50 text-purple-600">Demo</span>}
          </div>
          <h1 className="mt-2 text-xl text-gray-800">{ev.name}</h1>
          <p className="mt-1 text-xs text-gray-400">{ev.featuredSpirit || "No featured spirit yet"}</p>
        </div>
        <div className="flex items-center gap-3">
          {flash && <span className="text-xs text-green-600 flex items-center gap-1"><Check size={13} /> {flash}</span>}
          <a href={`/compete/${ev.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] tracking-wider uppercase text-gray-500 hover:text-[#C97D5A]">
            Guest page <ExternalLink size={11} />
          </a>
          <a href={`/compete/${ev.slug}/host?key=${ev.hostToken}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white text-[11px] tracking-wider uppercase">
            Open Host Controls <ExternalLink size={11} />
          </a>
        </div>
      </header>

      <nav className="flex gap-0 overflow-x-auto border-b border-gray-200 mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-2.5 text-[11px] tracking-wider uppercase whitespace-nowrap border-b-2 -mb-px ${
              tab === t.id ? "border-[#C97D5A] text-[#C97D5A]" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>}

      {tab === "overview" && <Overview {...ctx} go={setTab} />}
      {tab === "details" && <Details {...ctx} onDeleted={() => router.push("/admin/competitions")} />}
      {tab === "partners" && <Partners {...ctx} />}
      {tab === "contestants" && <Contestants {...ctx} />}
      {tab === "voting" && <Voting {...ctx} />}
      {tab === "tickets" && <Tickets {...ctx} />}
      {tab === "rules" && <Rules {...ctx} />}
      {tab === "recipes" && <Recipes {...ctx} />}
      {tab === "results" && <Results {...ctx} />}
    </div>
  );
}

type Ctx = {
  data: Data;
  ev: CompEvent;
  origin: string;
  saveEvent: (p: Partial<CompEvent>) => Promise<void>;
  entry: (m: "POST" | "PATCH" | "DELETE", b: Record<string, unknown>) => Promise<{ id?: string } | undefined>;
  reload: () => Promise<void>;
  setError: (e: string) => void;
};

// ─── Overview ────────────────────────────────────────────────────────────────

function Overview({ data, ev, origin, saveEvent, go }: Ctx & { go: (t: TabId) => void }) {
  const approvedC = data.contestants.filter((c) => c.status === "approved").length;
  const pendingC = data.contestants.filter((c) => c.status === "submitted").length;
  const brandOk = data.sponsors.some((s) => s.status === "approved");
  const brandPending = data.sponsors.some((s) => s.status === "submitted");
  const weights = ev.tiers.reduce((a, t) => a + t.weight, 0);
  const codesOk = ev.tiers.every((t) => data.codes.filter((c) => c.tierId === t.id).length >= t.count);

  const checks: { ok: boolean; label: string; detail: string; tab: TabId }[] = [
    { ok: Boolean(ev.featuredSpirit && ev.eventDate), label: "Event details", detail: ev.eventDate ? "Date and spirit set" : "Add the date and featured spirit", tab: "details" },
    { ok: brandOk, label: "Brand partner approved", detail: brandOk ? "Approved" : brandPending ? "A submission is waiting for review" : "Waiting on the partner’s submission", tab: "partners" },
    { ok: approvedC > 0 && pendingC === 0, label: "Contestants approved", detail: `${approvedC} approved · ${pendingC} waiting for review · ${data.contestants.length} invited`, tab: "contestants" },
    { ok: weights === 100, label: "Voting weights add to 100%", detail: `Currently ${weights}%`, tab: "voting" },
    { ok: codesOk && data.codes.length > 0, label: "Ticket codes generated", detail: `${data.codes.length} codes`, tab: "tickets" },
    { ok: ev.recipes.length > 0, label: "At-home recipes", detail: `${ev.recipes.length} recipe${ev.recipes.length === 1 ? "" : "s"}`, tab: "recipes" },
  ];

  const statuses: { id: CompEvent["status"]; label: string; help: string }[] = [
    { id: "draft", label: "Draft", help: "Hidden. Only you can preview it." },
    { id: "published", label: "Published", help: "Listed on the Events page. Ticket-holders can sign in and browse." },
    { id: "live", label: "Live", help: "The event is underway. Set automatically when the host begins." },
    { id: "finished", label: "Finished", help: "Moves to Past Competitions as a public recap with the winners." },
  ];

  return (
    <div className="space-y-5">
      <Card title="Checklist">
        <ul className="divide-y divide-gray-100">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center gap-3 py-2.5">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center ${c.ok ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-300"}`}>
                <Check size={12} />
              </span>
              <span className="flex-1">
                <span className="text-sm text-gray-800">{c.label}</span>
                <span className="block text-[11px] text-gray-400">{c.detail}</span>
              </span>
              <button onClick={() => go(c.tab)} className="text-[10px] tracking-wider uppercase text-[#C97D5A]">
                Open →
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Status" help="Who can see the event. The host screen moves it to Live and Finished on its own; you can also set it here.">
        <div className="grid sm:grid-cols-4 gap-2">
          {statuses.map((s) => (
            <button
              key={s.id}
              onClick={() => s.id !== ev.status && saveEvent({ status: s.id })}
              className={`text-left p-3 border ${ev.status === s.id ? "border-[#C97D5A] bg-[#C97D5A]/5" : "border-gray-200 hover:border-gray-300"}`}
            >
              <span className="text-xs tracking-wider uppercase text-gray-800">{s.label}</span>
              <span className="block mt-1 text-[11px] text-gray-400 leading-snug">{s.help}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Links">
        <div className="grid gap-4">
          <LinkBox label="Guest link — also on the Events page" url={`${origin}/compete/${ev.slug}`} />
          <LinkBox label="Host link — whoever has this runs the show. Keep it private." url={`${origin}/compete/${ev.slug}/host?key=${ev.hostToken}`} />
          {ev.bigScreen && <LinkBox label="Big screen (TV / projector)" url={`${origin}/compete/${ev.slug}/screen`} />}
        </div>
      </Card>
    </div>
  );
}

// ─── Details ─────────────────────────────────────────────────────────────────

function Details({ ev, saveEvent, setError, onDeleted }: Ctx & { onDeleted: () => void }) {
  const [f, setF] = useState(() => ({
    name: ev.name,
    slug: ev.slug,
    featuredSpirit: ev.featuredSpirit,
    eventDate: ev.eventDate ?? "",
    startTime: ev.startTime,
    arrivalTime: ev.arrivalTime,
    location: ev.location,
    contactEmail: ev.contactEmail,
    intro: ev.intro,
    accentColor: ev.accentColor,
    contestantDeadline: isoToCentralLocal(ev.contestantDeadline),
    partnerDeadline: isoToCentralLocal(ev.partnerDeadline),
    bigScreen: ev.bigScreen,
  }));
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    setSaving(true);
    await saveEvent({
      ...f,
      eventDate: f.eventDate || null,
      contestantDeadline: centralLocalToIso(f.contestantDeadline) || null,
      partnerDeadline: centralLocalToIso(f.partnerDeadline) || null,
    } as Partial<CompEvent>);
    setSaving(false);
  }

  return (
    <div className="space-y-5">
      <Card title="Event">
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="sm:col-span-2"><Label>Event name</Label><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label><Label>Featured spirit</Label><Input value={f.featuredSpirit} onChange={(e) => set("featuredSpirit", e.target.value)} placeholder="e.g. Tequila Cascahuín" /></label>
          <label><Label hint="The address guests use: /compete/…">Link</Label><Input value={f.slug} onChange={(e) => set("slug", e.target.value)} /></label>
          <label><Label>Event date</Label><Input type="date" value={f.eventDate} onChange={(e) => set("eventDate", e.target.value)} /></label>
          <label><Label>Start time (shown to guests)</Label><Input value={f.startTime} onChange={(e) => set("startTime", e.target.value)} placeholder="7:00 PM" /></label>
          <label><Label>Contestant arrival time</Label><Input value={f.arrivalTime} onChange={(e) => set("arrivalTime", e.target.value)} placeholder="5:30 PM" /></label>
          <label><Label>Location</Label><Input value={f.location} onChange={(e) => set("location", e.target.value)} /></label>
          <label><Label hint="Shown on the contestant and partner links, and the locked-out message.">Contact email</Label><Input type="email" value={f.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} /></label>
          <label>
            <Label hint="Buttons, stars and highlights. Try the brand’s color.">Accent color</Label>
            <div className="flex gap-2">
              <input type="color" value={f.accentColor} onChange={(e) => set("accentColor", e.target.value)} className="h-10 w-12 border border-gray-200" />
              <Input value={f.accentColor} onChange={(e) => set("accentColor", e.target.value)} />
            </div>
          </label>
          <label className="sm:col-span-2"><Label hint="Shown to guests on the welcome screen.">Guest welcome text</Label><TextArea value={f.intro} onChange={(e) => set("intro", e.target.value)} /></label>
        </div>
      </Card>

      <Card title="Deadlines" help="Glen Ellyn (Central) time. Links lock after their deadline; you can reopen one person’s link from their card.">
        <div className="grid sm:grid-cols-2 gap-4">
          <label><Label>Contestant submissions</Label><Input type="datetime-local" value={f.contestantDeadline} onChange={(e) => set("contestantDeadline", e.target.value)} /></label>
          <label><Label>Brand partner submission</Label><Input type="datetime-local" value={f.partnerDeadline} onChange={(e) => set("partnerDeadline", e.target.value)} /></label>
        </div>
      </Card>

      <Card title="Big screen" help="An optional TV / projector view that follows the host. Most nights run on guests’ phones alone.">
        <label className="flex items-center gap-3 text-sm text-gray-700">
          <input type="checkbox" checked={f.bigScreen} onChange={(e) => set("bigScreen", e.target.checked)} className="w-4 h-4 accent-[#C97D5A]" />
          Enable the big-screen view
        </label>
      </Card>

      <div className="flex justify-between">
        <Btn
          kind="danger"
          onClick={async () => {
            if (!window.confirm(`Delete “${ev.name}” and everything in it — contestants, codes and votes? This can’t be undone.`)) return;
            try {
              await api(`/api/admin/competitions/${ev.id}`, "DELETE");
              onDeleted();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <Trash2 size={13} /> Delete Competition
        </Btn>
        <Btn onClick={save} disabled={saving}>
          {saving && <Loader2 size={13} className="animate-spin" />} Save Details
        </Btn>
      </div>
    </div>
  );
}

// ─── Review controls shared by partners and contestants ─────────────────────

function ReviewBar({
  kind,
  item,
  entry,
  deadline,
}: {
  kind: "partner" | "contestant";
  item: { id: string; status: string; adminNote: string; reopened: boolean };
  entry: Ctx["entry"];
  deadline: string | null;
}) {
  const [note, setNote] = useState(item.adminNote);
  const [asking, setAsking] = useState(false);
  const pastDeadline = deadline ? new Date(deadline).getTime() < Date.now() : false;

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
      <div className="flex flex-wrap gap-2">
        {item.status !== "approved" ? (
          <Btn small onClick={() => entry("PATCH", { kind, id: item.id, status: "approved" })}>
            <Check size={12} /> Approve &amp; Publish
          </Btn>
        ) : (
          <Btn small kind="ghost" onClick={() => entry("PATCH", { kind, id: item.id, status: "submitted" })}>
            Unapprove
          </Btn>
        )}
        <Btn small kind="ghost" onClick={() => setAsking((a) => !a)}>
          Request Changes
        </Btn>
        {pastDeadline && item.status !== "approved" && (
          <Btn small kind="ghost" onClick={() => entry("PATCH", { kind, id: item.id, reopened: !item.reopened })}>
            {item.reopened ? "Re-lock link" : "Reopen link (past deadline)"}
          </Btn>
        )}
      </div>
      {asking && (
        <div className="space-y-2">
          <Label hint="They’ll see this note when they open their link.">Note for them</Label>
          <TextArea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          <Btn
            small
            onClick={async () => {
              await entry("PATCH", { kind, id: item.id, status: "changes_requested", adminNote: note });
              setAsking(false);
            }}
          >
            Send Back With Note
          </Btn>
        </div>
      )}
    </div>
  );
}

// ─── Brand partners ──────────────────────────────────────────────────────────

function Partners({ data, ev, origin, entry }: Ctx) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <Card
        title="Brand Partners"
        help="Send each partner their private link (or show them the QR code). Their submission lands here for you to edit and approve before guests see it. Usually one per event; add co-sponsors as needed."
        actions={
          <Btn
            small
            onClick={async () => {
              const label = window.prompt("Partner name (for your reference):", "") ?? "";
              await entry("POST", { kind: "partner", label });
            }}
          >
            <Plus size={12} /> Add Partner
          </Btn>
        }
      >
        {data.sponsors.length === 0 && <p className="text-sm text-gray-400">No partners yet.</p>}
      </Card>
      {data.sponsors.map((s) => (
        <Card key={s.id}>
          <div className="flex flex-wrap items-start gap-4">
            <div className="w-24 h-16 bg-gray-800 flex items-center justify-center shrink-0">
              {s.profile.logoUrl ? <img src={s.profile.logoUrl} alt="" className="max-h-12 max-w-[80%] object-contain" /> : <span className="text-[10px] text-gray-500">No logo</span>}
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="flex flex-wrap items-center gap-2">
                <Badge status={s.status} />
                {s.isPrimary && <span className="px-2 py-0.5 text-[10px] tracking-wider uppercase bg-gray-900 text-white">Primary</span>}
                <span className="text-sm text-gray-800">{s.profile.brandName || s.label || "Unnamed partner"}</span>
              </div>
              <p className="mt-1 text-[11px] text-gray-400">
                {s.contact.name ? `${s.contact.name} · ${s.contact.email}` : "No contact yet"}
                {s.submittedAt && ` · submitted ${new Date(s.submittedAt).toLocaleDateString()}`}
              </p>
            </div>
            <div className="flex gap-2">
              {!s.isPrimary && <Btn small kind="ghost" onClick={() => entry("PATCH", { kind: "partner", id: s.id, isPrimary: true })}>Make Primary</Btn>}
              <Btn small kind="ghost" onClick={() => setEditing(editing === s.id ? null : s.id)}>{editing === s.id ? "Close" : "View / Edit"}</Btn>
              <Btn small kind="danger" onClick={() => window.confirm("Delete this partner and their submission?") && entry("DELETE", { kind: "partner", id: s.id })}><Trash2 size={12} /></Btn>
            </div>
          </div>
          <div className="mt-4"><LinkBox label="Private submission link" url={`${origin}/compete/partner/${s.token}`} /></div>
          {editing === s.id && <PartnerEditor sponsor={s} ev={ev} entry={entry} onDone={() => setEditing(null)} />}
          <ReviewBar kind="partner" item={s} entry={entry} deadline={ev.partnerDeadline} />
        </Card>
      ))}
    </div>
  );
}

function PartnerEditor({ sponsor, ev, entry, onDone }: { sponsor: Sponsor; ev: CompEvent; entry: Ctx["entry"]; onDone: () => void }) {
  const [contact, setContact] = useState(sponsor.contact);
  const [p, setP] = useState(sponsor.profile);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof p>) => setP((x) => ({ ...x, ...patch }));
  const setProduct = (i: number, patch: Partial<SponsorProduct>) => set({ products: (p.products ?? []).map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  return (
    <div className="mt-5 pt-5 border-t border-gray-100 space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        <label><Label>Contact name</Label><Input value={contact.name ?? ""} onChange={(e) => setContact({ ...contact, name: e.target.value })} /></label>
        <label><Label>Email</Label><Input value={contact.email ?? ""} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></label>
        <label><Label>Phone</Label><Input value={contact.phone ?? ""} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></label>
      </div>
      <div className="flex flex-wrap gap-6">
        <div><Label>Logo</Label><AdminPhoto eventId={ev.id} contain aspect="aspect-[3/2]" value={p.logoUrl} onChange={(u) => set({ logoUrl: u })} /></div>
        <div><Label>Dark-background logo</Label><AdminPhoto eventId={ev.id} contain aspect="aspect-[3/2]" value={p.logoDarkUrl} onChange={(u) => set({ logoDarkUrl: u })} /></div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <label><Label>Brand name</Label><Input value={p.brandName ?? ""} onChange={(e) => set({ brandName: e.target.value })} /></label>
        <label><Label>Tagline</Label><Input value={p.tagline ?? ""} onChange={(e) => set({ tagline: e.target.value })} /></label>
        <label className="sm:col-span-2"><Label>Story</Label><TextArea rows={8} value={p.story ?? ""} onChange={(e) => set({ story: e.target.value })} /></label>
      </div>
      <div>
        <Label hint="The first photo is the cover.">Photos</Label>
        <div className="flex flex-wrap gap-3">
          {(p.photos ?? []).map((src, i) => (
            <AdminPhoto key={src + i} eventId={ev.id} value={src} onChange={(u) => set({ photos: u ? (p.photos ?? []).map((x, j) => (j === i ? u : x)) : (p.photos ?? []).filter((_, j) => j !== i) })} />
          ))}
          {(p.photos ?? []).length < 8 && <AdminPhoto eventId={ev.id} value="" onChange={(u) => u && set({ photos: [...(p.photos ?? []), u] })} />}
        </div>
      </div>
      <div>
        <Label>Products</Label>
        <div className="space-y-4">
          {(p.products ?? []).map((pr, i) => (
            <div key={pr.id} className="border border-gray-200 p-4 flex gap-4">
              <AdminPhoto eventId={ev.id} contain aspect="aspect-[2/3]" value={pr.photoUrl} onChange={(u) => setProduct(i, { photoUrl: u })} />
              <div className="flex-1 grid sm:grid-cols-2 gap-3">
                <Input placeholder="Name" value={pr.name} onChange={(e) => setProduct(i, { name: e.target.value })} />
                <Input placeholder="Category / style" value={pr.category ?? ""} onChange={(e) => setProduct(i, { category: e.target.value })} />
                <Input placeholder="Origin" value={pr.origin ?? ""} onChange={(e) => setProduct(i, { origin: e.target.value })} />
                <Input placeholder="ABV / proof" value={pr.abv ?? ""} onChange={(e) => setProduct(i, { abv: e.target.value })} />
                <TextArea rows={2} placeholder="How it’s made" value={pr.howMade ?? ""} onChange={(e) => setProduct(i, { howMade: e.target.value })} />
                <TextArea rows={2} placeholder="Tasting notes" value={pr.tastingNotes ?? ""} onChange={(e) => setProduct(i, { tastingNotes: e.target.value })} />
                <button className="text-left text-[10px] tracking-wider uppercase text-red-500" onClick={() => set({ products: (p.products ?? []).filter((_, j) => j !== i) })}>Remove product</button>
              </div>
            </div>
          ))}
          <Btn small kind="ghost" onClick={() => set({ products: [...(p.products ?? []), { id: `p${Date.now()}`, name: "" }] })}><Plus size={12} /> Add Product</Btn>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {(["website", "instagram", "facebook", "tiktok", "whereToBuy"] as const).map((k) => (
          <label key={k}><Label>{k === "whereToBuy" ? "Where to buy" : k}</Label><Input value={p.links?.[k] ?? ""} onChange={(e) => set({ links: { ...(p.links ?? {}), [k]: e.target.value } })} /></label>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Btn kind="ghost" onClick={onDone}>Cancel</Btn>
        <Btn
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            await entry("PATCH", { kind: "partner", id: sponsor.id, data: { contact, profile: p } });
            setSaving(false);
            onDone();
          }}
        >
          {saving && <Loader2 size={13} className="animate-spin" />} Save Changes
        </Btn>
      </div>
    </div>
  );
}

// ─── Contestants ─────────────────────────────────────────────────────────────

function Contestants({ data, ev, origin, entry }: Ctx) {
  const [editing, setEditing] = useState<string | null>(null);
  const list = data.contestants;

  async function move(i: number, dir: -1 | 1) {
    if (!list[i + dir]) return;
    const order = [...list];
    [order[i], order[i + dir]] = [order[i + dir], order[i]];
    // Rewrite every position so the presentation order is always 0..n-1.
    await Promise.all(order.map((c, idx) => (c.sort === idx ? null : entry("PATCH", { kind: "contestant", id: c.id, sort: idx }))));
  }

  return (
    <div className="space-y-4">
      <Card
        title="Contestants"
        help="Create a private link for each bartender, then send it (or show the QR code). The order here is the order they’re presented on the night. Only approved contestants appear to guests."
        actions={
          <Btn
            small
            onClick={async () => {
              const label = window.prompt("Contestant name or bar (for your reference):", "") ?? "";
              await entry("POST", { kind: "contestant", label });
            }}
          >
            <Plus size={12} /> Add Contestant
          </Btn>
        }
      >
        {list.length === 0 && <p className="text-sm text-gray-400">No contestants yet.</p>}
      </Card>
      {list.map((c, i) => {
        const name = c.bartender.name || c.label || "Unnamed contestant";
        return (
          <Card key={c.id}>
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex flex-col">
                <button className="text-gray-300 hover:text-gray-700 disabled:opacity-20" disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp size={16} /></button>
                <span className="text-[10px] text-gray-400 text-center tabular-nums">{i + 1}</span>
                <button className="text-gray-300 hover:text-gray-700 disabled:opacity-20" disabled={i === list.length - 1} onClick={() => move(i, 1)}><ChevronDown size={16} /></button>
              </div>
              <div className="w-14 h-14 bg-gray-800 shrink-0 overflow-hidden">
                {c.bartender.photoUrl && <img src={c.bartender.photoUrl} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge status={c.status} />
                  <span className="text-sm text-gray-800">{name}</span>
                  {c.bartender.bar && <span className="text-xs text-gray-400">· {c.bartender.bar}</span>}
                </div>
                <p className="mt-1 text-[11px] text-gray-400">
                  {c.cocktail.name ? `“${c.cocktail.name}”` : "No cocktail yet"}
                  {c.contact.email && ` · ${c.contact.email}`}
                  {c.contact.phone && ` · ${c.contact.phone}`}
                </p>
              </div>
              <div className="flex gap-2">
                <Btn small kind="ghost" onClick={() => setEditing(editing === c.id ? null : c.id)}>{editing === c.id ? "Close" : "View / Edit"}</Btn>
                <Btn small kind="danger" onClick={() => window.confirm(`Delete ${name} and their votes?`) && entry("DELETE", { kind: "contestant", id: c.id })}><Trash2 size={12} /></Btn>
              </div>
            </div>
            <div className="mt-4"><LinkBox label="Private submission link" url={`${origin}/compete/contestant/${c.token}`} /></div>
            {editing === c.id && <ContestantEditor c={c} ev={ev} entry={entry} onDone={() => setEditing(null)} />}
            <ReviewBar kind="contestant" item={c} entry={entry} deadline={ev.contestantDeadline} />
          </Card>
        );
      })}
    </div>
  );
}

function ContestantEditor({ c, ev, entry, onDone }: { c: Contestant; ev: CompEvent; entry: Ctx["entry"]; onDone: () => void }) {
  const [contact, setContact] = useState(c.contact);
  const [b, setB] = useState(c.bartender);
  const [k, setK] = useState(c.cocktail);
  const [saving, setSaving] = useState(false);
  return (
    <div className="mt-5 pt-5 border-t border-gray-100 space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <label><Label>Email (private)</Label><Input value={contact.email ?? ""} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></label>
        <label><Label>Phone (private)</Label><Input value={contact.phone ?? ""} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></label>
      </div>
      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-xs tracking-wider uppercase text-gray-800">Bartender</h3>
          <div><Label>Headshot</Label><AdminPhoto eventId={ev.id} aspect="aspect-[4/5]" value={b.photoUrl} onChange={(u) => setB({ ...b, photoUrl: u })} /></div>
          {ev.bartenderFields.map((f) => (
            <label key={f.id} className="block">
              <Label>{f.label}</Label>
              {f.type === "text" ? <Input value={b[f.id] ?? ""} onChange={(e) => setB({ ...b, [f.id]: e.target.value })} /> : <TextArea value={b[f.id] ?? ""} onChange={(e) => setB({ ...b, [f.id]: e.target.value })} />}
            </label>
          ))}
        </div>
        <div className="space-y-4">
          <h3 className="text-xs tracking-wider uppercase text-gray-800">Cocktail</h3>
          <div><Label>Cocktail photo</Label><AdminPhoto eventId={ev.id} value={k.photoUrl} onChange={(u) => setK({ ...k, photoUrl: u })} /></div>
          {ev.cocktailFields.map((f) => (
            <label key={f.id} className="block">
              <Label>{f.label}</Label>
              {f.type === "text" ? <Input value={k[f.id] ?? ""} onChange={(e) => setK({ ...k, [f.id]: e.target.value })} /> : <TextArea rows={f.id === "ingredients" ? 6 : 4} value={k[f.id] ?? ""} onChange={(e) => setK({ ...k, [f.id]: e.target.value })} />}
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Btn kind="ghost" onClick={onDone}>Cancel</Btn>
        <Btn
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            await entry("PATCH", { kind: "contestant", id: c.id, data: { contact, bartender: b, cocktail: k }, label: b.name || c.label });
            setSaving(false);
            onDone();
          }}
        >
          {saving && <Loader2 size={13} className="animate-spin" />} Save Changes
        </Btn>
      </div>
    </div>
  );
}

// ─── Voting ──────────────────────────────────────────────────────────────────

function LabelList({ items, onChange, addLabel }: { items: { id: string; label: string }[]; onChange: (v: { id: string; label: string }[]) => void; addLabel: string }) {
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={it.id} className="flex gap-2">
          <Input value={it.label} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <button className="px-2 text-gray-300 hover:text-gray-700 disabled:opacity-20" disabled={i === 0} onClick={() => { const a = [...items]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; onChange(a); }}><ChevronUp size={14} /></button>
          <button className="px-2 text-gray-300 hover:text-red-600" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
        </div>
      ))}
      <Btn small kind="ghost" onClick={() => onChange([...items, { id: `x${Date.now()}`, label: "" }])}><Plus size={12} /> {addLabel}</Btn>
    </div>
  );
}

function Voting({ ev, saveEvent }: Ctx) {
  const [cats, setCats] = useState(ev.scoreCategories);
  const [sups, setSups] = useState(ev.superlatives);
  const [tiers, setTiers] = useState<Tier[]>(ev.tiers);
  const total = tiers.reduce((a, t) => a + (Number(t.weight) || 0), 0);
  const setTier = (i: number, patch: Partial<Tier>) => setTiers(tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const started = ev.liveState.phase !== "lobby" || ev.status === "live" || ev.status === "finished";

  return (
    <div className="space-y-5">
      {started && (
        <div className="px-4 py-3 bg-amber-50 border border-amber-200 text-xs text-amber-800">
          This event has already started. Changing categories or tiers now will change how existing votes are counted.
        </div>
      )}
      <Card title="Attendee tiers" help="Each tier’s scores are averaged, then count for the percentage you set. Judges are a tier too — their ballots open first and they appear by name in the judges’ reveal. The count is how many ticket codes to make.">
        <div className="space-y-2">
          <div className="hidden sm:grid grid-cols-[1fr_90px_90px_80px_30px] gap-2 text-[10px] tracking-wider uppercase text-gray-400">
            <span>Tier</span><span>% of score</span><span>Tickets</span><span>Judges?</span><span />
          </div>
          {tiers.map((t, i) => (
            <div key={t.id} className="grid grid-cols-2 sm:grid-cols-[1fr_90px_90px_80px_30px] gap-2 items-center">
              <Input value={t.label} onChange={(e) => setTier(i, { label: e.target.value })} className="col-span-2 sm:col-span-1" />
              <Input type="number" min={0} max={100} value={t.weight} onChange={(e) => setTier(i, { weight: Number(e.target.value) })} />
              <Input type="number" min={0} value={t.count} onChange={(e) => setTier(i, { count: Number(e.target.value) })} />
              <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={t.isJudge} onChange={(e) => setTier(i, { isJudge: e.target.checked })} className="accent-[#C97D5A]" /> Judges</label>
              <button className="text-gray-300 hover:text-red-600" onClick={() => setTiers(tiers.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2">
            <Btn small kind="ghost" onClick={() => setTiers([...tiers, { id: `tier${Date.now()}`, label: "", weight: 0, isJudge: false, count: 0 }])}><Plus size={12} /> Add Tier</Btn>
            <span className={`text-xs ${total === 100 ? "text-green-600" : "text-red-600"}`}>Total: {total}%{total !== 100 && " — should add up to 100%"}</span>
          </div>
        </div>
      </Card>
      <div className="grid md:grid-cols-2 gap-5">
        <Card title="Scoring categories" help="Every ballot is 1–5 stars in each of these.">
          <LabelList items={cats} onChange={setCats} addLabel="Add Category" />
        </Card>
        <Card title="Superlatives" help="Fun awards voted at the end — one pick each, one person one vote.">
          <LabelList items={sups} onChange={setSups} addLabel="Add Superlative" />
        </Card>
      </div>
      <div className="flex justify-end">
        <Btn onClick={() => saveEvent({ scoreCategories: cats.filter((c) => c.label.trim()), superlatives: sups.filter((s) => s.label.trim()), tiers })}>Save Voting Setup</Btn>
      </div>
    </div>
  );
}

// ─── Tickets ─────────────────────────────────────────────────────────────────

function Tickets({ data, ev, reload, setError }: Ctx) {
  const [busy, setBusy] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const call = async (method: string, body?: unknown) => {
    setBusy(true);
    try {
      await api(`/api/admin/competitions/${ev.id}/codes`, method, body);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const missing = ev.tiers.reduce((a, t) => a + Math.max(0, t.count - data.codes.filter((c) => c.tierId === t.id).length), 0);

  return (
    <div className="space-y-5">
      <Card
        title="Ticket codes"
        help="One code per attendee. Each code works on one phone — the first one that signs in. If someone switches phones, reset their code here. Set how many codes each tier needs on the Voting tab."
        actions={
          <>
            <Btn small kind="ghost" onClick={() => window.open(`/compete/${ev.slug}/tickets`, "_blank")}><Printer size={12} /> Print Tickets / PDF</Btn>
            <Btn small disabled={busy || missing === 0} onClick={() => call("POST")}>{busy && <Loader2 size={12} className="animate-spin" />} Generate {missing > 0 ? `${missing} Codes` : "Codes"}</Btn>
          </>
        }
      >
        <div className="grid sm:grid-cols-3 gap-3">
          {ev.tiers.map((t) => {
            const codes = data.codes.filter((c) => c.tierId === t.id);
            return (
              <div key={t.id} className="border border-gray-200 p-3">
                <div className="text-xs tracking-wider uppercase text-gray-800">{t.label}</div>
                <div className="mt-1 text-[11px] text-gray-400">{codes.length} of {t.count} codes · {codes.filter((c) => c.claimed).length} in use</div>
              </div>
            );
          })}
        </div>
      </Card>

      {ev.tiers.map((t) => {
        const codes = data.codes.filter((c) => c.tierId === t.id);
        if (codes.length === 0) return null;
        return (
          <Card
            key={t.id}
            title={t.label}
            help={t.isJudge ? "Give each judge’s code their name — it’s shown when their scores are revealed." : undefined}
            actions={<Btn small kind="ghost" disabled={busy} onClick={() => window.confirm(`Delete every unused ${t.label} code?`) && call("DELETE", { tierId: t.id })}>Delete unused</Btn>}
          >
            <div className={t.isJudge ? "space-y-2" : "grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2"}>
              {codes.map((c) =>
                t.isJudge ? (
                  <div key={c.id} className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-sm tracking-widest w-20">{c.code}</span>
                    <Input
                      className="!w-56"
                      placeholder="Judge’s name"
                      value={names[c.id] ?? c.name}
                      onChange={(e) => setNames({ ...names, [c.id]: e.target.value })}
                      onBlur={() => names[c.id] !== undefined && names[c.id] !== c.name && call("PATCH", { id: c.id, name: names[c.id] })}
                    />
                    <span className={`text-[10px] tracking-wider uppercase ${c.claimed ? "text-green-600" : "text-gray-400"}`}>{c.claimed ? "In use" : "Unused"}</span>
                    {c.claimed && <button className="text-[10px] tracking-wider uppercase text-[#C97D5A]" onClick={() => window.confirm("Free this code so it can be used on a different phone?") && call("PATCH", { id: c.id, reset: true })}><RotateCcw size={11} className="inline" /> Reset phone</button>}
                  </div>
                ) : (
                  <div key={c.id} className={`border px-2 py-1.5 flex items-center justify-between ${c.claimed ? "border-green-200 bg-green-50" : "border-gray-200"}`}>
                    <span className="font-mono text-xs tracking-widest">{c.code}</span>
                    {c.claimed && <button title="Reset phone" className="text-gray-400 hover:text-[#C97D5A]" onClick={() => window.confirm(`Free ${c.code} so it can be used on a different phone?`) && call("PATCH", { id: c.id, reset: true })}><RotateCcw size={11} /></button>}
                  </div>
                )
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Rules & questions ───────────────────────────────────────────────────────

function FieldsEditor({ fields, onChange }: { fields: FieldDef[]; onChange: (f: FieldDef[]) => void }) {
  const set = (i: number, patch: Partial<FieldDef>) => onChange(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  return (
    <div className="space-y-3">
      {fields.map((f, i) => (
        <div key={f.id} className="border border-gray-200 p-3 space-y-2">
          <div className="flex gap-2">
            <Input value={f.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="Question" />
            <select value={f.type} onChange={(e) => set(i, { type: e.target.value as FieldDef["type"] })} className="border border-gray-200 text-xs px-2">
              <option value="text">Short</option>
              <option value="textarea">Long</option>
            </select>
            <button className="px-2 text-gray-300 hover:text-gray-700 disabled:opacity-20" disabled={i === 0} onClick={() => { const a = [...fields]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; onChange(a); }}><ChevronUp size={14} /></button>
            {f.role ? (
              <span className="px-2 text-[9px] tracking-wider uppercase text-gray-400 self-center" title="Guest screens rely on this one">Required</span>
            ) : (
              <button className="px-2 text-gray-300 hover:text-red-600" onClick={() => onChange(fields.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
            )}
          </div>
          <Input value={f.hint ?? ""} onChange={(e) => set(i, { hint: e.target.value })} placeholder="Helper text under the question (optional)" className="!text-xs" />
        </div>
      ))}
      <Btn small kind="ghost" onClick={() => onChange([...fields, { id: `q${Date.now()}`, label: "", type: "textarea" }])}><Plus size={12} /> Add Question</Btn>
    </div>
  );
}

function Rules({ ev, saveEvent }: Ctx) {
  const [rules, setRules] = useState(ev.rulesText);
  const [bf, setBf] = useState(ev.bartenderFields);
  const [cf, setCf] = useState(ev.cocktailFields);
  const [preview, setPreview] = useState(false);
  const filled = useMemo(() => fillTemplate(rules, ev), [rules, ev]);

  return (
    <div className="space-y-5">
      <Card
        title="Contestant rules & expectations"
        help={
          <>
            Shown on every contestant’s link before they fill anything in; they must agree to continue. Formatting: start a line with <code>### </code> for a heading, <code>- </code> for a bullet, and wrap words in <code>**double asterisks**</code> for bold. These fill in automatically: {TEMPLATE_KEYS.map((k) => `{{${k}}}`).join(", ")}.
          </>
        }
        actions={<Btn small kind="ghost" onClick={() => setPreview((p) => !p)}>{preview ? <><EyeOff size={12} /> Edit</> : <><Eye size={12} /> Preview</>}</Btn>}
      >
        {preview ? (
          <div className="cmp p-6 !min-h-0" style={{ ["--cmp-accent" as string]: ev.accentColor }}>
            <RichText text={filled} className="cmp-prose" />
          </div>
        ) : (
          <TextArea rows={24} value={rules} onChange={(e) => setRules(e.target.value)} className="font-mono !text-xs" />
        )}
      </Card>
      <div className="grid md:grid-cols-2 gap-5">
        <Card title="Bartender questions" help="Shown on the contestant’s “About you” step and on their profile.">
          <FieldsEditor fields={bf} onChange={setBf} />
        </Card>
        <Card title="Cocktail questions" help="Shown on the “Your cocktail” step and on the cocktail’s profile.">
          <FieldsEditor fields={cf} onChange={setCf} />
        </Card>
      </div>
      <div className="flex justify-end">
        <Btn onClick={() => saveEvent({ rulesText: rules, bartenderFields: bf.filter((f) => f.label.trim()), cocktailFields: cf.filter((f) => f.label.trim()) })}>Save Rules & Questions</Btn>
      </div>
    </div>
  );
}

// ─── Recipes ─────────────────────────────────────────────────────────────────

function Recipes({ ev, saveEvent }: Ctx) {
  const [list, setList] = useState<Recipe[]>(ev.recipes);
  const set = (i: number, patch: Partial<Recipe>) => setList(list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-4">
      <Card title="Make Cocktails at Home" help={`Common Good’s own recipes featuring ${ev.featuredSpirit || "the featured spirit"}. Guests can open these from the brand page and save each as an image to their phone.`}>
        <div className="space-y-4">
          {list.map((r, i) => (
            <div key={r.id} className="border border-gray-200 p-4 flex flex-wrap gap-4">
              <div><Label>Photo</Label><AdminPhoto eventId={ev.id} aspect="aspect-[16/10]" value={r.photoUrl} onChange={(u) => set(i, { photoUrl: u })} /></div>
              <div className="flex-1 min-w-[260px] space-y-3">
                <Input placeholder="Cocktail name" value={r.name} onChange={(e) => set(i, { name: e.target.value })} />
                <Input placeholder="Short description (optional)" value={r.description ?? ""} onChange={(e) => set(i, { description: e.target.value })} />
                <div className="grid sm:grid-cols-2 gap-3">
                  <label><Label hint="One per line">Ingredients</Label><TextArea rows={6} value={r.ingredients} onChange={(e) => set(i, { ingredients: e.target.value })} /></label>
                  <label><Label>Method</Label><TextArea rows={6} value={r.method} onChange={(e) => set(i, { method: e.target.value })} /></label>
                </div>
                <div className="flex gap-3 text-[10px] tracking-wider uppercase">
                  <button className="text-gray-400 disabled:opacity-30" disabled={i === 0} onClick={() => { const a = [...list]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; setList(a); }}>Move up</button>
                  <button className="text-red-500" onClick={() => setList(list.filter((_, j) => j !== i))}>Remove</button>
                </div>
              </div>
            </div>
          ))}
          <Btn small kind="ghost" onClick={() => setList([...list, { id: `r${Date.now()}`, name: "", ingredients: "", method: "" }])}><Plus size={12} /> Add Recipe</Btn>
        </div>
      </Card>
      <div className="flex justify-end">
        <Btn onClick={() => saveEvent({ recipes: list.filter((r) => r.name.trim()) })}>Save Recipes</Btn>
      </div>
    </div>
  );
}

// ─── Results (admin only) ────────────────────────────────────────────────────

type Results = {
  items: { key: string; label: string; leaders: string[]; winner: string | null }[];
  scores: { contestantId: string; overall: number | null; tiers: { tierId: string; ballots: number; average: number | null }[] }[];
  superlativeCounts: Record<string, Record<string, number>>;
};

function Results({ data, ev }: Ctx) {
  const [show, setShow] = useState(false);
  const [r, setR] = useState<Results | null>(null);
  const name = (id: string) => {
    const c = data.contestants.find((x) => x.id === id);
    return c?.bartender.name || c?.label || "—";
  };

  useEffect(() => {
    if (show) api(`/api/admin/competitions/${ev.id}/results`, "GET").then(setR).catch(() => {});
  }, [show, ev.id]);

  if (!show) {
    return (
      <Card title="Results" help="The full tally — scores by tier and superlative counts. Guests and the host never see numbers, only the winners the host reveals.">
        <Btn kind="ghost" onClick={() => setShow(true)}><Eye size={13} /> Show the scores</Btn>
      </Card>
    );
  }
  if (!r) return <div className="flex items-center gap-2 text-sm text-gray-400 py-8"><Loader2 size={16} className="animate-spin" /> Tallying…</div>;

  const ranked = [...r.scores].sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1));
  return (
    <div className="space-y-5">
      <Card title="Overall" actions={<Btn small kind="ghost" onClick={() => api(`/api/admin/competitions/${ev.id}/results`, "GET").then(setR)}><RotateCcw size={12} /> Refresh</Btn>}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] tracking-wider uppercase text-gray-400 text-left">
                <th className="py-2 pr-4">#</th>
                <th className="py-2 pr-4">Contestant</th>
                <th className="py-2 pr-4">Weighted score</th>
                {ev.tiers.map((t) => <th key={t.id} className="py-2 pr-4">{t.label} ({t.weight}%)</th>)}
              </tr>
            </thead>
            <tbody>
              {ranked.map((s, i) => (
                <tr key={s.contestantId} className="border-t border-gray-100">
                  <td className="py-2 pr-4 text-gray-400">{i + 1}</td>
                  <td className="py-2 pr-4 text-gray-800">{name(s.contestantId)}</td>
                  <td className="py-2 pr-4 font-medium">{s.overall?.toFixed(2) ?? "—"}</td>
                  {s.tiers.map((t) => <td key={t.tierId} className="py-2 pr-4 text-gray-500">{t.average?.toFixed(2) ?? "—"} <span className="text-[10px] text-gray-400">({t.ballots})</span></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Superlatives">
        <div className="grid sm:grid-cols-2 gap-4">
          {ev.superlatives.map((s) => {
            const counts = Object.entries(r.superlativeCounts[s.id] ?? {}).sort((a, b) => b[1] - a[1]);
            return (
              <div key={s.id} className="border border-gray-200 p-3">
                <div className="text-xs tracking-wider uppercase text-gray-800">{s.label}</div>
                <ul className="mt-2 text-sm space-y-1">
                  {counts.length === 0 && <li className="text-gray-400 text-xs">No picks</li>}
                  {counts.map(([id, n]) => <li key={id} className="flex justify-between"><span>{name(id)}</span><span className="text-gray-400">{n}</span></li>)}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
