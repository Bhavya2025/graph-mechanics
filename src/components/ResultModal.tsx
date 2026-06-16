import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ArrowRight, RotateCcw, Send, Skull, Trophy } from 'lucide-react';
import type { LossReason } from '../types';
import { useCurrentLevel, useGameStore } from '../store/gameStore';
import { LEVEL_COUNT } from '../levels/levelData';
import { leaderboard } from '../services/leaderboard';

function formatTime(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

const LOSS_COPY: Record<NonNullable<LossReason>, { title: string; detail: string }> = {
  enemy: { title: 'INTERCEPTED', detail: 'The hunter reached the ball. Find a faster line.' },
  fell: { title: 'OFF THE GRID', detail: 'The ball left the playfield. Reshape your curve.' },
  timeout: { title: 'TIME OUT', detail: 'The clock beat you. Carry more speed.' },
  stalled: { title: 'STALLED OUT', detail: 'The ball stopped short. Build more speed or a smoother path.' },
};

const HANDLE_KEY = 'graph-mechanics:handle';

export function ResultModal({
  onReplay,
  onNext,
  onScoreSubmitted,
}: {
  onReplay: () => void;
  onNext: () => void;
  onScoreSubmitted: () => void;
}) {
  const phase = useGameStore((s) => s.phase);
  const lossReason = useGameStore((s) => s.lossReason);
  const elapsedMs = useGameStore((s) => s.elapsedMs);
  const levelIndex = useGameStore((s) => s.levelIndex);
  const attempts = useGameStore((s) => s.attempts);
  const bestTimes = useGameStore((s) => s.bestTimes);
  const level = useCurrentLevel();

  const cardRef = useRef<HTMLDivElement>(null);
  const [handle, setHandle] = useState(() => localStorage.getItem(HANDLE_KEY) ?? '');
  const [submitted, setSubmitted] = useState(false);

  const visible = phase === 'won' || phase === 'lost';
  const won = phase === 'won';

  useEffect(() => {
    if (visible) setSubmitted(false);
  }, [visible, levelIndex]);

  useEffect(() => {
    if (visible && cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { y: 24, scale: 0.92, opacity: 0 },
        { y: 0, scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.6)' },
      );
    }
  }, [visible]);

  if (!visible) return null;

  const isLast = levelIndex === LEVEL_COUNT - 1;
  const best = bestTimes[levelIndex];
  const loss = lossReason ? LOSS_COPY[lossReason] : null;

  const submit = async () => {
    const name = handle.trim() || 'Anonymous';
    localStorage.setItem(HANDLE_KEY, name);
    await leaderboard.submit({ levelId: level.id, handle: name, timeMs: elapsedMs });
    setSubmitted(true);
    onScoreSubmitted();
  };

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-synth-bg/70 p-4 backdrop-blur-sm">
      <div
        ref={cardRef}
        className={`panel w-[min(92%,26rem)] p-7 text-center ${won ? 'shadow-glow-green' : 'shadow-glow-pink'}`}
      >
        <div className="mb-3 flex justify-center">
          {won ? (
            <Trophy size={48} className="text-synth-green drop-shadow-[0_0_12px_rgba(57,255,20,0.7)]" />
          ) : (
            <Skull size={48} className="text-synth-pink drop-shadow-[0_0_12px_rgba(255,46,136,0.7)]" />
          )}
        </div>

        <h2 className={`font-display text-2xl font-black tracking-widest ${won ? 'neon-text-cyan' : 'neon-text-pink'}`}>
          {won ? 'SOLVED' : loss?.title ?? 'FAILED'}
        </h2>

        <p className="mt-2 text-sm text-synth-muted">
          {won
            ? `Cleared in ${formatTime(elapsedMs)} over ${attempts} ${attempts === 1 ? 'attempt' : 'attempts'}.`
            : loss?.detail}
        </p>
        {won && best != null && <p className="mt-1 text-xs text-synth-green/80">Best: {formatTime(best)}</p>}

        {won && (
          <div className="mt-5">
            {submitted ? (
              <p className="text-xs uppercase tracking-widest text-synth-green">✓ Submitted to leaderboard</p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
                className="flex items-center gap-2"
              >
                <input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  maxLength={16}
                  placeholder="Your handle"
                  aria-label="Leaderboard handle"
                  className="min-w-0 flex-1 rounded-lg border border-synth-cyan/40 bg-black/40 px-3 py-2 text-sm text-synth-text outline-none focus:border-synth-cyan"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-lg border border-synth-amber/60 bg-synth-amber/15 px-3 py-2 text-sm font-semibold text-synth-amber hover:bg-synth-amber/25"
                >
                  <Send size={14} />
                  Save
                </button>
              </form>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={onReplay}
            className="flex items-center gap-2 rounded-lg border border-synth-purple/50 bg-black/30 px-4 py-2 text-sm font-semibold text-synth-text transition-colors hover:border-synth-purple hover:bg-synth-purple/15"
          >
            <RotateCcw size={15} />
            {won ? 'Replay' : 'Retry'}
          </button>
          {won && (
            <button
              type="button"
              onClick={onNext}
              className="flex items-center gap-2 rounded-lg border border-synth-cyan bg-synth-cyan/15 px-4 py-2 text-sm font-bold text-synth-cyan shadow-glow-cyan transition-transform hover:scale-105"
            >
              {isLast ? 'Restart' : 'Next Level'}
              <ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
