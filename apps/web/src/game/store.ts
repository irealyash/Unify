import { useEffect } from "react";
import { create } from "zustand";
import type { PlayerState, Pose, RoomSnapshot, Stage } from "@unify/shared";
import { socket } from "@/lib/socket";

type RoomState = {
  code: string | null;
  stage: Stage;
  selfId: string | null;
  /** Player metadata. Live positions are kept in `poses` so moves don't re-render React. */
  players: Record<string, PlayerState>;
  applySnapshot: (snapshot: RoomSnapshot, selfId?: string | null) => void;
  upsertPlayer: (player: PlayerState) => void;
  markLeft: (id: string) => void;
  removePlayer: (id: string) => void;
  reset: () => void;
};

/** Latest known pose for every player, read every frame by the 3D scene. */
export const poses = new Map<string, Pose>();

export const useRoom = create<RoomState>((set, get) => ({
  code: null,
  stage: "lobby",
  selfId: null,
  players: {},
  applySnapshot: (snapshot, selfId = null) => {
    poses.clear();
    const players: Record<string, PlayerState> = {};
    for (const p of snapshot.players) {
      players[p.id] = p;
      poses.set(p.id, { x: p.x, z: p.z, rotY: p.rotY });
    }
    set({ code: snapshot.code, stage: snapshot.stage, selfId, players });
  },
  upsertPlayer: (player) => {
    // Keep our own locally-simulated pose; the server echo would make us snap back.
    if (player.id !== get().selfId || !poses.has(player.id)) {
      poses.set(player.id, { x: player.x, z: player.z, rotY: player.rotY });
    }
    set((s) => ({ players: { ...s.players, [player.id]: player } }));
  },
  markLeft: (id) =>
    set((s) => {
      const existing = s.players[id];
      if (!existing) return s;
      return { players: { ...s.players, [id]: { ...existing, connected: false } } };
    }),
  removePlayer: (id) => {
    poses.delete(id);
    set((s) => {
      if (!s.players[id]) return s;
      const players = { ...s.players };
      delete players[id];
      return { players };
    });
  },
  reset: () => {
    poses.clear();
    set({ code: null, stage: "lobby", selfId: null, players: {} });
  },
}));

/** Subscribes the room store to live server events while mounted. */
export function useRoomEvents() {
  useEffect(() => {
    const { upsertPlayer, markLeft, removePlayer } = useRoom.getState();
    const onMoved = (moves: Array<Pose & { id: string }>) => {
      const selfId = useRoom.getState().selfId;
      for (const m of moves) {
        if (m.id !== selfId) poses.set(m.id, { x: m.x, z: m.z, rotY: m.rotY });
      }
    };
    const onLeft = ({ id }: { id: string }) => markLeft(id);
    const onRemoved = ({ id }: { id: string }) => removePlayer(id);
    const onStage = ({ stage }: { stage: Stage }) => useRoom.setState({ stage });
    const onSnapshot = (snapshot: RoomSnapshot) =>
      useRoom.getState().applySnapshot(snapshot, useRoom.getState().selfId);

    socket.on("room:stage", onStage);
    socket.on("room:snapshot", onSnapshot);
    socket.on("player:upsert", upsertPlayer);
    socket.on("player:left", onLeft);
    socket.on("player:removed", onRemoved);
    socket.on("players:moved", onMoved);
    return () => {
      socket.off("room:stage", onStage);
      socket.off("room:snapshot", onSnapshot);
      socket.off("player:upsert", upsertPlayer);
      socket.off("player:left", onLeft);
      socket.off("player:removed", onRemoved);
      socket.off("players:moved", onMoved);
      useRoom.getState().reset();
    };
  }, []);
}
