// ─── The Giving Tree — the look, in one place (12) ───────────────────────────
//
// Bare-bones on purpose. Every component styles itself through the variables
// and .gt-* classes below, so applying the final mood board is a change to
// this file (and the copy file), not to the components.

export function GivingTreeStyles() {
  return (
    <style>{`
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
.gt-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  min-height: 44px; padding: 0 16px; border-radius: var(--gt-radius);
  border: 1px solid var(--gt-line); background: transparent; color: inherit;
  font: inherit; cursor: pointer; text-decoration: none;
}
.gt-btn[disabled] { opacity: 0.5; cursor: default; }
.gt-btn-primary { background: var(--gt-accent); color: var(--gt-accent-ink); border-color: var(--gt-accent); font-weight: 600; }
.gt-btn-small { min-height: 36px; padding: 0 12px; font-size: var(--gt-size-s); }
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

/* Counters */
.gt-counters { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; text-align: center; }
.gt-counter-n { font-family: var(--gt-font-display); font-size: var(--gt-size-l); }
.gt-counter-l { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.75; }
`}</style>
  );
}
