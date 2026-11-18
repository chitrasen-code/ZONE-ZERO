interface LoadingScreenProps {
  ready: boolean;
  statusLabel?: string;
}

export function LoadingScreen({ ready, statusLabel = 'Streaming Island Terrain & Tactical Assets' }: LoadingScreenProps) {
  if (ready) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-[#0a0e13] text-[#ecefe9] p-6 sm:p-10 select-none">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.22em] text-slate-400">
        <span>PROJECT BATTLE ROYALE</span>
        <span className="font-mono-tabular text-amber-400">SECTOR 01 · ISLAND DEPLOYMENT</span>
      </div>

      <div className="max-w-xl space-y-5">
        <div className="flex items-center gap-4">
          <svg
            viewBox="0 0 48 48"
            className="w-12 h-12 shrink-0 text-amber-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <polygon points="24,4 42,14 42,34 24,44 6,34 6,14" className="stroke-amber-400/80" />
            <circle cx="24" cy="24" r="7" className="stroke-amber-400" />
            <line x1="24" y1="8" x2="24" y2="14" />
            <line x1="24" y1="34" x2="24" y2="40" />
            <line x1="8" y1="24" x2="14" y2="24" />
            <line x1="34" y1="24" x2="40" y2="24" />
          </svg>
          <div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-wider uppercase leading-none">
              PROJECT BATTLE ROYALE
            </h1>
            <p className="text-sm text-slate-400 mt-1">{statusLabel}</p>
          </div>
        </div>

        <div className="w-full h-1.5 bg-white/10 rounded overflow-hidden">
          <div className="h-full w-2/3 bg-amber-400 transition-all duration-500" />
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          9 Named Regions · Ballistic Weapon Registry · Server-Authoritative Multiplayer &amp; AI Skirmish
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
        <span>WASD Move</span>
        <span>Mouse Aim &amp; Look</span>
        <span>Shift Sprint</span>
        <span>Space Jump / Deploy</span>
        <span>C Crouch</span>
        <span>R Reload</span>
        <span>E / F Loot</span>
        <span>M Map</span>
        <span>Tab Backpack</span>
      </div>
    </div>
  );
}
