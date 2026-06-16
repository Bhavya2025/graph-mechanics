import type { Level } from '../types';

/**
 * Static level dataset. All positions are authored in GRAPH coordinates
 * (+x right, +y up, origin centred). The physics layer projects them to pixels.
 *
 * Each level exposes a parametric `template` the player shapes with sliders (no raw
 * equation typing). The slider DEFAULTS below are verified solutions — a player can hit
 * Launch immediately, or tune the sliders to discover their own winning curve. Slider
 * labels are deliberately math-free (Tilt / Width / Shift / Height).
 */
export const LEVELS: Level[] = [
  {
    id: 1,
    name: 'THE BASICS',
    description:
      'Drop the ball and roll it down to the target. A gentle downhill slope is all you need.',
    hint: 'Tilt the line downhill so the ball rolls straight to the target.',
    start: { x: -8, y: 5 },
    target: { x: 6, y: -4 },
    targetRadius: 1,
    obstacles: [],
    template: {
      expr: 'A * x + B',
      sliders: [
        { key: 'A', label: 'Tilt', min: -2, max: 2, step: 0.1, default: -0.6 },
        { key: 'B', label: 'Height', min: -8, max: 8, step: 0.5, default: 0 },
      ],
    },
    launchSpeed: 2,
  },
  {
    id: 2,
    name: 'THE WALL',
    description:
      'A tall barrier rises from below and pokes above the start line at x = 0. A flat shot hits it — arch a curve up and over to carry the ball across.',
    hint: 'A flat line hits the wall. Make the curve arch UP and over — raise the Height so the whole ball clears the top.',
    start: { x: -8, y: -2 },
    target: { x: 8, y: -2 },
    targetRadius: 1.3,
    obstacles: [
      {
        id: 'wall',
        shape: 'rect',
        x: 0,
        // Spans from below the view (y ≈ -12) up to a top edge near y = -1.9, just
        // above the start/target height of -2 so a flat line is blocked. The solution
        // arch peaks at y ≈ -1.3 so the ball (radius ~0.45) fully clears this top.
        y: -6.95,
        width: 1,
        height: 10.1,
        color: '#ff2e88',
      },
    ],
    // `A * 0.001` keeps the Width slider a friendly integer while reaching the small
    // curvature the solution needs. Defaults = a verified winning arch.
    template: {
      expr: 'A * 0.001 * (x - H)^2 + K',
      sliders: [
        { key: 'A', label: 'Width', min: -30, max: 10, step: 1, default: -11 },
        { key: 'H', label: 'Shift', min: -4, max: 4, step: 0.5, default: 0 },
        { key: 'K', label: 'Height', min: -3, max: 1, step: 0.25, default: -1.3 },
      ],
    },
    launchSpeed: 18,
  },
  {
    id: 3,
    name: 'THE SWARM',
    description:
      'A hunter awakens on launch and homes in on the ball. Race it: reach the target before it makes contact.',
    hint: 'Both points sit high. Dip the curve into a valley to build speed and rise back up — and do it fast, before the hunter arrives.',
    start: { x: -7, y: 6 },
    target: { x: 7, y: 6 },
    targetRadius: 1.4,
    obstacles: [],
    enemy: {
      start: { x: 0, y: -5 },
      speed: 1.6,
      radius: 0.7,
    },
    template: {
      expr: 'A * 0.001 * (x - H)^2 + K',
      sliders: [
        { key: 'A', label: 'Width', min: 0, max: 100, step: 5, default: 40 },
        { key: 'H', label: 'Shift', min: -4, max: 4, step: 0.5, default: 0 },
        { key: 'K', label: 'Height', min: 0, max: 8, step: 0.5, default: 4 },
      ],
    },
    launchSpeed: 24,
    timeLimit: 12,
  },
];

export function getLevel(index: number): Level {
  const clamped = Math.max(0, Math.min(index, LEVELS.length - 1));
  return LEVELS[clamped];
}

export const LEVEL_COUNT = LEVELS.length;
