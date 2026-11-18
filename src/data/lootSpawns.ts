import { WorldLootItem } from '../types/game';
import { getTerrainHeight } from '../world/terrainMath';
import { WEAPONS } from './weapons';

interface LootTemplate {
  id: string;
  type: WorldLootItem['type'];
  x: number;
  z: number;
  yOffset?: number;
  weaponId?: WorldLootItem['weaponId'];
  ammoFor?: WorldLootItem['ammoFor'];
  ammoAmount?: number;
  healAmount?: number;
  armorAmount?: number;
  capacityBonus?: number;
}

const LOOT_TEMPLATES: LootTemplate[] = [
  // FORT AEGIS (Military Compound)
  { id: 'loot-aegis-vx47', type: 'weapon', weaponId: 'vx47', x: -10, z: -44, yOffset: 0.25 },
  { id: 'loot-aegis-lsr90', type: 'weapon', weaponId: 'lsr90', x: 14, z: -40, yOffset: 0.22 },
  { id: 'loot-aegis-armor', type: 'armor', armorAmount: 100, x: -12, z: -43, yOffset: 0.25 },
  { id: 'loot-aegis-medkit', type: 'medkit', healAmount: 50, x: -8, z: -45, yOffset: 0.25 },
  { id: 'loot-aegis-ammo-556', type: 'ammo', ammoFor: 'vx47', ammoAmount: 60, x: 5.5, z: -34 },
  { id: 'loot-aegis-pack', type: 'backpack', capacityBonus: 14, x: -18, z: -38 },

  // PORT MERIDIAN (Modern City Buildings)
  { id: 'loot-city-k9', type: 'weapon', weaponId: 'k9smg', x: -106, z: 26, yOffset: 0.25 },
  { id: 'loot-city-vx47', type: 'weapon', weaponId: 'vx47', x: -90, z: 44, yOffset: 0.25 },
  { id: 'loot-city-p45', type: 'weapon', weaponId: 'p45', x: -85, z: 24, yOffset: 0.25 },
  { id: 'loot-city-armor', type: 'armor', armorAmount: 80, x: -91, z: 43, yOffset: 0.25 },
  { id: 'loot-city-medkit', type: 'medkit', healAmount: 50, x: -105, z: 27, yOffset: 0.25 },
  { id: 'loot-city-ammo-9mm', type: 'ammo', ammoFor: 'k9smg', ammoAmount: 70, x: -88, z: 45, yOffset: 0.25 },
  { id: 'loot-city-pack', type: 'backpack', capacityBonus: 14, x: -86, z: 23, yOffset: 0.25 },

  // CEDARWOOD VILLAS (Residential Houses)
  { id: 'loot-res-sg12', type: 'weapon', weaponId: 'sg12', x: -33, z: 44, yOffset: 0.25 },
  { id: 'loot-res-p45', type: 'weapon', weaponId: 'p45', x: -16, z: 48, yOffset: 0.25 },
  { id: 'loot-res-vx47', type: 'weapon', weaponId: 'vx47', x: -25, z: 60, yOffset: 0.25 },
  { id: 'loot-res-bandage', type: 'bandage', healAmount: 25, x: -32, z: 45, yOffset: 0.25 },
  { id: 'loot-res-medkit', type: 'medkit', healAmount: 50, x: -15, z: 47, yOffset: 0.25 },
  { id: 'loot-res-armor', type: 'armor', armorAmount: 70, x: -24, z: 59, yOffset: 0.25 },
  { id: 'loot-res-ammo-12g', type: 'ammo', ammoFor: 'sg12', ammoAmount: 16, x: -34, z: 43, yOffset: 0.25 },

  // IRONWORKS YARD (Industrial Area)
  { id: 'loot-ind-sg12', type: 'weapon', weaponId: 'sg12', x: 108, z: 36, yOffset: 0.25 },
  { id: 'loot-ind-k9', type: 'weapon', weaponId: 'k9smg', x: 106, z: 32, yOffset: 0.25 },
  { id: 'loot-ind-armor', type: 'armor', armorAmount: 100, x: 110, z: 39, yOffset: 0.25 },
  { id: 'loot-ind-pack', type: 'backpack', capacityBonus: 14, x: 105, z: 40, yOffset: 0.25 },
  { id: 'loot-ind-ammo-556', type: 'ammo', ammoFor: 'vx47', ammoAmount: 60, x: 98, z: 28 },
  { id: 'loot-ind-medkit', type: 'medkit', healAmount: 50, x: 98, z: 34 },

  // SUNBREAK BEACH (Coastal Landing Area)
  { id: 'loot-beach-k9', type: 'weapon', weaponId: 'k9smg', x: -64, z: 146 },
  { id: 'loot-beach-p45', type: 'weapon', weaponId: 'p45', x: -60, z: 149 },
  { id: 'loot-beach-bandage', type: 'bandage', healAmount: 25, x: -67, z: 144 },
  { id: 'loot-beach-armor', type: 'armor', armorAmount: 60, x: -62, z: 142 },

  // OLD MILL RUINS (Abandoned Structures)
  { id: 'loot-mill-lsr90', type: 'weapon', weaponId: 'lsr90', x: 91, z: -74 },
  { id: 'loot-mill-ammo-86', type: 'ammo', ammoFor: 'lsr90', ammoAmount: 15, x: 93, z: -73 },
  { id: 'loot-mill-medkit', type: 'medkit', healAmount: 50, x: 90, z: -72 },
  { id: 'loot-mill-armor', type: 'armor', armorAmount: 80, x: 94, z: -75 },
];

export function createMatchLootItems(): WorldLootItem[] {
  return LOOT_TEMPLATES.map((tpl) => {
    const baseH = getTerrainHeight(tpl.x, tpl.z);
    const y = baseH + (tpl.yOffset ?? 0);

    if (tpl.type === 'weapon' && tpl.weaponId) {
      const spec = WEAPONS[tpl.weaponId];
      return {
        id: tpl.id,
        type: 'weapon',
        name: spec.name,
        x: tpl.x,
        y,
        z: tpl.z,
        weightKg: spec.weightKg,
        weaponId: tpl.weaponId,
        collected: false,
      };
    }

    if (tpl.type === 'ammo' && tpl.ammoFor) {
      const spec = WEAPONS[tpl.ammoFor];
      return {
        id: tpl.id,
        type: 'ammo',
        name: `${spec.caliber} Box`,
        x: tpl.x,
        y,
        z: tpl.z,
        weightKg: 1.2,
        ammoFor: tpl.ammoFor,
        ammoAmount: tpl.ammoAmount ?? 30,
        collected: false,
      };
    }

    if (tpl.type === 'medkit') {
      return {
        id: tpl.id,
        type: 'medkit',
        name: 'Field Medkit',
        x: tpl.x,
        y,
        z: tpl.z,
        weightKg: 1.5,
        healAmount: tpl.healAmount ?? 50,
        collected: false,
      };
    }

    if (tpl.type === 'bandage') {
      return {
        id: tpl.id,
        type: 'bandage',
        name: 'Bandage Pack',
        x: tpl.x,
        y,
        z: tpl.z,
        weightKg: 0.6,
        healAmount: tpl.healAmount ?? 25,
        collected: false,
      };
    }

    if (tpl.type === 'armor') {
      return {
        id: tpl.id,
        type: 'armor',
        name: 'Ballistic Armor Vest',
        x: tpl.x,
        y,
        z: tpl.z,
        weightKg: 0,
        armorAmount: tpl.armorAmount ?? 80,
        collected: false,
      };
    }

    return {
      id: tpl.id,
      type: 'backpack',
      name: 'Tactical Pack Lv.2',
      x: tpl.x,
      y,
      z: tpl.z,
      weightKg: 0,
      capacityBonus: tpl.capacityBonus ?? 14,
      collected: false,
    };
  });
}
