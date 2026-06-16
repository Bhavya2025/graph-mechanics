import { useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { Check, ChevronLeft, Lock } from 'lucide-react';
import { LEVELS } from '../levels/levelData';
import { useGameStore } from '../store/gameStore';

function formatTime(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Level picker — cards with best time, solved state, and locked progression. */
export function LevelSelect() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const solved = useGameStore((s) => s.solved);
  const bestTimes = useGameStore((s) => s.bestTimes);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.lvl-head', { opacity: 0, y: -16, duration: 0.5, ease: 'power3.out' });
      gsap.from('.lvl-card', {
        opacity: 0,
        y: 30,
        scale: 0.94,
        stagger: 0.1,
        duration: 0.55,
        ease: 'back.out(1.3)',
        delay: 0.1,
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={rootRef}
      className="synth-backdrop scanlines relative h-full w-full overflow-y-auto px-6 py-8 thin-scroll"
    >
      <div className="mx-auto max-w-5xl">
        <div className="lvl-head mb-8 flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Back to home"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-synth-purple/40 bg-black/30 text-synth-text transition-colors hover:border-synth-purple hover:bg-synth-purple/15"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="font-display text-2xl font-black tracking-widest neon-text-pink">SELECT LEVEL</h1>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-synth-muted">
              {Object.values(solved).filter(Boolean).length} / {LEVELS.length} solved
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {LEVELS.map((lvl, index) => {
            const isSolved = !!solved[index];
            const unlocked = index === 0 || !!solved[index - 1];
            const best = bestTimes[index];

            return (
              <button
                key={lvl.id}
                type="button"
                disabled={!unlocked}
                onClick={() => navigate(`/play/${lvl.id}`)}
                className={`lvl-card group relative overflow-hidden rounded-2xl border p-5 text-left transition-all disabled:cursor-not-allowed ${
                  unlocked
                    ? 'border-synth-cyan/30 bg-synth-panel/50 hover:-translate-y-1 hover:border-synth-cyan hover:shadow-glow-cyan'
                    : 'border-white/5 bg-black/30 opacity-60'
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-display text-4xl font-black text-synth-purple/40 group-hover:text-synth-purple/70">
                    {String(lvl.id).padStart(2, '0')}
                  </span>
                  {!unlocked ? (
                    <Lock size={18} className="text-synth-muted" />
                  ) : isSolved ? (
                    <span className="flex items-center gap-1 rounded-full bg-synth-green/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-synth-green">
                      <Check size={11} /> Solved
                    </span>
                  ) : (
                    <span className="rounded-full bg-synth-pink/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-synth-pink">
                      New
                    </span>
                  )}
                </div>

                <h2 className="font-display text-lg font-bold tracking-wide text-synth-text">{lvl.name}</h2>
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-synth-muted">{lvl.description}</p>

                <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 font-mono text-xs">
                  <span className="text-synth-muted/70">{unlocked ? 'Ready' : 'Locked'}</span>
                  <span className="text-synth-cyan">{best != null ? `Best ${formatTime(best)}` : '—'}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
