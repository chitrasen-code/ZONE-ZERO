import * as THREE from 'three';

export const ISLAND_SIZE = 640;
export const ISLAND_HALF = ISLAND_SIZE / 2;
export const SEA_LEVEL = 0;

export interface IslandLandmark {
  id: string;
  name: string;
  category: 'Military' | 'City' | 'Residential' | 'Industrial' | 'Coastal' | 'Ruins' | 'Nature';
  x: number;
  z: number;
  padRadius: number;
  blendRadius: number;
  elevation: number;
  flatten: boolean;
}

export interface BridgeSpec {
  id: string;
  name: string;
  x: number;
  z: number;
  length: number; // along X
  width: number; // along Z
  deckY: number;
  rotY: number;
}

export const ISLAND_LANDMARKS: IslandLandmark[] = [
  {
    id: 'fort_aegis',
    name: 'Fort Aegis',
    category: 'Military',
    x: 0,
    z: -42,
    padRadius: 34,
    blendRadius: 20,
    elevation: 11.2,
    flatten: true,
  },
  {
    id: 'port_meridian',
    name: 'Port Meridian',
    category: 'City',
    x: -96,
    z: 36,
    padRadius: 32,
    blendRadius: 18,
    elevation: 6.4,
    flatten: true,
  },
  {
    id: 'cedarwood',
    name: 'Cedarwood Villas',
    category: 'Residential',
    x: -24,
    z: 48,
    padRadius: 28,
    blendRadius: 18,
    elevation: 8.2,
    flatten: true,
  },
  {
    id: 'ironworks',
    name: 'Ironworks Yard',
    category: 'Industrial',
    x: 108,
    z: 34,
    padRadius: 30,
    blendRadius: 18,
    elevation: 7.4,
    flatten: true,
  },
  {
    id: 'sunbreak_beach',
    name: 'Sunbreak Beach',
    category: 'Coastal',
    x: -64,
    z: 146,
    padRadius: 20,
    blendRadius: 22,
    elevation: 1.6,
    flatten: true,
  },
  {
    id: 'old_mill',
    name: 'Old Mill Ruins',
    category: 'Ruins',
    x: 92,
    z: -74,
    padRadius: 18,
    blendRadius: 16,
    elevation: 14.5,
    flatten: true,
  },
  {
    id: 'whispering_pines',
    name: 'Whispering Pines',
    category: 'Nature',
    x: -112,
    z: -74,
    padRadius: 0,
    blendRadius: 0,
    elevation: 14,
    flatten: false,
  },
  {
    id: 'granite_crest',
    name: 'Granite Crest',
    category: 'Nature',
    x: 14,
    z: -146,
    padRadius: 0,
    blendRadius: 0,
    elevation: 46,
    flatten: false,
  },
  {
    id: 'golden_meadows',
    name: 'Golden Meadows',
    category: 'Nature',
    x: 84,
    z: -14,
    padRadius: 0,
    blendRadius: 0,
    elevation: 9,
    flatten: false,
  },
];

// Two tactical bridges spanning Silverwind River
export const ISLAND_BRIDGES: BridgeSpec[] = [
  {
    id: 'north_bridge',
    name: 'North River Crossing',
    x: 42,
    z: -42,
    length: 30,
    width: 8.2,
    deckY: 11.2,
    rotY: 0,
  },
  {
    id: 'south_bridge',
    name: 'Meridian Span',
    x: 36,
    z: 58,
    length: 30,
    width: 8.2,
    deckY: 6.4,
    rotY: 0,
  },
];

// Closed main asphalt road loop connecting major POIs and crossing both river bridges
export const ROAD_CONTROL_POINTS: [number, number][] = [
  [0, -14],
  [24, -42],
  [60, -42],
  [92, -32],
  [108, 4],
  [84, 48],
  [54, 58],
  [18, 58],
  [-24, 24],
  [-66, 22],
  [-96, 62],
  [-64, 118],
  [-26, 92],
  [-12, 22],
];

// Secondary dirt vehicle path toward Old Mill Ruins & North Woods
export const DIRT_PATH_POINTS: [number, number][] = [
  [60, -42],
  [76, -58],
  [92, -74],
  [118, -56],
  [112, -16],
  [108, 4],
];

let cachedRoadCurve: THREE.CatmullRomCurve3 | null = null;
let cachedRoadSamples: THREE.Vector3[] | null = null;
let cachedDirtCurve: THREE.CatmullRomCurve3 | null = null;
let cachedDirtSamples: THREE.Vector3[] | null = null;

export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hash2D(ix: number, iz: number): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise2D(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);

  const a = hash2D(ix, iz);
  const b = hash2D(ix + 1, iz);
  const c = hash2D(ix, iz + 1);
  const d = hash2D(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function fbm2D(x: number, z: number, octaves = 4): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1.0;
  for (let i = 0; i < octaves; i++) {
    value += amp * (valueNoise2D(x * freq, z * freq) * 2 - 1);
    freq *= 2.04;
    amp *= 0.48;
  }
  return value;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Silverwind River centerline X coordinate as a function of Z.
 */
export function getRiverCenterX(z: number): number {
  return 38 + Math.sin(z * 0.018) * 18 + Math.cos(z * 0.008) * 8;
}

export function getRiverDistance(x: number, z: number): number {
  if (z < -118 || z > 195) return 999;
  const cx = getRiverCenterX(z);
  return Math.abs(x - cx);
}

function getRawIslandHeight(x: number, z: number): number {
  const dist = Math.hypot(x * 0.94, z * 1.02);
  const angle = Math.atan2(z, x);

  const coastWarp =
    Math.sin(angle * 3.0 + 0.5) * 20 +
    Math.cos(angle * 5.0 - 0.9) * 11 +
    fbm2D(x * 0.01, z * 0.01, 2) * 22;

  const islandRadius = 228 + coastWarp;
  const coastMask = 1 - smoothstep(islandRadius - 42, islandRadius + 10, dist);
  if (coastMask <= 0.001) return -5.0;

  // Rolling meadow & forest elevation
  const rolling =
    7.8 +
    fbm2D(x * 0.009 + 3.4, z * 0.009 - 2.1, 4) * 11.5 +
    fbm2D(x * 0.025, z * 0.025, 2) * 2.4;

  // Granite Crest Mountain Peaks (North & North-West & Far-East)
  const northPeak =
    Math.exp(-Math.pow((z + 152) / 48, 2) - Math.pow((x - 14) / 92, 2)) * 44;
  const nwPeak =
    Math.exp(-Math.pow((z + 128) / 42, 2) - Math.pow((x + 122) / 52, 2)) * 34;
  const eastPeak =
    Math.exp(-Math.pow((z + 10) / 40, 2) - Math.pow((x - 168) / 42, 2)) * 28;

  const mountainDetail =
    (northPeak + nwPeak + eastPeak) *
    (0.76 + 0.36 * Math.abs(fbm2D(x * 0.022, z * 0.022, 3)));

  // Southern coastal slope down to Sunbreak Beach
  const southBeachSlope =
    Math.exp(-Math.pow((z - 155) / 56, 2) - Math.pow((x + 48) / 88, 2)) * 7.5;

  let landHeight = Math.max(0.3, rolling + mountainDetail - southBeachSlope);

  // Carve Silverwind River channel (z from -115 to southern sea)
  if (z > -115 && z < 210) {
    const rDist = getRiverDistance(x, z);
    const channelHalfWidth = 6.2;
    const bankWidth = 14.5;
    if (rDist < bankWidth) {
      const bankFactor = 1 - smoothstep(channelHalfWidth, bankWidth, rDist);
      const riverBedY = -2.2;
      landHeight = landHeight + (riverBedY - landHeight) * bankFactor;
    }
  }

  const seabed = -5.0;
  return seabed + (landHeight - seabed) * coastMask;
}

export function getTerrainHeight(x: number, z: number): number {
  let h = getRawIslandHeight(x, z);

  for (let i = 0; i < ISLAND_LANDMARKS.length; i++) {
    const pad = ISLAND_LANDMARKS[i];
    if (!pad.flatten) continue;
    const d = Math.hypot(x - pad.x, z - pad.z);
    if (d < pad.padRadius + pad.blendRadius) {
      const w = 1 - smoothstep(pad.padRadius, pad.padRadius + pad.blendRadius, d);
      h = h + (pad.elevation - h) * w;
    }
  }

  return h;
}

/**
 * Returns the walkable floor height including river bridge decks when the player is on a bridge.
 */
export function getWalkableHeight(x: number, z: number, currentFeetY: number): number {
  const terrainY = getTerrainHeight(x, z);

  for (let i = 0; i < ISLAND_BRIDGES.length; i++) {
    const br = ISLAND_BRIDGES[i];
    const halfL = br.length / 2;
    const halfW = br.width / 2;
    if (Math.abs(x - br.x) <= halfL && Math.abs(z - br.z) <= halfW) {
      // Snap onto bridge deck if approaching from road level or already above/near deck
      if (currentFeetY >= br.deckY - 2.6 || terrainY >= br.deckY - 1.5) {
        return Math.max(terrainY, br.deckY + 0.16);
      }
    }
  }

  // Coastal pier deck at Sunbreak Beach (-64, z: 162..182)
  if (Math.abs(x + 64) <= 2.1 && z >= 156 && z <= 182) {
    if (currentFeetY >= 0.4) {
      return Math.max(terrainY, 1.4);
    }
  }

  return terrainY;
}

export function getTerrainNormal(x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
  const eps = 0.85;
  const hL = getTerrainHeight(x - eps, z);
  const hR = getTerrainHeight(x + eps, z);
  const hD = getTerrainHeight(x, z - eps);
  const hU = getTerrainHeight(x, z + eps);
  out.set(hL - hR, 2 * eps, hD - hU).normalize();
  return out;
}

export function getRoadCurve(): THREE.CatmullRomCurve3 {
  if (cachedRoadCurve) return cachedRoadCurve;
  const pts = ROAD_CONTROL_POINTS.map(([rx, rz]) => {
    const y = getWalkableHeight(rx, rz, 20);
    return new THREE.Vector3(rx, y, rz);
  });
  cachedRoadCurve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.45);
  return cachedRoadCurve;
}

export function getRoadSamples(segments = 320): THREE.Vector3[] {
  if (cachedRoadSamples && cachedRoadSamples.length === segments + 1) {
    return cachedRoadSamples;
  }
  const curve = getRoadCurve();
  const samples: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const p = curve.getPointAt(i / segments);
    p.y = getWalkableHeight(p.x, p.z, 20);
    samples.push(p);
  }
  cachedRoadSamples = samples;
  return samples;
}

export function getDirtCurve(): THREE.CatmullRomCurve3 {
  if (cachedDirtCurve) return cachedDirtCurve;
  const pts = DIRT_PATH_POINTS.map(([rx, rz]) => {
    const y = getTerrainHeight(rx, rz);
    return new THREE.Vector3(rx, y, rz);
  });
  cachedDirtCurve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.45);
  return cachedDirtCurve;
}

export function getDirtSamples(segments = 100): THREE.Vector3[] {
  if (cachedDirtSamples && cachedDirtSamples.length === segments + 1) {
    return cachedDirtSamples;
  }
  const curve = getDirtCurve();
  const samples: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const p = curve.getPointAt(i / segments);
    p.y = getTerrainHeight(p.x, p.z);
    samples.push(p);
  }
  cachedDirtSamples = samples;
  return samples;
}

export function getRoadDistance(x: number, z: number): number {
  const samples = getRoadSamples();
  let minDistSq = Infinity;
  for (let i = 0; i < samples.length; i += 2) {
    const dx = x - samples[i].x;
    const dz = z - samples[i].z;
    const dSq = dx * dx + dz * dz;
    if (dSq < minDistSq) minDistSq = dSq;
  }
  return Math.sqrt(minDistSq);
}

export function getSurfaceType(x: number, z: number): 'grass' | 'road' | 'concrete' | 'sand' {
  for (const br of ISLAND_BRIDGES) {
    if (Math.abs(x - br.x) <= br.length / 2 && Math.abs(z - br.z) <= br.width / 2) {
      return 'concrete';
    }
  }
  const h = getTerrainHeight(x, z);
  if (h < 1.8) return 'sand';
  if (getRoadDistance(x, z) < 3.8) return 'road';
  for (const pad of ISLAND_LANDMARKS) {
    if (pad.flatten && Math.hypot(x - pad.x, z - pad.z) < 16) {
      return 'concrete';
    }
  }
  return 'grass';
}
