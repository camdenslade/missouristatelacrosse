// postcss.config.js
import tailwindcssPostcss from "@tailwindcss/postcss";
import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";

export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
};
