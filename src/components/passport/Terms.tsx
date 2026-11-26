"use client";

import { useState } from "react";
import { C, Check } from "./ui";

/** The 21+ confirmation, the terms (readable in place) and the separate, optional marketing box. */
export default function Agreement({ termsText, age, setAge, terms, setTerms, marketing, setMarketing }: {
  termsText: string;
  age: boolean; setAge: (v: boolean) => void;
  terms: boolean; setTerms: (v: boolean) => void;
  marketing: boolean; setMarketing: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-4 rounded-lg border p-4" style={{ borderColor: C.line, background: "#171c12" }}>
      <Check checked={age} onChange={setAge}>I am 21 or over.</Check>
      <div>
        <Check checked={terms} onChange={setTerms}>
          I accept the Passport{" "}
          <button type="button" onClick={(e) => { e.preventDefault(); setOpen((o) => !o); }} className="underline underline-offset-4 decoration-[#C9A96E]/60">
            terms and privacy statement
          </button>.
        </Check>
        {open && (
          <div className="mt-3 max-h-64 overflow-y-auto rounded-md border px-4 py-3 font-body text-[0.875rem] leading-relaxed whitespace-pre-line"
            style={{ borderColor: C.line, color: C.muted, background: "#0E120B" }}>
            {termsText}
          </div>
        )}
      </div>
      <Check checked={marketing} onChange={setMarketing}>
        Send me occasional news and offers from Common Good. <span style={{ color: C.faint }}>(Optional)</span>
      </Check>
    </div>
  );
}
