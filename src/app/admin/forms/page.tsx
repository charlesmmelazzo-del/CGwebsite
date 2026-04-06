"use client";

import { useEffect, useState } from "react";
import type { FormSubmission } from "@/types";
import { Download, RefreshCw } from "lucide-react";

const FORM_TABS = [
  { id: "all", label: "All Submissions" },
  { id: "host-event-inquiry", label: "Event Inquiries" },
  { id: "home-capture", label: "Home Form" },
];

export default function AdminFormsPage() {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const url = activeTab === "all"
        ? "/api/forms/submit"
        : `/api/forms/submit?formId=${activeTab}`;
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
                <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
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
    </div>
  );
}
