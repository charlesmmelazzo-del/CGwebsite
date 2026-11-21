"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, C, Field, Notice, inputCls, postJson } from "./ui";

/**
 * Shown after joining when the number they gave was already on another Passport
 * (only said now, once their email is confirmed, never on the sign-up form).
 */
export default function PhonePrompt() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await postJson("/api/passport/me", { phone }, "PUT");
    setBusy(false);
    if (r.ok) router.refresh();
    else setError(r.data.error || "Couldn't save that. Please try again.");
  };
  return (
    <section className="rounded-xl border p-5 mb-6" style={{ borderColor: C.brass + "66", background: "#1a1f14" }}>
      <p className="font-body text-[11px] tracking-[0.3em] uppercase" style={{ color: C.brass }}>One more thing</p>
      <h2 className="font-display text-2xl mt-1" style={{ color: C.text }}>Add your phone number</h2>
      <p className="font-body text-sm mt-2 leading-relaxed" style={{ color: C.muted }}>
        The number you gave is already linked to another Passport. Add a different mobile number, or see us at the bar and we&rsquo;ll sort it out.
      </p>
      <form onSubmit={save} className="space-y-3 mt-4" noValidate>
        <Field label="Mobile phone"><input className={inputCls} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        {error && <Notice>{error}</Notice>}
        <Button busy={busy} disabled={!phone}>Save number</Button>
      </form>
    </section>
  );
}
