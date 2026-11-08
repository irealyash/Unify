import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { MOVE_SPEED, NETWORK_TICK_HZ, clampToArea, type Area, type PlayerState } from "@unify/shared";
import { socket } from "@/lib/socket";
import { Avatar } from "./Avatar";
import { moveWithCollisions, pushOut, type Rect } from "./collision";
import { damp, lerpAngle } from "./math";
import { poses } from "./store";
import { readDirection, useMovementKeys } from "./useKeyboard";

/** Follow-camera placement relative to the player. */
export type CameraRig = { height: number; distance: number; lookHeight: number };
const DEFAULT_RIG: CameraRig = { height: 9, distance: 11, lookHeight: 0.8 };

type LocalPlayerProps = {
  player: PlayerState;
  /** Where this player may walk (the lobby, or their biome). */
  area: Area;
  /** Solid footprints (buildings) to slide around, in world space. */
  obstacles?: readonly Rect[];
  /** Camera placement; streets lined with tall buildings want a lower, flatter view. */
  rig?: CameraRig;
  frozen?: boolean;
};

const NO_OBSTACLES: readonly Rect[] = [];

/** The player this browser controls: reads WASD, moves locally, streams pose to the server. */
export function LocalPlayer({
  player,
  area,
  obstacles = NO_OBSTACLES,
  rig = DEFAULT_RIG,
  frozen,
}: LocalPlayerProps) {
  const group = useRef<Group>(null);
  const keys = useMovementKeys();
  const sinceSend = useRef(0);
  const lastSent = useRef({ x: NaN, z: NaN, rotY: NaN });
  const placed = useRef(false);

  useFrame((state, rawDelta) => {
    const g = group.current;
    if (!g) return;
    const delta = Math.min(rawDelta, 0.1);
    const camera = state.camera;

    if (!placed.current) {
      const start = poses.get(player.id) ?? player;
      const free = pushOut(start, obstacles);
      g.position.set(free.x, 0, free.z);
      g.rotation.y = start.rotY;
      camera.position.set(free.x, rig.height, free.z + rig.distance);
      placed.current = true;
    }

    const dir = frozen ? null : readDirection(keys.current);
    if (dir) {
      const wanted = clampToArea(
        area,
        g.position.x + dir.x * MOVE_SPEED * delta,
        g.position.z + dir.z * MOVE_SPEED * delta,
      );
      const next = moveWithCollisions(g.position, wanted, obstacles);
      g.position.x = next.x;
      g.position.z = next.z;
      g.rotation.y = lerpAngle(g.rotation.y, Math.atan2(dir.x, dir.z), damp(14, delta));
    }

    // Fixed-angle follow camera.
    const t = damp(6, delta);
    camera.position.x += (g.position.x - camera.position.x) * t;
    camera.position.y += (rig.height - camera.position.y) * t;
    camera.position.z += (g.position.z + rig.distance - camera.position.z) * t;
    camera.lookAt(camera.position.x, rig.lookHeight, camera.position.z - rig.distance);

    const pose = { x: g.position.x, z: g.position.z, rotY: g.rotation.y };
    poses.set(player.id, pose);

    sinceSend.current += delta;
    if (sinceSend.current >= 1 / NETWORK_TICK_HZ) {
      sinceSend.current = 0;
      const prev = lastSent.current;
      const moved =
        Math.abs(prev.x - pose.x) > 0.001 ||
        Math.abs(prev.z - pose.z) > 0.001 ||
        Math.abs(prev.rotY - pose.rotY) > 0.01;
      if (moved || Number.isNaN(prev.x)) {
        socket.volatile.emit("player:move", pose);
        lastSent.current = pose;
      }
    }
  });

  return (
    <group ref={group}>
      <Avatar name={player.name} color={player.color} isSelf />
    </group>
  );
}
