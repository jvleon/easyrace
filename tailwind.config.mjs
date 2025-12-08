/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'orange-primary': '#FF5722',
        'red-fire': '#D50000',
        'black-asphalt': '#212121',
        'white-pure': '#FFF',
      },
    },
  },
  plugins: [],
}



