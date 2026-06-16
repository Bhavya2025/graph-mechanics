import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bodies, Body, Composite, Engine, type Body as MatterBody } from 'matter-js';
import type { CurveResult, IntegralZoneSpec, WinStats } from '../contracts';
import type { EnemyConfig, LossReason, Obstacle, Vec2 } from '../types';
import { graphLengthToPixels, graphToPixel, type ViewTransform } from '../math/coordinates';

/**
 * Physics engine integration (a wrapper around Matter.js).
 *
 *  - The player's curve and the level's obstacles are the only REAL physics bodies
 *    (the ball collides and rolls on them). Target / enemy / integral zone are tracked
 *    geometry resolved with deterministic checks each step.
 *  - Rendering is a custom 2D-canvas loop (synthwave styling).
 *  - Public geometry crosses the boundary in GRAPH space (`CurveResult`, graph x for
 *    the ramp, graph x-bounds for the zone); this controller owns graph→pixel.
 */

/** Horizontal launch speed (graph-units/sec) used when a level omits `launchSpeed`. */
export const DEFAULT_LAUNCH_SPEED = 4;

const FIXED_DELTA_MS = 1000 / 60;
/** Frames over which launch speed is sustained so the first contact can't rob the ball. */
const LAUNCH_BOOST_FRAMES = 10;
const BALL_RADIUS_GRAPH = 0.45;
const CURVE_THICKNESS_PX = 7;
const OUT_OF_BOUNDS_MARGIN = 160;
const RAMP_LENGTH_GRAPH = 2.6;
const RAMP_THICKNESS_PX = 10;

interface ZoneGeometry {
  cx: number;
  cy: number;
  width: number;
  height: number;
  effect: 'buoyancy' | 'mud';
}

export interface LevelSetup {
  start: Vec2;
  target: Vec2;
  targetRadius: number;
  obstacles: Obstacle[];
  enemy?: EnemyConfig;
}

export interface PhysicsCallbacks {
  onWin: (stats: WinStats) => void;
  onLose: (reason: LossReason) => void;
}

interface TrackedEnemy {
  pos: Vec2;
  radiusPx: number;
  speed: number; // pixels per step
  active: boolean;
}

/* ------------------------------------------------------------------ *
 * Imperative controller
 * ------------------------------------------------------------------ */

class PhysicsController {
  private engine: Engine;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rafId = 0;
  private dpr = 1;
  private cssWidth = 0;
  private cssHeight = 0;

  private transform: ViewTransform | null = null;
  private running = false;
  private finished = false;

  private ball: MatterBody | null = null;
  // Very low base air drag — at 60fps even 0.006 compounds to ~75% speed loss over a
  // multi-second traverse, stalling the ball short. (Zones raise it for mud/water.)
  private ballBaseFrictionAir = 0.0008;
  private curveBodies: MatterBody[] = [];
  private obstacleBodies: MatterBody[] = [];
  private rampBody: MatterBody | null = null;

  /** Pixel-space polylines, one per curve branch (for rendering + ramp tangents). */
  private curveSegmentsPx: Vec2[][] = [];
  /** Latest curve (graph space) — re-applied on resize/level reconfigure. */
  private lastCurve: CurveResult | null = null;
  private rampGraphX: number | null = null;
  private zoneSpec: IntegralZoneSpec | null = null;
  private zone: ZoneGeometry | null = null;

  private startPx: Vec2 = { x: 0, y: 0 };
  private targetPx: Vec2 = { x: 0, y: 0 };
  private targetRadiusPx = 30;
  private ballRadiusPx = 12;
  private ballInZone = false;
  private launchSpeedPerStep = 0;
  private launchDir = 1;
  private launchBoostFrames = 0;
  private stallFrames = 0;
  private runFrames = 0;

  private enemyConfig?: EnemyConfig;
  private enemy: TrackedEnemy | null = null;

  private trailPx: Vec2[] = [];
  private frame = 0;

  constructor(canvas: HTMLCanvasElement, private getCallbacks: () => PhysicsCallbacks) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable.');
    this.ctx = ctx;
    this.engine = Engine.create();
    this.engine.gravity.x = 0;
    this.engine.gravity.y = 1;
    this.engine.gravity.scale = 0.0011;
    this.startLoop();
  }

  /* ---- sizing ---- */

  resize(cssWidth: number, cssHeight: number, dpr: number) {
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    this.canvas.height = Math.max(1, Math.round(cssHeight * dpr));
  }

  /* ---- level / static world ---- */

  configure(setup: LevelSetup, transform: ViewTransform) {
    this.transform = transform;
    // Gravity proportional to pixel scale → identical feel at any canvas size. Tuned
    // firm enough to keep the ball hugging convex arcs (less fly-off) and to give
    // descents real punch.
    this.engine.gravity.scale = 0.0013 * (transform.scale / 36);
    this.clearBall();
    this.clearCurve();
    this.clearRamp();
    this.clearObstacles();
    this.zone = null;
    this.ballInZone = false;
    this.running = false;
    this.finished = false;
    this.trailPx = [];

    this.startPx = graphToPixel(setup.start, transform);
    this.targetPx = graphToPixel(setup.target, transform);
    this.targetRadiusPx = graphLengthToPixels(setup.targetRadius, transform);
    this.ballRadiusPx = Math.max(6, graphLengthToPixels(BALL_RADIUS_GRAPH, transform));

    for (const o of setup.obstacles) {
      const center = graphToPixel({ x: o.x, y: o.y }, transform);
      let body: MatterBody;
      if (o.shape === 'circle') {
        body = Bodies.circle(center.x, center.y, graphLengthToPixels(o.radius ?? 1, transform), {
          isStatic: true,
          label: 'obstacle',
          friction: 0.4,
        });
      } else {
        body = Bodies.rectangle(
          center.x,
          center.y,
          graphLengthToPixels(o.width ?? 1, transform),
          graphLengthToPixels(o.height ?? 1, transform),
          { isStatic: true, label: 'obstacle', friction: 0.4 },
        );
      }
      (body as MatterBody & { renderColor?: string }).renderColor = o.color ?? '#ff2e88';
      this.obstacleBodies.push(body);
      Composite.add(this.engine.world, body);
    }

    this.enemyConfig = setup.enemy;
    this.enemy = setup.enemy
      ? {
          pos: graphToPixel(setup.enemy.start, transform),
          radiusPx: graphLengthToPixels(setup.enemy.radius, transform),
          speed: setup.enemy.speed * transform.scale * (FIXED_DELTA_MS / 1000),
          active: false,
        }
      : null;

    // Re-apply the latest curve (and its ramp/zone) against the new transform.
    if (this.lastCurve) this.setCurve(this.lastCurve);
  }

  /* ---- curve (CurveResult in graph space → chained pixel bodies) ---- */

  setCurve(result: CurveResult) {
    this.lastCurve = result;
    this.clearCurve();
    if (!this.transform || result.error) return;
    const t = this.transform;

    for (const branch of result.branches) {
      if (branch.points.length < 2) continue;
      const px = branch.points.map((p) => graphToPixel(p, t));
      this.curveSegmentsPx.push(px);

      const pairCount = branch.closed ? px.length : px.length - 1;
      for (let i = 0; i < pairCount; i++) {
        const a = px[i];
        const b = px[(i + 1) % px.length];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        if (len < 0.5) continue;
        const body = Bodies.rectangle(
          (a.x + b.x) / 2,
          (a.y + b.y) / 2,
          len + CURVE_THICKNESS_PX, // overlap neighbours to avoid snagging at joints
          CURVE_THICKNESS_PX,
          { isStatic: true, angle: Math.atan2(dy, dx), label: 'curve', friction: 0.005, restitution: 0 },
        );
        this.curveBodies.push(body);
      }
    }
    if (this.curveBodies.length) Composite.add(this.engine.world, this.curveBodies);

    // Re-derive ramp / zone geometry against the new curve.
    this.rebuildRamp();
    this.rebuildZone();
  }

  /* ---- Derivative Ramp: flat plank tangent to the curve at graph x ---- */

  setRamp(graphX: number | null) {
    this.rampGraphX = graphX;
    this.rebuildRamp();
  }

  private rebuildRamp() {
    this.clearRamp();
    if (this.rampGraphX == null || !this.transform) return;
    const targetPxX = graphToPixel({ x: this.rampGraphX, y: 0 }, this.transform).x;

    // Nearest curve point to the target x, with its neighbours for the tangent.
    let best: { seg: Vec2[]; i: number; d: number } | null = null;
    for (const seg of this.curveSegmentsPx) {
      for (let i = 0; i < seg.length; i++) {
        const d = Math.abs(seg[i].x - targetPxX);
        if (!best || d < best.d) best = { seg, i, d };
      }
    }
    if (!best) return;
    const { seg, i } = best;
    const a = seg[Math.max(0, i - 1)];
    const b = seg[Math.min(seg.length - 1, i + 1)];
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const center = seg[i];

    this.rampBody = Bodies.rectangle(
      center.x,
      center.y,
      graphLengthToPixels(RAMP_LENGTH_GRAPH, this.transform),
      RAMP_THICKNESS_PX,
      { isStatic: true, angle, label: 'ramp', friction: 0.02, restitution: 0.3 },
    );
    Composite.add(this.engine.world, this.rampBody);
  }

  /* ---- Integral Zone: sensor region beneath the curve over [xMin,xMax] ---- */

  setIntegralZone(spec: IntegralZoneSpec | null) {
    this.zoneSpec = spec;
    this.rebuildZone();
  }

  private rebuildZone() {
    this.zone = null;
    if (!this.zoneSpec || !this.transform) return;
    const t = this.transform;
    const left = graphToPixel({ x: this.zoneSpec.xMin, y: 0 }, t).x;
    const right = graphToPixel({ x: this.zoneSpec.xMax, y: 0 }, t).x;
    const lo = Math.min(left, right);
    const hi = Math.max(left, right);

    // Top = highest (smallest pixel-y) curve point within the x band; fall back to mid.
    let topPx = this.cssHeight / 2;
    let found = false;
    for (const seg of this.curveSegmentsPx) {
      for (const p of seg) {
        if (p.x >= lo && p.x <= hi) {
          topPx = found ? Math.min(topPx, p.y) : p.y;
          found = true;
        }
      }
    }
    const bottomPx = this.cssHeight;
    this.zone = {
      cx: (lo + hi) / 2,
      cy: (topPx + bottomPx) / 2,
      width: Math.max(8, hi - lo),
      height: Math.max(8, bottomPx - topPx),
      effect: this.zoneSpec.effect,
    };
  }

  /* ---- run control ---- */

  launch(launchSpeed: number) {
    if (!this.transform) return;
    this.clearBall();
    this.finished = false;
    this.ballInZone = false;
    this.trailPx = [];
    this.stallFrames = 0;
    this.runFrames = 0;

    // Find the curve point nearest the start x, plus its local tangent. Rest the ball
    // ON it (minimal clearance) and launch ALONG the tangent toward the target — never
    // purely horizontal, which on a downhill start would fling the ball into a
    // projectile arc that loses its energy on landing.
    let surfaceY = this.startPx.y;
    let bestDx = Infinity;
    let bestSeg: Vec2[] | null = null;
    let bestI = 0;
    for (const seg of this.curveSegmentsPx) {
      for (let i = 0; i < seg.length; i++) {
        const dx = Math.abs(seg[i].x - this.startPx.x);
        if (dx < bestDx) {
          bestDx = dx;
          surfaceY = seg[i].y;
          bestSeg = seg;
          bestI = i;
        }
      }
    }
    const dir = Math.sign(this.targetPx.x - this.startPx.x) || 1;
    let tangent = { x: dir, y: 0 };
    if (bestSeg && bestDx <= this.ballRadiusPx * 2) {
      const a = bestSeg[Math.max(0, bestI - 1)];
      const b = bestSeg[Math.min(bestSeg.length - 1, bestI + 1)];
      const tx = b.x - a.x;
      const ty = b.y - a.y;
      const tlen = Math.hypot(tx, ty) || 1;
      tangent = { x: tx / tlen, y: ty / tlen };
      if (Math.sign(tangent.x) !== dir) {
        tangent = { x: -tangent.x, y: -tangent.y };
      }
    } else {
      surfaceY = this.startPx.y;
    }
    const spawnY = surfaceY - this.ballRadiusPx - 2;

    const ball = Bodies.circle(this.startPx.x, spawnY, this.ballRadiusPx, {
      label: 'ball',
      restitution: 0.1,
      friction: 0.02,
      frictionAir: this.ballBaseFrictionAir,
      density: 0.0012,
    });
    const speedPerStep = launchSpeed * this.transform.scale * (FIXED_DELTA_MS / 1000);
    Body.setVelocity(ball, { x: tangent.x * speedPerStep, y: tangent.y * speedPerStep });
    this.launchSpeedPerStep = speedPerStep;
    this.launchDir = dir;
    this.launchBoostFrames = LAUNCH_BOOST_FRAMES;
    this.ball = ball;
    Composite.add(this.engine.world, ball);

    if (this.enemy) this.enemy.active = true;
    this.running = true;
  }

  reset() {
    this.clearBall();
    this.running = false;
    this.finished = false;
    this.ballInZone = false;
    this.trailPx = [];
    if (this.enemy && this.enemyConfig && this.transform) {
      this.enemy.pos = graphToPixel(this.enemyConfig.start, this.transform);
      this.enemy.active = false;
    }
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
    Composite.clear(this.engine.world, false);
    Engine.clear(this.engine);
  }

  /* ---- cleanup helpers ---- */

  private clearBall() {
    if (this.ball) {
      Composite.remove(this.engine.world, this.ball);
      this.ball = null;
    }
  }
  private clearCurve() {
    if (this.curveBodies.length) {
      Composite.remove(this.engine.world, this.curveBodies);
      this.curveBodies = [];
    }
    this.curveSegmentsPx = [];
  }
  private clearObstacles() {
    if (this.obstacleBodies.length) {
      Composite.remove(this.engine.world, this.obstacleBodies);
      this.obstacleBodies = [];
    }
  }
  private clearRamp() {
    if (this.rampBody) {
      Composite.remove(this.engine.world, this.rampBody);
      this.rampBody = null;
    }
  }

  /* ---- simulation + game logic ---- */

  private startLoop() {
    const loop = () => {
      this.rafId = requestAnimationFrame(loop);
      this.frame++;
      if (this.running && this.ball) {
        Engine.update(this.engine, FIXED_DELTA_MS);
        this.runFrames++;
        this.stepGameLogic();
      }
      this.render();
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private finish(win: boolean, reason: LossReason = null) {
    if (this.finished) return;
    this.finished = true;
    this.running = false;
    const cb = this.getCallbacks();
    if (win) cb.onWin({ timeMs: this.runFrames * FIXED_DELTA_MS });
    else cb.onLose(reason);
  }

  private stepGameLogic() {
    const ball = this.ball;
    if (!ball) return;

    // Sustain launch SPEED along the ball's direction of travel for the first frames.
    // Because the launch is tangent to the curve, the velocity tracks the surface, so
    // scaling its magnitude keeps the ball rolling fast without lofting it off-slope.
    if (this.launchBoostFrames > 0) {
      const v = ball.velocity;
      const sp = Math.hypot(v.x, v.y);
      if (sp > 0.01 && sp < this.launchSpeedPerStep && Math.sign(v.x) === this.launchDir) {
        const k = this.launchSpeedPerStep / sp;
        Body.setVelocity(ball, { x: v.x * k, y: v.y * k });
      }
      this.launchBoostFrames--;
    }

    this.trailPx.push({ x: ball.position.x, y: ball.position.y });
    if (this.trailPx.length > 22) this.trailPx.shift();

    // Integral zone effect.
    if (this.zone) {
      const inside =
        Math.abs(ball.position.x - this.zone.cx) <= this.zone.width / 2 &&
        Math.abs(ball.position.y - this.zone.cy) <= this.zone.height / 2;
      if (inside) {
        if (this.zone.effect === 'buoyancy') {
          Body.applyForce(ball, ball.position, {
            x: 0,
            y: -ball.mass * this.engine.gravity.scale * 1.45,
          });
          ball.frictionAir = 0.06;
        } else {
          ball.frictionAir = 0.22;
        }
        this.ballInZone = true;
      } else if (this.ballInZone) {
        ball.frictionAir = this.ballBaseFrictionAir;
        this.ballInZone = false;
      }
    }

    // Enemy chase + contact = loss.
    if (this.enemy && this.enemy.active) {
      const ex = ball.position.x - this.enemy.pos.x;
      const ey = ball.position.y - this.enemy.pos.y;
      const d = Math.hypot(ex, ey) || 1;
      this.enemy.pos = {
        x: this.enemy.pos.x + (ex / d) * this.enemy.speed,
        y: this.enemy.pos.y + (ey / d) * this.enemy.speed,
      };
      if (d <= this.enemy.radiusPx + this.ballRadiusPx) {
        this.finish(false, 'enemy');
        return;
      }
    }

    // Win: ball reaches the target zone.
    const tdx = ball.position.x - this.targetPx.x;
    const tdy = ball.position.y - this.targetPx.y;
    if (Math.hypot(tdx, tdy) <= this.targetRadiusPx + this.ballRadiusPx * 0.5) {
      this.finish(true);
      return;
    }

    // Loss: ball leaves the playfield.
    if (
      ball.position.y > this.cssHeight + OUT_OF_BOUNDS_MARGIN ||
      ball.position.x < -OUT_OF_BOUNDS_MARGIN ||
      ball.position.x > this.cssWidth + OUT_OF_BOUNDS_MARGIN
    ) {
      this.finish(false, 'fell');
      return;
    }

    // Loss: ball comes to rest short of the target (no infinite hang).
    if (this.launchBoostFrames <= 0 && ball.speed < 0.18) {
      this.stallFrames++;
      if (this.stallFrames > 170) this.finish(false, 'stalled');
    } else {
      this.stallFrames = 0;
    }
  }

  /* ---- rendering ---- */

  private render() {
    const ctx = this.ctx;
    const t = this.transform;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    if (!t) return;

    this.drawBackground();
    this.drawGrid(t);
    this.drawZone();
    this.drawObstacles();
    this.drawCurve();
    this.drawRamp();
    this.drawTarget();
    if (!this.ball) this.drawStartMarker();
    this.drawEnemy();
    this.drawTrail();
    this.drawBall();
  }

  private drawBackground() {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, this.cssHeight);
    g.addColorStop(0, 'rgba(18,10,31,0.65)');
    g.addColorStop(1, 'rgba(10,6,18,0.85)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
  }

  private drawGrid(t: ViewTransform) {
    const ctx = this.ctx;
    const halfX = Math.ceil(t.originX / t.scale) + 1;
    const halfY = Math.ceil(t.originY / t.scale) + 1;

    ctx.lineWidth = 1;
    for (let gx = -halfX; gx <= halfX; gx++) {
      const p = graphToPixel({ x: gx, y: 0 }, t);
      ctx.strokeStyle = gx % 5 === 0 ? 'rgba(45,212,255,0.16)' : 'rgba(124,58,237,0.10)';
      ctx.beginPath();
      ctx.moveTo(p.x, 0);
      ctx.lineTo(p.x, this.cssHeight);
      ctx.stroke();
    }
    for (let gy = -halfY; gy <= halfY; gy++) {
      const p = graphToPixel({ x: 0, y: gy }, t);
      ctx.strokeStyle = gy % 5 === 0 ? 'rgba(45,212,255,0.16)' : 'rgba(124,58,237,0.10)';
      ctx.beginPath();
      ctx.moveTo(0, p.y);
      ctx.lineTo(this.cssWidth, p.y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(168,85,247,0.55)';
    ctx.lineWidth = 1.5;
    const origin = graphToPixel({ x: 0, y: 0 }, t);
    ctx.beginPath();
    ctx.moveTo(0, origin.y);
    ctx.lineTo(this.cssWidth, origin.y);
    ctx.moveTo(origin.x, 0);
    ctx.lineTo(origin.x, this.cssHeight);
    ctx.stroke();
  }

  private drawZone() {
    if (!this.zone) return;
    const ctx = this.ctx;
    const z = this.zone;
    const color = z.effect === 'buoyancy' ? '45,212,255' : '255,179,71';
    ctx.fillStyle = `rgba(${color},0.14)`;
    ctx.strokeStyle = `rgba(${color},0.5)`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.rect(z.cx - z.width / 2, z.cy - z.height / 2, z.width, z.height);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawPolygon(body: MatterBody, fill: string, stroke: string) {
    const ctx = this.ctx;
    const v = body.vertices;
    ctx.beginPath();
    ctx.moveTo(v[0].x, v[0].y);
    for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawObstacles() {
    const ctx = this.ctx;
    for (const body of this.obstacleBodies) {
      const color = (body as MatterBody & { renderColor?: string }).renderColor ?? '#ff2e88';
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      if (body.circleRadius) {
        ctx.beginPath();
        ctx.arc(body.position.x, body.position.y, body.circleRadius, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(color, 0.22);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        this.drawPolygon(body, hexToRgba(color, 0.22), color);
      }
      ctx.restore();
    }
  }

  private drawCurve() {
    if (!this.curveSegmentsPx.length) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = '#2dd4ff';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#2dd4ff';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const seg of this.curveSegmentsPx) {
      if (seg.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(seg[0].x, seg[0].y);
      for (let i = 1; i < seg.length; i++) ctx.lineTo(seg[i].x, seg[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawRamp() {
    if (!this.rampBody) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = '#ffb347';
    ctx.shadowBlur = 14;
    this.drawPolygon(this.rampBody, hexToRgba('#ffb347', 0.35), '#ffb347');
    ctx.restore();
  }

  private drawTarget() {
    const ctx = this.ctx;
    const { x, y } = this.targetPx;
    const r = this.targetRadiusPx;
    const pulse = 0.5 + 0.5 * Math.sin(this.frame * 0.08);
    ctx.save();
    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = `rgba(57,255,20,${0.5 + pulse * 0.5})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * (0.45 + pulse * 0.25), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(57,255,20,0.18)';
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(57,255,20,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x + r, y);
    ctx.moveTo(x, y - r);
    ctx.lineTo(x, y + r);
    ctx.stroke();
  }

  private drawStartMarker() {
    const ctx = this.ctx;
    const { x, y } = this.startPx;
    const r = this.ballRadiusPx;
    ctx.save();
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = 'rgba(168,85,247,0.8)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r + 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  private drawEnemy() {
    if (!this.enemy) return;
    const ctx = this.ctx;
    const { x, y } = this.enemy.pos;
    const r = this.enemy.radiusPx;
    const pulse = 0.5 + 0.5 * Math.sin(this.frame * 0.18);
    ctx.save();
    ctx.shadowColor = '#ff2e2e';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,46,46,${0.55 + pulse * 0.25})`;
    ctx.fill();
    ctx.strokeStyle = '#ff8080';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,46,46,${0.25 + pulse * 0.25})`;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawTrail() {
    if (this.trailPx.length < 2) return;
    const ctx = this.ctx;
    ctx.save();
    for (let i = 1; i < this.trailPx.length; i++) {
      const alpha = (i / this.trailPx.length) * 0.5;
      ctx.strokeStyle = `rgba(255,92,162,${alpha})`;
      ctx.lineWidth = this.ballRadiusPx * (i / this.trailPx.length);
      ctx.beginPath();
      ctx.moveTo(this.trailPx[i - 1].x, this.trailPx[i - 1].y);
      ctx.lineTo(this.trailPx[i].x, this.trailPx[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBall() {
    if (!this.ball) return;
    const ctx = this.ctx;
    const { x, y } = this.ball.position;
    const r = this.ballRadiusPx;
    ctx.save();
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = 20;
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    grad.addColorStop(0, '#ffd6ea');
    grad.addColorStop(0.5, '#ff5ca2');
    grad.addColorStop(1, '#ff2e88');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(this.ball.angle) * r, y + Math.sin(this.ball.angle) * r);
    ctx.stroke();
    ctx.restore();
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ------------------------------------------------------------------ *
 * React hook
 * ------------------------------------------------------------------ */

export interface UsePhysicsResult {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  ready: boolean;
  resize: (cssWidth: number, cssHeight: number, dpr: number) => void;
  configure: (setup: LevelSetup, transform: ViewTransform) => void;
  setCurve: (result: CurveResult) => void;
  setRamp: (graphX: number | null) => void;
  setIntegralZone: (spec: IntegralZoneSpec | null) => void;
  launch: (launchSpeed: number) => void;
  reset: () => void;
}

export function usePhysics(callbacks: PhysicsCallbacks): UsePhysicsResult {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<PhysicsController | null>(null);
  const callbacksRef = useRef(callbacks);
  const [ready, setReady] = useState(false);
  callbacksRef.current = callbacks;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const controller = new PhysicsController(canvas, () => callbacksRef.current);
    controllerRef.current = controller;
    setReady(true);
    return () => {
      controller.destroy();
      controllerRef.current = null;
      setReady(false);
    };
  }, []);

  const resize = useCallback((w: number, h: number, dpr: number) => {
    controllerRef.current?.resize(w, h, dpr);
  }, []);
  const configure = useCallback((setup: LevelSetup, transform: ViewTransform) => {
    controllerRef.current?.configure(setup, transform);
  }, []);
  const setCurve = useCallback((result: CurveResult) => {
    controllerRef.current?.setCurve(result);
  }, []);
  const setRamp = useCallback((graphX: number | null) => {
    controllerRef.current?.setRamp(graphX);
  }, []);
  const setIntegralZone = useCallback((spec: IntegralZoneSpec | null) => {
    controllerRef.current?.setIntegralZone(spec);
  }, []);
  const launch = useCallback((launchSpeed: number) => {
    controllerRef.current?.launch(launchSpeed);
  }, []);
  const reset = useCallback(() => {
    controllerRef.current?.reset();
  }, []);

  return useMemo(
    () => ({ canvasRef, ready, resize, configure, setCurve, setRamp, setIntegralZone, launch, reset }),
    [ready, resize, configure, setCurve, setRamp, setIntegralZone, launch, reset],
  );
}
