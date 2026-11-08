import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import type { PlayerState } from "@unify/shared";
import { Avatar } from "./Avatar";
import type { GroundHeight } from "./collision";
import { damp, lerpAngle } from "./math";
import { poses } from "./store";

/** Another player: smoothly follows the latest pose the server sent. */
export function RemotePlayer({
  player,
  labelScale,
  ground,
}: {
  player: PlayerState;
  labelScale?: number;
  /** Ground height to stand on; flat (0) when not given. */
  ground?: GroundHeight;
}) {
  const group = useRef<Group>(null);
  const placed = useRef(false);

  useFrame((_, rawDelta) => {
    const g = group.current;
    const target = poses.get(player.id);
    if (!g || !target) return;
    if (!placed.current) {
      g.position.set(target.x, ground ? ground(target.x, target.z) : 0, target.z);
      g.rotation.y = target.rotY;
      placed.current = true;
      return;
    }
    const t = damp(12, Math.min(rawDelta, 0.1));
    g.position.x += (target.x - g.position.x) * t;
    g.position.z += (target.z - g.position.z) * t;
    if (ground) g.position.y = ground(g.position.x, g.position.z);
    g.rotation.y = lerpAngle(g.rotation.y, target.rotY, t);
  });

  return (
    <group ref={group}>
      <Avatar name={player.name} color={player.color} labelScale={labelScale} />
    </group>
  );
}
