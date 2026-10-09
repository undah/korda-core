import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // KordaBudget — light, warm paper. Contrast checked against `surface`:
        // ink2 7.1:1, accent 7.4:1; ink3 is 4:1 and only for secondary text.
        kb: {
          bg: "#f4f3ee",
          surface: "#fdfdfb",
          sunk: "#ecebe5",
          line: "#e3e2dc",
          "line-strong": "#d3d2cb",
          ink: "#17181c",
          ink2: "#55575e",
          ink3: "#7c7e85",
          accent: "#3d3bd4",
          "accent-ink": "#2c2aa8",
          "accent-soft": "#e9e8fb",
          // Status steps are fixed and always paired with an icon + label.
          warn: "#fab219",
          "warn-soft": "#fdf0cf",
          "warn-ink": "#8a5a00",
          crit: "#d03b3b",
          "crit-soft": "#f8dcdc",
          "crit-ink": "#a62a2a",
          "good-ink": "#1d6b35",
          // Needs / wants / saving: categorical, validated for colour-blind separation
          // against the surface. Never used as status colours; always with a label.
          nodig: "#3d3bd4",
          wil: "#e07a1f",
          sparen: "#1fa3c4",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        chart: {
          profit: "hsl(var(--chart-profit))",
          loss: "hsl(var(--chart-loss))",
          neutral: "hsl(var(--chart-neutral))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateX(-10px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px hsl(173 80% 40% / 0.3)" },
          "50%": { boxShadow: "0 0 40px hsl(173 80% 40% / 0.5)" },
        },
        // Korda AI: a gentle float, its shadow breathing with it, and a blink now and then.
        zweef: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-7px)" },
        },
        schaduw: {
          "0%, 100%": { transform: "scaleX(1)", opacity: "0.35" },
          "50%": { transform: "scaleX(0.72)", opacity: "0.18" },
        },
        knipper: {
          "0%, 92%, 100%": { transform: "scaleY(1)" },
          "95%": { transform: "scaleY(0.1)" },
        },
        "antenne-gloei": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        zweef: "zweef 3.2s ease-in-out infinite",
        schaduw: "schaduw 3.2s ease-in-out infinite",
        knipper: "knipper 4.6s ease-in-out infinite",
        "antenne-gloei": "antenne-gloei 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
