import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Design tokens — LOCKED, see brief §9.1
        tub: 'var(--tub)',
        tub2: 'var(--tub2)',
        tub3: 'var(--tub3)',
        yogoch: 'var(--yogoch)',
        'yogoch-och': 'var(--yogoch-och)',
        suv: 'var(--suv)',
        epa: 'var(--epa)',
        qor: 'var(--qor)',
        xira: 'var(--xira)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        body: 'var(--font-body)',
        mono: 'var(--font-mono)',
      },
      keyframes: {
        'dot-pulse': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.45', transform: 'scale(0.72)' },
        },
      },
      animation: {
        'dot-pulse': 'dot-pulse 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
