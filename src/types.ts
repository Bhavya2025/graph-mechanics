/**
 * Shared domain types for Graph Mechanics.
 *
 * Coordinate spaces:
 *  - "graph"  : mathematical coordinates the player reasons about. Origin at the
 *               center, +x right, +y UP. Levels, start/target points and obstacles
 *               are all authored in graph space.
 *  - "pixel"  : canvas coordinates used by Matter.js and the renderer. Origin at the
 *               top-left, +x right, +y DOWN.
 *
 * The single source of truth for converting between them lives in
 * `src/math/coordinates.ts` (the `ViewTransform`).
 */

export interface Vec2 {
  x: number;
  y: number;
}

export type ObstacleShape = 'rect' | 'circle';

export interface Obstacle {
  id: string;
  shape: ObstacleShape;
  /** Center, in graph coordinates. */
  x: number;
  y: number;
  /** Rectangle dimensions, in graph units. */
  width?: number;
  height?: number;
  /** Circle radius, in graph units. */
  radius?: number;
  /** Optional override colour (neon hex). Defaults to a hazard red. */
  color?: string;
}

export interface EnemyConfig {
  /** Spawn position in graph coordinates. */
  start: Vec2;
  /** Chase speed in pixels per physics tick. */
  speed: number;
  /** Radius in graph units. */
  radius: number;
}

/**
 * One slider exposed to the player. `key` is the variable name substituted into the
 * level's template expression; `label` is the friendly, math-free name shown in the UI.
 */
export interface SliderDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

/**
 * A parametric curve template. The player shapes the terrain by dragging sliders for the
 * template's variables (e.g. `A * (x - H)^2 + K` with sliders A/H/K) — no typing of raw
 * equations. The physics terrain morphs in real time as the sliders change.
 */
export interface LevelTemplate {
  expr: string;
  sliders: SliderDef[];
}

export interface Level {
  id: number;
  name: string;
  description: string;
  /** A short solution nudge surfaced in the UI. */
  hint?: string;
  /** Ball spawn point, graph coordinates. */
  start: Vec2;
  /** Goal point, graph coordinates. */
  target: Vec2;
  /** Goal capture radius, graph units. Defaults to 0.9. */
  targetRadius?: number;
  obstacles: Obstacle[];
  enemy?: EnemyConfig;
  /** The parametric curve the player shapes with sliders. */
  template: LevelTemplate;
  /**
   * Horizontal launch speed in graph-units/second, applied toward the target's x
   * direction the moment the ball drops. Gives the ball the surplus energy needed to
   * climb back to equal-height targets and clear obstacles. Defaults to
   * `DEFAULT_LAUNCH_SPEED` in the physics layer.
   */
  launchSpeed?: number;
  /** Seconds before the enemy catches up / the attempt times out (level 3). */
  timeLimit?: number;
}

/** Lifecycle of a single attempt. */
export type GamePhase = 'editing' | 'running' | 'won' | 'lost';

export type LossReason = 'enemy' | 'fell' | 'timeout' | 'stalled' | null;

/** Optional "Derivative Ramp" modifier authored by the player. */
export interface RampConfig {
  enabled: boolean;
  /** Graph x at which a tangent ramp is placed against the curve. */
  x: number;
}

export type IntegralEffect = 'buoyancy' | 'mud';

/** Optional "Integral Zone" modifier authored by the player. */
export interface IntegralZoneConfig {
  enabled: boolean;
  /** Graph x bounds of the region beneath the curve. */
  xMin: number;
  xMax: number;
  effect: IntegralEffect;
}
