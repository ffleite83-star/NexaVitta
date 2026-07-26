import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx,mdx}', './components/**/*.{ts,tsx}', './content/**/*.mdx'],
  theme: {
    extend: {
      colors: {
        ink: '#172838',
        'ink-soft': '#365263',
        paper: '#f6f5ef',
        sand: '#e9e6da',
        sage: '#c0d2a2',
        blue: '#6599a2',
        violet: '#5967a6',
        line: 'rgba(23,40,56,.14)',
      },
      fontFamily: {
        sans: ['Manrope', 'Arial', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      maxWidth: {
        content: '1180px',
      },
    },
  },
  plugins: [],
}
export default config
