/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'primary': '#8A5CFE',
        'primary-focus': '#7C3AED',
        'surface': '#1E293B',
        'text-main': '#F1F5F9',
        'text-secondary': '#94A3B8',
      }
    },
  },
  plugins: [],
};
