// ─── The Giving Tree — the look, in one place (12) ───────────────────────────
//
// Bare-bones on purpose. Every component styles itself through the variables
// and .gt-* classes below, so applying the final mood board is a change to
// this file (and the copy file), not to the components.

const CSS = `
.gt-root {
  /* Colors */
  --gt-bg: #0f1a14;
  --gt-sky: #0b1020;
  --gt-sky-2: #18213d;
  --gt-surface: #f7f3ea;
  --gt-surface-ink: #1d1d1b;
  --gt-ink: #f4efe4;
  --gt-ink-soft: rgba(244, 239, 228, 0.7);
  --gt-line: rgba(244, 239, 228, 0.2);
  --gt-accent: #c9a24a;
  --gt-accent-ink: #1d1d1b;
  --gt-tree: #24452f;
  --gt-tree-edge: #2f5a3d;
  --gt-trunk: #5a3d2b;
  --gt-zone-volunteer: #8fb3d9;
  --gt-zone-gift: #d98f8f;
  --gt-zone-cash: #d9c48f;
  --gt-star: #fff4c2;
  --gt-intro-bg: #133224;
  --gt-intro-ink: #f6eedd;
  --gt-stocking-volunteer: #3f6f9e;
  --gt-stocking-gift: #a3272b;
  --gt-stocking-cash: #2f6b45;
  --gt-stocking-cuff: #f7f3ea;
  --gt-garland: #6f8f5a;
  --gt-tabs-h: 60px;
  --gt-danger: #b3261e;
  --gt-banner: #fde68a;
  --gt-banner-ink: #3b2f05;
  /* Type */
  --gt-font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --gt-font-display: Georgia, "Times New Roman", serif;
  --gt-size-s: 13px;
  --gt-size-m: 15px;
  --gt-size-l: 19px;
  --gt-size-xl: 26px;
  /* Spacing and shape */
  --gt-space: 12px;
  --gt-radius: 10px;
  --gt-sheet-max: 560px;

  font-family: var(--gt-font);
  font-size: var(--gt-size-m);
  color: var(--gt-ink);
  background: var(--gt-bg);
}
.gt-root *:focus-visible { outline: 3px solid var(--gt-accent); outline-offset: 2px; }
.gt-display { font-family: var(--gt-font-display); }
.gt-noscroll { scrollbar-width: none; }
.gt-noscroll::-webkit-scrollbar { display: none; }
.gt-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  min-height: 44px; padding: 0 16px; border-radius: var(--gt-radius);
  border: 1px solid var(--gt-line); background: transparent; color: inherit;
  font: inherit; cursor: pointer; text-decoration: none;
}
.gt-btn[disabled] { opacity: 0.5; cursor: default; }
.gt-btn-primary { background: var(--gt-accent); color: var(--gt-accent-ink); border-color: var(--gt-accent); font-weight: 600; }
.gt-btn-small { min-height: 36px; padding: 0 12px; font-size: var(--gt-size-s); }
.gt-btn-icon { width: 36px; padding: 0; font-size: 18px; }
.gt-select {
  min-height: 36px; padding: 0 30px 0 12px; border-radius: var(--gt-radius); border: 1px solid var(--gt-line);
  background: transparent url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%23f4efe4' stroke-width='1.6'/%3E%3C/svg%3E") no-repeat right 11px center;
  color: inherit; font: inherit; font-size: var(--gt-size-s); appearance: none; -webkit-appearance: none; cursor: pointer;
}
.gt-select option { color: #1d1d1b; }
.gt-card { background: var(--gt-surface); color: var(--gt-surface-ink); border-radius: var(--gt-radius); }
.gt-card .gt-btn { border-color: rgba(0,0,0,0.2); }
.gt-card .gt-btn-primary { border-color: var(--gt-accent); }
.gt-muted { opacity: 0.72; }
.gt-small { font-size: var(--gt-size-s); }
.gt-label { display: block; font-size: var(--gt-size-s); font-weight: 600; margin-bottom: 4px; }
.gt-input {
  width: 100%; min-height: 44px; padding: 8px 10px; border-radius: 8px;
  border: 1px solid rgba(0,0,0,0.25); background: #fff; color: #111; font: inherit;
}
.gt-banner { background: var(--gt-banner); color: var(--gt-banner-ink); font-size: var(--gt-size-s); padding: 6px 12px; text-align: center; }
.gt-error { color: var(--gt-danger); font-size: var(--gt-size-s); }
.gt-sheet {
  position: absolute; z-index: 30; left: 0; right: 0; bottom: 0; max-height: 55%;
  display: flex; flex-direction: column;
  background: var(--gt-surface); color: var(--gt-surface-ink);
  border-radius: var(--gt-radius) var(--gt-radius) 0 0; box-shadow: 0 -6px 24px rgba(0,0,0,0.35);
}
@media (min-width: 900px) {
  .gt-sheet { left: auto; top: 0; width: 360px; max-height: none; border-radius: 0; }
}
.gt-overlay { position: absolute; inset: 0; z-index: 40; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; padding: 16px; }
.gt-dialog { width: 100%; max-width: 440px; max-height: 100%; overflow-y: auto; }

/* Ornaments */
.gt-ornament {
  position: absolute; transform: translate(-50%, -50%); border-radius: 50%;
  display: flex; align-items: center; justify-content: center; text-align: center;
  border: 2px solid rgba(0,0,0,0.25); color: #1d1d1b; cursor: pointer; padding: 0;
  box-shadow: 0 2px 6px rgba(0,0,0,0.4); line-height: 1.05; overflow: hidden;
}
.gt-ornament[data-zone="volunteer"] { background: var(--gt-zone-volunteer); }
.gt-ornament[data-zone="gift"] { background: var(--gt-zone-gift); }
.gt-ornament[data-zone="cash"] { background: var(--gt-zone-cash); }
.gt-ornament[data-dim="true"] { opacity: 0.18; pointer-events: none; }
.gt-ornament-title { font-weight: 600; padding: 0 6%; word-break: break-word; }
.gt-meter { height: 6px; border-radius: 3px; background: rgba(0,0,0,0.15); overflow: hidden; }
.gt-meter > span { display: block; height: 100%; background: var(--gt-accent); }
.gt-zone-label {
  position: absolute; transform: translate(-50%, -50%); padding: 4px 12px; border-radius: 999px;
  background: rgba(0,0,0,0.45); color: var(--gt-ink); border: 1px solid var(--gt-line);
  font-family: var(--gt-font-display); cursor: pointer; white-space: nowrap;
}

/* Stars */
.gt-star { position: absolute; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; background: none; border: 0; color: var(--gt-ink); cursor: pointer; padding: 2px; }
.gt-star-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--gt-star); box-shadow: 0 0 10px 3px rgba(255, 244, 194, 0.55); }
.gt-star[data-new="true"] .gt-star-dot { width: 16px; height: 16px; box-shadow: 0 0 18px 6px rgba(255, 244, 194, 0.9); }
.gt-star-label { margin-top: 3px; font-size: 11px; white-space: nowrap; max-width: 110px; overflow: hidden; text-overflow: ellipsis; opacity: 0.85; }
.gt-sky { background: radial-gradient(ellipse at 50% 30%, var(--gt-sky-2), var(--gt-sky)); }

/* Opening: script written onto dark green */
.gt-intro {
  position: absolute; inset: 0; z-index: 60; overflow: hidden; cursor: pointer;
  display: flex; align-items: center; justify-content: center; padding: 56px 24px 96px;
  background: var(--gt-intro-bg); color: var(--gt-intro-ink);
}
.gt-intro-panel { max-width: 34rem; width: 100%; }
.gt-written { font-size: clamp(25px, 6.6vw, 38px); line-height: 1.35; text-align: center; }
.gt-ink { display: inline-block; opacity: 0; animation: gt-ink 0.55s ease-out both; }
@keyframes gt-ink {
  from { opacity: 0; filter: blur(3px); transform: translateY(0.08em); }
  to { opacity: 1; filter: blur(0); transform: none; }
}
.gt-intro-skip { font-family: var(--gt-font); color: var(--gt-intro-ink); border-color: rgba(246,238,221,0.35); }
.gt-intro-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--gt-intro-ink); opacity: 0.3; transition: opacity 0.4s; }
.gt-intro-dot[data-on="true"] { opacity: 0.9; }
.gt-intro-hint { font-family: var(--gt-font); font-size: var(--gt-size-s); transition: opacity 0.6s; }

/* Home: a background image or logo, and two ways in */
.gt-home {
  height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 28px; padding: 24px; text-align: center;
  background: var(--gt-intro-bg) var(--gt-home-image, none) center / cover no-repeat; color: var(--gt-intro-ink);
}
.gt-home-actions { width: 100%; max-width: 340px; display: flex; flex-direction: column; gap: 12px; }
.gt-home .gt-btn { min-height: 56px; font-size: var(--gt-size-l); }

/* Tabs along the bottom */
.gt-tabs {
  display: grid; grid-auto-columns: 1fr; grid-auto-flow: column; height: var(--gt-tabs-h);
  border-top: 1px solid var(--gt-line); background: var(--gt-bg); padding-bottom: env(safe-area-inset-bottom);
}
.gt-tab { display: flex; align-items: center; justify-content: center; background: none; border: 0; color: var(--gt-ink-soft); font: inherit; cursor: pointer; border-top: 3px solid transparent; }
.gt-tab[aria-current="page"] { color: var(--gt-ink); font-weight: 600; border-top-color: var(--gt-accent); }

/* What we've given: stockings on a line */
.gt-given { background: var(--gt-bg); }
.gt-given-empty { padding: 48px 12px; text-align: center; font-size: var(--gt-size-l); font-family: var(--gt-font-display); opacity: 0.85; line-height: 1.4; }
.gt-stockings { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); row-gap: 18px; }
@media (min-width: 520px) { .gt-stockings { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.gt-stocking-slot { position: relative; padding: 10px 4px 0; }
.gt-stocking-slot::before { content: ""; position: absolute; left: 0; right: 0; top: 4px; height: 3px; background: var(--gt-garland); }
.gt-stocking { position: relative; display: flex; flex-direction: column; align-items: center; width: 100%; background: none; border: 0; color: inherit; cursor: pointer; padding: 0; text-align: center; }
.gt-stocking-shape { position: relative; display: block; width: 86%; max-width: 110px; }
.gt-stocking-shape svg { display: block; width: 100%; height: auto; overflow: visible; }
.gt-stocking-body { fill: var(--gt-stocking-gift); stroke: rgba(0,0,0,0.25); stroke-width: 1.5; }
.gt-stocking-shape[data-zone="volunteer"] .gt-stocking-body { fill: var(--gt-stocking-volunteer); }
.gt-stocking-shape[data-zone="cash"] .gt-stocking-body { fill: var(--gt-stocking-cash); }
.gt-stocking-cuff { fill: var(--gt-stocking-cuff); stroke: rgba(0,0,0,0.2); stroke-width: 1.5; }
.gt-stocking-loop { fill: none; stroke: var(--gt-stocking-cuff); stroke-width: 2.5; }
.gt-stocking-name {
  position: absolute; left: 8%; width: 66%; top: 7.7%; height: 20%;
  display: flex; align-items: center; justify-content: center; padding: 0 3px;
  color: #1d1d1b; font-weight: 600; font-size: 11px; line-height: 1.05; overflow: hidden; overflow-wrap: anywhere;
}
.gt-stocking-name[data-long="true"] { font-size: 9px; letter-spacing: -0.01em; }
.gt-stocking-gave, .gt-stocking-note {
  margin-top: 4px; font-size: 11px; line-height: 1.25; opacity: 0.85;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.gt-stocking-note { font-style: italic; margin-top: 2px; }
.gt-stocking-slot[data-new="true"] .gt-stocking-shape svg { filter: drop-shadow(0 0 10px rgba(255, 244, 194, 0.75)); }

/* Counters */
.gt-counters { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; text-align: center; }
.gt-counter-n { font-family: var(--gt-font-display); font-size: var(--gt-size-l); }
.gt-counter-l { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.75; }
`;

export function GivingTreeStyles() {
  // Set as raw HTML so the server and browser render byte-identical text.
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}
