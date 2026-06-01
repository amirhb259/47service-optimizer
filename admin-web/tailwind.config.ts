import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        reactor: {
          cyan: "#7df5d2",
          gold: "#f2d56b",
          red: "#ff7770",
          ink: "#070909",
          panel: "#0d1313",
        },
      },
      boxShadow: {
        reactor: "0 24px 90px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255,255,255,0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
