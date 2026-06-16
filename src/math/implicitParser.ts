import { compile, type EvalFunction } from 'mathjs';
import { convertLatexToAsciiMath } from 'mathlive';
import type { CurveBranch, CurveDomain, CurveResult, Vec2 } from '../contracts';

/**
 * Math UX & Parsing engine — implicit-first.
 *
 * Every equation is treated as F(x, y) = 0:
 *   - "y = f(x)"      → F = f(x) − y
 *   - "lhs = rhs"     → F = lhs − rhs   (e.g. x^2 + y^2 = 16)
 *   - "expr" (no '=') → assume y = expr
 *
 * F is sampled on a grid and the zero-contour is extracted with **marching squares**,
 * then stitched into ordered, deduplicated polylines (`CurveBranch[]`) in GRAPH space.
 * The physics layer owns graph→pixel; this module never touches pixels or React.
 */

const DEFAULT_RESOLUTION = 140;
/** Treat values beyond this magnitude as undefined (trims asymptote walls). */
const VALUE_CLAMP = 1e4;

/* ------------------------------------------------------------------ *
 * LaTeX → Math.js expression
 * ------------------------------------------------------------------ */

/**
 * Convert a MathLive LaTeX string to a Math.js-evaluable expression. Uses MathLive's
 * own LaTeX→ASCIIMath converter (purpose-built) then normalizes the few ASCIIMath
 * idioms Math.js doesn't share. Falls back to the raw string on failure.
 */
export function latexToExpr(latex: string): string {
  let s: string;
  try {
    s = convertLatexToAsciiMath(latex);
  } catch {
    s = latex;
  }
  return s
    .replace(/\bxx\b/g, '*') // ASCIIMath cross-product ×
    .replace(/\*\*/g, '^') // occasional power form
    .replace(/·/g, '*') // middle dot
    .replace(/\|([^|]+)\|/g, 'abs($1)') // |x| → abs(x)
    .replace(/\bln\b/g, 'log') // natural log → Math.js log
    .trim();
}

/** Index of the top-level '=' (depth 0, not part of <=, >=, ==, !=), or -1. */
function topLevelEquals(expr: string): number {
  let depth = 0;
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === '=' && depth === 0) {
      const prev = expr[i - 1];
      const next = expr[i + 1];
      if (prev === '<' || prev === '>' || prev === '!' || prev === '=' || next === '=') continue;
      return i;
    }
  }
  return -1;
}

function toZeroForm(expr: string): { expr?: string; error?: string } {
  const idx = topLevelEquals(expr);
  if (idx >= 0) {
    const lhs = expr.slice(0, idx).trim();
    const rhs = expr.slice(idx + 1).trim();
    if (!lhs || !rhs) return { error: 'Incomplete equation.' };
    return { expr: `(${lhs})-(${rhs})` };
  }
  if (!expr.trim()) return { error: 'Enter an equation.' };
  return { expr: `(${expr})-(y)` }; // bare expression ⇒ y = expr
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/\s+/g, ' ').trim();
}

/* ------------------------------------------------------------------ *
 * Marching squares
 * ------------------------------------------------------------------ */

// Edge ids: T=0 (TL–TR), R=1 (TR–BR), B=2 (BR–BL), L=3 (BL–TL).
// Corner-inside bits: TL=8, TR=4, BR=2, BL=1.
const CASE_EDGES: number[][][] = [
  [], // 0
  [[3, 2]], // 1  BL
  [[2, 1]], // 2  BR
  [[3, 1]], // 3  BL,BR
  [[0, 1]], // 4  TR
  [[0, 3], [2, 1]], // 5  TR,BL (saddle)
  [[0, 2]], // 6  TR,BR
  [[0, 3]], // 7  TR,BR,BL
  [[0, 3]], // 8  TL
  [[0, 2]], // 9  TL,BL
  [[0, 1], [2, 3]], // 10 TL,BR (saddle)
  [[0, 1]], // 11 TL,BR,BL
  [[3, 1]], // 12 TL,TR
  [[2, 1]], // 13 TL,TR,BL
  [[3, 2]], // 14 TL,TR,BR
  [], // 15
];

interface Seg {
  a: Vec2;
  b: Vec2;
}

/** Stitch unordered segments into ordered polylines by matching shared endpoints. */
function stitch(segs: Seg[]): CurveBranch[] {
  const key = (p: Vec2) => `${Math.round(p.x * 1e4)}:${Math.round(p.y * 1e4)}`;
  const endpoints = new Map<string, number[]>();
  const add = (k: string, i: number) => {
    const list = endpoints.get(k);
    if (list) list.push(i);
    else endpoints.set(k, [i]);
  };
  segs.forEach((s, i) => {
    add(key(s.a), i);
    add(key(s.b), i);
  });

  const used = new Uint8Array(segs.length);
  const otherEnd = (s: Seg, p: Vec2) => (key(s.a) === key(p) ? s.b : s.a);
  const nextSeg = (k: string) => {
    const list = endpoints.get(k);
    if (!list) return -1;
    for (const i of list) if (!used[i]) return i;
    return -1;
  };

  const branches: CurveBranch[] = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const points: Vec2[] = [segs[i].a, segs[i].b];

    let guard = 0;
    while (guard++ < segs.length) {
      const tail = points[points.length - 1];
      const ni = nextSeg(key(tail));
      if (ni < 0) break;
      used[ni] = 1;
      points.push(otherEnd(segs[ni], tail));
    }
    guard = 0;
    while (guard++ < segs.length) {
      const head = points[0];
      const ni = nextSeg(key(head));
      if (ni < 0) break;
      used[ni] = 1;
      points.unshift(otherEnd(segs[ni], head));
    }

    const deduped = dedupe(points);
    if (deduped.length < 2) continue;
    const closed = key(deduped[0]) === key(deduped[deduped.length - 1]);
    branches.push({ points: deduped, closed });
  }
  return branches;
}

function dedupe(points: Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - p.x) > 1e-4 || Math.abs(last.y - p.y) > 1e-4) out.push(p);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

export function generateImplicitCurve(
  latex: string,
  domain: CurveDomain,
  resolution: number = DEFAULT_RESOLUTION,
): CurveResult {
  const expr = latexToExpr(latex);
  const zero = toZeroForm(expr);
  if (zero.error || !zero.expr) {
    return { branches: [], domain, error: zero.error ?? 'Invalid equation.' };
  }

  let fn: EvalFunction;
  try {
    fn = compile(zero.expr);
  } catch (err) {
    return { branches: [], domain, error: friendlyError(err) };
  }

  const { xMin, xMax, yMin, yMax } = domain;
  const n = Math.max(16, Math.floor(resolution));
  const dx = (xMax - xMin) / n;
  const dy = (yMax - yMin) / n;
  const cols = n + 1;

  // Sample F on the grid (reused scope object for speed). NaN marks undefined.
  const grid = new Float64Array(cols * cols);
  const scope = { x: 0, y: 0 };
  for (let j = 0; j <= n; j++) {
    const y = yMin + j * dy;
    for (let i = 0; i <= n; i++) {
      scope.x = xMin + i * dx;
      scope.y = y;
      let v: number;
      try {
        const r = fn.evaluate(scope);
        v = typeof r === 'number' && Number.isFinite(r) && Math.abs(r) <= VALUE_CLAMP ? r : NaN;
      } catch {
        return { branches: [], domain, error: 'Use only x and y as variables.' };
      }
      grid[j * cols + i] = v;
    }
  }

  const at = (i: number, j: number) => grid[j * cols + i];
  const segs: Seg[] = [];

  for (let j = 0; j < n; j++) {
    const yB = yMin + j * dy;
    const yT = yB + dy;
    for (let i = 0; i < n; i++) {
      const bl = at(i, j);
      const br = at(i + 1, j);
      const tr = at(i + 1, j + 1);
      const tl = at(i, j + 1);
      if (Number.isNaN(bl) || Number.isNaN(br) || Number.isNaN(tr) || Number.isNaN(tl)) continue;

      const idx = (tl >= 0 ? 8 : 0) | (tr >= 0 ? 4 : 0) | (br >= 0 ? 2 : 0) | (bl >= 0 ? 1 : 0);
      const edges = CASE_EDGES[idx];
      if (edges.length === 0) continue;

      const xL = xMin + i * dx;
      const xR = xL + dx;
      const point = (edge: number): Vec2 => {
        switch (edge) {
          case 0: // T: TL–TR at y=yT
            return { x: xL + (tl / (tl - tr)) * dx, y: yT };
          case 1: // R: BR–TR at x=xR
            return { x: xR, y: yB + (br / (br - tr)) * dy };
          case 2: // B: BL–BR at y=yB
            return { x: xL + (bl / (bl - br)) * dx, y: yB };
          default: // 3 L: BL–TL at x=xL
            return { x: xL, y: yB + (bl / (bl - tl)) * dy };
        }
      };

      for (const [e0, e1] of edges) segs.push({ a: point(e0), b: point(e1) });
    }
  }

  if (segs.length === 0) {
    return { branches: [], domain, error: 'Curve is not visible in this range.' };
  }

  return { branches: stitch(segs), domain, error: null };
}
