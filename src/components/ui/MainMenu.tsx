import { Volume2, VolumeX, Crosshair, Globe, Shield, Backpack, SlidersHorizontal, Play } from 'lucide-react';
import { CAMO_PRESETS, WEAPONS } from '../../data/gameCatalog';
import { soundEngine } from '../../audio/soundEngine';
import { AuthUser } from '../../network/multiplayerClient';
import { CharacterLoadout, DifficultyLevel, GameSettings, MenuModal } from '../../types/game';

interface MainMenuProps {
  loadout: CharacterLoadout;
  settings: GameSettings;
  authUser: AuthUser | null;
  onPlaySolo: () => void;
  onOpenMultiplayer: () => void;
  onOpenModal: (modal: MenuModal) => void;
  onToggleMute: () => void;
  onDifficultyChange: (d: DifficultyLevel) => void;
}

export function MainMenu({
  loadout,
  settings,
  authUser,
  onPlaySolo,
  onOpenMultiplayer,
  onOpenModal,
  onToggleMute,
  onDifficultyChange,
}: MainMenuProps) {
  const camo = CAMO_PRESETS.find((c) => c.id === loadout.camo) ?? CAMO_PRESETS[0];
  const primary = WEAPONS[loadout.primaryWeapon];
  const secondary = WEAPONS[loadout.secondaryWeapon];

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 sm:p-7 select-none">
      {/* Subtle bottom-left vignette for legibility over 3D overlook */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(10,14,19,0.88) 0%, rgba(10,14,19,0.52) 40%, rgba(10,14,19,0.12) 100%)',
        }}
      />

      {/* Top Bar */}
      <header className="relative z-10 flex items-center justify-between gap-4 pointer-events-auto">
        <div className="flex items-center gap-3">
          <svg
            viewBox="0 0 40 40"
            className="w-9 h-9 text-amber-400 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
          >
            <polygon points="20,3 35,11.5 35,28.5 20,37 5,28.5 5,11.5" />
            <circle cx="20" cy="20" r="5.5" />
            <line x1="20" y1="6" x2="20" y2="11" />
            <line x1="20" y1="29" x2="20" y2="34" />
            <line x1="6" y1="20" x2="11" y2="20" />
            <line x1="29" y1="20" x2="34" y2="20" />
          </svg>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-wider uppercase text-[#f1f3ef] leading-none">
              PROJECT BATTLE ROYALE
            </h1>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400 mt-1">
              FORT AEGIS OVERLOOK · 640M ISLAND
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden md:flex items-center gap-2 bg-[#0e1319]/90 border border-white/10 rounded px-3 py-2 text-xs text-slate-300">
            <span className="text-slate-400">OPERATOR</span>
            <span className="font-semibold text-white">{loadout.callsign}</span>
            <span className="text-slate-600">·</span>
            <span className="text-amber-400">{authUser ? `ONLINE: ${authUser.username}` : 'OFFLINE READY'}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onToggleMute();
            }}
            aria-label={settings.muted ? 'Unmute audio' : 'Mute audio'}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-[#0e1319]/90 hover:bg-[#172029] border border-white/15 rounded text-slate-200 transition-colors cursor-pointer"
          >
            {settings.muted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-amber-400" />}
          </button>
        </div>
      </header>

      {/* Main Left Action Rail */}
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6 my-auto py-4">
        <div className="w-full max-w-md space-y-4 pointer-events-auto">
          {/* Primary Solo Deploy Card */}
          <div className="bg-[#0e1319]/92 border border-white/12 rounded p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="uppercase tracking-[0.18em]">SOLO SKIRMISH · 12 COMBATANTS</span>
              <span className="font-mono-tabular text-amber-400 uppercase">{settings.difficulty} AI</span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {(['easy', 'normal', 'hard'] as DifficultyLevel[]).map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onDifficultyChange(diff);
                  }}
                  className={`min-h-[38px] rounded text-xs font-semibold uppercase tracking-wider border transition-colors cursor-pointer ${
                    settings.difficulty === diff
                      ? 'bg-amber-400 text-[#0b0e12] border-amber-300'
                      : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onPlaySolo();
              }}
              className="w-full min-h-[54px] flex items-center justify-center gap-3 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-[#0b0e12] font-display text-2xl font-bold tracking-wider uppercase rounded transition-colors cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>PLAY</span>
            </button>
          </div>

          {/* Online Multiplayer Button */}
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenMultiplayer();
            }}
            className="w-full min-h-[50px] flex items-center justify-between px-4 bg-[#0e1319]/92 hover:bg-[#172029] border border-emerald-400/35 rounded text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="font-display text-lg font-bold tracking-wider uppercase text-white leading-tight">
                  ONLINE MULTIPLAYER
                </div>
                <div className="text-xs text-slate-400">
                  Real 4-Player Server-Authoritative Lobby &amp; Rooms
                </div>
              </div>
            </div>
            <span className="text-xs font-mono-tabular text-emerald-400 uppercase">WS SYNC</span>
          </button>

          {/* Character / Inventory / Settings Navigation */}
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onOpenModal('character');
              }}
              className="min-h-[52px] flex flex-col items-center justify-center gap-1 bg-[#0e1319]/92 hover:bg-[#172029] border border-white/12 rounded px-2 py-2 text-slate-200 transition-colors cursor-pointer"
            >
              <Shield className="w-4 h-4 text-amber-400" />
              <span className="font-display text-sm font-semibold tracking-wider uppercase">CHARACTER</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onOpenModal('inventory');
              }}
              className="min-h-[52px] flex flex-col items-center justify-center gap-1 bg-[#0e1319]/92 hover:bg-[#172029] border border-white/12 rounded px-2 py-2 text-slate-200 transition-colors cursor-pointer"
            >
              <Backpack className="w-4 h-4 text-amber-400" />
              <span className="font-display text-sm font-semibold tracking-wider uppercase">INVENTORY</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onOpenModal('settings');
              }}
              className="min-h-[52px] flex flex-col items-center justify-center gap-1 bg-[#0e1319]/92 hover:bg-[#172029] border border-white/12 rounded px-2 py-2 text-slate-200 transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4 text-amber-400" />
              <span className="font-display text-sm font-semibold tracking-wider uppercase">SETTINGS</span>
            </button>
          </div>
        </div>

        {/* Right Loadout Readout Card */}
        <div className="hidden sm:block bg-[#0e1319]/88 border border-white/12 rounded p-4 w-72 space-y-2.5 pointer-events-auto">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="uppercase tracking-wider">ACTIVE LOADOUT</span>
            <Crosshair className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Primary</span>
              <span className="text-white font-medium">{primary.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Secondary</span>
              <span className="text-white font-medium">{secondary.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Uniform</span>
              <span className="text-white font-medium">{camo.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Graphics</span>
              <span className="font-mono-tabular uppercase text-amber-400">
                {settings.graphicsQuality}
                {settings.batterySaver ? ' · ECO' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Controls Hint */}
      <footer className="relative z-10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 pointer-events-none">
        <span>
          Desktop: WASD Move · Mouse Look · LMB Fire · RMB Aim · Shift Sprint · Space Jump/Drop · R Reload · E/F Loot
        </span>
        <span className="font-mono-tabular text-slate-500">
          Mobile Touch Controls Supported
        </span>
      </footer>
    </div>
  );
}
