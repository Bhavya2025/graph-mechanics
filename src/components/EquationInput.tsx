import { useEffect, useRef, useState } from 'react';
import { MathfieldElement } from 'mathlive';
import { AlertTriangle, FunctionSquare } from 'lucide-react';
import type { EquationInputProps } from '../contracts';
import { CURVE_DOMAIN } from '../math/coordinates';
import { generateImplicitCurve } from '../math/implicitParser';

/**
 * Visual equation input (MathLive). Renders a `<math-field>` and, on edit, parses the
 * LaTeX into a graph-space `CurveResult` (implicit-first marching squares) and emits
 * `{ latex, result }`. Conforms to `EquationInputProps` — no layout/physics here.
 */

// One-time global config: serve fonts from /public (Vite mangles the bundled path) and
// silence the audio feedback.
MathfieldElement.fontsDirectory = '/mathlive/fonts';
MathfieldElement.soundsDirectory = null;

const PARSE_DEBOUNCE_MS = 130;

export function EquationInput({ value, disabled, onChange }: EquationInputProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mfRef = useRef<MathfieldElement | null>(null);
  const onChangeRef = useRef(onChange);
  const debounceRef = useRef<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  onChangeRef.current = onChange;

  // Mount the math field once.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const mf = new MathfieldElement();
    mf.mathVirtualKeyboardPolicy = 'manual';
    mf.style.width = '100%';
    mf.style.fontSize = '1.4rem';
    mf.style.color = '#e6d9ff';
    mf.style.setProperty('--caret-color', '#ff2e88');
    mf.style.setProperty('--selection-background-color', 'rgba(45,212,255,0.25)');
    mf.style.setProperty('--contains-highlight-background-color', 'transparent');
    mf.value = value;
    host.appendChild(mf);
    mfRef.current = mf;

    const parse = (latex: string) => {
      const result = generateImplicitCurve(latex, CURVE_DOMAIN);
      setError(result.error);
      onChangeRef.current({ latex, result });
    };

    const handleInput = () => {
      const latex = mf.value;
      window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => parse(latex), PARSE_DEBOUNCE_MS);
    };

    mf.addEventListener('input', handleInput);
    // No initial parse: the store owns parsing the suggested equation on load, so the
    // field only emits on genuine user edits (avoids a mount/level-switch race).

    return () => {
      mf.removeEventListener('input', handleInput);
      window.clearTimeout(debounceRef.current);
      mf.remove();
      mfRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflect external value changes (e.g. loading a level). The store has already parsed
  // the new equation, so we only update the field display — no onChange emitted here.
  useEffect(() => {
    const mf = mfRef.current;
    if (!mf || mf.value === value) return;
    window.clearTimeout(debounceRef.current); // drop any stale pending parse
    mf.value = value;
    setError(null);
  }, [value]);

  useEffect(() => {
    const mf = mfRef.current;
    if (mf) mf.readOnly = !!disabled;
  }, [disabled]);

  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-synth-muted">
        <FunctionSquare size={14} className="text-synth-cyan" />
        Equation
      </label>
      <div
        className={`rounded-lg border bg-black/40 px-3 py-2 transition-shadow ${
          error
            ? 'border-synth-pink/70 shadow-glow-pink'
            : 'border-synth-cyan/40 focus-within:border-synth-cyan focus-within:shadow-glow-cyan'
        } ${disabled ? 'opacity-50' : ''}`}
      >
        <div ref={hostRef} />
      </div>
      <div className="mt-1.5 min-h-[18px] text-xs">
        {error ? (
          <span className="flex items-center gap-1.5 text-synth-pink">
            <AlertTriangle size={12} />
            {error}
          </span>
        ) : (
          <span className="text-synth-muted/70">
            Try <code className="text-synth-cyan">y = x^2 - 3</code> or{' '}
            <code className="text-synth-cyan">x^2 + y^2 = 16</code>
          </span>
        )}
      </div>
    </div>
  );
}
