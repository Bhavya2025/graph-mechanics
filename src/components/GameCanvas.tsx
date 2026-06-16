import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { GameCanvasHandle, GameCanvasProps } from '../contracts';
import { DEFAULT_LAUNCH_SPEED, usePhysics } from '../hooks/usePhysics';
import { createViewTransform, pixelToGraph } from '../math/coordinates';

/**
 * The canvas + physics surface. Owns the Matter.js controller and the responsive
 * `ViewTransform`, and exposes the `GameCanvasHandle` (setCurve / setRamp /
 * setIntegralZone / launch / reset). The Game screen drives it from store state; this
 * component holds no game state of its own beyond the active `level`.
 */
export const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(function GameCanvas(
  { level, onWin, onLose, onCurveClick },
  ref,
) {
  const physics = usePhysics({ onWin, onLose });
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  const transform = useMemo(
    () => (size.width && size.height ? createViewTransform(size.width, size.height) : null),
    [size.width, size.height],
  );

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!physics.ready || !transform) return;
    physics.resize(size.width, size.height, dpr);
  }, [physics, transform, size.width, size.height, dpr]);

  // (Re)build the static world on level or size change; the controller re-applies the
  // most recent curve/ramp/zone itself, so no curve push is needed here.
  useEffect(() => {
    if (!physics.ready || !transform) return;
    physics.configure(
      {
        start: level.start,
        target: level.target,
        targetRadius: level.targetRadius ?? 0.9,
        obstacles: level.obstacles,
        enemy: level.enemy,
      },
      transform,
    );
  }, [physics, level, transform]);

  useImperativeHandle(
    ref,
    () => ({
      setCurve: (result) => physics.setCurve(result),
      setRamp: (graphX) => physics.setRamp(graphX),
      setIntegralZone: (spec) => physics.setIntegralZone(spec),
      launch: () => physics.launch(level.launchSpeed ?? DEFAULT_LAUNCH_SPEED),
      reset: () => physics.reset(),
    }),
    [physics, level.launchSpeed],
  );

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onCurveClick || !transform || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const graph = pixelToGraph({ x: e.clientX - rect.left, y: e.clientY - rect.top }, transform);
    onCurveClick(graph.x);
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className="relative h-full w-full cursor-crosshair overflow-hidden"
    >
      <canvas
        ref={physics.canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
});
