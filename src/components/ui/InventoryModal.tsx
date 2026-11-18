import { X } from 'lucide-react';
import { WEAPON_LIST, WEAPONS } from '../../data/gameCatalog';
import { soundEngine } from '../../audio/soundEngine';
import { CharacterLoadout, WeaponId } from '../../types/game';

interface InventoryModalProps {
  loadout: CharacterLoadout;
  onChange: (next: CharacterLoadout) => void;
  onClose: () => void;
}

export function InventoryModal({ loadout, onChange, onClose }: InventoryModalProps) {
  const primaries = WEAPON_LIST.filter((w) => w.slotType === 'primary');

  const assignWeapon = (slot: 'primaryWeapon' | 'secondaryWeapon', id: WeaponId) => {
    soundEngine.playUiClick();
    onChange({ ...loadout, [slot]: id });
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/55">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#0e1319] border border-white/15 rounded p-5 sm:p-6 text-[#ecefe9] space-y-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-wider uppercase">ARMORY &amp; WEAPON LOADOUT</h2>
            <p className="text-xs text-slate-400">
              All 5 weapon classes · Assign Slot 1 &amp; Slot 2 for Solo Skirmish (Multiplayer starts with P-45 Sidearm)
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            aria-label="Close inventory modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-white/10 text-slate-300 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active 3-Slot Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white/5 border border-white/10 rounded p-3">
            <div className="text-[11px] uppercase tracking-wider text-amber-400">Slot 1 · Primary</div>
            <div className="font-display text-xl font-bold mt-0.5">{WEAPONS[loadout.primaryWeapon].name}</div>
            <div className="text-xs text-slate-400">{WEAPONS[loadout.primaryWeapon].category}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded p-3">
            <div className="text-[11px] uppercase tracking-wider text-amber-400">Slot 2 · Secondary</div>
            <div className="font-display text-xl font-bold mt-0.5">{WEAPONS[loadout.secondaryWeapon].name}</div>
            <div className="text-xs text-slate-400">{WEAPONS[loadout.secondaryWeapon].category}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded p-3">
            <div className="text-[11px] uppercase tracking-wider text-amber-400">Slot 3 · Sidearm</div>
            <div className="font-display text-xl font-bold mt-0.5">{WEAPONS[loadout.sidearmWeapon].name}</div>
            <div className="text-xs text-slate-400">{WEAPONS[loadout.sidearmWeapon].caliber}</div>
          </div>
        </div>

        {/* Full 5-Weapon Catalog */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {WEAPON_LIST.map((w) => {
            const isPrimary = loadout.primaryWeapon === w.id;
            const isSecondary = loadout.secondaryWeapon === w.id;
            const isSidearm = w.slotType === 'sidearm';

            return (
              <div
                key={w.id}
                className={`bg-[#141b23] border rounded p-3.5 space-y-2.5 ${
                  isPrimary || isSecondary || isSidearm ? 'border-amber-400/50' : 'border-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-display text-lg font-bold tracking-wide uppercase text-white">{w.name}</div>
                    <div className="text-xs text-slate-400">
                      {w.category} · {w.caliber} · {w.fireMode.toUpperCase()}
                    </div>
                  </div>
                  <span className="font-mono-tabular text-xs text-amber-400">{w.weightKg} KG</span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-xs bg-black/25 rounded p-2">
                  <div>
                    <div className="text-slate-500">DMG</div>
                    <div className="font-mono-tabular text-white">
                      {w.damage}
                      {w.pellets > 1 ? `×${w.pellets}` : ''}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">HS</div>
                    <div className="font-mono-tabular text-amber-300">{w.headshotMultiplier}×</div>
                  </div>
                  <div>
                    <div className="text-slate-500">RPM</div>
                    <div className="font-mono-tabular text-white">{w.fireRateRpm}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">MAG</div>
                    <div className="font-mono-tabular text-white">{w.magSize}</div>
                  </div>
                </div>

                {isSidearm ? (
                  <div className="text-xs text-emerald-400 font-medium pt-1">Equipped in Slot 3 (Sidearm)</div>
                ) : (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => assignWeapon('primaryWeapon', w.id)}
                      className={`flex-1 min-h-[38px] rounded text-xs font-semibold uppercase tracking-wider border cursor-pointer ${
                        isPrimary
                          ? 'bg-amber-400 text-[#0b0e12] border-amber-300'
                          : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {isPrimary ? 'Slot 1 Active' : 'Set Slot 1'}
                    </button>
                    <button
                      type="button"
                      onClick={() => assignWeapon('secondaryWeapon', w.id)}
                      className={`flex-1 min-h-[38px] rounded text-xs font-semibold uppercase tracking-wider border cursor-pointer ${
                        isSecondary
                          ? 'bg-amber-400 text-[#0b0e12] border-amber-300'
                          : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {isSecondary ? 'Slot 2 Active' : 'Set Slot 2'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Quick reference if user needs primary options */}
        {primaries.length > 0 && (
          <div className="flex justify-end pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onClose();
              }}
              className="min-h-[44px] px-6 bg-amber-400 hover:bg-amber-300 text-[#0b0e12] font-display text-lg font-bold tracking-wider uppercase rounded cursor-pointer"
            >
              DONE
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
