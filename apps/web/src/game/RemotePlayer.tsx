import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { Group } from "three";
import type { PlayerState } from "@unify/shared";
import { Avatar } from "./Avatar";
import { moveWithCollisions, pushOut, type GroundHeight, type Obstacles } from "./collision";
import { damp, lerpAngle } from "./math";
import { poses, useRoom } from "./store";

/** Another player: smoothly follows the latest pose the server sent. */
export function RemotePlayer({
  player,
  labelScale,
  ground,
  obstacles,
  clickable,
}: {
  player: PlayerState;
  labelScale?: number;
  /** Ground height to stand on; flat (0) when not given. */
  ground?: GroundHeight;
  /**
   * Walls to stop at. Only for demo bots: the server moves them without knowing the map, while
   * real players already handle collisions on their own screens.
   */
  obstacles?: Obstacles;
  /** Clicking opens this player's profile card (teammates, once sorted). */
  clickable?: boolean;
}) {
  const group = useRef<Group>(null);
  const placed = useRef(false);
  const viewing = useRoom((s) => s.viewingId === player.id);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!clickable || !hovered) return;
    document.body.style.cursor = "pointer";
    return () => {
      document.body.style.cursor = "";
    };
  }, [clickable, hovered]);

  useFrame((_, rawDelta) => {
    const g = group.current;
    const target = poses.get(player.id);
    if (!g || !target) return;
    if (!placed.current) {
      const start = obstacles ? pushOut(target, obstacles) : target;
      g.position.set(start.x, ground ? ground(start.x, start.z) : 0, start.z);
      g.rotation.y = target.rotY;
      placed.current = true;
      return;
    }
    const t = damp(12, Math.min(rawDelta, 0.1));
    const wanted = {
      x: g.position.x + (target.x - g.position.x) * t,
      z: g.position.z + (target.z - g.position.z) * t,
    };
    const next = obstacles ? moveWithCollisions(g.position, wanted, obstacles) : wanted;
    g.position.x = next.x;
    g.position.z = next.z;
    if (ground) g.position.y = ground(g.position.x, g.position.z);
    g.rotation.y = lerpAngle(g.rotation.y, target.rotY, t);
  });

  return (
    <group ref={group}>
      <Avatar
        name={player.name}
        color={player.color}
        hat={player.hat}
        mouth={player.mouth}
        labelScale={labelScale}
        highlighted={clickable && (hovered || viewing)}
      />
      {clickable ? (
        // An invisible target, a little wider than the body, so people are easy to click but
        // someone standing in front doesn't cover whoever is behind them.
        <mesh
          position={[0, 0.62, 0]}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            useRoom.getState().setViewing(player.id);
          }}
          onPointerOver={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            setHovered(true);
          }}
          onPointerOut={() => setHovered(false)}
        >
          <cylinderGeometry args={[0.8, 0.8, 1.25, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
}
