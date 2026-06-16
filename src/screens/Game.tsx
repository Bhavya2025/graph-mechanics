import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Info, Lightbulb } from 'lucide-react';
import type { GameCanvasHandle } from '../contracts';
import { EquationInput } from '../components/EquationInput';
import { GameCanvas } from '../components/GameCanvas';
import { Header } from '../components/Header';
import { Leaderboard } from '../components/Leaderboard';
import { ModifierControls } from '../components/ModifierControls';
import { ResultModal } from '../components/ResultModal';
import { LEVELS, LEVEL_COUNT } from '../levels/levelData';
import { useCurrentLevel, useGameStore } from '../store/gameStore';

const TICK_MS = 100;

export function Game() {
  const navigate = useNavigate();
  const { levelId } = useParams();
  const canvasRef = useRef<GameCanvasHandle>(null);
  const [lbVersion, setLbVersion] = useState(0);

  const level = useCurrentLevel();
  const levelIndex = useGameStore((s) => s.levelIndex);
  const latex = useGameStore((s) => s.latex);
  const curve = useGameStore((s) => s.curve);
  const ramp = useGameStore((s) => s.ramp);
  const zone = useGameStore((s) => s.zone);
  const phase = useGameStore((s) => s.phase);
  const elapsedMs = useGameStore((s) => s.elapsedMs);

  const loadLevel = useGameStore((s) => s.loadLevel);
  const setEquation = useGameStore((s) => s.setEquation);
  const tick = useGameStore((s) => s.tick);
  const win = useGameStore((s) => s.win);
  const lose = useGameStore((s) => s.lose);

  // Sync route → store level.
  useEffect(() => {
    const idx = LEVELS.findIndex((l) => String(l.id) === levelId);
    const target = idx >= 0 ? idx : 0;
    if (target !== useGameStore.getState().levelIndex) loadLevel(target);
  }, [levelId, loadLevel]);

  // Drive the canvas from store state.
  useEffect(() => {
    if (curve) canvasRef.current?.setCurve(curve);
  }, [curve]);

  useEffect(() => {
    canvasRef.current?.setRamp(ramp.enabled ? ramp.x : null);
  }, [ramp.enabled, ramp.x]);

  useEffect(() => {
    canvasRef.current?.setIntegralZone(
      zone.enabled ? { xMin: zone.xMin, xMax: zone.xMax, effect: zone.effect } : null,
    );
  }, [zone.enabled, zone.xMin, zone.xMax, zone.effect]);

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
    if (phase === 'running' && level.timeLimit && elapsedMs >= level.timeLimit * 1000) {
      lose('timeout');
    }
  }, [phase, elapsedMs, level.timeLimit, lose]);

  const goNext = () => {
    const nextIndex = (levelIndex + 1) % LEVEL_COUNT;
    navigate(`/play/${LEVELS[nextIndex].id}`);
  };

  return (
    <div className="synth-backdrop flex h-full w-full flex-col">
      <Header onBack={() => navigate('/levels')} />
      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="relative min-h-[45vh] flex-1 lg:min-h-0">
          <GameCanvas ref={canvasRef} level={level} onWin={win} onLose={lose} />
          <ResultModal
            onReplay={() => useGameStore.getState().resetAttempt()}
            onNext={goNext}
            onScoreSubmitted={() => setLbVersion((v) => v + 1)}
          />
        </section>

        <aside className="thin-scroll flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-t border-synth-purple/20 bg-synth-panel/40 p-4 backdrop-blur lg:w-[24rem] lg:border-l lg:border-t-0">
          <div className="panel p-4">
            <h2 className="flex items-center gap-2 font-display text-sm font-bold tracking-widest text-synth-cyan">
              <Info size={15} />
              {level.name}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-synth-text/80">{level.description}</p>
            {level.hint && (
              <p className="mt-3 flex items-start gap-2 rounded-md bg-synth-amber/10 p-2.5 text-xs leading-relaxed text-synth-amber/90">
                <Lightbulb size={14} className="mt-0.5 shrink-0" />
                {level.hint}
              </p>
            )}
          </div>

          <div className="panel space-y-4 p-4">
            <EquationInput value={latex} disabled={phase === 'running'} onChange={(r) => setEquation(r.latex, r.result)} />
            <ModifierControls />
          </div>

          <Leaderboard levelId={level.id} version={lbVersion} />
        </aside>
      </main>
    </div>
  );
}
