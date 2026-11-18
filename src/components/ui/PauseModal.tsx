import { soundEngine } from '../../audio/soundEngine';

interface PauseModalProps {
  onResume: () => void;
  onOpenSettings: () => void;
  onReturnToMenu: () => void;
}

export function PauseModal({ onResume, onOpenSettings, onReturnToMenu }: PauseModalProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-sm bg-[#0e1319] border border-white/15 rounded p-6 text-[#ecefe9] space-y-4">
        <div className="border-b border-white/10 pb-3">
          <h2 className="font-display text-3xl font-bold tracking-wider uppercase">MATCH PAUSED</h2>
          <p className="text-xs text-slate-400">Press ESC or Resume to return to combat</p>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onResume();
            }}
            className="w-full min-h-[48px] bg-amber-400 hover:bg-amber-300 text-[#0b0e12] font-display text-xl font-bold tracking-wider uppercase rounded cursor-pointer"
          >
            RESUME MATCH
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenSettings();
            }}
            className="w-full min-h-[46px] bg-white/5 hover:bg-white/10 border border-white/15 text-white font-display text-lg font-semibold tracking-wider uppercase rounded cursor-pointer"
          >
            SETTINGS
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onReturnToMenu();
            }}
            className="w-full min-h-[46px] bg-red-500/15 hover:bg-red-500/25 border border-red-400/35 text-red-200 font-display text-lg font-semibold tracking-wider uppercase rounded cursor-pointer"
          >
            EXIT TO MAIN MENU
          </button>
        </div>
      </div>
    </div>
  );
}
