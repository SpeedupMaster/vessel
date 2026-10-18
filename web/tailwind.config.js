// CSS-variable colors routed through color-mix so opacity modifiers (bg-paper-3/40) work.
const v = (name) => `color-mix(in srgb, var(${name}) calc(<alpha-value> * 100%), transparent)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: v('--color-paper'),
          2: v('--color-paper-2'),
          3: v('--color-paper-3'),
          4: v('--color-paper-4'),
        },
        ink: {
          DEFAULT: v('--color-ink'),
          muted: v('--color-ink-muted'),
          faint: v('--color-ink-faint'),
        },
        line: {
          DEFAULT: v('--color-line'),
          subtle: v('--color-line-subtle'),
          focus: v('--color-focus'),
          strong: v('--color-line-strong'),
        },
        signal: {
          DEFAULT: v('--color-signal'),
          soft: v('--color-signal-soft'),
          ring: v('--color-signal-ring'),
        },
        accent: {
          DEFAULT: v('--color-accent'),
          hover: v('--color-accent-hover'),
          contrast: v('--color-accent-contrast'),
          muted: v('--color-accent-muted'),
          glow: v('--color-accent-glow'),
        },
        status: {
          emerald: v('--color-emerald'),
          amber: v('--color-amber'),
          crimson: v('--color-crimson'),
          blue: v('--color-blue'),
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'Noto Sans SC',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'Cascadia Code',
          'Consolas',
          'PingFang SC',
          'Microsoft YaHei',
          'monospace',
        ],
      },
      boxShadow: {
        'subtle': 'var(--shadow-xs)',
        'card': 'var(--shadow-card), var(--highlight-top)',
        'elevated': 'var(--shadow-card-hover), var(--highlight-top)',
        'floating': 'var(--shadow-pop)',
        'pop': 'var(--shadow-pop), var(--highlight-top)',
      },
      transitionTimingFunction: {
        'out-expo': 'var(--ease-out)',
        'spring': 'var(--ease-spring)',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.9' },
        },
      },
      animation: {
        'pulse-glow': 'pulseGlow 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
