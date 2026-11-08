import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import {
  BufferGeometry,
  CanvasTexture,
  Color,
  MeshStandardMaterial,
  NearestFilter,
  SRGBColorSpace,
  type Mesh,
  type Texture,
} from "three";
import { NEON, TOWER } from "./nightCityLayout";

/**
 * "東京タワー" by Kenta Imai, CC-BY, via Poly Pizza (https://poly.pizza/m/frPqTFGeRNM).
 * The file is the tower plus a small town; we keep only the tower and restyle it in neon.
 */
const MODEL_URL = "/models/tokyo-tower.glb";

/**
 * How each palette swatch the tower uses is recolored. The model's colors come from a 256×1
 * palette texture; the tower only uses these three swatches.
 * Set NEON_STYLE to false to keep the original red-and-white look.
 */
const NEON_STYLE = true;
const SWATCHES: Record<number, { color: string; glow: number }> = {
  // Deep magenta frame with a soft glow, so the bright bands and windows give it definition.
  37: { color: "#b3176f", glow: 0.35 }, // lattice (orig. red-orange)
  234: { color: "#4ff0ff", glow: 1 }, // bands and platforms (orig. white)
  183: { color: "#ffe2ff", glow: 1 }, // observation-deck windows (orig. blue)
};

export function TokyoTower() {
  const gltf = useGLTF(MODEL_URL);

  const { geometry, material } = useMemo(() => {
    let source: Mesh | undefined;
    gltf.scene.traverse((o) => {
      if (!source && (o as Mesh).isMesh) source = o as Mesh;
    });
    if (!source) throw new Error("Tokyo Tower model has no mesh");

    const geometry = cropToTower(source.geometry);
    const original = (source.material as MeshStandardMaterial).map;
    if (!NEON_STYLE || !original) {
      return { geometry, material: (source.material as MeshStandardMaterial).clone() };
    }
    const { map, emissiveMap } = recolorPalette(original);
    const material = new MeshStandardMaterial({
      map,
      emissive: "#ffffff",
      emissiveMap,
      emissiveIntensity: 1.6,
      roughness: 0.5,
      metalness: 0.25,
    });
    return { geometry, material };
  }, [gltf]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.map?.dispose();
      material.emissiveMap?.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return (
    <group>
      <mesh geometry={geometry} material={material} scale={TOWER.scale} />
      {/* Light the plaza from the tower: pink under the arch, cyan from the deck. */}
      <pointLight position={[0, 3, 0]} color={NEON.pink} intensity={30} distance={14} decay={1.4} />
      <pointLight
        position={[0, TOWER.height * 0.55, 0]}
        color={NEON.cyan}
        intensity={40}
        distance={26}
        decay={1.4}
      />
    </group>
  );
}

useGLTF.preload(MODEL_URL);

/** Keeps only the triangles near the center (the tower) and re-centers it on the origin. */
function cropToTower(source: BufferGeometry) {
  const { crop, center } = TOWER.model;
  const pos = source.getAttribute("position");
  const index = source.getIndex();
  const count = index ? index.count : pos.count;
  const vertex = (i: number) => (index ? index.getX(i) : i);
  const kept: number[] = [];
  for (let t = 0; t < count; t += 3) {
    const a = vertex(t);
    const b = vertex(t + 1);
    const c = vertex(t + 2);
    const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3 - center[0];
    const cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3 - center[1];
    if (Math.abs(cx) < crop && Math.abs(cz) < crop) kept.push(a, b, c);
  }
  const geometry = source.clone();
  geometry.setIndex(kept);
  geometry.translate(-center[0], 0, -center[1]);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Repaints the palette swatches the tower uses; the emissive copy makes them glow. */
function recolorPalette(original: Texture) {
  const image = original.image as CanvasImageSource & { width: number; height: number };
  const make = (glow: boolean) => {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    if (glow) {
      // Only the restyled swatches emit light; everything else stays unlit.
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const column = canvas.width / 256;
    for (const [index, swatch] of Object.entries(SWATCHES)) {
      const c = new Color(swatch.color);
      if (glow) c.multiplyScalar(Math.min(swatch.glow, 1));
      ctx.fillStyle = `#${c.getHexString()}`;
      ctx.fillRect(Number(index) * column, 0, column, canvas.height);
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.flipY = original.flipY;
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.generateMipmaps = false;
    return texture;
  };
  return { map: make(false), emissiveMap: make(true) };
}
