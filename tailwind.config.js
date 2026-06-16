/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        synth: {
          bg: '#0a0612',
          panel: '#120a1f',
          panel2: '#190f2b',
          grid: '#2a1a45',
          pink: '#ff2e88',
          magenta: '#ff5ca2',
          cyan: '#2dd4ff',
          teal: '#22d3ee',
          purple: '#a855f7',
          violet: '#7c3aed',
          amber: '#ffb347',
          green: '#39ff14',
          text: '#e6d9ff',
          muted: '#8a7aa8',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        display: ['Orbitron', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-pink': '0 0 8px rgba(255, 46, 136, 0.6), 0 0 20px rgba(255, 46, 136, 0.35)',
        'glow-cyan': '0 0 8px rgba(45, 212, 255, 0.6), 0 0 20px rgba(45, 212, 255, 0.35)',
        'glow-purple': '0 0 8px rgba(168, 85, 247, 0.6), 0 0 22px rgba(168, 85, 247, 0.35)',
        'glow-green': '0 0 8px rgba(57, 255, 20, 0.55), 0 0 20px rgba(57, 255, 20, 0.3)',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        'scan': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'rise': {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 1.8s ease-in-out infinite',
        scan: 'scan 6s linear infinite',
        rise: 'rise 0.35s ease-out both',
      },
    },
  },
  plugins: [],
};
