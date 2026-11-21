"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Cover, Notice, TextLink, postJson } from "./ui";

/**
 * From the sign-up confirmation email. A button (not automatic) so a mail
 * scanner that opens links can't confirm on the guest's behalf; tapping it
 * creates the Passport and signs in on this device.
 */
export default function Confirm() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";
  const [error, setError] = useState(token ? "" : "This link is missing its code. Open it again from your email.");
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true);
    setError("");
    const r = await postJson("/api/passport/confirm", { token });
    if (r.ok) {
      router.replace("/passport");
      router.refresh();
      return;
    }
    setBusy(false);
    setError(r.data.error || "Something went wrong. Please try again.");
  };

  return (
    <Cover title="Confirm your email" subtitle="One tap and your Passport is ready."
      footer={<TextLink href="/passport">Back to sign in</TextLink>}>
      <div className="space-y-4">
        {error && <Notice>{error}</Notice>}
        <Button type="button" busy={busy} disabled={!token} onClick={go}>Open my Passport</Button>
      </div>
    </Cover>
  );
}
