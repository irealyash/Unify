import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import type { Rng } from "./random";

function canvas2d(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext("2d")! };
}

function toTexture(canvas: HTMLCanvasElement, repeat = false) {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  if (repeat) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
  }
  return texture;
}

/** Window grid size of the facade texture, and the world size of one tile. */
export const FACADE_GRID = { cols: 4, rows: 6, tileW: 4.4, tileH: 7.2 };

/**
 * Chunky stylised windows (pink, cyan, warm) on black, used as an emissive map so lit
 * windows glow while the wall color shows everywhere else.
 */
export function createFacadeTexture(rng: Rng, palette: string[]) {
  const { cols, rows } = FACADE_GRID;
  const cell = 32;
  const { canvas, ctx } = canvas2d(cols * cell, rows * cell);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = rng.next() < 0.5;
      ctx.fillStyle = lit ? rng.pick(palette) : "#120a26";
      ctx.globalAlpha = lit ? rng.range(0.65, 1) : 1;
      ctx.fillRect(c * cell + 7, r * cell + 8, cell - 14, cell - 14);
    }
  }
  ctx.globalAlpha = 1;
  return toTexture(canvas, true);
}

/** Glowing shop windows and doors for low buildings. */
export function createShopfrontTexture(rng: Rng) {
  const { canvas, ctx } = canvas2d(256, 64);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 256, 64);
  for (let x = 8; x < 248; ) {
    const w = rng.range(36, 64);
    const grad = ctx.createLinearGradient(0, 14, 0, 60);
    const color = rng.pick(["#ff6fe0", "#ff9ad8", "#7fe8ff", "#ffb36b"]);
    grad.addColorStop(0, color);
    grad.addColorStop(1, "#5a1d6e");
    ctx.fillStyle = grad;
    ctx.fillRect(x, 14, Math.min(w, 248 - x), 46);
    x += w + rng.range(8, 14);
  }
  return toTexture(canvas, true);
}

/** Lit windows for the distant skyline (small, dense, warm-white). */
export function createSkylineTexture(rng: Rng) {
  const { canvas, ctx } = canvas2d(64, 128);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 124; y += 8) {
    for (let x = 4; x < 60; x += 8) {
      if (rng.next() < 0.55) {
        ctx.fillStyle = rng.pick(["#fff2d8", "#ffe1f6", "#d6f6ff"]);
        ctx.fillRect(x, y, 4, 4);
      }
    }
  }
  return toTexture(canvas, true);
}

/** Orange/white diagonal stripes for road barricades. */
export function createStripeTexture() {
  const { canvas, ctx } = canvas2d(128, 32);
  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(0, 0, 128, 32);
  ctx.fillStyle = "#ff6a00";
  for (let x = -32; x < 160; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 32);
    ctx.lineTo(x + 16, 32);
    ctx.lineTo(x + 32, 0);
    ctx.lineTo(x + 16, 0);
    ctx.closePath();
    ctx.fill();
  }
  return toTexture(canvas, true);
}

/** Purple paving tiles for the plaza and sidewalks. */
export function createPavingTexture() {
  const { canvas, ctx } = canvas2d(64, 64);
  ctx.fillStyle = "#4a3f86";
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = "#544893";
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillRect(32, 32, 32, 32);
  ctx.strokeStyle = "#3a3170";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 62, 62);
  return toTexture(canvas, true);
}

/** Glowing sign text on a transparent background. */
export function createNeonTextTexture(text: string, color: string) {
  const font = '700 96px "Sora", system-ui, sans-serif';
  const probe = canvas2d(1, 1).ctx;
  probe.font = font;
  const { canvas, ctx } = canvas2d(Math.ceil(probe.measureText(text).width + 80), 160);
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = color;
  for (const [blur, fill] of [
    [28, color],
    [12, color],
    [0, "#ffffff"],
  ] as const) {
    ctx.shadowBlur = blur;
    ctx.fillStyle = fill;
    ctx.globalAlpha = fill === "#ffffff" ? 0.85 : 1;
    ctx.fillText(text, canvas.width / 2, 82);
  }
  return { texture: toTexture(canvas), aspect: canvas.width / canvas.height };
}
