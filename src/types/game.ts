export type GameScreen = 'loading' | 'menu' | 'playing' | 'paused';

export type MenuModal = 'none' | 'settings' | 'character' | 'inventory';

export type MatchPhase =
  | 'countdown'
  | 'aircraft'
  | 'skydiving'
  | 'parachuting'
  | 'combat'
  | 'victory'
  | 'eliminated';

export type WeaponId = 'vx47' | 'k9smg' | 'lsr90' | 'sg12' | 'p45';

export type WeaponCategory =
  | 'Assault Rifle'
  | 'Submachine Gun'
  | 'Sniper Rifle'
  | 'Shotgun'
  | 'Pistol';

export type FireMode = 'auto' | 'semi' | 'bolt';

export type CamoId = 'olive' | 'desert' | 'urban' | 'woodland';

export type HelmetId = 'tactical_ops' | 'recon_visor' | 'heavy_ballistic';

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  category: WeaponCategory;
  slotType: 'primary' | 'sidearm';
  fireMode: FireMode;
  caliber: string;
  damage: number;
  headshotMultiplier: number;
  pellets: number;
  fireRateRpm: number;
  magSize: number;
  reserveAmmo: number;
  reloadTimeSec: number;
  recoilPitch: number;
  recoilYaw: number;
  hipSpread: number;
  adsSpread: number;
  adsFovDelta: number;
  range: number;
  bodyColor: string;
  accentColor: string;
  barrelLength: number;
  weightKg: number;
}

export interface CamoPreset {
  id: CamoId;
  name: string;
  uniformHex: string;
  pantsHex: string;
  vestHex: string;
  accentHex: string;
}

export interface HelmetPreset {
  id: HelmetId;
  name: string;
  shellHex: string;
  visorHex: string;
  hasVisor: boolean;
  hasNvg: boolean;
}

export type LootType = 'weapon' | 'ammo' | 'medkit' | 'bandage' | 'armor' | 'backpack';

export interface WorldLootItem {
  id: string;
  type: LootType;
  name: string;
  x: number;
  y: number;
  z: number;
  weightKg: number;
  weaponId?: WeaponId;
  ammoAmount?: number;
  ammoFor?: WeaponId;
  healAmount?: number;
  armorAmount?: number;
  capacityBonus?: number;
  collected: boolean;
}

export interface BackpackItem {
  id: string;
  type: 'medkit' | 'bandage' | 'ammo';
  name: string;
  quantity: number;
  weightEachKg: number;
  healAmount?: number;
  ammoFor?: WeaponId;
}

export interface InventoryItem {
  id: string;
  name: string;
  slot: 'Primary' | 'Secondary' | 'Sidearm' | 'Armor' | 'Medical' | 'Tactical';
  description: string;
  weightKg: number;
  quantity: number;
  weaponId?: WeaponId;
}

export interface CharacterLoadout {
  callsign: string;
  camo: CamoId;
  helmet: HelmetId;
  backpackEnabled: boolean;
  primaryWeapon: WeaponId;
  secondaryWeapon: WeaponId;
  sidearmWeapon: WeaponId;
  armorEquipped: boolean;
}

export type DifficultyLevel = 'easy' | 'normal' | 'hard';

export type GraphicsPreset = 'low' | 'medium' | 'high' | 'ultra';

export type ControlLayoutPreset = 'standard' | 'claw' | 'compact';

export type MatchMode = 'solo' | 'multiplayer';

export interface GameSettings {
  difficulty: DifficultyLevel;
  graphicsQuality: GraphicsPreset;
  batterySaver: boolean;
  showFps: boolean;
  mouseSensitivity: number;
  cameraFov: number;
  cameraDistance: number;
  invertY: boolean;
  shadowsEnabled: boolean;
  foliageDensity: 'high' | 'medium';
  masterVolume: number;
  muted: boolean;
  showTouchControls: 'auto' | 'always' | 'off';
  controlPreset: ControlLayoutPreset;
  controlScale: number;
  controlOpacity: number;
  showControlsHint: boolean;
}

export interface RemotePlayerSnapshot {
  userId: string;
  callsign: string;
  connected: boolean;
  camo: CamoId;
  helmet: HelmetId;
  x: number;
  y: number;
  z: number;
  yaw: number;
  isCrouching: boolean;
  isSprinting: boolean;
  isAiming: boolean;
  isParachuting: boolean;
  isInAircraft: boolean;
  hp: number;
  armor: number;
  alive: boolean;
  kills: number;
  damageDealt: number;
  headshots: number;
  placement: number;
  eliminationCause: string;
  activeSlot: 1 | 2 | 3;
  slots: Record<1 | 2 | 3, WeaponId | null>;
  ammo: Record<1 | 2 | 3, { mag: number; reserve: number }>;
  medkits: number;
  bandages: number;
  backpackMaxKg: number;
  backpackUsedKg: number;
}

export interface ServerMatchSnapshot {
  roomId: string;
  phase: MatchPhase;
  matchTimeSec: number;
  countdownSec: number;
  aircraft: {
    startX: number;
    startZ: number;
    endX: number;
    endZ: number;
    planeX: number;
    planeY: number;
    planeZ: number;
    planeYaw: number;
  };
  zone: {
    phaseIndex: number;
    phaseStatus: 'waiting' | 'shrinking' | 'final';
    phaseTimerSec: number;
    blueCenterX: number;
    blueCenterZ: number;
    blueRadius: number;
    safeCenterX: number;
    safeCenterZ: number;
    safeRadius: number;
    damagePerSec: number;
  };
  killFeed: EliminationNotice[];
  players: RemotePlayerSnapshot[];
}

export interface DamageFeedback {
  amount: number;
  isHeadshot: boolean;
  weaponName: string;
  targetName: string;
  tick: number;
}

export interface TargetedEnemyInfo {
  callsign: string;
  hp: number;
  maxHp: number;
  distanceM: number;
}

export interface EliminationNotice {
  id: number;
  killer: string;
  victim: string;
  weaponName: string;
  isHeadshot: boolean;
  timestamp: number;
}

export interface ZoneHudState {
  phaseIndex: number;
  phaseStatus: 'waiting' | 'shrinking' | 'final';
  phaseTimerSec: number;
  blueCenterX: number;
  blueCenterZ: number;
  blueRadius: number;
  safeCenterX: number;
  safeCenterZ: number;
  safeRadius: number;
  damagePerSec: number;
  playerOutsideZone: boolean;
}

export interface FlightPathState {
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  planeX: number;
  planeY: number;
  planeZ: number;
  planeYaw: number;
  canDrop: boolean;
  progress: number;
}

export interface BotHudMarker {
  id: string;
  x: number;
  z: number;
  alive: boolean;
}

export interface PlayerHudState {
  matchPhase: MatchPhase;
  matchTimeSec: number;
  countdownSec: number;
  aliveCount: number;
  totalPlayers: number;
  kills: number;
  damageDealt: number;
  headshots: number;
  placement: number;
  eliminationCause: string;
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  stamina: number;
  maxStamina: number;
  altitudeM: number;
  headingDeg: number;
  activeSlot: 1 | 2 | 3;
  activeWeaponId: WeaponId;
  slotWeapons: Record<1 | 2 | 3, WeaponId | null>;
  ammoInMag: number;
  reserveAmmo: number;
  isReloading: boolean;
  reloadProgress: number;
  isAiming: boolean;
  isCrouching: boolean;
  isSprinting: boolean;
  isGrounded: boolean;
  speedMps: number;
  playerX: number;
  playerZ: number;
  hitMarkerTick: number;
  lastHitHeadshot: boolean;
  lastDamage: DamageFeedback | null;
  targetedEnemy: TargetedEnemyInfo | null;
  targetsHitCount: number;
  nearbyLoot: WorldLootItem | null;
  backpackUsedKg: number;
  backpackMaxKg: number;
  backpackItems: BackpackItem[];
  zone: ZoneHudState;
  flight: FlightPathState;
  killFeed: EliminationNotice[];
  pointerLocked: boolean;
  surfaceLabel: string;
  lastDamagedByTick: number;
}

export interface MutableInputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jumpPressed: boolean;
  crouchTogglePressed: boolean;
  aimHeld: boolean;
  fireHeld: boolean;
  reloadPressed: boolean;
  interactPressed: boolean;
  healPressed: boolean;
  switchSlot1Pressed: boolean;
  switchSlot2Pressed: boolean;
  switchSlot3Pressed: boolean;
  lookDeltaX: number;
  lookDeltaY: number;
  zoomDelta: number;
  joyX: number;
  joyY: number;
}
