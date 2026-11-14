const path = require("path");
const preset = require("../../packages/ui/tailwind-preset.js");

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [preset],
  content: [
    path.join(__dirname, "app/**/*.{ts,tsx}"),
    path.join(__dirname, "components/**/*.{ts,tsx}"),
    path.join(__dirname, "../../packages/ui/src/**/*.{ts,tsx}"),
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#A40000",
          600: "#8A0000",
          300: "#F0A3A3",
          50: "#FBEDED",
        },
        canvas: "#F3F6FA",
        navy: {
          DEFAULT: "#0B1A3C",
          700: "#13254D",
          600: "#1B315F",
        },
        royal: {
          DEFAULT: "#0066FF",
          600: "#0052CC",
          50: "#EBF3FF",
        },
      },
      borderRadius: {
        xl: "0.75rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(11, 26, 60, 0.04), 0 4px 12px rgba(11, 26, 60, 0.06)",
      },
    },
  },
};
