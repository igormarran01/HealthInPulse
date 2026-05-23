/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Care Plus — azul navy corporativo
        brand: {
          50:  '#eef4fa',
          100: '#d4e3f1',
          200: '#a9c5e1',
          300: '#7ea7d1',
          400: '#5388be',
          500: '#2e6bab',
          600: '#0e5193',
          700: '#003F7E',  // primary (logo Care Plus)
          800: '#00346a',
          900: '#002a55',
          950: '#001a36',
        },
        // Care Plus — ciano de acento (links / hover / destaques)
        accent: {
          50:  '#e6f7fd',
          100: '#c1ebf9',
          200: '#8edcf3',
          300: '#5bcded',
          400: '#28bee7',
          500: '#00A0DC',  // accent oficial
          600: '#008abf',
          700: '#00709c',
          800: '#005a7d',
          900: '#00465f',
        },
        // Superfícies claras
        surface: {
          50:  '#F7F9FC',
          100: '#eef2f7',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0F172A',
        },
        risk: {
          low:      '#16a34a',
          moderate: '#d97706',
          high:     '#ea580c',
          critical: '#dc2626',
        },
      },
      fontFamily: {
        sans:    ['"DM Sans"', 'sans-serif'],
        display: ['"Sora"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'card':       '0 1px 3px rgba(15,23,42,0.05), 0 1px 2px rgba(15,23,42,0.03)',
        'card-hover': '0 4px 12px rgba(15,23,42,0.08), 0 2px 4px rgba(15,23,42,0.04)',
        'glow':       '0 0 0 4px rgba(0,160,220,0.15)',
      },
      animation: {
        'fade-in':    'fadeIn 0.4s ease forwards',
        'slide-up':   'slideUp 0.4s ease forwards',
        'pulse-ring': 'pulseRing 2s cubic-bezier(0.4,0,0.6,1) infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:   { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseRing: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
      },
    },
  },
  plugins: [],
};
