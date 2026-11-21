"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Cover, Field, Notice, TextLink, inputCls, postJson, useBotFields } from "./ui";

/**
 * Sign-up set to Invite only, with no valid invitation: a short "by invitation"
 * message, and a box for a code someone was given on a card.
 */
export default function ByInvitation({ error: initialError }: { error?: string }) {
  const router = useRouter();
  const { trap, fields } = useBotFields();
  const [code, setCode] = useState("");
  const [error, setError] = useState(initialError || "");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await postJson<{ code: string }>("/api/passport/invitation", { code, ...fields() });
    if (r.ok && r.data.code) {
      router.replace(`/passport/signup?code=${encodeURIComponent(r.data.code)}`);
      return;
    }
    setBusy(false);
    setError(r.data.error || "Something went wrong. Please try again.");
  };

  return (
    <Cover title="Passport is by invitation" subtitle="Ask your bartender about joining next time you're in."
      footer={<>Already a member? <TextLink href="/passport">Sign in</TextLink></>}>
      <form onSubmit={submit} className="space-y-4 relative" noValidate>
        {trap}
        <Field label="Have an invitation code?">
          <input className={`${inputCls} uppercase tracking-[0.3em] text-center`} value={code} onChange={(e) => setCode(e.target.value)}
            placeholder="XXXX-XXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={12} />
        </Field>
        {error && <Notice>{error}</Notice>}
        <Button busy={busy} disabled={code.replace(/[^A-Za-z0-9]/g, "").length < 8}>Continue</Button>
      </form>
    </Cover>
  );
}
