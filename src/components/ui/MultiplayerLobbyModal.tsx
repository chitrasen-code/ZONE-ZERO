import { useEffect, useState } from 'react';
import { RefreshCw, Users, X, LogOut, Play } from 'lucide-react';
import { soundEngine } from '../../audio/soundEngine';
import {
  AuthUser,
  ConnectionStatus,
  multiplayerClient,
  RoomSummary,
} from '../../network/multiplayerClient';
import { CharacterLoadout } from '../../types/game';

interface MultiplayerLobbyModalProps {
  authUser: AuthUser | null;
  onAuthChange: (user: AuthUser | null) => void;
  room: RoomSummary | null;
  connectionStatus: ConnectionStatus;
  loadout: CharacterLoadout;
  onClose: () => void;
}

export function MultiplayerLobbyModal({
  authUser,
  onAuthChange,
  room,
  connectionStatus,
  loadout,
  onClose,
}: MultiplayerLobbyModalProps) {
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [openRooms, setOpenRooms] = useState<RoomSummary[]>([]);

  const refreshRooms = async () => {
    const list = await multiplayerClient.fetchOpenRooms();
    setOpenRooms(list);
  };

  useEffect(() => {
    refreshRooms();
    multiplayerClient.onRoomError = (err) => setErrorMsg(err);
    return () => {
      multiplayerClient.onRoomError = undefined;
    };
  }, []);

  useEffect(() => {
    if (authUser) {
      multiplayerClient.connectSocket();
      refreshRooms();
    }
  }, [authUser?.id]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setAuthBusy(true);
    try {
      const res =
        authTab === 'login'
          ? await multiplayerClient.login(username, password)
          : await multiplayerClient.register(username, password);
      if (!res.ok) {
        setErrorMsg(res.error);
      } else {
        onAuthChange(res.user);
        setPassword('');
      }
    } catch {
      setErrorMsg('Unable to reach multiplayer server.');
    } finally {
      setAuthBusy(false);
    }
  };

  const meInRoom = room?.players.find((p) => p.userId === authUser?.id);
  const isHost = Boolean(meInRoom?.isHost);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0e1319] border border-white/15 rounded p-5 sm:p-6 text-[#ecefe9] space-y-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-wider uppercase">
              ONLINE MULTIPLAYER LOBBY
            </h2>
            <p className="text-xs text-slate-400">
              Server-authoritative 4-player test match · Architected per RoomInstance shard (100-player capacity not load-tested)
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            aria-label="Close multiplayer lobby"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-white/10 text-slate-300 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="bg-red-500/15 border border-red-400/40 rounded px-3.5 py-2.5 text-xs text-red-200">
            {errorMsg}
          </div>
        )}

        {!authUser ? (
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setAuthTab('login');
                }}
                className={`min-h-[42px] rounded text-xs font-semibold uppercase tracking-wider border cursor-pointer ${
                  authTab === 'login'
                    ? 'bg-amber-400 text-[#0b0e12] border-amber-300'
                    : 'bg-white/5 text-slate-300 border-white/10'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setAuthTab('register');
                }}
                className={`min-h-[42px] rounded text-xs font-semibold uppercase tracking-wider border cursor-pointer ${
                  authTab === 'register'
                    ? 'bg-amber-400 text-[#0b0e12] border-amber-300'
                    : 'bg-white/5 text-slate-300 border-white/10'
                }`}
              >
                Create Account
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Callsign / Username (min 3 chars)</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. ALPHA_01"
                  className="w-full min-h-[44px] bg-[#161d25] border border-white/15 rounded px-3 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Password (min 4 chars)</label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full min-h-[44px] bg-[#161d25] border border-white/15 rounded px-3 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authBusy}
              className="w-full min-h-[48px] bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-[#0b0e12] font-display text-xl font-bold tracking-wider uppercase rounded cursor-pointer"
            >
              {authBusy ? 'AUTHENTICATING...' : authTab === 'login' ? 'LOGIN TO SERVER' : 'REGISTER & CONNECT'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            {/* Authenticated Profile Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white/5 border border-white/10 rounded p-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <span>{authUser.username}</span>
                  <span className="text-slate-500">·</span>
                  <span
                    className={`text-xs font-mono-tabular uppercase ${
                      connectionStatus === 'connected'
                        ? 'text-emerald-400'
                        : connectionStatus === 'reconnecting'
                          ? 'text-amber-400'
                          : 'text-slate-400'
                    }`}
                  >
                    {connectionStatus}
                  </span>
                </div>
                <div className="text-xs text-slate-400 font-mono-tabular">
                  Matches: {authUser.matchesPlayed} · Wins: {authUser.wins} · Kills: {authUser.kills}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  multiplayerClient.logout();
                  onAuthChange(null);
                }}
                className="min-h-[38px] flex items-center gap-1.5 px-3 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>

            {/* Active Room Lobby OR Room Browser */}
            {room ? (
              <div className="bg-[#141b23] border border-emerald-400/35 rounded p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div>
                    <div className="font-display text-xl font-bold uppercase text-white">{room.name}</div>
                    <div className="text-xs text-slate-400">
                      Room Code: <span className="font-mono-tabular text-amber-400 text-sm">{room.code}</span> ·{' '}
                      {room.playerCount}/{room.maxPlayers} Players
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      multiplayerClient.leaveRoom();
                    }}
                    className="min-h-[38px] px-3 rounded bg-red-500/15 hover:bg-red-500/25 border border-red-400/35 text-xs text-red-200 cursor-pointer"
                  >
                    Leave Room
                  </button>
                </div>

                {/* Party Roster */}
                <div className="space-y-2">
                  {room.players.map((p) => (
                    <div
                      key={p.userId}
                      className="flex items-center justify-between bg-black/25 border border-white/10 rounded px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-semibold text-white">{p.callsign}</span>
                        {p.isHost && <span className="text-amber-400 font-mono-tabular">HOST</span>}
                        {!p.connected && <span className="text-red-400">DISCONNECTED</span>}
                      </div>
                      <span
                        className={`font-mono-tabular uppercase ${
                          p.ready ? 'text-emerald-400' : 'text-slate-400'
                        }`}
                      >
                        {p.ready ? 'READY' : 'WAITING'}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setErrorMsg('');
                      multiplayerClient.setReady(!meInRoom?.ready, loadout.camo, loadout.helmet);
                    }}
                    className={`flex-1 min-h-[46px] rounded font-display text-lg font-bold tracking-wider uppercase border cursor-pointer ${
                      meInRoom?.ready
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-white/10 border-white/20 text-white hover:bg-white/15'
                    }`}
                  >
                    {meInRoom?.ready ? 'READY CONFIRMED' : 'MARK READY'}
                  </button>

                  {isHost && (
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setErrorMsg('');
                        multiplayerClient.startMatch();
                      }}
                      className="flex-1 min-h-[46px] flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-[#0b0e12] font-display text-lg font-bold tracking-wider uppercase rounded cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>LAUNCH MATCH ({room.playerCount}/4)</span>
                    </button>
                  )}
                </div>
                {room.playerCount < 2 && (
                  <p className="text-xs text-slate-400">
                    Share room code <span className="font-mono-tabular text-amber-400">{room.code}</span> with a second player (or open a second browser tab with another account) to reach the 2-player minimum.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Create Room */}
                  <div className="bg-[#141b23] border border-white/10 rounded p-3.5 space-y-2.5">
                    <div className="text-xs uppercase tracking-wider text-slate-400">Create Custom Room</div>
                    <input
                      type="text"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder={`${authUser.username}'s Squad`}
                      className="w-full min-h-[40px] bg-black/30 border border-white/15 rounded px-3 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setErrorMsg('');
                        multiplayerClient.createRoom(roomName.trim() || undefined);
                      }}
                      className="w-full min-h-[42px] bg-amber-400 hover:bg-amber-300 text-[#0b0e12] font-display text-base font-bold tracking-wider uppercase rounded cursor-pointer"
                    >
                      CREATE ROOM
                    </button>
                  </div>

                  {/* Join by Code + Quick Match */}
                  <div className="bg-[#141b23] border border-white/10 rounded p-3.5 space-y-2.5">
                    <div className="text-xs uppercase tracking-wider text-slate-400">Join Room Code</div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        placeholder="6-CHAR CODE"
                        className="flex-1 min-h-[40px] bg-black/30 border border-white/15 rounded px-3 text-xs font-mono-tabular uppercase text-white focus:outline-none focus:border-amber-400"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          setErrorMsg('');
                          if (joinCode.trim()) multiplayerClient.joinRoom(joinCode.trim());
                        }}
                        className="min-h-[40px] px-4 bg-white/10 hover:bg-white/15 border border-white/15 rounded text-xs font-semibold uppercase cursor-pointer"
                      >
                        JOIN
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setErrorMsg('');
                        multiplayerClient.quickMatchmake();
                      }}
                      className="w-full min-h-[42px] bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/45 text-emerald-300 font-display text-base font-bold tracking-wider uppercase rounded cursor-pointer"
                    >
                      QUICK MATCHMAKING
                    </button>
                  </div>
                </div>

                {/* Open Rooms List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-slate-400">
                      Open Lobby Rooms ({openRooms.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        refreshRooms();
                      }}
                      className="min-h-[34px] flex items-center gap-1.5 px-2.5 rounded bg-white/5 hover:bg-white/10 text-xs text-slate-300 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {openRooms.length === 0 ? (
                    <div className="text-xs text-slate-500 bg-white/5 border border-white/10 rounded p-3">
                      No open lobby rooms right now. Create a room or click Quick Matchmaking.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {openRooms.map((r) => (
                        <div
                          key={r.roomId}
                          className="flex items-center justify-between bg-white/5 border border-white/10 rounded px-3 py-2 text-xs"
                        >
                          <div>
                            <span className="font-semibold text-white">{r.name}</span>
                            <span className="text-slate-500"> · </span>
                            <span className="font-mono-tabular text-amber-400">{r.code}</span>
                            <span className="text-slate-500"> · Host: {r.hostCallsign}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              soundEngine.playUiClick();
                              multiplayerClient.joinRoom(r.code);
                            }}
                            className="min-h-[34px] px-3 rounded bg-amber-400 hover:bg-amber-300 text-[#0b0e12] font-semibold uppercase cursor-pointer"
                          >
                            Join ({r.playerCount}/{r.maxPlayers})
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
