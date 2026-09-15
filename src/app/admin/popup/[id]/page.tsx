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
import { listGames } from "@/lib/popup/games";
import type { PopupCocktail, PopupMenu, PopupStatus } from "@/lib/popup/types";

type EditableCocktail = Partial<PopupCocktail> & { id: string };

const BLANK_MENU: Partial<PopupMenu> = {
  title: "",
  slug: "",
  subtitle: "",
  description: "",
  templateKey: "classic",
  config: {},
  status: "draft",
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
          ? "This pop-up is live. The previous one is now closed."
          : action === "schedule"
            ? "Scheduled. It will go live on its own at that time."
            : action === "archive"
              ? "Archived — its high score boards are final."
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
        `Delete "${menu.title}" permanently? This removes its cocktails, ticket ranges and every high score set on it. This cannot be undone.`
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

      {/* ── Raffle tickets ───────────────────────────────────────────────── */}
      {!isNew && menu.id && cocktails.some((c) => c.gameKey) && (
        <TicketsPanel menuId={menu.id} cocktails={cocktails} />
      )}

      {/* ── Game winners ─────────────────────────────────────────────────── */}
      {!isNew && menu.id && cocktails.some((c) => c.gameKey) && (
        <WinnersPanel menuId={menu.id} slug={menu.slug ?? ""} status={menu.status ?? "draft"} />
      )}

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
    archived: "Archived — high score boards are final",
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
          pop-up that was live becomes archived and its boards freeze.
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
          <TextField
            label="The story"
            value={cocktail.story ?? ""}
            onChange={(v) => onUpdate({ story: v })}
            multiline
            rows={6}
            hint="A paragraph or more. Blank lines start a new paragraph."
          />
          <ImagePicker
            label="Image"
            value={cocktail.imageUrl}
            onChange={(url) => onUpdate({ imageUrl: url })}
          />

          <label className="block mb-3">
            <span className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1.5">
              Mini game
            </span>
            <select
              value={cocktail.gameKey ?? ""}
              onChange={(e) => onUpdate({ gameKey: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-200 text-sm bg-white focus:outline-none focus:border-gray-400"
            >
              <option value="">No game yet — shows &ldquo;coming soon&rdquo;</option>
              {listGames().map((g) => (
                <option key={g.key} value={g.key}>
                  {g.title}
                </option>
              ))}
            </select>
            <span className="block mt-1 text-[10px] text-gray-400">
              Only used by arcade-style templates. New games appear here as we build them.
            </span>
          </label>
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={cocktail.active !== false}
              onChange={(e) => onUpdate({ active: e.target.checked })}
              className="accent-[#C97D5A]"
            />
            <span className="text-xs text-gray-600">Show on the pop-up</span>
          </label>
          {cocktail.gameKey && (
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={cocktail.meta?.freePlay === true}
                onChange={(e) => onUpdate({ meta: { ...(cocktail.meta ?? {}), freePlay: e.target.checked } })}
                className="accent-[#C97D5A] mt-0.5"
              />
              <span className="text-xs text-gray-600">
                Enable free play
                <span className="block text-[10px] text-gray-400 leading-relaxed">
                  Everyone gets unlimited play on this game, no ticket needed — for when the
                  cocktail has sold out or the pop-up has ended. Off: guests get a 90-second demo
                  until they enter the ticket from their drink. High Score Runs always need a ticket.
                </span>
              </span>
            </label>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Raffle tickets ──────────────────────────────────────────────────────────

interface RangeRow {
  id: string;
  cocktailId: string;
  startSerial: number;
  endSerial: number;
  active: boolean;
  used: number;
}

interface RedemptionRow {
  id: string;
  serial: number;
  cocktailId: string | null;
  guestName: string;
  guestEmail: string;
  redeemedAt: string;
  runsUsed: number;
  runsAllowed: number;
  score: number | null;
}

/**
 * Which ticket numbers unlock which game (with its 3 High Score Runs).
 *
 * Saved the moment they're added — no need to hit the page's Save button — but
 * only for cocktails that have already been saved, since a range hangs off the
 * cocktail's id.
 */
function TicketsPanel({ menuId, cocktails }: { menuId: string; cocktails: EditableCocktail[] }) {
  const [ranges, setRanges] = useState<RangeRow[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/popup/tickets?menuId=${encodeURIComponent(menuId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load tickets.");
      setRanges(data.ranges ?? []);
      setRedemptions(data.redemptions ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load tickets.");
    } finally {
      setLoading(false);
    }
  }, [menuId]);

  useEffect(() => {
    load();
  }, [load]);

  async function call(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) {
    setError(null);
    const res = await fetch(
      method === "DELETE"
        ? `/api/admin/popup/tickets?id=${encodeURIComponent(String(body.id))}`
        : "/api/admin/popup/tickets",
      {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "DELETE" ? undefined : JSON.stringify({ menuId, ...body }),
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not save.");
      return false;
    }
    await load();
    return true;
  }

  const games = cocktails.filter((c) => c.gameKey);
  const nameById = new Map(cocktails.map((c) => [c.id, c.name || "Untitled cocktail"]));

  return (
    <Section title="Raffle Tickets — Unlocks & High Score Runs" defaultOpen>
      <p className="text-[11px] text-gray-400 leading-relaxed mb-4">
        Each ticket number unlocks one game for the guest who enters it — unlimited free play
        instead of the 90-second demo — and gives them 3 High Score Runs on it. Enter the first and
        last number on each roll of tickets for that cocktail. Only High Score Runs go on the
        boards; demo and free play never do.
      </p>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-gray-400 py-6 text-center">Loading…</p>
      ) : (
        <div className="space-y-2">
          {games.map((c) => (
            <TicketGame
              key={c.id}
              cocktail={c}
              ranges={ranges.filter((r) => r.cocktailId === c.id)}
              onAdd={(startSerial, endSerial) => call("POST", { cocktailId: c.id, startSerial, endSerial })}
              onToggle={(r) => call("PATCH", { id: r.id, active: !r.active })}
              onDelete={(r) => {
                if (
                  confirm(
                    `Remove tickets ${r.startSerial}–${r.endSerial}? Tickets from it that haven't been played will stop working. Scores already set stay on the board.`
                  )
                )
                  call("DELETE", { id: r.id });
              }}
            />
          ))}
        </div>
      )}

      {redemptions.length > 0 && (
        <div className="mt-6">
          <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-2">
            Recently entered tickets
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] tracking-widest uppercase text-gray-400 border-b border-gray-200">
                  <th className="text-left font-normal py-2">Ticket</th>
                  <th className="text-left font-normal py-2">Game</th>
                  <th className="text-left font-normal py-2">Guest</th>
                  <th className="text-right font-normal py-2">Runs</th>
                  <th className="text-right font-normal py-2">Best</th>
                  <th className="text-right font-normal py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {redemptions.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="py-2 tabular-nums text-gray-800">{r.serial}</td>
                    <td className="py-2 text-gray-600">{(r.cocktailId && nameById.get(r.cocktailId)) || "—"}</td>
                    <td className="py-2 text-gray-600">
                      {r.guestName}
                      <span className="block text-[10px] text-gray-400 break-all">{r.guestEmail}</span>
                    </td>
                    <td className="py-2 text-right tabular-nums text-gray-600">
                      {r.runsUsed} / {r.runsAllowed}
                    </td>
                    <td className="py-2 text-right tabular-nums text-gray-800">
                      {r.score !== null ? r.score.toLocaleString() : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="py-2 text-right text-gray-400 whitespace-nowrap">
                      {new Date(r.redeemedAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Section>
  );
}

function TicketGame({
  cocktail,
  ranges,
  onAdd,
  onToggle,
  onDelete,
}: {
  cocktail: EditableCocktail;
  ranges: RangeRow[];
  onAdd: (start: string, end: string) => Promise<boolean>;
  onToggle: (r: RangeRow) => void;
  onDelete: (r: RangeRow) => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const unsaved = cocktail.id.startsWith("new-");
  const game = listGames().find((g) => g.key === cocktail.gameKey);

  async function add() {
    setBusy(true);
    if (await onAdd(start, end)) {
      setStart("");
      setEnd("");
    }
    setBusy(false);
  }

  const input =
    "w-32 px-2.5 py-1.5 border border-gray-200 text-sm tabular-nums focus:outline-none focus:border-gray-400";

  return (
    <div className="border border-gray-200 p-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm text-gray-800">{cocktail.name || "Untitled cocktail"}</span>
        <span className="text-[10px] tracking-wider uppercase text-gray-400">{game?.title}</span>
      </div>

      {unsaved ? (
        <p className="mt-2 text-xs text-gray-400">Save the pop-up first, then add tickets here.</p>
      ) : (
        <>
          {ranges.length === 0 ? (
            <p className="mt-2 text-xs text-amber-700">
              No tickets yet — nobody can unlock this game or play a High Score Run on it.
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {ranges.map((r) => {
                const total = r.endSerial - r.startSerial + 1;
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className={`tabular-nums ${r.active ? "text-gray-800" : "text-gray-400 line-through"}`}>
                      {r.startSerial} – {r.endSerial}
                    </span>
                    <span className="text-gray-400">
                      {r.used.toLocaleString()} of {total.toLocaleString()} used
                    </span>
                    <button
                      onClick={() => onToggle(r)}
                      className="ml-auto text-[10px] tracking-wider uppercase text-gray-400 hover:text-gray-700"
                    >
                      {r.active ? "Pause" : "Resume"}
                    </button>
                    <button
                      onClick={() => onDelete(r)}
                      className="text-gray-300 hover:text-red-500"
                      aria-label="Remove range"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              inputMode="numeric"
              placeholder="First #"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className={input}
            />
            <span className="text-gray-300">–</span>
            <input
              inputMode="numeric"
              placeholder="Last #"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className={input}
            />
            <button
              onClick={add}
              disabled={busy || !start || !end}
              className="px-3 py-1.5 border border-gray-300 text-[11px] tracking-wider uppercase text-gray-600 hover:border-gray-500 disabled:opacity-40"
            >
              {busy ? "Adding…" : "Add range"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Game winners (gift cards) ───────────────────────────────────────────────

interface WinnerRow {
  gameKey: string;
  cocktailName: string;
  totalPlayers: number;
  winner: {
    name: string;
    email: string;
    score: number;
    achievedAt: string;
    emailVerified: boolean;
  } | null;
}

/**
 * Who to send the $15 gift cards to.
 *
 * Deliberately a list to work from rather than an automatic send: real money is
 * involved, and the owner should look at a winning score before paying out.
 */
function WinnersPanel({
  menuId,
  slug,
  status,
}: {
  menuId: string;
  slug: string;
  status: string;
}) {
  const [rows, setRows] = useState<WinnerRow[]>([]);
  const [sandbox, setSandbox] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(
      `/api/admin/popup/winners?menuId=${encodeURIComponent(menuId)}${sandbox ? "&sandbox=1" : ""}`
    )
      .then((r) => r.json())
      .then((d) => setRows(d.winners ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [menuId, sandbox]);

  return (
    <Section title="Game Winners — Gift Cards" defaultOpen>
      <p className="text-[11px] text-gray-400 leading-relaxed mb-4">
        The top scorer on each game. {status === "archived"
          ? "This pop-up has closed, so these are final."
          : "This pop-up is still running — these can still change."}{" "}
        Send the $15 gift cards yourself; nothing is emailed automatically.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={sandbox}
            onChange={(e) => setSandbox(e.target.checked)}
            className="accent-[#C97D5A]"
          />
          <span className="text-xs text-gray-600">Show sandbox test scores instead</span>
        </label>
        <a
          href={`/api/admin/popup/winners?menuId=${encodeURIComponent(menuId)}&format=csv${sandbox ? "&sandbox=1" : ""}`}
          download={`${slug}-game-winners.csv`}
          className="flex items-center gap-1.5 text-[11px] tracking-wider uppercase text-gray-400 hover:text-[#C97D5A] transition-colors"
        >
          <Download size={12} /> Export CSV
        </a>
      </div>

      {loading ? (
        <p className="text-xs text-gray-400 py-6 text-center">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-gray-400 py-6 text-center border border-dashed border-gray-200">
          No cocktails on this pop-up have a game attached yet.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.gameKey} className="border border-gray-200 p-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm text-gray-800">{r.cocktailName}</span>
                <span className="text-[10px] tracking-wider uppercase text-gray-400">
                  {r.totalPlayers} {r.totalPlayers === 1 ? "player" : "players"}
                </span>
              </div>

              {r.winner ? (
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-sm text-gray-800">{r.winner.name}</span>
                  <a
                    href={`mailto:${r.winner.email}`}
                    className="text-xs text-[#C97D5A] hover:underline break-all"
                  >
                    {r.winner.email}
                  </a>
                  <span className="text-sm tabular-nums text-gray-600">
                    {r.winner.score.toLocaleString()} pts
                  </span>
                  {!r.winner.emailVerified && (
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] tracking-wider uppercase">
                      Email not confirmed
                    </span>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-400">Nobody has played this one yet.</p>
              )}
            </div>
          ))}
        </div>
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
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  rows?: number;
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
          rows={rows}
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
