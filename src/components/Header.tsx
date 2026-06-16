import type { ReactNode } from 'react';
import { Activity, ChevronLeft, Clock, RotateCcw, Rocket, Target } from 'lucide-react';
import { useCurrentLevel, useGameStore } from '../store/gameStore';

/**
 * The in-game dashboard header: back control, level identity, live timer / attempts /
 * progress, and the primary LAUNCH / RESET controls (driven by the store).
 */
export function Header({ onBack }: { onBack: () => void }) {
  const level = useCurrentLevel();
  const phase = useGameStore((s) => s.phase);
  const elapsedMs = useGameStore((s) => s.elapsedMs);
  const attempts = useGameStore((s) => s.attempts);
  const solved = useGameStore((s) => s.solved);
  const curve = useGameStore((s) => s.curve);
  const launch = useGameStore((s) => s.launch);
  const resetAttempt = useGameStore((s) => s.resetAttempt);

  const running = phase === 'running';
  const canLaunch = !running && !!curve && !curve.error;
  const seconds = (elapsedMs / 1000).toFixed(1);
  const remaining = level.timeLimit ? Math.max(0, level.timeLimit - elapsedMs / 1000) : null;
  const solvedCount = Object.values(solved).filter(Boolean).length;

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-synth-purple/20 bg-synth-panel/60 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to level select"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-synth-purple/40 bg-black/30 text-synth-text transition-colors hover:border-synth-purple hover:bg-synth-purple/15"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-lg font-black tracking-[0.16em] neon-text-pink">
            GRAPH<span className="neon-text-cyan">MECHANICS</span>
          </h1>
          <span className="hidden text-xs uppercase tracking-widest text-synth-muted sm:inline">
            Lv {level.id} · {level.name}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Stat
          icon={<Clock size={14} />}
          label={remaining != null ? 'Time Left' : 'Time'}
          value={remaining != null ? `${remaining.toFixed(1)}s` : `${seconds}s`}
          danger={remaining != null && remaining <= 3}
        />
        <Stat icon={<Activity size={14} />} label="Attempts" value={String(attempts)} />
        <Stat icon={<Target size={14} />} label="Solved" value={`${solvedCount}/3`} />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetAttempt}
            disabled={phase === 'editing'}
            title="Reset attempt"
            className="flex items-center gap-1.5 rounded-lg border border-synth-purple/40 bg-black/30 px-3 py-2 text-sm font-semibold text-synth-text transition-colors enabled:hover:border-synth-purple enabled:hover:bg-synth-purple/15 disabled:opacity-40"
          >
            <RotateCcw size={15} />
            <span className="hidden md:inline">Reset</span>
          </button>
          <button
            type="button"
            onClick={launch}
            disabled={!canLaunch}
            className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-black uppercase tracking-wider transition-all ${
              canLaunch
                ? 'animate-pulse-glow bg-synth-pink text-white shadow-glow-pink hover:scale-105'
                : 'cursor-not-allowed bg-white/5 text-synth-muted'
            }`}
          >
            <Rocket size={16} />
            Launch
          </button>
        </div>
      </div>
    </header>
  );
}

function Stat({
  icon,
  label,
  value,
  danger,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="hidden flex-col items-end leading-none sm:flex">
      <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-synth-muted">
        {icon}
        {label}
      </span>
      <span
        className={`mt-1 font-mono text-base font-bold tabular-nums ${
          danger ? 'animate-pulse text-synth-pink' : 'text-synth-cyan'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
