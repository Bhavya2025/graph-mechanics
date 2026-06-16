import { MousePointerClick, RotateCcw, Rocket, Sliders } from 'lucide-react';
import { useCurrentLevel, useGameStore } from '../store/gameStore';

/**
 * The floating control panel (Prompt 1: "Slider Mode"). A semi-transparent, frosted-glass
 * synthwave panel housing the curve-shaping sliders plus Launch / Reset. No virtual
 * keyboard, no equations — the player shapes the terrain by dragging math-free sliders
 * ("Tilt", "Width", "Shift", "Height"), and the terrain morphs in real time.
 */
export function GameUI() {
  const level = useCurrentLevel();
  const variables = useGameStore((s) => s.variables);
  const setVariable = useGameStore((s) => s.setVariable);
  const phase = useGameStore((s) => s.phase);
  const curve = useGameStore((s) => s.curve);
  const launch = useGameStore((s) => s.launch);
  const resetAttempt = useGameStore((s) => s.resetAttempt);

  const running = phase === 'running';
  const canLaunch = !running && !!curve && !curve.error;

  return (
    <div className="pointer-events-auto w-[min(92vw,21rem)] rounded-2xl border border-synth-purple/30 bg-synth-panel/40 p-4 shadow-glow-purple backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2">
        <Sliders size={15} className="text-synth-cyan" />
        <h2 className="font-display text-sm font-bold tracking-widest text-synth-cyan">SHAPE THE CURVE</h2>
      </div>

      <div className="space-y-4">
        {level.template.sliders.map((s) => {
          const value = variables[s.key] ?? s.default;
          const decimals = s.step >= 1 ? 0 : s.step >= 0.1 ? 1 : 2;
          return (
            <label key={s.key} className="block">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-synth-text">{s.label}</span>
                <span className="font-mono text-xs tabular-nums text-synth-cyan">{value.toFixed(decimals)}</span>
              </div>
              <input
                type="range"
                className="synth-range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={value}
                disabled={running}
                aria-label={s.label}
                onChange={(e) => setVariable(s.key, parseFloat(e.target.value))}
              />
            </label>
          );
        })}
      </div>

      <p className="mt-4 flex items-center gap-1.5 rounded-md bg-synth-cyan/5 px-2.5 py-2 text-[11px] leading-snug text-synth-muted">
        <MousePointerClick size={13} className="shrink-0 text-synth-amber" />
        Tap the curve to drop a jump-pad at that point.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={resetAttempt}
          disabled={phase === 'editing'}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-synth-purple/40 bg-black/30 px-3 py-2.5 text-sm font-semibold text-synth-text transition-colors enabled:hover:border-synth-purple enabled:hover:bg-synth-purple/15 disabled:opacity-40"
        >
          <RotateCcw size={15} />
          Reset
        </button>
        <button
          type="button"
          onClick={launch}
          disabled={!canLaunch}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-black uppercase tracking-wider transition-all ${
            canLaunch
              ? 'animate-pulse-glow bg-synth-pink text-white shadow-glow-pink hover:scale-[1.03]'
              : 'cursor-not-allowed bg-white/5 text-synth-muted'
          }`}
        >
          <Rocket size={16} />
          Launch
        </button>
      </div>
    </div>
  );
}
