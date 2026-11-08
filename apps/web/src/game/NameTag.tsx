import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

const FONT = '600 44px "IBM Plex Sans", system-ui, sans-serif';
const TAG_HEIGHT_PX = 72;
const PADDING_X_PX = 26;
/** Height of the tag in world units. */
const WORLD_HEIGHT = 0.42;

type NameTagProps = {
  text: string;
  /** Background color when highlighted (the local player's tag). */
  color: string;
  highlight?: boolean;
  /** Text color when highlighted. */
  textColor?: string;
  y: number;
  z?: number;
  scale?: number;
};

/** A camera-facing name label drawn to a canvas texture (no DOM overlay needed). */
export function NameTag({
  text,
  color,
  highlight,
  textColor = "#0b0d17",
  y,
  z = 0,
  scale = 1,
}: NameTagProps) {
  const { texture, aspect } = useMemo(() => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    ctx.font = FONT;
    const width = Math.ceil(ctx.measureText(text).width) + PADDING_X_PX * 2;
    canvas.width = width;
    canvas.height = TAG_HEIGHT_PX;

    // Resizing the canvas resets its state, so set the font again.
    ctx.font = FONT;
    ctx.fillStyle = highlight ? color : "rgba(11, 13, 23, 0.82)";
    ctx.beginPath();
    ctx.roundRect(0, 0, width, TAG_HEIGHT_PX, 22);
    ctx.fill();
    ctx.fillStyle = highlight ? textColor : "#eef0ff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, width / 2, TAG_HEIGHT_PX / 2 + 2);

    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    return { texture: tex, aspect: width / TAG_HEIGHT_PX };
  }, [text, color, highlight, textColor]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite
      position={[0, y, z]}
      scale={[WORLD_HEIGHT * scale * aspect, WORLD_HEIGHT * scale, 1]}
      renderOrder={10}
    >
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}
