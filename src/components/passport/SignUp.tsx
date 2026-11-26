"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Agreement from "./Terms";
import CheckEmail from "./CheckEmail";
import { Button, C, Cover, Field, Notice, TextLink, inputCls, postJson, useBotFields } from "./ui";

type Person = { first_name: string; last_name: string; email: string };
const blank = (): Person => ({ first_name: "", last_name: "", email: "" });

/**
 * Sign-up, in two steps: the member's own details, then the household question.
 * Reached only as the sign-up page allows (Invite only: with a valid invitation;
 * Open: anyone). The Bible checks again and uses the invitation up on finishing.
 */
export default function SignUp({ termsText, termsVersion, invitationCode }: { termsText: string; termsVersion: number; invitationCode?: string }) {
  const router = useRouter();
  const { trap, fields } = useBotFields();
  const [step, setStep] = useState<1 | 2>(1);
  const [me, setMe] = useState({ first_name: "", last_name: "", email: "", phone: "" });
  const [password, setPassword] = useState("");
  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [wantsHousehold, setWantsHousehold] = useState<boolean | null>(null);
  const [people, setPeople] = useState<Person[]>([blank()]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const next = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!me.first_name.trim() || !me.last_name.trim()) return setError("Enter your first and last name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(me.email.trim())) return setError("Enter a valid email address.");
    if (me.phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "").length !== 10) return setError("Enter a 10-digit phone number.");
    if (password.length < 8) return setError("Choose a password of at least 8 characters.");
    if (!age) return setError("Please confirm you are 21 or over.");
    if (!terms) return setError("Please accept the terms and privacy statement.");
    setStep(2);
  };

  const finish = async () => {
    setError("");
    const household = wantsHousehold ? people.filter((p) => p.first_name || p.last_name || p.email) : [];
    setBusy(true);
    const r = await postJson<{ check_email?: boolean; signed_in?: boolean }>("/api/passport/signup", {
      ...me, password, age_confirmed: age, terms_version: termsVersion, marketing_consent: marketing, household,
      ...(invitationCode ? { invitation_code: invitationCode } : {}), ...fields(),
    });
    if (r.ok && r.data.check_email) {
      setSent(true);
      return;
    }
    if (r.ok) {
      router.replace("/passport");
      router.refresh();
      return;
    }
    setBusy(false);
    setError(r.data.error || "Something went wrong. Please try again.");
  };

  const set = (k: keyof typeof me) => (e: React.ChangeEvent<HTMLInputElement>) => setMe({ ...me, [k]: e.target.value });

  if (sent) return <CheckEmail email={me.email.trim()} />;

  if (step === 2) {
    return (
      <Cover title="Anyone else at home?" subtitle="Is there anyone in your household who also comes in that you'd like to add?">
        <div className="space-y-4 relative">
          {trap}
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" kind={wantsHousehold === true ? "primary" : "quiet"} onClick={() => setWantsHousehold(true)}>Yes</Button>
            <Button type="button" kind={wantsHousehold === false ? "primary" : "quiet"} onClick={() => setWantsHousehold(false)}>No</Button>
          </div>
          {wantsHousehold && (
            <div className="space-y-5">
              <p className="font-body text-sm leading-relaxed" style={{ color: C.muted }}>
                A household is up to 3 people, counting you. Once you confirm your email, we&rsquo;ll email each person a link to set up their own Passport. They choose their own password, and their history stays their own.
              </p>
              {people.map((p, i) => (
                <div key={i} className="space-y-3 rounded-lg border p-4" style={{ borderColor: C.line }}>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="First name"><input className={inputCls} value={p.first_name} onChange={(e) => setPeople(people.map((x, j) => (j === i ? { ...x, first_name: e.target.value } : x)))} /></Field>
                    <Field label="Last name"><input className={inputCls} value={p.last_name} onChange={(e) => setPeople(people.map((x, j) => (j === i ? { ...x, last_name: e.target.value } : x)))} /></Field>
                  </div>
                  <Field label="Their email"><input className={inputCls} type="email" inputMode="email" value={p.email} onChange={(e) => setPeople(people.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} /></Field>
                  {people.length > 1 && (
                    <button type="button" className="font-body text-[0.875rem] underline" style={{ color: C.muted }} onClick={() => setPeople(people.filter((_, j) => j !== i))}>Remove</button>
                  )}
                </div>
              ))}
              {people.length < 2 && (
                <button type="button" className="font-body text-sm underline underline-offset-4" style={{ color: C.text }} onClick={() => setPeople([...people, blank()])}>+ Add another person</button>
              )}
            </div>
          )}
          {error && <Notice>{error}</Notice>}
          <Button type="button" busy={busy} disabled={wantsHousehold === null} onClick={finish}>Open my Passport</Button>
          <button type="button" className="w-full font-body text-sm underline underline-offset-4" style={{ color: C.muted }} onClick={() => setStep(1)}>Back</button>
        </div>
      </Cover>
    );
  }

  return (
    <Cover title={invitationCode ? "You're invited" : "Create your Passport"} subtitle="So every bartender knows your favorites, no matter who is working."
      footer={<>Already have one? <TextLink href="/passport">Sign in</TextLink></>}>
      <form onSubmit={next} className="space-y-4 relative" noValidate>
        {trap}
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name"><input className={inputCls} autoComplete="given-name" value={me.first_name} onChange={set("first_name")} /></Field>
          <Field label="Last name"><input className={inputCls} autoComplete="family-name" value={me.last_name} onChange={set("last_name")} /></Field>
        </div>
        <Field label="Email"><input className={inputCls} type="email" autoComplete="email" inputMode="email" value={me.email} onChange={set("email")} /></Field>
        <Field label="Mobile phone" hint="Your email and phone are how we match your visits to your Passport.">
          <input className={inputCls} type="tel" autoComplete="tel" inputMode="tel" value={me.phone} onChange={set("phone")} />
        </Field>
        <Field label="Password" hint="At least 8 characters.">
          <input className={inputCls} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Agreement termsText={termsText} age={age} setAge={setAge} terms={terms} setTerms={setTerms} marketing={marketing} setMarketing={setMarketing} />
        {error && <Notice>{error}</Notice>}
        <Button>Continue</Button>
      </form>
    </Cover>
  );
}
