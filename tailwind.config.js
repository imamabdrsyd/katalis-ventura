/** @type {import('tailwindcss').Config} */
module.exports = {
  // Dua tema gelap: `.dark` (default, abu kebiruan) dan `.midnight` (near-black ala
  // terminal trading). Keduanya harus menyalakan varian `dark:` yang sama, jadi
  // strategi 'class' bawaan diganti daftar selector eksplisit. Bentuk `&:is(.x *)`
  // meniru persis yang digenerate Tailwind untuk darkMode: 'class'.
  darkMode: ['variant', ['&:is(.dark *)', '&:is(.midnight *)']],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Shadow ala Airbnb: dua lapis lembut untuk resting, satu lapis besar untuk hover/elevated
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)',
        'card-hover': '0 6px 16px rgba(0,0,0,0.12)',
      },
      animation: {
        marquee: 'marquee 30s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      colors: {
        // Skala netral dialiaskan ke CSS variable supaya satu tema bisa me-remap
        // seluruh permukaan tanpa menyentuh call-site. Nilai default (di :root
        // globals.css) identik dengan gray bawaan Tailwind — light mode dan dark
        // mode lama tidak berubah sedikit pun. `.midnight` menimpanya jadi near-black.
        gray: {
          50: 'rgb(var(--c-gray-50) / <alpha-value>)',
          100: 'rgb(var(--c-gray-100) / <alpha-value>)',
          200: 'rgb(var(--c-gray-200) / <alpha-value>)',
          300: 'rgb(var(--c-gray-300) / <alpha-value>)',
          400: 'rgb(var(--c-gray-400) / <alpha-value>)',
          500: 'rgb(var(--c-gray-500) / <alpha-value>)',
          600: 'rgb(var(--c-gray-600) / <alpha-value>)',
          700: 'rgb(var(--c-gray-700) / <alpha-value>)',
          800: 'rgb(var(--c-gray-800) / <alpha-value>)',
          900: 'rgb(var(--c-gray-900) / <alpha-value>)',
          950: 'rgb(var(--c-gray-950) / <alpha-value>)',
        },
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
