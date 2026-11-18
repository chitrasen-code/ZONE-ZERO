import { AI_CALLSIGNS, AI_DROP_ZONES } from '../data/matchConfig';
import { WEAPONS } from '../data/weapons';
import { DifficultyLevel, WeaponId, WorldLootItem, ZoneHudState } from '../types/game';
import { getWorldStaticData, resolvePlayerCollisions } from '../world/collisionData';
import { getWalkableHeight } from '../world/terrainMath';

export type BotBehaviorState =
  | 'parachuting'
  | 'exploring'
  | 'looting'
  | 'engaging'
  | 'taking_cover'
  | 'reloading'
  | 'retreating'
  | 'rotating_zone'
  | 'eliminated';

export interface BotEntity {
  id: string;
  callsign: string;
  x: number;
  y: number;
  z: number;
  vy: number;
  yaw: number;
  hp: number;
  maxHp: number;
  armor: number;
  medkits: number;
  weaponId: WeaponId;
  magAmmo: number;
  reserveAmmo: number;
  reloadTimer: number;
  fireCooldown: number;
  state: BotBehaviorState;
  waypointX: number;
  waypointZ: number;
  waypointTimer: number;
  targetEntityId: string | null; // 'player' or another bot id
  coverX: number;
  coverZ: number;
  isCrouching: boolean;
  speedMps: number;
  camoUniform: string;
  camoPants: string;
  lastHitTime: number;
  parachuteOpen: boolean;
  dropDelay: number;
}

export interface BotTracerEvent {
  startX: number;
  startY: number;
  startZ: number;
  endX: number;
  endY: number;
  endZ: number;
}

export interface BotStepResult {
  playerHitDamage: number;
  playerHitShooter: string;
  playerHitWeapon: string;
  eliminations: {
    killer: string;
    victim: string;
    weaponName: string;
    isHeadshot: boolean;
  }[];
  tracers: BotTracerEvent[];
}

const BOT_CAMO_PALETTES = [
  { uniform: '#4f5544', pants: '#3a3f32' },
  { uniform: '#7b6c54', pants: '#5c503d' },
  { uniform: '#394048', pants: '#272c33' },
  { uniform: '#47573f', pants: '#34402f' },
];

export interface DifficultyTuning {
  detectRange: number;
  aimErrorRad: number;
  fireIntervalMult: number;
  damageMult: number;
  retreatHpThreshold: number;
  reactionBoost: number;
}

export const DIFFICULTY_TUNING: Record<DifficultyLevel, DifficultyTuning> = {
  easy: {
    detectRange: 58,
    aimErrorRad: 0.14,
    fireIntervalMult: 1.85,
    damageMult: 0.52,
    retreatHpThreshold: 40,
    reactionBoost: 0.7,
  },
  normal: {
    detectRange: 80,
    aimErrorRad: 0.085,
    fireIntervalMult: 1.35,
    damageMult: 0.75,
    retreatHpThreshold: 34,
    reactionBoost: 1.0,
  },
  hard: {
    detectRange: 108,
    aimErrorRad: 0.045,
    fireIntervalMult: 1.05,
    damageMult: 1.0,
    retreatHpThreshold: 28,
    reactionBoost: 1.25,
  },
};

export function createMatchBots(): BotEntity[] {
  return AI_CALLSIGNS.map((callsign, idx) => {
    const drop = AI_DROP_ZONES[idx % AI_DROP_ZONES.length];
    const palette = BOT_CAMO_PALETTES[idx % BOT_CAMO_PALETTES.length];
    const startWeapon: WeaponId = 'p45'; // Bots land with sidearm & seek better weapons!
    const spec = WEAPONS[startWeapon];
    return {
      id: `bot-${idx + 1}`,
      callsign,
      x: drop.x + (Math.random() - 0.5) * 10,
      y: 132,
      z: drop.z + (Math.random() - 0.5) * 10,
      vy: -8,
      yaw: Math.random() * Math.PI * 2,
      hp: 100,
      maxHp: 100,
      armor: 25,
      medkits: 1,
      weaponId: startWeapon,
      magAmmo: spec.magSize,
      reserveAmmo: spec.reserveAmmo,
      reloadTimer: 0,
      fireCooldown: 0.6 + Math.random() * 0.8,
      state: 'parachuting',
      waypointX: drop.x,
      waypointZ: drop.z,
      waypointTimer: 2 + Math.random() * 4,
      targetEntityId: null,
      coverX: drop.x,
      coverZ: drop.z,
      isCrouching: false,
      speedMps: 0,
      camoUniform: palette.uniform,
      camoPants: palette.pants,
      lastHitTime: -10,
      parachuteOpen: true,
      dropDelay: idx * 0.55,
    };
  });
}

function findNearestCover(x: number, z: number, threatX: number, threatZ: number): { x: number; z: number } {
  const world = getWorldStaticData();
  const awayX = x - threatX;
  const awayZ = z - threatZ;
  const awayLen = Math.max(0.1, Math.hypot(awayX, awayZ));
  const dirX = awayX / awayLen;
  const dirZ = awayZ / awayLen;

  let bestX = x + dirX * 10;
  let bestZ = z + dirZ * 10;
  let bestDist = Infinity;

  for (let i = 0; i < world.cylinderColliders.length; i += 2) {
    const c = world.cylinderColliders[i];
    const d = Math.hypot(c.x - x, c.z - z);
    if (d > 4 && d < 24 && d < bestDist) {
      bestDist = d;
      // Place cover point behind obstacle away from threat
      bestX = c.x + dirX * (c.radius + 1.1);
      bestZ = c.z + dirZ * (c.radius + 1.1);
    }
  }
  return { x: bestX, z: bestZ };
}

export function stepBotsSimulation(
  bots: BotEntity[],
  dt: number,
  matchTime: number,
  playerState: { x: number; y: number; z: number; alive: boolean; callsign: string },
  zone: ZoneHudState,
  lootItems: WorldLootItem[],
  difficulty: DifficultyLevel,
): BotStepResult {
  const tuning = DIFFICULTY_TUNING[difficulty];
  const result: BotStepResult = {
    playerHitDamage: 0,
    playerHitShooter: '',
    playerHitWeapon: '',
    eliminations: [],
    tracers: [],
  };

  for (let i = 0; i < bots.length; i++) {
    const bot = bots[i];
    if (bot.state === 'eliminated') continue;

    // 1. Parachute landing phase
    if (bot.state === 'parachuting') {
      if (matchTime < bot.dropDelay) continue;
      const groundY = Math.max(0.2, getWalkableHeight(bot.x, bot.z, bot.y));
      bot.y += bot.vy * dt;
      bot.x += Math.sin(bot.yaw) * 4.5 * dt;
      bot.z += Math.cos(bot.yaw) * 4.5 * dt;
      if (bot.y <= groundY) {
        bot.y = groundY;
        bot.vy = 0;
        bot.parachuteOpen = false;
        bot.state = 'looting';
      }
      continue;
    }

    // 2. Blue zone damage check
    const distFromZone = Math.hypot(bot.x - zone.blueCenterX, bot.z - zone.blueCenterZ);
    const outsideBlue = distFromZone > zone.blueRadius;
    if (outsideBlue) {
      bot.hp -= zone.damagePerSec * dt;
      if (bot.hp <= 0) {
        bot.hp = 0;
        bot.state = 'eliminated';
        result.eliminations.push({
          killer: 'Blue Zone',
          victim: bot.callsign,
          weaponName: 'Storm Field',
          isHeadshot: false,
        });
        continue;
      }
    }

    // 3. Reload timer
    if (bot.reloadTimer > 0) {
      bot.reloadTimer = Math.max(0, bot.reloadTimer - dt);
      if (bot.reloadTimer === 0) {
        const spec = WEAPONS[bot.weaponId];
        const need = spec.magSize - bot.magAmmo;
        const take = Math.min(need, bot.reserveAmmo);
        bot.magAmmo += take;
        bot.reserveAmmo -= take;
        bot.state = 'exploring';
      }
    }

    if (bot.fireCooldown > 0) {
      bot.fireCooldown = Math.max(0, bot.fireCooldown - dt);
    }

    // 4. Scan for nearest enemy (player + other living bots)
    let nearestTargetId: string | null = null;
    let nearestDist = tuning.detectRange;
    let targetX = 0;
    let targetY = 0;
    let targetZ = 0;

    if (playerState.alive) {
      const dp = Math.hypot(playerState.x - bot.x, playerState.z - bot.z);
      if (dp < nearestDist) {
        nearestDist = dp;
        nearestTargetId = 'player';
        targetX = playerState.x;
        targetY = playerState.y;
        targetZ = playerState.z;
      }
    }

    for (let j = 0; j < bots.length; j++) {
      if (i === j) continue;
      const other = bots[j];
      if (other.state === 'eliminated' || other.state === 'parachuting') continue;
      const db = Math.hypot(other.x - bot.x, other.z - bot.z);
      if (db < nearestDist) {
        nearestDist = db;
        nearestTargetId = other.id;
        targetX = other.x;
        targetY = other.y;
        targetZ = other.z;
      }
    }
    bot.targetEntityId = nearestTargetId;

    // 5. Loot pickup check (weapons, ammo, medkits, armor)
    let nearestLoot: WorldLootItem | null = null;
    let nearestLootDist = 36;
    for (let k = 0; k < lootItems.length; k++) {
      const item = lootItems[k];
      if (item.collected) continue;
      const d = Math.hypot(item.x - bot.x, item.z - bot.z);
      if (d < 2.2) {
        // Pick up loot!
        if (item.type === 'weapon' && item.weaponId && bot.weaponId === 'p45') {
          item.collected = true;
          bot.weaponId = item.weaponId;
          const sp = WEAPONS[item.weaponId];
          bot.magAmmo = sp.magSize;
          bot.reserveAmmo = sp.reserveAmmo;
        } else if (item.type === 'medkit' || item.type === 'bandage') {
          item.collected = true;
          bot.medkits += 1;
        } else if (item.type === 'armor' && bot.armor < (item.armorAmount ?? 80)) {
          item.collected = true;
          bot.armor = item.armorAmount ?? 80;
        } else if (item.type === 'ammo' && bot.reserveAmmo < 60) {
          item.collected = true;
          bot.reserveAmmo += item.ammoAmount ?? 30;
        }
      } else if (d < nearestLootDist && (bot.weaponId === 'p45' || bot.hp < 70)) {
        nearestLootDist = d;
        nearestLoot = item;
      }
    }

    // 6. Decide AI Behavior State
    const distToSafe = Math.hypot(bot.x - zone.safeCenterX, bot.z - zone.safeCenterZ);
    const needZoneMove = distFromZone > zone.blueRadius * 0.9 || distToSafe > zone.safeRadius * 0.92;

    if (bot.hp <= tuning.retreatHpThreshold && nearestTargetId) {
      bot.state = 'retreating';
      if (bot.medkits > 0 && Math.random() < dt * 0.7) {
        bot.medkits -= 1;
        bot.hp = Math.min(bot.maxHp, bot.hp + 42);
      }
      const cov = findNearestCover(bot.x, bot.z, targetX, targetZ);
      bot.coverX = cov.x;
      bot.coverZ = cov.z;
    } else if (bot.reloadTimer > 0) {
      bot.state = 'reloading';
    } else if (needZoneMove) {
      bot.state = 'rotating_zone';
    } else if (nearestTargetId) {
      if (bot.magAmmo <= 0 && bot.reserveAmmo > 0) {
        bot.reloadTimer = WEAPONS[bot.weaponId].reloadTimeSec;
        bot.state = 'reloading';
      } else if (nearestDist < 16 && bot.hp < 60) {
        bot.state = 'taking_cover';
        const cov = findNearestCover(bot.x, bot.z, targetX, targetZ);
        bot.coverX = cov.x;
        bot.coverZ = cov.z;
      } else {
        bot.state = 'engaging';
      }
    } else if (nearestLoot) {
      bot.state = 'looting';
      bot.waypointX = nearestLoot.x;
      bot.waypointZ = nearestLoot.z;
    } else {
      bot.state = 'exploring';
    }

    // 7. Execute Movement & Combat per State
    let desiredX = bot.waypointX;
    let desiredZ = bot.waypointZ;
    let moveSpeed = 4.4;
    bot.isCrouching = false;

    if (bot.state === 'rotating_zone') {
      desiredX = zone.safeCenterX + Math.sin(i * 1.7) * Math.min(24, zone.safeRadius * 0.4);
      desiredZ = zone.safeCenterZ + Math.cos(i * 1.7) * Math.min(24, zone.safeRadius * 0.4);
      moveSpeed = 6.8;
    } else if (bot.state === 'retreating' || bot.state === 'taking_cover') {
      desiredX = bot.coverX;
      desiredZ = bot.coverZ;
      moveSpeed = bot.state === 'retreating' ? 7.1 : 5.2;
      bot.isCrouching = bot.state === 'taking_cover';
    } else if (bot.state === 'looting') {
      moveSpeed = 5.6;
    } else if (bot.state === 'engaging') {
      // Strafe laterally while maintaining optimal range
      const spec = WEAPONS[bot.weaponId];
      const idealRange = Math.min(spec.range * 0.65, bot.weaponId === 'sg12' ? 14 : 36);
      const dx = targetX - bot.x;
      const dz = targetZ - bot.z;
      const dist = Math.max(0.1, Math.hypot(dx, dz));
      const nx = dx / dist;
      const nz = dz / dist;
      const strafeDir = Math.sin(matchTime * 1.4 + i) > 0 ? 1 : -1;
      const radialPush = dist > idealRange + 6 ? 1 : dist < idealRange - 6 ? -0.8 : 0;
      desiredX = bot.x + (nx * radialPush - nz * 0.85 * strafeDir) * 6;
      desiredZ = bot.z + (nz * radialPush + nx * 0.85 * strafeDir) * 6;
      moveSpeed = 4.2;

      // Fire weapon when cooldown ready
      if (bot.fireCooldown <= 0 && bot.magAmmo > 0 && dist <= spec.range) {
        bot.magAmmo -= 1;
        const baseInterval = 60 / spec.fireRateRpm;
        bot.fireCooldown = Math.max(0.18, baseInterval * tuning.fireIntervalMult * (0.9 + Math.random() * 0.4));

        // Aim direction with difficulty error
        const aimAngle = Math.atan2(dx, dz) + (Math.random() - 0.5) * tuning.aimErrorRad * 2;
        const hitChance =
          Math.max(0.12, (1 - dist / Math.max(40, spec.range)) * 0.55) * tuning.reactionBoost;
        const didHit = Math.random() < hitChance;

        const shotEndX = didHit ? targetX : bot.x + Math.sin(aimAngle) * Math.min(dist + 8, 55);
        const shotEndY = didHit ? targetY + 1.25 : targetY + 1.1 + (Math.random() - 0.5) * 1.4;
        const shotEndZ = didHit ? targetZ : bot.z + Math.cos(aimAngle) * Math.min(dist + 8, 55);

        result.tracers.push({
          startX: bot.x,
          startY: bot.y + 1.35,
          startZ: bot.z,
          endX: shotEndX,
          endY: shotEndY,
          endZ: shotEndZ,
        });

        if (didHit) {
          const rawDmg = spec.damage * tuning.damageMult * (bot.weaponId === 'sg12' ? 2.2 : 1);
          if (nearestTargetId === 'player') {
            result.playerHitDamage += rawDmg;
            result.playerHitShooter = bot.callsign;
            result.playerHitWeapon = spec.name;
          } else {
            const victim = bots.find((b) => b.id === nearestTargetId);
            if (victim && victim.state !== 'eliminated') {
              const absorbed = Math.min(victim.armor, rawDmg * 0.35);
              victim.armor -= absorbed;
              victim.hp -= rawDmg - absorbed;
              victim.lastHitTime = matchTime;
              if (victim.hp <= 0) {
                victim.hp = 0;
                victim.state = 'eliminated';
                result.eliminations.push({
                  killer: bot.callsign,
                  victim: victim.callsign,
                  weaponName: spec.name,
                  isHeadshot: Math.random() < 0.22,
                });
              }
            }
          }
        }
      }
    } else {
      // Exploring: pick periodic random patrol waypoints inside safe zone
      bot.waypointTimer -= dt;
      if (bot.waypointTimer <= 0 || Math.hypot(bot.waypointX - bot.x, bot.waypointZ - bot.z) < 3) {
        bot.waypointTimer = 5 + Math.random() * 6;
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.random() * Math.min(130, zone.safeRadius * 0.8);
        bot.waypointX = zone.safeCenterX + Math.cos(ang) * rad;
        bot.waypointZ = zone.safeCenterZ + Math.sin(ang) * rad;
      }
      moveSpeed = 4.5;
    }

    // Move & resolve world collisions
    const mdx = desiredX - bot.x;
    const mdz = desiredZ - bot.z;
    const mDist = Math.hypot(mdx, mdz);
    if (mDist > 0.4) {
      const stepX = (mdx / mDist) * moveSpeed * dt;
      const stepZ = (mdz / mDist) * moveSpeed * dt;
      const resolved = resolvePlayerCollisions(bot.x + stepX, bot.z + stepZ, bot.y, 0.45);
      bot.x = resolved.x;
      bot.z = resolved.z;
      bot.speedMps = moveSpeed;

      // Face target while engaging, or movement direction while patrolling
      const faceYaw =
        bot.state === 'engaging' && nearestTargetId
          ? Math.atan2(targetX - bot.x, targetZ - bot.z)
          : Math.atan2(mdx, mdz);
      let diff = faceYaw - bot.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      bot.yaw += diff * Math.min(1, dt * 8);
    } else {
      bot.speedMps = 0;
    }

    bot.y = Math.max(0.15, getWalkableHeight(bot.x, bot.z, bot.y));
  }

  return result;
}
