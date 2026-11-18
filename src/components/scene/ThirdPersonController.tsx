import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { soundEngine } from '../../audio/soundEngine';
import { createMatchLootItems } from '../../data/lootSpawns';
import {
  AIRCRAFT_ALTITUDE,
  AIRCRAFT_SPEED_MPS,
  BASE_BACKPACK_CAPACITY_KG,
  INITIAL_BLUE_RADIUS,
  PREFLIGHT_COUNTDOWN_SEC,
  TOTAL_MATCH_COMBATANTS,
  ZONE_PHASES,
} from '../../data/matchConfig';
import { WEAPONS } from '../../data/weapons';
import { BotEntity, createMatchBots, stepBotsSimulation } from '../../game/aiSimulation';
import { multiplayerClient } from '../../network/multiplayerClient';
import {
  BackpackItem,
  CharacterLoadout,
  DamageFeedback,
  EliminationNotice,
  FlightPathState,
  GameScreen,
  GameSettings,
  MatchMode,
  MatchPhase,
  MutableInputState,
  PlayerHudState,
  RemotePlayerSnapshot,
  ServerMatchSnapshot,
  TargetedEnemyInfo,
  WeaponId,
  WorldLootItem,
  ZoneHudState,
} from '../../types/game';
import { clampDelta } from '../../utils/webgl';
import { getWorldStaticData, resolvePlayerCollisions } from '../../world/collisionData';
import { getSurfaceType, getTerrainHeight, getWalkableHeight } from '../../world/terrainMath';
import { BotActors } from './BotActors';
import { TargetHitState } from './Buildings';
import { OperatorAnimState, OperatorModel } from './OperatorModel';
import { RemotePlayers } from './RemotePlayers';
import { ZoneAndAircraft } from './ZoneAndAircraft';

interface ThirdPersonControllerProps {
  screen: GameScreen;
  matchMode: MatchMode;
  matchSessionId: number;
  loadout: CharacterLoadout;
  settings: GameSettings;
  inputRef: React.MutableRefObject<MutableInputState>;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  lootItemsRef: React.MutableRefObject<WorldLootItem[]>;
  activeSlot: 1 | 2 | 3;
  onActiveSlotChange: (slot: 1 | 2 | 3) => void;
  onHudUpdate: (hud: PlayerHudState) => void;
  targetHitStatesRef: React.MutableRefObject<Record<string, TargetHitState>>;
  targetHitMeshesRef: React.MutableRefObject<THREE.Object3D[]>;
  remotePlayers: RemotePlayerSnapshot[];
  onRemotePlayersUpdate: (players: RemotePlayerSnapshot[]) => void;
  isSoftwareGl: boolean;
}

interface TracerItem {
  active: boolean;
  life: number;
  start: THREE.Vector3;
  end: THREE.Vector3;
}

interface ImpactItem {
  active: boolean;
  life: number;
  pos: THREE.Vector3;
  isHeadshot: boolean;
}

const GRAVITY = 22.5;
const JUMP_SPEED = 8.4;
const WALK_SPEED = 4.6;
const RUN_SPEED = 6.2;
const SPRINT_SPEED = 9.0;
const CROUCH_SPEED = 3.0;
const GROUND_ACCEL = 24.0;
const GROUND_DECEL = 18.0;
const AIR_ACCEL = 7.5;

const _camForward = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _pivotPos = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _tracerMid = new THREE.Vector3();
const _tracerUp = new THREE.Vector3(0, 1, 0);
const _tracerQuat = new THREE.Quaternion();

function wrapAngle(a: number): number {
  let res = a;
  while (res > Math.PI) res -= Math.PI * 2;
  while (res < -Math.PI) res += Math.PI * 2;
  return res;
}

function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  const diff = wrapAngle(target - current);
  return current + diff * (1 - Math.exp(-lambda * dt));
}

function intersectRayBox(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  minZ: number,
  maxZ: number,
): number {
  let tMin = 0;
  let tMax = maxDist;
  if (Math.abs(dx) < 1e-6) {
    if (ox < minX || ox > maxX) return maxDist;
  } else {
    let t1 = (minX - ox) / dx;
    let t2 = (maxX - ox) / dx;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return maxDist;
  }
  if (Math.abs(dy) < 1e-6) {
    if (oy < minY || oy > maxY) return maxDist;
  } else {
    let t1 = (minY - oy) / dy;
    let t2 = (maxY - oy) / dy;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return maxDist;
  }
  if (Math.abs(dz) < 1e-6) {
    if (oz < minZ || oz > maxZ) return maxDist;
  } else {
    let t1 = (minZ - oz) / dz;
    let t2 = (maxZ - oz) / dz;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return maxDist;
  }
  return tMin > 0.05 ? tMin : maxDist;
}

export function ThirdPersonController({
  screen,
  matchMode,
  matchSessionId,
  loadout,
  settings,
  inputRef,
  playerPosRef,
  lootItemsRef,
  activeSlot,
  onActiveSlotChange,
  onHudUpdate,
  targetHitStatesRef,
  targetHitMeshesRef,
  remotePlayers,
  onRemotePlayersUpdate,
  isSoftwareGl,
}: ThirdPersonControllerProps) {
  const { camera } = useThree();
  const worldData = useMemo(() => getWorldStaticData(), []);

  const operatorGroupRef = useRef<THREE.Group>(null);
  const animStateRef = useRef<OperatorAnimState>({
    speedRatio: 0,
    isGrounded: true,
    isCrouching: false,
    isAiming: false,
    isReloading: false,
    isSkydiving: false,
    isParachuting: false,
    isMenuPreview: screen !== 'playing',
    recoilKick: 0,
    muzzleFlashTimer: 0,
    aimPitch: 0,
  });

  // Match state refs
  const matchPhaseRef = useRef<MatchPhase>('countdown');
  const matchTimeRef = useRef(0);
  const countdownRef = useRef(PREFLIGHT_COUNTDOWN_SEC);
  const killsRef = useRef(0);
  const damageDealtRef = useRef(0);
  const headshotsRef = useRef(0);
  const placementRef = useRef(1);
  const eliminationCauseRef = useRef('');
  const killFeedRef = useRef<EliminationNotice[]>([]);
  const nextNoticeIdRef = useRef(1);

  const zoneRef = useRef<ZoneHudState>({
    phaseIndex: 1,
    phaseStatus: 'waiting',
    phaseTimerSec: ZONE_PHASES[0].waitSec,
    blueCenterX: 0,
    blueCenterZ: 0,
    blueRadius: INITIAL_BLUE_RADIUS,
    safeCenterX: 0,
    safeCenterZ: 0,
    safeRadius: ZONE_PHASES[0].targetRadius,
    damagePerSec: ZONE_PHASES[0].damagePerSec,
    playerOutsideZone: false,
  });
  const zoneInternalRef = useRef({
    idx: 0,
    startX: 0,
    startZ: 0,
    startR: INITIAL_BLUE_RADIUS,
    timer: ZONE_PHASES[0].waitSec,
  });

  const flightRef = useRef<FlightPathState>({
    startX: -195,
    startZ: 175,
    endX: 195,
    endZ: -175,
    planeX: -195,
    planeY: AIRCRAFT_ALTITUDE,
    planeZ: 175,
    planeYaw: Math.atan2(390, -350),
    canDrop: false,
    progress: 0,
  });

  // AI Bots (used ONLY in Solo Skirmish mode)
  const botsRef = useRef<BotEntity[]>(createMatchBots());
  const botHitMeshesRef = useRef<THREE.Object3D[]>([]);

  // Player physics & combat state
  const velRef = useRef(new THREE.Vector3(0, 0, 0));
  const charYawRef = useRef(Math.PI);
  const camYawRef = useRef(Math.PI);
  const camPitchRef = useRef(0.24);
  const camDistRef = useRef(settings.cameraDistance);
  const camPosSmoothRef = useRef(new THREE.Vector3(0, 14, -18));

  const isGroundedRef = useRef(true);
  const coyoteTimerRef = useRef(0);
  const jumpBufferTimerRef = useRef(0);
  const isCrouchingRef = useRef(false);
  const staminaRef = useRef(100);
  const healthRef = useRef(100);
  const armorRef = useRef(loadout.armorEquipped ? 50 : 0);
  const footstepTimerRef = useRef(0);
  const lastDamagedTickRef = useRef(0);

  // 3-Slot Weapon + Backpack Inventory
  const slotWeaponsRef = useRef<Record<1 | 2 | 3, WeaponId | null>>({
    1: loadout.primaryWeapon,
    2: loadout.secondaryWeapon,
    3: loadout.sidearmWeapon,
  });
  const ammoStateRef = useRef<Record<1 | 2 | 3, { mag: number; reserve: number }>>({
    1: { mag: WEAPONS[loadout.primaryWeapon].magSize, reserve: WEAPONS[loadout.primaryWeapon].reserveAmmo },
    2: { mag: WEAPONS[loadout.secondaryWeapon].magSize, reserve: WEAPONS[loadout.secondaryWeapon].reserveAmmo },
    3: { mag: WEAPONS[loadout.sidearmWeapon].magSize, reserve: WEAPONS[loadout.sidearmWeapon].reserveAmmo },
  });
  const medkitsRef = useRef(1);
  const bandagesRef = useRef(2);
  const backpackMaxKgRef = useRef(BASE_BACKPACK_CAPACITY_KG);

  const fireCooldownRef = useRef(0);
  const prevFireHeldRef = useRef(false);
  const reloadTimerRef = useRef(0);
  const reloadDurationRef = useRef(1.5);
  const hitMarkerTickRef = useRef(0);
  const lastHitHeadshotRef = useRef(false);
  const lastDamageRef = useRef<DamageFeedback | null>(null);
  const targetedEnemyRef = useRef<TargetedEnemyInfo | null>(null);
  const targetsHitCountRef = useRef(0);
  const hudSyncTimerRef = useRef(0);
  const netSendTimerRef = useRef(0);
  const prevScreenRef = useRef<GameScreen>(screen);

  // Pooled Tracers (14 slots) + Pooled Impact Sparks (14 slots)
  const tracerMeshesRef = useRef<(THREE.Mesh | null)[]>([]);
  const tracers = useMemo<TracerItem[]>(
    () =>
      Array.from({ length: 14 }, () => ({
        active: false,
        life: 0,
        start: new THREE.Vector3(),
        end: new THREE.Vector3(),
      })),
    [],
  );

  const impactMeshesRef = useRef<(THREE.Mesh | null)[]>([]);
  const impacts = useMemo<ImpactItem[]>(
    () =>
      Array.from({ length: 14 }, () => ({
        active: false,
        life: 0,
        pos: new THREE.Vector3(),
        isHeadshot: false,
      })),
    [],
  );

  // Helper to spawn tracer & impact
  const spawnTracer = (sx: number, sy: number, sz: number, ex: number, ey: number, ez: number) => {
    const slot = tracers.find((tr) => !tr.active) ?? tracers[0];
    slot.active = true;
    slot.life = 0.085;
    slot.start.set(sx, sy, sz);
    slot.end.set(ex, ey, ez);
  };

  const spawnImpact = (ix: number, iy: number, iz: number, isHeadshot: boolean) => {
    const slot = impacts.find((im) => !im.active) ?? impacts[0];
    slot.active = true;
    slot.life = 0.16;
    slot.pos.set(ix, iy, iz);
    slot.isHeadshot = isHeadshot;
  };

  // Reset match state whenever matchSessionId increments
  useEffect(() => {
    if (matchSessionId === 0) {
      // Initial menu overlook at Fort Aegis
      const mx = 0;
      const mz = -26;
      const my = getTerrainHeight(mx, mz);
      playerPosRef.current.set(mx, my, mz);
      if (operatorGroupRef.current) {
        operatorGroupRef.current.position.set(mx, my, mz);
        operatorGroupRef.current.rotation.y = Math.PI;
      }
      return;
    }

    // Launch a fresh match!
    lootItemsRef.current = createMatchLootItems();
    botsRef.current = matchMode === 'solo' ? createMatchBots() : [];
    matchPhaseRef.current = 'countdown';
    matchTimeRef.current = 0;
    countdownRef.current = PREFLIGHT_COUNTDOWN_SEC;
    killsRef.current = 0;
    damageDealtRef.current = 0;
    headshotsRef.current = 0;
    placementRef.current = 1;
    eliminationCauseRef.current = '';
    killFeedRef.current = [];
    healthRef.current = 100;
    armorRef.current = matchMode === 'solo' && loadout.armorEquipped ? 60 : 0;
    staminaRef.current = 100;
    isCrouchingRef.current = false;
    reloadTimerRef.current = 0;
    medkitsRef.current = 1;
    bandagesRef.current = 2;
    backpackMaxKgRef.current = BASE_BACKPACK_CAPACITY_KG;

    if (matchMode === 'solo') {
      slotWeaponsRef.current = {
        1: loadout.primaryWeapon,
        2: loadout.secondaryWeapon,
        3: loadout.sidearmWeapon,
      };
      ammoStateRef.current = {
        1: { mag: WEAPONS[loadout.primaryWeapon].magSize, reserve: WEAPONS[loadout.primaryWeapon].reserveAmmo },
        2: { mag: WEAPONS[loadout.secondaryWeapon].magSize, reserve: WEAPONS[loadout.secondaryWeapon].reserveAmmo },
        3: { mag: WEAPONS[loadout.sidearmWeapon].magSize, reserve: WEAPONS[loadout.sidearmWeapon].reserveAmmo },
      };
    } else {
      slotWeaponsRef.current = { 1: null, 2: null, 3: 'p45' };
      ammoStateRef.current = {
        1: { mag: 0, reserve: 0 },
        2: { mag: 0, reserve: 0 },
        3: { mag: WEAPONS.p45.magSize, reserve: 36 },
      };
      onActiveSlotChange(3);
    }

    const safeX = (Math.random() - 0.5) * 44;
    const safeZ = (Math.random() - 0.5) * 44;
    zoneRef.current = {
      phaseIndex: 1,
      phaseStatus: 'waiting',
      phaseTimerSec: ZONE_PHASES[0].waitSec,
      blueCenterX: 0,
      blueCenterZ: 0,
      blueRadius: INITIAL_BLUE_RADIUS,
      safeCenterX: safeX,
      safeCenterZ: safeZ,
      safeRadius: ZONE_PHASES[0].targetRadius,
      damagePerSec: ZONE_PHASES[0].damagePerSec,
      playerOutsideZone: false,
    };
    zoneInternalRef.current = {
      idx: 0,
      startX: 0,
      startZ: 0,
      startR: INITIAL_BLUE_RADIUS,
      timer: ZONE_PHASES[0].waitSec,
    };

    flightRef.current = {
      startX: -195,
      startZ: 175,
      endX: 195,
      endZ: -175,
      planeX: -195,
      planeY: AIRCRAFT_ALTITUDE,
      planeZ: 175,
      planeYaw: Math.atan2(390, -350),
      canDrop: false,
      progress: 0,
    };

    playerPosRef.current.set(-195, AIRCRAFT_ALTITUDE, 175);
    velRef.current.set(0, 0, 0);
  }, [matchSessionId, matchMode]);

  // Wire Multiplayer Server events when in multiplayer mode
  useEffect(() => {
    if (matchMode !== 'multiplayer') return;

    const applySnapshot = (snap: ServerMatchSnapshot) => {
      const meId = multiplayerClient.getUser()?.id;
      const remotes = snap.players.filter((p) => p.userId !== meId);
      onRemotePlayersUpdate(remotes);

      const me = snap.players.find((p) => p.userId === meId);
      if (me) {
        if (me.hp < healthRef.current) {
          lastDamagedTickRef.current += 1;
        }
        healthRef.current = me.hp;
        armorRef.current = me.armor;
        killsRef.current = me.kills;
        damageDealtRef.current = me.damageDealt;
        headshotsRef.current = me.headshots;
        placementRef.current = me.placement;
        eliminationCauseRef.current = me.eliminationCause;
        slotWeaponsRef.current = me.slots;
        ammoStateRef.current = me.ammo;
        medkitsRef.current = me.medkits;
        bandagesRef.current = me.bandages;
        backpackMaxKgRef.current = me.backpackMaxKg;
        if (me.activeSlot !== activeSlot && me.slots[me.activeSlot]) {
          onActiveSlotChange(me.activeSlot);
        }
        if (!me.alive && matchPhaseRef.current !== 'eliminated') {
          matchPhaseRef.current = 'eliminated';
        }
      }

      if (snap.phase === 'victory' || snap.phase === 'eliminated') {
        matchPhaseRef.current = snap.phase;
      } else if (snap.phase === 'countdown') {
        matchPhaseRef.current = 'countdown';
        countdownRef.current = snap.countdownSec;
      } else if (me?.isInAircraft) {
        matchPhaseRef.current = 'aircraft';
      } else if (me && me.alive) {
        if (
          matchPhaseRef.current === 'countdown' ||
          matchPhaseRef.current === 'aircraft'
        ) {
          playerPosRef.current.set(me.x, me.y, me.z);
          matchPhaseRef.current = me.isParachuting ? 'parachuting' : 'combat';
        }
      }

      matchTimeRef.current = snap.matchTimeSec;
      flightRef.current.startX = snap.aircraft.startX;
      flightRef.current.startZ = snap.aircraft.startZ;
      flightRef.current.endX = snap.aircraft.endX;
      flightRef.current.endZ = snap.aircraft.endZ;
      flightRef.current.planeX = snap.aircraft.planeX;
      flightRef.current.planeY = snap.aircraft.planeY;
      flightRef.current.planeZ = snap.aircraft.planeZ;
      flightRef.current.planeYaw = snap.aircraft.planeYaw;
      const fLen = Math.max(
        1,
        Math.hypot(snap.aircraft.endX - snap.aircraft.startX, snap.aircraft.endZ - snap.aircraft.startZ),
      );
      flightRef.current.progress = Math.min(1, (snap.matchTimeSec * AIRCRAFT_SPEED_MPS) / fLen);
      flightRef.current.canDrop = Boolean(me?.isInAircraft && snap.phase !== 'countdown');

      zoneRef.current = {
        ...snap.zone,
        playerOutsideZone:
          Math.hypot(
            playerPosRef.current.x - snap.zone.blueCenterX,
            playerPosRef.current.z - snap.zone.blueCenterZ,
          ) > snap.zone.blueRadius,
      };
      killFeedRef.current = snap.killFeed;
    };

    multiplayerClient.onMatchSync = (snap, loot) => {
      lootItemsRef.current = loot;
      applySnapshot(snap);
    };
    multiplayerClient.onMatchState = applySnapshot;
    multiplayerClient.onMatchFinished = applySnapshot;
    multiplayerClient.onLootCollected = (lootId) => {
      const item = lootItemsRef.current.find((l) => l.id === lootId);
      if (item) item.collected = true;
    };
    multiplayerClient.onShotFired = (evt) => {
      if (evt.shooterId === multiplayerClient.getUser()?.id) return;
      spawnTracer(
        evt.start[0],
        evt.start[1],
        evt.start[2],
        evt.end[0],
        evt.end[1],
        evt.end[2],
      );
      soundEngine.playShot(evt.weaponId);
    };
    multiplayerClient.onHitConfirmed = (evt) => {
      hitMarkerTickRef.current += 1;
      lastHitHeadshotRef.current = evt.isHeadshot;
      lastDamageRef.current = {
        amount: evt.amount,
        isHeadshot: evt.isHeadshot,
        weaponName: evt.weaponName,
        targetName: evt.victimCallsign,
        tick: hitMarkerTickRef.current,
      };
      soundEngine.playTargetHit(evt.isHeadshot);
    };
    multiplayerClient.onReconcile = (x, y, z) => {
      playerPosRef.current.set(x, y, z);
    };

    if (multiplayerClient.latestSnapshot) {
      if (multiplayerClient.latestLootItems.length > 0) {
        lootItemsRef.current = multiplayerClient.latestLootItems;
      }
      applySnapshot(multiplayerClient.latestSnapshot);
    }

    return () => {
      multiplayerClient.onMatchSync = undefined;
      multiplayerClient.onMatchState = undefined;
      multiplayerClient.onMatchFinished = undefined;
      multiplayerClient.onLootCollected = undefined;
      multiplayerClient.onShotFired = undefined;
      multiplayerClient.onHitConfirmed = undefined;
      multiplayerClient.onReconcile = undefined;
    };
  }, [matchMode, matchSessionId]);

  useEffect(() => {
    if (prevScreenRef.current !== 'playing' && screen === 'playing') {
      velRef.current.set(0, 0, 0);
    }
    prevScreenRef.current = screen;
    animStateRef.current.isMenuPreview = screen !== 'playing';
  }, [screen]);

  // Keep menu loadout synced when previewing in Menu
  useEffect(() => {
    if (screen === 'menu') {
      slotWeaponsRef.current = {
        1: loadout.primaryWeapon,
        2: loadout.secondaryWeapon,
        3: loadout.sidearmWeapon,
      };
    }
  }, [screen, loadout.primaryWeapon, loadout.secondaryWeapon, loadout.sidearmWeapon]);

  const activeWeaponId: WeaponId =
    slotWeaponsRef.current[activeSlot] ??
    slotWeaponsRef.current[1] ??
    slotWeaponsRef.current[3] ??
    'p45';

  useFrame((state, rawDelta) => {
    const dt = clampDelta(rawDelta);
    const input = inputRef.current;
    const pPos = playerPosRef.current;
    const vel = velRef.current;

    // 1. MENU / LOADING CINEMATIC CAMERA OVERLOOK
    if (screen !== 'playing') {
      const t = state.clock.elapsedTime;
      const orbitAngle = Math.PI + 0.42 + Math.sin(t * 0.24) * 0.38;
      const radius = 3.7;
      _desiredCamPos.set(
        pPos.x + Math.sin(orbitAngle) * radius,
        pPos.y + 1.85 + Math.sin(t * 0.35) * 0.14,
        pPos.z + Math.cos(orbitAngle) * radius,
      );
      camPosSmoothRef.current.lerp(_desiredCamPos, 1 - Math.exp(-4.5 * dt));
      camera.position.copy(camPosSmoothRef.current);
      _lookTarget.set(pPos.x - 0.65, pPos.y + 1.25, pPos.z - 0.8);
      camera.lookAt(_lookTarget);

      if (operatorGroupRef.current) {
        operatorGroupRef.current.position.copy(pPos);
        operatorGroupRef.current.rotation.y = dampAngle(
          operatorGroupRef.current.rotation.y,
          Math.PI + 0.16,
          6,
          dt,
        );
      }
      animStateRef.current.speedRatio = 0;
      animStateRef.current.isAiming = false;
      animStateRef.current.isCrouching = false;
      animStateRef.current.isGrounded = true;
      animStateRef.current.isParachuting = false;
      animStateRef.current.isSkydiving = false;
      animStateRef.current.isMenuPreview = true;
      return;
    }

    // 2. LOOK INPUT & CAMERA ROTATION
    const sens = 0.0024 * settings.mouseSensitivity;
    const ySign = settings.invertY ? -1 : 1;
    camYawRef.current = wrapAngle(camYawRef.current - input.lookDeltaX * sens);
    camPitchRef.current = THREE.MathUtils.clamp(
      camPitchRef.current + input.lookDeltaY * sens * ySign,
      -0.65,
      1.05,
    );
    input.lookDeltaX = 0;
    input.lookDeltaY = 0;

    if (input.zoomDelta !== 0) {
      camDistRef.current = THREE.MathUtils.clamp(camDistRef.current + input.zoomDelta * 0.004, 2.6, 8.0);
      input.zoomDelta = 0;
    }

    // 3. SOLO MATCH LIFECYCLE (Countdown -> Aircraft -> Zone -> AI Bots)
    if (matchMode === 'solo' && matchPhaseRef.current !== 'victory' && matchPhaseRef.current !== 'eliminated') {
      if (matchPhaseRef.current === 'countdown') {
        countdownRef.current = Math.max(0, countdownRef.current - dt);
        if (countdownRef.current === 0) {
          matchPhaseRef.current = 'aircraft';
          flightRef.current.canDrop = true;
        }
      } else {
        matchTimeRef.current += dt;
        const fl = flightRef.current;
        const fdx = fl.endX - fl.startX;
        const fdz = fl.endZ - fl.startZ;
        const fLen = Math.hypot(fdx, fdz);
        fl.progress = Math.min(1, (matchTimeRef.current * AIRCRAFT_SPEED_MPS) / fLen);
        fl.planeX = fl.startX + fdx * fl.progress;
        fl.planeZ = fl.startZ + fdz * fl.progress;
        fl.canDrop = matchPhaseRef.current === 'aircraft' && fl.progress > 0.05;

        if (matchPhaseRef.current === 'aircraft' && fl.progress >= 0.96) {
          matchPhaseRef.current = 'skydiving';
          pPos.set(fl.planeX, fl.planeY - 4, fl.planeZ);
          vel.set(0, -14, 0);
          soundEngine.playJump();
        }

        // Advance Zone Phases
        const zi = zoneInternalRef.current;
        const z = zoneRef.current;
        const cfg = ZONE_PHASES[zi.idx];
        if (cfg) {
          zi.timer -= dt;
          if (z.phaseStatus === 'waiting') {
            z.phaseTimerSec = Math.max(0, Math.ceil(zi.timer));
            if (zi.timer <= 0) {
              z.phaseStatus = 'shrinking';
              zi.timer = cfg.shrinkSec;
              zi.startX = z.blueCenterX;
              zi.startZ = z.blueCenterZ;
              zi.startR = z.blueRadius;
            }
          } else if (z.phaseStatus === 'shrinking') {
            z.phaseTimerSec = Math.max(0, Math.ceil(zi.timer));
            const p = 1 - Math.max(0, zi.timer) / cfg.shrinkSec;
            z.blueCenterX = zi.startX + (z.safeCenterX - zi.startX) * p;
            z.blueCenterZ = zi.startZ + (z.safeCenterZ - zi.startZ) * p;
            z.blueRadius = zi.startR + (z.safeRadius - zi.startR) * p;
            if (zi.timer <= 0) {
              if (zi.idx < ZONE_PHASES.length - 1) {
                zi.idx += 1;
                const nextCfg = ZONE_PHASES[zi.idx];
                z.phaseIndex = nextCfg.phase;
                z.phaseStatus = 'waiting';
                zi.timer = nextCfg.waitSec;
                z.phaseTimerSec = nextCfg.waitSec;
                z.safeRadius = nextCfg.targetRadius;
                z.damagePerSec = nextCfg.damagePerSec;
              } else {
                z.phaseStatus = 'final';
                z.phaseTimerSec = 0;
              }
            }
          }
        }

        // Step AI Bot Opponents
        const botRes = stepBotsSimulation(
          botsRef.current,
          dt,
          matchTimeRef.current,
          {
            x: pPos.x,
            y: pPos.y,
            z: pPos.z,
            alive: matchPhaseRef.current === 'combat',
            callsign: loadout.callsign,
          },
          z,
          lootItemsRef.current,
          settings.difficulty,
        );

        for (const tr of botRes.tracers) {
          spawnTracer(tr.startX, tr.startY, tr.startZ, tr.endX, tr.endY, tr.endZ);
        }
        if (botRes.eliminations.length > 0) {
          for (const el of botRes.eliminations) {
            killFeedRef.current.unshift({
              id: nextNoticeIdRef.current++,
              ...el,
              timestamp: Date.now(),
            });
          }
          if (killFeedRef.current.length > 6) killFeedRef.current.length = 6;
        }
        if (botRes.playerHitDamage > 0 && matchPhaseRef.current === 'combat') {
          const absorbed = Math.min(armorRef.current, botRes.playerHitDamage * 0.35);
          armorRef.current -= absorbed;
          healthRef.current = Math.max(0, healthRef.current - (botRes.playerHitDamage - absorbed));
          lastDamagedTickRef.current += 1;
          if (healthRef.current <= 0) {
            const aliveBots = botsRef.current.filter((b) => b.state !== 'eliminated').length;
            matchPhaseRef.current = 'eliminated';
            placementRef.current = aliveBots + 1;
            eliminationCauseRef.current = `Eliminated by ${botRes.playerHitShooter} (${botRes.playerHitWeapon})`;
            killFeedRef.current.unshift({
              id: nextNoticeIdRef.current++,
              killer: botRes.playerHitShooter,
              victim: loadout.callsign,
              weaponName: botRes.playerHitWeapon,
              isHeadshot: false,
              timestamp: Date.now(),
            });
          }
        }

        // Blue Zone storm damage on player
        const distFromZone = Math.hypot(pPos.x - z.blueCenterX, pPos.z - z.blueCenterZ);
        z.playerOutsideZone = distFromZone > z.blueRadius;
        if (z.playerOutsideZone && matchPhaseRef.current === 'combat') {
          healthRef.current = Math.max(0, healthRef.current - z.damagePerSec * dt);
          if (healthRef.current <= 0) {
            const aliveBots = botsRef.current.filter((b) => b.state !== 'eliminated').length;
            matchPhaseRef.current = 'eliminated';
            placementRef.current = aliveBots + 1;
            eliminationCauseRef.current = 'Eliminated by Blue Zone Storm';
          }
        }

        // Check Solo Victory
        const aliveBots = botsRef.current.filter((b) => b.state !== 'eliminated').length;
        if (aliveBots === 0 && healthRef.current > 0) {
          matchPhaseRef.current = 'victory';
          placementRef.current = 1;
        }
      }
    }

    // 4. AIRCRAFT / SKYDIVING / PARACHUTING / COMBAT MOVEMENT
    const phase = matchPhaseRef.current;

    if (phase === 'countdown' || phase === 'aircraft') {
      const fl = flightRef.current;
      pPos.set(fl.planeX, fl.planeY, fl.planeZ);
      if (operatorGroupRef.current) {
        operatorGroupRef.current.visible = false;
      }

      if (phase === 'aircraft' && (input.jumpPressed || input.interactPressed)) {
        input.jumpPressed = false;
        input.interactPressed = false;
        matchPhaseRef.current = 'skydiving';
        pPos.set(fl.planeX, fl.planeY - 4, fl.planeZ);
        vel.set(0, -14, 0);
        if (matchMode === 'multiplayer') {
          multiplayerClient.send({ type: 'player:drop' });
        }
        soundEngine.playJump();
      } else {
        input.jumpPressed = false;
        input.interactPressed = false;
      }

      // Aircraft external chase camera
      _camForward.set(-Math.sin(camYawRef.current), 0, -Math.cos(camYawRef.current)).normalize();
      const cosPitch = Math.cos(camPitchRef.current);
      const sinPitch = Math.sin(camPitchRef.current);
      _camDir.set(Math.sin(camYawRef.current) * cosPitch, sinPitch, Math.cos(camYawRef.current) * cosPitch);
      _desiredCamPos.set(fl.planeX, fl.planeY + 4, fl.planeZ).addScaledVector(_camDir, 24);
      camPosSmoothRef.current.lerp(_desiredCamPos, 1 - Math.exp(-10 * dt));
      camera.position.copy(camPosSmoothRef.current);
      _lookTarget.set(fl.planeX, fl.planeY, fl.planeZ);
      camera.lookAt(_lookTarget);
    } else if (phase === 'skydiving' || phase === 'parachuting') {
      if (operatorGroupRef.current) operatorGroupRef.current.visible = true;

      let moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0) + input.joyX;
      let moveZ = (input.backward ? 1 : 0) - (input.forward ? 1 : 0) + input.joyY;
      const mag = Math.hypot(moveX, moveZ);
      if (mag > 1) {
        moveX /= mag;
        moveZ /= mag;
      }
      _camForward.set(-Math.sin(camYawRef.current), 0, -Math.cos(camYawRef.current)).normalize();
      _camRight.set(Math.cos(camYawRef.current), 0, -Math.sin(camYawRef.current)).normalize();
      _moveDir.set(0, 0, 0).addScaledVector(_camForward, -moveZ).addScaledVector(_camRight, moveX);
      if (_moveDir.lengthSq() > 0.001) _moveDir.normalize();

      const groundY = Math.max(0.2, getWalkableHeight(pPos.x, pPos.z, pPos.y));
      const altAboveGround = pPos.y - groundY;

      // Deploy parachute manually with Space or automatically at 36m AGL
      if (phase === 'skydiving' && (input.jumpPressed || altAboveGround <= 36)) {
        input.jumpPressed = false;
        matchPhaseRef.current = 'parachuting';
        soundEngine.playJump();
      }
      input.jumpPressed = false;

      const isPara = matchPhaseRef.current === 'parachuting';
      const horizSpeed = isPara ? 14.5 : 22.0;
      const fallSpeed = isPara ? -8.5 : -28.0;

      vel.x = THREE.MathUtils.damp(vel.x, _moveDir.x * horizSpeed, 4.5, dt);
      vel.z = THREE.MathUtils.damp(vel.z, _moveDir.z * horizSpeed, 4.5, dt);
      vel.y = THREE.MathUtils.damp(vel.y, fallSpeed, 4.0, dt);

      pPos.x = THREE.MathUtils.clamp(pPos.x + vel.x * dt, -245, 245);
      pPos.z = THREE.MathUtils.clamp(pPos.z + vel.z * dt, -245, 245);
      pPos.y += vel.y * dt;

      if (pPos.y <= groundY) {
        pPos.y = groundY;
        vel.set(0, 0, 0);
        isGroundedRef.current = true;
        matchPhaseRef.current = 'combat';
        soundEngine.playLand();
      }

      if (_moveDir.lengthSq() > 0.05) {
        charYawRef.current = dampAngle(charYawRef.current, Math.atan2(_moveDir.x, _moveDir.z), 8, dt);
      }
      if (operatorGroupRef.current) {
        operatorGroupRef.current.position.copy(pPos);
        operatorGroupRef.current.rotation.y = charYawRef.current;
      }

      animStateRef.current.isSkydiving = matchPhaseRef.current === 'skydiving';
      animStateRef.current.isParachuting = matchPhaseRef.current === 'parachuting';
      animStateRef.current.isGrounded = false;

      const cosPitch = Math.cos(camPitchRef.current);
      const sinPitch = Math.sin(camPitchRef.current);
      _camDir.set(Math.sin(camYawRef.current) * cosPitch, sinPitch, Math.cos(camYawRef.current) * cosPitch);
      _pivotPos.set(pPos.x, pPos.y + 1.5, pPos.z);
      _desiredCamPos.copy(_pivotPos).addScaledVector(_camDir, isPara ? 7.5 : 6.2);
      const camGround = Math.max(0.5, getTerrainHeight(_desiredCamPos.x, _desiredCamPos.z) + 0.5);
      if (_desiredCamPos.y < camGround) _desiredCamPos.y = camGround;
      camPosSmoothRef.current.lerp(_desiredCamPos, 1 - Math.exp(-12 * dt));
      camera.position.copy(camPosSmoothRef.current);
      camera.lookAt(_pivotPos);
    } else {
      // COMBAT / VICTORY / ELIMINATED GROUND GAMEPLAY
      if (operatorGroupRef.current) operatorGroupRef.current.visible = true;
      animStateRef.current.isSkydiving = false;
      animStateRef.current.isParachuting = false;

      const isAlive = phase === 'combat';

      // Slot switching 1 / 2 / 3
      if (isAlive && input.switchSlot1Pressed) {
        input.switchSlot1Pressed = false;
        if (slotWeaponsRef.current[1] && activeSlot !== 1) {
          reloadTimerRef.current = 0;
          onActiveSlotChange(1);
          soundEngine.playUiClick();
        }
      }
      if (isAlive && input.switchSlot2Pressed) {
        input.switchSlot2Pressed = false;
        if (slotWeaponsRef.current[2] && activeSlot !== 2) {
          reloadTimerRef.current = 0;
          onActiveSlotChange(2);
          soundEngine.playUiClick();
        }
      }
      if (isAlive && input.switchSlot3Pressed) {
        input.switchSlot3Pressed = false;
        if (slotWeaponsRef.current[3] && activeSlot !== 3) {
          reloadTimerRef.current = 0;
          onActiveSlotChange(3);
          soundEngine.playUiClick();
        }
      }

      // Nearby loot scan & pickup (E key or mobile Loot button)
      let nearbyLoot: WorldLootItem | null = null;
      let bestLootDist = 3.2;
      for (let i = 0; i < lootItemsRef.current.length; i++) {
        const item = lootItemsRef.current[i];
        if (item.collected) continue;
        const d = Math.hypot(item.x - pPos.x, item.z - pPos.z);
        if (d < bestLootDist) {
          bestLootDist = d;
          nearbyLoot = item;
        }
      }

      if (isAlive && input.interactPressed) {
        input.interactPressed = false;
        if (nearbyLoot) {
          if (matchMode === 'multiplayer') {
            multiplayerClient.send({ type: 'player:loot', lootId: nearbyLoot.id });
            soundEngine.playPickup();
          } else {
            // Solo loot pickup with Backpack capacity validation
            const usedKg = computeBackpackUsedKg();
            if (nearbyLoot.weightKg === 0 || usedKg + nearbyLoot.weightKg <= backpackMaxKgRef.current) {
              nearbyLoot.collected = true;
              soundEngine.playPickup();
              if (nearbyLoot.type === 'weapon' && nearbyLoot.weaponId) {
                const sp = WEAPONS[nearbyLoot.weaponId];
                const tgtSlot: 1 | 2 | 3 =
                  sp.slotType === 'sidearm' ? 3 : !slotWeaponsRef.current[1] ? 1 : !slotWeaponsRef.current[2] ? 2 : activeSlot === 3 ? 1 : activeSlot;
                slotWeaponsRef.current[tgtSlot] = nearbyLoot.weaponId;
                ammoStateRef.current[tgtSlot] = { mag: sp.magSize, reserve: sp.reserveAmmo };
                onActiveSlotChange(tgtSlot);
              } else if (nearbyLoot.type === 'ammo' && nearbyLoot.ammoFor) {
                const matchSlot = ([1, 2, 3] as const).find((s) => slotWeaponsRef.current[s] === nearbyLoot!.ammoFor);
                const tgtSlot = matchSlot ?? activeSlot;
                ammoStateRef.current[tgtSlot].reserve += nearbyLoot.ammoAmount ?? 30;
              } else if (nearbyLoot.type === 'medkit') {
                medkitsRef.current += 1;
              } else if (nearbyLoot.type === 'bandage') {
                bandagesRef.current += 1;
              } else if (nearbyLoot.type === 'armor') {
                armorRef.current = Math.min(100, nearbyLoot.armorAmount ?? 80);
              } else if (nearbyLoot.type === 'backpack') {
                backpackMaxKgRef.current += nearbyLoot.capacityBonus ?? 14;
              }
            }
          }
        }
      }

      // Quick Heal (H key or Heal button)
      if (isAlive && input.healPressed) {
        input.healPressed = false;
        if (healthRef.current < 100) {
          if (matchMode === 'multiplayer') {
            multiplayerClient.send({ type: 'player:heal' });
            soundEngine.playPickup();
          } else if (medkitsRef.current > 0) {
            medkitsRef.current -= 1;
            healthRef.current = Math.min(100, healthRef.current + 50);
            soundEngine.playPickup();
          } else if (bandagesRef.current > 0) {
            bandagesRef.current -= 1;
            healthRef.current = Math.min(100, healthRef.current + 25);
            soundEngine.playPickup();
          }
        }
      }

      // Crouch & Jump
      if (isAlive && input.crouchTogglePressed) {
        input.crouchTogglePressed = false;
        isCrouchingRef.current = !isCrouchingRef.current;
        soundEngine.playUiClick();
      }
      if (isAlive && input.jumpPressed) {
        input.jumpPressed = false;
        jumpBufferTimerRef.current = 0.13;
        if (isCrouchingRef.current) isCrouchingRef.current = false;
      } else if (jumpBufferTimerRef.current > 0) {
        jumpBufferTimerRef.current = Math.max(0, jumpBufferTimerRef.current - dt);
      }

      let moveX = isAlive ? (input.right ? 1 : 0) - (input.left ? 1 : 0) + input.joyX : 0;
      let moveZ = isAlive ? (input.backward ? 1 : 0) - (input.forward ? 1 : 0) + input.joyY : 0;
      const inputMag = Math.hypot(moveX, moveZ);
      if (inputMag > 1) {
        moveX /= inputMag;
        moveZ /= inputMag;
      }
      const hasMoveInput = inputMag > 0.08;

      const isAiming = isAlive && input.aimHeld;
      const wantsSprint =
        isAlive && input.sprint && hasMoveInput && !isAiming && !isCrouchingRef.current && moveZ <= 0.2;
      const isSprinting = wantsSprint && staminaRef.current > 4;

      if (isSprinting) staminaRef.current = Math.max(0, staminaRef.current - dt * 22);
      else staminaRef.current = Math.min(100, staminaRef.current + dt * 16);

      let maxSpeed = RUN_SPEED;
      if (isCrouchingRef.current) maxSpeed = CROUCH_SPEED;
      else if (isAiming) maxSpeed = WALK_SPEED * 0.78;
      else if (isSprinting) maxSpeed = SPRINT_SPEED;
      else if (inputMag < 0.65) maxSpeed = WALK_SPEED;

      _camForward.set(-Math.sin(camYawRef.current), 0, -Math.cos(camYawRef.current)).normalize();
      _camRight.set(Math.cos(camYawRef.current), 0, -Math.sin(camYawRef.current)).normalize();
      _moveDir.set(0, 0, 0).addScaledVector(_camForward, -moveZ).addScaledVector(_camRight, moveX);
      if (_moveDir.lengthSq() > 0.0001) _moveDir.normalize();

      const targetVx = hasMoveInput ? _moveDir.x * maxSpeed * Math.min(1, inputMag) : 0;
      const targetVz = hasMoveInput ? _moveDir.z * maxSpeed * Math.min(1, inputMag) : 0;
      const accelRate = isGroundedRef.current ? (hasMoveInput ? GROUND_ACCEL : GROUND_DECEL) : AIR_ACCEL;

      vel.x = THREE.MathUtils.damp(vel.x, targetVx, accelRate, dt);
      vel.z = THREE.MathUtils.damp(vel.z, targetVz, accelRate, dt);

      if (isGroundedRef.current) coyoteTimerRef.current = 0.12;
      else coyoteTimerRef.current = Math.max(0, coyoteTimerRef.current - dt);

      if (jumpBufferTimerRef.current > 0 && coyoteTimerRef.current > 0) {
        vel.y = JUMP_SPEED;
        isGroundedRef.current = false;
        coyoteTimerRef.current = 0;
        jumpBufferTimerRef.current = 0;
        soundEngine.playJump();
      }

      vel.y -= GRAVITY * dt;

      const resolved = resolvePlayerCollisions(pPos.x + vel.x * dt, pPos.z + vel.z * dt, pPos.y, 0.46);
      pPos.x = resolved.x;
      pPos.z = resolved.z;
      pPos.y += vel.y * dt;

      const groundY = Math.max(0.15, getWalkableHeight(pPos.x, pPos.z, pPos.y));
      if (pPos.y <= groundY) {
        if (!isGroundedRef.current && vel.y < -4.5) soundEngine.playLand();
        pPos.y = groundY;
        vel.y = 0;
        isGroundedRef.current = true;
      } else if (pPos.y - groundY > 0.25) {
        isGroundedRef.current = false;
      }

      const cameraFacingYaw = wrapAngle(camYawRef.current + Math.PI);
      if (isAiming || (isAlive && input.fireHeld)) {
        charYawRef.current = dampAngle(charYawRef.current, cameraFacingYaw, 16, dt);
      } else if (hasMoveInput && _moveDir.lengthSq() > 0.02) {
        charYawRef.current = dampAngle(charYawRef.current, Math.atan2(_moveDir.x, _moveDir.z), 11, dt);
      }

      if (operatorGroupRef.current) {
        operatorGroupRef.current.position.copy(pPos);
        operatorGroupRef.current.rotation.y = charYawRef.current;
      }

      const horizSpeed = Math.hypot(vel.x, vel.z);
      if (isGroundedRef.current && horizSpeed > 1.2) {
        footstepTimerRef.current -= dt * (horizSpeed / 3.8);
        if (footstepTimerRef.current <= 0) {
          footstepTimerRef.current = 0.42;
          soundEngine.playFootstep(getSurfaceType(pPos.x, pPos.z));
        }
      } else {
        footstepTimerRef.current = 0.08;
      }

      // WEAPON RELOAD & SHOOTING (ALL 5 CATEGORIES)
      const weapon = WEAPONS[activeWeaponId];
      const slotAmmo = ammoStateRef.current[activeSlot];
      if (fireCooldownRef.current > 0) fireCooldownRef.current = Math.max(0, fireCooldownRef.current - dt);

      if (isAlive && input.reloadPressed) {
        input.reloadPressed = false;
        if (reloadTimerRef.current <= 0 && slotAmmo.mag < weapon.magSize && slotAmmo.reserve > 0) {
          reloadTimerRef.current = weapon.reloadTimeSec;
          reloadDurationRef.current = weapon.reloadTimeSec;
          soundEngine.playReload();
          if (matchMode === 'multiplayer') multiplayerClient.send({ type: 'player:reload' });
        }
      }

      if (reloadTimerRef.current > 0) {
        reloadTimerRef.current = Math.max(0, reloadTimerRef.current - dt);
        if (reloadTimerRef.current === 0 && matchMode === 'solo') {
          const needed = weapon.magSize - slotAmmo.mag;
          const transfer = Math.min(needed, slotAmmo.reserve);
          slotAmmo.mag += transfer;
          slotAmmo.reserve -= transfer;
        }
      }

      const justPressedFire = input.fireHeld && !prevFireHeldRef.current;
      prevFireHeldRef.current = input.fireHeld;
      const canTrigger = weapon.fireMode === 'auto' ? input.fireHeld : justPressedFire;

      if (isAlive && canTrigger && reloadTimerRef.current <= 0 && fireCooldownRef.current <= 0) {
        if (slotAmmo.mag > 0) {
          if (matchMode === 'solo') slotAmmo.mag -= 1;
          fireCooldownRef.current = 60 / weapon.fireRateRpm;
          animStateRef.current.recoilKick = 1.0;
          animStateRef.current.muzzleFlashTimer = 0.055;
          camPitchRef.current = Math.max(
            -0.65,
            camPitchRef.current - weapon.recoilPitch * (isAiming ? 0.55 : 1.0),
          );
          camYawRef.current = wrapAngle(
            camYawRef.current + (Math.random() - 0.5) * weapon.recoilYaw * 2,
          );
          soundEngine.playShot(activeWeaponId);

          _rayOrigin.copy(camera.position);
          camera.getWorldDirection(_rayDir);

          if (matchMode === 'multiplayer') {
            multiplayerClient.send({
              type: 'player:shoot',
              ox: _rayOrigin.x,
              oy: _rayOrigin.y,
              oz: _rayOrigin.z,
              dx: _rayDir.x,
              dy: _rayDir.y,
              dz: _rayDir.z,
            });
          }

          // Multi-pellet raycast (Shotgun = 8 pellets, others = 1)
          const baseSpread = isAiming ? weapon.adsSpread : weapon.hipSpread + horizSpeed * 0.002;
          const hitTargetsList =
            targetHitMeshesRef.current.length > 0 || botHitMeshesRef.current.length > 0
              ? [...targetHitMeshesRef.current, ...botHitMeshesRef.current]
              : [];

          let shotTotalDamage = 0;
          let shotAnyHeadshot = false;
          let shotTargetLabel = '';

          for (let pIdx = 0; pIdx < weapon.pellets; pIdx++) {
            const pDir = _rayDir.clone();
            pDir.x += (Math.random() - 0.5) * baseSpread * 2;
            pDir.y += (Math.random() - 0.5) * baseSpread * 2;
            pDir.z += (Math.random() - 0.5) * baseSpread * 2;
            pDir.normalize();

            _raycaster.set(_rayOrigin, pDir);
            _raycaster.far = weapon.range;

            const hits = hitTargetsList.length > 0 ? _raycaster.intersectObjects(hitTargetsList, false) : [];
            let hitDist = weapon.range;

            if (hits.length > 0 && matchMode === 'solo') {
              const hit = hits[0];
              hitDist = hit.distance;
              const isHead = hit.object.userData.hitZone === 'head';
              const pelletDmg = Math.round(weapon.damage * (isHead ? weapon.headshotMultiplier : 1.0));
              shotTotalDamage += pelletDmg;
              if (isHead) shotAnyHeadshot = true;

              const tgtId = hit.object.userData.targetId as string | undefined;
              const botId = hit.object.userData.botId as string | undefined;

              if (tgtId && targetHitStatesRef.current[tgtId]) {
                targetHitStatesRef.current[tgtId].recoilVel = -8.5;
                targetHitStatesRef.current[tgtId].flashTimer = 0.25;
                targetsHitCountRef.current += 1;
                shotTargetLabel = (hit.object.userData.targetLabel as string) || 'Range Plate';
                spawnImpact(hit.point.x, hit.point.y, hit.point.z, isHead);
              } else if (botId) {
                const bot = botsRef.current.find((b) => b.id === botId);
                if (bot && bot.state !== 'eliminated') {
                  shotTargetLabel = bot.callsign;
                  const absorbed = Math.min(bot.armor, pelletDmg * 0.3);
                  bot.armor -= absorbed;
                  bot.hp = Math.max(0, bot.hp - (pelletDmg - absorbed));
                  bot.lastHitTime = matchTimeRef.current;
                  damageDealtRef.current += pelletDmg;
                  if (isHead) headshotsRef.current += 1;
                  targetedEnemyRef.current = {
                    callsign: bot.callsign,
                    hp: Math.round(bot.hp),
                    maxHp: bot.maxHp,
                    distanceM: Math.round(hit.distance),
                  };
                  spawnImpact(hit.point.x, hit.point.y, hit.point.z, isHead);

                  if (bot.hp <= 0) {
                    bot.state = 'eliminated';
                    killsRef.current += 1;
                    killFeedRef.current.unshift({
                      id: nextNoticeIdRef.current++,
                      killer: loadout.callsign,
                      victim: bot.callsign,
                      weaponName: weapon.name,
                      isHeadshot: isHead,
                      timestamp: Date.now(),
                    });
                    if (killFeedRef.current.length > 6) killFeedRef.current.length = 6;
                  }
                }
              }
            } else {
              // Check terrain impact distance for visual spark
              const endPt = _rayOrigin.clone().addScaledVector(pDir, Math.min(80, weapon.range));
              const terrY = getTerrainHeight(endPt.x, endPt.z);
              if (endPt.y <= terrY + 0.4) {
                spawnImpact(endPt.x, terrY + 0.1, endPt.z, false);
              }
            }

            if (pIdx === 0 || pIdx % 2 === 0) {
              spawnTracer(
                pPos.x + Math.sin(charYawRef.current) * 0.65,
                pPos.y + (isCrouchingRef.current ? 1.0 : 1.38),
                pPos.z + Math.cos(charYawRef.current) * 0.65,
                _rayOrigin.x + pDir.x * Math.min(hitDist, 140),
                _rayOrigin.y + pDir.y * Math.min(hitDist, 140),
                _rayOrigin.z + pDir.z * Math.min(hitDist, 140),
              );
            }
          }

          if (shotTotalDamage > 0) {
            hitMarkerTickRef.current += 1;
            lastHitHeadshotRef.current = shotAnyHeadshot;
            lastDamageRef.current = {
              amount: shotTotalDamage,
              isHeadshot: shotAnyHeadshot,
              weaponName: weapon.name,
              targetName: shotTargetLabel,
              tick: hitMarkerTickRef.current,
            };
            soundEngine.playTargetHit(shotAnyHeadshot);
          }
        } else if (slotAmmo.reserve > 0) {
          reloadTimerRef.current = weapon.reloadTimeSec;
          reloadDurationRef.current = weapon.reloadTimeSec;
          soundEngine.playReload();
          if (matchMode === 'multiplayer') multiplayerClient.send({ type: 'player:reload' });
        }
      }

      animStateRef.current.recoilKick = THREE.MathUtils.damp(animStateRef.current.recoilKick, 0, 16, dt);
      if (animStateRef.current.muzzleFlashTimer > 0) {
        animStateRef.current.muzzleFlashTimer = Math.max(0, animStateRef.current.muzzleFlashTimer - dt);
      }
      animStateRef.current.speedRatio = THREE.MathUtils.clamp(horizSpeed / SPRINT_SPEED, 0, 1);
      animStateRef.current.isGrounded = isGroundedRef.current;
      animStateRef.current.isCrouching = isCrouchingRef.current;
      animStateRef.current.isAiming = isAiming || (isAlive && input.fireHeld);
      animStateRef.current.isReloading = reloadTimerRef.current > 0;
      animStateRef.current.isMenuPreview = false;
      animStateRef.current.aimPitch = camPitchRef.current;

      // THIRD-PERSON CAMERA FOLLOW + COLLISION PREVENTION
      const shoulderOffset = isAiming ? 0.62 : 0.48;
      const pivotHeight = isCrouchingRef.current ? 1.12 : 1.48;
      _pivotPos.set(
        pPos.x + _camRight.x * shoulderOffset,
        pPos.y + pivotHeight,
        pPos.z + _camRight.z * shoulderOffset,
      );
      const targetCamDist = isAiming ? Math.max(1.75, camDistRef.current * 0.45) : camDistRef.current;
      const cosPitch = Math.cos(camPitchRef.current);
      const sinPitch = Math.sin(camPitchRef.current);
      _camDir
        .set(Math.sin(camYawRef.current) * cosPitch, sinPitch, Math.cos(camYawRef.current) * cosPitch)
        .normalize();

      let safeDist = targetCamDist;
      for (let i = 0; i < worldData.boxColliders.length; i++) {
        const b = worldData.boxColliders[i];
        const hitT = intersectRayBox(
          _pivotPos.x,
          _pivotPos.y,
          _pivotPos.z,
          _camDir.x,
          _camDir.y,
          _camDir.z,
          safeDist,
          b.minX - 0.25,
          b.maxX + 0.25,
          b.minY - 0.25,
          b.maxY + 0.25,
          b.minZ - 0.25,
          b.maxZ + 0.25,
        );
        if (hitT < safeDist) safeDist = Math.max(0.7, hitT - 0.15);
      }
      _desiredCamPos.copy(_pivotPos).addScaledVector(_camDir, safeDist);
      const camGround = Math.max(0.4, getTerrainHeight(_desiredCamPos.x, _desiredCamPos.z) + 0.45);
      if (_desiredCamPos.y < camGround) _desiredCamPos.y = camGround;

      camPosSmoothRef.current.lerp(_desiredCamPos, 1 - Math.exp(-18 * dt));
      camera.position.copy(camPosSmoothRef.current);
      _lookTarget.copy(_pivotPos).addScaledVector(_camForward, 14).setY(_pivotPos.y - sinPitch * 10);
      camera.lookAt(_lookTarget);

      const persp = camera as THREE.PerspectiveCamera;
      if (persp.isPerspectiveCamera) {
        const targetFov = isAiming
          ? Math.max(22, settings.cameraFov - weapon.adsFovDelta)
          : isSprinting
            ? settings.cameraFov + 6
            : settings.cameraFov;
        if (Math.abs(persp.fov - targetFov) > 0.05) {
          persp.fov = THREE.MathUtils.damp(persp.fov, targetFov, 12, dt);
          persp.updateProjectionMatrix();
        }
      }
    }

    // Update Tracer & Impact pools
    for (let i = 0; i < tracers.length; i++) {
      const tr = tracers[i];
      const mesh = tracerMeshesRef.current[i];
      if (!mesh) continue;
      if (!tr.active) {
        mesh.visible = false;
        continue;
      }
      tr.life -= dt;
      if (tr.life <= 0) {
        tr.active = false;
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      _tracerMid.addVectors(tr.start, tr.end).multiplyScalar(0.5);
      mesh.position.copy(_tracerMid);
      _camDir.subVectors(tr.end, tr.start);
      const len = Math.max(0.1, _camDir.length());
      _camDir.normalize();
      _tracerQuat.setFromUnitVectors(_tracerUp, _camDir);
      mesh.quaternion.copy(_tracerQuat);
      mesh.scale.set(1, len, 1);
    }

    for (let i = 0; i < impacts.length; i++) {
      const im = impacts[i];
      const mesh = impactMeshesRef.current[i];
      if (!mesh) continue;
      if (!im.active) {
        mesh.visible = false;
        continue;
      }
      im.life -= dt;
      if (im.life <= 0) {
        im.active = false;
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      mesh.position.copy(im.pos);
      const s = 0.8 + (0.16 - im.life) * 8;
      mesh.scale.setScalar(s);
    }

    // Send throttled player movement to server in Multiplayer mode (20Hz)
    if (matchMode === 'multiplayer' && phase !== 'countdown' && phase !== 'aircraft') {
      netSendTimerRef.current += dt;
      if (netSendTimerRef.current >= 0.05) {
        netSendTimerRef.current = 0;
        multiplayerClient.send({
          type: 'player:move',
          x: pPos.x,
          y: pPos.y,
          z: pPos.z,
          yaw: charYawRef.current,
          isCrouching: isCrouchingRef.current,
          isSprinting: animStateRef.current.speedRatio > 0.78,
          isAiming: animStateRef.current.isAiming,
          isParachuting: matchPhaseRef.current === 'parachuting',
          activeSlot,
        });
      }
    }

    // Throttled HUD sync (~20Hz)
    hudSyncTimerRef.current += dt;
    if (hudSyncTimerRef.current >= 0.05) {
      hudSyncTimerRef.current = 0;
      const headingDeg = ((THREE.MathUtils.radToDeg(camYawRef.current + Math.PI) % 360) + 360) % 360;
      const slotAmmo = ammoStateRef.current[activeSlot];
      const wSpec = WEAPONS[activeWeaponId];

      let nearbyLoot: WorldLootItem | null = null;
      let minLd = 3.2;
      for (let i = 0; i < lootItemsRef.current.length; i++) {
        const it = lootItemsRef.current[i];
        if (it.collected) continue;
        const d = Math.hypot(it.x - pPos.x, it.z - pPos.z);
        if (d < minLd) {
          minLd = d;
          nearbyLoot = it;
        }
      }

      const aliveCount =
        matchMode === 'solo'
          ? botsRef.current.filter((b) => b.state !== 'eliminated').length + (healthRef.current > 0 ? 1 : 0)
          : Math.max(1, remotePlayers.filter((r) => r.alive).length + (healthRef.current > 0 ? 1 : 0));

      const totalPlayers =
        matchMode === 'solo' ? TOTAL_MATCH_COMBATANTS : Math.max(1, remotePlayers.length + 1);

      const backpackItems: BackpackItem[] = [];
      if (medkitsRef.current > 0) {
        backpackItems.push({
          id: 'bp-medkit',
          type: 'medkit',
          name: 'Field Medkit (+50 HP)',
          quantity: medkitsRef.current,
          weightEachKg: 1.5,
          healAmount: 50,
        });
      }
      if (bandagesRef.current > 0) {
        backpackItems.push({
          id: 'bp-bandage',
          type: 'bandage',
          name: 'Bandage Pack (+25 HP)',
          quantity: bandagesRef.current,
          weightEachKg: 0.4,
          healAmount: 25,
        });
      }
      ([1, 2, 3] as const).forEach((s) => {
        const wid = slotWeaponsRef.current[s];
        if (wid && ammoStateRef.current[s].reserve > 0) {
          backpackItems.push({
            id: `bp-ammo-${s}`,
            type: 'ammo',
            name: `${WEAPONS[wid].caliber} Reserve`,
            quantity: ammoStateRef.current[s].reserve,
            weightEachKg: 0.015,
            ammoFor: wid,
          });
        }
      });

      onHudUpdate({
        matchPhase: matchPhaseRef.current,
        matchTimeSec: matchTimeRef.current,
        countdownSec: countdownRef.current,
        aliveCount,
        totalPlayers,
        kills: killsRef.current,
        damageDealt: Math.round(damageDealtRef.current),
        headshots: headshotsRef.current,
        placement: placementRef.current,
        eliminationCause: eliminationCauseRef.current,
        health: Math.round(healthRef.current),
        maxHealth: 100,
        armor: Math.round(armorRef.current),
        maxArmor: 100,
        stamina: Math.round(staminaRef.current),
        maxStamina: 100,
        altitudeM: Math.max(0, Math.round(pPos.y - getTerrainHeight(pPos.x, pPos.z))),
        headingDeg: Math.round(headingDeg),
        activeSlot,
        activeWeaponId,
        slotWeapons: { ...slotWeaponsRef.current },
        ammoInMag: slotAmmo.mag,
        reserveAmmo: slotAmmo.reserve,
        isReloading: reloadTimerRef.current > 0,
        reloadProgress:
          reloadTimerRef.current > 0 ? 1 - reloadTimerRef.current / reloadDurationRef.current : 0,
        isAiming: animStateRef.current.isAiming,
        isCrouching: isCrouchingRef.current,
        isSprinting: animStateRef.current.speedRatio > 0.78,
        isGrounded: isGroundedRef.current,
        speedMps: Number(Math.hypot(vel.x, vel.z).toFixed(1)),
        playerX: pPos.x,
        playerZ: pPos.z,
        hitMarkerTick: hitMarkerTickRef.current,
        lastHitHeadshot: lastHitHeadshotRef.current,
        lastDamage: lastDamageRef.current,
        targetedEnemy: targetedEnemyRef.current,
        targetsHitCount: targetsHitCountRef.current,
        nearbyLoot,
        backpackUsedKg: computeBackpackUsedKg(),
        backpackMaxKg: backpackMaxKgRef.current,
        backpackItems,
        zone: { ...zoneRef.current },
        flight: { ...flightRef.current },
        killFeed: [...killFeedRef.current],
        pointerLocked: document.pointerLockElement !== null,
        surfaceLabel: wSpec.name,
        lastDamagedByTick: lastDamagedTickRef.current,
      });
    }
  });

  function computeBackpackUsedKg(): number {
    let kg = 0;
    ([1, 2, 3] as const).forEach((s) => {
      const wid = slotWeaponsRef.current[s];
      if (wid) {
        kg += WEAPONS[wid].weightKg;
        kg += Math.ceil(ammoStateRef.current[s].reserve / 30) * 0.4;
      }
    });
    kg += medkitsRef.current * 1.5 + bandagesRef.current * 0.4;
    return Number(kg.toFixed(1));
  }

  return (
    <>
      <OperatorModel
        loadout={loadout}
        activeWeaponId={activeWeaponId}
        animStateRef={animStateRef}
        groupRef={operatorGroupRef}
        shadowsEnabled={settings.shadowsEnabled}
        isSoftwareGl={isSoftwareGl}
      />

      <ZoneAndAircraft matchPhase={matchPhaseRef.current} zoneRef={zoneRef} flightRef={flightRef} />

      {matchMode === 'solo' && (
        <BotActors
          botsRef={botsRef}
          botHitMeshesRef={botHitMeshesRef}
          shadowsEnabled={settings.shadowsEnabled}
          isSoftwareGl={isSoftwareGl}
        />
      )}

      {matchMode === 'multiplayer' && (
        <RemotePlayers
          remotePlayers={remotePlayers}
          shadowsEnabled={settings.shadowsEnabled}
          isSoftwareGl={isSoftwareGl}
        />
      )}

      {/* Pooled Bullet Tracer Meshes */}
      {tracers.map((_, i) => (
        <mesh
          key={`tr-${i}`}
          ref={(el) => {
            tracerMeshesRef.current[i] = el;
          }}
          visible={false}
          frustumCulled={false}
        >
          <cylinderGeometry args={[0.018, 0.018, 1, 5]} />
          <meshBasicMaterial color="#fde68a" transparent opacity={0.9} />
        </mesh>
      ))}

      {/* Pooled Bullet Impact Spark Meshes */}
      {impacts.map((_, i) => (
        <mesh
          key={`imp-${i}`}
          ref={(el) => {
            impactMeshesRef.current[i] = el;
          }}
          visible={false}
          frustumCulled={false}
        >
          <octahedronGeometry args={[0.18, 0]} />
          <meshBasicMaterial color="#fb923c" transparent opacity={0.92} />
        </mesh>
      ))}
    </>
  );
}
