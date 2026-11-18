import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BotEntity } from '../../game/aiSimulation';

interface BotActorsProps {
  botsRef: React.MutableRefObject<BotEntity[]>;
  botHitMeshesRef: React.MutableRefObject<THREE.Object3D[]>;
  shadowsEnabled: boolean;
  isSoftwareGl: boolean;
}

export function BotActors({
  botsRef,
  botHitMeshesRef,
  shadowsEnabled,
  isSoftwareGl,
}: BotActorsProps) {
  const castShadow = shadowsEnabled && !isSoftwareGl;
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const canopyRefs = useRef<(THREE.Mesh | null)[]>([]);
  const hpFillRefs = useRef<(THREE.Mesh | null)[]>([]);
  const hpBarRefs = useRef<(THREE.Group | null)[]>([]);
  const bodyRefs = useRef<(THREE.Group | null)[]>([]);

  const botsSnapshot = botsRef.current;

  useFrame(({ camera }) => {
    const bots = botsRef.current;
    const activeMeshes: THREE.Object3D[] = [];

    for (let i = 0; i < bots.length; i++) {
      const bot = bots[i];
      const grp = groupRefs.current[i];
      if (!grp) continue;

      const alive = bot.state !== 'eliminated';
      grp.visible = alive;
      if (!alive) continue;

      grp.position.set(bot.x, bot.y, bot.z);
      grp.rotation.y = bot.yaw;

      const canopy = canopyRefs.current[i];
      if (canopy) {
        canopy.visible = bot.parachuteOpen;
      }

      const body = bodyRefs.current[i];
      if (body) {
        body.position.y = bot.isCrouching ? -0.3 : 0;
        body.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh && obj.userData.hitZone) {
            obj.userData.botId = bot.id;
            activeMeshes.push(obj);
          }
        });
      }

      // Show overhead HP bar when damaged or close to camera
      const hpBar = hpBarRefs.current[i];
      const hpFill = hpFillRefs.current[i];
      if (hpBar && hpFill) {
        const dist = camera.position.distanceTo(grp.position);
        const showBar = (bot.hp < 100 || dist < 42) && !bot.parachuteOpen;
        hpBar.visible = showBar;
        if (showBar) {
          hpBar.lookAt(camera.position);
          const ratio = Math.max(0.02, bot.hp / bot.maxHp);
          hpFill.scale.x = ratio;
          hpFill.position.x = -(1 - ratio) * 0.42;
        }
      }
    }

    botHitMeshesRef.current = activeMeshes;
  });

  return (
    <group>
      {botsSnapshot.map((bot, idx) => (
        <group
          key={bot.id}
          ref={(el) => {
            groupRefs.current[idx] = el;
          }}
        >
          {/* Parachute Canopy when dropping */}
          <mesh
            ref={(el) => {
              canopyRefs.current[idx] = el;
            }}
            position={[0, 3.8, 0]}
            visible={bot.parachuteOpen}
          >
            <sphereGeometry args={[2.1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
            <meshStandardMaterial color="#b91c1c" roughness={0.75} side={THREE.DoubleSide} />
          </mesh>

          {/* Grounded Composite AI Operator */}
          <group
            ref={(el) => {
              bodyRefs.current[idx] = el;
            }}
          >
            {/* Legs */}
            <mesh position={[-0.14, 0.44, 0]} castShadow={castShadow} userData={{ hitZone: 'body' }}>
              <boxGeometry args={[0.17, 0.86, 0.19]} />
              <meshStandardMaterial color={bot.camoPants} roughness={0.86} />
            </mesh>
            <mesh position={[0.14, 0.44, 0]} castShadow={castShadow} userData={{ hitZone: 'body' }}>
              <boxGeometry args={[0.17, 0.86, 0.19]} />
              <meshStandardMaterial color={bot.camoPants} roughness={0.86} />
            </mesh>
            {/* Torso Hitbox */}
            <mesh position={[0, 1.18, 0]} castShadow={castShadow} userData={{ hitZone: 'body' }}>
              <boxGeometry args={[0.46, 0.62, 0.28]} />
              <meshStandardMaterial color={bot.camoUniform} roughness={0.82} />
            </mesh>
            {/* Tactical Vest */}
            <mesh position={[0, 1.22, 0]} castShadow={castShadow} userData={{ hitZone: 'body' }}>
              <boxGeometry args={[0.49, 0.42, 0.32]} />
              <meshStandardMaterial color="#272b30" roughness={0.68} />
            </mesh>
            {/* Head + Helmet Hitbox */}
            <mesh position={[0, 1.66, 0]} castShadow={castShadow} userData={{ hitZone: 'head' }}>
              <boxGeometry args={[0.26, 0.28, 0.26]} />
              <meshStandardMaterial color="#3b4248" roughness={0.45} metalness={0.3} />
            </mesh>
            {/* Rifle Silhouette */}
            <mesh position={[0.18, 1.18, 0.36]} castShadow={castShadow}>
              <boxGeometry args={[0.07, 0.1, 0.68]} />
              <meshStandardMaterial color="#1c2024" roughness={0.4} metalness={0.75} />
            </mesh>
          </group>

          {/* Overhead Floating Health Bar */}
          <group
            ref={(el) => {
              hpBarRefs.current[idx] = el;
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
                hpFillRefs.current[idx] = el;
              }}
              position={[0, 0, 0.01]}
            >
              <planeGeometry args={[0.84, 0.07]} />
              <meshBasicMaterial color="#ef4444" />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
