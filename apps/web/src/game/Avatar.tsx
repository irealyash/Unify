import { NameTag } from "./NameTag";

type AvatarProps = {
  name: string;
  color: string;
  isSelf?: boolean;
  /** Being hovered or viewed: brightens the ring on the ground. */
  highlighted?: boolean;
  /** Enlarges the name tag, e.g. for the far-away host camera. */
  labelScale?: number;
};

/** Simple capsule character. Local +Z is the front (where the visor sits). */
export function Avatar({ name, color, isSelf, highlighted, labelScale = 1 }: AvatarProps) {
  return (
    <>
      <mesh position={[0, 0.85, 0]} castShadow>
        <capsuleGeometry args={[0.42, 0.8, 8, 16]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.18, 0.36]} castShadow>
        <boxGeometry args={[0.5, 0.18, 0.14]} />
        <meshStandardMaterial color="#0b0d17" roughness={0.2} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.62, 32]} />
        <meshBasicMaterial color={color} transparent opacity={isSelf || highlighted ? 0.9 : 0.35} />
      </mesh>
      <NameTag
        text={isSelf ? `${name} (you)` : name}
        color={color}
        highlight={isSelf}
        scale={labelScale}
        y={2.1 + (labelScale - 1) * 0.3}
      />
    </>
  );
}
