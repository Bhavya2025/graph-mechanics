import type { CurveDomain } from '../contracts';
import type { Vec2 } from '../types';

/**
 * Fixed graph domain the parser samples over — slightly larger than the visible
 * half-range so curves stay defined past the canvas edges at any aspect ratio. Keeps
 * parsing independent of canvas size.
 */
export const CURVE_DOMAIN: CurveDomain = { xMin: -13, xMax: 13, yMin: -13, yMax: 13 };

/**
 * Maps between graph space (math coords, +y up, origin centred) and pixel space
 * (canvas coords, +y down, origin top-left). Every module that needs to place or
 * draw something derives its pixel positions from a single `ViewTransform`, so the
 * math layer, the physics bodies and the renderer never disagree.
 */
export interface ViewTransform {
  /** Canvas width in pixels. */
  width: number;
  /** Canvas height in pixels. */
  height: number;
  /** Pixels per graph unit (uniform on both axes). */
  scale: number;
  /** Pixel x of graph x = 0. */
  originX: number;
  /** Pixel y of graph y = 0. */
  originY: number;
}

/**
 * Build a transform that fits the graph domain `[-halfRange, halfRange]` on the
 * smaller canvas axis, leaving a little padding so curves near the edge stay visible.
 */
export function createViewTransform(
  width: number,
  height: number,
  halfRange = 10,
  padding = 0.92,
): ViewTransform {
  const safeW = Math.max(width, 1);
  const safeH = Math.max(height, 1);
  const scale = (Math.min(safeW, safeH) / (halfRange * 2)) * padding;
  return {
    width: safeW,
    height: safeH,
    scale,
    originX: safeW / 2,
    originY: safeH / 2,
  };
}

/** Graph point -> pixel point. */
export function graphToPixel(p: Vec2, t: ViewTransform): Vec2 {
  return {
    x: t.originX + p.x * t.scale,
    y: t.originY - p.y * t.scale,
  };
}

/** Pixel point -> graph point. */
export function pixelToGraph(p: Vec2, t: ViewTransform): Vec2 {
  return {
    x: (p.x - t.originX) / t.scale,
    y: (t.originY - p.y) / t.scale,
  };
}

/** Convert a length in graph units to pixels. */
export function graphLengthToPixels(len: number, t: ViewTransform): number {
  return len * t.scale;
}

/**
 * The graph x-domain currently visible across the canvas width, used to bound
 * curve sampling so we only evaluate over what the player can actually see.
 */
export function visibleXRange(t: ViewTransform): [number, number] {
  const halfW = t.originX / t.scale;
  return [-halfW, halfW];
}
