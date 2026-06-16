import type { Level } from '../types';

/**
 * Static level dataset. All positions are authored in GRAPH coordinates
 * (+x right, +y up, origin centred). The physics layer projects them to pixels.
 *
 * Design note on solvability: a ball rolling from rest cannot climb above its own
 * start height (energy conservation). Every level therefore relies on a modest
 * `launchSpeed` plus a curve that first dips to build speed, so equal-height targets
 * and central walls are reachable. Suggested equations below are verified solutions.
 */
export const LEVELS: Level[] = [
  {
    id: 1,
    name: 'THE BASICS',
    description:
      'Drop the ball and roll it down to the target. A gentle downhill slope is all you need.',
    hint: 'A straight line works. Try a negative slope, e.g. y = -0.6 * x - 0.2',
    start: { x: -8, y: 5 },
    target: { x: 6, y: -4 },
    targetRadius: 1,
    obstacles: [],
    suggestedEquation: 'y = -0.6x - 0.2',
    launchSpeed: 2,
  },
  {
    id: 2,
    name: 'THE WALL',
    description:
      'A tall barrier rises from below and pokes above the start line at x = 0. A flat shot hits it — arch a curve up and over to carry the ball across.',
    hint: 'Its top pokes just above the start, so a flat line is blocked. Arch a curve high enough that the whole ball clears it — try y = -1.3 - 0.011 * x^2.',
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
    suggestedEquation: 'y = -1.3 - 0.011x^2',
    launchSpeed: 18,
  },
  {
    id: 3,
    name: 'THE SWARM',
    description:
      'A hunter awakens on launch and homes in on the ball. Race it: reach the target before it makes contact.',
    hint: 'Both points sit high at y = 6. Dip down to build speed and rise back up — a shallow valley like y = 0.04 * x^2 + 4 returns to the target before the hunter arrives.',
    start: { x: -7, y: 6 },
    target: { x: 7, y: 6 },
    targetRadius: 1.4,
    obstacles: [],
    enemy: {
      start: { x: 0, y: -5 },
      speed: 1.6,
      radius: 0.7,
    },
    suggestedEquation: 'y = 0.04x^2 + 4',
    launchSpeed: 24,
    timeLimit: 12,
  },
];

export function getLevel(index: number): Level {
  const clamped = Math.max(0, Math.min(index, LEVELS.length - 1));
  return LEVELS[clamped];
}

export const LEVEL_COUNT = LEVELS.length;
