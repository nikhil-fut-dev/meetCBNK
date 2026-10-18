/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef5ff",
          100: "#dbeafe",
          500: "#3978f6",
          600: "#2563eb",
          700: "#1d4ed8",
          900: "#142447",
        },
        ink: "#101828",
        muted: "#667085",
        surface: "#f7f9fc",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 18px 55px rgba(16, 24, 40, 0.08)",
        card: "0 8px 28px rgba(16, 24, 40, 0.06)",
      },
    },
  },
  plugins: [],
};
