import { useMemo } from "react";
import { Color } from "three";

/** Size of a grid square. The camera always sits 1 unit above the room's floor. */
const CELL = 0.2;
/** How far the room reaches from the camera. Whole squares, so lines run along every edge. */
const ROOM = { halfWidth: 2.4, halfDepth: 2.2, ceiling: 1.4, floor: 1 };

/**
 * The background behind the lobby: a huge room ruled with grid lines, with its floor level with the
 * lobby's tray. It's seen through the game camera's own angle, so the two share a perspective and
 * look parallel, but it never gets closer as you walk, so the tray seems to float inside it.
 */
export function GridBackdrop({ background, lines = "#6f727c" }: { background: string; lines?: string }) {
  const uniforms = useMemo(
    () => ({ uBackground: { value: new Color(background) }, uLines: { value: new Color(lines) } }),
    [background, lines],
  );

  return (
    <mesh frustumCulled={false} renderOrder={-1000}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        depthTest={false}
        depthWrite={false}
        fog={false}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          varying vec3 vRay;
          void main() {
            // The direction each corner of the screen looks in, in world space.
            vec3 view = vec3(position.x / projectionMatrix[0][0], position.y / projectionMatrix[1][1], -1.0);
            vRay = transpose(mat3(viewMatrix)) * view;
            gl_Position = vec4(position.xy, 1.0, 1.0);
          }
        `}
        fragmentShader={/* glsl */ `
          varying vec3 vRay;
          uniform vec3 uBackground;
          uniform vec3 uLines;

          void main() {
            vec3 r = vRay;
            // Which wall the ray reaches first.
            vec3 wall = vec3(
              r.x > 0.0 ? ${ROOM.halfWidth.toFixed(3)} : ${(-ROOM.halfWidth).toFixed(3)},
              r.y > 0.0 ? ${ROOM.ceiling.toFixed(3)} : ${(-ROOM.floor).toFixed(3)},
              r.z > 0.0 ? ${ROOM.halfDepth.toFixed(3)} : ${(-ROOM.halfDepth).toFixed(3)});
            vec3 toWall = wall / (sign(r) * max(abs(r), vec3(0.00001)));
            float hit = min(toWall.x, min(toWall.y, toWall.z));
            vec3 p = r * hit;

            // The two directions that run along that surface.
            vec2 grid;
            if (hit == toWall.y) grid = p.xz;
            else if (hit == toWall.z) grid = p.xy;
            else grid = p.yz;
            grid /= ${CELL.toFixed(3)};

            vec2 toLine = abs(fract(grid - 0.5) - 0.5) / max(fwidth(grid), vec2(0.00001));
            float line = 1.0 - min(min(toLine.x, toLine.y), 1.0);

            // Strong close by, nearly gone at the far walls.
            float strength = mix(0.66, 0.1, smoothstep(1.2, 3.4, length(p)));
            gl_FragColor = vec4(mix(uBackground, uLines, line * strength), 1.0);
            #include <colorspace_fragment>
          }
        `}
      />
    </mesh>
  );
}
