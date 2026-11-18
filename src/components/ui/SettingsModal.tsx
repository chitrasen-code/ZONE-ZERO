import { X } from 'lucide-react';
import { soundEngine } from '../../audio/soundEngine';
import {
  ControlLayoutPreset,
  DifficultyLevel,
  GameSettings,
  GraphicsPreset,
} from '../../types/game';

interface SettingsModalProps {
  settings: GameSettings;
  onChange: (next: GameSettings) => void;
  onClose: () => void;
}

export function SettingsModal({ settings, onChange, onClose }: SettingsModalProps) {
  const update = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const applyGraphicsPreset = (preset: GraphicsPreset) => {
    soundEngine.playUiClick();
    onChange({
      ...settings,
      graphicsQuality: preset,
      shadowsEnabled: preset === 'high' || preset === 'ultra',
      foliageDensity: preset === 'low' || preset === 'medium' ? 'medium' : 'high',
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0e1319] border border-white/15 rounded p-5 sm:p-6 text-[#ecefe9] space-y-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-wider uppercase">SYSTEM &amp; MOBILE SETTINGS</h2>
            <p className="text-xs text-slate-400">
              Graphics scalability, sensitivity, audio, and Android touch layout customization
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            aria-label="Close settings"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-white/10 text-slate-300 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Graphics & Performance */}
        <section className="space-y-3">
          <div className="text-xs uppercase tracking-[0.18em] text-amber-400">Graphics &amp; Performance</div>
          <div className="grid grid-cols-4 gap-2">
            {(['low', 'medium', 'high', 'ultra'] as GraphicsPreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => applyGraphicsPreset(preset)}
                className={`min-h-[42px] rounded text-xs font-semibold uppercase tracking-wider border cursor-pointer ${
                  settings.graphicsQuality === preset
                    ? 'bg-amber-400 text-[#0b0e12] border-amber-300'
                    : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                update('batterySaver', !settings.batterySaver);
              }}
              className={`min-h-[44px] flex items-center justify-between px-3 rounded border cursor-pointer ${
                settings.batterySaver
                  ? 'bg-emerald-500/15 border-emerald-400/50 text-white'
                  : 'bg-white/5 border-white/10 text-slate-300'
              }`}
            >
              <span className="text-xs font-medium">Mobile Battery Saver</span>
              <span className="font-mono-tabular text-xs">{settings.batterySaver ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                update('showFps', !settings.showFps);
              }}
              className={`min-h-[44px] flex items-center justify-between px-3 rounded border cursor-pointer ${
                settings.showFps
                  ? 'bg-amber-400/15 border-amber-400/50 text-white'
                  : 'bg-white/5 border-white/10 text-slate-300'
              }`}
            >
              <span className="text-xs font-medium">Display Live FPS</span>
              <span className="font-mono-tabular text-xs">{settings.showFps ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                update('shadowsEnabled', !settings.shadowsEnabled);
              }}
              className={`min-h-[44px] flex items-center justify-between px-3 rounded border cursor-pointer ${
                settings.shadowsEnabled
                  ? 'bg-amber-400/15 border-amber-400/50 text-white'
                  : 'bg-white/5 border-white/10 text-slate-300'
              }`}
            >
              <span className="text-xs font-medium">Dynamic Shadows</span>
              <span className="font-mono-tabular text-xs">{settings.shadowsEnabled ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                update('foliageDensity', settings.foliageDensity === 'high' ? 'medium' : 'high');
              }}
              className="min-h-[44px] flex items-center justify-between px-3 rounded border bg-white/5 border-white/10 text-slate-200 cursor-pointer"
            >
              <span className="text-xs font-medium">Foliage Density</span>
              <span className="font-mono-tabular text-xs uppercase">{settings.foliageDensity}</span>
            </button>
          </div>
        </section>

        {/* Camera & Combat Controls */}
        <section className="space-y-3 pt-2 border-t border-white/10">
          <div className="text-xs uppercase tracking-[0.18em] text-amber-400">Camera &amp; AI Difficulty</div>

          <div className="grid grid-cols-3 gap-2">
            {(['easy', 'normal', 'hard'] as DifficultyLevel[]).map((diff) => (
              <button
                key={diff}
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  update('difficulty', diff);
                }}
                className={`min-h-[40px] rounded text-xs font-semibold uppercase tracking-wider border cursor-pointer ${
                  settings.difficulty === diff
                    ? 'bg-amber-400 text-[#0b0e12] border-amber-300'
                    : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                }`}
              >
                {diff} AI
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Look Sensitivity</span>
                <span className="font-mono-tabular text-amber-400">{settings.mouseSensitivity.toFixed(2)}×</span>
              </div>
              <input
                type="range"
                min={0.3}
                max={2.5}
                step={0.05}
                value={settings.mouseSensitivity}
                onChange={(e) => update('mouseSensitivity', Number(e.target.value))}
                className="w-full accent-amber-400"
              />
            </label>

            <label className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Camera FOV</span>
                <span className="font-mono-tabular text-amber-400">{settings.cameraFov}°</span>
              </div>
              <input
                type="range"
                min={50}
                max={85}
                step={1}
                value={settings.cameraFov}
                onChange={(e) => update('cameraFov', Number(e.target.value))}
                className="w-full accent-amber-400"
              />
            </label>

            <label className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Camera Distance</span>
                <span className="font-mono-tabular text-amber-400">{settings.cameraDistance.toFixed(1)}m</span>
              </div>
              <input
                type="range"
                min={2.8}
                max={6.5}
                step={0.1}
                value={settings.cameraDistance}
                onChange={(e) => update('cameraDistance', Number(e.target.value))}
                className="w-full accent-amber-400"
              />
            </label>

            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                update('invertY', !settings.invertY);
              }}
              className="min-h-[44px] flex items-center justify-between px-3 rounded border bg-white/5 border-white/10 text-slate-200 cursor-pointer self-end"
            >
              <span className="text-xs font-medium">Invert Y-Axis</span>
              <span className="font-mono-tabular text-xs">{settings.invertY ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </section>

        {/* Audio */}
        <section className="space-y-3 pt-2 border-t border-white/10">
          <div className="text-xs uppercase tracking-[0.18em] text-amber-400">Audio</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <label className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Master Volume</span>
                <span className="font-mono-tabular text-amber-400">{Math.round(settings.masterVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.masterVolume}
                onChange={(e) => update('masterVolume', Number(e.target.value))}
                className="w-full accent-amber-400"
              />
            </label>

            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                update('muted', !settings.muted);
              }}
              className={`min-h-[44px] flex items-center justify-between px-3 rounded border cursor-pointer ${
                settings.muted
                  ? 'bg-red-500/15 border-red-400/50 text-red-200'
                  : 'bg-white/5 border-white/10 text-slate-200'
              }`}
            >
              <span className="text-xs font-medium">Mute All Sound</span>
              <span className="font-mono-tabular text-xs">{settings.muted ? 'MUTED' : 'ACTIVE'}</span>
            </button>
          </div>
        </section>

        {/* Android / Mobile Touch HUD Customization */}
        <section className="space-y-3 pt-2 border-t border-white/10">
          <div className="text-xs uppercase tracking-[0.18em] text-amber-400">Mobile Touch HUD Layout</div>

          <div className="grid grid-cols-3 gap-2">
            {(['auto', 'always', 'off'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  update('showTouchControls', mode);
                }}
                className={`min-h-[40px] rounded text-xs font-semibold uppercase tracking-wider border cursor-pointer ${
                  settings.showTouchControls === mode
                    ? 'bg-amber-400 text-[#0b0e12] border-amber-300'
                    : 'bg-white/5 text-slate-300 border-white/10'
                }`}
              >
                Touch: {mode}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(['standard', 'claw', 'compact'] as ControlLayoutPreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  update('controlPreset', preset);
                }}
                className={`min-h-[40px] rounded text-xs font-semibold uppercase tracking-wider border cursor-pointer ${
                  settings.controlPreset === preset
                    ? 'bg-emerald-400 text-[#0b0e12] border-emerald-300'
                    : 'bg-white/5 text-slate-300 border-white/10'
                }`}
              >
                {preset} Layout
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Touch Button Scale</span>
                <span className="font-mono-tabular text-amber-400">{Math.round(settings.controlScale * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.75}
                max={1.35}
                step={0.05}
                value={settings.controlScale}
                onChange={(e) => update('controlScale', Number(e.target.value))}
                className="w-full accent-amber-400"
              />
            </label>

            <label className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Touch Opacity</span>
                <span className="font-mono-tabular text-amber-400">{Math.round(settings.controlOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.35}
                max={1.0}
                step={0.05}
                value={settings.controlOpacity}
                onChange={(e) => update('controlOpacity', Number(e.target.value))}
                className="w-full accent-amber-400"
              />
            </label>
          </div>
        </section>

        <div className="flex justify-end pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            className="min-h-[44px] px-6 bg-amber-400 hover:bg-amber-300 text-[#0b0e12] font-display text-lg font-bold tracking-wider uppercase rounded cursor-pointer"
          >
            APPLY SETTINGS
          </button>
        </div>
      </div>
    </div>
  );
}
