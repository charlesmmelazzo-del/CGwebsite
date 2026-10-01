"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 bg-[#1a1f17] text-white text-xs tracking-[0.18em] uppercase px-5 h-11"
    >
      <Printer size={14} /> Print / Save as PDF
    </button>
  );
}
