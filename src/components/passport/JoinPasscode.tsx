"use client";

import { useRef, useState } from "react";
import SignUp from "./SignUp";
import { Button, C, Cover, Field, Notice, TextLink, inputCls, postJson, useBotFields } from "./ui";
import { BAD_PASSCODE, PASSCODE_LEN, typedPasscode } from "@/lib/passport/passcode";

/**
 * File 18: the first thing on the invitation-card sign-up page. "Welcome to Common Good Passport", then the
 * 4-character passcode from the card (capitals, any case accepted; pasting "ab-cd" works too). A good passcode opens
 * the usual sign-up form right here; the passcode itself is only used when they finish.
 */
export default function JoinPasscode({ slug, termsText, termsVersion }: { slug: string; termsText: string; termsVersion: number }) {
  const { trap, fields } = useBotFields();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [good, setGood] = useState("");
  const box = useRef<HTMLInputElement>(null);

  if (good) return <SignUp termsText={termsText} termsVersion={termsVersion} invitationCode={good} joinSlug={slug} />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== PASSCODE_LEN) return;
    setBusy(true);
    setError("");
    const r = await postJson<{ code: string }>("/api/passport/join", { slug, code, ...fields() });
    if (r.ok && r.data.code) {
      setGood(r.data.code);
      return;
    }
    setBusy(false);
    setError(r.data.error || BAD_PASSCODE);
    box.current?.select();
  };

  return (
    <Cover title="Welcome to Common Good Passport" subtitle="Enter your passcode to sign up."
      footer={<>Already a member? <TextLink href="/passport">Sign in</TextLink></>}>
      <form onSubmit={submit} className="space-y-4 relative" noValidate>
        {trap}
        <Field label="Passcode" hint="The four letters and numbers written on your card.">
          <input ref={box} className={`${inputCls} text-center uppercase font-display`} style={{ fontSize: "2rem", letterSpacing: "0.5em", paddingLeft: "0.5em", color: C.text }}
            value={code} onChange={(e) => setCode(typedPasscode(e.target.value))}
            onPaste={(e) => { e.preventDefault(); setCode(typedPasscode(e.clipboardData.getData("text"))); }}
            type="text" inputMode="text" autoCapitalize="characters" autoComplete="one-time-code" autoCorrect="off" spellCheck={false}
            maxLength={PASSCODE_LEN} aria-label="Passcode" placeholder="····" autoFocus />
        </Field>
        {error && <Notice>{error}</Notice>}
        <Button busy={busy} disabled={code.length !== PASSCODE_LEN}>Continue</Button>
      </form>
    </Cover>
  );
}
