"use client";

// The contestant's private link. Copy is the owner's, word for word (2026-10-01).

import { useState } from "react";
import { RichText } from "@/lib/compete/richtext";
import type { Answers, FieldDef, SubmissionStatus } from "@/lib/compete/types";
import { BartenderView, CocktailView, bartenderName } from "./Profiles";
import { Field, NavButtons, PhotoUpload, Shell, StatusPanel, StepHeader, TextArea, TextInput } from "./FormKit";

export type ContestantPageProps = {
  token: string;
  event: {
    name: string;
    dateText: string;
    location: string;
    spirit: string;
    deadlineText: string;
    contactEmail: string;
    rulesText: string;
    bartenderFields: FieldDef[];
    cocktailFields: FieldDef[];
    cgLogo: string;
    brandLogo?: string;
    accent: string;
  };
  submission: {
    status: SubmissionStatus;
    adminNote: string;
    contact: { email?: string; phone?: string };
    bartender: Answers;
    cocktail: Answers;
    agreed: boolean;
  };
  locked: "approved" | "closed" | null;
};

type Screen = "welcome" | "rules" | "contact" | "about" | "cocktail" | "review" | "done" | "status";
const STEPS: Screen[] = ["rules", "contact", "about", "cocktail", "review"];

export default function ContestantWizard({ token, event: ev, submission, locked }: ContestantPageProps) {
  const returning = submission.status !== "invited" || submission.agreed;
  const [screen, setScreen] = useState<Screen>(locked || returning ? "status" : "welcome");
  const [status, setStatus] = useState(submission.status);
  const [contact, setContact] = useState(submission.contact);
  const [bartender, setBartender] = useState<Answers>(submission.bartender);
  const [cocktail, setCocktail] = useState<Answers>(submission.cocktail);
  const [agreed, setAgreed] = useState(submission.agreed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const email = ev.contactEmail;
  const firstName = bartenderName(ev.bartenderFields, bartender).split(" ")[0];

  async function send(action: "save" | "submit") {
    const res = await fetch("/api/compete/submission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "contestant", token, action, data: { contact, bartender, cocktail, agreed } }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "We couldn’t save that. Please try again.");
    return d;
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
  const missing = (fields: FieldDef[], a: Answers) => fields.filter((f) => !a[f.id]?.trim()).map((f) => f.label);

  return (
    <Shell accent={ev.accent} cgLogo={ev.cgLogo} brandLogo={ev.brandLogo} eventName={ev.name}>
      {screen === "welcome" && (
        <div className="cmp-rise">
          <div className="text-center">
            <h1 className="cmp-display text-5xl">{ev.name}</h1>
            <p className="mt-4 text-sm tracking-[0.16em] uppercase cmp-muted">
              {ev.dateText} · {ev.location}
            </p>
            <div className="cmp-label mt-12">You’re invited to compete.</div>
          </div>
          <div className="cmp-prose mt-6 space-y-4">
            <p>
              You’ve been selected to represent your bar at <strong>{ev.name}</strong>, an{" "}
              <strong>in-person cocktail competition</strong> featuring <strong>{ev.spirit}</strong>.
            </p>
            <p>
              You’ll present your cocktail to our judges and guests, who will taste your creation and vote live from their
              phones. Our staff will serve your pre-batched guest samples while you make your showpiece cocktails live,
              answer questions, and enjoy the banter.
            </p>
            <p>
              We’ll walk you through the event guidelines, ask a few questions about you, and collect the details of your
              cocktail. Once you have your recipe ready, this should take about 10 minutes.
            </p>
            {ev.deadlineText && (
              <p>
                <strong>Please submit by {ev.deadlineText}.</strong>
              </p>
            )}
          </div>
          <NavButtons onNext={() => go("rules")} nextLabel="Get Started" />
        </div>
      )}

      {screen === "rules" && (
        <div className="cmp-rise">
          <StepHeader step={stepNo} total={STEPS.length} title="Rules & Expectations" />
          <RichText text={ev.rulesText} className="cmp-prose mt-10" />
          <label className="mt-10 flex gap-4 items-start cmp-card p-5 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 w-5 h-5 shrink-0 accent-[var(--cmp-accent)]"
            />
            <span className="text-[15px] leading-relaxed">
              <strong className="font-medium">I’ve read and agree to the rules and expectations.</strong>{" "}
              <span className="cmp-muted">
                I understand that guest samples must be batched ahead of time and hero cocktails must be made live.
              </span>
            </span>
          </label>
          {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
          <NavButtons
            onBack={() => go("welcome")}
            onNext={() => go("contact", { save: true, validate: () => (agreed ? "" : "Please agree to the rules to continue.") })}
            busy={busy}
          />
        </div>
      )}

      {screen === "contact" && (
        <div className="cmp-rise">
          <StepHeader
            step={stepNo}
            total={STEPS.length}
            title="How can we reach you?"
            intro="We’ll use these details to coordinate the event. They won’t appear on your public profile or be shown to guests."
          />
          <div className="mt-10 space-y-8">
            <Field id="email" label="Email Address" required>
              <TextInput id="email" type="email" autoComplete="email" value={contact.email ?? ""} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} />
            </Field>
            <Field id="phone" label="Phone Number" required>
              <TextInput id="phone" type="tel" autoComplete="tel" value={contact.phone ?? ""} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} />
            </Field>
          </div>
          {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
          <NavButtons
            onBack={() => go("rules")}
            onNext={() =>
              go("about", {
                save: true,
                validate: () =>
                  !contact.email?.includes("@") ? "Please enter your email address." : !contact.phone?.trim() ? "Please enter your phone number." : "",
              })
            }
            busy={busy}
          />
        </div>
      )}

      {screen === "about" && (
        <div className="cmp-rise">
          <StepHeader
            step={stepNo}
            total={STEPS.length}
            title="Meet the person behind the drink."
            intro="Help guests get to know you. These details will appear on your bartender profile."
          />
          <div className="mt-10 space-y-8">
            <Field label="Headshot" optional hint="Upload a clear, well-lit photo of yourself.">
              <PhotoUpload kind="contestant" token={token} value={bartender.photoUrl} onChange={(url) => setBartender((b) => ({ ...b, photoUrl: url }))} />
            </Field>
            {ev.bartenderFields.map((f) => (
              <Field key={f.id} id={`b-${f.id}`} label={f.label} hint={f.hint}>
                {f.type === "text" ? (
                  <TextInput id={`b-${f.id}`} value={bartender[f.id] ?? ""} onChange={(e) => setBartender((b) => ({ ...b, [f.id]: e.target.value }))} />
                ) : (
                  <TextArea id={`b-${f.id}`} value={bartender[f.id] ?? ""} onChange={(e) => setBartender((b) => ({ ...b, [f.id]: e.target.value }))} />
                )}
              </Field>
            ))}
          </div>
          {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
          <NavButtons
            onBack={() => go("contact")}
            onNext={() =>
              go("cocktail", {
                save: true,
                validate: () => {
                  const m = missing(ev.bartenderFields, bartender);
                  return m.length ? `Please fill in: ${m.join(", ")}.` : "";
                },
              })
            }
            busy={busy}
          />
        </div>
      )}

      {screen === "cocktail" && (
        <div className="cmp-rise">
          <StepHeader
            step={stepNo}
            total={STEPS.length}
            title="Tell us about your cocktail."
            intro="These details will appear on your cocktail’s profile for guests to explore."
          />
          <div className="mt-10 space-y-8">
            <Field
              label="Cocktail Photo"
              optional
              hint="Upload a photo of your finished cocktail. You can add or update it before your submission is approved, up until the deadline."
            >
              <PhotoUpload kind="contestant" token={token} aspect="aspect-square" value={cocktail.photoUrl} onChange={(url) => setCocktail((c) => ({ ...c, photoUrl: url }))} />
            </Field>
            {ev.cocktailFields.map((f) => (
              <Field key={f.id} id={`c-${f.id}`} label={f.label} hint={f.hint}>
                {f.type === "text" ? (
                  <TextInput id={`c-${f.id}`} value={cocktail[f.id] ?? ""} onChange={(e) => setCocktail((c) => ({ ...c, [f.id]: e.target.value }))} />
                ) : (
                  <TextArea
                    id={`c-${f.id}`}
                    rows={f.id === "ingredients" ? 7 : 4}
                    value={cocktail[f.id] ?? ""}
                    onChange={(e) => setCocktail((c) => ({ ...c, [f.id]: e.target.value }))}
                  />
                )}
              </Field>
            ))}
          </div>
          {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
          <NavButtons
            onBack={() => go("about")}
            onNext={() =>
              go("review", {
                save: true,
                validate: () => {
                  const m = missing(ev.cocktailFields, cocktail);
                  return m.length ? `Please fill in: ${m.join(", ")}.` : "";
                },
              })
            }
            busy={busy}
          />
        </div>
      )}

      {screen === "review" && (
        <div className="cmp-rise">
          <StepHeader
            step={stepNo}
            total={STEPS.length}
            title="Looking good?"
            intro="Here’s how your bartender and cocktail profiles will appear to guests. Check the details before submitting them for review."
          />
          <p className="mt-4 text-center text-sm cmp-faint">Need to make a change? Select any section to edit it.</p>
          <div className="mt-10 -mx-5 sm:mx-0 space-y-6">
            <button onClick={() => go("about")} className="block w-full text-left cmp-card overflow-hidden hover:border-[var(--cmp-accent)] transition-colors">
              <BartenderView fields={ev.bartenderFields} answers={bartender} eyebrow="Your Bartender Profile" />
              <div className="px-5 pb-5 text-xs tracking-[0.16em] uppercase text-[var(--cmp-accent)]">Edit</div>
            </button>
            <button onClick={() => go("cocktail")} className="block w-full text-left cmp-card overflow-hidden hover:border-[var(--cmp-accent)] transition-colors">
              <CocktailView fields={ev.cocktailFields} answers={cocktail} eyebrow="Your Cocktail" byline={`by ${bartenderName(ev.bartenderFields, bartender)}`} />
              <div className="px-5 pb-5 text-xs tracking-[0.16em] uppercase text-[var(--cmp-accent)]">Edit</div>
            </button>
            <button onClick={() => go("contact")} className="block w-full text-left cmp-card p-5 hover:border-[var(--cmp-accent)] transition-colors">
              <div className="cmp-label">Contact (private)</div>
              <p className="mt-2 text-sm cmp-muted">
                {contact.email} · {contact.phone}
              </p>
            </button>
          </div>
          {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
          <NavButtons onBack={() => go("cocktail")} onNext={submit} nextLabel="Submit for Review" busy={busy} />
        </div>
      )}

      {screen === "done" && (
        <StatusPanel title="We’ve got it! 🍸">
          <p>
            Thanks, <strong>{firstName}</strong>. We’ve received your submission for <strong>{ev.name}</strong>.
          </p>
          <p>Our team will review it and may make small editorial changes before it appears on the event page.</p>
          <p>
            You can return to this link to check your status. Changes are welcome until <strong>{ev.deadlineText || "the deadline"}</strong>,
            unless your submission has already been approved. After approval, email <strong>{email}</strong> for updates.
          </p>
          <p>
            Before the event, we’ll email you the <strong>exact number of guest samples to batch</strong> and the{" "}
            <strong>number of hero cocktails to make live</strong>.
          </p>
          <p>
            Need featured spirit for your batch or ingredient prep? Email <strong>{email}</strong> with the quantity you need to
            arrange a pickup.
          </p>
          <p className="!mt-8">
            <strong>We’re looking forward to seeing what you bring to the bar.</strong>
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
              Still need to submit your details or make a change? Please email <strong>{email}</strong> so we can help.
            </p>
          </StatusPanel>
        ) : status === "approved" || locked === "approved" ? (
          <StatusPanel title="You’re all set!">
            <p>
              Your submission for <strong>{ev.name}</strong> has been approved and will appear on the event page.
            </p>
            <p>We’ll email you before the event with the guest sample count and the number of hero cocktails to prepare for.</p>
            <p>
              Need to change something? Email <strong>{email}</strong>.
            </p>
          </StatusPanel>
        ) : status === "changes_requested" ? (
          <StatusPanel title="Your submission needs an update.">
            <p>
              We’ve reviewed your entry for <strong>{ev.name}</strong> and have a note for you:
            </p>
            <blockquote className="cmp-card p-5 text-left italic text-[var(--cmp-text)] whitespace-pre-line">{submission.adminNote}</blockquote>
            <p>
              Please make the requested changes and resubmit by <strong>{ev.deadlineText || "the deadline"}</strong>.
            </p>
            <button className="cmp-btn w-full !mt-10" onClick={() => go("rules")}>
              Edit Submission
            </button>
          </StatusPanel>
        ) : status === "submitted" ? (
          <StatusPanel title="Your submission is under review.">
            <p>
              We’ve received your entry for <strong>{ev.name}</strong>. You can still make changes before approval, up until{" "}
              <strong>{ev.deadlineText || "the deadline"}</strong>.
            </p>
            <button className="cmp-btn w-full !mt-10" onClick={() => go("about")}>
              Edit Submission
            </button>
          </StatusPanel>
        ) : (
          // Started but never submitted — pick up where they left off.
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
