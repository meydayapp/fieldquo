// app/components/ThemeToggle.js
"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/app/providers/ThemeProvider";
import { useTranslation } from "@/app/hooks/useTranslation";

const OPTIONS = [
  { value: "light", Icon: Sun, key: "theme.light" },
  { value: "dark", Icon: Moon, key: "theme.dark" },
  { value: "system", Icon: Monitor, key: "theme.system" },
];

/**
 * Three-way control rather than a single toggle.
 *
 * A plain sun/moon switch can't express "follow my OS", so choosing it once
 * silently opts you out of system dark mode forever — a common annoyance.
 * The segmented control costs one extra button and makes the state legible.
 */
export default function ThemeToggle({ compact = false }) {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  return (
    <div
      className="inline-flex rounded-full border border-border p-0.5"
      role="group"
      aria-label={t("theme.label", "Theme")}
    >
      {OPTIONS.map(({ value, Icon, key }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-pressed={theme === value}
          title={t(key)}
          aria-label={t(key)}
          className={`rounded-full transition-colors ${
            compact ? "p-1.5" : "p-2"
          } ${
            theme === value
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon size={compact ? 13 : 15} />
        </button>
      ))}
    </div>
  );
}
