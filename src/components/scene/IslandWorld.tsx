import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createProceduralTextureSet } from '../../world/proceduralTextures';
import {
  createSeededRandom,
  getDirtSamples,
  getRiverDistance,
  getRoadDistance,
  getRoadSamples,
  getTerrainHeight,
  getTerrainNormal,
  getWalkableHeight,
  ISLAND_SIZE,
} from '../../world/terrainMath';
import { getWorldStaticData } from '../../world/collisionData';

interface IslandWorldProps {
  foliageDensity: 'high' | 'medium';
  shadowsEnabled: boolean;
  isSoftwareGl: boolean;
}

function buildPathRibbon(
  samples: THREE.Vector3[],
  halfWidth: number,
  uvScale: number,
  yOffset: number,
): THREE.BufferGeometry {
  const count = samples.length;
  const positions = new Float32Array(count * 2 * 3);
  const uvs = new Float32Array(count * 2 * 2);
  const indices: number[] = [];

  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();
  let accumDist = 0;

  for (let i = 0; i < count; i++) {
    const curr = samples[i];
    const next = samples[Math.min(count - 1, i + 1)];
    const prev = samples[Math.max(0, i - 1)];

    tangent.subVectors(next, prev).setY(0).normalize();
    if (tangent.lengthSq() < 0.001) tangent.set(0, 0, 1);
    side.set(-tangent.z, 0, tangent.x);

    if (i > 0) {
      accumDist += curr.distanceTo(samples[i - 1]);
    }

    const lx = curr.x - side.x * halfWidth;
    const lz = curr.z - side.z * halfWidth;
    const rx = curr.x + side.x * halfWidth;
    const rz = curr.z + side.z * halfWidth;

    const ly = Math.max(getWalkableHeight(lx, lz, 20), curr.y) + yOffset;
    const ry = Math.max(getWalkableHeight(rx, rz, 20), curr.y) + yOffset;

    positions[i * 6 + 0] = lx;
    positions[i * 6 + 1] = ly;
    positions[i * 6 + 2] = lz;

    positions[i * 6 + 3] = rx;
    positions[i * 6 + 4] = ry;
    positions[i * 6 + 5] = rz;

    const vCoord = accumDist * uvScale;
    uvs[i * 4 + 0] = 0;
    uvs[i * 4 + 1] = vCoord;
    uvs[i * 4 + 2] = 1;
    uvs[i * 4 + 3] = vCoord;

    if (i < count - 1) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

export function IslandWorld({
  foliageDensity,
  shadowsEnabled,
  isSoftwareGl,
}: IslandWorldProps) {
  const { gl } = useThree();
  const maxAniso = gl.capabilities.getMaxAnisotropy();
  const textures = useMemo(() => createProceduralTextureSet(maxAniso), [maxAniso]);

  useEffect(() => () => textures.dispose(), [textures]);

  const worldData = useMemo(() => getWorldStaticData(), []);
  const castShadow = shadowsEnabled && !isSoftwareGl;

  // 1. 640m Island Terrain with Riverbed, Sand, Meadows, Forests & Granite Crest Mountains
  const terrainGeometry = useMemo(() => {
    const segs = 216;
    const geo = new THREE.PlaneGeometry(ISLAND_SIZE, ISLAND_SIZE, segs, segs);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const normalVec = new THREE.Vector3();
    const cSand = new THREE.Color('#c8b68c');
    const cRiverStone = new THREE.Color('#7a7365');
    const cGrass = new THREE.Color('#4f6a3b');
    const cMeadow = new THREE.Color('#6b8447');
    const cDirt = new THREE.Color('#6b5e4a');
    const cRock = new THREE.Color('#626569');
    const cPeak = new THREE.Color('#868b90');
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = getTerrainHeight(x, z);
      pos.setY(i, y);

      getTerrainNormal(x, z, normalVec);
      const slope = 1 - normalVec.y;
      const roadDist = getRoadDistance(x, z);
      const riverDist = getRiverDistance(x, z);

      if (riverDist < 12 && y < 2.2) {
        tmp.copy(cRiverStone).lerp(cSand, Math.max(0, y / 2.2) * 0.5);
      } else if (y < 2.0) {
        tmp.copy(cSand);
      } else if (slope > 0.24 || y > 28) {
        const rockMix = Math.min(1, (slope - 0.18) * 3.4);
        tmp.copy(cGrass).lerp(y > 38 ? cPeak : cRock, Math.max(rockMix, y > 28 ? 0.85 : 0));
      } else {
        const patch = 0.5 + 0.5 * Math.sin(x * 0.06) * Math.cos(z * 0.06);
        tmp.copy(cGrass).lerp(cMeadow, patch * 0.65);
        if (roadDist < 5.8) {
          const shoulder = 1 - Math.max(0, (roadDist - 3.4) / 2.4);
          tmp.lerp(cDirt, shoulder * 0.72);
        }
      }

      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }, []);

  // 2. Main Asphalt Highway Loop + Secondary Dirt Vehicle Trail
  const roadGeometry = useMemo(() => buildPathRibbon(getRoadSamples(320), 3.3, 0.05, 0.09), []);
  const dirtGeometry = useMemo(() => buildPathRibbon(getDirtSamples(100), 2.3, 0.07, 0.07), []);

  // 3. Instanced Pine & Oak Trees + Rocks + Grass Tufts
  const pineTrees = useMemo(() => worldData.trees.filter((t) => t.isPine), [worldData]);
  const oakTrees = useMemo(() => worldData.trees.filter((t) => !t.isPine), [worldData]);

  const pineTrunkRef = useRef<THREE.InstancedMesh>(null);
  const pineLowerConeRef = useRef<THREE.InstancedMesh>(null);
  const pineUpperConeRef = useRef<THREE.InstancedMesh>(null);
  const oakTrunkRef = useRef<THREE.InstancedMesh>(null);
  const oakCrownRef = useRef<THREE.InstancedMesh>(null);
  const rockRef = useRef<THREE.InstancedMesh>(null);
  const grassRef = useRef<THREE.InstancedMesh>(null);

  const grassInstances = useMemo(() => {
    const count = foliageDensity === 'high' ? 1200 : 520;
    const rng = createSeededRandom(90125);
    const items: { x: number; y: number; z: number; s: number; ry: number; color: number }[] = [];
    const palette = [0x58783e, 0x678846, 0x4b6a35, 0x738e4a];
    let tries = 0;
    while (items.length < count && tries < count * 5) {
      tries++;
      const x = (rng() - 0.5) * 440;
      const z = (rng() - 0.5) * 440;
      const y = getTerrainHeight(x, z);
      if (y < 2.2 || y > 24) continue;
      if (getRiverDistance(x, z) < 9.5) continue;
      if (getRoadDistance(x, z) < 4.8) continue;
      items.push({
        x,
        y,
        z,
        s: 0.75 + rng() * 0.65,
        ry: rng() * Math.PI * 2,
        color: palette[Math.floor(rng() * palette.length)],
      });
    }
    return items;
  }, [foliageDensity]);

  useEffect(() => {
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    if (pineTrunkRef.current && pineLowerConeRef.current && pineUpperConeRef.current) {
      pineTrees.forEach((t, i) => {
        dummy.position.set(t.x, t.y + 1.3 * t.scale, t.z);
        dummy.rotation.set(0, t.rotationY, 0);
        dummy.scale.set(t.scale, t.scale, t.scale);
        dummy.updateMatrix();
        pineTrunkRef.current!.setMatrixAt(i, dummy.matrix);

        dummy.position.set(t.x, t.y + 3.1 * t.scale, t.z);
        dummy.scale.set(t.scale, t.scale, t.scale);
        dummy.updateMatrix();
        pineLowerConeRef.current!.setMatrixAt(i, dummy.matrix);
        color.setHex(t.tintHex);
        pineLowerConeRef.current!.setColorAt(i, color);

        dummy.position.set(t.x, t.y + 4.9 * t.scale, t.z);
        dummy.scale.set(t.scale * 0.76, t.scale * 0.85, t.scale * 0.76);
        dummy.updateMatrix();
        pineUpperConeRef.current!.setMatrixAt(i, dummy.matrix);
        color.setHex(t.tintHex).offsetHSL(0, 0, 0.03);
        pineUpperConeRef.current!.setColorAt(i, color);
      });
      pineTrunkRef.current.instanceMatrix.needsUpdate = true;
      pineLowerConeRef.current.instanceMatrix.needsUpdate = true;
      pineUpperConeRef.current.instanceMatrix.needsUpdate = true;
      if (pineLowerConeRef.current.instanceColor) pineLowerConeRef.current.instanceColor.needsUpdate = true;
      if (pineUpperConeRef.current.instanceColor) pineUpperConeRef.current.instanceColor.needsUpdate = true;
      pineTrunkRef.current.computeBoundingSphere();
      pineLowerConeRef.current.computeBoundingSphere();
      pineUpperConeRef.current.computeBoundingSphere();
    }

    if (oakTrunkRef.current && oakCrownRef.current) {
      oakTrees.forEach((t, i) => {
        dummy.position.set(t.x, t.y + 1.45 * t.scale, t.z);
        dummy.rotation.set(0, t.rotationY, 0);
        dummy.scale.set(t.scale, t.scale, t.scale);
        dummy.updateMatrix();
        oakTrunkRef.current!.setMatrixAt(i, dummy.matrix);

        dummy.position.set(t.x, t.y + 3.55 * t.scale, t.z);
        dummy.scale.set(t.scale * 1.15, t.scale * 0.92, t.scale * 1.15);
        dummy.updateMatrix();
        oakCrownRef.current!.setMatrixAt(i, dummy.matrix);
        color.setHex(t.tintHex);
        oakCrownRef.current!.setColorAt(i, color);
      });
      oakTrunkRef.current.instanceMatrix.needsUpdate = true;
      oakCrownRef.current.instanceMatrix.needsUpdate = true;
      if (oakCrownRef.current.instanceColor) oakCrownRef.current.instanceColor.needsUpdate = true;
      oakTrunkRef.current.computeBoundingSphere();
      oakCrownRef.current.computeBoundingSphere();
    }

    if (rockRef.current) {
      worldData.rocks.forEach((r, i) => {
        dummy.position.set(r.x, r.y, r.z);
        dummy.rotation.set(r.rotX, r.rotY, 0);
        dummy.scale.set(r.sx, r.sy, r.sz);
        dummy.updateMatrix();
        rockRef.current!.setMatrixAt(i, dummy.matrix);
        color.setHex(r.tintHex);
        rockRef.current!.setColorAt(i, color);
      });
      rockRef.current.instanceMatrix.needsUpdate = true;
      if (rockRef.current.instanceColor) rockRef.current.instanceColor.needsUpdate = true;
      rockRef.current.computeBoundingSphere();
    }
  }, [pineTrees, oakTrees, worldData.rocks]);

  useEffect(() => {
    if (!grassRef.current) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    grassInstances.forEach((g, i) => {
      dummy.position.set(g.x, g.y + 0.22 * g.s, g.z);
      dummy.rotation.set(0, g.ry, 0);
      dummy.scale.set(g.s, g.s, g.s);
      dummy.updateMatrix();
      grassRef.current!.setMatrixAt(i, dummy.matrix);
      color.setHex(g.color);
      grassRef.current!.setColorAt(i, color);
    });
    grassRef.current.instanceMatrix.needsUpdate = true;
    if (grassRef.current.instanceColor) grassRef.current.instanceColor.needsUpdate = true;
    grassRef.current.computeBoundingSphere();
  }, [grassInstances]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    textures.oceanBump.offset.x = (textures.oceanBump.offset.x + dt * 0.014) % 1;
    textures.oceanBump.offset.y = (textures.oceanBump.offset.y + dt * 0.009) % 1;
  });

  return (
    <group>
      {/* 640m Island Terrain */}
      <mesh geometry={terrainGeometry} receiveShadow>
        <meshStandardMaterial
          vertexColors
          map={textures.terrainDetail}
          roughness={0.92}
          metalness={0.02}
        />
      </mesh>

      {/* Main Asphalt Road Loop */}
      <mesh geometry={roadGeometry} receiveShadow>
        <meshStandardMaterial
          map={textures.asphaltRoad}
          roughness={0.86}
          metalness={0.04}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>

      {/* Secondary Dirt Vehicle Trail */}
      <mesh geometry={dirtGeometry} receiveShadow>
        <meshStandardMaterial
          color="#73634b"
          roughness={0.95}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>

      {/* Surrounding Ocean & River Water Plane at Sea Level (y=0) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, 0]} receiveShadow>
        <planeGeometry args={[2000, 2000, 1, 1]} />
        <meshStandardMaterial
          color="#1e4d68"
          roughness={0.22}
          metalness={0.35}
          bumpMap={textures.oceanBump}
          bumpScale={0.18}
        />
      </mesh>

      {/* Instanced Pine Trees */}
      <instancedMesh
        ref={pineTrunkRef}
        args={[undefined, undefined, pineTrees.length]}
        castShadow={castShadow}
        receiveShadow
      >
        <cylinderGeometry args={[0.18, 0.3, 2.7, 7]} />
        <meshStandardMaterial color="#4e3a29" roughness={0.92} />
      </instancedMesh>
      <instancedMesh
        ref={pineLowerConeRef}
        args={[undefined, undefined, pineTrees.length]}
        castShadow={castShadow}
        receiveShadow
      >
        <coneGeometry args={[1.65, 3.1, 8]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh
        ref={pineUpperConeRef}
        args={[undefined, undefined, pineTrees.length]}
        castShadow={castShadow}
        receiveShadow
      >
        <coneGeometry args={[1.25, 2.7, 8]} />
        <meshStandardMaterial roughness={0.82} />
      </instancedMesh>

      {/* Instanced Oak Trees */}
      <instancedMesh
        ref={oakTrunkRef}
        args={[undefined, undefined, oakTrees.length]}
        castShadow={castShadow}
        receiveShadow
      >
        <cylinderGeometry args={[0.2, 0.34, 3.0, 7]} />
        <meshStandardMaterial color="#58432f" roughness={0.9} />
      </instancedMesh>
      <instancedMesh
        ref={oakCrownRef}
        args={[undefined, undefined, oakTrees.length]}
        castShadow={castShadow}
        receiveShadow
      >
        <dodecahedronGeometry args={[1.65, 1]} />
        <meshStandardMaterial roughness={0.86} />
      </instancedMesh>

      {/* Instanced Rocks & Boulders */}
      <instancedMesh
        ref={rockRef}
        args={[undefined, undefined, worldData.rocks.length]}
        castShadow={castShadow}
        receiveShadow
      >
        <dodecahedronGeometry args={[1.0, 0]} />
        <meshStandardMaterial roughness={0.88} metalness={0.05} />
      </instancedMesh>

      {/* Instanced Meadow Grass Tufts */}
      <instancedMesh ref={grassRef} args={[undefined, undefined, grassInstances.length]}>
        <coneGeometry args={[0.28, 0.55, 5]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
    </group>
  );
}
