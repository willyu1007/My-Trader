const forms = require("@tailwindcss/forms");
const typography = require("@tailwindcss/typography");

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#1ea7e1",
        "background-light": "#f3f5f8",
        "background-dark": "#151312",
        "panel-dark": "#23201d",
        "field-dark": "#26221f",
        "surface-light": "#ffffff",
        "surface-dark": "#1d1a18",
        "border-light": "#d6dee8",
        "border-dark": "#4a433d"
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"]
      },
      borderRadius: {
        DEFAULT: "0.5rem"
      },
      boxShadow: {
        glow: "0 0 20px rgba(43, 143, 154, 0.12)"
      }
    }
  },
  plugins: [forms, typography]
};
