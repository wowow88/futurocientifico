/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{astro,html,js,jsx,ts,tsx,vue,svelte}',
  ],
  theme: {
    extend: {
      animation: {
        'gradient-move': 'gradientMove 15s ease infinite',
      },
      keyframes: {
        gradientMove: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
      },
    },
  },
  plugins: [],
}
