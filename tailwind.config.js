/** @type {import("tailwindcss").Config} */
const config = {
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--text-primary)",
        surface: "var(--surface)",
        primary: "var(--primary)",
        "primary-hover": "var(--primary-hover)",
        secondary: "var(--secondary)",
        "secondary-hover": "var(--secondary-hover)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        info: "var(--info)",
        borderColor: "var(--border-color)",
        textPrimary: "var(--text-primary)",
        textSecondary: "var(--text-secondary)",
        card: "var(--surface-elevated)",
        cardForeground: "var(--text-primary)",
      },
      borderRadius: {
        theme: "var(--radius)",
      },
      boxShadow: {
        themeSm: "var(--shadow-sm)",
        themeMd: "var(--shadow-md)",
        themeLg: "var(--shadow-lg)",
      },
      spacing: {
        1: "var(--space-1)",
        2: "var(--space-2)",
        3: "var(--space-3)",
        4: "var(--space-4)",
        5: "var(--space-5)",
        6: "var(--space-6)",
        8: "var(--space-8)",
        10: "var(--space-10)",
        12: "var(--space-12)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)"],
        mono: ["var(--font-geist-mono)"],
      },
    },
  },
};

module.exports = config;
