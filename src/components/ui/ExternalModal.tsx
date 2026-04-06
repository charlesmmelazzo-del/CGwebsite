"use client";

import { X, ExternalLink } from "lucide-react";
import { useEffect, useRef } from "react";

interface Props {
  url: string;
  onClose: () => void;
}

export default function ExternalModal({ url, onClose }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="iframe-modal-overlay" onClick={onClose}>
      <div
        className="relative w-full max-w-4xl mx-4 h-[85vh] bg-white rounded-sm overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between bg-[#1A1F17] px-4 py-2.5">
          <p className="text-[#5a6a4a] text-xs truncate max-w-xs">{url}</p>
          <div className="flex items-center gap-3">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#8A9A78] hover:text-[#C97D5A] transition-colors"
              title="Open in new tab"
            >
              <ExternalLink size={16} />
            </a>
            <button
              onClick={onClose}
              className="text-[#8A9A78] hover:text-[#C97D5A] transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* iframe — falls back gracefully if blocked */}
        <iframe
          ref={iframeRef}
          src={url}
          className="w-full h-[calc(100%-44px)] border-0"
          title="External content"
          onError={() => {
            // If iframe is blocked, show a link instead
            if (iframeRef.current) {
              iframeRef.current.style.display = "none";
            }
          }}
        />
      </div>
    </div>
  );
}
