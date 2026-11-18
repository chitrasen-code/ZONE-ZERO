import {
  createSeededRandom,
  getRiverDistance,
  getRoadDistance,
  getTerrainHeight,
  ISLAND_BRIDGES,
  ISLAND_LANDMARKS,
} from './terrainMath';

export interface BoxCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
}

export interface CylinderCollider {
  x: number;
  z: number;
  radius: number;
  maxY: number;
}

export interface TreeInstanceData {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotationY: number;
  isPine: boolean;
  tintHex: number;
}

export interface RockInstanceData {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  rotX: number;
  rotY: number;
  tintHex: number;
}

export interface TacticalTargetDef {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
}

export interface WorldStaticData {
  boxColliders: BoxCollider[];
  cylinderColliders: CylinderCollider[];
  trees: TreeInstanceData[];
  rocks: RockInstanceData[];
  targets: TacticalTargetDef[];
}

let cachedWorldData: WorldStaticData | null = null;

function addHollowBuildingColliders(
  out: BoxCollider[],
  cx: number,
  cz: number,
  baseY: number,
  halfW: number,
  halfD: number,
  height: number,
  doorHalfWidth = 1.4,
  openNorth = true,
  openSouth = true,
) {
  const t = 0.25;
  // Side walls
  out.push(
    { minX: cx - halfW - t, maxX: cx - halfW + t, minZ: cz - halfD, maxZ: cz + halfD, minY: baseY, maxY: baseY + height },
    { minX: cx + halfW - t, maxX: cx + halfW + t, minZ: cz - halfD, maxZ: cz + halfD, minY: baseY, maxY: baseY + height },
  );
  // North wall (-Z)
  if (openNorth) {
    out.push(
      { minX: cx - halfW, maxX: cx - doorHalfWidth, minZ: cz - halfD - t, maxZ: cz - halfD + t, minY: baseY, maxY: baseY + height },
      { minX: cx + doorHalfWidth, maxX: cx + halfW, minZ: cz - halfD - t, maxZ: cz - halfD + t, minY: baseY, maxY: baseY + height },
    );
  } else {
    out.push({ minX: cx - halfW, maxX: cx + halfW, minZ: cz - halfD - t, maxZ: cz - halfD + t, minY: baseY, maxY: baseY + height });
  }
  // South wall (+Z)
  if (openSouth) {
    out.push(
      { minX: cx - halfW, maxX: cx - doorHalfWidth, minZ: cz + halfD - t, maxZ: cz + halfD + t, minY: baseY, maxY: baseY + height },
      { minX: cx + doorHalfWidth, maxX: cx + halfW, minZ: cz + halfD - t, maxZ: cz + halfD + t, minY: baseY, maxY: baseY + height },
    );
  } else {
    out.push({ minX: cx - halfW, maxX: cx + halfW, minZ: cz + halfD - t, maxZ: cz + halfD + t, minY: baseY, maxY: baseY + height });
  }
}

function isNearLandmarkPad(x: number, z: number, extraMargin = 4): boolean {
  for (const pad of ISLAND_LANDMARKS) {
    if (!pad.flatten) continue;
    if (Math.hypot(x - pad.x, z - pad.z) < pad.padRadius + extraMargin) {
      return true;
    }
  }
  return false;
}

export function getWorldStaticData(): WorldStaticData {
  if (cachedWorldData) return cachedWorldData;

  const boxColliders: BoxCollider[] = [];
  const cylinderColliders: CylinderCollider[] = [];
  const trees: TreeInstanceData[] = [];
  const rocks: RockInstanceData[] = [];

  // 1. FORT AEGIS (Military Compound at x=0, z=-42)
  const aegisY = getTerrainHeight(0, -42);
  // Command Barracks at (-10, -44)
  addHollowBuildingColliders(boxColliders, -10, -44, aegisY, 6, 4.2, 3.6, 1.4, true, true);
  // Watchtower legs at (14, -40)
  for (const dx of [-1.7, 1.7]) {
    for (const dz of [-1.7, 1.7]) {
      cylinderColliders.push({ x: 14 + dx, z: -40 + dz, radius: 0.35, maxY: aegisY + 6.5 });
    }
  }
  // Outpost sandbag cover & crates
  boxColliders.push(
    { minX: 3.5, maxX: 8.0, minZ: -33.5, maxZ: -32.2, minY: aegisY, maxY: aegisY + 1.2 },
    { minX: -19.5, maxX: -17.3, minZ: -36.5, maxZ: -34.2, minY: aegisY, maxY: aegisY + 1.5 },
  );

  // 2. PORT MERIDIAN (Small Modern City at x=-96, z=36)
  const cityY = getTerrainHeight(-96, 36);
  // City Tower A (North-West Block)
  addHollowBuildingColliders(boxColliders, -106, 26, cityY, 5.5, 4.5, 9.5, 1.5, false, true);
  // City Commercial Hall (South Block)
  addHollowBuildingColliders(boxColliders, -90, 44, cityY, 6.5, 4.5, 6.8, 1.6, true, true);
  // City Office Annex (North-East Block)
  addHollowBuildingColliders(boxColliders, -85, 24, cityY, 4.5, 4.0, 7.2, 1.3, false, true);

  // 3. CEDARWOOD VILLAS (Residential Buildings at x=-24, z=48)
  const resY = getTerrainHeight(-24, 48);
  addHollowBuildingColliders(boxColliders, -33, 44, resY, 4.2, 3.6, 3.4, 1.2, false, true);
  addHollowBuildingColliders(boxColliders, -16, 48, resY, 4.2, 3.6, 3.4, 1.2, true, false);
  addHollowBuildingColliders(boxColliders, -25, 60, resY, 4.6, 3.4, 3.4, 1.2, true, false);

  // 4. IRONWORKS YARD (Industrial Area at x=108, z=34)
  const indY = getTerrainHeight(108, 34);
  // Main Warehouse Hangar (open north bay)
  addHollowBuildingColliders(boxColliders, 108, 36, indY, 7.2, 9.0, 5.2, 4.2, true, false);
  // Shipping Containers
  boxColliders.push(
    { minX: 93, maxX: 96.2, minZ: 22, maxZ: 28.5, minY: indY, maxY: indY + 2.8 },
    { minX: 93, maxX: 96.2, minZ: 31, maxZ: 37.5, minY: indY, maxY: indY + 2.8 },
  );
  // Industrial Fuel Silos
  cylinderColliders.push(
    { x: 121, z: 24, radius: 2.2, maxY: indY + 7.5 },
    { x: 121, z: 31, radius: 2.2, maxY: indY + 7.5 },
  );

  // 5. OLD MILL RUINS (Abandoned Structures at x=92, z=-74)
  const millY = getTerrainHeight(92, -74);
  boxColliders.push(
    { minX: 87, maxX: 94, minZ: -78.4, maxZ: -77.6, minY: millY, maxY: millY + 3.2 },
    { minX: 87, maxX: 87.8, minZ: -78, maxZ: -70, minY: millY, maxY: millY + 3.6 },
    { minX: 96.2, maxX: 97, minZ: -76, maxZ: -70, minY: millY, maxY: millY + 2.4 },
  );

  // 6. Bridge Side Parapets (prevent walking off bridge edges into river)
  for (const br of ISLAND_BRIDGES) {
    const halfL = br.length / 2;
    const halfW = br.width / 2;
    boxColliders.push(
      { minX: br.x - halfL, maxX: br.x + halfL, minZ: br.z - halfW - 0.3, maxZ: br.z - halfW + 0.3, minY: br.deckY, maxY: br.deckY + 1.3 },
      { minX: br.x - halfL, maxX: br.x + halfL, minZ: br.z + halfW - 0.3, maxZ: br.z + halfW + 0.3, minY: br.deckY, maxY: br.deckY + 1.3 },
    );
  }

  // 7. 6 Tactical Multi-Zone Targets (Fort Aegis Firing Lane + Port Meridian + Ironworks)
  const targets: TacticalTargetDef[] = [
    { id: 'tgt-1', label: 'Aegis Alpha', x: -6, y: aegisY, z: -64, rotY: 0.1 },
    { id: 'tgt-2', label: 'Aegis Bravo', x: 4, y: aegisY, z: -70, rotY: -0.05 },
    { id: 'tgt-3', label: 'Aegis Long', x: 16, y: aegisY, z: -76, rotY: -0.18 },
    { id: 'tgt-4', label: 'Meridian CQB', x: -96, y: cityY, z: 30, rotY: 0.35 },
    { id: 'tgt-5', label: 'Cedarwood Lane', x: -24, y: resY, z: 36, rotY: 0.15 },
    { id: 'tgt-6', label: 'Ironworks Yard', x: 102, y: indY, z: 22, rotY: -0.4 },
  ];

  // 8. Whispering Pines & Island Forests (420 trees via InstancedMesh)
  const rng = createSeededRandom(55109);
  const pineTints = [0x2d4a2d, 0x355834, 0x26412a, 0x3c6036, 0x2f4d35];
  const oakTints = [0x4c6b36, 0x5d7a3c, 0x415c2f, 0x677e3e];

  let attempts = 0;
  while (trees.length < 420 && attempts < 4500) {
    attempts++;
    const x = (rng() - 0.5) * 480;
    const z = (rng() - 0.5) * 480;
    const h = getTerrainHeight(x, z);

    if (h < 2.2 || h > 29) continue;
    if (getRiverDistance(x, z) < 12) continue;
    if (getRoadDistance(x, z) < 6.8) continue;
    if (isNearLandmarkPad(x, z, 3)) continue;

    let tooClose = false;
    for (let i = Math.max(0, trees.length - 45); i < trees.length; i++) {
      if (Math.hypot(x - trees[i].x, z - trees[i].z) < 4.8) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    // Extra dense forest in Whispering Pines (NW quadrant)
    const inWhisperingPines = x < -45 && z < -20;
    const isPine = inWhisperingPines || h > 10 || rng() > 0.38;
    const scale = 0.85 + rng() * 0.38;
    const palette = isPine ? pineTints : oakTints;
    const tintHex = palette[Math.floor(rng() * palette.length)];

    trees.push({
      x,
      y: h,
      z,
      scale,
      rotationY: rng() * Math.PI * 2,
      isPine,
      tintHex,
    });

    cylinderColliders.push({
      x,
      z,
      radius: 0.42 * scale,
      maxY: h + 4.5 * scale,
    });
  }

  // 9. Boulders & Granite Outcrops (190 rocks via InstancedMesh)
  const rockTints = [0x6e7377, 0x7c7f7c, 0x5c6064, 0x868278];
  attempts = 0;
  while (rocks.length < 190 && attempts < 2400) {
    attempts++;
    const x = (rng() - 0.5) * 490;
    const z = (rng() - 0.5) * 490;
    const h = getTerrainHeight(x, z);

    if (h < 0.3 || h > 42) continue;
    if (getRiverDistance(x, z) < 9) continue;
    if (getRoadDistance(x, z) < 5.5) continue;
    if (isNearLandmarkPad(x, z, 2)) continue;

    const baseScale = 0.75 + rng() * 1.75;
    const sx = baseScale * (0.85 + rng() * 0.45);
    const sy = baseScale * (0.55 + rng() * 0.45);
    const sz = baseScale * (0.85 + rng() * 0.45);

    rocks.push({
      x,
      y: h - sy * 0.25,
      z,
      sx,
      sy,
      sz,
      rotX: (rng() - 0.5) * 0.4,
      rotY: rng() * Math.PI * 2,
      tintHex: rockTints[Math.floor(rng() * rockTints.length)],
    });

    if (baseScale > 1.3) {
      cylinderColliders.push({
        x,
        z,
        radius: Math.max(sx, sz) * 0.65,
        maxY: h + sy,
      });
    }
  }

  cachedWorldData = {
    boxColliders,
    cylinderColliders,
    trees,
    rocks,
    targets,
  };
  return cachedWorldData;
}

export function resolvePlayerCollisions(
  x: number,
  z: number,
  feetY: number,
  radius = 0.48,
): { x: number; z: number } {
  const world = getWorldStaticData();
  let px = x;
  let pz = z;

  for (let i = 0; i < world.boxColliders.length; i++) {
    const b = world.boxColliders[i];
    if (feetY > b.maxY - 0.1 || feetY + 1.8 < b.minY) continue;

    const closestX = Math.max(b.minX, Math.min(px, b.maxX));
    const closestZ = Math.max(b.minZ, Math.min(pz, b.maxZ));
    const dx = px - closestX;
    const dz = pz - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      if (distSq > 0.00001) {
        const dist = Math.sqrt(distSq);
        const push = radius - dist;
        px += (dx / dist) * push;
        pz += (dz / dist) * push;
      } else {
        const penLeft = Math.abs(px - b.minX);
        const penRight = Math.abs(b.maxX - px);
        const penTop = Math.abs(pz - b.minZ);
        const penBot = Math.abs(b.maxZ - pz);
        const minPen = Math.min(penLeft, penRight, penTop, penBot);
        if (minPen === penLeft) px = b.minX - radius;
        else if (minPen === penRight) px = b.maxX + radius;
        else if (minPen === penTop) pz = b.minZ - radius;
        else pz = b.maxZ + radius;
      }
    }
  }

  for (let i = 0; i < world.cylinderColliders.length; i++) {
    const c = world.cylinderColliders[i];
    if (feetY > c.maxY - 0.1) continue;
    const dx = px - c.x;
    const dz = pz - c.z;
    const minDist = radius + c.radius;
    const distSq = dx * dx + dz * dz;
    if (distSq < minDist * minDist && distSq > 0.00001) {
      const dist = Math.sqrt(distSq);
      const push = minDist - dist;
      px += (dx / dist) * push;
      pz += (dz / dist) * push;
    }
  }

  // Keep player inside the 640m island shoreline
  const maxShoreRadius = 245;
  const distFromCenter = Math.hypot(px, pz);
  if (distFromCenter > maxShoreRadius) {
    const scale = maxShoreRadius / distFromCenter;
    px *= scale;
    pz *= scale;
  }

  return { x: px, z: pz };
}
