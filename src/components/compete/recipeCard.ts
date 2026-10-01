// Draws an at-home recipe as a tall image card and hands it to the phone.
//
// On iPhone and Android the share sheet opens with the image attached, and
// "Save Image" puts it straight into the photo library — that's the whole
// point of the button. Desktop browsers without file sharing get a download.

import type { Recipe } from "@/lib/compete/types";

const W = 1080;
const PAD = 96;
const BG = "#12110e";
const TEXT = "#f2ede3";
const MUTED = "#a8a196";
const LINE = "rgba(242,237,227,0.16)";

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function cssFont(varName: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line);
        line = w;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, align: "center" | "left") {
  const chars = text.split("");
  const width = chars.reduce((a, c) => a + ctx.measureText(c).width + spacing, -spacing);
  let cx = align === "center" ? x - width / 2 : x;
  ctx.textAlign = "left";
  for (const c of chars) {
    ctx.fillText(c, cx, y);
    cx += ctx.measureText(c).width + spacing;
  }
}

export async function saveRecipeCard(opts: {
  recipe: Recipe;
  spirit: string;
  eventName: string;
  cgLogo: string;
  brandLogo?: string;
  accent: string;
}): Promise<"shared" | "downloaded"> {
  const { recipe, spirit, cgLogo, brandLogo, accent } = opts;
  const display = cssFont("--font-display", "Georgia, serif");
  const body = cssFont("--font-body", "system-ui, sans-serif");
  await Promise.all([
    document.fonts?.load(`64px ${display}`).catch(() => null),
    document.fonts?.load(`28px ${body}`).catch(() => null),
  ]);
  const [cg, brand, photo] = await Promise.all([
    loadImage(cgLogo),
    loadImage(brandLogo ?? ""),
    loadImage(recipe.photoUrl ?? ""),
  ]);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  // Two passes: measure, then size the canvas and draw for real.
  const draw = (paint: boolean): number => {
    let y = PAD;
    const inner = W - PAD * 2;
    if (paint) {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, canvas.height);
    }

    // Logos
    const logoH = 84;
    const logos = [cg, brand].filter(Boolean) as HTMLImageElement[];
    const widths = logos.map((l) => (l.naturalWidth / l.naturalHeight) * logoH);
    const gap = 70;
    const total = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, logos.length - 1);
    if (paint) {
      let x = (W - total) / 2;
      logos.forEach((l, i) => {
        ctx.drawImage(l, x, y, widths[i], logoH);
        x += widths[i];
        if (i < logos.length - 1) {
          ctx.fillStyle = MUTED;
          ctx.font = `300 34px ${body}`;
          ctx.textAlign = "center";
          ctx.fillText("×", x + gap / 2, y + logoH / 2 + 12);
          x += gap;
        }
      });
    }
    y += logos.length ? logoH + 90 : 0;

    // Eyebrow
    ctx.font = `500 24px ${body}`;
    if (paint) {
      ctx.fillStyle = accent;
      spaced(ctx, `AT HOME WITH ${spirit.toUpperCase()}`, W / 2, y, 6, "center");
    }
    y += 70;

    // Title
    ctx.font = `400 92px ${display}`;
    for (const l of wrap(ctx, recipe.name, inner)) {
      if (paint) {
        ctx.fillStyle = TEXT;
        ctx.textAlign = "center";
        ctx.fillText(l, W / 2, y + 70);
      }
      y += 100;
    }

    if (recipe.description) {
      y += 10;
      ctx.font = `italic 300 32px ${body}`;
      for (const l of wrap(ctx, recipe.description, inner - 60)) {
        if (paint) {
          ctx.fillStyle = MUTED;
          ctx.textAlign = "center";
          ctx.fillText(l, W / 2, y + 30);
        }
        y += 46;
      }
    }
    y += 50;

    if (photo) {
      const h = Math.round(inner * 0.62);
      if (paint) {
        const r = Math.max(inner / photo.naturalWidth, h / photo.naturalHeight);
        const sw = inner / r;
        const sh = h / r;
        ctx.drawImage(photo, (photo.naturalWidth - sw) / 2, (photo.naturalHeight - sh) / 2, sw, sh, PAD, y, inner, h);
      }
      y += h + 60;
    }

    // Ingredients
    ctx.font = `500 22px ${body}`;
    if (paint) {
      ctx.fillStyle = accent;
      spaced(ctx, "INGREDIENTS", PAD, y, 6, "left");
    }
    y += 30;
    ctx.font = `400 34px ${body}`;
    const items = recipe.ingredients.split("\n").map((s) => s.trim()).filter(Boolean);
    for (const item of items) {
      if (paint) {
        ctx.fillStyle = LINE;
        ctx.fillRect(PAD, y, inner, 2);
      }
      y += 2;
      for (const l of wrap(ctx, item, inner)) {
        if (paint) {
          ctx.fillStyle = TEXT;
          ctx.textAlign = "left";
          ctx.fillText(l, PAD, y + 50);
        }
        y += 50;
      }
      y += 22;
    }
    if (paint) {
      ctx.fillStyle = LINE;
      ctx.fillRect(PAD, y, inner, 2);
    }
    y += 70;

    // Method
    ctx.font = `500 22px ${body}`;
    if (paint) {
      ctx.fillStyle = accent;
      spaced(ctx, "METHOD", PAD, y, 6, "left");
    }
    y += 24;
    ctx.font = `300 32px ${body}`;
    for (const l of wrap(ctx, recipe.method, inner)) {
      if (paint) {
        ctx.fillStyle = MUTED;
        ctx.textAlign = "left";
        ctx.fillText(l, PAD, y + 46);
      }
      y += 48;
    }
    y += 100;

    // Footer
    if (paint) {
      ctx.fillStyle = LINE;
      ctx.fillRect(W / 2 - 60, y, 120, 2);
      ctx.font = `400 22px ${body}`;
      ctx.fillStyle = MUTED;
      spaced(ctx, "COMMON GOOD COCKTAIL HOUSE · GLEN ELLYN, IL", W / 2, y + 60, 4, "center");
    }
    y += 60 + PAD;
    return Math.max(y, 1350);
  };

  canvas.width = W;
  canvas.height = 4000;
  const height = draw(false);
  canvas.height = height;
  draw(true);

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png")
  );
  const filename = `${recipe.name.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "recipe"}.png`;
  const file = new File([blob], filename, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: recipe.name });
    } catch (e) {
      // Closing the share sheet isn't an error worth showing.
      if ((e as Error)?.name !== "AbortError") throw e;
    }
    return "shared";
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}
