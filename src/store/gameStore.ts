import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CurveResult, GamePhase, LossReason } from '../contracts';
import type { Level, RampConfig } from '../types';
import { getLevel, LEVEL_COUNT, LEVELS } from '../levels/levelData';
import { CURVE_DOMAIN } from '../math/coordinates';
import { evaluateTemplateCurve } from '../math/mathEvaluator';

/**
 * Global game state (Zustand). The player shapes the terrain with sliders, so the source
 * of truth is the per-level template plus the current `variables`; `curve` is derived
 * from them via the template evaluator. `bestTimes`/`solved` persist to localStorage.
 */

/** Slider defaults for a level → the starting variable values. */
function defaultVariables(level: Level): Record<string, number> {
  const vars: Record<string, number> = {};
  for (const s of level.template.sliders) vars[s.key] = s.default;
  return vars;
}

/** Sample the level's template at the given variables into a physics-ready curve. */
function deriveCurve(level: Level, variables: Record<string, number>): CurveResult {
  return evaluateTemplateCurve(level.template.expr, variables, CURVE_DOMAIN);
}

interface GameState {
  levelIndex: number;
  /** Current slider values keyed by the template's variable names. */
  variables: Record<string, number>;
  /** Terrain curve derived from the template + variables. */
  curve: CurveResult | null;
  /** Derivative jump-pad placed by clicking the curve. */
  ramp: RampConfig;
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
  /** Move one slider; the curve re-derives instantly (real-time morphing). */
  setVariable: (key: string, value: number) => void;
  /** Place / move the jump-pad (or clear it with `enabled:false`). */
  setRamp: (patch: Partial<RampConfig>) => void;
  launch: () => void;
  resetAttempt: () => void;
  win: () => void;
  lose: (reason: LossReason) => void;
  tick: (deltaMs: number) => void;
}

export type GameStore = GameState & GameActions;

const initialLevel = LEVELS[0];
const initialVars = defaultVariables(initialLevel);

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      levelIndex: 0,
      variables: initialVars,
      curve: deriveCurve(initialLevel, initialVars),
      ramp: { enabled: false, x: 0 },
      phase: 'editing',
      lossReason: null,
      elapsedMs: 0,
      attempts: 0,
      bestTimes: {},
      solved: {},

      loadLevel: (index) => {
        const i = Math.max(0, Math.min(index, LEVEL_COUNT - 1));
        const level = LEVELS[i];
        const variables = defaultVariables(level);
        set({
          levelIndex: i,
          variables,
          curve: deriveCurve(level, variables),
          ramp: { enabled: false, x: 0 },
          phase: 'editing',
          lossReason: null,
          elapsedMs: 0,
          attempts: 0,
        });
      },

      nextLevel: () => get().loadLevel((get().levelIndex + 1) % LEVEL_COUNT),

      setVariable: (key, value) => {
        const s = get();
        const variables = { ...s.variables, [key]: value };
        set({ variables, curve: deriveCurve(getLevel(s.levelIndex), variables) });
      },

      setRamp: (patch) => set((s) => ({ ramp: { ...s.ramp, ...patch } })),

      launch: () => {
        const s = get();
        if (!s.curve || s.curve.error) return;
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
