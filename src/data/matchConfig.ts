import { WeaponId } from '../types/game';

export interface ZonePhaseConfig {
  phase: number;
  waitSec: number;
  shrinkSec: number;
  targetRadius: number;
  damagePerSec: number;
}

export const ZONE_PHASES: ZonePhaseConfig[] = [
  { phase: 1, waitSec: 22, shrinkSec: 20, targetRadius: 175, damagePerSec: 2 },
  { phase: 2, waitSec: 18, shrinkSec: 18, targetRadius: 112, damagePerSec: 4 },
  { phase: 3, waitSec: 16, shrinkSec: 16, targetRadius: 62, damagePerSec: 7 },
  { phase: 4, waitSec: 14, shrinkSec: 14, targetRadius: 28, damagePerSec: 11 },
  { phase: 5, waitSec: 10, shrinkSec: 14, targetRadius: 9, damagePerSec: 16 },
];

export const INITIAL_BLUE_RADIUS = 270;
export const BASE_BACKPACK_CAPACITY_KG = 22.0;
export const UPGRADED_BACKPACK_CAPACITY_KG = 36.0;
export const TOTAL_MATCH_COMBATANTS = 12; // 1 player + 11 AI opponents
export const AIRCRAFT_ALTITUDE = 138;
export const AIRCRAFT_SPEED_MPS = 28;
export const PREFLIGHT_COUNTDOWN_SEC = 3.5;

export const AI_CALLSIGNS: string[] = [
  'KESTREL-02',
  'VIPER-03',
  'NOMAD-04',
  'WARDEN-05',
  'FALCON-06',
  'JACKAL-07',
  'STRIKER-08',
  'SPECTRE-09',
  'SENTINEL-10',
  'OUTLAW-11',
  'RAVEN-12',
];

export const AI_DROP_ZONES: { x: number; z: number; weapon: WeaponId }[] = [
  { x: -18, z: -36, weapon: 'vx47' }, // Fort Aegis
  { x: 16, z: -48, weapon: 'k9smg' }, // Fort Aegis East
  { x: -92, z: 34, weapon: 'sg12' }, // Port Meridian
  { x: -102, z: 42, weapon: 'p45' }, // Port Meridian South
  { x: -26, z: 46, weapon: 'vx47' }, // Cedarwood Villas
  { x: -14, z: 58, weapon: 'k9smg' }, // Cedarwood South
  { x: 104, z: 30, weapon: 'sg12' }, // Ironworks Yard
  { x: 114, z: 42, weapon: 'vx47' }, // Ironworks East
  { x: -60, z: 138, weapon: 'k9smg' }, // Sunbreak Beach
  { x: 88, z: -70, weapon: 'lsr90' }, // Old Mill Ruins
  { x: 64, z: -12, weapon: 'vx47' }, // Golden Meadows
];
