"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  GripVertical,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import ColorPicker from "@/components/ui/ColorPicker";
import ImagePicker from "@/components/ui/ImagePicker";
import { listTemplates } from "@/components/popup/templates/registry";
import type { LeaderboardEntry, PopupCocktail, PopupMenu, PopupStatus } from "@/lib/popup/types";

type EditableCocktail = Partial<PopupCocktail> & { id: string };

const BLANK_MENU: Partial<PopupMenu> = {
  title: "",
  slug: "",
  subtitle: "",
  description: "",
  templateKey: "classic",
  config: {},
  status: "draft",
  voteRankDepth: 3,
  voteWeights: [3, 2, 1],
  votingEnabled: true,
};

export default function PopupEditorPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const isNew = params.id === "new";

  const [menu, setMenu] = useState<Partial<PopupMenu>>(BLANK_MENU);
  const [cocktails, setCocktails] = useState<EditableCocktail[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/popup?id=${encodeURIComponent(params.id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load this pop-up.");
      setMenu(data.menu);
      setCocktails(data.cocktails ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this pop-up.");
    } finally {
      setLoading(false);
    }
  }, [isNew, params.id]);

  useEffect(() => {
    load();
  }, [load]);

  function set<K extends keyof PopupMenu>(key: K, value: PopupMenu[K]) {
    setMenu((m) => ({ ...m, [key]: value }));
    setError(null);
    setNotice(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/popup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menu, cocktails }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save.");

      if (isNew && data.menu?.id) {
        router.push(`/admin/popup/${data.menu.id}`);
        return;
      }
      setMenu(data.menu ?? menu);
      await load();
      setNotice("Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(action: string, goLiveAt?: string) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/popup/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuId: menu.id, action, goLiveAt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update.");
      setMenu(data.menu ?? menu);
      setNotice(
        action === "golive"
          ? "This pop-up is live. Voting on the previous one is now closed."
          : action === "schedule"
            ? "Scheduled. It will go live on its own at that time."
            : action === "archive"
              ? "Archived — voting is closed."
              : "Moved back to draft."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!menu.id) return;
    if (
      !confirm(
        `Delete "${menu.title}" permanently? This removes its cocktails and every vote cast on it. This cannot be undone.`
      )
    )
      return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/popup?id=${encodeURIComponent(menu.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Could not delete.");
      router.push("/admin/popup");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete.");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-16 justify-center">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="max-w-3xl pb-16">
      <Link
        href="/admin/popup"
        className="inline-flex items-center gap-1.5 text-[11px] tracking-wider uppercase text-gray-400 hover:text-gray-700 mb-5"
      >
        <ArrowLeft size={13} /> All pop-ups
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <h1 className="text-lg text-gray-800">
          {isNew ? "New Pop Up" : menu.title || "Untitled pop-up"}
        </h1>
        <button
          onClick={save}
          disabled={saving}
          className="shrink-0 px-5 py-2.5 bg-[#C97D5A] text-white text-xs tracking-wider uppercase hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 text-xs text-green-700">
          {notice}
        </div>
      )}

      {!isNew && (
        <StatusPanel
          menu={menu}
          busy={saving}
          onAction={changeStatus}
        />
      )}

      {/* ── Details ──────────────────────────────────────────────────────── */}
      <Section title="Details" defaultOpen>
        <TextField
          label="Title"
          value={menu.title ?? ""}
          onChange={(v) => set("title", v)}
          placeholder="Neon Nights"
        />
        <TextField
          label="Web address (slug)"
          value={menu.slug ?? ""}
          onChange={(v) => set("slug", v)}
          placeholder="leave blank to build from the title"
          hint={menu.slug ? `/popup/m/${menu.slug}` : "Generated from the title if left blank"}
        />
        <TextField
          label="Subtitle"
          value={menu.subtitle ?? ""}
          onChange={(v) => set("subtitle", v)}
          placeholder="Six cocktails, one night"
        />
        <TextField
          label="Description"
          value={menu.description ?? ""}
          onChange={(v) => set("description", v)}
          multiline
        />
        <div className="pt-1">
          <ImagePicker
            label="Cover image"
            value={menu.coverImageUrl}
            onChange={(url) => set("coverImageUrl", url)}
          />
        </div>
      </Section>

      {/* ── Template ─────────────────────────────────────────────────────── */}
      <Section title="Experience">
        <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
          How this pop-up is presented and what guests can do with it. New experiences appear here
          automatically as we build them.
        </p>
        <div className="space-y-2">
          {listTemplates().map((t) => {
            const selected = (menu.templateKey ?? "classic") === t.key;
            return (
              <button
                key={t.key}
                onClick={() => set("templateKey", t.key)}
                className={`w-full text-left p-3.5 border transition-colors ${
                  selected
                    ? "border-[#C97D5A] bg-[#C97D5A]/[0.06]"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <span className="block text-sm text-gray-800">{t.label}</span>
                <span className="block mt-1 text-[11px] text-gray-400 leading-relaxed">
                  {t.description}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Voting ───────────────────────────────────────────────────────── */}
      <Section title="Voting">
        <label className="flex items-center gap-2.5 mb-4">
          <input
            type="checkbox"
            checked={menu.votingEnabled !== false}
            onChange={(e) => set("votingEnabled", e.target.checked)}
            className="accent-[#C97D5A]"
          />
          <span className="text-xs text-gray-600">Let guests vote on this pop-up</span>
        </label>

        <label className="block mb-4">
          <span className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1.5">
            How many cocktails a guest can rank
          </span>
          <input
            type="number"
            min={1}
            max={10}
            value={menu.voteRankDepth ?? 3}
            onChange={(e) => {
              const depth = Math.min(10, Math.max(1, Number(e.target.value) || 1));
              // Keep whatever the owner already set, and extend by stepping down
              // from the last weight — so a longer ballot never accidentally makes
              // a lower rank worth MORE than the rank above it. New ranks floor at
              // 1 rather than 0: if you let guests rank six, all six should count.
              // The owner can still zero one out by hand.
              const weights: number[] = [];
              for (let i = 0; i < depth; i++) {
                const existing = menu.voteWeights?.[i];
                if (existing !== undefined) weights.push(existing);
                else weights.push(Math.max(1, (weights[i - 1] ?? depth) - 1));
              }
              setMenu((m) => ({ ...m, voteRankDepth: depth, voteWeights: weights }));
            }}
            className="w-24 px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
          />
        </label>

        <div>
          <span className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1.5">
            Points per rank
          </span>
          <p className="text-[11px] text-gray-400 leading-relaxed mb-2.5">
            A guest&apos;s first choice is worth the most; lower picks still count toward the
            leader, for fewer points.
          </p>
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: menu.voteRankDepth ?? 3 }, (_, i) => (
              <label key={i} className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500 whitespace-nowrap">#{i + 1}</span>
                <input
                  type="number"
                  min={0}
                  value={menu.voteWeights?.[i] ?? 0}
                  onChange={(e) => {
                    const next = [...(menu.voteWeights ?? [])];
                    next[i] = Math.max(0, Number(e.target.value) || 0);
                    set("voteWeights", next);
                  }}
                  className="w-16 px-2 py-1.5 border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
                />
              </label>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Colors ───────────────────────────────────────────────────────── */}
      <Section title="Colors">
        <div className="flex flex-wrap gap-5">
          <ColorPicker label="Background" value={menu.bgColor} onChange={(c) => set("bgColor", c ?? "")} />
          <ColorPicker label="Text" value={menu.textColor} onChange={(c) => set("textColor", c ?? "")} />
          <ColorPicker label="Accent" value={menu.accentColor} onChange={(c) => set("accentColor", c ?? "")} />
        </div>
      </Section>

      {/* ── Cocktails ────────────────────────────────────────────────────── */}
      <Section title={`Cocktails (${cocktails.length})`} defaultOpen>
        <CocktailList cocktails={cocktails} onChange={setCocktails} />
      </Section>

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {!isNew && menu.id && <ResultsPanel menuId={menu.id} slug={menu.slug ?? ""} />}

      {!isNew && (
        <button
          onClick={remove}
          disabled={saving}
          className="mt-10 flex items-center gap-2 text-[11px] tracking-wider uppercase text-gray-400 hover:text-red-600 transition-colors disabled:opacity-40"
        >
          <Trash2 size={13} /> Delete this pop-up
        </button>
      )}
    </div>
  );
}

// ─── Status controls ─────────────────────────────────────────────────────────

function StatusPanel({
  menu,
  busy,
  onAction,
}: {
  menu: Partial<PopupMenu>;
  busy: boolean;
  onAction: (action: string, goLiveAt?: string) => void;
}) {
  const [when, setWhen] = useState("");
  const status = (menu.status ?? "draft") as PopupStatus;

  const label: Record<PopupStatus, string> = {
    live: "Live — guests are seeing this now",
    scheduled: "Scheduled",
    draft: "Draft — only visible in the sandbox",
    archived: "Archived — voting is closed",
  };

  return (
    <div className="mb-6 p-5 bg-white border border-gray-200">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-sm text-gray-800">{label[status]}</p>
          {status === "scheduled" && menu.goLiveAt && (
            <p className="mt-1 text-[11px] text-gray-400">
              Launches {new Date(menu.goLiveAt).toLocaleString()}
            </p>
          )}
        </div>
        <a
          href={`/popup/preview/${menu.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[11px] tracking-wider uppercase text-gray-400 hover:text-[#C97D5A] transition-colors"
        >
          Open sandbox <ExternalLink size={11} />
        </a>
      </div>

      <div className="flex flex-wrap gap-2">
        {status !== "live" && (
          <button
            onClick={() => onAction("golive")}
            disabled={busy}
            className="px-4 py-2 bg-green-600 text-white text-[11px] tracking-wider uppercase hover:opacity-90 disabled:opacity-40"
          >
            Go Live Now
          </button>
        )}
        {status !== "draft" && (
          <button
            onClick={() => onAction("draft")}
            disabled={busy}
            className="px-4 py-2 border border-gray-200 text-[11px] tracking-wider uppercase text-gray-500 hover:border-gray-400 disabled:opacity-40"
          >
            Back to Draft
          </button>
        )}
        {status !== "archived" && (
          <button
            onClick={() => onAction("archive")}
            disabled={busy}
            className="px-4 py-2 border border-gray-200 text-[11px] tracking-wider uppercase text-gray-500 hover:border-gray-400 disabled:opacity-40"
          >
            Archive
          </button>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1.5">
            Or schedule a launch
          </span>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
          />
        </label>
        <button
          onClick={() => onAction("schedule", when ? new Date(when).toISOString() : "")}
          disabled={busy || !when}
          className="px-4 py-2 border border-gray-300 text-[11px] tracking-wider uppercase text-gray-600 hover:border-gray-500 disabled:opacity-40"
        >
          Schedule
        </button>
        <p className="w-full text-[11px] text-gray-400 leading-relaxed">
          It goes live on its own at that time — nothing left running, nothing to remember. The
          pop-up that was live becomes archived and its voting closes.
        </p>
      </div>
    </div>
  );
}

// ─── Cocktails ───────────────────────────────────────────────────────────────

function CocktailList({
  cocktails,
  onChange,
}: {
  cocktails: EditableCocktail[];
  onChange: (next: EditableCocktail[]) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = cocktails.findIndex((c) => c.id === active.id);
    const to = cocktails.findIndex((c) => c.id === over.id);
    if (from < 0 || to < 0) return;
    onChange(arrayMove(cocktails, from, to));
  }

  function update(id: string, patch: Partial<PopupCocktail>) {
    onChange(cocktails.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={cocktails.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {cocktails.map((c) => (
              <CocktailCard
                key={c.id}
                cocktail={c}
                onUpdate={(patch) => update(c.id, patch)}
                onRemove={() => onChange(cocktails.filter((x) => x.id !== c.id))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        onClick={() =>
          onChange([
            ...cocktails,
            { id: `new-${Date.now()}`, name: "", active: true, order: cocktails.length },
          ])
        }
        className="mt-3 flex items-center gap-2 px-4 py-2.5 border border-dashed border-gray-300 text-[11px] tracking-wider uppercase text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors w-full justify-center"
      >
        <Plus size={13} /> Add cocktail
      </button>
    </>
  );
}

function CocktailCard({
  cocktail,
  onUpdate,
  onRemove,
}: {
  cocktail: EditableCocktail;
  onUpdate: (patch: Partial<PopupCocktail>) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(!cocktail.name);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cocktail.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className="border border-gray-200 bg-white"
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          {...attributes}
          {...listeners}
          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none"
          aria-label="Reorder"
        >
          <GripVertical size={15} />
        </button>
        <button onClick={() => setOpen((o) => !o)} className="flex-1 flex items-center gap-2 text-left">
          {open ? (
            <ChevronDown size={14} className="text-gray-300" />
          ) : (
            <ChevronRight size={14} className="text-gray-300" />
          )}
          <span className="text-sm text-gray-700">{cocktail.name || "Untitled cocktail"}</span>
          {cocktail.active === false && (
            <span className="text-[10px] tracking-wider uppercase text-gray-400">hidden</span>
          )}
        </button>
        <button onClick={onRemove} className="text-gray-300 hover:text-red-500" aria-label="Remove">
          <Trash2 size={14} />
        </button>
      </div>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-gray-100">
          <TextField
            label="Name"
            value={cocktail.name ?? ""}
            onChange={(v) => onUpdate({ name: v })}
          />
          <TextField
            label="Tagline"
            value={cocktail.tagline ?? ""}
            onChange={(v) => onUpdate({ tagline: v })}
          />
          <TextField
            label="Description"
            value={cocktail.description ?? ""}
            onChange={(v) => onUpdate({ description: v })}
            multiline
          />
          <TextField
            label="Ingredients"
            value={cocktail.ingredients ?? ""}
            onChange={(v) => onUpdate({ ingredients: v })}
            multiline
          />
          <ImagePicker
            label="Image"
            value={cocktail.imageUrl}
            onChange={(url) => onUpdate({ imageUrl: url })}
          />
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={cocktail.active !== false}
              onChange={(e) => onUpdate({ active: e.target.checked })}
              className="accent-[#C97D5A]"
            />
            <span className="text-xs text-gray-600">Show on the pop-up</span>
          </label>
        </div>
      )}
    </div>
  );
}

// ─── Results ─────────────────────────────────────────────────────────────────

function ResultsPanel({ menuId, slug }: { menuId: string; slug: string }) {
  const [results, setResults] = useState<LeaderboardEntry[]>([]);
  const [voterCount, setVoterCount] = useState(0);
  const [sandbox, setSandbox] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/popup/results?menuId=${encodeURIComponent(menuId)}${sandbox ? "&sandbox=1" : ""}`)
      .then((r) => r.json())
      .then((d) => {
        setResults(d.results ?? []);
        setVoterCount(d.voterCount ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [menuId, sandbox]);

  return (
    <Section title="Results" defaultOpen>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={sandbox}
            onChange={(e) => setSandbox(e.target.checked)}
            className="accent-[#C97D5A]"
          />
          <span className="text-xs text-gray-600">Show sandbox test votes instead</span>
        </label>
        <a
          href={`/api/admin/popup/results?menuId=${encodeURIComponent(menuId)}&format=csv${sandbox ? "&sandbox=1" : ""}`}
          download={`${slug}-votes.csv`}
          className="flex items-center gap-1.5 text-[11px] tracking-wider uppercase text-gray-400 hover:text-[#C97D5A] transition-colors"
        >
          <Download size={12} /> Export CSV
        </a>
      </div>

      {loading ? (
        <p className="text-xs text-gray-400 py-6 text-center">Loading…</p>
      ) : results.every((r) => r.totalVotes === 0) ? (
        <p className="text-xs text-gray-400 py-6 text-center border border-dashed border-gray-200">
          No {sandbox ? "sandbox " : ""}votes yet.
        </p>
      ) : (
        <>
          <p className="text-[11px] text-gray-400 mb-2">
            {voterCount} {voterCount === 1 ? "guest has" : "guests have"} voted
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] tracking-widest uppercase text-gray-400 border-b border-gray-200">
                <th className="text-left font-normal py-2 w-8">#</th>
                <th className="text-left font-normal py-2">Cocktail</th>
                <th className="text-right font-normal py-2">Points</th>
                <th className="text-right font-normal py-2">#1 votes</th>
                <th className="text-right font-normal py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.cocktailId} className="border-b border-gray-100">
                  <td className="py-2.5 text-gray-400 tabular-nums">{r.position}</td>
                  <td className="py-2.5 text-gray-800">{r.name}</td>
                  <td className="py-2.5 text-right tabular-nums text-gray-800">{r.points}</td>
                  <td className="py-2.5 text-right tabular-nums text-gray-500">
                    {r.firstPlaceVotes}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-gray-400">{r.totalVotes}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-gray-400 leading-relaxed">
            The CSV lists every individual ballot — who voted, what they picked and at which rank.
          </p>
        </>
      )}
    </Section>
  );
}

// ─── Small shared pieces ─────────────────────────────────────────────────────

function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mb-3 bg-white border border-gray-200">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-5 py-4 text-left"
      >
        {open ? (
          <ChevronDown size={15} className="text-gray-300" />
        ) : (
          <ChevronRight size={15} className="text-gray-300" />
        )}
        <span className="text-xs tracking-widest uppercase text-gray-500">{title}</span>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
}) {
  const cls =
    "w-full px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-gray-400";
  return (
    <label className="block mb-3">
      <span className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1.5">
        {label}
      </span>
      {multiline ? (
        <textarea
          rows={3}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      ) : (
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      )}
      {hint && <span className="block mt-1 text-[10px] text-gray-400">{hint}</span>}
    </label>
  );
}
