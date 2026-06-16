import { useLayoutEffect, useRef, type ReactNode } from 'react';
import gsap from 'gsap';

/** Wraps a screen and plays a GSAP fade/rise entrance on mount. */
export function PageTransition({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (ref.current) {
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' },
      );
    }
  }, []);
  return (
    <div ref={ref} className="h-full w-full">
      {children}
    </div>
  );
}
