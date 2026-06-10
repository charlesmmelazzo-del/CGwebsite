"use client";

import { useEffect } from "react";

// Global error boundary. Catches render/runtime errors in the route tree
// (e.g. Supabase unreachable mid-render) so visitors see a branded fallback
// with a retry instead of a blank page or raw stack trace.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <div
      style={{ backgroundColor: "#3B5040", color: "#A8C4A0" }}
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
    >
      <h1 className="text-3xl sm:text-4xl font-serif mb-3 tracking-wide">
        Something went wrong
      </h1>
      <p className="max-w-md text-sm sm:text-base opacity-80 mb-8">
        We&apos;re having trouble loading this page right now. Please try again in
        a moment.
      </p>
      <button
        onClick={reset}
        style={{ borderColor: "#A8C4A0", color: "#A8C4A0" }}
        className="border px-6 py-2.5 text-sm tracking-widest uppercase transition-opacity hover:opacity-70"
      >
        Try again
      </button>
    </div>
  );
}
