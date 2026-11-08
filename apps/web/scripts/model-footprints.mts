/**
 * Builds collision footprints and per-building labels for a city .glb, viewed from above.
 *
 *   npx tsx scripts/model-footprints.mts <model.glb> <out.json> [debug.png] [--threshold=1.5] [--head=6.5]
 *
 * It rasterizes every triangle onto a top-down grid and records, per cell:
 *   - the highest point (cells taller than the threshold, grouped by touch, are "buildings";
 *     the game uses these labels to split the mesh so each building can fade on its own)
 *   - whether anything sits between the threshold and head height (what actually blocks you)
 * Solid buildings block their whole footprint; open structures (like a tower you can walk
 * under) only block where they really touch the ground. Blocked cells are merged into a few
 * rectangles for collision. Everything is in the model's own units; the game scales it.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => a.slice(2).split("=") as [string, string]),
);
const [glbPath, outPath, debugPath] = args;
if (!glbPath || !outPath) {
  console.error("usage: tsx scripts/model-footprints.mts <model.glb> <out.json> [debug.png] [--threshold=1.5]");
  process.exit(1);
}
const CELL = Number(flags.cell ?? 0.5);
const THRESHOLD = Number(flags.threshold ?? 1.5);
/** Model units at about head height once scaled (anything above this you can walk under). */
const HEAD = Number(flags.head ?? 6.5);

// ── Minimal GLB reader (positions + indices of every primitive) ──────────────
const data = readFileSync(glbPath);
const jsonLength = data.readUInt32LE(12);
const gltf = JSON.parse(data.subarray(20, 20 + jsonLength).toString("utf8"));
const binStart = 20 + jsonLength + 8;
const bin = data.subarray(binStart, binStart + data.readUInt32LE(20 + jsonLength));

type Accessor = { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string };
function readAccessor(index: number): number[] {
  const a: Accessor = gltf.accessors[index];
  const view = gltf.bufferViews[a.bufferView];
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type]!;
  const size = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[a.componentType]!;
  const stride = view.byteStride ?? comps * size;
  const base = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out: number[] = [];
  for (let i = 0; i < a.count; i++) {
    for (let c = 0; c < comps; c++) {
      const at = base + i * stride + c * size;
      out.push(
        a.componentType === 5126
          ? bin.readFloatLE(at)
          : a.componentType === 5125
            ? bin.readUInt32LE(at)
            : a.componentType === 5123
              ? bin.readUInt16LE(at)
              : bin.readUInt8(at),
      );
    }
  }
  return out;
}

if (gltf.nodes.some((n: Record<string, unknown>) => n.matrix || n.translation || n.rotation || n.scale)) {
  console.warn("warning: nodes have transforms; this script assumes they don't");
}
const triangles: number[][] = []; // [x0,y0,z0,x1,y1,z1,x2,y2,z2]
for (const mesh of gltf.meshes) {
  for (const prim of mesh.primitives) {
    const pos = readAccessor(prim.attributes.POSITION);
    const idx = prim.indices !== undefined ? readAccessor(prim.indices) : [...Array(pos.length / 3).keys()];
    for (let t = 0; t < idx.length; t += 3) {
      triangles.push([0, 1, 2].flatMap((k) => pos.slice(idx[t + k]! * 3, idx[t + k]! * 3 + 3)));
    }
  }
}

// ── Top-down height map ──────────────────────────────────────────────────────
let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
for (const t of triangles) {
  for (const k of [0, 3, 6]) {
    minX = Math.min(minX, t[k]!); maxX = Math.max(maxX, t[k]!);
    minZ = Math.min(minZ, t[k + 2]!); maxZ = Math.max(maxZ, t[k + 2]!);
  }
}
const cols = Math.ceil((maxX - minX) / CELL);
const rows = Math.ceil((maxZ - minZ) / CELL);
const height = new Float32Array(cols * rows);
const low = new Uint8Array(cols * rows); // something between THRESHOLD and HEAD
const cellOf = (x: number, z: number) => {
  const c = Math.min(cols - 1, Math.max(0, Math.floor((x - minX) / CELL)));
  const r = Math.min(rows - 1, Math.max(0, Math.floor((z - minZ) / CELL)));
  return r * cols + c;
};
const raise = (x: number, z: number, y: number) => {
  const i = cellOf(x, z);
  if (y > height[i]!) height[i] = y;
  if (y > THRESHOLD && y < HEAD) low[i] = 1;
};

for (const [x0, y0, z0, x1, y1, z1, x2, y2, z2] of triangles as Array<[number, number, number, number, number, number, number, number, number]>) {
  // Edges (catches vertical walls, which have no area from above).
  for (const [ax, ay, az, bx, by, bz] of [
    [x0, y0, z0, x1, y1, z1],
    [x1, y1, z1, x2, y2, z2],
    [x2, y2, z2, x0, y0, z0],
  ]) {
    const steps = Math.max(1, Math.ceil(Math.hypot(bx! - ax!, bz! - az!) / (CELL / 2)));
    for (let s = 0; s <= steps; s++) {
      const f = s / steps;
      raise(ax! + (bx! - ax!) * f, az! + (bz! - az!) * f, ay! + (by! - ay!) * f);
    }
  }
  // Whole surface, sampled densely, so walls register along their full height and length.
  const span = Math.max(Math.hypot(x1 - x0, y1 - y0, z1 - z0), Math.hypot(x2 - x0, y2 - y0, z2 - z0));
  const n = Math.max(1, Math.ceil(span / (CELL / 2)));
  for (let a = 0; a <= n; a++) {
    for (let b = 0; a + b <= n; b++) {
      const u = a / n, v = b / n;
      raise(x0 + (x1 - x0) * u + (x2 - x0) * v, z0 + (z1 - z0) * u + (z2 - z0) * v, y0 + (y1 - y0) * u + (y2 - y0) * v);
    }
  }
  // Interior (roofs and floors).
  const area = (x1 - x0) * (z2 - z0) - (x2 - x0) * (z1 - z0);
  if (Math.abs(area) < 1e-9) continue;
  const c0 = Math.floor((Math.min(x0, x1, x2) - minX) / CELL);
  const c1 = Math.floor((Math.max(x0, x1, x2) - minX) / CELL);
  const r0 = Math.floor((Math.min(z0, z1, z2) - minZ) / CELL);
  const r1 = Math.floor((Math.max(z0, z1, z2) - minZ) / CELL);
  for (let r = Math.max(0, r0); r <= Math.min(rows - 1, r1); r++) {
    for (let c = Math.max(0, c0); c <= Math.min(cols - 1, c1); c++) {
      const px = minX + (c + 0.5) * CELL;
      const pz = minZ + (r + 0.5) * CELL;
      const w0 = ((x1 - px) * (z2 - pz) - (x2 - px) * (z1 - pz)) / area;
      const w1 = ((x2 - px) * (z0 - pz) - (x0 - px) * (z2 - pz)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
      const y = w0 * y0 + w1 * y1 + w2 * y2;
      if (y > height[r * cols + c]!) height[r * cols + c] = y;
      if (y > THRESHOLD && y < HEAD) low[r * cols + c] = 1;
    }
  }
}

// ── Solid cells → buildings (connected components) → rectangles ──────────────
const labels = new Int32Array(cols * rows);
let next = 0;
const solid = (i: number) => height[i]! > THRESHOLD;
for (let i = 0; i < labels.length; i++) {
  if (!solid(i) || labels[i]) continue;
  next++;
  const stack = [i];
  labels[i] = next;
  while (stack.length) {
    const j = stack.pop()!;
    const r = Math.floor(j / cols), c = j % cols;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
      const k = rr * cols + cc;
      if (solid(k) && !labels[k]) { labels[k] = next; stack.push(k); }
    }
  }
}

// What blocks walking: anything at body height, plus anything walled in (a building's
// inside). Flood-fill open ground from the map's edge; whatever it can't reach is enclosed.
// Open structures (like a tower you can walk under) stay walkable because their gaps connect.
const reachable = new Uint8Array(cols * rows);
const queue: number[] = [];
for (let i = 0; i < low.length; i++) {
  const r = Math.floor(i / cols), c = i % cols;
  if ((r === 0 || c === 0 || r === rows - 1 || c === cols - 1) && !low[i]) {
    reachable[i] = 1;
    queue.push(i);
  }
}
while (queue.length) {
  const j = queue.pop()!;
  const r = Math.floor(j / cols), c = j % cols;
  for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const rr = r + dr, cc = c + dc;
    if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
    const k = rr * cols + cc;
    if (!low[k] && !reachable[k]) { reachable[k] = 1; queue.push(k); }
  }
}
const blocked = new Uint8Array(cols * rows);
for (let i = 0; i < blocked.length; i++) blocked[i] = low[i] || !reachable[i] ? 1 : 0;

// Greedy rectangle merge (row-major), in model units.
const used = new Uint8Array(cols * rows);
const rects: number[][] = [];
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const i = r * cols + c;
    if (!blocked[i] || used[i]) continue;
    let w = 1;
    while (c + w < cols && blocked[i + w] && !used[i + w]) w++;
    let h = 1;
    grow: while (r + h < rows) {
      for (let k = 0; k < w; k++) {
        const j = (r + h) * cols + c + k;
        if (!blocked[j] || used[j]) break grow;
      }
      h++;
    }
    for (let dr = 0; dr < h; dr++) for (let k = 0; k < w; k++) used[(r + dr) * cols + c + k] = 1;
    rects.push([minX + c * CELL, minZ + r * CELL, minX + (c + w) * CELL, minZ + (r + h) * CELL].map((v) => +v.toFixed(3)));
  }
}

// Run-length encode labels for the runtime (splitting the mesh into buildings).
const rle: number[] = [];
for (let i = 0; i < labels.length; ) {
  let n = 1;
  while (i + n < labels.length && labels[i + n] === labels[i]) n++;
  rle.push(labels[i]!, n);
  i += n;
}

// Spawn spots: open ground well clear of anything blocked, nearest the middle first, spread
// out so a group doesn't stack up. Margin and spacing are in model units.
const SPAWN_MARGIN = Number(flags["spawn-margin"] ?? 2.5);
const SPAWN_SPACING = Number(flags["spawn-spacing"] ?? 4.6);
const marginCells = Math.ceil(SPAWN_MARGIN / CELL);
const centerX = (minX + maxX) / 2;
const centerZ = (minZ + maxZ) / 2;
const candidates: Array<[number, number, number]> = [];
for (let r = marginCells; r < rows - marginCells; r++) {
  for (let c = marginCells; c < cols - marginCells; c++) {
    let clear = true;
    for (let dr = -marginCells; dr <= marginCells && clear; dr++) {
      for (let dc = -marginCells; dc <= marginCells && clear; dc++) {
        if (blocked[(r + dr) * cols + c + dc]) clear = false;
      }
    }
    if (!clear) continue;
    const x = minX + (c + 0.5) * CELL;
    const z = minZ + (r + 0.5) * CELL;
    candidates.push([x, z, Math.hypot(x - centerX, z - centerZ)]);
  }
}
candidates.sort((a, b) => a[2] - b[2]);
const spawns: number[][] = [];
for (const [x, z] of candidates) {
  if (spawns.length >= 48) break;
  if (spawns.every(([sx, sz]) => Math.hypot(sx! - x, sz! - z) >= SPAWN_SPACING)) spawns.push([+x.toFixed(2), +z.toFixed(2)]);
}

const out = { cell: CELL, threshold: THRESHOLD, head: HEAD, minX, minZ, maxX, maxZ, cols, rows, buildings: next, rects, spawns, labels: rle };
writeFileSync(outPath, JSON.stringify(out));

// --ascii=x,z,halfSize prints what's around a point: "#" body-height geometry, "+" enclosed
// (blocked), "." overhead only (walkable), handy for checking open structures.
if (flags.ascii) {
  const [ax, az, half] = flags.ascii.split(",").map(Number) as [number, number, number];
  const c0 = Math.floor((ax - half - minX) / CELL);
  const r0 = Math.floor((az - half - minZ) / CELL);
  const n = Math.ceil((half * 2) / CELL);
  for (let r = r0; r < r0 + n; r += 2) {
    let line = "";
    for (let c = c0; c < c0 + n; c++) {
      const i = r * cols + c;
      line += low[i] ? "#" : blocked[i] ? "+" : labels[i] ? "." : " ";
    }
    console.log(line);
  }
}

// Stats for picking a threshold.
const hist = new Map<number, number>();
for (const h of height) {
  const b = h < 0.25 ? 0 : h < 0.75 ? 0.5 : h < 1.5 ? 1 : h < 3 ? 2 : h < 6 ? 4 : h < 12 ? 8 : 16;
  hist.set(b, (hist.get(b) ?? 0) + 1);
}
console.log(`${triangles.length} triangles, grid ${cols}×${rows} @ ${CELL}, bounds x ${minX}..${maxX} z ${minZ}..${maxZ}`);
console.log("cell heights:", [...hist.entries()].sort((a, b) => a[0] - b[0]).map(([b, n]) => `≥${b}: ${n}`).join("  "));
console.log(`threshold ${THRESHOLD}: ${next} buildings, ${rects.length} collision rectangles, ${blocked.filter(Boolean).length} blocked cells`);

// Optional debug image: height in grey, solid cells tinted per building.
if (debugPath) {
  const scale = 3;
  const W = cols * scale, H = rows * scale;
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const i = Math.floor(y / scale) * cols + Math.floor(x / scale);
      const g = Math.min(255, Math.round(Math.sqrt(height[i]! / 40) * 255));
      const l = labels[i]!;
      // Blocked cells in building colors; open-structure cells you can walk under in dark teal.
      const rgb = blocked[i] ? [80 + ((l * 97) % 175), 60 + ((l * 57) % 120), 120 + ((l * 31) % 135)] : l ? [20, 90, 90] : [g, g, g];
      rgb.forEach((v, k) => (raw[y * (W * 3 + 1) + 1 + x * 3 + k] = v));
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, body: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
    const tb = Buffer.concat([Buffer.from(type), body]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(tb));
    return Buffer.concat([len, tb, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  writeFileSync(debugPath, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]));
  console.log("debug image:", debugPath);
}
