/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#22C55E",
          deep: "#14532D",
          surface: "#F4FBF6",
          border: "#CDEDD7",
          accent: "#86EFAC"
        }
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        card: "0 10px 30px -12px rgba(20, 83, 45, 0.25)"
      },
      keyframes: {
        "fade-slide": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "fade-slide": "fade-slide 280ms ease-out"
      }
    }
  },
  plugins: []
};
