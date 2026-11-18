import { WebSocket } from 'ws';
import { createMatchLootItems } from '../src/data/lootSpawns';
import {
  AIRCRAFT_ALTITUDE,
  AIRCRAFT_SPEED_MPS,
  BASE_BACKPACK_CAPACITY_KG,
  INITIAL_BLUE_RADIUS,
  PREFLIGHT_COUNTDOWN_SEC,
  ZONE_PHASES,
} from '../src/data/matchConfig';
import { WEAPONS } from '../src/data/weapons';
import {
  CamoId,
  EliminationNotice,
  HelmetId,
  MatchPhase,
  WeaponId,
  WorldLootItem,
} from '../src/types/game';
import { getWalkableHeight } from '../src/world/terrainMath';
import { recordMatchStats } from './authStore';

export const TEST_MATCH_MAX_PLAYERS = 4; // Small 4-player real test match (architected per room shard)
const TICK_RATE_HZ = 20;
const RECONNECT_GRACE_MS = 45000;

export interface ServerPlayerState {
  userId: string;
  callsign: string;
  ws: WebSocket | null;
  connected: boolean;
  disconnectedAt: number | null;
  ready: boolean;
  isHost: boolean;
  camo: CamoId;
  helmet: HelmetId;
  x: number;
  y: number;
  z: number;
  yaw: number;
  vy: number;
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
  reloadingUntil: number;
  lastFireAt: number;
  lastMoveAt: number;
  speedViolations: number;
}

export interface RoomSummary {
  roomId: string;
  code: string;
  name: string;
  hostCallsign: string;
  playerCount: number;
  maxPlayers: number;
  status: 'lobby' | 'in_match' | 'finished';
  players: {
    userId: string;
    callsign: string;
    ready: boolean;
    isHost: boolean;
    connected: boolean;
  }[];
}

export interface RoomInstance {
  roomId: string;
  code: string;
  name: string;
  maxPlayers: number;
  status: 'lobby' | 'in_match' | 'finished';
  phase: MatchPhase;
  matchTimeSec: number;
  countdownSec: number;
  players: Map<string, ServerPlayerState>;
  lootItems: WorldLootItem[];
  killFeed: EliminationNotice[];
  nextKillId: number;
  // Aircraft state
  flightStartX: number;
  flightStartZ: number;
  flightEndX: number;
  flightEndZ: number;
  planeX: number;
  planeY: number;
  planeZ: number;
  planeYaw: number;
  // Safe / Blue zone state
  zonePhaseIdx: number;
  zoneStatus: 'waiting' | 'shrinking' | 'final';
  zoneTimerSec: number;
  blueCenterX: number;
  blueCenterZ: number;
  blueRadius: number;
  startBlueX: number;
  startBlueZ: number;
  startBlueR: number;
  safeCenterX: number;
  safeCenterZ: number;
  safeRadius: number;
  damagePerSec: number;
  statsRecorded: boolean;
}

const rooms = new Map<string, RoomInstance>();
const userToRoom = new Map<string, string>();
let roomCounter = 1;

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function createPlayerState(
  userId: string,
  callsign: string,
  ws: WebSocket,
  isHost: boolean,
  camo: CamoId = 'olive',
  helmet: HelmetId = 'tactical_ops',
): ServerPlayerState {
  return {
    userId,
    callsign,
    ws,
    connected: true,
    disconnectedAt: null,
    ready: isHost,
    isHost,
    camo,
    helmet,
    x: -180,
    y: AIRCRAFT_ALTITUDE,
    z: 165,
    yaw: Math.PI,
    vy: 0,
    isCrouching: false,
    isSprinting: false,
    isAiming: false,
    isParachuting: false,
    isInAircraft: true,
    hp: 100,
    armor: 0,
    alive: true,
    kills: 0,
    damageDealt: 0,
    headshots: 0,
    placement: 0,
    eliminationCause: '',
    activeSlot: 3,
    slots: { 1: null, 2: null, 3: 'p45' },
    ammo: {
      1: { mag: 0, reserve: 0 },
      2: { mag: 0, reserve: 0 },
      3: { mag: WEAPONS.p45.magSize, reserve: 36 },
    },
    medkits: 0,
    bandages: 2,
    backpackMaxKg: BASE_BACKPACK_CAPACITY_KG,
    reloadingUntil: 0,
    lastFireAt: 0,
    lastMoveAt: Date.now(),
    speedViolations: 0,
  };
}

function computeBackpackUsedKg(p: ServerPlayerState): number {
  let kg = 0;
  ([1, 2, 3] as const).forEach((s) => {
    const wid = p.slots[s];
    if (wid) {
      kg += WEAPONS[wid].weightKg;
      kg += Math.ceil(p.ammo[s].reserve / 30) * 0.4;
    }
  });
  kg += p.medkits * 1.5 + p.bandages * 0.4;
  return Number(kg.toFixed(1));
}

export function serializeRoomSummary(room: RoomInstance): RoomSummary {
  const playersArr = Array.from(room.players.values());
  const host = playersArr.find((p) => p.isHost) ?? playersArr[0];
  return {
    roomId: room.roomId,
    code: room.code,
    name: room.name,
    hostCallsign: host?.callsign ?? 'Host',
    playerCount: playersArr.length,
    maxPlayers: room.maxPlayers,
    status: room.status,
    players: playersArr.map((p) => ({
      userId: p.userId,
      callsign: p.callsign,
      ready: p.ready,
      isHost: p.isHost,
      connected: p.connected,
    })),
  };
}

export function listOpenRooms(): RoomSummary[] {
  const list: RoomSummary[] = [];
  rooms.forEach((room) => {
    if (room.status === 'lobby' && room.players.size < room.maxPlayers) {
      list.push(serializeRoomSummary(room));
    }
  });
  return list;
}

function sendJson(ws: WebSocket | null, payload: unknown): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

function broadcastRoom(room: RoomInstance, payload: unknown): void {
  const raw = JSON.stringify(payload);
  room.players.forEach((p) => {
    if (p.ws && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(raw);
    }
  });
}

export function createRoomForUser(
  userId: string,
  callsign: string,
  ws: WebSocket,
  roomName?: string,
): RoomInstance {
  leaveCurrentRoom(userId);
  const roomId = `room_${roomCounter++}`;
  const code = generateRoomCode();
  const room: RoomInstance = {
    roomId,
    code,
    name: roomName?.trim() || `${callsign}'s Squad Match`,
    maxPlayers: TEST_MATCH_MAX_PLAYERS,
    status: 'lobby',
    phase: 'countdown',
    matchTimeSec: 0,
    countdownSec: PREFLIGHT_COUNTDOWN_SEC,
    players: new Map(),
    lootItems: createMatchLootItems(),
    killFeed: [],
    nextKillId: 1,
    flightStartX: -195,
    flightStartZ: 175,
    flightEndX: 195,
    flightEndZ: -175,
    planeX: -195,
    planeY: AIRCRAFT_ALTITUDE,
    planeZ: 175,
    planeYaw: Math.atan2(390, -350),
    zonePhaseIdx: 0,
    zoneStatus: 'waiting',
    zoneTimerSec: ZONE_PHASES[0].waitSec,
    blueCenterX: 0,
    blueCenterZ: 0,
    blueRadius: INITIAL_BLUE_RADIUS,
    startBlueX: 0,
    startBlueZ: 0,
    startBlueR: INITIAL_BLUE_RADIUS,
    safeCenterX: (Math.random() - 0.5) * 45,
    safeCenterZ: (Math.random() - 0.5) * 45,
    safeRadius: ZONE_PHASES[0].targetRadius,
    damagePerSec: ZONE_PHASES[0].damagePerSec,
    statsRecorded: false,
  };
  const hostPlayer = createPlayerState(userId, callsign, ws, true);
  room.players.set(userId, hostPlayer);
  rooms.set(roomId, room);
  userToRoom.set(userId, roomId);
  broadcastRoom(room, { type: 'room:update', room: serializeRoomSummary(room) });
  return room;
}

export function joinRoomByCodeOrId(
  userId: string,
  callsign: string,
  ws: WebSocket,
  codeOrId: string,
): { ok: true; room: RoomInstance } | { ok: false; error: string } {
  const normalized = codeOrId.trim().toUpperCase();
  let target: RoomInstance | undefined;
  rooms.forEach((r) => {
    if (r.roomId === codeOrId.trim() || r.code === normalized) {
      target = r;
    }
  });
  if (!target) {
    return { ok: false, error: 'Room not found. Check the 6-character room code.' };
  }

  // Reconnect path if user already belongs to this active room
  const existing = target.players.get(userId);
  if (existing) {
    existing.ws = ws;
    existing.connected = true;
    existing.disconnectedAt = null;
    userToRoom.set(userId, target.roomId);
    sendJson(ws, { type: 'room:update', room: serializeRoomSummary(target) });
    if (target.status === 'in_match') {
      sendFullMatchSync(target, existing);
    }
    broadcastRoom(target, {
      type: 'presence:update',
      userId,
      callsign,
      connected: true,
    });
    return { ok: true, room: target };
  }

  if (target.status !== 'lobby') {
    return { ok: false, error: 'Match has already launched in that room.' };
  }
  if (target.players.size >= target.maxPlayers) {
    return { ok: false, error: `Room is full (${target.maxPlayers}/${target.maxPlayers} players).` };
  }

  leaveCurrentRoom(userId);
  const player = createPlayerState(userId, callsign, ws, false);
  target.players.set(userId, player);
  userToRoom.set(userId, target.roomId);
  broadcastRoom(target, { type: 'room:update', room: serializeRoomSummary(target) });
  return { ok: true, room: target };
}

export function matchmakeUser(
  userId: string,
  callsign: string,
  ws: WebSocket,
): RoomInstance {
  // Check if user is already reconnecting to an active match
  const activeRoomId = userToRoom.get(userId);
  if (activeRoomId) {
    const activeRoom = rooms.get(activeRoomId);
    const existing = activeRoom?.players.get(userId);
    if (activeRoom && existing && activeRoom.status === 'in_match') {
      existing.ws = ws;
      existing.connected = true;
      existing.disconnectedAt = null;
      sendFullMatchSync(activeRoom, existing);
      return activeRoom;
    }
  }

  let bestRoom: RoomInstance | null = null;
  rooms.forEach((r) => {
    if (r.status === 'lobby' && r.players.size < r.maxPlayers) {
      if (!bestRoom || r.players.size > bestRoom.players.size) {
        bestRoom = r;
      }
    }
  });

  if (bestRoom) {
    const res = joinRoomByCodeOrId(userId, callsign, ws, (bestRoom as RoomInstance).roomId);
    if (res.ok) return res.room;
  }
  return createRoomForUser(userId, callsign, ws, 'Public Test Skirmish');
}

export function leaveCurrentRoom(userId: string): void {
  const roomId = userToRoom.get(userId);
  if (!roomId) return;
  const room = rooms.get(roomId);
  userToRoom.delete(userId);
  if (!room) return;

  room.players.delete(userId);
  if (room.players.size === 0) {
    rooms.delete(roomId);
    return;
  }

  const remaining = Array.from(room.players.values());
  if (!remaining.some((p) => p.isHost)) {
    remaining[0].isHost = true;
    remaining[0].ready = true;
  }
  broadcastRoom(room, { type: 'room:update', room: serializeRoomSummary(room) });
}

export function handleUserDisconnect(userId: string, ws: WebSocket): void {
  const roomId = userToRoom.get(userId);
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) return;
  const player = room.players.get(userId);
  if (!player || player.ws !== ws) return;

  if (room.status === 'lobby') {
    leaveCurrentRoom(userId);
    return;
  }

  // Keep player slot alive during reconnect grace window
  player.connected = false;
  player.ws = null;
  player.disconnectedAt = Date.now();
  broadcastRoom(room, {
    type: 'presence:update',
    userId,
    callsign: player.callsign,
    connected: false,
  });
}

export function startRoomMatch(
  userId: string,
): { ok: true } | { ok: false; error: string } {
  const roomId = userToRoom.get(userId);
  if (!roomId) return { ok: false, error: 'You are not in a room.' };
  const room = rooms.get(roomId);
  if (!room) return { ok: false, error: 'Room not found.' };
  const requester = room.players.get(userId);
  if (!requester?.isHost) return { ok: false, error: 'Only the room host can launch the match.' };
  if (room.players.size < 2) {
    return {
      ok: false,
      error: 'At least 2 real connected players are required to launch a multiplayer match.',
    };
  }

  room.status = 'in_match';
  room.phase = 'countdown';
  room.matchTimeSec = 0;
  room.countdownSec = PREFLIGHT_COUNTDOWN_SEC;
  room.lootItems = createMatchLootItems();
  room.killFeed = [];
  room.statsRecorded = false;

  room.players.forEach((p) => {
    p.x = room.flightStartX;
    p.y = AIRCRAFT_ALTITUDE;
    p.z = room.flightStartZ;
    p.isInAircraft = true;
    p.isParachuting = false;
    p.alive = true;
    p.hp = 100;
    p.armor = 0;
    p.kills = 0;
    p.damageDealt = 0;
    p.headshots = 0;
    p.activeSlot = 3;
    p.slots = { 1: null, 2: null, 3: 'p45' };
    p.ammo = {
      1: { mag: 0, reserve: 0 },
      2: { mag: 0, reserve: 0 },
      3: { mag: WEAPONS.p45.magSize, reserve: 36 },
    };
    p.medkits = 0;
    p.bandages = 2;
    p.backpackMaxKg = BASE_BACKPACK_CAPACITY_KG;
  });

  broadcastRoom(room, {
    type: 'match:started',
    room: serializeRoomSummary(room),
  });
  room.players.forEach((p) => sendFullMatchSync(room, p));
  return { ok: true };
}

function sendFullMatchSync(room: RoomInstance, target: ServerPlayerState): void {
  sendJson(target.ws, {
    type: 'match:sync',
    snapshot: buildSnapshot(room),
    lootItems: room.lootItems.filter((l) => !l.collected),
  });
}

function buildSnapshot(room: RoomInstance) {
  const players = Array.from(room.players.values()).map((p) => ({
    userId: p.userId,
    callsign: p.callsign,
    connected: p.connected,
    camo: p.camo,
    helmet: p.helmet,
    x: Number(p.x.toFixed(2)),
    y: Number(p.y.toFixed(2)),
    z: Number(p.z.toFixed(2)),
    yaw: Number(p.yaw.toFixed(3)),
    isCrouching: p.isCrouching,
    isSprinting: p.isSprinting,
    isAiming: p.isAiming,
    isParachuting: p.isParachuting,
    isInAircraft: p.isInAircraft,
    hp: Math.round(p.hp),
    armor: Math.round(p.armor),
    alive: p.alive,
    kills: p.kills,
    damageDealt: Math.round(p.damageDealt),
    headshots: p.headshots,
    placement: p.placement,
    eliminationCause: p.eliminationCause,
    activeSlot: p.activeSlot,
    slots: p.slots,
    ammo: p.ammo,
    medkits: p.medkits,
    bandages: p.bandages,
    backpackMaxKg: p.backpackMaxKg,
    backpackUsedKg: computeBackpackUsedKg(p),
  }));

  return {
    roomId: room.roomId,
    phase: room.phase,
    matchTimeSec: Number(room.matchTimeSec.toFixed(1)),
    countdownSec: Number(room.countdownSec.toFixed(1)),
    aircraft: {
      startX: room.flightStartX,
      startZ: room.flightStartZ,
      endX: room.flightEndX,
      endZ: room.flightEndZ,
      planeX: Number(room.planeX.toFixed(2)),
      planeY: Number(room.planeY.toFixed(2)),
      planeZ: Number(room.planeZ.toFixed(2)),
      planeYaw: Number(room.planeYaw.toFixed(3)),
    },
    zone: {
      phaseIndex: room.zonePhaseIdx + 1,
      phaseStatus: room.zoneStatus,
      phaseTimerSec: Math.ceil(room.zoneTimerSec),
      blueCenterX: Number(room.blueCenterX.toFixed(2)),
      blueCenterZ: Number(room.blueCenterZ.toFixed(2)),
      blueRadius: Number(room.blueRadius.toFixed(2)),
      safeCenterX: Number(room.safeCenterX.toFixed(2)),
      safeCenterZ: Number(room.safeCenterZ.toFixed(2)),
      safeRadius: Number(room.safeRadius.toFixed(2)),
      damagePerSec: room.damagePerSec,
    },
    killFeed: room.killFeed.slice(0, 6),
    players,
  };
}

function eliminatePlayer(
  room: RoomInstance,
  victim: ServerPlayerState,
  killerName: string,
  weaponName: string,
  isHeadshot: boolean,
  killerPlayer?: ServerPlayerState,
): void {
  if (!victim.alive) return;
  const livingBefore = Array.from(room.players.values()).filter((p) => p.alive).length;
  victim.alive = false;
  victim.hp = 0;
  victim.placement = livingBefore;
  victim.eliminationCause = `Eliminated by ${killerName} (${weaponName})`;

  if (killerPlayer && killerPlayer.userId !== victim.userId) {
    killerPlayer.kills += 1;
  }

  const notice: EliminationNotice = {
    id: room.nextKillId++,
    killer: killerName,
    victim: victim.callsign,
    weaponName,
    isHeadshot,
    timestamp: Date.now(),
  };
  room.killFeed.unshift(notice);
  if (room.killFeed.length > 10) room.killFeed.pop();

  broadcastRoom(room, { type: 'player:eliminated', notice });
  checkVictory(room);
}

function checkVictory(room: RoomInstance): void {
  const living = Array.from(room.players.values()).filter((p) => p.alive);
  if (room.status === 'in_match' && living.length <= 1) {
    room.status = 'finished';
    room.phase = living.length === 1 ? 'victory' : 'eliminated';
    if (living.length === 1) {
      living[0].placement = 1;
    }
    if (!room.statsRecorded) {
      room.statsRecorded = true;
      room.players.forEach((p) => {
        recordMatchStats(p.userId, p.kills, p.placement === 1);
      });
    }
    broadcastRoom(room, { type: 'match:finished', snapshot: buildSnapshot(room) });
  }
}

export function handleClientWsMessage(
  userId: string,
  ws: WebSocket,
  msg: Record<string, unknown>,
): void {
  const roomId = userToRoom.get(userId);
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) return;
  const player = room.players.get(userId);
  if (!player) return;

  switch (msg.type) {
    case 'room:ready': {
      if (room.status === 'lobby') {
        player.ready = Boolean(msg.ready);
        if (typeof msg.camo === 'string') player.camo = msg.camo as CamoId;
        if (typeof msg.helmet === 'string') player.helmet = msg.helmet as HelmetId;
        broadcastRoom(room, { type: 'room:update', room: serializeRoomSummary(room) });
      }
      break;
    }

    case 'player:drop': {
      if (room.status === 'in_match' && player.alive && player.isInAircraft) {
        player.isInAircraft = false;
        player.isParachuting = true;
        player.x = room.planeX;
        player.y = room.planeY - 3;
        player.z = room.planeZ;
      }
      break;
    }

    case 'player:move': {
      if (room.status !== 'in_match' || !player.alive || player.isInAircraft) return;
      const now = Date.now();
      const dt = Math.max(0.016, Math.min(0.25, (now - player.lastMoveAt) / 1000));
      player.lastMoveAt = now;

      const nx = Number(msg.x);
      const ny = Number(msg.y);
      const nz = Number(msg.z);
      const yaw = Number(msg.yaw);
      if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) return;

      // Server-authoritative speed validation (anti-teleport / anti-speedhack)
      const horizDist = Math.hypot(nx - player.x, nz - player.z);
      const maxAllowed = (player.isParachuting ? 22 : 12.5) * dt + 1.8;
      if (horizDist <= maxAllowed) {
        player.x = Math.max(-255, Math.min(255, nx));
        player.z = Math.max(-255, Math.min(255, nz));
        const floorY = getWalkableHeight(player.x, player.z, player.y);
        player.y = Math.max(floorY, Math.min(155, ny));
      } else {
        player.speedViolations += 1;
        // Snap client back cleanly if cheating/desynced
        sendJson(player.ws, {
          type: 'player:reconcile',
          x: player.x,
          y: player.y,
          z: player.z,
        });
      }

      if (Number.isFinite(yaw)) player.yaw = yaw;
      player.isCrouching = Boolean(msg.isCrouching);
      player.isSprinting = Boolean(msg.isSprinting);
      player.isAiming = Boolean(msg.isAiming);
      player.isParachuting = Boolean(msg.isParachuting);
      if (msg.activeSlot === 1 || msg.activeSlot === 2 || msg.activeSlot === 3) {
        if (player.slots[msg.activeSlot]) {
          player.activeSlot = msg.activeSlot;
        }
      }
      break;
    }

    case 'player:reload': {
      if (room.status !== 'in_match' || !player.alive) return;
      const slot = player.activeSlot;
      const wid = player.slots[slot];
      if (!wid) return;
      const spec = WEAPONS[wid];
      const st = player.ammo[slot];
      if (st.mag < spec.magSize && st.reserve > 0) {
        const take = Math.min(spec.magSize - st.mag, st.reserve);
        st.mag += take;
        st.reserve -= take;
      }
      break;
    }

    case 'player:heal': {
      if (room.status !== 'in_match' || !player.alive || player.hp >= 100) return;
      if (player.medkits > 0) {
        player.medkits -= 1;
        player.hp = Math.min(100, player.hp + 50);
      } else if (player.bandages > 0) {
        player.bandages -= 1;
        player.hp = Math.min(100, player.hp + 25);
      }
      break;
    }

    case 'player:loot': {
      if (room.status !== 'in_match' || !player.alive) return;
      const lootId = String(msg.lootId ?? '');
      const item = room.lootItems.find((l) => l.id === lootId && !l.collected);
      if (!item) return;
      if (Math.hypot(item.x - player.x, item.z - player.z) > 4.5) return; // Server range check!

      const usedKg = computeBackpackUsedKg(player);
      if (item.weightKg > 0 && usedKg + item.weightKg > player.backpackMaxKg) {
        sendJson(player.ws, { type: 'server:notice', message: 'Backpack capacity full!' });
        return;
      }

      item.collected = true;
      if (item.type === 'weapon' && item.weaponId) {
        const spec = WEAPONS[item.weaponId];
        const targetSlot: 1 | 2 | 3 =
          spec.slotType === 'sidearm' ? 3 : !player.slots[1] ? 1 : !player.slots[2] ? 2 : 1;
        player.slots[targetSlot] = item.weaponId;
        player.ammo[targetSlot] = { mag: spec.magSize, reserve: spec.reserveAmmo };
        player.activeSlot = targetSlot;
      } else if (item.type === 'ammo' && item.ammoFor) {
        const slotMatch = ([1, 2, 3] as const).find((s) => player.slots[s] === item.ammoFor);
        const targetSlot = slotMatch ?? player.activeSlot;
        player.ammo[targetSlot].reserve += item.ammoAmount ?? 30;
      } else if (item.type === 'medkit') {
        player.medkits += 1;
      } else if (item.type === 'bandage') {
        player.bandages += 1;
      } else if (item.type === 'armor') {
        player.armor = Math.min(100, item.armorAmount ?? 80);
      } else if (item.type === 'backpack') {
        player.backpackMaxKg += item.capacityBonus ?? 14;
      }

      broadcastRoom(room, { type: 'loot:collected', lootId: item.id, byUserId: player.userId });
      break;
    }

    case 'player:shoot': {
      if (room.status !== 'in_match' || !player.alive || player.isInAircraft) return;
      const wid = player.slots[player.activeSlot];
      if (!wid) return;
      const spec = WEAPONS[wid];
      const st = player.ammo[player.activeSlot];
      const now = Date.now();
      const minIntervalMs = (60 / spec.fireRateRpm) * 820; // slight jitter tolerance
      if (now - player.lastFireAt < minIntervalMs || st.mag <= 0) return;

      player.lastFireAt = now;
      st.mag -= 1;

      const ox = Number(msg.ox);
      const oy = Number(msg.oy);
      const oz = Number(msg.oz);
      const dx = Number(msg.dx);
      const dy = Number(msg.dy);
      const dz = Number(msg.dz);
      if (
        !Number.isFinite(ox) ||
        !Number.isFinite(oy) ||
        !Number.isFinite(oz) ||
        !Number.isFinite(dx) ||
        !Number.isFinite(dy) ||
        !Number.isFinite(dz)
      ) {
        return;
      }

      // Normalize ray direction
      const len = Math.max(0.0001, Math.hypot(dx, dy, dz));
      const rx = dx / len;
      const ry = dy / len;
      const rz = dz / len;

      // Server-authoritative ray vs enemy cylinder/head hit validation
      let hitVictim: ServerPlayerState | null = null;
      let hitDist = spec.range;
      let hitHead = false;

      room.players.forEach((other) => {
        if (other.userId === player.userId || !other.alive || other.isInAircraft) return;
        const bodyH = other.isCrouching ? 1.25 : 1.75;
        // Closest point on ray to enemy vertical spine
        const toEx = other.x - ox;
        const toEz = other.z - oz;
        const tProj = toEx * rx + (other.y + bodyH * 0.55 - oy) * ry + toEz * rz;
        if (tProj < 0 || tProj > hitDist) return;

        const px = ox + rx * tProj;
        const py = oy + ry * tProj;
        const pz = oz + rz * tProj;
        const radial = Math.hypot(px - other.x, pz - other.z);

        if (radial <= 0.52 && py >= other.y && py <= other.y + bodyH + 0.25) {
          hitDist = tProj;
          hitVictim = other;
          hitHead = py >= other.y + bodyH - 0.34;
        }
      });

      broadcastRoom(room, {
        type: 'shot:fired',
        shooterId: player.userId,
        weaponId: wid,
        start: [player.x, player.y + 1.35, player.z],
        end: [ox + rx * hitDist, oy + ry * hitDist, oz + rz * hitDist],
      });

      if (hitVictim) {
        const victim = hitVictim as ServerPlayerState;
        const mult = hitHead ? spec.headshotMultiplier : 1.0;
        const pelletsFactor = spec.pellets > 1 ? Math.max(2, Math.round(spec.pellets * 0.45)) : 1;
        const totalDmg = Math.round(spec.damage * pelletsFactor * mult);
        const absorbed = Math.min(victim.armor, Math.round(totalDmg * 0.35));
        victim.armor -= absorbed;
        victim.hp = Math.max(0, victim.hp - (totalDmg - absorbed));
        player.damageDealt += totalDmg;
        if (hitHead) player.headshots += 1;

        sendJson(player.ws, {
          type: 'hit:confirmed',
          victimCallsign: victim.callsign,
          amount: totalDmg,
          isHeadshot: hitHead,
          weaponName: spec.name,
        });

        if (victim.hp <= 0) {
          eliminatePlayer(room, victim, player.callsign, spec.name, hitHead, player);
        }
      }
      break;
    }
  }
}

// Authoritative 20Hz simulation loop across all active multiplayer rooms
export function startMatchSimulationLoop(): NodeJS.Timeout {
  const dt = 1 / TICK_RATE_HZ;
  return setInterval(() => {
    const now = Date.now();
    rooms.forEach((room) => {
      if (room.status !== 'in_match') return;

      // Reconnect timeout cleanup
      room.players.forEach((p) => {
        if (!p.connected && p.disconnectedAt && now - p.disconnectedAt > RECONNECT_GRACE_MS) {
          eliminatePlayer(room, p, 'Connection Timeout', 'Disconnect', false);
        }
      });

      // Countdown -> Aircraft -> Combat phases
      if (room.phase === 'countdown') {
        room.countdownSec -= dt;
        if (room.countdownSec <= 0) {
          room.countdownSec = 0;
          room.phase = 'aircraft';
        }
      } else {
        room.matchTimeSec += dt;
        // Advance transport aircraft
        const fdx = room.flightEndX - room.flightStartX;
        const fdz = room.flightEndZ - room.flightStartZ;
        const fLen = Math.hypot(fdx, fdz);
        const distTraveled = room.matchTimeSec * AIRCRAFT_SPEED_MPS;
        const progress = Math.min(1, distTraveled / fLen);
        room.planeX = room.flightStartX + fdx * progress;
        room.planeZ = room.flightStartZ + fdz * progress;

        // Auto-eject remaining passengers at end of flight path
        if (progress >= 0.96) {
          room.players.forEach((p) => {
            if (p.alive && p.isInAircraft) {
              p.isInAircraft = false;
              p.isParachuting = true;
              p.x = room.planeX;
              p.y = room.planeY - 3;
              p.z = room.planeZ;
            }
          });
          if (room.phase === 'aircraft') {
            room.phase = 'combat';
          }
        }

        // Update Blue Zone phase & shrink
        const cfg = ZONE_PHASES[room.zonePhaseIdx];
        if (cfg) {
          room.zoneTimerSec -= dt;
          if (room.zoneStatus === 'waiting') {
            if (room.zoneTimerSec <= 0) {
              room.zoneStatus = 'shrinking';
              room.zoneTimerSec = cfg.shrinkSec;
              room.startBlueX = room.blueCenterX;
              room.startBlueZ = room.blueCenterZ;
              room.startBlueR = room.blueRadius;
            }
          } else if (room.zoneStatus === 'shrinking') {
            const p = 1 - Math.max(0, room.zoneTimerSec) / cfg.shrinkSec;
            room.blueCenterX = room.startBlueX + (room.safeCenterX - room.startBlueX) * p;
            room.blueCenterZ = room.startBlueZ + (room.safeCenterZ - room.startBlueZ) * p;
            room.blueRadius = room.startBlueR + (room.safeRadius - room.startBlueR) * p;
            if (room.zoneTimerSec <= 0) {
              if (room.zonePhaseIdx < ZONE_PHASES.length - 1) {
                room.zonePhaseIdx += 1;
                const nextCfg = ZONE_PHASES[room.zonePhaseIdx];
                room.zoneStatus = 'waiting';
                room.zoneTimerSec = nextCfg.waitSec;
                room.safeRadius = nextCfg.targetRadius;
                room.damagePerSec = nextCfg.damagePerSec;
              } else {
                room.zoneStatus = 'final';
                room.zoneTimerSec = 0;
              }
            }
          }
        }

        // Apply server-authoritative Blue Zone storm damage
        room.players.forEach((p) => {
          if (!p.alive || p.isInAircraft) return;
          const dist = Math.hypot(p.x - room.blueCenterX, p.z - room.blueCenterZ);
          if (dist > room.blueRadius) {
            p.hp -= room.damagePerSec * dt;
            if (p.hp <= 0) {
              eliminatePlayer(room, p, 'Blue Zone', 'Storm Field', false);
            }
          }
        });
      }

      broadcastRoom(room, {
        type: 'match:state',
        snapshot: buildSnapshot(room),
      });
    });
  }, 1000 / TICK_RATE_HZ);
}
