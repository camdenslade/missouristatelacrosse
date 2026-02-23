/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        maroon: {
          DEFAULT: "#5E0009",
          light: "#7a1020",
          dark: "#450007",
        },
      },
    },
  },
};
