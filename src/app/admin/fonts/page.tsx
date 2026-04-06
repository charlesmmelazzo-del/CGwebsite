"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, Trash2, Save, Type, CheckCircle } from "lucide-react";
import { FONT_ROLES } from "@/lib/fontRoles";
import clsx from "clsx";

interface FontFile {
  id: string;
  filename: string;
  url: string;
  weight: string;
  style: "normal" | "italic";
  format: string;
}

interface FontEntry {
  id: string;
  displayName: string;
  family: string;
  files: FontFile[];
  uploadedAt: string;
}

interface FontAssignments {
  display?: string | null;
  body?: string | null;
  nav?: string | null;
  button?: string | null;
  label?: string | null;
}

interface FontData {
  fonts: FontEntry[];
  assignments: FontAssignments;
}

const WEIGHT_OPTIONS = [
  { value: "100", label: "100 — Thin" },
  { value: "200", label: "200 — ExtraLight" },
  { value: "300", label: "300 — Light" },
  { value: "400", label: "400 — Regular" },
  { value: "500", label: "500 — Medium" },
  { value: "600", label: "600 — SemiBold" },
  { value: "700", label: "700 — Bold" },
  { value: "800", label: "800 — ExtraBold" },
  { value: "900", label: "900 — Black" },
];

function newId() { return `f-${Date.now()}-${Math.random().toString(36).slice(2)}`; }

export default function AdminFontsPage() {
  const [data, setData] = useState<FontData>({ fonts: [], assignments: {} });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [assignments, setAssignments] = useState<FontAssignments>({});

  // Upload form state
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadFamily, setUploadFamily] = useState("");
  const [uploadWeight, setUploadWeight] = useState("400");
  const [uploadStyle, setUploadStyle] = useState<"normal" | "italic">("normal");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load font data
  useEffect(() => {
    fetch("/api/admin/fonts")
      .then((r) => r.json())
      .then((d: FontData) => {
        setData(d);
        setAssignments(d.assignments ?? {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Upload a font file ──────────────────────────────────────────────────────
  async function handleUpload() {
    if (!uploadFile || !uploadName.trim() || !uploadFamily.trim()) {
      setUploadError("Please fill in font name, CSS family name, and select a file.");
      return;
    }
    setUploadError("");
    setUploading(true);

    try {
      // 1. Upload the file
      const fd = new FormData();
      fd.append("file", uploadFile);
      const upRes = await fetch("/api/admin/fonts/upload", { method: "POST", body: fd });
      const upJson = await upRes.json();
      if (!upRes.ok) throw new Error(upJson.error ?? "Upload failed");

      // 2. Check if a font with this family already exists
      const existing = data.fonts.find((f) => f.family === uploadFamily.trim());

      if (existing) {
        // Add a new file variant to the existing font entry
        const newFile: FontFile = {
          id: newId(),
          filename: upJson.filename,
          url: upJson.url,
          weight: uploadWeight,
          style: uploadStyle,
          format: upJson.format,
        };
        const updatedFont: FontEntry = { ...existing, files: [...existing.files, newFile] };
        const addRes = await fetch("/api/admin/fonts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "addFont", font: updatedFont }),
        });
        // Replace old entry in local state
        const addJson = await addRes.json();
        setData(addJson.data);
      } else {
        // Create brand-new font entry
        const newFont: FontEntry = {
          id: newId(),
          displayName: uploadName.trim(),
          family: uploadFamily.trim(),
          files: [{
            id: newId(),
            filename: upJson.filename,
            url: upJson.url,
            weight: uploadWeight,
            style: uploadStyle,
            format: upJson.format,
          }],
          uploadedAt: new Date().toISOString(),
        };
        const addRes = await fetch("/api/admin/fonts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "addFont", font: newFont }),
        });
        const addJson = await addRes.json();
        setData(addJson.data);
      }

      setUploadSuccess(`"${uploadName.trim()}" uploaded successfully!`);
      setUploadName("");
      setUploadFamily("");
      setUploadWeight("400");
      setUploadStyle("normal");
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setUploadSuccess(""), 4000);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // ── Delete a font ───────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    await fetch("/api/admin/fonts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setData((prev) => ({ ...prev, fonts: prev.fonts.filter((f) => f.id !== id) }));
  }

  // ── Save assignments ────────────────────────────────────────────────────────
  async function handleSave() {
    await fetch("/api/admin/fonts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updateAssignments", assignments }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // ── Auto-fill CSS family from display name ─────────────────────────────────
  function handleNameChange(val: string) {
    setUploadName(val);
    if (!uploadFamily) {
      setUploadFamily(val.replace(/\s+/g, ""));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-gray-400 text-sm">Loading fonts...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl text-gray-800" style={{ fontFamily: "var(--font-display)" }}>
            Type & Fonts
          </h1>
          <p className="text-gray-400 text-xs mt-1">Upload font files and assign them to text roles across the site.</p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-[#C97D5A] text-white text-xs tracking-widest uppercase hover:bg-[#b86d4a] transition-colors"
        >
          <Save size={14} />
          {saved ? "Saved!" : "Save Assignments"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ── LEFT: Upload + Font Library ──────────────────────────────────── */}
        <div>
          {/* Upload form */}
          <section className="bg-white border border-gray-200 rounded-sm p-5 mb-6">
            <h2 className="text-xs tracking-widest uppercase text-gray-400 mb-4 flex items-center gap-2">
              <Upload size={13} /> Upload Font File
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1">Display Name</label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Proxima Nova"
                  className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm px-3 py-2 outline-none focus:border-[#C97D5A]/50 rounded-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1">
                  CSS Font-Family Name
                  <span className="ml-1 normal-case text-gray-300">(no spaces, used in CSS)</span>
                </label>
                <input
                  type="text"
                  value={uploadFamily}
                  onChange={(e) => setUploadFamily(e.target.value.replace(/\s+/g, ""))}
                  placeholder="e.g. ProximaNova"
                  className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm px-3 py-2 outline-none focus:border-[#C97D5A]/50 rounded-sm font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1">Weight</label>
                  <select
                    value={uploadWeight}
                    onChange={(e) => setUploadWeight(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-600 text-xs px-3 py-2 outline-none rounded-sm"
                  >
                    {WEIGHT_OPTIONS.map((w) => (
                      <option key={w.value} value={w.value}>{w.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1">Style</label>
                  <select
                    value={uploadStyle}
                    onChange={(e) => setUploadStyle(e.target.value as "normal" | "italic")}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-600 text-xs px-3 py-2 outline-none rounded-sm"
                  >
                    <option value="normal">Normal</option>
                    <option value="italic">Italic</option>
                  </select>
                </div>
              </div>

              {/* File chooser */}
              <div>
                <label className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1">Font File (.woff2 recommended)</label>
                <div
                  className={clsx(
                    "border-2 border-dashed rounded-sm p-4 text-center cursor-pointer transition-colors",
                    uploadFile ? "border-[#C97D5A]/40 bg-[#C97D5A]/5" : "border-gray-200 hover:border-gray-400"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadFile ? (
                    <div>
                      <p className="text-xs text-[#C97D5A] font-medium">{uploadFile.name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <Type size={20} className="mx-auto text-gray-300 mb-1" />
                      <p className="text-xs text-gray-400">Click to choose a font file</p>
                      <p className="text-[10px] text-gray-300 mt-0.5">.woff2, .woff, .ttf, .otf</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".woff2,.woff,.ttf,.otf"
                  className="hidden"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                />
              </div>

              {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
              {uploadSuccess && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle size={12} /> {uploadSuccess}
                </p>
              )}

              <button
                onClick={handleUpload}
                disabled={uploading || !uploadFile}
                className="w-full py-2.5 bg-[#C97D5A] text-white text-xs tracking-widest uppercase hover:bg-[#b86d4a] transition-colors disabled:opacity-40"
              >
                {uploading ? "Uploading..." : "Upload Font"}
              </button>
            </div>
          </section>

          {/* Font library */}
          <section>
            <h2 className="text-xs tracking-widest uppercase text-gray-400 mb-3 border-b border-gray-200 pb-2">
              Font Library ({data.fonts.length})
            </h2>

            {data.fonts.length === 0 ? (
              <p className="text-gray-300 text-sm text-center py-8">
                No fonts uploaded yet
              </p>
            ) : (
              <div className="space-y-3">
                {data.fonts.map((font) => (
                  <div key={font.id} className="bg-white border border-gray-200 rounded-sm p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p
                          className="text-gray-800 text-lg leading-tight"
                          style={{ fontFamily: `'${font.family}', serif` }}
                        >
                          {font.displayName}
                        </p>
                        <p className="text-gray-400 text-[10px] font-mono mt-0.5">
                          CSS: &apos;{font.family}&apos;
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(font.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors ml-3 shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Preview */}
                    <div
                      className="text-sm text-gray-600 border-t border-gray-100 pt-2 mt-2"
                      style={{ fontFamily: `'${font.family}', serif` }}
                    >
                      The quick brown fox jumps over the lazy dog
                    </div>

                    {/* Files list */}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {font.files.map((file) => (
                        <span
                          key={file.id}
                          className="text-[10px] text-gray-400 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5"
                        >
                          {file.weight} {file.style}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── RIGHT: Font Role Assignments ─────────────────────────────────── */}
        <div>
          <section className="bg-white border border-gray-200 rounded-sm p-5">
            <h2 className="text-xs tracking-widest uppercase text-gray-400 mb-1 flex items-center gap-2">
              <Type size={13} /> Font Role Assignments
            </h2>
            <p className="text-gray-400 text-[11px] mb-5">
              Choose which font is used for each text role across the site.
              Changes take effect after saving and refreshing the page.
            </p>

            <div className="space-y-5">
              {FONT_ROLES.map((role) => {
                const assigned = assignments[role.id as keyof FontAssignments];
                return (
                  <div key={role.id}>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                      {role.label}
                    </label>
                    <p className="text-[10px] text-gray-400 mb-2">{role.description}</p>

                    <select
                      value={assigned ?? ""}
                      onChange={(e) =>
                        setAssignments((prev) => ({
                          ...prev,
                          [role.id]: e.target.value || null,
                        }))
                      }
                      className="w-full bg-gray-50 border border-gray-200 text-gray-600 text-xs px-3 py-2 outline-none focus:border-[#C97D5A]/50 rounded-sm"
                    >
                      <option value="">— Use default ({role.currentDefault})</option>
                      {data.fonts.map((font) => (
                        <option key={font.id} value={font.family}>
                          {font.displayName} ({font.family})
                        </option>
                      ))}
                    </select>

                    {/* Preview in assigned font */}
                    {assigned && (
                      <p
                        className="text-gray-500 text-sm mt-1.5 italic"
                        style={{ fontFamily: `'${assigned}', sans-serif` }}
                      >
                        Preview: Common Good Cocktail House
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100">
              <p className="text-[10px] text-gray-300 leading-relaxed">
                Fonts are served from <code className="bg-gray-100 px-1 rounded">/public/fonts/</code>.
                After uploading, assignments are applied site-wide on every page load.
                For best results, upload <strong>.woff2</strong> format — it&apos;s the smallest and fastest.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
