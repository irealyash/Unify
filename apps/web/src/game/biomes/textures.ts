import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import type { Rng } from "./random";

const WINDOW_COLORS = ["#ffd89a", "#ffe9c4", "#9ad7ff", "#c9b8ff", "#ffb3d9"];

/**
 * A tileable grid of building windows, some lit. Used as an emissive map so lit windows
 * glow at night while the walls stay dark.
 */
export function createWindowTexture(rng: Rng) {
  const cols = 4;
  const rows = 8;
  const cell = 32;
  const canvas = document.createElement("canvas");
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = rng.next() < 0.42;
      ctx.fillStyle = lit ? rng.pick(WINDOW_COLORS) : "#0b0d1c";
      ctx.globalAlpha = lit ? rng.range(0.55, 1) : 1;
      ctx.fillRect(c * cell + 6, r * cell + 7, cell - 12, cell - 13);
    }
  }
  ctx.globalAlpha = 1;

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

/** Glowing sign text on a transparent background. */
export function createNeonTextTexture(text: string, color: string, vertical = false) {
  const font = '700 96px "Sora", system-ui, sans-serif';
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;

  const letters = vertical ? [...text] : [text];
  const lineHeight = 104;
  const textWidth = Math.max(...letters.map((l) => ctx.measureText(l).width));
  canvas.width = Math.ceil(textWidth + 80);
  canvas.height = Math.ceil(letters.length * lineHeight + 60);

  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = color;
  letters.forEach((letter, i) => {
    const y = 30 + lineHeight * (i + 0.5);
    // Several passes: wide soft halo, then a bright core.
    for (const [blur, fill] of [
      [28, color],
      [12, color],
      [0, "#ffffff"],
    ] as const) {
      ctx.shadowBlur = blur;
      ctx.fillStyle = fill;
      ctx.globalAlpha = fill === "#ffffff" ? 0.85 : 1;
      ctx.fillText(letter, canvas.width / 2, y);
    }
  });

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, aspect: canvas.width / canvas.height };
}
