import type { ReactNode } from 'react';
import { Sparkles, Waves } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

/**
 * Calculus modifiers — the Derivative Ramp and Integral Zone toggles. Reads/writes the
 * Zustand store; the Game screen projects these onto the canvas handle.
 */
export function ModifierControls() {
  const ramp = useGameStore((s) => s.ramp);
  const zone = useGameStore((s) => s.zone);
  const setRamp = useGameStore((s) => s.setRamp);
  const setZone = useGameStore((s) => s.setZone);
  const running = useGameStore((s) => s.phase === 'running');

  return (
    <div className="space-y-3">
      <ModifierCard
        icon={<Sparkles size={14} className="text-synth-amber" />}
        title="Derivative Ramp"
        enabled={ramp.enabled}
        onToggle={(enabled) => setRamp({ enabled })}
        disabled={running}
      >
        <div className="flex items-center gap-2 text-sm">
          <span className="text-synth-muted">tangent at x =</span>
          <NumberField
            value={ramp.x}
            step={0.5}
            onChange={(x) => setRamp({ x })}
            disabled={running || !ramp.enabled}
          />
        </div>
      </ModifierCard>

      <ModifierCard
        icon={<Waves size={14} className="text-synth-teal" />}
        title="Integral Zone"
        enabled={zone.enabled}
        onToggle={(enabled) => setZone({ enabled })}
        disabled={running}
      >
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-synth-muted">x ∈ [</span>
          <NumberField
            value={zone.xMin}
            step={1}
            onChange={(xMin) => setZone({ xMin })}
            disabled={running || !zone.enabled}
          />
          <span className="text-synth-muted">,</span>
          <NumberField
            value={zone.xMax}
            step={1}
            onChange={(xMax) => setZone({ xMax })}
            disabled={running || !zone.enabled}
          />
          <span className="text-synth-muted">]</span>
          <select
            value={zone.effect}
            onChange={(e) => setZone({ effect: e.target.value as 'buoyancy' | 'mud' })}
            disabled={running || !zone.enabled}
            className="ml-auto rounded border border-synth-purple/40 bg-black/40 px-2 py-1 text-xs text-synth-text outline-none disabled:opacity-40"
          >
            <option value="buoyancy">Buoyancy</option>
            <option value="mud">Mud</option>
          </select>
        </div>
      </ModifierCard>
    </div>
  );
}

function ModifierCard({
  icon,
  title,
  enabled,
  onToggle,
  disabled,
  children,
}: {
  icon: ReactNode;
  title: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        enabled ? 'border-synth-purple/50 bg-synth-purple/5' : 'border-white/5 bg-black/20'
      }`}
    >
      <button
        type="button"
        onClick={() => onToggle(!enabled)}
        disabled={disabled}
        aria-pressed={enabled}
        className="flex w-full items-center justify-between disabled:opacity-50"
      >
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-synth-text">
          {icon}
          {title}
        </span>
        <span
          className={`relative h-5 w-9 rounded-full transition-colors ${
            enabled ? 'bg-synth-purple/80' : 'bg-white/10'
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </span>
      </button>
      {enabled && <div className="mt-3">{children}</div>}
    </div>
  );
}

function NumberField({
  value,
  onChange,
  step = 1,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      step={step}
      onChange={(e) => {
        const next = parseFloat(e.target.value);
        onChange(Number.isFinite(next) ? next : 0);
      }}
      disabled={disabled}
      aria-label="value"
      className="w-16 rounded border border-synth-cyan/30 bg-black/40 px-2 py-1 font-mono text-synth-cyan outline-none focus:border-synth-cyan disabled:opacity-40"
    />
  );
}
