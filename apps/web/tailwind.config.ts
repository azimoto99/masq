import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0a0b10',
          800: '#12141b',
          700: '#1e2230',
        },
        neon: {
          400: '#8ff5ff',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
