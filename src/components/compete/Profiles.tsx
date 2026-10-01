"use client";

// The guest-facing building blocks: logo lockup, bartender and cocktail
// profiles, the brand partner page, and the at-home recipe cards. Shared by
// the guest app, the big screen, and the submission previews, so a contestant
// previewing their entry sees exactly what guests will.

import { useState, type CSSProperties, type ReactNode } from "react";
import { AtSign, ExternalLink, Globe, ShoppingBag, ChevronDown, Download, Loader2, Wine } from "lucide-react";
import { RichText } from "@/lib/compete/richtext";
import type { Answers, FieldDef, PublicSponsor, Recipe, SponsorProfile } from "@/lib/compete/types";
import { saveRecipeCard } from "./recipeCard";

export function accentStyle(accent: string): CSSProperties {
  return { ["--cmp-accent" as string]: accent || "#C97D5A" };
}

// ─── Logos ───────────────────────────────────────────────────────────────────

export function LogoLockup({
  cgLogo,
  brandLogos,
  size = "md",
}: {
  cgLogo: string;
  brandLogos: string[];
  size?: "sm" | "md" | "lg";
}) {
  const h = size === "lg" ? "h-14 md:h-20" : size === "sm" ? "h-6" : "h-9";
  return (
    <div className="flex items-center justify-center gap-3">
      <img src={cgLogo} alt="Common Good Cocktail House" className={`${h} w-auto object-contain`} />
      {brandLogos.filter(Boolean).map((src, i) => (
        <span key={i} className="flex items-center gap-3">
          <span className="cmp-faint text-sm" aria-hidden>
            ×
          </span>
          <img src={src} alt="" className={`${h} w-auto object-contain`} />
        </span>
      ))}
    </div>
  );
}

export function brandLogos(sponsors: PublicSponsor[]): string[] {
  return sponsors.map((s) => s.profile.logoUrl ?? "").filter(Boolean);
}

// ─── Placeholders (photos are optional everywhere) ──────────────────────────

export function Monogram({ name, className = "" }: { name?: string; className?: string }) {
  const initials = (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div
      className={`flex items-center justify-center bg-[var(--cmp-raised)] border border-[var(--cmp-line)] ${className}`}
      aria-hidden
    >
      <span className="cmp-display text-[var(--cmp-accent)]" style={{ fontSize: "clamp(1.5rem, 30%, 4rem)" }}>
        {initials || "—"}
      </span>
    </div>
  );
}

export function CocktailPlaceholder({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center bg-[var(--cmp-raised)] border border-[var(--cmp-line)] ${className}`}
      aria-hidden
    >
      <Wine strokeWidth={0.8} className="w-1/4 h-1/4 text-[var(--cmp-accent)] opacity-70" />
    </div>
  );
}

// ─── Answers ─────────────────────────────────────────────────────────────────

function lines(v: string) {
  return v
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Ingredients read best as a list; anything else as paragraphs. */
function AnswerBody({ field, value }: { field: FieldDef; value: string }) {
  const asList = field.id === "ingredients" || /ingredient/i.test(field.label);
  if (asList) {
    return (
      <ul className="mt-2 divide-y divide-[var(--cmp-line)] border-y border-[var(--cmp-line)]">
        {lines(value).map((l, i) => (
          <li key={i} className="py-2.5 text-[15px]">
            {l}
          </li>
        ))}
      </ul>
    );
  }
  return <p className="mt-2 cmp-prose whitespace-pre-line">{value}</p>;
}

function Answers({ fields, answers }: { fields: FieldDef[]; answers: Answers }) {
  const shown = fields.filter((f) => !f.role && answers[f.id]);
  return (
    <div className="space-y-7">
      {shown.map((f) => (
        <section key={f.id}>
          <h4 className="cmp-label">{f.label}</h4>
          <AnswerBody field={f} value={answers[f.id]} />
        </section>
      ))}
    </div>
  );
}

const roleValue = (fields: FieldDef[], a: Answers, role: "name" | "bar") => {
  const f = fields.find((x) => x.role === role);
  return (f && a[f.id]) || "";
};

export function bartenderName(fields: FieldDef[], a: Answers) {
  return roleValue(fields, a, "name") || a.name || "Contestant";
}
export function bartenderBar(fields: FieldDef[], a: Answers) {
  return roleValue(fields, a, "bar") || a.bar || "";
}
export function cocktailName(fields: FieldDef[], a: Answers) {
  return roleValue(fields, a, "name") || a.name || "Untitled cocktail";
}

// ─── Bartender & cocktail ────────────────────────────────────────────────────

export function BartenderView({
  fields,
  answers,
  eyebrow,
}: {
  fields: FieldDef[];
  answers: Answers;
  eyebrow?: ReactNode;
}) {
  const name = bartenderName(fields, answers);
  const bar = bartenderBar(fields, answers);
  return (
    <article>
      <div className="relative">
        {answers.photoUrl ? (
          <img src={answers.photoUrl} alt={name} className="w-full aspect-[4/5] object-cover" />
        ) : (
          <Monogram name={name} className="w-full aspect-[4/5]" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[var(--cmp-bg)] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
          {eyebrow && <div className="cmp-label mb-2">{eyebrow}</div>}
          <h2 className="cmp-display text-4xl">{name}</h2>
          {bar && <p className="mt-1 text-sm tracking-[0.18em] uppercase cmp-muted">{bar}</p>}
        </div>
      </div>
      <div className="px-5 pt-6 pb-2">
        <Answers fields={fields} answers={answers} />
      </div>
    </article>
  );
}

export function CocktailView({
  fields,
  answers,
  byline,
  eyebrow,
}: {
  fields: FieldDef[];
  answers: Answers;
  byline?: string;
  eyebrow?: ReactNode;
}) {
  const name = cocktailName(fields, answers);
  return (
    <article>
      {answers.photoUrl ? (
        <img src={answers.photoUrl} alt={name} className="w-full aspect-square object-cover" />
      ) : (
        <CocktailPlaceholder className="w-full aspect-[4/3]" />
      )}
      <div className="px-5 pt-6">
        {eyebrow && <div className="cmp-label mb-2">{eyebrow}</div>}
        <h2 className="cmp-display text-4xl">{name}</h2>
        {byline && <p className="mt-2 text-sm tracking-[0.18em] uppercase cmp-muted">{byline}</p>}
        <div className="mt-7 pb-2">
          <Answers fields={fields} answers={answers} />
        </div>
      </div>
    </article>
  );
}

// ─── Brand partner ───────────────────────────────────────────────────────────

function linkHref(kind: string, v: string): string {
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "");
  if (kind === "instagram") return `https://instagram.com/${handle}`;
  if (kind === "tiktok") return `https://tiktok.com/@${handle}`;
  if (kind === "facebook") return `https://facebook.com/${handle}`;
  return `https://${v}`;
}

export function BrandView({
  profile,
  onRecipes,
  hasRecipes,
}: {
  profile: SponsorProfile;
  onRecipes?: () => void;
  hasRecipes?: boolean;
}) {
  const photos = profile.photos ?? [];
  const [hero, ...rest] = photos;
  const links = profile.links ?? {};
  const linkItems = [
    links.website && { k: "website", label: "Website", icon: Globe, v: links.website },
    links.instagram && { k: "instagram", label: "Instagram", icon: AtSign, v: links.instagram },
    links.facebook && { k: "facebook", label: "Facebook", icon: ExternalLink, v: links.facebook },
    links.tiktok && { k: "tiktok", label: "TikTok", icon: ExternalLink, v: links.tiktok },
    links.whereToBuy && { k: "buy", label: "Where to Buy", icon: ShoppingBag, v: links.whereToBuy },
  ].filter(Boolean) as { k: string; label: string; icon: typeof Globe; v: string }[];

  return (
    <article>
      <div className="relative">
        {hero ? (
          <img src={hero} alt="" className="w-full aspect-[4/5] object-cover" />
        ) : (
          <div className="w-full aspect-[4/3] bg-[var(--cmp-raised)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--cmp-bg)] via-[var(--cmp-bg)]/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-5 pb-6 text-center">
          <div className="cmp-label mb-4">Tonight’s Featured Spirit</div>
          {profile.logoUrl ? (
            <img src={profile.logoUrl} alt={profile.brandName ?? ""} className="mx-auto h-16 w-auto object-contain" />
          ) : (
            <h2 className="cmp-display text-4xl">{profile.brandName}</h2>
          )}
          {profile.tagline && <p className="mt-4 text-[15px] cmp-muted italic">{profile.tagline}</p>}
        </div>
      </div>

      <div className="px-5 pt-8 space-y-10">
        {profile.story && <RichText text={profile.story} className="cmp-prose" />}

        {hasRecipes && onRecipes && (
          <button onClick={onRecipes} className="cmp-btn w-full">
            Make Cocktails at Home
          </button>
        )}

        {(profile.products ?? []).length > 0 && (
          <section>
            <h3 className="cmp-label mb-4">The Range</h3>
            <div className="space-y-4">
              {(profile.products ?? []).map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          </section>
        )}

        {rest.length > 0 && (
          <section>
            <div className="-mx-5 flex gap-3 overflow-x-auto px-5 snap-x cmp-scroll-x">
              {rest.map((src) => (
                <img key={src} src={src} alt="" className="h-72 w-auto snap-start object-cover shrink-0" />
              ))}
            </div>
          </section>
        )}

        {linkItems.length > 0 && (
          <section className="grid grid-cols-2 gap-3">
            {linkItems.map(({ k, label, icon: Icon, v }) => (
              <a
                key={k}
                href={linkHref(k, v)}
                target="_blank"
                rel="noopener noreferrer"
                className="cmp-btn-ghost !px-3 !tracking-[0.14em]"
              >
                <Icon size={14} /> {label}
              </a>
            ))}
          </section>
        )}
      </div>
    </article>
  );
}

function ProductCard({ p }: { p: NonNullable<SponsorProfile["products"]>[number] }) {
  const [open, setOpen] = useState(false);
  const detail = p.howMade || p.tastingNotes;
  return (
    <div className="cmp-card">
      <button
        className="w-full flex items-center gap-4 p-4 text-left"
        onClick={() => detail && setOpen((o) => !o)}
        aria-expanded={open}
      >
        {p.photoUrl ? (
          <img src={p.photoUrl} alt="" className="h-24 w-16 object-contain shrink-0" />
        ) : (
          <div className="h-24 w-16 shrink-0 bg-[var(--cmp-raised)]" />
        )}
        <div className="min-w-0 flex-1">
          <div className="cmp-display text-xl">{p.name}</div>
          {p.category && <div className="mt-1 text-xs cmp-muted">{p.category}</div>}
          {(p.abv || p.origin) && (
            <div className="mt-1 text-xs cmp-faint">{[p.abv, p.origin].filter(Boolean).join(" · ")}</div>
          )}
        </div>
        {detail && (
          <ChevronDown size={16} className={`shrink-0 cmp-muted transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 text-sm cmp-muted leading-relaxed">
          {p.howMade && (
            <p>
              <span className="cmp-label !text-[10px] block mb-1">How It’s Made</span>
              {p.howMade}
            </p>
          )}
          {p.tastingNotes && (
            <p>
              <span className="cmp-label !text-[10px] block mb-1">Tasting Notes</span>
              {p.tastingNotes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── At-home recipes ─────────────────────────────────────────────────────────

export function RecipeList({
  recipes,
  spirit,
  eventName,
  cgLogo,
  brandLogo,
  accent,
}: {
  recipes: Recipe[];
  spirit: string;
  eventName: string;
  cgLogo: string;
  brandLogo?: string;
  accent: string;
}) {
  return (
    <div className="px-5 pt-8">
      <div className="text-center">
        <div className="cmp-label">At Home</div>
        <h2 className="cmp-display text-4xl mt-3">Make Cocktails at Home</h2>
        <p className="mt-3 cmp-muted text-[15px]">
          Recipes from Common Good featuring {spirit}. Save any card to your photos.
        </p>
      </div>
      <div className="mt-8 space-y-4">
        {recipes.map((r) => (
          <RecipeCard
            key={r.id}
            recipe={r}
            spirit={spirit}
            eventName={eventName}
            cgLogo={cgLogo}
            brandLogo={brandLogo}
            accent={accent}
          />
        ))}
        {recipes.length === 0 && <p className="text-center cmp-faint text-sm">Recipes are coming soon.</p>}
      </div>
    </div>
  );
}

function RecipeCard({
  recipe,
  spirit,
  eventName,
  cgLogo,
  brandLogo,
  accent,
}: {
  recipe: Recipe;
  spirit: string;
  eventName: string;
  cgLogo: string;
  brandLogo?: string;
  accent: string;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const result = await saveRecipeCard({ recipe, spirit, eventName, cgLogo, brandLogo, accent });
      if (result === "downloaded") setMsg("Saved to your downloads.");
    } catch {
      setMsg("Couldn’t create the image — try a screenshot instead.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cmp-card">
      {recipe.photoUrl && <img src={recipe.photoUrl} alt="" className="w-full aspect-[16/10] object-cover" />}
      <button className="w-full flex items-center justify-between gap-4 p-5 text-left" onClick={() => setOpen((o) => !o)}>
        <div>
          <div className="cmp-display text-2xl">{recipe.name}</div>
          {recipe.description && <p className="mt-1.5 text-sm cmp-muted">{recipe.description}</p>}
        </div>
        <ChevronDown size={18} className={`shrink-0 cmp-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-5 pb-5">
          <h4 className="cmp-label">Ingredients</h4>
          <ul className="mt-2 divide-y divide-[var(--cmp-line)] border-y border-[var(--cmp-line)]">
            {lines(recipe.ingredients).map((l, i) => (
              <li key={i} className="py-2.5 text-[15px]">
                {l}
              </li>
            ))}
          </ul>
          <h4 className="cmp-label mt-6">Method</h4>
          <p className="mt-2 cmp-prose whitespace-pre-line">{recipe.method}</p>
          <button onClick={save} disabled={saving} className="cmp-btn w-full mt-6">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            Save to Photos
          </button>
          {msg && <p className="mt-2 text-center text-xs cmp-muted">{msg}</p>}
        </div>
      )}
    </div>
  );
}
