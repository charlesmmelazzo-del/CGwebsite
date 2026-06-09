"use client";

import { useEffect, useState } from "react";
import type { FormSubmission } from "@/types";
import { Download, RefreshCw, Mail, X } from "lucide-react";

const FORM_TABS = [
  { id: "all", label: "All Submissions" },
  { id: "host-event-inquiry", label: "Event Inquiries" },
  { id: "home-capture", label: "Home Form" },
];

export default function AdminFormsPage() {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FormSubmission | null>(null);

  async function load() {
    setLoading(true);
    try {
      const url = activeTab === "all"
        ? "/api/admin/forms"
        : `/api/admin/forms?formId=${activeTab}`;
      const res = await fetch(url);
      const data = await res.json();
      setSubmissions(Array.isArray(data) ? data : []);
    } catch {
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [activeTab]); // eslint-disable-line

  function exportCSV() {
    if (!submissions.length) return;

    const allKeys = Array.from(
      new Set(submissions.flatMap((s) => Object.keys(s.data)))
    );
    const headers = ["submittedAt", "formName", ...allKeys];

    const rows = submissions.map((s) => [
      new Date(s.submittedAt).toLocaleString(),
      s.formName,
      ...allKeys.map((k) => s.data[k] ?? ""),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `submissions-${activeTab}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const allDataKeys = Array.from(
    new Set(submissions.flatMap((s) => Object.keys(s.data)))
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl text-gray-800" style={{ fontFamily: "var(--font-display)" }}>
          Form Submissions
        </h1>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="p-2 text-gray-400 hover:text-gray-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={exportCSV}
            disabled={!submissions.length}
            className="flex items-center gap-2 px-4 py-2 bg-[#C97D5A]/10 text-[#C97D5A] border border-[#C97D5A]/20 text-xs tracking-wider uppercase hover:bg-[#C97D5A]/20 transition-colors disabled:opacity-30"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {FORM_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs tracking-wider uppercase transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-[#C97D5A] text-[#C97D5A]"
                : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : submissions.length === 0 ? (
        <div className="text-center py-16 text-gray-300">
          <p className="text-sm tracking-wider">No submissions yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white border border-gray-200 rounded-sm">
          <p className="text-[11px] text-gray-400 px-4 py-2 border-b border-gray-100">
            Click any row to view all details and email it.
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-2.5 px-4 text-gray-400 tracking-wider uppercase font-medium">Date</th>
                <th className="text-left py-2.5 px-4 text-gray-400 tracking-wider uppercase font-medium">Form</th>
                {allDataKeys.map((k) => (
                  <th key={k} className="text-left py-2.5 px-4 text-gray-400 tracking-wider uppercase font-medium capitalize">
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="border-b border-gray-100 hover:bg-[#C97D5A]/5 transition-colors cursor-pointer"
                >
                  <td className="py-2.5 px-4 text-gray-500 whitespace-nowrap">
                    {new Date(s.submittedAt).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4 text-gray-700">{s.formName}</td>
                  {allDataKeys.map((k) => (
                    <td key={k} className="py-2.5 px-4 text-gray-700 max-w-xs truncate">
                      {s.data[k] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <SubmissionModal submission={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

// ─── Detail + email modal ────────────────────────────────────────────────────
function SubmissionModal({
  submission,
  onClose,
}: {
  submission: FormSubmission;
  onClose: () => void;
}) {
  const [showEmail, setShowEmail] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const entries = Object.entries(submission.data);

  async function sendEmail() {
    const to = recipient.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      setResult({ ok: false, msg: "Please enter a valid email address." });
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/forms/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          formName: submission.formName,
          data: submission.data,
          submittedAt: submission.submittedAt,
        }),
      });

      // Parse the body defensively — a 404/500 may return HTML, not JSON
      const raw = await res.text();
      let json: { error?: string } = {};
      try { json = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON response */ }

      if (res.ok) {
        setResult({ ok: true, msg: `Sent to ${to}` });
        setRecipient("");
      } else if (res.status === 401) {
        setResult({ ok: false, msg: "Your admin session expired — please reload and log in again." });
      } else if (res.status === 404) {
        setResult({ ok: false, msg: "Email feature not deployed yet — wait for the deploy to finish, then retry." });
      } else {
        setResult({ ok: false, msg: json.error ?? `Failed to send email (status ${res.status}).` });
      }
    } catch {
      setResult({ ok: false, msg: "Network error — please try again." });
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-sm shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg text-gray-800" style={{ fontFamily: "var(--font-display)" }}>
              {submission.formName}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(submission.submittedAt).toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Data fields */}
        <div className="px-6 py-4 overflow-y-auto">
          <dl className="divide-y divide-gray-100">
            {entries.length === 0 ? (
              <p className="text-sm text-gray-400">No fields in this submission.</p>
            ) : (
              entries.map(([key, val]) => (
                <div key={key} className="py-2.5 grid grid-cols-3 gap-3">
                  <dt className="text-xs text-gray-400 uppercase tracking-wider capitalize col-span-1 break-words">
                    {key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim()}
                  </dt>
                  <dd className="text-sm text-gray-700 col-span-2 whitespace-pre-wrap break-words">
                    {String(val ?? "—") || "—"}
                  </dd>
                </div>
              ))
            )}
          </dl>
        </div>

        {/* Email action */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          {!showEmail ? (
            <button
              onClick={() => setShowEmail(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#C97D5A] text-white text-xs tracking-wider uppercase hover:bg-[#b86d4a] transition-colors rounded-sm"
            >
              <Mail size={14} />
              Email this submission
            </button>
          ) : (
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
                Send to
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !sending && sendEmail()}
                  placeholder="name@example.com"
                  autoFocus
                  className="flex-1 px-3 py-2 border border-gray-300 text-sm rounded-sm focus:outline-none focus:border-[#C97D5A]"
                />
                <button
                  onClick={sendEmail}
                  disabled={sending}
                  className="px-4 py-2 bg-[#C97D5A] text-white text-xs tracking-wider uppercase hover:bg-[#b86d4a] transition-colors rounded-sm disabled:opacity-50 whitespace-nowrap"
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </div>
              {result && (
                <p className={`text-xs mt-2 ${result.ok ? "text-green-600" : "text-red-500"}`}>
                  {result.msg}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
