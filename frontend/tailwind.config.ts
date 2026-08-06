import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        stage: {
          bg: "#0b1f26",
          surface: "#122a33",
          border: "#1e4450",
          muted: "#7a9aa6",
        },
        accent: {
          amber: "#f5a623",
          glow: "rgba(245, 166, 35, 0.35)",
          teal: "#2dd4bf",
        },
        actor: {
          ale: "#38bdf8",
          hacker: "#fb7185",
          brayan: "#a3e635",
        },
        blackboard: {
          chalk: "#d4e8ef",
        },
      },
      fontFamily: {
        display: ["var(--font-syne)", "system-ui", "sans-serif"],
        body: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(245, 166, 35, 0.35)",
        stage: "0 8px 32px rgba(0, 0, 0, 0.45)",
      },
      animation: {
        pulseSlow: "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
