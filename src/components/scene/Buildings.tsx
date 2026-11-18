import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { WorldLootItem } from '../../types/game';
import { createProceduralTextureSet } from '../../world/proceduralTextures';
import { getTerrainHeight, ISLAND_BRIDGES } from '../../world/terrainMath';
import { getWorldStaticData } from '../../world/collisionData';

export interface TargetHitState {
  id: string;
  recoilAngle: number;
  recoilVel: number;
  flashTimer: number;
}

interface BuildingsProps {
  shadowsEnabled: boolean;
  isSoftwareGl: boolean;
  targetHitStatesRef: React.MutableRefObject<Record<string, TargetHitState>>;
  targetHitMeshesRef: React.MutableRefObject<THREE.Object3D[]>;
  lootItemsRef: React.MutableRefObject<WorldLootItem[]>;
}

function HollowBuilding({
  x,
  y,
  z,
  halfW,
  halfD,
  height,
  wallColor,
  roofColor,
  concreteTex,
  metalTex,
  castShadow,
  openNorth = true,
  openSouth = true,
  isPitched = false,
  hasGlassFront = false,
}: {
  x: number;
  y: number;
  z: number;
  halfW: number;
  halfD: number;
  height: number;
  wallColor: string;
  roofColor: string;
  concreteTex: THREE.CanvasTexture;
  metalTex: THREE.CanvasTexture;
  castShadow: boolean;
  openNorth?: boolean;
  openSouth?: boolean;
  isPitched?: boolean;
  hasGlassFront?: boolean;
}) {
  const doorHalf = 1.45;
  const sideSpan = Math.max(0.5, halfW - doorHalf);
  const sideCenter = doorHalf + sideSpan / 2;

  return (
    <group position={[x, y, z]}>
      {/* Foundation Slab */}
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[halfW * 2 + 0.8, 0.24, halfD * 2 + 0.8]} />
        <meshStandardMaterial map={concreteTex} color="#828681" roughness={0.9} />
      </mesh>

      {/* Left & Right Side Walls */}
      <mesh position={[-halfW, height / 2 + 0.2, 0]} castShadow={castShadow} receiveShadow>
        <boxGeometry args={[0.42, height, halfD * 2]} />
        <meshStandardMaterial map={concreteTex} color={wallColor} roughness={0.86} />
      </mesh>
      <mesh position={[halfW, height / 2 + 0.2, 0]} castShadow={castShadow} receiveShadow>
        <boxGeometry args={[0.42, height, halfD * 2]} />
        <meshStandardMaterial map={concreteTex} color={wallColor} roughness={0.86} />
      </mesh>

      {/* North Wall (-Z) */}
      {openNorth ? (
        <>
          <mesh position={[-sideCenter, height / 2 + 0.2, -halfD]} castShadow={castShadow} receiveShadow>
            <boxGeometry args={[sideSpan, height, 0.42]} />
            <meshStandardMaterial map={concreteTex} color={wallColor} roughness={0.86} />
          </mesh>
          <mesh position={[sideCenter, height / 2 + 0.2, -halfD]} castShadow={castShadow} receiveShadow>
            <boxGeometry args={[sideSpan, height, 0.42]} />
            <meshStandardMaterial map={concreteTex} color={wallColor} roughness={0.86} />
          </mesh>
          <mesh position={[0, height - 0.35, -halfD]} castShadow={castShadow}>
            <boxGeometry args={[doorHalf * 2, 1.1, 0.42]} />
            <meshStandardMaterial map={concreteTex} color={wallColor} roughness={0.86} />
          </mesh>
        </>
      ) : (
        <mesh position={[0, height / 2 + 0.2, -halfD]} castShadow={castShadow} receiveShadow>
          <boxGeometry args={[halfW * 2, height, 0.42]} />
          <meshStandardMaterial map={concreteTex} color={wallColor} roughness={0.86} />
        </mesh>
      )}

      {/* South Wall (+Z) */}
      {openSouth ? (
        <>
          <mesh position={[-sideCenter, height / 2 + 0.2, halfD]} castShadow={castShadow} receiveShadow>
            <boxGeometry args={[sideSpan, height, 0.42]} />
            <meshStandardMaterial map={concreteTex} color={wallColor} roughness={0.86} />
          </mesh>
          <mesh position={[sideCenter, height / 2 + 0.2, halfD]} castShadow={castShadow} receiveShadow>
            <boxGeometry args={[sideSpan, height, 0.42]} />
            <meshStandardMaterial map={concreteTex} color={wallColor} roughness={0.86} />
          </mesh>
          <mesh position={[0, height - 0.35, halfD]} castShadow={castShadow}>
            <boxGeometry args={[doorHalf * 2, 1.1, 0.42]} />
            <meshStandardMaterial map={concreteTex} color={wallColor} roughness={0.86} />
          </mesh>
        </>
      ) : (
        <mesh position={[0, height / 2 + 0.2, halfD]} castShadow={castShadow} receiveShadow>
          <boxGeometry args={[halfW * 2, height, 0.42]} />
          <meshStandardMaterial map={concreteTex} color={wallColor} roughness={0.86} />
        </mesh>
      )}

      {/* Modern Glass Window Strips */}
      {hasGlassFront && (
        <>
          <mesh position={[-sideCenter, height * 0.62, halfD + 0.22]}>
            <boxGeometry args={[sideSpan * 0.72, height * 0.36, 0.06]} />
            <meshStandardMaterial color="#213547" roughness={0.14} metalness={0.78} />
          </mesh>
          <mesh position={[sideCenter, height * 0.62, halfD + 0.22]}>
            <boxGeometry args={[sideSpan * 0.72, height * 0.36, 0.06]} />
            <meshStandardMaterial color="#213547" roughness={0.14} metalness={0.78} />
          </mesh>
        </>
      )}

      {/* Roof */}
      {isPitched ? (
        <>
          <mesh
            position={[-halfW * 0.52, height + 0.75, 0]}
            rotation={[0, 0, 0.28]}
            castShadow={castShadow}
          >
            <boxGeometry args={[halfW * 1.15, 0.2, halfD * 2 + 0.9]} />
            <meshStandardMaterial map={metalTex} color={roofColor} roughness={0.48} metalness={0.5} />
          </mesh>
          <mesh
            position={[halfW * 0.52, height + 0.75, 0]}
            rotation={[0, 0, -0.28]}
            castShadow={castShadow}
          >
            <boxGeometry args={[halfW * 1.15, 0.2, halfD * 2 + 0.9]} />
            <meshStandardMaterial map={metalTex} color={roofColor} roughness={0.48} metalness={0.5} />
          </mesh>
        </>
      ) : (
        <mesh position={[0, height + 0.32, 0]} castShadow={castShadow} receiveShadow>
          <boxGeometry args={[halfW * 2 + 0.8, 0.28, halfD * 2 + 0.8]} />
          <meshStandardMaterial map={metalTex} color={roofColor} roughness={0.44} metalness={0.65} />
        </mesh>
      )}
    </group>
  );
}

export function Buildings({
  shadowsEnabled,
  isSoftwareGl,
  targetHitStatesRef,
  targetHitMeshesRef,
  lootItemsRef,
}: BuildingsProps) {
  const { gl } = useThree();
  const textures = useMemo(
    () => createProceduralTextureSet(gl.capabilities.getMaxAnisotropy()),
    [gl],
  );
  useEffect(() => () => textures.dispose(), [textures]);

  const castShadow = shadowsEnabled && !isSoftwareGl;
  const worldData = useMemo(() => getWorldStaticData(), []);

  const aegisY = useMemo(() => getTerrainHeight(0, -42), []);
  const cityY = useMemo(() => getTerrainHeight(-96, 36), []);
  const resY = useMemo(() => getTerrainHeight(-24, 48), []);
  const indY = useMemo(() => getTerrainHeight(108, 34), []);
  const millY = useMemo(() => getTerrainHeight(92, -74), []);

  const radarDishRef = useRef<THREE.Group>(null);
  const targetPivotRefs = useRef<Record<string, THREE.Group | null>>({});
  const lootMeshRefs = useRef<Record<string, THREE.Group | null>>({});

  useEffect(() => {
    const meshes: THREE.Object3D[] = [];
    worldData.targets.forEach((t) => {
      if (!targetHitStatesRef.current[t.id]) {
        targetHitStatesRef.current[t.id] = {
          id: t.id,
          recoilAngle: 0,
          recoilVel: 0,
          flashTimer: 0,
        };
      }
      const grp = targetPivotRefs.current[t.id];
      if (grp) {
        grp.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh && obj.userData.hitZone) {
            obj.userData.targetId = t.id;
            obj.userData.targetLabel = t.label;
            meshes.push(obj);
          }
        });
      }
    });
    targetHitMeshesRef.current = meshes;
  }, [worldData.targets, targetHitMeshesRef, targetHitStatesRef]);

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const t = state.clock.elapsedTime;
    if (radarDishRef.current) {
      radarDishRef.current.rotation.y += dt * 0.75;
    }

    worldData.targets.forEach((tgt) => {
      const st = targetHitStatesRef.current[tgt.id];
      const grp = targetPivotRefs.current[tgt.id];
      if (!st || !grp) return;
      const accel = -28 * st.recoilAngle - 7.5 * st.recoilVel;
      st.recoilVel += accel * dt;
      st.recoilAngle += st.recoilVel * dt;
      if (st.flashTimer > 0) st.flashTimer = Math.max(0, st.flashTimer - dt);
      grp.rotation.x = st.recoilAngle;
    });

    // Update world loot pickup visibility and gentle float
    const items = lootItemsRef.current;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const grp = lootMeshRefs.current[item.id];
      if (!grp) continue;
      grp.visible = !item.collected;
      if (!item.collected) {
        grp.position.y = item.y + 0.25 + Math.sin(t * 2.4 + i) * 0.08;
        grp.rotation.y = t * 0.9 + i;
      }
    }
  });

  const initialLootSnapshot = lootItemsRef.current;

  return (
    <group>
      {/* ==================== 1. FORT AEGIS (MILITARY COMPOUND) ==================== */}
      <HollowBuilding
        x={-10}
        y={aegisY}
        z={-44}
        halfW={6}
        halfD={4.2}
        height={3.4}
        wallColor="#767c72"
        roofColor="#525a63"
        concreteTex={textures.concreteSlab}
        metalTex={textures.corrugatedMetal}
        castShadow={castShadow}
        openNorth
        openSouth
      />
      {/* Fort Aegis Watchtower */}
      <group position={[14, aegisY, -40]}>
        <mesh position={[0, 0.1, 0]} receiveShadow>
          <boxGeometry args={[4.6, 0.2, 4.6]} />
          <meshStandardMaterial map={textures.concreteSlab} color="#7e827c" roughness={0.9} />
        </mesh>
        {[
          [-1.7, -1.7],
          [1.7, -1.7],
          [-1.7, 1.7],
          [1.7, 1.7],
        ].map(([lx, lz], idx) => (
          <mesh key={idx} position={[lx, 3.25, lz]} castShadow={castShadow}>
            <cylinderGeometry args={[0.14, 0.18, 6.5, 8]} />
            <meshStandardMaterial color="#363d44" roughness={0.45} metalness={0.75} />
          </mesh>
        ))}
        <mesh position={[0, 4.3, 0]} castShadow={castShadow} receiveShadow>
          <boxGeometry args={[4.4, 0.26, 4.4]} />
          <meshStandardMaterial map={textures.crateWood} color="#63533d" roughness={0.85} />
        </mesh>
        <mesh position={[0, 6.55, 0]} rotation={[0.08, 0, 0]} castShadow={castShadow}>
          <boxGeometry args={[4.7, 0.18, 4.7]} />
          <meshStandardMaterial map={textures.corrugatedMetal} color="#4e5861" roughness={0.45} metalness={0.65} />
        </mesh>
      </group>
      {/* Fort Aegis Helipad & Rotating Radar */}
      <group position={[-22, aegisY, -56]}>
        <mesh position={[0, 0.1, 0]} receiveShadow>
          <cylinderGeometry args={[7.5, 7.8, 0.2, 8]} />
          <meshStandardMaterial map={textures.concreteSlab} color="#6d7173" roughness={0.88} />
        </mesh>
        <mesh position={[0, 0.215, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[4.6, 5.1, 32]} />
          <meshStandardMaterial color="#d49d2a" roughness={0.75} polygonOffset polygonOffsetFactor={-1} />
        </mesh>
        <group position={[-8.5, 0, -4]}>
          <mesh position={[0, 1.8, 0]} castShadow={castShadow}>
            <cylinderGeometry args={[0.32, 0.5, 3.6, 8]} />
            <meshStandardMaterial color="#3c434a" roughness={0.45} metalness={0.72} />
          </mesh>
          <group ref={radarDishRef} position={[0, 3.85, 0]}>
            <mesh rotation={[0.45, 0, 0]} castShadow={castShadow}>
              <boxGeometry args={[2.5, 1.05, 0.22]} />
              <meshStandardMaterial color="#67707a" roughness={0.38} metalness={0.75} />
            </mesh>
          </group>
        </group>
      </group>
      {/* Outpost Sandbags & Crates */}
      <mesh position={[5.75, aegisY + 0.5, -32.8]} castShadow={castShadow} receiveShadow>
        <boxGeometry args={[4.5, 0.95, 1.0]} />
        <meshStandardMaterial color="#8f7d5d" roughness={0.94} />
      </mesh>
      <mesh position={[-18.4, aegisY + 0.65, -35.4]} castShadow={castShadow} receiveShadow>
        <boxGeometry args={[2.0, 1.3, 2.0]} />
        <meshStandardMaterial map={textures.crateWood} roughness={0.8} />
      </mesh>

      {/* ==================== 2. PORT MERIDIAN (SMALL MODERN CITY) ==================== */}
      <HollowBuilding
        x={-106}
        y={cityY}
        z={26}
        halfW={5.5}
        halfD={4.5}
        height={9.2}
        wallColor="#959ca3"
        roofColor="#3f464d"
        concreteTex={textures.concreteSlab}
        metalTex={textures.corrugatedMetal}
        castShadow={castShadow}
        openNorth={false}
        openSouth
        hasGlassFront
      />
      <HollowBuilding
        x={-90}
        y={cityY}
        z={44}
        halfW={6.5}
        halfD={4.5}
        height={6.6}
        wallColor="#8a9299"
        roofColor="#3a4148"
        concreteTex={textures.concreteSlab}
        metalTex={textures.corrugatedMetal}
        castShadow={castShadow}
        openNorth
        openSouth
        hasGlassFront
      />
      <HollowBuilding
        x={-85}
        y={cityY}
        z={24}
        halfW={4.5}
        halfD={4.0}
        height={7.0}
        wallColor="#a3aab0"
        roofColor="#464d55"
        concreteTex={textures.concreteSlab}
        metalTex={textures.corrugatedMetal}
        castShadow={castShadow}
        openNorth={false}
        openSouth
        hasGlassFront
      />

      {/* ==================== 3. CEDARWOOD VILLAS (RESIDENTIAL) ==================== */}
      <HollowBuilding
        x={-33}
        y={resY}
        z={44}
        halfW={4.2}
        halfD={3.6}
        height={3.2}
        wallColor="#c4b89f"
        roofColor="#7a4435"
        concreteTex={textures.concreteSlab}
        metalTex={textures.corrugatedMetal}
        castShadow={castShadow}
        openNorth={false}
        openSouth
        isPitched
      />
      <HollowBuilding
        x={-16}
        y={resY}
        z={48}
        halfW={4.2}
        halfD={3.6}
        height={3.2}
        wallColor="#b5beae"
        roofColor="#4b5a68"
        concreteTex={textures.concreteSlab}
        metalTex={textures.corrugatedMetal}
        castShadow={castShadow}
        openNorth
        openSouth={false}
        isPitched
      />
      <HollowBuilding
        x={-25}
        y={resY}
        z={60}
        halfW={4.6}
        halfD={3.4}
        height={3.2}
        wallColor="#cbb89d"
        roofColor="#6c4d3b"
        concreteTex={textures.concreteSlab}
        metalTex={textures.corrugatedMetal}
        castShadow={castShadow}
        openNorth
        openSouth={false}
        isPitched
      />

      {/* ==================== 4. IRONWORKS YARD (INDUSTRIAL AREA) ==================== */}
      <group position={[108, indY, 36]}>
        <mesh position={[0, 0.1, 0]} receiveShadow>
          <boxGeometry args={[15.4, 0.2, 19.0]} />
          <meshStandardMaterial map={textures.concreteSlab} color="#767a76" roughness={0.9} />
        </mesh>
        <mesh position={[-7, 2.6, 0]} castShadow={castShadow} receiveShadow>
          <boxGeometry args={[0.4, 5.0, 18.0]} />
          <meshStandardMaterial map={textures.corrugatedMetal} color="#545d66" roughness={0.48} metalness={0.62} />
        </mesh>
        <mesh position={[7, 2.6, 0]} castShadow={castShadow} receiveShadow>
          <boxGeometry args={[0.4, 5.0, 18.0]} />
          <meshStandardMaterial map={textures.corrugatedMetal} color="#545d66" roughness={0.48} metalness={0.62} />
        </mesh>
        <mesh position={[0, 2.6, 9]} castShadow={castShadow} receiveShadow>
          <boxGeometry args={[14.4, 5.0, 0.4]} />
          <meshStandardMaterial map={textures.corrugatedMetal} color="#4d555e" roughness={0.48} metalness={0.62} />
        </mesh>
        <mesh position={[-3.7, 5.7, 0]} rotation={[0, 0, 0.22]} castShadow={castShadow}>
          <boxGeometry args={[7.8, 0.25, 18.6]} />
          <meshStandardMaterial map={textures.corrugatedMetal} color="#3d444b" roughness={0.42} metalness={0.7} />
        </mesh>
        <mesh position={[3.7, 5.7, 0]} rotation={[0, 0, -0.22]} castShadow={castShadow}>
          <boxGeometry args={[7.8, 0.25, 18.6]} />
          <meshStandardMaterial map={textures.corrugatedMetal} color="#3d444b" roughness={0.42} metalness={0.7} />
        </mesh>
      </group>
      {/* Shipping Containers & Industrial Silos */}
      <mesh position={[94.6, indY + 1.4, 25.2]} castShadow={castShadow} receiveShadow>
        <boxGeometry args={[3.0, 2.8, 6.4]} />
        <meshStandardMaterial map={textures.corrugatedMetal} color="#8c4432" roughness={0.55} metalness={0.48} />
      </mesh>
      <mesh position={[94.6, indY + 1.4, 34.2]} castShadow={castShadow} receiveShadow>
        <boxGeometry args={[3.0, 2.8, 6.4]} />
        <meshStandardMaterial map={textures.corrugatedMetal} color="#34566e" roughness={0.55} metalness={0.48} />
      </mesh>
      {[24, 31].map((sz, idx) => (
        <mesh key={idx} position={[121, indY + 3.7, sz]} castShadow={castShadow}>
          <cylinderGeometry args={[2.2, 2.2, 7.4, 16]} />
          <meshStandardMaterial color="#7d848b" roughness={0.36} metalness={0.72} />
        </mesh>
      ))}

      {/* ==================== 5. OLD MILL RUINS (ABANDONED STRUCTURES) ==================== */}
      <group position={[92, millY, -74]}>
        <mesh position={[-1.5, 1.6, -4]} castShadow={castShadow} receiveShadow>
          <boxGeometry args={[7.0, 3.2, 0.6]} />
          <meshStandardMaterial map={textures.concreteSlab} color="#7b766c" roughness={0.94} />
        </mesh>
        <mesh position={[-4.6, 1.8, 0]} castShadow={castShadow} receiveShadow>
          <boxGeometry args={[0.6, 3.6, 8.0]} />
          <meshStandardMaterial map={textures.concreteSlab} color="#726d64" roughness={0.94} />
        </mesh>
        <mesh position={[4.6, 1.2, 1]} castShadow={castShadow} receiveShadow>
          <boxGeometry args={[0.6, 2.4, 5.5]} />
          <meshStandardMaterial map={textures.concreteSlab} color="#726d64" roughness={0.94} />
        </mesh>
      </group>

      {/* ==================== 6. SUNBREAK BEACH PIER ==================== */}
      <group position={[-64, 1.0, 169]}>
        <mesh position={[0, 0.3, 0]} castShadow={castShadow} receiveShadow>
          <boxGeometry args={[4.0, 0.22, 26.0]} />
          <meshStandardMaterial map={textures.crateWood} color="#765f43" roughness={0.86} />
        </mesh>
        {[-10, -4, 2, 8, 12].map((pz) => (
          <group key={pz}>
            <mesh position={[-1.7, -0.8, pz]} castShadow={castShadow}>
              <cylinderGeometry args={[0.18, 0.2, 2.6, 8]} />
              <meshStandardMaterial color="#4a3a27" roughness={0.9} />
            </mesh>
            <mesh position={[1.7, -0.8, pz]} castShadow={castShadow}>
              <cylinderGeometry args={[0.18, 0.2, 2.6, 8]} />
              <meshStandardMaterial color="#4a3a27" roughness={0.9} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ==================== 7. SILVERWIND RIVER BRIDGES ==================== */}
      {ISLAND_BRIDGES.map((br) => (
        <group key={br.id} position={[br.x, br.deckY, br.z]}>
          {/* Main Reinforced Deck */}
          <mesh position={[0, 0, 0]} castShadow={castShadow} receiveShadow>
            <boxGeometry args={[br.length, 0.36, br.width]} />
            <meshStandardMaterial map={textures.concreteSlab} color="#7c8084" roughness={0.84} />
          </mesh>
          {/* Steel Under-Girders */}
          <mesh position={[0, -0.65, -br.width * 0.36]} castShadow={castShadow}>
            <boxGeometry args={[br.length - 1, 0.9, 0.45]} />
            <meshStandardMaterial color="#3c444c" roughness={0.45} metalness={0.72} />
          </mesh>
          <mesh position={[0, -0.65, br.width * 0.36]} castShadow={castShadow}>
            <boxGeometry args={[br.length - 1, 0.9, 0.45]} />
            <meshStandardMaterial color="#3c444c" roughness={0.45} metalness={0.72} />
          </mesh>
          {/* Side Safety Parapets */}
          <mesh position={[0, 0.65, -br.width / 2 + 0.16]} castShadow={castShadow}>
            <boxGeometry args={[br.length, 1.05, 0.3]} />
            <meshStandardMaterial color="#585e64" roughness={0.65} metalness={0.35} />
          </mesh>
          <mesh position={[0, 0.65, br.width / 2 - 0.16]} castShadow={castShadow}>
            <boxGeometry args={[br.length, 1.05, 0.3]} />
            <meshStandardMaterial color="#585e64" roughness={0.65} metalness={0.35} />
          </mesh>
          {/* Bridge Support Piers into Riverbed */}
          {[-7.5, 7.5].map((px) => (
            <mesh key={px} position={[px, -6.5, 0]} castShadow={castShadow}>
              <boxGeometry args={[1.4, 12.0, br.width - 1.2]} />
              <meshStandardMaterial color="#676b6f" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}

      {/* ==================== 8. INTERACTIVE WORLD LOOT PICKUPS ==================== */}
      {initialLootSnapshot.map((item) => {
        const badgeColor =
          item.type === 'weapon'
            ? '#f59e0b'
            : item.type === 'medkit' || item.type === 'bandage'
              ? '#10b981'
              : item.type === 'armor'
                ? '#3b82f6'
                : item.type === 'backpack'
                  ? '#a855f7'
                  : '#eab308';
        return (
          <group
            key={item.id}
            ref={(el) => {
              lootMeshRefs.current[item.id] = el;
            }}
            position={[item.x, item.y + 0.25, item.z]}
          >
            {/* Glowing Ground Beacon Ring */}
            <mesh position={[0, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.38, 0.52, 18]} />
              <meshBasicMaterial color={badgeColor} transparent opacity={0.85} side={THREE.DoubleSide} />
            </mesh>
            {item.type === 'weapon' ? (
              <mesh castShadow={castShadow}>
                <boxGeometry args={[0.16, 0.18, 0.72]} />
                <meshStandardMaterial color="#2b3036" roughness={0.4} metalness={0.75} />
              </mesh>
            ) : (
              <mesh castShadow={castShadow}>
                <boxGeometry args={[0.42, 0.28, 0.34]} />
                <meshStandardMaterial color={badgeColor} roughness={0.45} metalness={0.3} />
              </mesh>
            )}
          </group>
        );
      })}

      {/* ==================== 9. MULTI-ZONE REACTIVE TACTICAL TARGETS ==================== */}
      {worldData.targets.map((tgt) => (
        <group key={tgt.id} position={[tgt.x, tgt.y, tgt.z]} rotation={[0, tgt.rotY, 0]}>
          <mesh position={[0, 0.08, 0]} receiveShadow>
            <boxGeometry args={[1.2, 0.16, 0.8]} />
            <meshStandardMaterial color="#2a3036" roughness={0.5} metalness={0.75} />
          </mesh>
          <mesh position={[0, 0.55, 0]} castShadow={castShadow}>
            <cylinderGeometry args={[0.07, 0.09, 0.9, 8]} />
            <meshStandardMaterial color="#384047" roughness={0.45} metalness={0.75} />
          </mesh>
          <group
            ref={(el) => {
              targetPivotRefs.current[tgt.id] = el;
            }}
            position={[0, 0.95, 0]}
          >
            {/* Torso Hitbox */}
            <mesh position={[0, 0.45, 0]} castShadow={castShadow} userData={{ hitZone: 'body' }}>
              <boxGeometry args={[0.78, 0.95, 0.08]} />
              <meshStandardMaterial color="#d8dde3" roughness={0.38} metalness={0.62} />
            </mesh>
            {/* Head Hitbox (2.5x/1.85x Headshot Multiplier) */}
            <mesh position={[0, 1.08, 0]} castShadow={castShadow} userData={{ hitZone: 'head' }}>
              <boxGeometry args={[0.36, 0.34, 0.09]} />
              <meshStandardMaterial color="#f59e0b" roughness={0.35} metalness={0.55} />
            </mesh>
            <mesh position={[0, 0.5, 0.048]} userData={{ hitZone: 'body' }}>
              <cylinderGeometry args={[0.18, 0.18, 0.02, 16]} />
              <meshStandardMaterial color="#d97706" roughness={0.4} metalness={0.2} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
