/**
 * Integration Contract — the frozen seams between the three build domains
 * (UI/App Framework, Math UX & Parsing, Matter.js Physics).
 *
 * Every module codes against THESE shapes. Domain types (Level, Obstacle, …) live in
 * `types.ts`; this file defines only the data that crosses domain boundaries.
 */
import type { Level, LossReason, Vec2 } from './types';

export type { Vec2, LossReason, GamePhase } from './types';

/* ------------------------------------------------------------------ *
 * Geometry — GRAPH space (+y up, origin centered). Physics owns graph→pixel.
 * ------------------------------------------------------------------ */

/**
 * One ORDERED, stitched polyline. The parser must trace/stitch marching-squares
 * output into ordered branches — never raw unordered per-cell segments, because the
 * physics layer chains bodies in order. `closed` marks a loop (e.g. a circle).
 */
export interface CurveBranch {
  points: Vec2[];
  closed: boolean;
}

export interface CurveDomain {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface CurveResult {
  branches: CurveBranch[];
  domain: CurveDomain;
  error: string | null;
}

/* ------------------------------------------------------------------ *
 * UI ↔ Physics  (the canvas)
 * ------------------------------------------------------------------ */

export interface IntegralZoneSpec {
  xMin: number;
  xMax: number;
  effect: 'buoyancy' | 'mud';
}

export interface GameCanvasHandle {
  setCurve: (result: CurveResult) => void;
  /** Place a flat ramp tangent to the curve at graph x (null clears it). */
  setRamp: (graphX: number | null) => void;
  setIntegralZone: (zone: IntegralZoneSpec | null) => void;
  launch: () => void;
  reset: () => void;
}

export interface WinStats {
  /** Physics-measured completion time. Attempts are tracked by the store, not here. */
  timeMs: number;
}

export interface GameCanvasProps {
  level: Level;
  onWin: (stats: WinStats) => void;
  onLose: (reason: LossReason) => void;
  /** Player clicked the play area at this graph x (used to drop a jump-pad on the curve). */
  onCurveClick?: (graphX: number) => void;
}

/* ------------------------------------------------------------------ *
 * Leaderboard  (mock now via localStorage, Supabase later — same interface)
 * ------------------------------------------------------------------ */

export interface LeaderboardEntry {
  levelId: number;
  handle: string;
  timeMs: number;
  createdAt: string;
}

export interface LeaderboardService {
  top: (levelId: number, limit?: number) => Promise<LeaderboardEntry[]>;
  submit: (entry: Omit<LeaderboardEntry, 'createdAt'>) => Promise<void>;
}
