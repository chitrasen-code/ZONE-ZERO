import { X } from 'lucide-react';
import { CAMO_PRESETS, HELMET_PRESETS } from '../../data/gameCatalog';
import { soundEngine } from '../../audio/soundEngine';
import { CharacterLoadout } from '../../types/game';

interface CharacterModalProps {
  loadout: CharacterLoadout;
  onChange: (next: CharacterLoadout) => void;
  onClose: () => void;
}

export function CharacterModal({ loadout, onChange, onClose }: CharacterModalProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/55">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#0e1319] border border-white/15 rounded p-5 sm:p-6 text-[#ecefe9] space-y-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-wider uppercase">OPERATOR CUSTOMIZATION</h2>
            <p className="text-xs text-slate-400">Changes update the live 3D operator preview immediately</p>
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            aria-label="Close character modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-white/10 text-slate-300 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Callsign */}
        <div className="space-y-1.5">
          <label htmlFor="operator-callsign" className="block text-xs uppercase tracking-wider text-slate-400">
            Operator Callsign
          </label>
          <input
            id="operator-callsign"
            type="text"
            maxLength={16}
            value={loadout.callsign}
            onChange={(e) => onChange({ ...loadout, callsign: e.target.value.toUpperCase() })}
            className="w-full min-h-[44px] bg-[#161d25] border border-white/15 rounded px-3 text-sm font-mono-tabular text-white focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* Camo Pattern */}
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-slate-400">Combat Uniform Camo</div>
          <div className="grid grid-cols-2 gap-2.5">
            {CAMO_PRESETS.map((c) => {
              const selected = loadout.camo === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onChange({ ...loadout, camo: c.id });
                  }}
                  className={`min-h-[48px] flex items-center gap-3 px-3 py-2 rounded border text-left transition-colors cursor-pointer ${
                    selected
                      ? 'bg-amber-400/15 border-amber-400 text-white'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <span
                    className="w-5 h-5 rounded shrink-0 border border-white/25"
                    style={{ backgroundColor: c.uniformHex }}
                  />
                  <span className="text-sm font-medium">{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Helmet */}
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-slate-400">Ballistic Headgear</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {HELMET_PRESETS.map((h) => {
              const selected = loadout.helmet === h.id;
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onChange({ ...loadout, helmet: h.id });
                  }}
                  className={`min-h-[48px] px-3 py-2 rounded border text-left transition-colors cursor-pointer ${
                    selected
                      ? 'bg-amber-400/15 border-amber-400 text-white'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <div className="text-sm font-medium">{h.name}</div>
                  <div className="text-[11px] text-slate-400">
                    {h.hasNvg ? 'NVG + Visor' : h.hasVisor ? 'Tinted Visor' : 'Full Shell'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tactical Gear Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onChange({ ...loadout, armorEquipped: !loadout.armorEquipped });
            }}
            className={`min-h-[48px] flex items-center justify-between px-3.5 rounded border cursor-pointer ${
              loadout.armorEquipped
                ? 'bg-emerald-500/15 border-emerald-400/50 text-white'
                : 'bg-white/5 border-white/10 text-slate-400'
            }`}
          >
            <span className="text-sm font-medium">Plate Carrier Armor</span>
            <span className="font-mono-tabular text-xs uppercase">{loadout.armorEquipped ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onChange({ ...loadout, backpackEnabled: !loadout.backpackEnabled });
            }}
            className={`min-h-[48px] flex items-center justify-between px-3.5 rounded border cursor-pointer ${
              loadout.backpackEnabled
                ? 'bg-emerald-500/15 border-emerald-400/50 text-white'
                : 'bg-white/5 border-white/10 text-slate-400'
            }`}
          >
            <span className="text-sm font-medium">Field Backpack</span>
            <span className="font-mono-tabular text-xs uppercase">{loadout.backpackEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        <div className="flex justify-end pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            className="min-h-[44px] px-6 bg-amber-400 hover:bg-amber-300 text-[#0b0e12] font-display text-lg font-bold tracking-wider uppercase rounded cursor-pointer"
          >
            CONFIRM GEAR
          </button>
        </div>
      </div>
    </div>
  );
}
