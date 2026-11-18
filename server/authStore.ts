import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface StoredUser {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: number;
  matchesPlayed: number;
  wins: number;
  kills: number;
}

export interface PublicUserProfile {
  id: string;
  username: string;
  matchesPlayed: number;
  wins: number;
  kills: number;
}

// Server-only signing secret: never exposed to client code
const SERVER_TOKEN_SECRET =
  process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex');

const DATA_DIR = path.resolve(process.cwd(), '.data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const usersById = new Map<string, StoredUser>();
const usersByName = new Map<string, StoredUser>();

function loadPersistedUsers(): void {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf8');
      const parsed = JSON.parse(raw) as StoredUser[];
      parsed.forEach((u) => {
        usersById.set(u.id, u);
        usersByName.set(u.username.toLowerCase(), u);
      });
    }
  } catch {
    // Fallback cleanly to empty in-memory store
  }
}

function persistUsers(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(Array.from(usersById.values()), null, 2), 'utf8');
  } catch {
    // Non-fatal if filesystem is read-only
  }
}

loadPersistedUsers();

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export function toPublicProfile(user: StoredUser): PublicUserProfile {
  return {
    id: user.id,
    username: user.username,
    matchesPlayed: user.matchesPlayed,
    wins: user.wins,
    kills: user.kills,
  };
}

export function registerUser(
  usernameRaw: string,
  password: string,
): { ok: true; user: PublicUserProfile; token: string } | { ok: false; error: string } {
  const username = usernameRaw.trim();
  if (!/^[a-zA-Z0-9_-]{3,18}$/.test(username)) {
    return {
      ok: false,
      error: 'Callsign must be 3–18 characters using letters, numbers, _ or -.',
    };
  }
  if (password.length < 6 || password.length > 72) {
    return { ok: false, error: 'Password must be between 6 and 72 characters.' };
  }
  if (usersByName.has(username.toLowerCase())) {
    return { ok: false, error: 'That operator callsign is already registered.' };
  }

  const id = `usr_${crypto.randomUUID().slice(0, 12)}`;
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);

  const user: StoredUser = {
    id,
    username,
    passwordHash,
    salt,
    createdAt: Date.now(),
    matchesPlayed: 0,
    wins: 0,
    kills: 0,
  };

  usersById.set(id, user);
  usersByName.set(username.toLowerCase(), user);
  persistUsers();

  return {
    ok: true,
    user: toPublicProfile(user),
    token: issueSessionToken(user.id, user.username),
  };
}

export function loginUser(
  usernameRaw: string,
  password: string,
): { ok: true; user: PublicUserProfile; token: string } | { ok: false; error: string } {
  const username = usernameRaw.trim();
  const user = usersByName.get(username.toLowerCase());
  if (!user) {
    return { ok: false, error: 'Invalid callsign or password.' };
  }
  const candidate = hashPassword(password, user.salt);
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(user.passwordHash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: 'Invalid callsign or password.' };
  }
  return {
    ok: true,
    user: toPublicProfile(user),
    token: issueSessionToken(user.id, user.username),
  };
}

export function issueSessionToken(userId: string, username: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      name: username,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
    }),
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SERVER_TOKEN_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): PublicUserProfile | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    const expected = crypto
      .createHmac('sha256', SERVER_TOKEN_SECRET)
      .update(payload)
      .digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub: string;
      name: string;
      exp: number;
    };
    if (decoded.exp < Date.now()) return null;
    const existing = usersById.get(decoded.sub);
    if (existing) return toPublicProfile(existing);
    return null;
  } catch {
    return null;
  }
}

export function recordMatchStats(userId: string, killsDelta: number, won: boolean): void {
  const user = usersById.get(userId);
  if (!user) return;
  user.matchesPlayed += 1;
  user.kills += killsDelta;
  if (won) user.wins += 1;
  persistUsers();
}
