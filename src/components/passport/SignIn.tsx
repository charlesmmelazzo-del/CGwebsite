"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Cover, Field, Notice, TextLink, inputCls, postJson, useBotFields } from "./ui";

export default function SignIn({ signupEnabled, notice }: { signupEnabled: boolean; notice?: string }) {
  const router = useRouter();
  const { trap, fields } = useBotFields();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await postJson("/api/passport/signin", { email, password, ...fields() });
    if (r.ok) {
      router.refresh();
      return;
    }
    setError(r.data.error || "Something went wrong. Please try again.");
    setBusy(false);
  };

  return (
    <Cover title="Welcome back" subtitle="Sign in to your Common Good Passport."
      footer={
        <div className="space-y-3">
          <p><TextLink href="/passport/forgot">Forgot your password?</TextLink></p>
          {signupEnabled && <p>New here? <TextLink href="/passport/signup">Create your Passport</TextLink></p>}
          <p className="pt-4"><a href="/" className="text-xs tracking-[0.2em] uppercase opacity-70 hover:opacity-100">← commongoodcocktailhouse.com</a></p>
        </div>
      }>
      <form onSubmit={submit} className="space-y-4 relative" noValidate>
        {trap}
        {notice && !error && <Notice kind="ok">{notice}</Notice>}
        <Field label="Email">
          <input className={inputCls} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password">
          <input className={inputCls} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        {error && <Notice>{error}</Notice>}
        <Button busy={busy} disabled={!email || !password}>Sign in</Button>
      </form>
    </Cover>
  );
}
