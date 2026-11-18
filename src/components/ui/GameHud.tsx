import { useEffect, useRef, useState } from 'react';
import { Pause, Map as MapIcon, Backpack, Crosshair, RotateCw } from 'lucide-react';
import { soundEngine } from '../../audio/soundEngine';
import { WEAPONS } from '../../data/weapons';
import { ConnectionStatus } from '../../network/multiplayerClient';
import {
  GameSettings,
  MatchMode,
  MutableInputState,
  PlayerHudState,
} from '../../types/game';
import { ISLAND_LANDMARKS } from '../../world/terrainMath';

interface GameHudProps {
  hud: PlayerHudState;
  settings: GameSettings;
  matchMode: MatchMode;
  connectionStatus: ConnectionStatus;
  inputRef: React.MutableRefObject<MutableInputState>;
  activeSlot: 1 | 2 | 3;
  onActiveSlotChange: (slot: 1 | 2 | 3) => void;
  showFullMap: boolean;
  onToggleFullMap: () => void;
  showBackpack: boolean;
  onToggleBackpack: () => void;
  onPause: () => void;
  onPlayAgain: () => void;
  onReturnToMenu: () => void;
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function getCardinalLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((deg % 360) / 45)) % 8];
}

function worldToMapCoord(wx: number, wz: number, mapSize = 200): { x: number; y: number } {
  // Island playable range roughly [-260, 260]
  const normX = (wx + 260) / 520;
  const normY = (wz + 260) / 520;
  return {
    x: Math.max(4, Math.min(mapSize - 4, normX * mapSize)),
    y: Math.max(4, Math.min(mapSize - 4, normY * mapSize)),
  };
}

function worldRadiusToMap(r: number, mapSize = 200): number {
  return (r / 520) * mapSize;
}

export function GameHud({
  hud,
  settings,
  matchMode,
  connectionStatus,
  inputRef,
  activeSlot,
  onActiveSlotChange,
  showFullMap,
  onToggleFullMap,
  showBackpack,
  onToggleBackpack,
  onPause,
  onPlayAgain,
  onReturnToMenu,
}: GameHudProps) {
  const [fps, setFps] = useState(60);
  const [showHitMarker, setShowHitMarker] = useState(false);
  const [showDamageFlash, setShowDamageFlash] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [dismissRotateBanner, setDismissRotateBanner] = useState(false);

  // Virtual joystick & look touch tracking
  const joyBaseRef = useRef<HTMLDivElement>(null);
  const joyKnobRef = useRef<HTMLDivElement>(null);
  const joyPointerIdRef = useRef<number | null>(null);
  const lookPointerIdRef = useRef<number | null>(null);
  const lookLastPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [touchSprintLocked, setTouchSprintLocked] = useState(false);

  // Detect touch device & portrait orientation
  useEffect(() => {
    const checkEnv = () => {
      const hasTouch =
        typeof window !== 'undefined' &&
        ('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches);
      setIsTouchDevice(hasTouch);
      setIsPortrait(window.innerHeight > window.innerWidth && window.innerWidth < 900);
    };
    checkEnv();
    window.addEventListener('resize', checkEnv);
    return () => window.removeEventListener('resize', checkEnv);
  }, []);

  // Live FPS counter
  useEffect(() => {
    if (!settings.showFps) return;
    let frameCount = 0;
    let lastTime = performance.now();
    let rafId = 0;
    const loop = (now: number) => {
      frameCount += 1;
      if (now - lastTime >= 500) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [settings.showFps]);

  // Hit marker flash timer
  useEffect(() => {
    if (hud.hitMarkerTick === 0) return;
    setShowHitMarker(true);
    const id = window.setTimeout(() => setShowHitMarker(false), 320);
    return () => window.clearTimeout(id);
  }, [hud.hitMarkerTick]);

  // Incoming damage vignette timer
  useEffect(() => {
    if (hud.lastDamagedByTick === 0) return;
    setShowDamageFlash(true);
    const id = window.setTimeout(() => setShowDamageFlash(false), 280);
    return () => window.clearTimeout(id);
  }, [hud.lastDamagedByTick]);

  const showTouch =
    settings.showTouchControls === 'always' ||
    (settings.showTouchControls === 'auto' && isTouchDevice);

  const activeWeapon = WEAPONS[hud.activeWeaponId];
  const isSniperScoped = hud.isAiming && hud.activeWeaponId === 'lsr90';
  const matchEnded = hud.matchPhase === 'victory' || hud.matchPhase === 'eliminated';

  const stopHudPointer = (e: React.PointerEvent) => {
    e.stopPropagation();
  };

  // Virtual Joystick Handlers
  const updateJoystick = (clientX: number, clientY: number) => {
    const base = joyBaseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.42;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    const nx = dx / maxR;
    const ny = dy / maxR;
    inputRef.current.joyX = nx;
    inputRef.current.joyY = ny;
    inputRef.current.sprint = touchSprintLocked || (ny < -0.78 && Math.hypot(nx, ny) > 0.8);
    if (joyKnobRef.current) {
      joyKnobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
    }
  };

  const resetJoystick = () => {
    joyPointerIdRef.current = null;
    inputRef.current.joyX = 0;
    inputRef.current.joyY = 0;
    inputRef.current.sprint = touchSprintLocked;
    if (joyKnobRef.current) {
      joyKnobRef.current.style.transform = 'translate(0px, 0px)';
    }
  };

  const renderTacticalMapSvg = (sizePx: number, interactiveFull: boolean) => {
    const playerPt = worldToMapCoord(hud.playerX, hud.playerZ, sizePx);
    const bluePt = worldToMapCoord(hud.zone.blueCenterX, hud.zone.blueCenterZ, sizePx);
    const blueR = worldRadiusToMap(hud.zone.blueRadius, sizePx);
    const safePt = worldToMapCoord(hud.zone.safeCenterX, hud.zone.safeCenterZ, sizePx);
    const safeR = worldRadiusToMap(hud.zone.safeRadius, sizePx);
    const flStart = worldToMapCoord(hud.flight.startX, hud.flight.startZ, sizePx);
    const flEnd = worldToMapCoord(hud.flight.endX, hud.flight.endZ, sizePx);
    const planePt = worldToMapCoord(hud.flight.planeX, hud.flight.planeZ, sizePx);

    return (
      <svg width={sizePx} height={sizePx} viewBox={`0 0 ${sizePx} ${sizePx}`} className="block bg-[#0f2537]">
        {/* Island landmass silhouette */}
        <ellipse
          cx={sizePx * 0.5}
          cy={sizePx * 0.5}
          rx={sizePx * 0.39}
          ry={sizePx * 0.37}
          fill="#2d412c"
          stroke="#c2b280"
          strokeWidth={interactiveFull ? 3 : 1.5}
        />
        {/* Silverwind River curve */}
        <path
          d={`M ${sizePx * 0.57} ${sizePx * 0.12} Q ${sizePx * 0.52} ${sizePx * 0.45} ${sizePx * 0.58} ${sizePx * 0.88}`}
          fill="none"
          stroke="#1f6387"
          strokeWidth={interactiveFull ? 6 : 3}
        />
        {/* Main Road Ring */}
        <ellipse
          cx={sizePx * 0.5}
          cy={sizePx * 0.5}
          rx={sizePx * 0.2}
          ry={sizePx * 0.15}
          fill="none"
          stroke="#4b5563"
          strokeWidth={interactiveFull ? 2.4 : 1.2}
        />
        {/* Named Landmarks */}
        {ISLAND_LANDMARKS.map((lm) => {
          const pt = worldToMapCoord(lm.x, lm.z, sizePx);
          return (
            <g key={lm.id}>
              <circle cx={pt.x} cy={pt.y} r={interactiveFull ? 3 : 1.6} fill="#e2e8f0" opacity={0.75} />
              {interactiveFull && (
                <text
                  x={pt.x}
                  y={pt.y - 6}
                  textAnchor="middle"
                  fill="#f8fafc"
                  fontSize="10"
                  fontWeight="600"
                >
                  {lm.name}
                </text>
              )}
            </g>
          );
        })}

        {/* Flight Path */}
        <line
          x1={flStart.x}
          y1={flStart.y}
          x2={flEnd.x}
          y2={flEnd.y}
          stroke="#fbbf24"
          strokeDasharray="4 3"
          strokeWidth={1.3}
          opacity={0.7}
        />
        {(hud.matchPhase === 'countdown' || hud.matchPhase === 'aircraft') && (
          <circle cx={planePt.x} cy={planePt.y} r={interactiveFull ? 5 : 3.2} fill="#fbbf24" />
        )}

        {/* White Safe Zone */}
        <circle
          cx={safePt.x}
          cy={safePt.y}
          r={safeR}
          fill="none"
          stroke="#f8fafc"
          strokeDasharray="3 2"
          strokeWidth={1.3}
        />
        {/* Blue Storm Zone */}
        <circle
          cx={bluePt.x}
          cy={bluePt.y}
          r={blueR}
          fill="rgba(56, 189, 248, 0.08)"
          stroke="#38bdf8"
          strokeWidth={1.8}
        />

        {/* Player Position & Heading Cone */}
        <g transform={`translate(${playerPt.x}, ${playerPt.y}) rotate(${hud.headingDeg})`}>
          <polygon points="0,-10 5,3 -5,3" fill="rgba(251, 191, 36, 0.35)" />
          <circle cx={0} cy={0} r={interactiveFull ? 4.5 : 3.2} fill="#fbbf24" stroke="#0b0e12" strokeWidth={1.2} />
        </g>
      </svg>
    );
  };

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none text-[#f1f3ef]">
      {/* Blue Zone Storm Edge Vignette */}
      {hud.zone.playerOutsideZone && hud.matchPhase === 'combat' && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 90px rgba(37, 99, 235, 0.55)',
          }}
        />
      )}

      {/* Incoming Damage Red Vignette */}
      {showDamageFlash && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 110px rgba(220, 38, 38, 0.65)',
          }}
        />
      )}

      {/* Sniper Scope Overlay when ADS with LSR-90 */}
      {isSniperScoped && !matchEnded && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
          <div
            className="w-full h-full"
            style={{
              background:
                'radial-gradient(circle at center, transparent 26%, rgba(6, 9, 12, 0.94) 36%)',
            }}
          />
          <div className="absolute w-72 h-72 rounded-full border border-white/25 flex items-center justify-center">
            <div className="absolute w-full h-px bg-black/75" />
            <div className="absolute h-full w-px bg-black/75" />
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
          </div>
        </div>
      )}

      {/* Top HUD Row */}
      <div className="relative z-10 flex items-start justify-between gap-2 p-2.5 sm:p-4">
        {/* Top-Left: Minimap */}
        <div
          className="pointer-events-auto bg-[#0c1015]/92 border border-white/15 rounded overflow-hidden cursor-pointer shrink-0"
          onPointerDown={stopHudPointer}
          onClick={onToggleFullMap}
          title="Click or press [M] to toggle Tactical Map"
        >
          <div className="hidden sm:block">{renderTacticalMapSvg(138, false)}</div>
          <div className="block sm:hidden">{renderTacticalMapSvg(96, false)}</div>
          <div className="flex items-center justify-between px-2 py-1 text-[10px] font-mono-tabular bg-black/45 text-slate-300">
            <span>ZONE P{hud.zone.phaseIndex}</span>
            <span className={hud.zone.phaseStatus === 'shrinking' ? 'text-sky-400' : 'text-amber-400'}>
              {hud.zone.phaseStatus === 'final' ? 'FINAL' : formatTime(hud.zone.phaseTimerSec)}
            </span>
          </div>
        </div>

        {/* Top-Center: Compass + Match Counters */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-3 sm:gap-5 bg-[#0c1015]/90 border border-white/12 rounded px-3 sm:px-4 py-1.5 text-xs">
            <div className="font-mono-tabular">
              <span className="text-slate-400 mr-1">ALIVE</span>
              <span className="text-white font-bold text-sm">{hud.aliveCount}</span>
              <span className="text-slate-500">/{hud.totalPlayers}</span>
            </div>
            <span className="text-slate-600">·</span>
            <div className="font-mono-tabular">
              <span className="text-slate-400 mr-1">KILLS</span>
              <span className="text-amber-400 font-bold text-sm">{hud.kills}</span>
            </div>
            <span className="hidden sm:inline text-slate-600">·</span>
            <div className="hidden sm:block font-mono-tabular text-slate-300">
              {formatTime(hud.matchTimeSec)}
            </div>
          </div>

          <div className="bg-[#0c1015]/85 border border-white/10 rounded px-3 py-0.5 text-[11px] font-mono-tabular text-slate-300">
            {getCardinalLabel(hud.headingDeg)} · {String(hud.headingDeg).padStart(3, '0')}°
            {hud.matchPhase === 'skydiving' || hud.matchPhase === 'parachuting'
              ? ` · ALT ${hud.altitudeM}m`
              : ''}
          </div>
        </div>

        {/* Top-Right: FPS, Controls & Kill Feed */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5 pointer-events-auto" onPointerDown={stopHudPointer}>
            {settings.showFps && (
              <div className="bg-[#0c1015]/90 border border-white/12 rounded px-2.5 py-2 text-[11px] font-mono-tabular text-emerald-400">
                {fps} FPS
              </div>
            )}

            <button
              type="button"
              onClick={onToggleFullMap}
              aria-label="Toggle map"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center bg-[#0c1015]/90 hover:bg-[#182029] border border-white/15 rounded text-slate-200 cursor-pointer"
            >
              <MapIcon className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onToggleBackpack}
              aria-label="Toggle backpack"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center bg-[#0c1015]/90 hover:bg-[#182029] border border-white/15 rounded text-slate-200 cursor-pointer"
            >
              <Backpack className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onPause}
              aria-label="Pause match"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center bg-[#0c1015]/90 hover:bg-[#182029] border border-white/15 rounded text-slate-200 cursor-pointer"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>

          {matchMode === 'multiplayer' && connectionStatus !== 'connected' && (
            <div className="bg-amber-500/20 border border-amber-400/50 rounded px-3 py-1 text-xs font-mono-tabular text-amber-200">
              {connectionStatus === 'reconnecting' ? 'RECONNECTING TO SERVER...' : 'CONNECTING...'}
            </div>
          )}

          {/* Elimination Feed */}
          {hud.killFeed.length > 0 && (
            <div className="hidden sm:flex flex-col items-end gap-1 max-w-xs">
              {hud.killFeed.slice(0, 4).map((notice) => (
                <div
                  key={notice.id}
                  className="bg-[#0c1015]/85 border border-white/10 rounded px-2.5 py-1 text-[11px] text-slate-200"
                >
                  <span className="font-semibold text-amber-300">{notice.killer}</span>
                  <span className="text-slate-400"> · {notice.weaponName} · </span>
                  <span className="font-semibold text-red-300">{notice.victim}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center Banners: Countdown / Aircraft / Skydive / Storm / Target HP / Loot */}
      {!matchEnded && (
        <>
          {hud.matchPhase === 'countdown' && (
            <div className="fixed top-28 left-1/2 -translate-x-1/2 bg-[#0c1015]/92 border border-amber-400/40 rounded px-5 py-2.5 text-center">
              <div className="text-[11px] uppercase tracking-[0.2em] text-amber-400">PRE-FLIGHT DEPLOYMENT</div>
              <div className="font-display text-3xl font-bold font-mono-tabular">
                {Math.ceil(hud.countdownSec)}s
              </div>
            </div>
          )}

          {hud.matchPhase === 'aircraft' && (
            <div className="fixed top-28 left-1/2 -translate-x-1/2 bg-[#0c1015]/92 border border-amber-400/50 rounded px-5 py-2.5 text-center space-y-1">
              <div className="text-xs uppercase tracking-[0.18em] text-amber-400">TRANSPORT C-130 IN FLIGHT</div>
              <div className="font-display text-xl font-bold tracking-wide">
                {hud.flight.canDrop ? 'PRESS [SPACE] OR [F] TO JUMP' : 'APPROACHING DROP CORRIDOR...'}
              </div>
            </div>
          )}

          {hud.matchPhase === 'skydiving' && (
            <div className="fixed top-28 left-1/2 -translate-x-1/2 bg-[#0c1015]/90 border border-white/15 rounded px-4 py-1.5 text-xs font-mono-tabular text-slate-200">
              FREEFALL · ALT {hud.altitudeM}m · [SPACE] DEPLOY CHUTE
            </div>
          )}

          {hud.zone.playerOutsideZone && hud.matchPhase === 'combat' && (
            <div className="fixed top-28 left-1/2 -translate-x-1/2 bg-sky-950/90 border border-sky-400/60 rounded px-4 py-1.5 text-xs font-mono-tabular text-sky-200">
              OUTSIDE SAFE ZONE · TAKING {hud.zone.damagePerSec} DMG/SEC
            </div>
          )}

          {/* Targeted Enemy HP Bar */}
          {hud.targetedEnemy && hud.targetedEnemy.hp > 0 && (
            <div className="fixed top-36 left-1/2 -translate-x-1/2 bg-[#0c1015]/90 border border-white/15 rounded px-3 py-1.5 w-48 space-y-1">
              <div className="flex justify-between text-[11px] font-mono-tabular">
                <span className="text-white font-semibold">{hud.targetedEnemy.callsign}</span>
                <span className="text-slate-400">{hud.targetedEnemy.distanceM}m</span>
              </div>
              <div className="w-full h-1.5 bg-white/15 rounded overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, (hud.targetedEnemy.hp / hud.targetedEnemy.maxHp) * 100))}%` }}
                />
              </div>
            </div>
          )}

          {/* Nearby Loot Prompt */}
          {hud.nearbyLoot && hud.matchPhase === 'combat' && (
            <div className="fixed bottom-36 left-1/2 -translate-x-1/2 bg-[#0c1015]/92 border border-amber-400/45 rounded px-4 py-1.5 text-xs font-medium text-amber-200">
              Press [E] or [F] to pick up <span className="font-bold text-white">{hud.nearbyLoot.name}</span>
            </div>
          )}

          {/* Center Dynamic Crosshair & Hit Marker */}
          {hud.matchPhase === 'combat' && !isSniperScoped && (
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <div className="relative w-8 h-8 flex items-center justify-center">
                <div
                  className="absolute w-2 h-0.5 bg-white/90"
                  style={{ transform: `translateX(${-(hud.isAiming ? 6 : 9 + hud.speedMps * 0.5)}px)` }}
                />
                <div
                  className="absolute w-2 h-0.5 bg-white/90"
                  style={{ transform: `translateX(${hud.isAiming ? 6 : 9 + hud.speedMps * 0.5}px)` }}
                />
                <div
                  className="absolute h-2 w-0.5 bg-white/90"
                  style={{ transform: `translateY(${-(hud.isAiming ? 6 : 9 + hud.speedMps * 0.5)}px)` }}
                />
                <div
                  className="absolute h-2 w-0.5 bg-white/90"
                  style={{ transform: `translateY(${hud.isAiming ? 6 : 9 + hud.speedMps * 0.5}px)` }}
                />
                <div className="w-1 h-1 rounded-full bg-amber-400" />
              </div>
            </div>
          )}

          {/* Hit Marker X + Damage Popup */}
          {showHitMarker && (
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <div
                className={`w-6 h-6 relative ${hud.lastHitHeadshot ? 'text-amber-400' : 'text-white'}`}
              >
                <span className="absolute inset-0 flex items-center justify-center font-bold text-xl rotate-45">
                  +
                </span>
              </div>
              {hud.lastDamage && (
                <div
                  className={`mt-3 text-center font-mono-tabular text-xs font-bold ${
                    hud.lastDamage.isHeadshot ? 'text-amber-400' : 'text-white'
                  }`}
                >
                  -{hud.lastDamage.amount} {hud.lastDamage.isHeadshot ? 'HEADSHOT' : ''}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Bottom Status & Weapon Slots (kept compact so touch controls never overlap) */}
      {!matchEnded && (
        <div className="fixed bottom-2.5 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 w-[92vw] max-w-2xl">
          {/* Reload bar */}
          {hud.isReloading && (
            <div className="bg-[#0c1015]/92 border border-amber-400/40 rounded px-3 py-1 w-48 space-y-1">
              <div className="text-[10px] font-mono-tabular uppercase text-amber-300 text-center">
                RELOADING {activeWeapon.name}
              </div>
              <div className="w-full h-1 bg-white/15 rounded overflow-hidden">
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${Math.round(hud.reloadProgress * 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-2">
            {/* Health / Armor / Stamina */}
            <div className="bg-[#0c1015]/92 border border-white/12 rounded px-3 py-2 flex-1 max-w-xs space-y-1.5 mx-auto sm:mx-0 w-full">
              <div className="flex items-center justify-between text-[11px] font-mono-tabular">
                <span className="text-slate-300">
                  HP <strong className="text-white text-sm">{hud.health}</strong>
                </span>
                <span className="text-sky-300">
                  ARMOR <strong>{hud.armor}</strong>
                </span>
                <span className="text-slate-400 uppercase">
                  {hud.isCrouching ? 'CROUCH' : hud.isSprinting ? 'SPRINT' : 'STAND'}
                </span>
              </div>
              <div className="w-full h-2 bg-white/15 rounded overflow-hidden">
                <div
                  className={`h-full transition-all ${hud.health > 30 ? 'bg-emerald-400' : 'bg-red-500'}`}
                  style={{ width: `${Math.max(0, Math.min(100, hud.health))}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="h-1 bg-white/10 rounded overflow-hidden">
                  <div className="h-full bg-sky-400" style={{ width: `${hud.armor}%` }} />
                </div>
                <div className="h-1 bg-white/10 rounded overflow-hidden">
                  <div className="h-full bg-amber-400" style={{ width: `${hud.stamina}%` }} />
                </div>
              </div>
            </div>

            {/* 3 Weapon Slots */}
            <div
              className="flex items-center justify-center gap-1.5 pointer-events-auto"
              onPointerDown={stopHudPointer}
            >
              {([1, 2, 3] as const).map((slot) => {
                const wid = hud.slotWeapons[slot];
                const isActive = activeSlot === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    disabled={!wid}
                    onClick={() => {
                      if (!wid) return;
                      soundEngine.playUiClick();
                      onActiveSlotChange(slot);
                    }}
                    className={`min-h-[48px] px-2.5 py-1.5 rounded border text-left transition-colors cursor-pointer disabled:opacity-40 ${
                      isActive
                        ? 'bg-amber-400/20 border-amber-400 text-white'
                        : 'bg-[#0c1015]/90 border-white/12 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[10px] font-mono-tabular text-slate-400">
                      <span>[{slot}]</span>
                      {isActive && (
                        <span className="text-amber-300 font-bold">
                          {hud.ammoInMag}/{hud.reserveAmmo}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-semibold truncate max-w-[84px]">
                      {wid ? WEAPONS[wid].name.split(' ')[0] : 'EMPTY'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Backpack & Tactical Inventory Drawer */}
      {showBackpack && !matchEnded && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/55 pointer-events-auto"
          onPointerDown={stopHudPointer}
        >
          <div className="w-full max-w-md bg-[#0e1319] border border-white/15 rounded p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div>
                <h3 className="font-display text-2xl font-bold uppercase">FIELD BACKPACK</h3>
                <div className="text-xs font-mono-tabular text-amber-400">
                  CAPACITY: {hud.backpackUsedKg} / {hud.backpackMaxKg} KG
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleBackpack}
                className="min-h-[40px] px-3 rounded bg-white/10 text-xs uppercase font-semibold cursor-pointer"
              >
                Close [Tab]
              </button>
            </div>

            <div className="w-full h-2 bg-white/10 rounded overflow-hidden">
              <div
                className="h-full bg-amber-400"
                style={{ width: `${Math.min(100, (hud.backpackUsedKg / hud.backpackMaxKg) * 100)}%` }}
              />
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {hud.backpackItems.length === 0 ? (
                <div className="text-xs text-slate-400">No medical or reserve items stored.</div>
              ) : (
                hud.backpackItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between bg-white/5 border border-white/10 rounded px-3 py-2 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white">
                        {item.name} ×{item.quantity}
                      </div>
                      <div className="text-[11px] font-mono-tabular text-slate-400">
                        {(item.quantity * item.weightEachKg).toFixed(1)} KG
                      </div>
                    </div>
                    {(item.type === 'medkit' || item.type === 'bandage') && (
                      <button
                        type="button"
                        onClick={() => {
                          inputRef.current.healPressed = true;
                        }}
                        className="min-h-[34px] px-3 rounded bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-semibold uppercase cursor-pointer"
                      >
                        Use [H]
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full Tactical Island Map (M) */}
      {showFullMap && !matchEnded && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/65 pointer-events-auto"
          onPointerDown={stopHudPointer}
        >
          <div className="bg-[#0e1319] border border-white/15 rounded p-4 space-y-3 max-w-full">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-2xl font-bold uppercase">TACTICAL ISLAND MAP</h3>
                <p className="text-xs text-slate-400">
                  White Dashed: Next Safe Zone · Blue Ring: Storm Boundary · Gold Line: C-130 Path
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleFullMap}
                className="min-h-[40px] px-3 rounded bg-white/10 text-xs uppercase font-semibold cursor-pointer"
              >
                Close [M]
              </button>
            </div>
            <div className="border border-white/15 rounded overflow-hidden">
              {renderTacticalMapSvg(380, true)}
            </div>
          </div>
        </div>
      )}

      {/* Victory / Eliminated Post-Match Summary */}
      {matchEnded && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/75 pointer-events-auto"
          onPointerDown={stopHudPointer}
        >
          <div className="w-full max-w-md bg-[#0e1319] border border-white/15 rounded p-6 space-y-5 text-center">
            <div>
              <div
                className={`text-xs font-mono-tabular uppercase tracking-[0.22em] ${
                  hud.matchPhase === 'victory' ? 'text-amber-400' : 'text-red-400'
                }`}
              >
                RANK #{hud.placement} / {hud.totalPlayers}
              </div>
              <h2 className="font-display text-4xl font-bold uppercase mt-1">
                {hud.matchPhase === 'victory' ? 'VICTORY ROYALE' : 'ELIMINATED'}
              </h2>
              {hud.eliminationCause && (
                <p className="text-xs text-slate-400 mt-1">{hud.eliminationCause}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-left bg-white/5 border border-white/10 rounded p-4 text-xs">
              <div>
                <div className="text-slate-400">Eliminations</div>
                <div className="font-mono-tabular text-xl font-bold text-amber-400">{hud.kills}</div>
              </div>
              <div>
                <div className="text-slate-400">Damage Dealt</div>
                <div className="font-mono-tabular text-xl font-bold text-white">{hud.damageDealt}</div>
              </div>
              <div>
                <div className="text-slate-400">Headshots</div>
                <div className="font-mono-tabular text-xl font-bold text-white">{hud.headshots}</div>
              </div>
              <div>
                <div className="text-slate-400">Survival Time</div>
                <div className="font-mono-tabular text-xl font-bold text-white">
                  {formatTime(hud.matchTimeSec)}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              {matchMode === 'solo' && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onPlayAgain();
                  }}
                  className="flex-1 min-h-[48px] bg-amber-400 hover:bg-amber-300 text-[#0b0e12] font-display text-lg font-bold tracking-wider uppercase rounded cursor-pointer"
                >
                  PLAY AGAIN
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onReturnToMenu();
                }}
                className="flex-1 min-h-[48px] bg-white/10 hover:bg-white/15 border border-white/15 text-white font-display text-lg font-bold tracking-wider uppercase rounded cursor-pointer"
              >
                MAIN MENU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Landscape Orientation Advisory */}
      {showTouch && isPortrait && !dismissRotateBanner && !matchEnded && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-30 bg-[#0c1015]/95 border border-amber-400/50 rounded px-4 py-2 flex items-center gap-3 text-xs pointer-events-auto"
          onPointerDown={stopHudPointer}
        >
          <RotateCw className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Rotate to Landscape for optimal two-thumb combat controls</span>
          <button
            type="button"
            onClick={() => setDismissRotateBanner(true)}
            className="text-amber-400 font-semibold uppercase px-1.5 cursor-pointer"
          >
            OK
          </button>
        </div>
      )}

      {/* Responsive Android / Mobile Touch Controls */}
      {showTouch && !matchEnded && !showFullMap && !showBackpack && (
        <div
          className="fixed inset-0 z-10 pointer-events-none"
          style={{ opacity: settings.controlOpacity }}
        >
          {/* Right-half touch camera look pad */}
          <div
            className="fixed top-16 right-0 bottom-0 left-1/2 pointer-events-auto touch-none"
            onPointerDown={(e) => {
              e.stopPropagation();
              if (lookPointerIdRef.current !== null) return;
              lookPointerIdRef.current = e.pointerId;
              lookLastPosRef.current = { x: e.clientX, y: e.clientY };
              e.currentTarget.setPointerCapture?.(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (lookPointerIdRef.current !== e.pointerId) return;
              const dx = e.clientX - lookLastPosRef.current.x;
              const dy = e.clientY - lookLastPosRef.current.y;
              lookLastPosRef.current = { x: e.clientX, y: e.clientY };
              inputRef.current.lookDeltaX += dx * 1.45;
              inputRef.current.lookDeltaY += dy * 1.45;
            }}
            onPointerUp={(e) => {
              if (lookPointerIdRef.current === e.pointerId) {
                lookPointerIdRef.current = null;
              }
            }}
            onPointerCancel={() => {
              lookPointerIdRef.current = null;
            }}
          />

          {/* Left Virtual Joystick + Sprint Lock */}
          <div
            className="fixed bottom-16 left-4 sm:left-7 flex flex-col items-start gap-2 pointer-events-auto"
            style={{ transform: `scale(${settings.controlScale})`, transformOrigin: 'bottom left' }}
            onPointerDown={stopHudPointer}
          >
            <button
              type="button"
              onClick={() => {
                const next = !touchSprintLocked;
                setTouchSprintLocked(next);
                inputRef.current.sprint = next;
              }}
              className={`min-h-[36px] px-3 rounded border text-[11px] font-bold uppercase ${
                touchSprintLocked
                  ? 'bg-amber-400 text-[#0b0e12] border-amber-300'
                  : 'bg-[#0c1015]/85 text-slate-300 border-white/20'
              }`}
            >
              Sprint {touchSprintLocked ? 'ON' : 'AUTO'}
            </button>

            <div
              ref={joyBaseRef}
              className="w-28 h-28 rounded-full bg-[#0c1015]/70 border-2 border-white/25 flex items-center justify-center touch-none"
              onPointerDown={(e) => {
                e.stopPropagation();
                joyPointerIdRef.current = e.pointerId;
                e.currentTarget.setPointerCapture?.(e.pointerId);
                updateJoystick(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (joyPointerIdRef.current !== e.pointerId) return;
                updateJoystick(e.clientX, e.clientY);
              }}
              onPointerUp={(e) => {
                if (joyPointerIdRef.current === e.pointerId) resetJoystick();
              }}
              onPointerCancel={resetJoystick}
            >
              <div
                ref={joyKnobRef}
                className="w-11 h-11 rounded-full bg-amber-400/85 border border-white/60 pointer-events-none"
              />
            </div>
          </div>

          {/* Right Action Cluster (adapts to Standard / Claw / Compact preset) */}
          <div
            className={`fixed right-4 sm:right-7 flex flex-col items-end gap-2 pointer-events-auto ${
              settings.controlPreset === 'claw' ? 'top-24' : 'bottom-16'
            }`}
            style={{
              transform: `scale(${
                settings.controlPreset === 'compact' ? settings.controlScale * 0.88 : settings.controlScale
              })`,
              transformOrigin: settings.controlPreset === 'claw' ? 'top right' : 'bottom right',
            }}
            onPointerDown={stopHudPointer}
          >
            <div className="flex items-center gap-2">
              {hud.nearbyLoot && (
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    inputRef.current.interactPressed = true;
                  }}
                  className="min-h-[44px] px-3 rounded bg-amber-400 text-[#0b0e12] text-xs font-bold uppercase"
                >
                  Loot
                </button>
              )}

              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  inputRef.current.healPressed = true;
                }}
                className="min-h-[44px] min-w-[44px] px-2.5 rounded bg-[#0c1015]/85 border border-emerald-400/45 text-emerald-300 text-xs font-bold uppercase"
              >
                Heal
              </button>

              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  inputRef.current.reloadPressed = true;
                }}
                className="min-h-[44px] min-w-[44px] px-2.5 rounded bg-[#0c1015]/85 border border-white/25 text-white text-xs font-bold uppercase"
              >
                Reload
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  inputRef.current.crouchTogglePressed = true;
                }}
                className={`min-h-[46px] min-w-[46px] px-2.5 rounded border text-xs font-bold uppercase ${
                  hud.isCrouching
                    ? 'bg-amber-400 text-[#0b0e12] border-amber-300'
                    : 'bg-[#0c1015]/85 text-white border-white/25'
                }`}
              >
                Crouch
              </button>

              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  inputRef.current.jumpPressed = true;
                }}
                className="min-h-[46px] min-w-[46px] px-3 rounded bg-[#0c1015]/85 border border-white/25 text-white text-xs font-bold uppercase"
              >
                {hud.matchPhase === 'aircraft' ? 'Drop' : 'Jump'}
              </button>

              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  inputRef.current.aimHeld = !inputRef.current.aimHeld;
                }}
                className={`min-h-[48px] min-w-[48px] px-3 rounded border text-xs font-bold uppercase flex items-center justify-center gap-1 ${
                  hud.isAiming
                    ? 'bg-sky-400 text-[#0b0e12] border-sky-300'
                    : 'bg-[#0c1015]/85 text-white border-white/25'
                }`}
              >
                <Crosshair className="w-4 h-4" />
                <span>ADS</span>
              </button>
            </div>

            {/* Primary Fire Trigger */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                inputRef.current.fireHeld = true;
                e.currentTarget.setPointerCapture?.(e.pointerId);
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                inputRef.current.fireHeld = false;
              }}
              onPointerCancel={() => {
                inputRef.current.fireHeld = false;
              }}
              className="w-20 h-20 rounded-full bg-amber-400/90 active:bg-amber-300 border-2 border-white/70 text-[#0b0e12] font-display text-lg font-bold tracking-wider uppercase flex items-center justify-center touch-none"
            >
              FIRE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
