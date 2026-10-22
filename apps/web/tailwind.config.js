/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        heat: {
          none: "#e5e7eb",
          green: "#22c55e",
          mixed: "#f59e0b",
          red: "#ef4444",
        },
      },
    },
  },
  plugins: [],
};
