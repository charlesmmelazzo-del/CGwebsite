"use client";

import { useState } from "react";
import { Button, Cover, Field, Notice, TextLink, inputCls, postJson, useBotFields } from "./ui";

export default function Forgot() {
  const { trap, fields } = useBotFields();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await postJson("/api/passport/forgot", { email, ...fields() });
    setBusy(false);
    if (r.ok) setSent(true);
    else setError(r.data.error || "Something went wrong. Please try again.");
  };

  return (
    <Cover title="Forgot your password?" subtitle={sent ? undefined : "Enter your email and we'll send you a link to choose a new one."}
      footer={<TextLink href="/passport">Back to sign in</TextLink>}>
      {sent ? (
        // The same words whether or not the email has a Passport.
        <Notice kind="ok">If that email has a Passport, a link to reset your password is on its way. It works once and expires in an hour. Check your spam folder if it hasn&rsquo;t arrived in a few minutes.</Notice>
      ) : (
        <form onSubmit={submit} className="space-y-4 relative" noValidate>
          {trap}
          <Field label="Email">
            <input className={inputCls} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {error && <Notice>{error}</Notice>}
          <Button busy={busy} disabled={!email}>Send reset link</Button>
        </form>
      )}
    </Cover>
  );
}
