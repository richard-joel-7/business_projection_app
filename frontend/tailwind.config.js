/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#2f8d4d", // FX Green
        secondary: "#0F172A", // Dark Slate
        accent: "#FF1493", // Neon Pink
        dark: {
          900: "#050505",
          800: "#0A0A0A",
          700: "#121212",
        }
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-glow': 'conic-gradient(from 180deg at 50% 50%, #00E5FF33 0deg, #FF149333 180deg, #00E5FF33 360deg)',
      }
    },
  },
  plugins: [],
}
