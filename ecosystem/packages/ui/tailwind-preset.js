/** Shared Tailwind preset for every app in the ecosystem. */
const plugin = require("tailwindcss/plugin");

/*
 * `.table-stack`: on phones (< 640px) a data table turns into a list of
 * cards. The header row is hidden and every cell shows its column name
 * (from `data-label`, filled in by TableShell) beside the value. The
 * first cell is the card title. Utility classes on <td> (px-4, text-right,
 * hidden md:table-cell, ...) are overridden so every column is readable.
 */
const tableStack = plugin(({ addComponents, theme }) => {
  addComponents({
    "@media (max-width: 639px)": {
      ".table-stack": { display: "block", minWidth: "0 !important", width: "100%" },
      ".table-stack > thead": { display: "none" },
      ".table-stack > tbody, .table-stack > tfoot": { display: "block" },
      ".table-stack > tbody > tr, .table-stack > tfoot > tr": {
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: "0.625rem 1rem",
        padding: "0.875rem 1rem",
      },
      ".table-stack > tbody > tr > td, .table-stack > tfoot > tr > td": {
        display: "flex !important",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        gap: "0.125rem",
        minWidth: "0",
        padding: "0 !important",
        textAlign: "left !important",
        whiteSpace: "normal !important",
        maxWidth: "none !important",
        overflowWrap: "anywhere",
      },
      ".table-stack > tbody > tr > td::before, .table-stack > tfoot > tr > td::before": {
        content: "attr(data-label)",
        fontSize: "10px",
        fontWeight: "600",
        lineHeight: "1rem",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: theme("colors.ink.mute", "#98A2B3"),
      },
      ".table-stack > tbody > tr > td:first-child, .table-stack > tbody > tr > td:not([data-label]), .table-stack > tbody > tr > td[colspan]:not([colspan='1'])": {
        gridColumn: "1 / -1",
      },
      ".table-stack > tbody > tr > td:first-child": { fontWeight: "500" },
      ".table-stack > tbody > tr > td:first-child::before, .table-stack > tbody > tr > td:not([data-label])::before": { display: "none" },
      ".table-stack > tbody > tr > td:not([data-label]):not(:first-child)": {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "flex-end",
        alignItems: "center",
        alignSelf: "stretch",
      },
      ".table-stack > tbody > tr > td:empty": { display: "none !important" },
      ".table-stack > tbody > tr > td[colspan]:not([colspan='1'])": {
        display: "block !important",
        textAlign: "center !important",
      },
      ".table-stack > tbody > tr > td[colspan]:not([colspan='1'])::before": { display: "none" },
    },
  });
});

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
  plugins: [require("tailwindcss-animate"), tableStack],
};
