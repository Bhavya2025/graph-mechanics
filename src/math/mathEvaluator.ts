import { compile, type EvalFunction } from 'mathjs';
import type { CurveResult, Vec2 } from '../contracts';
import type { CurveDomain } from '../contracts';

/**
 * Math engine for the templated-slider game model.
 *
 * Levels expose a parametric template (e.g. "A * (x - H)^2 + K") and the UI feeds in
 * slider values ({ A, H, K }). `evaluateTemplate` substitutes them and samples the
 * function across the visible x-domain, returning clean graph-space points the physics
 * engine turns into terrain. Everything is crash-proofed: an invalid template yields a
 * flat fallback line so the engine never receives NaN/garbage.
 */

/** Sampling step in graph units (smaller = smoother terrain, more bodies). */
const SAMPLE_STEP = 0.12;
/** y-value of the safety fallback line when a template can't be evaluated. */
const FALLBACK_Y = -10;
/** Beyond this magnitude a sample is treated as undefined (trims asymptotes). */
const VALUE_CLAMP = 1e4;

const compileCache = new Map<string, EvalFunction | null>();

function getCompiled(templateStr: string): EvalFunction | null {
  if (compileCache.has(templateStr)) return compileCache.get(templateStr) ?? null;
  let fn: EvalFunction | null = null;
  try {
    fn = compile(templateStr);
  } catch {
    fn = null;
  }
  compileCache.set(templateStr, fn);
  return fn;
}

/** A flat line at `FALLBACK_Y` across the domain — the safe terrain when parsing fails. */
function fallbackLine(domainX: [number, number]): Vec2[] {
  return [
    { x: domainX[0], y: FALLBACK_Y },
    { x: domainX[1], y: FALLBACK_Y },
  ];
}

/**
 * Substitute `variables` into `templateStr` and sample y over `domainX`.
 *
 * @returns an ordered array of graph-space {x, y} points. On an invalid template (or one
 *          that produces no finite values) returns a flat fallback line at y = -10 so the
 *          physics engine always has valid terrain and never crashes.
 */
export function evaluateTemplate(
  templateStr: string,
  variables: Record<string, number>,
  domainX: [number, number],
): Vec2[] {
  const fn = getCompiled(templateStr);
  if (!fn) return fallbackLine(domainX);

  const [xMin, xMax] = domainX;
  const points: Vec2[] = [];
  // Reuse one scope object across samples for speed (60fps slider dragging).
  const scope: Record<string, number> = { ...variables, x: 0 };

  for (let x = xMin; x <= xMax + SAMPLE_STEP / 2; x += SAMPLE_STEP) {
    scope.x = x;
    let y: number;
    try {
      const r = fn.evaluate(scope);
      y = typeof r === 'number' ? r : NaN;
    } catch {
      // A structurally-broken template (e.g. undefined symbol) — bail to the safe line.
      return fallbackLine(domainX);
    }
    if (Number.isFinite(y) && Math.abs(y) <= VALUE_CLAMP) {
      points.push({ x, y });
    }
  }

  // Template parsed but produced nothing visible (all NaN/clamped) → safe line.
  if (points.length < 2) return fallbackLine(domainX);
  return points;
}

/**
 * Convenience wrapper that packages the sampled points as a `CurveResult` (a single
 * open branch) for the physics engine, which consumes the shared contract type.
 */
export function evaluateTemplateCurve(
  templateStr: string,
  variables: Record<string, number>,
  domain: CurveDomain,
): CurveResult {
  const points = evaluateTemplate(templateStr, variables, [domain.xMin, domain.xMax]);
  return {
    branches: [{ points, closed: false }],
    domain,
    error: null,
  };
}
