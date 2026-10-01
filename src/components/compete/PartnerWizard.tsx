"use client";

// The brand partner's private link. Copy agreed with the owner (2026-10-01):
// no at-home recipes here — Common Good writes those in the admin panel.

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { SponsorContact, SponsorProduct, SponsorProfile, SubmissionStatus } from "@/lib/compete/types";
import { BrandView } from "./Profiles";
import { Field, NavButtons, PhotoUpload, Shell, StatusPanel, StepHeader, TextArea, TextInput } from "./FormKit";

export type PartnerPageProps = {
  token: string;
  event: {
    name: string;
    dateText: string;
    location: string;
    spirit: string;
    deadlineText: string;
    contactEmail: string;
    cgLogo: string;
    accent: string;
    slug: string;
    published: boolean;
  };
  partnerName: string;
  submission: {
    status: SubmissionStatus;
    adminNote: string;
    contact: SponsorContact;
    profile: SponsorProfile;
  };
  locked: "approved" | "closed" | null;
};

type Screen = "welcome" | "guests" | "contact" | "brand" | "spirit" | "links" | "review" | "done" | "status";
const STEPS: Screen[] = ["guests", "contact", "brand", "spirit", "links", "review"];
const MAX_PHOTOS = 8;

const newProduct = (i: number): SponsorProduct => ({ id: `p${Date.now()}${i}`, name: "" });

export default function PartnerWizard({ token, event: ev, partnerName, submission, locked }: PartnerPageProps) {
  const returning = submission.status !== "invited" || Boolean(submission.contact.email);
  const [screen, setScreen] = useState<Screen>(locked || returning ? "status" : "welcome");
  const [status, setStatus] = useState(submission.status);
  const [contact, setContact] = useState<SponsorContact>(submission.contact);
  const [profile, setProfile] = useState<SponsorProfile>({
    ...submission.profile,
    products: submission.profile.products?.length ? submission.profile.products : [newProduct(0)],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const email = ev.contactEmail;
  const name = profile.brandName || partnerName || "there";
  const set = (patch: Partial<SponsorProfile>) => setProfile((p) => ({ ...p, ...patch }));
  const setProduct = (i: number, patch: Partial<SponsorProduct>) =>
    setProfile((p) => ({ ...p, products: (p.products ?? []).map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const setLink = (k: keyof NonNullable<SponsorProfile["links"]>, v: string) =>
    setProfile((p) => ({ ...p, links: { ...(p.links ?? {}), [k]: v } }));

  async function send(action: "save" | "submit") {
    const res = await fetch("/api/compete/submission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "partner", token, action, data: { contact, profile } }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "We couldn’t save that. Please try again.");
  }

  async function go(next: Screen, opts: { save?: boolean; validate?: () => string } = {}) {
    setError("");
    const problem = opts.validate?.();
    if (problem) return setError(problem);
    if (opts.save) {
      setBusy(true);
      try {
        await send("save");
      } catch (e) {
        setBusy(false);
        return setError((e as Error).message);
      }
      setBusy(false);
    }
    setScreen(next);
    window.scrollTo({ top: 0 });
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await send("submit");
      setStatus("submitted");
      setScreen("done");
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const stepNo = STEPS.indexOf(screen) + 1;
  const err = error && <p className="mt-4 text-sm text-red-300">{error}</p>;

  return (
    <Shell accent={ev.accent} cgLogo={ev.cgLogo} brandLogo={profile.logoUrl} eventName={ev.name}>
      {screen === "welcome" && (
        <div className="cmp-rise">
          <div className="text-center">
            <h1 className="cmp-display text-5xl">{ev.name}</h1>
            <p className="mt-4 text-sm tracking-[0.16em] uppercase cmp-muted">
              {ev.dateText} · {ev.location}
            </p>
            <div className="cmp-label mt-12">Welcome, {name}.</div>
          </div>
          <div className="cmp-prose mt-6 space-y-4">
            <p>
              Thank you for partnering with us on <strong>{ev.name}</strong>, an in-person cocktail competition featuring{" "}
              <strong>{ev.spirit}</strong>.
            </p>
            <p>
              Throughout the night, guests will use their phones to follow along, learn about each competitor, and vote live.
              Your brand will be featured from the moment they log in, alongside every cocktail made with your spirit.
            </p>
            <p>This page is where you tell your story. Add your logo, photos, and product details for guests to explore.</p>
            <p>
              There’s nothing to print or ship. Everything you submit here appears directly on the event page. It also stays
              on our website after the event as part of our Past Events archive.
            </p>
            <p>Once you have your logo and a few photos ready, this should take about 15 minutes.</p>
            {ev.deadlineText && (
              <p>
                <strong>Please submit by {ev.deadlineText}.</strong>
              </p>
            )}
          </div>
          <NavButtons onNext={() => go("guests")} nextLabel="Get Started" />
        </div>
      )}

      {screen === "guests" && (
        <div className="cmp-rise">
          <StepHeader step={stepNo} total={STEPS.length} title="Here’s where your brand appears." />
          <div className="cmp-prose mt-10 space-y-4">
            <p>
              <strong>When guests log in.</strong> Your brand profile is the first thing guests see, before the competition
              begins.
            </p>
            <p>
              <strong>Throughout the night.</strong> Your logo appears alongside ours across the event page. Guests can tap
              back to your profile at any time.
            </p>
            <p>
              <strong>At-home recipes.</strong> Common Good will create a <strong>“Make Cocktails at Home”</strong> collection
              of recipes featuring <strong>{ev.spirit}</strong>. Guests can save each recipe card to their phone’s photo
              library.
            </p>
            <p>
              <strong>After the event.</strong> The event page, including your brand profile and the at-home recipes, stays
              live in the Past Events section of our website.
            </p>
            <h3>Guidelines for Your Content</h3>
            <p>
              <strong>Logo.</strong> A PNG or SVG with a transparent background works best. If you have both light and dark
              versions, please upload both. Your logo will appear on both light and dark backgrounds.
            </p>
            <p>
              <strong>Photos.</strong> Upload up to <strong>{MAX_PHOTOS}</strong> images, such as product shots, your
              distillery or production, your team, or where your spirit comes from. Landscape images at least{" "}
              <strong>2000 pixels wide</strong> look best. JPG or PNG, up to 15 MB each.
            </p>
            <p>
              <strong>Text.</strong> Guests will be reading on their phones in a lively bar, so keep it short. Aim for a brand
              story of <strong>100–200 words</strong>. Use the product details section for specifics such as ABV, region, and
              production method.
            </p>
            <p>
              <strong>Links.</strong> Your website and social accounts will appear as buttons on your profile.
            </p>
            <p>
              <strong>Your Submitted Content.</strong> Common Good may edit submitted content for clarity, length, or
              formatting before publication. We’ll never change factual product details without checking with you first.
            </p>
            <p>
              <strong>Questions?</strong> Email <strong>{email}</strong>.
            </p>
          </div>
          <NavButtons onBack={() => go("welcome")} onNext={() => go("contact")} />
        </div>
      )}

      {screen === "contact" && (
        <div className="cmp-rise">
          <StepHeader
            step={stepNo}
            total={STEPS.length}
            title="Who should we coordinate with?"
            intro="We’ll use these details to coordinate the event. They won’t be shown to guests."
          />
          <div className="mt-10 space-y-8">
            <Field id="cname" label="Contact Name" required>
              <TextInput id="cname" autoComplete="name" value={contact.name ?? ""} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} />
            </Field>
            <Field id="cemail" label="Email Address" required>
              <TextInput id="cemail" type="email" autoComplete="email" value={contact.email ?? ""} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} />
            </Field>
            <Field id="cphone" label="Phone Number" optional>
              <TextInput id="cphone" type="tel" autoComplete="tel" value={contact.phone ?? ""} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} />
            </Field>
          </div>
          {err}
          <NavButtons
            onBack={() => go("guests")}
            onNext={() =>
              go("brand", {
                save: true,
                validate: () =>
                  !contact.name?.trim() ? "Please enter a contact name." : !contact.email?.includes("@") ? "Please enter an email address." : "",
              })
            }
            busy={busy}
          />
        </div>
      )}

      {screen === "brand" && (
        <div className="cmp-rise">
          <StepHeader step={stepNo} total={STEPS.length} title="Tell guests who you are." intro="These details will appear on your brand profile." />
          <div className="mt-10 space-y-8">
            <Field id="bname" label="Brand Name" hint="As you’d like it to appear to guests.">
              <TextInput id="bname" value={profile.brandName ?? ""} onChange={(e) => set({ brandName: e.target.value })} />
            </Field>
            <Field label="Logo" required hint="Transparent PNG or SVG preferred.">
              <div className="flex flex-wrap gap-6">
                <div>
                  <PhotoUpload
                    kind="partner"
                    token={token}
                    small
                    aspect="aspect-[3/2]"
                    fit="contain"
                    accept="image/png,image/svg+xml,image/webp,image/jpeg"
                    value={profile.logoUrl}
                    onChange={(url) => set({ logoUrl: url })}
                  />
                  <p className="mt-2 text-xs cmp-faint">Primary</p>
                </div>
                <div>
                  <PhotoUpload
                    kind="partner"
                    token={token}
                    small
                    aspect="aspect-[3/2]"
                    fit="contain"
                    accept="image/png,image/svg+xml,image/webp,image/jpeg"
                    value={profile.logoDarkUrl}
                    onChange={(url) => set({ logoDarkUrl: url })}
                  />
                  <p className="mt-2 text-xs cmp-faint">Alternate for dark backgrounds (optional)</p>
                </div>
              </div>
            </Field>
            <Field id="tagline" label="Tagline" optional hint="A single line that captures your brand.">
              <TextInput id="tagline" value={profile.tagline ?? ""} onChange={(e) => set({ tagline: e.target.value })} />
            </Field>
            <Field
              id="story"
              label="Your Story"
              hint="Who you are, where you come from, and what makes your spirit unique. Aim for 100–200 words."
            >
              <TextArea id="story" rows={8} value={profile.story ?? ""} onChange={(e) => set({ story: e.target.value })} />
              <p className="mt-1 text-right text-xs cmp-faint">{(profile.story ?? "").split(/\s+/).filter(Boolean).length} words</p>
            </Field>
            <Field label="Photos" optional hint={`Up to ${MAX_PHOTOS} images. The first image will be your cover photo.`}>
              <div className="grid grid-cols-3 gap-3">
                {(profile.photos ?? []).map((src, i) => (
                  <div key={src} className="relative">
                    <img src={src} alt="" className="w-full aspect-square object-cover" />
                    <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 text-[10px] tracking-[0.12em] uppercase">
                      <button
                        type="button"
                        className="px-2 py-1.5 disabled:opacity-30"
                        disabled={i === 0}
                        onClick={() =>
                          set({
                            photos: (() => {
                              const a = [...(profile.photos ?? [])];
                              [a[i - 1], a[i]] = [a[i], a[i - 1]];
                              return a;
                            })(),
                          })
                        }
                      >
                        ← Move
                      </button>
                      <button type="button" className="px-2 py-1.5" onClick={() => set({ photos: (profile.photos ?? []).filter((_, j) => j !== i) })}>
                        Remove
                      </button>
                    </div>
                    {i === 0 && <span className="absolute top-1 left-1 bg-black/70 text-[9px] tracking-[0.14em] uppercase px-1.5 py-0.5">Cover</span>}
                  </div>
                ))}
                {(profile.photos ?? []).length < MAX_PHOTOS && (
                  <PhotoUpload
                    kind="partner"
                    token={token}
                    aspect="aspect-square"
                    value=""
                    onChange={(url) => url && set({ photos: [...(profile.photos ?? []), url] })}
                  />
                )}
              </div>
            </Field>
          </div>
          {err}
          <NavButtons
            onBack={() => go("contact")}
            onNext={() =>
              go("spirit", {
                save: true,
                validate: () =>
                  !profile.brandName?.trim()
                    ? "Please enter your brand name."
                    : !profile.logoUrl
                      ? "Please upload your logo."
                      : !profile.story?.trim()
                        ? "Please add your story."
                        : "",
              })
            }
            busy={busy}
          />
        </div>
      )}

      {screen === "spirit" && (
        <div className="cmp-rise">
          <StepHeader
            step={stepNo}
            total={STEPS.length}
            title={`Tell us about ${ev.spirit}.`}
            intro="These details help guests understand what’s in their glass."
          />
          <div className="mt-10 space-y-12">
            {(profile.products ?? []).map((p, i) => (
              <div key={p.id} className={i > 0 ? "pt-10 border-t border-[var(--cmp-line)] space-y-8" : "space-y-8"}>
                {i > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="cmp-label">Product {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => set({ products: (profile.products ?? []).filter((_, j) => j !== i) })}
                      className="text-xs tracking-[0.14em] uppercase cmp-muted flex items-center gap-1.5"
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                )}
                <Field id={`pn${i}`} label="Product Name">
                  <TextInput id={`pn${i}`} value={p.name} onChange={(e) => setProduct(i, { name: e.target.value })} />
                </Field>
                <Field id={`pc${i}`} label="Category / Style" hint="For example: Blanco Tequila, Single Malt Scotch, London Dry Gin, Bourbon.">
                  <TextInput id={`pc${i}`} value={p.category ?? ""} onChange={(e) => setProduct(i, { category: e.target.value })} />
                </Field>
                <Field id={`po${i}`} label="Origin" hint="Region, town, or distillery location.">
                  <TextInput id={`po${i}`} value={p.origin ?? ""} onChange={(e) => setProduct(i, { origin: e.target.value })} />
                </Field>
                <Field id={`pa${i}`} label="ABV / Proof">
                  <TextInput id={`pa${i}`} value={p.abv ?? ""} onChange={(e) => setProduct(i, { abv: e.target.value })} />
                </Field>
                <Field id={`ph${i}`} label="How It’s Made" optional hint="Ingredients, production, distillation, aging—whatever you’d like guests to know.">
                  <TextArea id={`ph${i}`} value={p.howMade ?? ""} onChange={(e) => setProduct(i, { howMade: e.target.value })} />
                </Field>
                <Field id={`pt${i}`} label="Tasting Notes" optional>
                  <TextArea id={`pt${i}`} value={p.tastingNotes ?? ""} onChange={(e) => setProduct(i, { tastingNotes: e.target.value })} />
                </Field>
                <Field label="Bottle Photo" optional hint="A clean product shot on a plain background works best.">
                  <PhotoUpload
                    kind="partner"
                    token={token}
                    small
                    aspect="aspect-[2/3]"
                    fit="contain"
                    accept="image/png,image/webp,image/jpeg"
                    value={p.photoUrl}
                    onChange={(url) => setProduct(i, { photoUrl: url })}
                  />
                </Field>
              </div>
            ))}
            {(profile.products ?? []).length < 8 && (
              <button
                type="button"
                className="cmp-btn-ghost w-full"
                onClick={() => set({ products: [...(profile.products ?? []), newProduct((profile.products ?? []).length)] })}
              >
                <Plus size={14} /> Add Another Product
              </button>
            )}
            <p className="-mt-8 text-center text-xs cmp-faint">If you’d like to feature more than one expression.</p>
          </div>
          {err}
          <NavButtons
            onBack={() => go("brand")}
            onNext={() =>
              go("links", { save: true, validate: () => (!profile.products?.[0]?.name?.trim() ? "Please enter a product name." : "") })
            }
            busy={busy}
          />
        </div>
      )}

      {screen === "links" && (
        <div className="cmp-rise">
          <StepHeader
            step={stepNo}
            total={STEPS.length}
            title="Where can guests find you?"
            intro="These will appear as buttons on your brand profile. Fill in any that apply."
          />
          <div className="mt-10 space-y-8">
            <Field id="lw" label="Website">
              <TextInput id="lw" type="url" inputMode="url" placeholder="https://" value={profile.links?.website ?? ""} onChange={(e) => setLink("website", e.target.value)} />
            </Field>
            <Field id="li" label="Instagram">
              <TextInput id="li" placeholder="@handle" value={profile.links?.instagram ?? ""} onChange={(e) => setLink("instagram", e.target.value)} />
            </Field>
            <Field id="lf" label="Facebook">
              <TextInput id="lf" type="url" inputMode="url" placeholder="https://facebook.com/…" value={profile.links?.facebook ?? ""} onChange={(e) => setLink("facebook", e.target.value)} />
            </Field>
            <Field id="lt" label="TikTok">
              <TextInput id="lt" placeholder="@handle" value={profile.links?.tiktok ?? ""} onChange={(e) => setLink("tiktok", e.target.value)} />
            </Field>
            <Field id="lb" label="Where to Buy" optional hint="A link to a store locator or retailer page.">
              <TextInput id="lb" type="url" inputMode="url" placeholder="https://" value={profile.links?.whereToBuy ?? ""} onChange={(e) => setLink("whereToBuy", e.target.value)} />
            </Field>
          </div>
          {err}
          <NavButtons onBack={() => go("spirit")} onNext={() => go("review", { save: true })} busy={busy} />
        </div>
      )}

      {screen === "review" && (
        <div className="cmp-rise">
          <StepHeader
            step={stepNo}
            total={STEPS.length}
            title="Looking good?"
            intro="Here’s how your brand profile will appear to guests. Check the details before submitting them for review."
          />
          <p className="mt-4 text-center text-sm cmp-faint">Need to make a change? Select any section to edit it.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {(
              [
                ["contact", "Contact"],
                ["brand", "Brand"],
                ["spirit", "Products"],
                ["links", "Links"],
              ] as const
            ).map(([s, l]) => (
              <button key={s} onClick={() => go(s)} className="text-xs tracking-[0.14em] uppercase border border-[var(--cmp-line)] px-3 py-2 hover:border-[var(--cmp-accent)]">
                Edit {l}
              </button>
            ))}
          </div>
          <div className="mt-8 -mx-5 sm:mx-0 cmp-card overflow-hidden pb-8">
            <BrandView profile={profile} />
          </div>
          {err}
          <NavButtons onBack={() => go("links")} onNext={submit} nextLabel="Submit for Review" busy={busy} />
        </div>
      )}

      {screen === "done" && (
        <StatusPanel title="Thank you! We’ve got it.">
          <p>
            Thanks, <strong>{(contact.name ?? "").split(" ")[0] || "friend"}</strong>. We’ve received your brand submission for{" "}
            <strong>{ev.name}</strong>.
          </p>
          <p>
            Our team will review it and may make small editorial changes before it appears on the event page. We’ll check with
            you before changing any product details.
          </p>
          <p>
            You can return to this link to check your status. Changes are welcome until <strong>{ev.deadlineText || "the deadline"}</strong>,
            unless your submission has already been approved. After approval, email <strong>{email}</strong> for updates.
          </p>
          <p className="!mt-8">
            <strong>We’re excited to share {ev.spirit} with our guests.</strong>
          </p>
        </StatusPanel>
      )}

      {screen === "status" &&
        (locked === "closed" ? (
          <StatusPanel title="Submissions are closed.">
            <p>
              The submission deadline for <strong>{ev.name}</strong> has passed.
            </p>
            <p>
              Still need to send us your details or make a change? Please email <strong>{email}</strong> so we can help.
            </p>
          </StatusPanel>
        ) : status === "approved" || locked === "approved" ? (
          <StatusPanel title="You’re all set!">
            <p>
              Your brand profile for <strong>{ev.name}</strong> has been approved and will appear on the event page.
            </p>
            {ev.published && (
              <a href={`/compete/${ev.slug}`} className="cmp-btn w-full !mt-8">
                View Event Page
              </a>
            )}
            <p>
              Need to change something? Email <strong>{email}</strong>.
            </p>
          </StatusPanel>
        ) : status === "changes_requested" ? (
          <StatusPanel title="Your submission needs an update.">
            <p>
              We’ve reviewed your brand profile for <strong>{ev.name}</strong> and have a note for you:
            </p>
            <blockquote className="cmp-card p-5 text-left italic text-[var(--cmp-text)] whitespace-pre-line">{submission.adminNote}</blockquote>
            <p>
              Please make the requested changes and resubmit by <strong>{ev.deadlineText || "the deadline"}</strong>.
            </p>
            <button className="cmp-btn w-full !mt-10" onClick={() => go("brand")}>
              Edit Submission
            </button>
          </StatusPanel>
        ) : status === "submitted" ? (
          <StatusPanel title="Your submission is under review.">
            <p>
              We’ve received your brand profile for <strong>{ev.name}</strong>. You can still make changes before approval, up
              until <strong>{ev.deadlineText || "the deadline"}</strong>.
            </p>
            <button className="cmp-btn w-full !mt-10" onClick={() => go("brand")}>
              Edit Submission
            </button>
          </StatusPanel>
        ) : (
          <StatusPanel title="Welcome back.">
            <p>Your progress was saved. Pick up where you left off.</p>
            <button className="cmp-btn w-full !mt-10" onClick={() => go("welcome")}>
              Continue
            </button>
          </StatusPanel>
        ))}
    </Shell>
  );
}
