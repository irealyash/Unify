import { useFrame } from "@react-three/fiber";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { Box3, Ray, Vector3, type Group, type Material, type Mesh } from "three";
import { damp } from "../math";

/**
 * Fades buildings that stand between the follow camera and the player, so tall city blocks
 * never hide your character. Wrap each building in <Fadeable>; put <FadeGroup> around them.
 */

type Entry = {
  box: Box3;
  materials: Array<{ material: Material; opacity: number; transparent: boolean }>;
  fade: number;
};

type Registry = Set<Entry>;

const FadeContext = createContext<Registry | null>(null);

const FADED_OPACITY = 0.07;

export function FadeGroup({
  target,
  children,
}: {
  /** Where the player is (world space), or null to disable fading (e.g. host view). */
  target: () => Vector3 | null;
  children: ReactNode;
}) {
  const registry = useMemo<Registry>(() => new Set(), []);
  const ray = useMemo(() => new Ray(), []);
  const hit = useMemo(() => new Vector3(), []);
  const toTarget = useMemo(() => new Vector3(), []);

  useFrame(({ camera }, delta) => {
    const goal = target();
    const t = damp(10, Math.min(delta, 0.1));
    let maxDistance = 0;
    if (goal) {
      toTarget.copy(goal).sub(camera.position);
      maxDistance = toTarget.length() - 0.6;
      ray.set(camera.position, toTarget.normalize());
    }
    for (const entry of registry) {
      const blocking =
        goal !== null &&
        ray.intersectBox(entry.box, hit) !== null &&
        hit.distanceTo(camera.position) < maxDistance;
      const wanted = blocking ? FADED_OPACITY : 1;
      if (Math.abs(entry.fade - wanted) < 0.002) continue;
      entry.fade += (wanted - entry.fade) * t;
      if (Math.abs(entry.fade - wanted) < 0.01) entry.fade = wanted;
      const opaque = entry.fade >= 0.999;
      for (const m of entry.materials) {
        m.material.opacity = m.opacity * entry.fade;
        const transparent = m.transparent || !opaque;
        if (m.material.transparent !== transparent) {
          m.material.transparent = transparent;
          // three.js compiles opaque materials with alpha forced to 1, so switching needs a
          // recompile (the program is cached after the first time).
          m.material.needsUpdate = true;
        }
        m.material.depthWrite = opaque && !m.transparent;
      }
    }
  });

  return <FadeContext.Provider value={registry}>{children}</FadeContext.Provider>;
}

/** A building (or any static group) that can fade. Its materials are cloned per instance. */
export function Fadeable({ children }: { children: ReactNode }) {
  const registry = useContext(FadeContext);
  const group = useRef<Group>(null);

  useLayoutEffect(() => {
    const root = group.current;
    if (!registry || !root) return;
    root.updateWorldMatrix(true, true);
    const entry: Entry = { box: new Box3().setFromObject(root), materials: [], fade: 1 };
    const clones = new Map<Material, Material>();
    root.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) return;
      const swap = (m: Material) => {
        let clone = clones.get(m);
        if (!clone) {
          clone = m.clone();
          clones.set(m, clone);
          entry.materials.push({ material: clone, opacity: m.opacity, transparent: m.transparent });
        }
        return clone;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
    });
    registry.add(entry);
    return () => {
      registry.delete(entry);
      clones.forEach((c) => c.dispose());
    };
  }, [registry]);

  return <group ref={group}>{children}</group>;
}
