"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Bounds, Edges, Grid, OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";

// Placeholder "blueprint" car built from simple shapes at roughly ND Miata
// scale (meters). x = across the car, y = up, z = forward. Every piece has a
// key so the part list can highlight it and clicks can select it.

const WHEELBASE = 2.31;
const TRACK = 1.5;
const WHEEL_R = 0.31;
const FRONT_Z = WHEELBASE / 2;
const REAR_Z = -WHEELBASE / 2;

type CornerKey = "FL" | "FR" | "RL" | "RR";
const CORNERS: { key: CornerKey; x: number; z: number }[] = [
  { key: "FL", x: TRACK / 2, z: FRONT_Z },
  { key: "FR", x: -TRACK / 2, z: FRONT_Z },
  { key: "RL", x: TRACK / 2, z: REAR_Z },
  { key: "RR", x: -TRACK / 2, z: REAR_Z },
];

export type CarHighlight = {
  keys: string[];
  color: string;
  marker?: [number, number, number];
};

type Props = {
  highlight: CarHighlight | null;
  /** Shows glowing markers for custom parts placed on the car. */
  markers: { position: [number, number, number]; color: string; active: boolean }[];
  onPickPart: (key: string) => void;
  /** When set, the next click on the car places a point instead of selecting. */
  placing: boolean;
  onPlace: (point: [number, number, number]) => void;
};

// ---------------------------------------------------------------- body shape

function bodyGeometry() {
  // Side profile (u = forward z, v = height y), traced around the car.
  const top: [number, number][] = [
    [1.97, 0.3], [1.93, 0.52], [1.7, 0.62], [1.35, 0.7], [0.9, 0.76], [0.55, 0.8],
    [0.28, 1.08], [0.18, 1.1], [0.1, 0.86], [-0.75, 0.86], [-0.95, 0.92],
    [-1.55, 0.9], [-1.82, 0.82], [-1.87, 0.42], [-1.82, 0.2],
  ];
  const shape = new THREE.Shape();
  shape.moveTo(top[0][0], top[0][1]);
  top.slice(1).forEach(([u, v]) => shape.lineTo(u, v));
  // Underside, rear to front, with wheel arches.
  const archR = WHEEL_R + 0.06;
  const bottomY = 0.17;
  for (const zc of [REAR_Z, FRONT_Z]) {
    shape.lineTo(zc - archR, bottomY);
    for (let a = Math.PI; a >= 0; a -= Math.PI / 16) {
      shape.lineTo(zc + archR * Math.cos(a), WHEEL_R + archR * Math.sin(a) * 0.95);
    }
    shape.lineTo(zc + archR, bottomY);
  }
  shape.lineTo(1.88, 0.18);
  shape.closePath();

  const width = 1.56;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.06,
    bevelSegments: 4,
    curveSegments: 8,
  });
  // Extruded along its own z; turn it so the profile runs along the car's z.
  geo.rotateY(-Math.PI / 2);
  geo.translate(width / 2, 0, 0);
  return geo;
}

// ---------------------------------------------------------------- materials

const BASE = new THREE.Color("#3f3f46");

function usePartMaterial(key: string, highlight: CarHighlight | null) {
  const lit = highlight?.keys.includes(key) ?? false;
  const xray = highlight !== null;
  return useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: lit ? new THREE.Color(highlight!.color) : BASE,
      emissive: lit ? new THREE.Color(highlight!.color) : new THREE.Color("#000000"),
      emissiveIntensity: lit ? 2.2 : 0,
      metalness: 0.2,
      roughness: 0.55,
      transparent: xray && !lit,
      opacity: xray && !lit ? 0.18 : 1,
      depthWrite: !(xray && !lit),
    });
    return m;
  }, [lit, xray, highlight]);
}

// ---------------------------------------------------------------- pieces

type PieceProps = {
  pieceKey: string;
  highlight: CarHighlight | null;
  onPick: (key: string, e: ThreeEvent<MouseEvent>) => void;
  onHover: (hovering: boolean) => void;
  position?: [number, number, number];
  rotation?: [number, number, number];
  children: React.ReactNode; // geometry
};

function Piece({ pieceKey, highlight, onPick, onHover, position, rotation, children }: PieceProps) {
  const material = usePartMaterial(pieceKey, highlight);
  const lit = highlight?.keys.includes(pieceKey) ?? false;
  const xray = highlight !== null;
  return (
    <mesh
      position={position}
      rotation={rotation}
      material={material}
      userData={{ piece: pieceKey }}
      onClick={(e) => onPick(pieceKey, e)}
      onPointerOver={(e) => { e.stopPropagation(); onHover(true); }}
      onPointerOut={() => onHover(false)}
    >
      {children}
      <Edges
        threshold={20}
        color={lit ? highlight!.color : "#a1a1aa"}
        transparent
        opacity={lit ? 1 : xray ? 0.12 : 0.45}
      />
    </mesh>
  );
}

// A cylinder running between two points (arms, dampers, axles, driveshaft).
function Segment({
  from, to, radius, ...rest
}: Omit<PieceProps, "position" | "rotation" | "children"> & {
  from: [number, number, number];
  to: [number, number, number];
  radius: number;
}) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return { position: a.add(b).multiplyScalar(0.5), quaternion: q, length: dir.length() };
  }, [from, to]);
  const euler = new THREE.Euler().setFromQuaternion(quaternion);
  return (
    <Piece {...rest} position={position.toArray() as [number, number, number]} rotation={[euler.x, euler.y, euler.z]}>
      <cylinderGeometry args={[radius, radius, length, 10]} />
    </Piece>
  );
}

// ---------------------------------------------------------------- car

function Car({ highlight, markers, onPickPart, placing, onPlace }: Props) {
  const body = useMemo(() => bodyGeometry(), []);
  const rootRef = useRef<THREE.Group>(null);
  const [hovering, setHovering] = useState(false);
  const xray = highlight !== null;

  useEffect(() => {
    document.body.style.cursor = placing ? "crosshair" : hovering ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovering, placing]);

  // Store placed points in the car's own coordinates so markers stay on the car.
  const placeAt = (world: THREE.Vector3) => {
    const local = rootRef.current ? rootRef.current.worldToLocal(world.clone()) : world;
    onPlace([+local.x.toFixed(3), +local.y.toFixed(3), +local.z.toFixed(3)]);
  };

  const bodyMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: "#18181b",
      metalness: 0.1,
      roughness: 0.7,
      transparent: true,
      opacity: xray ? 0.04 : 0.3,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    [xray],
  );

  const pick = (key: string, e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 4) return; // a drag to rotate, not a click
    if (placing) {
      placeAt(e.point);
      return;
    }
    onPickPart(key);
  };

  const common = { highlight, onPick: pick, onHover: setHovering };

  return (
    <group ref={rootRef}>
      {/* Body shell: see-through blueprint. Clicks pass through to the parts
          inside, except while placing a part: then the point lands on the
          first part behind the shell, or on the shell if nothing is behind it. */}
      <mesh
        geometry={body}
        material={bodyMaterial}
        onClick={(e) => {
          if (!placing || e.delta > 4) return;
          e.stopPropagation();
          const behind = e.intersections.find((hit) => hit.object.userData.piece);
          placeAt(behind ? behind.point : e.point);
        }}
      >
        <Edges threshold={18} color="#d4d4d8" transparent opacity={xray ? 0.14 : 0.55} />
      </mesh>

      {/* Roll bar */}
      <Segment pieceKey="rollbar-L" from={[0.45, 0.8, -0.72]} to={[0.4, 1.18, -0.78]} radius={0.025} {...common} />
      <Segment pieceKey="rollbar-R" from={[-0.45, 0.8, -0.72]} to={[-0.4, 1.18, -0.78]} radius={0.025} {...common} />
      <Segment pieceKey="rollbar-T" from={[0.4, 1.18, -0.78]} to={[-0.4, 1.18, -0.78]} radius={0.025} {...common} />

      {/* Engine, oil pan, clutch, gearbox, driveshaft, diff */}
      <Piece pieceKey="engine-block" position={[0, 0.45, 0.92]} {...common}>
        <boxGeometry args={[0.5, 0.36, 0.46]} />
      </Piece>
      <Piece pieceKey="engine-head" position={[0, 0.69, 0.92]} {...common}>
        <boxGeometry args={[0.44, 0.12, 0.42]} />
      </Piece>
      <Piece pieceKey="oil-pan" position={[0, 0.22, 0.92]} {...common}>
        <boxGeometry args={[0.4, 0.1, 0.38]} />
      </Piece>
      <Piece pieceKey="clutch" position={[0, 0.42, 0.64]} rotation={[Math.PI / 2, 0, 0]} {...common}>
        <cylinderGeometry args={[0.15, 0.15, 0.08, 24]} />
      </Piece>
      <Piece pieceKey="transmission" position={[0, 0.4, 0.3]} rotation={[Math.PI / 2, 0, 0]} {...common}>
        <cylinderGeometry args={[0.1, 0.15, 0.6, 16]} />
      </Piece>
      <Segment pieceKey="driveshaft" from={[0, 0.38, 0]} to={[0, 0.34, REAR_Z + 0.16]} radius={0.035} {...common} />
      <Piece pieceKey="differential" position={[0, 0.33, REAR_Z]} {...common}>
        <boxGeometry args={[0.32, 0.24, 0.28]} />
      </Piece>
      <Segment pieceKey="axle-L" from={[0.16, 0.32, REAR_Z]} to={[TRACK / 2 - 0.12, WHEEL_R, REAR_Z]} radius={0.028} {...common} />
      <Segment pieceKey="axle-R" from={[-0.16, 0.32, REAR_Z]} to={[-TRACK / 2 + 0.12, WHEEL_R, REAR_Z]} radius={0.028} {...common} />

      {/* Each corner: tire, rotor, pads, hub, control arms, damper */}
      {CORNERS.map(({ key, x, z }) => {
        const s = Math.sign(x);
        return (
          <group key={key}>
            <Piece pieceKey={`tire-${key}`} position={[x, WHEEL_R, z]} rotation={[0, 0, Math.PI / 2]} {...common}>
              <cylinderGeometry args={[WHEEL_R, WHEEL_R, 0.2, 32, 1, true]} />
            </Piece>
            <Piece pieceKey={`rotor-${key}`} position={[x - s * 0.13, WHEEL_R, z]} rotation={[0, 0, Math.PI / 2]} {...common}>
              <cylinderGeometry args={[0.14, 0.14, 0.024, 28]} />
            </Piece>
            <Piece pieceKey={`pad-${key}`} position={[x - s * 0.13, WHEEL_R + 0.1, z - 0.07]} {...common}>
              <boxGeometry args={[0.07, 0.09, 0.12]} />
            </Piece>
            <Piece pieceKey={`hub-${key}`} position={[x - s * 0.2, WHEEL_R, z]} rotation={[0, 0, Math.PI / 2]} {...common}>
              <cylinderGeometry args={[0.07, 0.07, 0.09, 16]} />
            </Piece>
            <Segment pieceKey={`arm-upper-${key}`} from={[s * 0.34, 0.54, z + 0.16]} to={[x - s * 0.24, 0.5, z]} radius={0.018} {...common} />
            <Segment pieceKey={`arm-upper-${key}`} from={[s * 0.34, 0.54, z - 0.16]} to={[x - s * 0.24, 0.5, z]} radius={0.018} {...common} />
            <Segment pieceKey={`arm-lower-${key}`} from={[s * 0.3, 0.19, z + 0.2]} to={[x - s * 0.2, 0.15, z]} radius={0.02} {...common} />
            <Segment pieceKey={`arm-lower-${key}`} from={[s * 0.3, 0.19, z - 0.2]} to={[x - s * 0.2, 0.15, z]} radius={0.02} {...common} />
            <Segment pieceKey={`damper-${key}`} from={[x - s * 0.3, 0.2, z + 0.02]} to={[x - s * 0.38, 0.66, z + 0.04]} radius={0.034} {...common} />
          </group>
        );
      })}

      {/* Custom part markers */}
      {markers.map((m, i) => (
        <mesh key={i} position={m.position}>
          <sphereGeometry args={[m.active ? 0.06 : 0.035, 20, 20]} />
          <meshBasicMaterial color={m.color} toneMapped={false} transparent opacity={m.active ? 1 : 0.55} />
        </mesh>
      ))}
      {highlight?.marker && (
        <PulseRing position={highlight.marker} color={highlight.color} />
      )}
    </group>
  );
}

function PulseRing({ position, color }: { position: [number, number, number]; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock, camera }) => {
    if (!ref.current) return;
    const t = (clock.elapsedTime % 1.6) / 1.6;
    ref.current.scale.setScalar(1 + t * 2.5);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = 1 - t;
    ref.current.quaternion.copy(camera.quaternion);
  });
  return (
    <mesh ref={ref} position={position}>
      <ringGeometry args={[0.07, 0.085, 32]} />
      <meshBasicMaterial color={color} transparent toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ---------------------------------------------------------------- scene

export default function Car3D(props: Props) {
  return (
    <Canvas
      camera={{ position: [6.5, 3.4, 6.5], fov: 35 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[4, 6, 3]} intensity={1.2} />
      <directionalLight position={[-4, 3, -4]} intensity={0.35} color="#e5751f" />

      <group position={[0, -0.55, 0]}>
        {/* Fits the camera to the car whatever shape the panel is. */}
        <Bounds fit clip observe margin={1.12}>
          <Car {...props} />
        </Bounds>
        <Grid
          position={[0, 0.001, 0]}
          args={[10, 10]}
          cellSize={0.25}
          cellThickness={0.6}
          cellColor="#3f3f46"
          sectionSize={1}
          sectionThickness={1}
          sectionColor="#861f41"
          fadeDistance={9}
          fadeStrength={1.5}
          infiniteGrid
        />
      </group>

      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom
        minDistance={3}
        maxDistance={16}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2.1}
        autoRotate={!props.placing}
        autoRotateSpeed={0.7}
        target={[0, -0.05, 0]}
      />

      <EffectComposer>
        <Bloom mipmapBlur luminanceThreshold={0.9} intensity={1.1} />
      </EffectComposer>
    </Canvas>
  );
}
