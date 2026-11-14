const path = require("path");
const preset = require("../../packages/ui/tailwind-preset.js");

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [preset],
  content: [
    path.join(__dirname, "app/**/*.{ts,tsx}"),
    path.join(__dirname, "components/**/*.{ts,tsx}"),
    path.join(__dirname, "../../packages/ui/src/**/*.{ts,tsx}"),
    path.join(__dirname, "../../packages/tenant-workspace/src/**/*.{ts,tsx}"),
  ],
  theme: {
    extend: {
      colors: {
        brand: "#BE185D",
      },
    },
  },
};
