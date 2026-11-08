import { useEffect } from "react";
import type { BufferGeometry, Material } from "three";

/** Disposes geometries and materials when the component unmounts or they're rebuilt. */
export function useDispose(...things: Array<BufferGeometry | Material>) {
  useEffect(() => () => things.forEach((t) => t.dispose()), things); // eslint-disable-line react-hooks/exhaustive-deps
}
