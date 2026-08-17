"use client";

import { useEffect, useRef } from "react";

/**
 * On-screen controls.
 *
 * Most guests will play this on a phone standing at the bar, so the buttons are
 * real DOM elements below the canvas rather than hit-tested regions inside it:
 * they get proper touch targets, they can't be missed because of canvas scaling
 * maths, and the browser handles multi-touch for free (which the climber needs
 * — holding left while tapping jump).
 */
export function ArcadeButton({
  label,
  sublabel,
  onPress,
  onRelease,
  color = "#FFD500",
  disabled,
  className = "",
  ariaLabel,
}: {
  label: React.ReactNode;
  sublabel?: string;
  onPress: () => void;
  onRelease?: () => void;
  color?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const held = useRef(false);

  // pointerdown rather than click: a rhythm game judged on click latency would
  // feel dead, and a held direction needs the down/up pair anyway.
  function down(e: React.PointerEvent) {
    if (disabled) return;
    e.preventDefault();
    if (held.current) return;
    held.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    onPress();
  }

  function up(e: React.PointerEvent) {
    if (!held.current) return;
    held.current = false;
    e.preventDefault();
    onRelease?.();
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
      disabled={disabled}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        borderColor: color,
        color,
        touchAction: "none",
        WebkitTapHighlightColor: "transparent",
        userSelect: "none",
      }}
      className={`select-none border-2 bg-black/60 active:bg-white/20 disabled:opacity-30 flex flex-col items-center justify-center leading-none transition-colors ${className}`}
    >
      <span className="text-[13px] sm:text-sm font-bold tracking-wider">{label}</span>
      {sublabel && (
        <span className="mt-0.5 text-[7px] tracking-[0.15em] uppercase opacity-70">{sublabel}</span>
      )}
    </button>
  );
}

/**
 * Keyboard bindings for desktop play.
 *
 * Arrow keys and space are captured while a game is running so the page doesn't
 * scroll out from under the player mid-jump.
 */
export function useArcadeKeys(
  active: boolean,
  onDown: (key: string) => void,
  onUp: (key: string) => void
) {
  const downRef = useRef(onDown);
  const upRef = useRef(onUp);
  downRef.current = onDown;
  upRef.current = onUp;

  useEffect(() => {
    if (!active) return;

    const swallow = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Spacebar"]);

    const keyDown = (e: KeyboardEvent) => {
      if (swallow.has(e.key)) e.preventDefault();
      if (e.repeat) return;
      downRef.current(e.key);
    };
    const keyUp = (e: KeyboardEvent) => {
      if (swallow.has(e.key)) e.preventDefault();
      upRef.current(e.key);
    };

    window.addEventListener("keydown", keyDown, { passive: false });
    window.addEventListener("keyup", keyUp, { passive: false });
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, [active]);
}
