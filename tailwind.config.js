/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./views/**/*.ejs",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fcf6f2',
          100: '#f8ebe2',
          200: '#efd1bc',
          300: '#e5b291',
          400: '#da8f61',
          500: '#c96b2c',
          600: '#bc5b23',
          700: '#9d4a1f',
          800: '#7f3e1b',
          900: '#673418',
        },
        accent: '#2d5f4c',
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
