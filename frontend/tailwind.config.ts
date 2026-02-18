import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-darkest': 'var(--bg-darkest)',
        'bg-dark': 'var(--bg-dark)',
        'bg-medium': 'var(--bg-medium)',
        'green-up': 'var(--green-up)',
        'red-down': 'var(--red-down)',
        'border': 'var(--border)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [typography],
} satisfies Config
