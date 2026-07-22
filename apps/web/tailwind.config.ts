import type { Config } from "tailwindcss";

/**
 * Tailwind config with per-entity theming (BR-ENT-4, A6 §1).
 * Colours resolve from CSS variables so a selected entity's brand (set on a
 * wrapping element) recolours the UI without rebuilding.
 */
const config: Config = {
  // Only the app emits Tailwind classes; workspace packages are pure TS.
  // Add a specific package path here if it ever ships className-bearing UI.
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        border: "hsl(var(--border))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
