"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Upload, Image as ImageIcon, Loader2, Trash2, Check, Link as LinkIcon } from "lucide-react";
import Image from "next/image";

interface StorageImage {
  name: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt?: string;
}

interface ImagePickerProps {
  /** Current image URL (can be a Supabase URL or any external URL) */
  value?: string;
  onChange: (url: string) => void;
  /** Optional label shown above the control */
  label?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// ─── Library Modal ─────────────────────────────────────────────────────────────
function ImageLibraryModal({
  onSelect,
  onClose,
}: {
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [images, setImages] = useState<StorageImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadImages = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/images")
      .then((r) => r.json())
      .then((d) => setImages(d.files ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadImages(); }, [loadImages]);

  async function uploadFile(file: File) {
    setUploading(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/images/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "Upload failed");
      // Prepend new image to list
      setImages((prev) => [{ name: data.name, url: data.url, size: data.size, mimeType: data.mimeType }, ...prev]);
    } catch (e) {
      setUploadError(String(e));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(name: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete "${name}" permanently?`)) return;
    setDeletingName(name);
    try {
      await fetch("/api/admin/images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: name }),
      });
      setImages((prev) => prev.filter((img) => img.name !== name));
    } catch {
      alert("Failed to delete image.");
    } finally {
      setDeletingName(null);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) uploadFile(file);
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-sm shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-gray-200">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-sm tracking-widest uppercase text-gray-700">Image Library</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Upload zone */}
        <div
          className={`mx-5 mt-4 border-2 border-dashed rounded-sm p-5 text-center transition-colors cursor-pointer shrink-0 ${dragging ? "border-[#C97D5A] bg-[#C97D5A]/5" : "border-gray-200 hover:border-[#C97D5A]/50"}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-gray-500">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-xs tracking-wider">Uploading...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-gray-400">
              <Upload size={15} />
              <span className="text-xs tracking-wider">Drop an image here or click to upload</span>
            </div>
          )}
          {uploadError && (
            <p className="text-red-500 text-xs mt-1">{uploadError}</p>
          )}
        </div>

        {/* Image grid */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Loading images...</span>
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ImageIcon size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No images uploaded yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {images.map((img) => (
                <div
                  key={img.name}
                  className="relative group cursor-pointer rounded-sm overflow-hidden border border-gray-200 hover:border-[#C97D5A] transition-colors aspect-square"
                  onClick={() => { onSelect(img.url); onClose(); }}
                  onMouseEnter={() => setHoveredName(img.name)}
                  onMouseLeave={() => setHoveredName(null)}
                >
                  {/* Thumbnail */}
                  <div className="absolute inset-0 bg-gray-100">
                    <Image
                      src={img.url}
                      alt={img.name}
                      fill
                      className="object-cover"
                      sizes="150px"
                      unoptimized
                    />
                  </div>

                  {/* Hover overlay */}
                  <div className={`absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1 transition-opacity ${hoveredName === img.name ? "opacity-100" : "opacity-0"}`}>
                    <Check size={20} className="text-white" />
                    <span className="text-white text-[9px] tracking-wider text-center px-1 truncate max-w-full">
                      {img.name.length > 20 ? img.name.slice(0, 18) + "…" : img.name}
                    </span>
                  </div>

                  {/* Delete button */}
                  <button
                    className="absolute top-1 right-1 bg-white/90 hover:bg-red-50 text-gray-500 hover:text-red-500 rounded-sm p-1 transition-colors opacity-0 group-hover:opacity-100"
                    onClick={(e) => handleDelete(img.name, e)}
                    disabled={deletingName === img.name}
                  >
                    {deletingName === img.name
                      ? <Loader2 size={10} className="animate-spin" />
                      : <Trash2 size={10} />}
                  </button>

                  {/* Size label */}
                  <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[8px] px-1 py-0.5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    {formatBytes(img.size)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 shrink-0 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {images.length} image{images.length !== 1 ? "s" : ""} · max 10 MB each
          </span>
          <button onClick={onClose} className="text-xs tracking-widest uppercase text-gray-400 hover:text-gray-600 transition-colors px-3 py-1 border border-gray-200 hover:border-gray-400 rounded-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Public component ──────────────────────────────────────────────────────────
export default function ImagePicker({ value, onChange, label }: ImagePickerProps) {
  const [showLibrary, setShowLibrary] = useState(false);
  const [urlMode, setUrlMode] = useState(false);

  const hasImage = !!value;

  return (
    <div className="space-y-2">
      {label && (
        <span className="block text-[10px] tracking-widest uppercase text-gray-400">{label}</span>
      )}

      {/* Preview + controls */}
      <div className="border border-gray-200 rounded-sm overflow-hidden bg-gray-50">
        {hasImage ? (
          <div className="relative w-full h-32 bg-gray-100">
            <Image
              src={value}
              alt="Selected image"
              fill
              className="object-cover"
              unoptimized
            />
            <button
              onClick={() => onChange("")}
              className="absolute top-2 right-2 bg-white/90 hover:bg-red-50 text-gray-500 hover:text-red-500 p-1 rounded-sm transition-colors border border-gray-200"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center h-20 bg-gray-50 text-gray-300">
            <ImageIcon size={28} />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex border-t border-gray-200">
          <button
            onClick={() => { setShowLibrary(true); setUrlMode(false); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] tracking-wider uppercase text-gray-500 hover:text-[#C97D5A] hover:bg-[#C97D5A]/5 transition-colors border-r border-gray-200"
          >
            <ImageIcon size={11} />
            Library
          </button>
          <button
            onClick={() => setUrlMode((m) => !m)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] tracking-wider uppercase transition-colors ${urlMode ? "text-[#C97D5A] bg-[#C97D5A]/5" : "text-gray-500 hover:text-[#C97D5A] hover:bg-[#C97D5A]/5"}`}
          >
            <LinkIcon size={11} />
            URL
          </button>
        </div>
      </div>

      {/* Manual URL input (toggle) */}
      {urlMode && (
        <input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://... or /images/..."
          className="w-full bg-white border border-gray-200 text-gray-700 text-xs px-3 py-2 outline-none focus:border-[#C97D5A]/50 rounded-sm"
        />
      )}

      {/* Library modal */}
      {showLibrary && (
        <ImageLibraryModal
          onSelect={(url) => { onChange(url); setUrlMode(false); }}
          onClose={() => setShowLibrary(false)}
        />
      )}
    </div>
  );
}
