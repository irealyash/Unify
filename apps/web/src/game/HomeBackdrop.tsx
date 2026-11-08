import { useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BackSide, Color, IcosahedronGeometry, MeshStandardMaterial, Vector3 } from "three";
import { BIOME_BY_ID, type BiomeId } from "@unify/shared";
import { Scatter, type Placement } from "./biomes/Countryside";
import { createRng } from "./biomes/random";
import { TOWN_MODEL_URL } from "./biomes/tokyoTownMap";
import { useDispose } from "./biomes/useDispose";
import { damp } from "./math";
import { BIOME_ENVS, BIOME_SCENES, Sun } from "./WorldScene";

/** How much of the biome's normal light the dimmed backdrop keeps. */
const LIGHT_LEVEL = 0.76;
/** How far (world units) the view shifts when the mouse reaches the edge of the window. */
const PARALLAX = 0.8;

type Viewpoint = {
  camera: [x: number, y: number, z: number];
  lookAt: [x: number, y: number, z: number];
  /** The sky straight up and at the horizon, and the thin haze that melts far hills into it. */
  sky: { zenith: string; horizon: string };
  fog: [color: string, near: number, far: number];
  /** A model the scene loads, so the backdrop can stay hidden until it's ready. */
  model?: string;
};

/** Where to view each biome from. Add the others here to pick between them later. */
const VIEWPOINTS: Partial<Record<BiomeId, Viewpoint>> = {
  night_city: {
    camera: [14.5, 12, 28],
    lookAt: [6, 6.2, 0],
    sky: { zenith: "#3f9be8", horizon: "#cfeafb" },
    fog: ["#cfeafb", 80, 340],
    model: TOWN_MODEL_URL,
  },
};

/**
 * A live view of a biome behind the home screen, dimmed a little, that nudges toward the mouse.
 * It's only decoration: if 3D isn't available, the page just keeps its plain background.
 */
export function HomeBackdrop({ biome = "night_city" }: { biome?: BiomeId }) {
  const [ready, setReady] = useState(false);
  const Scene = BIOME_SCENES[biome];
  const env = BIOME_ENVS[biome];
  const view = VIEWPOINTS[biome];
  const area = useMemo(() => ({ cx: 0, cz: 0, half: BIOME_BY_ID.get(biome)!.walkHalf }), [biome]);
  if (!Scene || !env || !view) return null;

  return (
    <BackdropBoundary>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 transition-opacity duration-1000 ease-out"
        style={{ opacity: ready ? 1 : 0 }}
      >
        <Canvas
          shadows="percentage"
          frameloop="demand"
          dpr={[1, 1.5]}
          camera={{ position: view.camera, fov: 50, far: 900 }}
        >
          <color attach="background" args={[env.background]} />
          <fog attach="fog" args={view.fog} />
          <SkyDome {...view.sky} />
          <Clouds />
          <hemisphereLight args={[env.hemisphere[0], env.hemisphere[1], env.hemisphere[2] * LIGHT_LEVEL]} />
          <Sun focusX={0} focusZ={0} extent={40} {...env.sun} intensity={env.sun.intensity * LIGHT_LEVEL} />
          <Scene area={area} immersive />
          <ParallaxCamera view={view} />
          <Suspense fallback={null}>
            {view.model ? <WhenLoaded url={view.model} onReady={() => setReady(true)} /> : null}
          </Suspense>
        </Canvas>
        {/* A soft shade behind the form, leaving the sky bright. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 36% 58% at 50% 62%, rgba(28, 21, 16, 0.52), rgba(28, 21, 16, 0.22) 100%)",
          }}
        />
      </div>
    </BackdropBoundary>
  );
}

/** A clear sky: a big gradient sphere around the scene, in front of the biome's usual one. */
function SkyDome({ zenith, horizon }: { zenith: string; horizon: string }) {
  const uniforms = useMemo(
    () => ({ uZenith: { value: new Color(zenith) }, uHorizon: { value: new Color(horizon) } }),
    [zenith, horizon],
  );
  return (
    <mesh>
      <sphereGeometry args={[800, 32, 16]} />
      <shaderMaterial
        side={BackSide}
        fog={false}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={/* glsl */ `
          varying vec3 vDir;
          uniform vec3 uZenith;
          uniform vec3 uHorizon;
          void main() {
            float up = normalize(vDir).y;
            gl_FragColor = vec4(mix(uHorizon, uZenith, smoothstep(0.0, 0.3, up)), 1.0);
            #include <colorspace_fragment>
          }
        `}
      />
    </mesh>
  );
}

/** Puffy low-poly clouds, placed low enough to show above the far hills. */
function Clouds() {
  const { puffs, geometry, material } = useMemo(() => {
    const rng = createRng(2112);
    const puffs: Placement[] = [];
    for (let cloud = 0; cloud < 22; cloud++) {
      const x = rng.range(-300, 260);
      const z = rng.range(-320, -150);
      const y = rng.range(46, 92);
      const size = rng.range(7, 15);
      const count = 4 + Math.floor(rng.next() * 4);
      for (let i = 0; i < count; i++) {
        const spread = (i / count - 0.5) * 2;
        puffs.push({
          x: x + spread * size * 1.7 + rng.range(-2, 2),
          y: y + (1 - Math.abs(spread)) * size * 0.28,
          z: z + rng.range(-5, 5),
          s: size * rng.range(0.55, 1) * (1.15 - Math.abs(spread) * 0.5),
          rot: rng.range(0, Math.PI * 2),
          color: "#ffffff",
        });
      }
    }
    return {
      puffs,
      geometry: new IcosahedronGeometry(1, 1).scale(1.25, 0.62, 1),
      material: new MeshStandardMaterial({
        emissive: "#e8eef2",
        emissiveIntensity: 0.5,
        roughness: 1,
        flatShading: true,
        fog: false,
        toneMapped: false,
      }),
    };
  }, []);
  useDispose(geometry, material);
  return <Scatter geometry={geometry} material={material} items={puffs} />;
}

/** Reports when a model has finished loading (suspends until then). */
function WhenLoaded({ url, onReady }: { url: string; onReady: () => void }) {
  useGLTF(url);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    onReady();
    invalidate();
  }, [onReady, invalidate]);
  return null;
}

/**
 * Slides the whole view with the mouse: moving the mouse right moves the scene right, so the
 * camera steps left. It slides without turning, so nearby things shift more than distant ones.
 */
function ParallaxCamera({ view }: { view: Viewpoint }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const mouse = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const { base, target, right, up, position, look } = useMemo(() => {
    const base = new Vector3(...view.camera);
    const target = new Vector3(...view.lookAt);
    const forward = target.clone().sub(base).normalize();
    const right = forward.clone().cross(new Vector3(0, 1, 0)).normalize();
    const up = right.clone().cross(forward).normalize();
    return { base, target, right, up, position: new Vector3(), look: new Vector3() };
  }, [view]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = 1 - (e.clientY / window.innerHeight) * 2;
      invalidate();
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [invalidate]);

  useFrame((_, delta) => {
    const t = damp(3.5, Math.min(delta, 0.1));
    const now = current.current;
    now.x += (mouse.current.x - now.x) * t;
    now.y += (mouse.current.y - now.y) * t;
    position.copy(base).addScaledVector(right, -now.x * PARALLAX).addScaledVector(up, -now.y * PARALLAX * 0.6);
    look.copy(target).addScaledVector(right, -now.x * PARALLAX).addScaledVector(up, -now.y * PARALLAX * 0.6);
    camera.position.copy(position);
    camera.lookAt(look);
    // Rendering only happens on request, so keep asking until the view has settled.
    if (Math.abs(mouse.current.x - now.x) + Math.abs(mouse.current.y - now.y) > 0.001) invalidate();
  });

  return null;
}

/** If 3D fails (no WebGL, lost context), the join form must still work. */
class BackdropBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[home] 3D backdrop unavailable:", error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
