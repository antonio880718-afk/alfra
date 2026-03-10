/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        turquesa: '#20B2AA',
        acero: '#4682B4',
        blancoPuro: '#FFFFFF',
        fondo: '#F8FAFC' /* Light background for contrast */
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
