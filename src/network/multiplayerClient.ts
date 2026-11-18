import {
  CamoId,
  EliminationNotice,
  HelmetId,
  ServerMatchSnapshot,
  WeaponId,
  WorldLootItem,
} from '../types/game';

export interface AuthUser {
  id: string;
  username: string;
  matchesPlayed: number;
  wins: number;
  kills: number;
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

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface ServerShotEvent {
  shooterId: string;
  weaponId: WeaponId;
  start: [number, number, number];
  end: [number, number, number];
}

export interface ServerHitConfirmed {
  victimCallsign: string;
  amount: number;
  isHeadshot: boolean;
  weaponName: string;
}

const TOKEN_STORAGE_KEY = 'pbr_session_token';

class MultiplayerClient {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private user: AuthUser | null = null;
  private reconnectTimer: number = 0;
  private manualClose = false;
  private pendingQueue: string[] = [];

  public status: ConnectionStatus = 'disconnected';
  public currentRoom: RoomSummary | null = null;
  public latestSnapshot: ServerMatchSnapshot | null = null;
  public latestLootItems: WorldLootItem[] = [];

  public onStatusChange?: (status: ConnectionStatus) => void;
  public onRoomUpdate?: (room: RoomSummary | null) => void;
  public onRoomError?: (err: string) => void;
  public onMatchStarted?: (room: RoomSummary) => void;
  public onMatchSync?: (snapshot: ServerMatchSnapshot, loot: WorldLootItem[]) => void;
  public onMatchState?: (snapshot: ServerMatchSnapshot) => void;
  public onMatchFinished?: (snapshot: ServerMatchSnapshot) => void;
  public onLootCollected?: (lootId: string) => void;
  public onShotFired?: (evt: ServerShotEvent) => void;
  public onHitConfirmed?: (evt: ServerHitConfirmed) => void;
  public onElimination?: (notice: EliminationNotice) => void;
  public onReconcile?: (x: number, y: number, z: number) => void;

  public getStoredToken(): string | null {
    try {
      return window.localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private setStoredToken(token: string | null): void {
    this.token = token;
    try {
      if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
      else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // Ignore storage failures
    }
  }

  public getUser(): AuthUser | null {
    return this.user;
  }

  public async restoreSession(): Promise<AuthUser | null> {
    const tok = this.getStoredToken();
    if (!tok) return null;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (!res.ok) {
        this.setStoredToken(null);
        return null;
      }
      const data = (await res.json()) as { user: AuthUser };
      this.token = tok;
      this.user = data.user;
      return data.user;
    } catch {
      return null;
    }
  }

  public async register(
    username: string,
    password: string,
  ): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'Registration failed.' };
    }
    this.setStoredToken(data.token);
    this.user = data.user;
    this.connectSocket();
    return { ok: true, user: data.user };
  }

  public async login(
    username: string,
    password: string,
  ): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'Login failed.' };
    }
    this.setStoredToken(data.token);
    this.user = data.user;
    this.connectSocket();
    return { ok: true, user: data.user };
  }

  public logout(): void {
    this.manualClose = true;
    window.clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.user = null;
    this.currentRoom = null;
    this.latestSnapshot = null;
    this.latestLootItems = [];
    this.setStoredToken(null);
    this.setStatus('disconnected');
    this.onRoomUpdate?.(null);
  }

  public async fetchOpenRooms(): Promise<RoomSummary[]> {
    try {
      const res = await fetch('/api/rooms');
      if (!res.ok) return [];
      const data = (await res.json()) as { rooms: RoomSummary[] };
      return data.rooms ?? [];
    } catch {
      return [];
    }
  }

  private setStatus(s: ConnectionStatus): void {
    this.status = s;
    this.onStatusChange?.(s);
  }

  public connectSocket(): void {
    if (!this.token) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.manualClose = false;
    this.setStatus(this.status === 'reconnecting' ? 'reconnecting' : 'connecting');

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws?token=${encodeURIComponent(this.token)}`;
    const socket = new WebSocket(wsUrl);
    this.ws = socket;

    socket.onopen = () => {
      this.setStatus('connected');
      // If reconnecting to a room, re-join automatically to restore authoritative state
      if (this.currentRoom) {
        this.send({ type: 'room:join', code: this.currentRoom.roomId });
      }
      while (this.pendingQueue.length > 0) {
        const msg = this.pendingQueue.shift()!;
        socket.send(msg);
      }
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        switch (data.type) {
          case 'room:joined':
          case 'room:update':
            this.currentRoom = data.room;
            this.onRoomUpdate?.(data.room);
            break;
          case 'room:left':
            this.currentRoom = null;
            this.onRoomUpdate?.(null);
            break;
          case 'room:error':
            this.onRoomError?.(data.error || 'Room error.');
            break;
          case 'match:started':
            this.currentRoom = data.room;
            this.onMatchStarted?.(data.room);
            break;
          case 'match:sync':
            this.latestSnapshot = data.snapshot;
            this.latestLootItems = data.lootItems ?? [];
            this.onMatchSync?.(data.snapshot, this.latestLootItems);
            break;
          case 'match:state':
            this.latestSnapshot = data.snapshot;
            this.onMatchState?.(data.snapshot);
            break;
          case 'match:finished':
            this.latestSnapshot = data.snapshot;
            this.onMatchFinished?.(data.snapshot);
            break;
          case 'loot:collected':
            this.onLootCollected?.(data.lootId);
            break;
          case 'shot:fired':
            this.onShotFired?.(data as ServerShotEvent);
            break;
          case 'hit:confirmed':
            this.onHitConfirmed?.(data as ServerHitConfirmed);
            break;
          case 'player:eliminated':
            this.onElimination?.(data.notice as EliminationNotice);
            break;
          case 'player:reconcile':
            this.onReconcile?.(data.x, data.y, data.z);
            break;
        }
      } catch {
        // Ignore malformed frame
      }
    };

    socket.onclose = () => {
      this.ws = null;
      if (this.manualClose || !this.token) {
        this.setStatus('disconnected');
        return;
      }
      this.setStatus('reconnecting');
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = window.setTimeout(() => {
        this.connectSocket();
      }, 1600);
    };
  }

  public send(payload: unknown): void {
    const raw = JSON.stringify(payload);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(raw);
    } else if (this.token) {
      if (this.pendingQueue.length < 20) {
        this.pendingQueue.push(raw);
      }
      this.connectSocket();
    }
  }

  public createRoom(roomName?: string): void {
    this.send({ type: 'room:create', roomName });
  }

  public joinRoom(code: string): void {
    this.send({ type: 'room:join', code });
  }

  public quickMatchmake(): void {
    this.send({ type: 'room:matchmake' });
  }

  public setReady(ready: boolean, camo: CamoId, helmet: HelmetId): void {
    this.send({ type: 'room:ready', ready, camo, helmet });
  }

  public startMatch(): void {
    this.send({ type: 'room:start' });
  }

  public leaveRoom(): void {
    this.send({ type: 'room:leave' });
    this.currentRoom = null;
    this.latestSnapshot = null;
    this.latestLootItems = [];
    this.onRoomUpdate?.(null);
  }
}

export const multiplayerClient = new MultiplayerClient();
