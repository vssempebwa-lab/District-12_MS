/** Shared Tailwind preset for every app in the ecosystem. */
module.exports = {
  theme: {
    extend: {
      colors: {
        canvas: "#F3F4F6",
        line: "#E4E7EC",
        navy: {
          DEFAULT: "#16233B",
          700: "#1E3050",
          600: "#28405F",
        },
        ink: {
          DEFAULT: "#101828",
          soft: "#475467",
          mute: "#98A2B3",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.1)",
        pop: "0 16px 40px rgba(16, 24, 40, 0.18)",
      },
      borderRadius: {
        xl: "0.875rem",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
