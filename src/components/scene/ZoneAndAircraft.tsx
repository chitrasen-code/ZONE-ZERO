import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FlightPathState, MatchPhase, ZoneHudState } from '../../types/game';

interface ZoneAndAircraftProps {
  matchPhase: MatchPhase;
  zoneRef: React.MutableRefObject<ZoneHudState>;
  flightRef: React.MutableRefObject<FlightPathState>;
}

export function ZoneAndAircraft({ matchPhase, zoneRef, flightRef }: ZoneAndAircraftProps) {
  const zoneWallRef = useRef<THREE.Mesh>(null);
  const aircraftGroupRef = useRef<THREE.Group>(null);
  const propRefs = useRef<(THREE.Mesh | null)[]>([]);

  const zoneMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: '#2563eb',
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, []);

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const z = zoneRef.current;

    if (zoneWallRef.current) {
      zoneWallRef.current.position.set(z.blueCenterX, 55, z.blueCenterZ);
      const r = Math.max(2, z.blueRadius);
      zoneWallRef.current.scale.set(r, 1, r);
      zoneMaterial.opacity = 0.19 + Math.sin(state.clock.elapsedTime * 2.4) * 0.035;
    }

    const fl = flightRef.current;
    const showPlane =
      matchPhase === 'countdown' ||
      matchPhase === 'aircraft' ||
      matchPhase === 'skydiving' ||
      matchPhase === 'parachuting';

    if (aircraftGroupRef.current) {
      aircraftGroupRef.current.visible = showPlane;
      if (showPlane) {
        aircraftGroupRef.current.position.set(fl.planeX, fl.planeY, fl.planeZ);
        aircraftGroupRef.current.rotation.y = fl.planeYaw;
      }
    }

    for (let i = 0; i < propRefs.current.length; i++) {
      const p = propRefs.current[i];
      if (p) p.rotation.z += dt * 28;
    }
  });

  return (
    <group>
      {/* Shrinking Blue Zone Energy Wall */}
      <mesh ref={zoneWallRef} renderOrder={5} material={zoneMaterial}>
        <cylinderGeometry args={[1, 1, 130, 48, 1, true]} />
      </mesh>

      {/* C-130 Tactical Transport Aircraft */}
      <group ref={aircraftGroupRef} visible={false}>
        {/* Main Fuselage */}
        <mesh castShadow>
          <cylinderGeometry args={[1.65, 1.85, 18, 12]} />
          <meshStandardMaterial color="#4b535c" roughness={0.5} metalness={0.55} />
        </mesh>
        {/* Rotate fuselage along local +Z */}
        <group rotation={[Math.PI / 2, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[1.7, 1.8, 18, 12]} />
            <meshStandardMaterial color="#555e68" roughness={0.48} metalness={0.58} />
          </mesh>
          {/* Nose cone */}
          <mesh position={[0, 10.2, 0]}>
            <coneGeometry args={[1.68, 3.2, 12]} />
            <meshStandardMaterial color="#3b4249" roughness={0.45} metalness={0.6} />
          </mesh>
          {/* Cockpit glass */}
          <mesh position={[0, 8.8, -1.25]}>
            <boxGeometry args={[2.1, 1.5, 0.9]} />
            <meshStandardMaterial color="#182738" roughness={0.15} metalness={0.85} />
          </mesh>
        </group>

        {/* High Main Wings */}
        <mesh position={[0, 1.2, 0.5]}>
          <boxGeometry args={[24, 0.45, 3.6]} />
          <meshStandardMaterial color="#616a73" roughness={0.5} metalness={0.55} />
        </mesh>

        {/* Tail Horizontal Stabilizer & Vertical Fin */}
        <mesh position={[0, 1.0, -8.5]}>
          <boxGeometry args={[9.0, 0.3, 2.0]} />
          <meshStandardMaterial color="#58616b" roughness={0.52} metalness={0.52} />
        </mesh>
        <mesh position={[0, 3.3, -8.2]}>
          <boxGeometry args={[0.35, 4.4, 2.8]} />
          <meshStandardMaterial color="#3c444d" roughness={0.48} metalness={0.58} />
        </mesh>

        {/* 4 Turboprop Nacelles + Spinning Propellers */}
        {[-7.5, -3.8, 3.8, 7.5].map((wx, idx) => (
          <group key={idx} position={[wx, 0.9, 1.8]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.45, 0.4, 2.4, 8]} />
              <meshStandardMaterial color="#2f363d" roughness={0.42} metalness={0.68} />
            </mesh>
            <mesh
              ref={(el) => {
                propRefs.current[idx] = el;
              }}
              position={[0, 0, 1.3]}
            >
              <boxGeometry args={[2.4, 0.16, 0.08]} />
              <meshStandardMaterial color="#1d2228" roughness={0.3} metalness={0.8} />
            </mesh>
          </group>
        ))}

        {/* Rear Drop Ramp Beacon */}
        <mesh position={[0, -0.8, -9.2]}>
          <sphereGeometry args={[0.35, 8, 8]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
      </group>
    </group>
  );
}
