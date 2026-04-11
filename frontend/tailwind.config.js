/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: 'var(--bg)',
          1: 'var(--bg-1)',
          2: 'var(--bg-2)',
          3: 'var(--bg-3)',
        },
        border: {
          DEFAULT: 'var(--border)',
          2: 'var(--border-2)',
        },
        green: {
          DEFAULT: 'var(--green)',
          dim: 'var(--green-dim)',
          mute: 'var(--green-mute)',
          glow: 'var(--green-glow)',
        },
        amber: {
          DEFAULT: 'var(--amber)',
          dim: 'var(--amber-dim)',
        },
        red: {
          DEFAULT: 'var(--red)',
          dim: 'var(--red-dim)',
        },
        text: {
          DEFAULT: 'var(--text)',
          2: 'var(--text-2)',
          3: 'var(--text-3)',
          inv: 'var(--text-inv)',
        },
      },
      fontFamily: {
        mono: ['var(--font-mono)'],
        display: ['var(--font-display)'],
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        lg: 'var(--radius-lg)',
      },
      fontSize: {
        '2xs': '0.65rem',
        xs:   ['0.72rem', { lineHeight: '1rem' }],
        sm:   ['0.78rem', { lineHeight: '1.1rem' }],
        base: ['0.82rem', { lineHeight: '1.4rem' }],
        md:   ['0.85rem', { lineHeight: '1.7' }],
        lg:   ['1rem',    { lineHeight: '1.5rem' }],
        xl:   ['1.1rem',  { lineHeight: '1.5rem' }],
        '2xl':['1.3rem',  { lineHeight: '1.75rem' }],
      },
    },
  },
  plugins: [],
}
