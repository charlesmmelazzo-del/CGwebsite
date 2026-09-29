"use client";

import type { MenuPdfPage } from "@/types";

// Turns an uploaded PDF menu into page images, in the admin's browser.
//
// Guests then see plain images: they load fast, look identical on every phone
// (iOS Safari only shows page one of an embedded PDF, Android shows nothing),
// and can be styled like printed cards. The original PDF is still uploaded so
// guests can download it.

// 4.25in wide at ~300dpi — sharp on retina screens and when zoomed in.
const TARGET_WIDTH_PX = 1300;
const WEBP_QUALITY = 0.9;

export interface PdfUploadResult {
  pdfUrl?: string;
  pages: MenuPdfPage[];
}

export async function uploadMenuPdf(
  file: File,
  onProgress: (message: string) => void
): Promise<PdfUploadResult> {
  onProgress("Reading PDF…");
  // Loaded on demand so pdf.js only ever ships to the admin, and only when used.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Copied into public/ by scripts/copy-pdf-worker.mjs before dev and build.
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const baseName = file.name.replace(/\.pdf$/i, "");
  const pages: MenuPdfPage[] = [];

  try {
    for (let n = 1; n <= doc.numPages; n++) {
      onProgress(`Rendering page ${n} of ${doc.numPages}…`);
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: TARGET_WIDTH_PX / base.width });

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d")!;
      // PDFs are transparent where nothing is drawn — give pages real paper.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // "print" renders in one pass instead of pacing itself on animation
      // frames, which stall completely if the admin switches browser tabs.
      await page.render({ canvasContext: ctx, viewport, intent: "print" }).promise;

      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Could not encode page image"))),
          "image/webp",
          WEBP_QUALITY
        )
      );
      // Safari without WebP encoding silently hands back PNG — keep its real type.
      const ext = blob.type === "image/webp" ? "webp" : "png";

      onProgress(`Uploading page ${n} of ${doc.numPages}…`);
      const url = await postFile(
        "/api/admin/menu/pdf-page",
        new File([blob], `${baseName}-p${n}.${ext}`, { type: blob.type })
      );
      pages.push({ url, width: canvas.width, height: canvas.height });
    }
  } finally {
    doc.destroy();
  }

  onProgress("Uploading original PDF…");
  // Only powers the guests' download button, so a PDF too big for the host's
  // request limit (~4.5MB on Vercel) shouldn't sink the pages already uploaded.
  let pdfUrl: string | undefined;
  try {
    pdfUrl = await postFile("/api/admin/pdfs/upload", file);
  } catch (e) {
    console.warn("Original PDF upload failed; publishing pages without a download link", e);
  }
  return { pdfUrl, pages };
}

async function postFile(endpoint: string, file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(endpoint, { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error ?? `Upload failed (${res.status})`);
  return data.url;
}
