import { Sky, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo } from "react";
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  MeshStandardMaterial,
  Vector3,
  type Material,
  type Mesh,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Area } from "@unify/shared";
import { poses, useRoom } from "../store";
import { Countryside, Scatter, type Placement, type TownGround } from "./Countryside";
import { FadeGroup, Fadeable } from "./fade";
import {
  BUILDING_COUNT,
  GROUND_LEVEL,
  LAMPS,
  PLAZA,
  TOWN_HALF,
  TOWN_MODEL_URL,
  TOWN_SCALE,
  buildingAt,
  distanceToBuildings,
} from "./tokyoTownMap";

/** The plaza to paint on the tiled floor under the model. */
const TOWN_GROUND: TownGround = { plaza: PLAZA };

/**
 * The city biome, in daytime: the whole "東京タワー" town model (Kenta Imai, CC-BY, Poly Pizza)
 * with its original colors, split into ground + one piece per building so buildings that
 * block your view can fade out.
 *
 * `immersive` (a player standing in it) adds the sky, a tree belt and hills on the horizon.
 */
export function TokyoTown({ area, immersive = false }: { area: Area; immersive?: boolean }) {
  // Fade buildings between the camera and *your* character (players only; world space).
  const head = useMemo(() => new Vector3(), []);
  const fadeTarget = useMemo(
    () => () => {
      if (!immersive) return null;
      const id = useRoom.getState().selfId;
      const pose = id ? poses.get(id) : undefined;
      return pose ? head.set(pose.x, 1.2, pose.z) : null;
    },
    [immersive, head],
  );

  return (
    <group position={[area.cx, 0, area.cz]}>
      {immersive ? (
        <Sky distance={4500} sunPosition={[120, 70, 60]} turbidity={5} rayleigh={1.4} mieCoefficient={0.004} />
      ) : null}
      {/* The tiled floor and plaza under the model, plus the fields, trees and hills
          around the town for players. */}
      <Countryside halfX={TOWN_HALF.x} halfZ={TOWN_HALF.z} immersive={immersive} town={TOWN_GROUND} />
      <Lampposts />
      <Suspense fallback={null}>
        <FadeGroup target={fadeTarget}>
          <TownModel />
        </FadeGroup>
      </Suspense>
    </group>
  );
}

useGLTF.preload(TOWN_MODEL_URL);

/**
 * The tower at the center never fades: groups spawn under its open arch, so its bounds would
 * always "block" the camera, and its lattice rarely hides anyone anyway.
 */
const TOWER_BUILDING = buildingAt(0, 0);

type Piece = { geometry: BufferGeometry; material: Material; building: number };

/**
 * A compact geometry holding only the given triangles' vertices. (Reusing the full vertex
 * buffer with a smaller index would leave every piece's bounding box the size of the whole
 * town, and the see-through check relies on per-building bounds.)
 */
function extract(source: BufferGeometry, indices: number[]) {
  const remap = new Map<number, number>();
  const order: number[] = [];
  const newIndex = indices.map((old) => {
    let next = remap.get(old);
    if (next === undefined) {
      next = order.length;
      remap.set(old, next);
      order.push(old);
    }
    return next;
  });
  const geometry = new BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) {
    const size = attribute.itemSize;
    const ArrayType = attribute.array.constructor as new (length: number) => Float32Array;
    const array = new ArrayType(order.length * size);
    order.forEach((old, i) => {
      for (let k = 0; k < size; k++) array[i * size + k] = attribute.array[old * size + k]!;
    });
    geometry.setAttribute(name, new BufferAttribute(array, size, attribute.normalized));
  }
  geometry.setIndex(newIndex);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Loads the town and splits it by building (labels come from the footprint map). */
function TownModel() {
  const gltf = useGLTF(TOWN_MODEL_URL);

  const pieces = useMemo<Piece[]>(() => {
    const out: Piece[] = [];
    gltf.scene.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) return;
      const source = mesh.geometry;
      const pos = source.getAttribute("position");
      const index = source.getIndex();
      const count = index ? index.count : pos.count;
      const vertex = (i: number) => (index ? index.getX(i) : i);
      // Bucket triangles: 0 = ground and anything not part of a building.
      const buckets: number[][] = Array.from({ length: BUILDING_COUNT + 1 }, () => []);
      for (let t = 0; t < count; t += 3) {
        const a = vertex(t);
        const b = vertex(t + 1);
        const c = vertex(t + 2);
        const top = Math.max(pos.getY(a), pos.getY(b), pos.getY(c));
        const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
        const cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
        const building = top < GROUND_LEVEL ? 0 : buildingAt(cx, cz);
        buckets[building]!.push(a, b, c);
      }
      buckets.forEach((indices, building) => {
        if (indices.length === 0) return;
        out.push({ geometry: extract(source, indices), material: mesh.material as Material, building });
      });
    });
    return out;
  }, [gltf]);

  useEffect(() => () => pieces.forEach((p) => p.geometry.dispose()), [pieces]);

  return (
    <group scale={TOWN_SCALE}>
      {pieces.map((p, i) =>
        p.building === 0 || p.building === TOWER_BUILDING ? (
          // Ground pieces only receive shadows; the (never-faded) tower casts one too.
          <mesh
            key={i}
            geometry={p.geometry}
            material={p.material}
            castShadow={p.building === TOWER_BUILDING}
            receiveShadow
          />
        ) : (
          <Fadeable key={i}>
            <mesh geometry={p.geometry} material={p.material} castShadow receiveShadow />
          </Fadeable>
        ),
      )}
    </group>
  );
}

/**
 * Street lamps along the sidewalks (positions and collision come from the town map), each
 * reaching out over the street, away from the building it stands by.
 */
function Lampposts() {
  const { lamps, geometry, materials } = useMemo(() => {
    const lamps: Placement[] = LAMPS.map(([x, z]) => {
      // Point the arm down the distance gradient's uphill: away from the nearest building.
      const e = 0.05;
      const gx = distanceToBuildings(x + e, z) - distanceToBuildings(x - e, z);
      const gz = distanceToBuildings(x, z + e) - distanceToBuildings(x, z - e);
      return { x, y: 0, z, s: 1, rot: Math.atan2(-gz, gx), color: "#ffffff" };
    });
    const part = (g: BufferGeometry, x: number, y: number) => g.translate(x, y, 0);
    const parts = [
      part(new CylinderGeometry(0.11, 0.14, 0.3, 8), 0, 0.15), // base
      part(new CylinderGeometry(0.045, 0.065, 3.1, 8), 0, 1.55), // pole
      part(new BoxGeometry(0.62, 0.05, 0.05), 0.3, 3.05), // arm
      part(new BoxGeometry(0.36, 0.1, 0.2), 0.62, 3.0), // head housing
    ];
    const body = mergeGeometries(parts)!;
    parts.forEach((g) => g.dispose());
    return {
      lamps,
      geometry: { body, light: part(new BoxGeometry(0.3, 0.03, 0.15), 0.62, 2.94) },
      materials: {
        body: new MeshStandardMaterial({ color: "#3f454d", roughness: 0.55, metalness: 0.4 }),
        light: new MeshStandardMaterial({ color: "#fff6dc", emissive: "#ffe2a0", emissiveIntensity: 0.8 }),
      },
    };
  }, []);

  useEffect(
    () => () => {
      Object.values(geometry).forEach((g) => g.dispose());
      Object.values(materials).forEach((m) => m.dispose());
    },
    [geometry, materials],
  );

  return (
    <>
      <Scatter geometry={geometry.body} material={materials.body} items={lamps} castShadow />
      <Scatter geometry={geometry.light} material={materials.light} items={lamps} />
    </>
  );
}
