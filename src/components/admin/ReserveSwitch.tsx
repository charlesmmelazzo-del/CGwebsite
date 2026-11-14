"use client";

import { useEffect, useState } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";

/**
 * The on/off switch for the whole Reserve feature on the public site.
 * Saves the moment it is confirmed — it is not part of the page's Save button.
 */
export default function ReserveSwitch() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [forcedOn, setForcedOn] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/reserve/enabled")
      .then((r) => r.json())
      .then((d) => { setEnabled(d.enabled === true); setForcedOn(d.forcedOn === true); })
      .catch(() => setError("Couldn't check whether the Reserve page is enabled."));
  }, []);

  async function apply(next: boolean) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/reserve/enabled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || "Couldn't save. Please try again.");
      setEnabled(next);
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (enabled === null) {
    return (
      <div className="mb-6 p-4 bg-white border border-gray-200 rounded-sm text-sm text-gray-400 flex items-center gap-2">
        {error ? <span className="text-red-500">{error}</span> : <><Loader2 size={15} className="animate-spin" /> Checking status…</>}
      </div>
    );
  }

  return (
    <div
      className={`mb-6 p-4 border rounded-sm ${enabled ? "bg-green-50 border-green-200" : "bg-white border-gray-300"}`}
      role="region"
      aria-label="Reserve page status"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {enabled
            ? <Eye size={18} className="text-green-700 shrink-0 mt-0.5" />
            : <EyeOff size={18} className="text-gray-400 shrink-0 mt-0.5" />}
          <div>
            <p className="text-sm font-medium text-gray-800">
              Reserve page is {enabled ? "enabled" : "disabled"}
            </p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              {enabled
                ? "Guests can see Reserve in the site navigation and book online."
                : "Hidden from the website: no navigation link, the page can't be opened, and events show no table bookings. You can still edit everything here."}
            </p>
          </div>
        </div>
        {!confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={`shrink-0 px-4 py-2 text-xs tracking-widest uppercase transition-colors ${
              enabled
                ? "border border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-600 bg-white"
                : "bg-[#C97D5A] text-white hover:bg-[#b86d4a]"
            }`}
          >
            {enabled ? "Disable" : "Enable"}
          </button>
        )}
      </div>

      {confirming && (
        <div className="mt-3 pt-3 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-700 leading-relaxed max-w-md">
            {enabled
              ? "Hide Reserve from the website? Guests who already have a reservation link won't be able to open it while it's disabled."
              : "Show Reserve on the live website now? It appears in the navigation right away and guests can start booking."}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => setConfirming(false)} disabled={saving} className="px-3 py-2 text-xs tracking-widest uppercase text-gray-500 hover:text-gray-800">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => apply(!enabled)}
              disabled={saving}
              className={`flex items-center gap-2 px-4 py-2 text-xs tracking-widest uppercase text-white disabled:opacity-60 ${enabled ? "bg-red-600 hover:bg-red-700" : "bg-green-700 hover:bg-green-800"}`}
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {enabled ? "Yes, disable" : "Yes, enable"}
            </button>
          </div>
        </div>
      )}

      {forcedOn && !enabled && (
        <p className="mt-3 pt-3 border-t border-gray-200 text-xs text-amber-700 leading-relaxed">
          This is the staging site, where Reserve always shows so it can be tested. The switch above controls the live website.
        </p>
      )}
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </div>
  );
}
