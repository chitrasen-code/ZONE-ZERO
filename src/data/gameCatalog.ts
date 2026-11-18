import {
  CamoPreset,
  CharacterLoadout,
  GameSettings,
  HelmetPreset,
  InventoryItem,
} from '../types/game';
import { WEAPONS } from './weapons';

export { WEAPONS, WEAPON_LIST } from './weapons';

export const CAMO_PRESETS: CamoPreset[] = [
  {
    id: 'olive',
    name: 'Ranger Olive',
    uniformHex: '#4b5742',
    pantsHex: '#3c4334',
    vestHex: '#2c3128',
    accentHex: '#b48a3e',
  },
  {
    id: 'desert',
    name: 'Arid Coyote',
    uniformHex: '#8d7b60',
    pantsHex: '#6c5d47',
    vestHex: '#463d31',
    accentHex: '#d49a35',
  },
  {
    id: 'urban',
    name: 'Night Recon',
    uniformHex: '#2f3640',
    pantsHex: '#232830',
    vestHex: '#181c22',
    accentHex: '#64748b',
  },
  {
    id: 'woodland',
    name: 'Highland Moss',
    uniformHex: '#3b4e3c',
    pantsHex: '#2d372c',
    vestHex: '#242621',
    accentHex: '#84a955',
  },
];

export const HELMET_PRESETS: HelmetPreset[] = [
  {
    id: 'tactical_ops',
    name: 'OPS-2 Ballistic',
    shellHex: '#373e36',
    visorHex: '#1b2430',
    hasVisor: true,
    hasNvg: false,
  },
  {
    id: 'recon_visor',
    name: 'Recon NVG Rig',
    shellHex: '#272c33',
    visorHex: '#2c4c5e',
    hasVisor: true,
    hasNvg: true,
  },
  {
    id: 'heavy_ballistic',
    name: 'Vanguard Shell',
    shellHex: '#4e483c',
    visorHex: '#181b20',
    hasVisor: false,
    hasNvg: false,
  },
];

export const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: 'item-vx47',
    name: WEAPONS.vx47.name,
    slot: 'Primary',
    description: 'Modular 5.56mm assault rifle balanced for medium-range engagements.',
    weightKg: 3.4,
    quantity: 1,
    weaponId: 'vx47',
  },
  {
    id: 'item-k9smg',
    name: WEAPONS.k9smg.name,
    slot: 'Secondary',
    description: 'Compact high-cadence 9mm submachine gun for close-quarters clearing.',
    weightKg: 2.5,
    quantity: 1,
    weaponId: 'k9smg',
  },
  {
    id: 'item-lsr90',
    name: WEAPONS.lsr90.name,
    slot: 'Primary',
    description: 'Long-range 8.6mm bolt-action sniper rifle with 2.5x headshot precision.',
    weightKg: 5.8,
    quantity: 1,
    weaponId: 'lsr90',
  },
  {
    id: 'item-sg12',
    name: WEAPONS.sg12.name,
    slot: 'Secondary',
    description: '12-gauge buckshot breacher firing 8 pellets per shell for devastating CQB.',
    weightKg: 3.7,
    quantity: 1,
    weaponId: 'sg12',
  },
  {
    id: 'item-p45',
    name: WEAPONS.p45.name,
    slot: 'Sidearm',
    description: 'Reliable .45 ACP tactical pistol with rapid reload and crisp handling.',
    weightKg: 1.1,
    quantity: 1,
    weaponId: 'p45',
  },
  {
    id: 'item-vest',
    name: 'Plate Carrier Lv.2',
    slot: 'Armor',
    description: 'Ceramic-composite tactical vest reducing incoming ballistic impact.',
    weightKg: 5.2,
    quantity: 1,
  },
  {
    id: 'item-medkit',
    name: 'Field Trauma Kit',
    slot: 'Medical',
    description: 'Standard-issue bandages and hemostatic gauze for emergency stabilization.',
    weightKg: 0.8,
    quantity: 2,
  },
];

export const DEFAULT_LOADOUT: CharacterLoadout = {
  callsign: 'VANGUARD-01',
  camo: 'olive',
  helmet: 'tactical_ops',
  backpackEnabled: true,
  primaryWeapon: 'vx47',
  secondaryWeapon: 'sg12',
  sidearmWeapon: 'p45',
  armorEquipped: true,
};

export const DEFAULT_SETTINGS: GameSettings = {
  difficulty: 'normal',
  graphicsQuality: 'high',
  batterySaver: false,
  showFps: true,
  mouseSensitivity: 1.0,
  cameraFov: 62,
  cameraDistance: 4.4,
  invertY: false,
  shadowsEnabled: true,
  foliageDensity: 'high',
  masterVolume: 0.65,
  muted: false,
  showTouchControls: 'auto',
  controlPreset: 'standard',
  controlScale: 1.0,
  controlOpacity: 0.85,
  showControlsHint: true,
};
