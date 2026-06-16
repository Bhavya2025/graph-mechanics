import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CurveResult, GamePhase, LossReason } from '../contracts';
import type { IntegralZoneConfig, RampConfig } from '../types';
import { getLevel, LEVEL_COUNT, LEVELS } from '../levels/levelData';
import { CURVE_DOMAIN } from '../math/coordinates';
import { generateImplicitCurve } from '../math/implicitParser';

/** Parse an equation to a graph-space curve (used for the suggested equation on load). */
function parseLatex(latex: string): CurveResult {
  return generateImplicitCurve(latex, CURVE_DOMAIN);
}

/**
 * Global game state (Zustand) — the single source of truth shared by every screen and
 * the canvas orchestration. Replaces the former Context+reducer. `bestTimes` and
 * `solved` are persisted to localStorage; transient attempt state is not.
 */

interface GameState {
  levelIndex: number;
  /** Raw LaTeX from the math field. */
  latex: string;
  /** Parsed curve (graph space) or null; `curve.error` holds parse errors. */
  curve: CurveResult | null;
  ramp: RampConfig;
  zone: IntegralZoneConfig;
  phase: GamePhase;
  lossReason: LossReason;
  elapsedMs: number;
  attempts: number;
  bestTimes: Record<number, number>;
  solved: Record<number, boolean>;
}

interface GameActions {
  loadLevel: (index: number) => void;
  nextLevel: () => void;
  setEquation: (latex: string, curve: CurveResult) => void;
  setRamp: (patch: Partial<RampConfig>) => void;
  setZone: (patch: Partial<IntegralZoneConfig>) => void;
  launch: () => void;
  resetAttempt: () => void;
  win: () => void;
  lose: (reason: LossReason) => void;
  tick: (deltaMs: number) => void;
}

export type GameStore = GameState & GameActions;

function freshModifiers(): { ramp: RampConfig; zone: IntegralZoneConfig } {
  return {
    ramp: { enabled: false, x: 0 },
    zone: { enabled: false, xMin: -3, xMax: 3, effect: 'buoyancy' },
  };
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      levelIndex: 0,
      latex: LEVELS[0].suggestedEquation ?? '',
      curve: parseLatex(LEVELS[0].suggestedEquation ?? ''),
      ...freshModifiers(),
      phase: 'editing',
      lossReason: null,
      elapsedMs: 0,
      attempts: 0,
      bestTimes: {},
      solved: {},

      loadLevel: (index) => {
        const i = Math.max(0, Math.min(index, LEVEL_COUNT - 1));
        const level = LEVELS[i];
        const latex = level.suggestedEquation ?? '';
        set({
          levelIndex: i,
          latex,
          curve: parseLatex(latex),
          ...freshModifiers(),
          phase: 'editing',
          lossReason: null,
          elapsedMs: 0,
          attempts: 0,
        });
      },

      nextLevel: () => get().loadLevel((get().levelIndex + 1) % LEVEL_COUNT),

      setEquation: (latex, curve) => set({ latex, curve }),
      setRamp: (patch) => set((s) => ({ ramp: { ...s.ramp, ...patch } })),
      setZone: (patch) => set((s) => ({ zone: { ...s.zone, ...patch } })),

      launch: () => {
        const s = get();
        if (s.curve?.error || !s.curve) return;
        set({ phase: 'running', lossReason: null, elapsedMs: 0, attempts: s.attempts + 1 });
      },

      resetAttempt: () => set({ phase: 'editing', lossReason: null, elapsedMs: 0 }),

      win: () => {
        const s = get();
        if (s.phase !== 'running') return;
        const prev = s.bestTimes[s.levelIndex];
        const best = prev == null ? s.elapsedMs : Math.min(prev, s.elapsedMs);
        set({
          phase: 'won',
          solved: { ...s.solved, [s.levelIndex]: true },
          bestTimes: { ...s.bestTimes, [s.levelIndex]: best },
        });
      },

      lose: (reason) => {
        if (get().phase !== 'running') return;
        set({ phase: 'lost', lossReason: reason });
      },

      tick: (deltaMs) => {
        const s = get();
        if (s.phase !== 'running') return;
        set({ elapsedMs: s.elapsedMs + deltaMs });
      },
    }),
    {
      name: 'graph-mechanics:progress',
      partialize: (s) => ({ bestTimes: s.bestTimes, solved: s.solved }),
    },
  ),
);

/** Convenience selector for the active level object. */
export function useCurrentLevel() {
  return useGameStore((s) => getLevel(s.levelIndex));
}
