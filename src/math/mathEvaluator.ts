import { compile, derivative, type EvalFunction } from 'mathjs';
import type { Vec2 } from '../types';
import { graphToPixel, type ViewTransform } from './coordinates';

/**
 * The Math engine (a thin, framework-free wrapper around Math.js).
 *
 * Responsibilities:
 *  - parse/validate player equations of the form `y = f(x)`
 *  - sample the function across a domain and project it into pixel space, splitting
 *    the result into contiguous polyline segments at discontinuities/asymptotes
 *  - report the exact derivative slope at a point (symbolic, with a numeric fallback)
 *
 * It knows nothing about React or Matter.js.
 */

/** Anything beyond this many graph units off the axis is treated as "off to infinity". */
const Y_CLAMP = 1000;
/** A jump larger than this many graph units between adjacent samples implies an asymptote. */
const DISCONTINUITY_JUMP = 40;

/** Strip a leading `y =`, `y=` or `f(x) =` so the player can type either form. */
export function normalizeEquation(equation: string): string {
  return equation.replace(/^\s*(y|f\s*\(\s*x\s*\))\s*=\s*/i, '').trim();
}

/** Compile an equation, returning `null` (plus a message) on a syntax error. */
function tryCompile(equation: string): { fn: EvalFunction | null; error: string | null } {
  const expr = normalizeEquation(equation);
  if (!expr) return { fn: null, error: 'Enter an equation.' };
  try {
    return { fn: compile(expr), error: null };
  } catch (err) {
    return { fn: null, error: friendlyError(err) };
  }
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  // Math.js messages are decent already; just trim the noise.
  return msg.replace(/\s+/g, ' ').trim();
}

/**
 * Evaluate `f(x)` in graph space. Returns `NaN` for any value that is not a finite
 * real number (complex results, undefined symbols, division by zero, ...).
 */
function safeEval(fn: EvalFunction, x: number): number {
  try {
    const value = fn.evaluate({ x });
    return typeof value === 'number' && Number.isFinite(value) ? value : NaN;
  } catch {
    return NaN;
  }
}

/**
 * Validate an equation for the UI. Compiles it and probes a few sample points so
 * that undefined symbols (e.g. a stray `a`) are caught even though they parse fine.
 * Returns an error string, or `null` when the equation is usable.
 */
export function validateEquation(equation: string): string | null {
  const { fn, error } = tryCompile(equation);
  if (error) return error;
  if (!fn) return 'Enter an equation.';

  let finiteSamples = 0;
  for (const x of [-7.3, -2.1, 0, 1.7, 5.9]) {
    try {
      const value = fn.evaluate({ x });
      if (typeof value !== 'number') {
        return 'Expression must evaluate to a number (use x as the only variable).';
      }
      if (Number.isFinite(value)) finiteSamples += 1;
    } catch (err) {
      return friendlyError(err);
    }
  }
  if (finiteSamples === 0) {
    return 'Curve is undefined across the visible range.';
  }
  return null;
}

export interface CurveResult {
  /** Contiguous polylines in PIXEL space. Discontinuous functions yield >1 segment. */
  segments: Vec2[][];
  error: string | null;
}

/**
 * Sample `equationStr` over `[xRange[0], xRange[1]]` at the given graph-unit `step`,
 * convert each finite sample to pixel space via `transform`, and break the result
 * into separate polyline segments wherever the curve is undefined or leaps across an
 * asymptote. The returned points feed both the renderer and the physics body builder.
 */
export function generateCurvePoints(
  equationStr: string,
  xRange: [number, number],
  step: number,
  transform: ViewTransform,
): CurveResult {
  const { fn, error } = tryCompile(equationStr);
  if (error || !fn) {
    return { segments: [], error: error ?? 'Invalid equation.' };
  }

  const [xStart, xEnd] = xRange;
  const dx = Math.max(step, 1e-3);
  const segments: Vec2[][] = [];
  let current: Vec2[] = [];
  let prevGraphY: number | null = null;

  for (let x = xStart; x <= xEnd + dx / 2; x += dx) {
    const gy = safeEval(fn, x);
    const usable = Number.isFinite(gy) && Math.abs(gy) <= Y_CLAMP;

    if (!usable) {
      // Discontinuity / out of range: close off the current segment.
      if (current.length > 1) segments.push(current);
      current = [];
      prevGraphY = null;
      continue;
    }

    // Detect an asymptote crossing (sign-flip with a huge magnitude jump) and split.
    if (prevGraphY !== null && Math.abs(gy - prevGraphY) > DISCONTINUITY_JUMP) {
      if (current.length > 1) segments.push(current);
      current = [];
    }

    current.push(graphToPixel({ x, y: gy }, transform));
    prevGraphY = gy;
  }
  if (current.length > 1) segments.push(current);

  if (segments.length === 0) {
    return { segments: [], error: 'Curve is undefined across the visible range.' };
  }
  return { segments, error: null };
}

/** Evaluate the curve height (graph y) at a single x. Returns `NaN` if undefined. */
export function evaluateAt(equationStr: string, x: number): number {
  const { fn } = tryCompile(equationStr);
  if (!fn) return NaN;
  return safeEval(fn, x);
}

/**
 * Exact derivative slope dy/dx at `xValue`. Uses Math.js symbolic differentiation
 * when possible and falls back to a central finite difference for functions Math.js
 * cannot differentiate symbolically.
 */
export function getDerivativeSlope(equationStr: string, xValue: number): number {
  const expr = normalizeEquation(equationStr);

  // Symbolic first.
  try {
    const d = derivative(expr, 'x');
    const slope = d.evaluate({ x: xValue });
    if (typeof slope === 'number' && Number.isFinite(slope)) return slope;
  } catch {
    /* fall through to numeric */
  }

  // Numeric central difference.
  const h = 1e-4;
  const y1 = evaluateAt(equationStr, xValue - h);
  const y2 = evaluateAt(equationStr, xValue + h);
  const slope = (y2 - y1) / (2 * h);
  return Number.isFinite(slope) ? slope : 0;
}

/**
 * Tangent description at a point on the curve, in GRAPH space.
 * `angle` is the math-space slope angle (atan(dy/dx)); the physics layer flips its
 * sign when projecting to pixel space because pixel-y points downward.
 */
export interface TangentInfo {
  x: number;
  /** Graph y of the curve at x (NaN if the curve is undefined there). */
  y: number;
  slope: number;
  /** atan(slope), radians, in graph space. */
  angle: number;
}

export function getTangentAt(equationStr: string, x: number): TangentInfo {
  const y = evaluateAt(equationStr, x);
  const slope = getDerivativeSlope(equationStr, x);
  return { x, y, slope, angle: Math.atan(slope) };
}
