import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Activity, ChevronLeft, Clock } from 'lucide-react';
import type { GameCanvasHandle } from '../contracts';
import { GameCanvas } from '../components/GameCanvas';
import { GameUI } from '../components/GameUI';
import { ResultModal } from '../components/ResultModal';
import { LEVELS, LEVEL_COUNT } from '../levels/levelData';
import { useCurrentLevel, useGameStore } from '../store/gameStore';

const TICK_MS = 100;

/**
 * The play screen. The canvas is full-bleed (the primary focus) with a frosted-glass
 * control panel and a slim HUD floating over it. It bridges store state to the canvas
 * handle: curve morphing, jump-pad placement (click), launch/reset, timing and outcome.
 */
export function Game() {
  const navigate = useNavigate();
  const { levelId } = useParams();
  const canvasRef = useRef<GameCanvasHandle>(null);
  const [lbVersion, setLbVersion] = useState(0);

  const level = useCurrentLevel();
  const levelIndex = useGameStore((s) => s.levelIndex);
  const curve = useGameStore((s) => s.curve);
  const ramp = useGameStore((s) => s.ramp);
  const phase = useGameStore((s) => s.phase);
  const elapsedMs = useGameStore((s) => s.elapsedMs);
  const attempts = useGameStore((s) => s.attempts);

  const loadLevel = useGameStore((s) => s.loadLevel);
  const setRamp = useGameStore((s) => s.setRamp);
  const tick = useGameStore((s) => s.tick);
  const win = useGameStore((s) => s.win);
  const lose = useGameStore((s) => s.lose);

  // Sync route → store level.
  useEffect(() => {
    const idx = LEVELS.findIndex((l) => String(l.id) === levelId);
    const target = idx >= 0 ? idx : 0;
    if (target !== useGameStore.getState().levelIndex) loadLevel(target);
  }, [levelId, loadLevel]);

  // Real-time morphing: push the derived curve to the engine whenever it changes.
  useEffect(() => {
    if (curve) canvasRef.current?.setCurve(curve);
  }, [curve]);

  // Jump-pad (Derivative Ramp) placement.
  useEffect(() => {
    canvasRef.current?.setRamp(ramp.enabled ? ramp.x : null);
  }, [ramp.enabled, ramp.x]);

  useEffect(() => {
    if (phase === 'running') canvasRef.current?.launch();
    else if (phase === 'editing') canvasRef.current?.reset();
  }, [phase]);

  // Attempt timer + time-limit loss.
  useEffect(() => {
    if (phase !== 'running') return;
    const id = window.setInterval(() => tick(TICK_MS), TICK_MS);
    return () => window.clearInterval(id);
  }, [phase, tick]);

  useEffect(() => {
    if (phase === 'running' && level.timeLimit && elapsedMs >= level.timeLimit * 1000) lose('timeout');
  }, [phase, elapsedMs, level.timeLimit, lose]);

  const goNext = () => navigate(`/play/${LEVELS[(levelIndex + 1) % LEVEL_COUNT].id}`);

  const onCurveClick = (graphX: number) => {
    if (phase === 'editing') setRamp({ enabled: true, x: graphX });
  };

  const remaining = level.timeLimit ? Math.max(0, level.timeLimit - elapsedMs / 1000) : null;

  return (
    <div className="relative h-full w-full overflow-hidden bg-synth-bg">
      {/* Full-bleed play surface (the primary focus). */}
      <GameCanvas ref={canvasRef} level={level} onWin={win} onLose={lose} onCurveClick={onCurveClick} />

      {/* Slim HUD, top-left. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-synth-purple/25 bg-synth-panel/40 px-3 py-2 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => navigate('/levels')}
            aria-label="Back to level select"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-synth-text transition-colors hover:bg-synth-purple/20"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="leading-tight">
            <p className="font-display text-xs font-bold tracking-widest neon-text-pink">
              GRAPH<span className="neon-text-cyan">MECHANICS</span>
            </p>
            <p className="text-[10px] uppercase tracking-widest text-synth-muted">
              Lv {level.id} · {level.name}
            </p>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-synth-purple/25 bg-synth-panel/40 px-3 py-2 font-mono text-sm backdrop-blur-xl">
          <span
            className={`flex items-center gap-1.5 tabular-nums ${
              remaining != null && remaining <= 3 ? 'animate-pulse text-synth-pink' : 'text-synth-cyan'
            }`}
          >
            <Clock size={14} />
            {remaining != null ? `${remaining.toFixed(1)}s` : `${(elapsedMs / 1000).toFixed(1)}s`}
          </span>
          <span className="flex items-center gap-1.5 text-synth-muted">
            <Activity size={14} />
            {attempts}
          </span>
        </div>
      </div>

      {/* Floating control panel: right on wide screens, bottom on narrow. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4 sm:bottom-auto sm:right-0 sm:top-1/2 sm:left-auto sm:-translate-y-1/2 sm:justify-end">
        <GameUI />
      </div>

      {/* Hint badge, bottom-left (hidden on small to avoid overlap). */}
      {level.hint && (
        <div className="pointer-events-none absolute bottom-4 left-4 hidden max-w-xs rounded-xl border border-synth-amber/20 bg-synth-panel/40 px-3 py-2 text-xs leading-relaxed text-synth-amber/90 backdrop-blur-xl lg:block">
          {level.hint}
        </div>
      )}

      <ResultModal
        onReplay={() => useGameStore.getState().resetAttempt()}
        onNext={goNext}
        leaderboardVersion={lbVersion}
        onScoreSubmitted={() => setLbVersion((v) => v + 1)}
      />
    </div>
  );
}
