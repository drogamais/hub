/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/views/**/*.ejs"], // Onde o Tailwind vai procurar as classes
  theme: {
    extend: {
      colors: {
        sid: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          500: '#c42c2c',
          600: '#b91c1c',
          700: '#991b1b'
        },
        ink: '#1e293b',
      },
      boxShadow: {
        panel: '0 8px 30px rgba(0,0,0,.06)',
      },
    },
  },
  plugins: [],
}