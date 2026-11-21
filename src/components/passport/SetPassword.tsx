"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Agreement from "./Terms";
import { Button, Cover, Field, Notice, TextLink, inputCls, postJson } from "./ui";

type Link = { kind: "set_password" | "reset"; first_name: string; needs_details: boolean; phone: string };

/** From an emailed link: choose a password (and, the first time, confirm the details and accept the terms). */
export default function SetPassword({ termsText, termsVersion }: { termsText: string; termsVersion: number }) {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";
  const [link, setLink] = useState<Link | null>(null);
  const [gone, setGone] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setGone("This link is missing its code. Open it again from your email."); return; }
    postJson<Link>("/api/passport/link", { action: "check", token }).then((r) => {
      if (r.ok) { setLink(r.data); setPhone(r.data.phone || ""); }
      else setGone(r.data.error || "This link has expired or has already been used.");
    });
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Choose a password of at least 8 characters.");
    if (password !== again) return setError("The two passwords don't match.");
    if (link?.needs_details) {
      if (!age) return setError("Please confirm you are 21 or over.");
      if (!terms) return setError("Please accept the terms and privacy statement.");
    }
    setBusy(true);
    const r = await postJson("/api/passport/link", {
      action: "use", token, password,
      ...(link?.needs_details ? { phone, age_confirmed: age, terms_version: termsVersion, marketing_consent: marketing } : {}),
    });
    if (r.ok) {
      router.replace("/passport");
      router.refresh();
      return;
    }
    setBusy(false);
    setError(r.data.error || "Something went wrong. Please try again.");
  };

  if (gone) {
    return (
      <Cover title="This link no longer works" footer={<TextLink href="/passport/forgot">Send me a new link</TextLink>}>
        <Notice>{gone}</Notice>
      </Cover>
    );
  }
  if (!link) return <Cover title="One moment…"><span /></Cover>;

  const first = link.needs_details;
  return (
    <Cover
      title={first ? `Welcome, ${link.first_name}` : "Choose a new password"}
      subtitle={first ? "Choose a password to finish setting up your Passport." : `Hi ${link.first_name}. Signing in with your new password signs you out everywhere else.`}
      footer={<TextLink href="/passport">Back to sign in</TextLink>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {first && (
          <Field label="Mobile phone" hint="We use it to match your visits to your Passport. We don't text you.">
            <input className={inputCls} type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        )}
        <Field label="New password" hint="At least 8 characters.">
          <input className={inputCls} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Type it again">
          <input className={inputCls} type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </Field>
        {first && <Agreement termsText={termsText} age={age} setAge={setAge} terms={terms} setTerms={setTerms} marketing={marketing} setMarketing={setMarketing} />}
        {error && <Notice>{error}</Notice>}
        <Button busy={busy}>{first ? "Open my Passport" : "Save password"}</Button>
      </form>
    </Cover>
  );
}
