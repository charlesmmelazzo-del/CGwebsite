"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Upload, Trash2, Copy, Check, Loader2, Image as ImageIcon, Search, X } from "lucide-react";
import Image from "next/image";

interface StorageImage {
  name: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function AdminImagesPage() {
  const [images, setImages] = useState<StorageImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const loadImages = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/images")
      .then((r) => r.json())
      .then((d) => setImages(d.files ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadImages(); }, [loadImages]);

  async function uploadFiles(files: FileList | File[]) {
    const fileArr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (fileArr.length === 0) return;
    setUploading(true);
    setUploadError("");
    try {
      for (const file of fileArr) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/admin/images/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error ?? "Upload failed");
        setImages((prev) => [
          { name: data.name, url: data.url, size: data.size, mimeType: data.mimeType },
          ...prev,
        ]);
      }
    } catch (e) {
      setUploadError(String(e));
    } finally {
      setUploading(false);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) uploadFiles(e.target.files);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files);
  }

  async function deleteImage(name: string) {
    if (!confirm(`Permanently delete "${name}"?\n\nThis will break any page sections still using this image.`)) return;
    setDeletingName(name);
    try {
      const res = await fetch("/api/admin/images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: name }),
      });
      if (!res.ok) throw new Error("Delete failed");
      setImages((prev) => prev.filter((img) => img.name !== name));
      if (selected === name) setSelected(null);
    } catch {
      alert("Failed to delete image.");
    } finally {
      setDeletingName(null);
    }
  }

  async function copyUrl(url: string, name: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedName(name);
      setTimeout(() => setCopiedName(null), 2000);
    } catch {
      // fallback: select the text
    }
  }

  const filtered = images.filter((img) =>
    img.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedImage = selected ? images.find((i) => i.name === selected) : null;

  return (
    <div className="flex h-full">
      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 shrink-0">
          <div>
            <h1 className="text-2xl text-gray-800" style={{ fontFamily: "var(--font-display)" }}>
              Images
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              {images.length} image{images.length !== 1 ? "s" : ""} stored · max 10 MB per file
            </p>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-[#C97D5A] text-white text-xs tracking-widest uppercase hover:bg-[#b86d4a] transition-colors disabled:opacity-60"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? "Uploading..." : "Upload"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileInput} />
        </div>

        {uploadError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-sm flex items-center justify-between">
            <span>{uploadError}</span>
            <button onClick={() => setUploadError("")}><X size={12} /></button>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4 shrink-0">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search images..."
            className="w-full bg-white border border-gray-200 text-gray-700 text-sm pl-8 pr-3 py-2 outline-none focus:border-[#C97D5A]/50 rounded-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Drop zone + grid */}
        <div
          ref={dropRef}
          className={`flex-1 overflow-y-auto rounded-sm transition-colors ${dragging ? "bg-[#C97D5A]/5 border-2 border-dashed border-[#C97D5A]" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={(e) => { if (!dropRef.current?.contains(e.relatedTarget as Node)) setDragging(false); }}
          onDrop={handleDrop}
        >
          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-400 gap-2">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading images...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-300 gap-3">
              <ImageIcon size={40} />
              <p className="text-sm">
                {search ? `No images matching "${search}"` : "No images yet — upload one above or drop a file here"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filtered.map((img) => (
                <div
                  key={img.name}
                  onClick={() => setSelected(img.name === selected ? null : img.name)}
                  className={`group relative cursor-pointer rounded-sm overflow-hidden border transition-colors aspect-square ${
                    selected === img.name
                      ? "border-[#C97D5A] ring-2 ring-[#C97D5A]/30"
                      : "border-gray-200 hover:border-[#C97D5A]/50"
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="absolute inset-0 bg-gray-100">
                    <Image
                      src={img.url}
                      alt={img.name}
                      fill
                      className="object-cover"
                      sizes="200px"
                      unoptimized
                    />
                  </div>

                  {/* Selected check */}
                  {selected === img.name && (
                    <div className="absolute top-2 left-2 bg-[#C97D5A] rounded-full p-0.5">
                      <Check size={10} className="text-white" />
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />

                  {/* Quick actions */}
                  <div className="absolute bottom-0 left-0 right-0 flex gap-1 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); copyUrl(img.url, img.name); }}
                      className="flex-1 flex items-center justify-center gap-1 bg-white/90 hover:bg-white text-gray-700 text-[9px] py-1 rounded-sm transition-colors"
                    >
                      {copiedName === img.name ? <Check size={9} className="text-green-600" /> : <Copy size={9} />}
                      {copiedName === img.name ? "Copied" : "Copy URL"}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteImage(img.name); }}
                      disabled={deletingName === img.name}
                      className="flex items-center justify-center bg-white/90 hover:bg-red-50 text-gray-500 hover:text-red-500 px-2 py-1 rounded-sm transition-colors"
                    >
                      {deletingName === img.name ? <Loader2 size={9} className="animate-spin" /> : <Trash2 size={9} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-3 shrink-0">
          Tip: Drop images anywhere on this page to upload. Click an image to select it and see details.
        </p>
      </div>

      {/* ── Detail panel ── */}
      <div className={`w-64 shrink-0 border-l border-gray-200 bg-white flex flex-col transition-all ${selectedImage ? "" : "opacity-0 pointer-events-none"}`}>
        {selectedImage && (
          <>
            {/* Image preview */}
            <div className="relative w-full aspect-square bg-gray-100 border-b border-gray-200">
              <Image
                src={selectedImage.url}
                alt={selectedImage.name}
                fill
                className="object-contain p-2"
                unoptimized
              />
            </div>

            {/* Details */}
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              <div>
                <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">Filename</p>
                <p className="text-xs text-gray-700 break-all">{selectedImage.name}</p>
              </div>
              <div>
                <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">File Size</p>
                <p className="text-xs text-gray-700">{formatBytes(selectedImage.size)}</p>
              </div>
              <div>
                <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">Type</p>
                <p className="text-xs text-gray-700">{selectedImage.mimeType}</p>
              </div>
              <div>
                <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">URL</p>
                <p className="text-[10px] text-gray-500 break-all leading-relaxed">{selectedImage.url}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-200 space-y-2">
              <button
                onClick={() => copyUrl(selectedImage.url, selectedImage.name)}
                className="w-full flex items-center justify-center gap-2 py-2 bg-[#C97D5A] text-white text-xs tracking-widest uppercase hover:bg-[#b86d4a] transition-colors"
              >
                {copiedName === selectedImage.name ? <Check size={13} /> : <Copy size={13} />}
                {copiedName === selectedImage.name ? "Copied!" : "Copy URL"}
              </button>
              <button
                onClick={() => deleteImage(selectedImage.name)}
                disabled={deletingName === selectedImage.name}
                className="w-full flex items-center justify-center gap-2 py-2 border border-red-200 text-red-500 text-xs tracking-widest uppercase hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {deletingName === selectedImage.name ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Delete
              </button>
            </div>
          </>
        )}

        {!selectedImage && (
          <div className="flex-1 flex items-center justify-center text-gray-300 p-6 text-center">
            <div>
              <ImageIcon size={28} className="mx-auto mb-2" />
              <p className="text-xs">Click an image to see details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
