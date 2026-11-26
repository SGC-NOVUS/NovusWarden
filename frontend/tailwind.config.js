/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './vault/*.html',
    './vault/src/**/*.{vue,js,ts,jsx,tsx}',
    './admin/index.html',
    './admin/src/**/*.{vue,js,ts,jsx,tsx}',
    './shared/**/*.{vue,js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#010811',
          card: 'rgba(10, 18, 35, 0.88)',
          border: 'rgba(56, 189, 248, 0.28)',
          glow: 'rgba(14, 165, 233, 0.15)',
        },
      },
    },
  },
  plugins: [],
};

