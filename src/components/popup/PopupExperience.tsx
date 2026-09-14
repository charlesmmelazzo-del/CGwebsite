"use client";

import { useCallback } from "react";
import { getTemplate } from "./templates/registry";
import type { PopupCocktail, PopupMenu, PopupViewer } from "@/lib/popup/types";

/**
 * The shell every pop-up runs inside.
 *
 * It owns the network calls shared by every template, then hands a template
 * the finished props described by PopupTemplateProps. Templates stay purely
 * about presentation and their own interactive gimmick — which is what makes
 * adding a trivia or video-game pop-up a single new component.
 */
export default function PopupExperience({
  menu,
  cocktails,
  viewer,
  isLive,
  isSandbox = false,
}: {
  menu: PopupMenu;
  cocktails: PopupCocktail[];
  viewer: PopupViewer | null;
  isLive: boolean;
  isSandbox?: boolean;
}) {
  const recordInteraction = useCallback(
    async (kind: string, payload: unknown, cocktailId?: string) => {
      try {
        await fetch("/api/popup/interactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ menuId: menu.id, kind, payload, cocktailId, sandbox: isSandbox }),
        });
      } catch {
        // An interactive flourish failing to log must never break the pop-up.
      }
    },
    [menu.id, isSandbox]
  );

  const Template = getTemplate(menu.templateKey).component;

  return (
    <Template
      menu={menu}
      cocktails={cocktails}
      viewer={viewer}
      isLive={isLive}
      recordInteraction={recordInteraction}
      isSandbox={isSandbox}
    />
  );
}
