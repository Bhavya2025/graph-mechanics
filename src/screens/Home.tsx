import { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { Play, Rocket, Target, Waves, X, Zap } from 'lucide-react';

/**
 * Landing hero — a retro-futuristic synthwave landscape (neon sun, perspective grid
 * horizon, chromatic title) with an orchestrated GSAP entrance.
 */
export function Home() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [showHelp, setShowHelp] = useState(false);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.hero-sun', { scale: 0.4, y: 80, opacity: 0, duration: 0.9, ease: 'back.out(1.4)' })
        .from('.hero-floor', { opacity: 0, duration: 0.8 }, '-=0.5')
        .from('.hero-letter', { yPercent: 120, opacity: 0, stagger: 0.04, duration: 0.6 }, '-=0.5')
        .from('.hero-tag', { opacity: 0, y: 14, duration: 0.5 }, '-=0.2')
        .from('.hero-cta', { opacity: 0, y: 18, scale: 0.9, stagger: 0.1, duration: 0.5 }, '-=0.2');
    }, rootRef);
    return () => ctx.revert();
  }, []);

  const letters = (word: string, cls: string) =>
    word.split('').map((ch, i) => (
      <span key={`${cls}-${i}`} className={`hero-letter inline-block ${cls}`}>
        {ch}
      </span>
    ));

  return (
    <div
      ref={rootRef}
      className="synth-backdrop scanlines relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
    >
      {/* Neon sun */}
      <div className="hero-sun pointer-events-none absolute top-[14%] z-0">
        <SynthSun />
      </div>

      {/* Perspective grid horizon */}
      <div className="hero-floor pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[42%] overflow-hidden">
        <div className="grid-floor h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-synth-bg via-synth-bg/40 to-transparent" />
      </div>

      {/* Title + CTAs */}
      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        <p className="hero-tag mb-3 font-mono text-xs uppercase tracking-[0.5em] text-synth-cyan/80">
          Calculus, weaponized
        </p>
        <h1 className="title-chroma font-display text-5xl font-black leading-none tracking-tight sm:text-7xl">
          <span className="block overflow-hidden">{letters('GRAPH', 'text-synth-pink')}</span>
          <span className="mt-1 block overflow-hidden">{letters('MECHANICS', 'text-synth-cyan')}</span>
        </h1>
        <p className="hero-tag mt-5 max-w-md font-mono text-sm leading-relaxed text-synth-text/70">
          Type an equation. Sculpt a curve from pure math. Launch the ball and roll it home.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/levels')}
            className="hero-cta group flex items-center gap-2.5 rounded-xl bg-synth-pink px-8 py-3.5 font-display text-sm font-bold uppercase tracking-widest text-white shadow-glow-pink transition-transform hover:scale-105"
          >
            <Play size={18} className="transition-transform group-hover:translate-x-0.5" fill="white" />
            Play
          </button>
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="hero-cta flex items-center gap-2.5 rounded-xl border border-synth-cyan/50 bg-black/30 px-7 py-3.5 font-display text-sm font-bold uppercase tracking-widest text-synth-cyan transition-colors hover:border-synth-cyan hover:bg-synth-cyan/10"
          >
            How to Play
          </button>
        </div>
      </div>

      {showHelp && <HowToPlay onClose={() => setShowHelp(false)} />}
    </div>
  );
}

function SynthSun() {
  return (
    <svg width="240" height="240" viewBox="0 0 240 240" className="drop-shadow-[0_0_60px_rgba(255,46,136,0.5)]">
      <defs>
        <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe66d" />
          <stop offset="45%" stopColor="#ff5ca2" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <clipPath id="sunclip">
          <circle cx="120" cy="120" r="90" />
        </clipPath>
      </defs>
      <circle cx="120" cy="120" r="90" fill="url(#sun)" />
      {/* horizontal cuts in the lower half */}
      <g clipPath="url(#sunclip)" fill="#0a0612">
        {[124, 138, 154, 172, 192].map((y, i) => (
          <rect key={y} x="20" y={y} width="200" height={3 + i * 1.4} />
        ))}
      </g>
    </svg>
  );
}

function HowToPlay({ onClose }: { onClose: () => void }) {
  const rules = [
    { icon: <Zap size={18} className="text-synth-cyan" />, t: 'Write the curve', d: 'Type any equation — y = f(x) or implicit like x² + y² = 16. It becomes solid ground.' },
    { icon: <Rocket size={18} className="text-synth-pink" />, t: 'Launch', d: 'The ball drops onto your curve and rolls under real physics. Shape the path to the goal.' },
    { icon: <Target size={18} className="text-synth-green" />, t: 'Reach the target', d: 'Get the ball to the glowing target. Beat walls, hunters, and the clock.' },
    { icon: <Waves size={18} className="text-synth-teal" />, t: 'Use calculus', d: 'Add a Derivative Ramp (a tangent jump-pad) or an Integral Zone (buoyancy / mud).' },
  ];
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-synth-bg/80 p-4 backdrop-blur-sm">
      <div className="panel relative w-[min(94%,30rem)] p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 text-synth-muted hover:text-synth-text"
        >
          <X size={18} />
        </button>
        <h2 className="mb-4 font-display text-lg font-bold tracking-widest neon-text-cyan">HOW TO PLAY</h2>
        <ul className="space-y-3">
          {rules.map((r) => (
            <li key={r.t} className="flex gap-3">
              <span className="mt-0.5 shrink-0">{r.icon}</span>
              <span>
                <span className="block text-sm font-semibold text-synth-text">{r.t}</span>
                <span className="block text-xs leading-relaxed text-synth-muted">{r.d}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
