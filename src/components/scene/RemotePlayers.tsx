import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RemotePlayerSnapshot } from '../../types/game';

interface RemotePlayersProps {
  remotePlayers: RemotePlayerSnapshot[];
  shadowsEnabled: boolean;
  isSoftwareGl: boolean;
}

export function RemotePlayers({
  remotePlayers,
  shadowsEnabled,
  isSoftwareGl,
}: RemotePlayersProps) {
  const castShadow = shadowsEnabled && !isSoftwareGl;
  const groupRefs = useRef<Record<string, THREE.Group | null>>({});
  const hpBarRefs = useRef<Record<string, THREE.Group | null>>({});
  const hpFillRefs = useRef<Record<string, THREE.Mesh | null>>({});
  const smoothPos = useRef<Record<string, THREE.Vector3>>({});

  useFrame(({ camera }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    for (const p of remotePlayers) {
      const grp = groupRefs.current[p.userId];
      if (!grp) continue;
      grp.visible = p.alive && !p.isInAircraft;
      if (!grp.visible) continue;

      if (!smoothPos.current[p.userId]) {
        smoothPos.current[p.userId] = new THREE.Vector3(p.x, p.y, p.z);
      }
      const sp = smoothPos.current[p.userId];
      sp.x = THREE.MathUtils.damp(sp.x, p.x, 14, dt);
      sp.y = THREE.MathUtils.damp(sp.y, p.y, 14, dt);
      sp.z = THREE.MathUtils.damp(sp.z, p.z, 14, dt);
      grp.position.copy(sp);
      grp.rotation.y = p.yaw;

      const hpBar = hpBarRefs.current[p.userId];
      const hpFill = hpFillRefs.current[p.userId];
      if (hpBar && hpFill) {
        const dist = camera.position.distanceTo(grp.position);
        hpBar.visible = dist < 55 && !p.isParachuting;
        if (hpBar.visible) {
          hpBar.lookAt(camera.position);
          const r = Math.max(0.02, p.hp / 100);
          hpFill.scale.x = r;
          hpFill.position.x = -(1 - r) * 0.42;
        }
      }
    }
  });

  return (
    <group>
      {remotePlayers.map((p) => (
        <group
          key={p.userId}
          ref={(el) => {
            groupRefs.current[p.userId] = el;
          }}
        >
          {p.isParachuting && (
            <mesh position={[0, 3.8, 0]}>
              <sphereGeometry args={[2.1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
              <meshStandardMaterial color="#0284c7" roughness={0.75} side={THREE.DoubleSide} />
            </mesh>
          )}
          <group position={[0, p.isCrouching ? -0.3 : 0, 0]}>
            <mesh position={[-0.14, 0.44, 0]} castShadow={castShadow}>
              <boxGeometry args={[0.17, 0.86, 0.19]} />
              <meshStandardMaterial color="#363e34" roughness={0.85} />
            </mesh>
            <mesh position={[0.14, 0.44, 0]} castShadow={castShadow}>
              <boxGeometry args={[0.17, 0.86, 0.19]} />
              <meshStandardMaterial color="#363e34" roughness={0.85} />
            </mesh>
            <mesh position={[0, 1.18, 0]} castShadow={castShadow}>
              <boxGeometry args={[0.46, 0.62, 0.28]} />
              <meshStandardMaterial color="#4a5844" roughness={0.8} />
            </mesh>
            <mesh position={[0, 1.66, 0]} castShadow={castShadow}>
              <boxGeometry args={[0.25, 0.27, 0.25]} />
              <meshStandardMaterial color="#2c333a" roughness={0.45} metalness={0.3} />
            </mesh>
            <mesh position={[0.18, 1.18, 0.36]} castShadow={castShadow}>
              <boxGeometry args={[0.07, 0.1, 0.65]} />
              <meshStandardMaterial color="#1f2428" roughness={0.4} metalness={0.75} />
            </mesh>
          </group>
          <group
            ref={(el) => {
              hpBarRefs.current[p.userId] = el;
            }}
            position={[0, 2.18, 0]}
            visible={false}
          >
            <mesh>
              <planeGeometry args={[0.88, 0.11]} />
              <meshBasicMaterial color="#0f1419" />
            </mesh>
            <mesh
              ref={(el) => {
                hpFillRefs.current[p.userId] = el;
              }}
              position={[0, 0, 0.01]}
            >
              <planeGeometry args={[0.84, 0.07]} />
              <meshBasicMaterial color="#38bdf8" />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
