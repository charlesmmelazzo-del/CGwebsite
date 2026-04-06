"use client";

import Image from "next/image";
import type { ContentSection } from "@/types";
import ExternalModal from "./ExternalModal";
import { useState } from "react";

interface Props {
  section: ContentSection;
  textColor: string;
  mutedColor: string;
}

export default function ContentSectionBlock({ section, textColor, mutedColor }: Props) {
  const [modalUrl, setModalUrl] = useState<string | null>(null);

  function handleButton() {
    if (!section.buttonUrl) return;
    if (section.buttonNewTab) {
      // Try iframe first; if blocked, open tab
      setModalUrl(section.buttonUrl);
    } else {
      setModalUrl(section.buttonUrl);
    }
  }

  return (
    <>
      <div className="py-12 px-6 md:px-12 max-w-4xl mx-auto animate-slide-up">
        {section.imageUrl && (
          <div className="mb-6 flex justify-center">
            <div className="relative w-full max-w-xl h-64 md:h-80">
              <Image
                src={section.imageUrl}
                alt={section.imageAlt ?? section.title ?? ""}
                fill
                className="object-cover rounded-sm"
              />
            </div>
          </div>
        )}

        {section.title && (
          <h2
            className="text-3xl md:text-5xl mb-4 tracking-wider text-center"
            style={{ fontFamily: "var(--font-display)", color: textColor }}
          >
            {section.title}
          </h2>
        )}

        {section.body && (
          <div
            className="text-center leading-relaxed text-sm md:text-base max-w-2xl mx-auto whitespace-pre-wrap"
            style={{ color: mutedColor }}
            dangerouslySetInnerHTML={{ __html: section.body }}
          />
        )}

        {section.buttonLabel && section.buttonUrl && (
          <div className="flex justify-center mt-8">
            <button
              onClick={handleButton}
              className="px-8 py-3 bg-[#C97D5A] text-white text-sm tracking-widest uppercase hover:bg-[#b86d4a] transition-colors"
            >
              {section.buttonLabel}
            </button>
          </div>
        )}
      </div>

      {modalUrl && (
        <ExternalModal url={modalUrl} onClose={() => setModalUrl(null)} />
      )}
    </>
  );
}
