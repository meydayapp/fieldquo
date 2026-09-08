// app/components/dashboard/SetupSteps.js
"use client";

// "Additional set-up steps" — the drop-down under the onboarding card.
//
// Every row here is one the server measured as NOT done and the company has
// NOT hidden (lib/setupSteps.js). There is no tick state: a step the database
// says is done is simply absent, which is the owner's ask ("removed, not
// checked") and the honest rendering — a ticked row would be a claim this
// component could not verify on its own.
//
// Collapsed by default once fewer than three remain: a card with one line in
// it, open all day on the dashboard, is a nag; three or more is a list worth
// seeing. The reader can open or close it either way.
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { CARD } from "@/app/components/dashboard/surface";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import { remainingSteps } from "@/lib/setupSteps";

const COLLAPSE_BELOW = 3;

export default function SetupSteps() {
  const { t } = useTranslation();
  // null = not loaded yet; [] = loaded and nothing left (card renders nothing).
  const [steps, setSteps] = useState(null);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState("");
  const [hiding, setHiding] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/setup-steps", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.reason || data.error || "Could not load set-up steps");
        }
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        const remaining = remainingSteps(data?.steps);
        setSteps(remaining);
        // Decided once, from the first load — reopening on every dismissal
        // would fight the reader who just closed it.
        setOpen((prev) => (prev === null ? remaining.length >= COLLAPSE_BELOW : prev));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function hide(key) {
    setHiding(key);
    try {
      const res = await fetch("/api/setup-steps/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.setup.hideFailed", "Could not hide that step."));
        return;
      }
      // Removed locally only after the server confirmed it: a row that
      // vanished on click and came back on the next load is the dead
      // control AGENTS.md warns about, one refresh later.
      setSteps((prev) => (prev || []).filter((s) => s.key !== key));
    } finally {
      setHiding("");
    }
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm px-4 py-3">
        {t("app.setup.unavailable", "Set-up steps unavailable:")} {error}
      </div>
    );
  }

  if (!steps || steps.length === 0) return null;

  const isOpen = open === true;

  return (
    <section className={CARD} data-tour="setup-steps">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-controls="setup-steps-list"
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left min-h-11"
      >
        <span className="min-w-0">
          <span className="block font-semibold text-foreground">
            {t("app.setup.title", "Additional set-up steps")}{" "}
            <span className="text-muted-foreground font-normal">
              ({t("app.setup.left", "{n} left", { n: steps.length })})
            </span>
          </span>
          <span className="block text-sm text-muted-foreground mt-0.5">
            {t(
              "app.setup.intro",
              "Each of these disappears on its own once it's done — or hide it yourself.",
            )}
          </span>
        </span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={`shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <ul id="setup-steps-list" className="border-t border-foreground/15">
          {steps.map((step) => (
            <li
              key={step.key}
              className="flex items-center justify-between gap-3 px-5 py-2 border-b border-foreground/10 last:border-b-0"
            >
              <Link
                href={step.href}
                className="flex items-center gap-2 min-w-0 flex-1 py-2 text-sm font-medium text-foreground min-h-9"
              >
                <span className="truncate">{t(step.titleKey, step.title)}</span>
                <ArrowRight size={14} aria-hidden="true" className="shrink-0 text-muted-foreground" />
              </Link>
              <button
                type="button"
                onClick={() => hide(step.key)}
                disabled={hiding === step.key}
                className="shrink-0 text-xs font-semibold text-muted-foreground hover:text-foreground border border-foreground/20 rounded-full px-3 min-h-9 disabled:opacity-60"
              >
                {t("app.setup.hide", "Done, hide")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
