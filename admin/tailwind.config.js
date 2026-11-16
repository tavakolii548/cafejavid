/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#F4F6F2',
        surface: '#FFFFFF',
        line: '#DDE4DE',
        ink: '#17251E',
        muted: '#5B6B62',
        primary: '#1E4D3A',
        tint: '#E3EDE6',
        accent: '#F2B55A',
        sand: '#FBEBCF',
        lilac: '#EDE6F2',
      },
      fontFamily: {
        sans: ['Vazirmatn', 'Tahoma', 'sans-serif'],
      },
      borderRadius: {
        card: '18px',
        btn: '16px',
      },
    },
  },
  plugins: [],
};
