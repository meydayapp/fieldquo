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
//
// One row — "Invite your team" — is done in place. It came here from the
// onboarding card at the owner's ask ("it can be marked as done without
// leaving the window"), and the quick Add Employee popup came with it: the
// row carries a button that opens the popup, and when the popup reports an
// addition the list is re-read from the server rather than the row being
// struck off locally. The rule is "removed when the database says so", and
// a refetch is how this card asks the database; a local splice would be the
// card deciding for itself.
//
// Since 2026-09-21 every other row is done in place too — the owner: "Same
// for the additional steps." Each opens its step in a dialog on this page,
// rendering the SAME editor its settings page renders (app/components/
// dashboard/stepPanels.js), and a change inside it re-reads this list the
// same way the popup does, so the row leaves when the server says so and
// the next one is offered (useStepDialog.js). The row keeps its link to the
// page beside the dialog's own "Open in settings", and the "Done, hide"
// button is untouched.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, UserPlus } from "lucide-react";
import { CARD } from "@/app/components/dashboard/surface";
import AddEmployeeModal from "@/app/components/team/AddEmployeeModal";
import useStepDialog from "@/app/components/dashboard/useStepDialog";
import { hasStepPanel } from "@/app/components/dashboard/stepPanels";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import { remainingSteps } from "@/lib/setupSteps";

const COLLAPSE_BELOW = 3;

/** The one step the card can finish itself, through the popup. */
const INLINE_ADD_EMPLOYEE_KEY = "team";

export default function SetupSteps() {
  const { t } = useTranslation();
  // null = not loaded yet; [] = loaded and nothing left (card renders nothing).
  const [steps, setSteps] = useState(null);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState("");
  const [hiding, setHiding] = useState("");
  const [showAddEmployee, setShowAddEmployee] = useState(false);

  // no-store on every read, the refetch included: the refetch exists
  // precisely because the roster just changed, and a cached copy would show
  // the row the contractor is watching disappear.
  const load = useCallback((isCancelled = () => false) => {
    return fetch("/api/setup-steps", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.reason || data.error || "Could not load set-up steps");
        }
        return data;
      })
      .then((data) => {
        if (isCancelled()) return;
        const remaining = remainingSteps(data?.steps);
        setSteps(remaining);
        // Decided once, from the first load — reopening on every dismissal
        // would fight the reader who just closed it.
        setOpen((prev) => (prev === null ? remaining.length >= COLLAPSE_BELOW : prev));
      })
      .catch((err) => {
        if (isCancelled()) return;
        console.error(err);
        setError(err.message);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  // The dialog a row opens. Its re-read is this card's own `load`, which
  // resolves once the list is set; the rows still remaining are then read
  // back for the next offer. The team row keeps its popup (below) rather
  // than going through here — it is the one step whose form is a popup of
  // its own already, and two frames around one form would be the weeds.
  const [remainingRef, setRemainingRef] = useState([]);
  useEffect(() => {
    if (steps) setRemainingRef(steps);
  }, [steps]);
  const refresh = useCallback(async () => {
    const data = await fetch("/api/setup-steps", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
    if (!data) return remainingRef;
    const remaining = remainingSteps(data?.steps);
    setSteps(remaining);
    return remaining;
  }, [remainingRef]);
  const { open: openStep, dialog, nextStrip } = useStepDialog({
    id: "setup",
    refresh,
    labelOf: (step) => t(step.titleKey, step.title),
    hrefOf: (step) => step.href,
  });

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

      {isOpen && nextStrip && <div className="px-5 pt-3">{nextStrip}</div>}

      {isOpen && (
        <ul id="setup-steps-list" className="border-t border-foreground/15">
          {steps.map((step) => (
            <li
              key={step.key}
              className="flex items-center justify-between gap-3 px-5 py-2 border-b border-foreground/10 last:border-b-0"
            >
              {/* The row opens the dialog; the page link stays beside it as
                  the small arrow, so both doors are on the row. The team
                  row has no dialog of this kind — its button is below. */}
              {hasStepPanel(step.key) ? (
                <button
                  type="button"
                  onClick={() => openStep(step)}
                  className="flex items-center gap-2 min-w-0 flex-1 py-2 text-sm font-medium text-foreground min-h-9 text-left"
                >
                  <span className="truncate">{t(step.titleKey, step.title)}</span>
                </button>
              ) : (
                <span className="flex items-center gap-2 min-w-0 flex-1 py-2 text-sm font-medium text-foreground min-h-9">
                  <span className="truncate">{t(step.titleKey, step.title)}</span>
                </span>
              )}
              <Link
                href={step.href}
                aria-label={`${t(step.titleKey, step.title)} — ${t("app.stepDialog.openInSettings", "Open in settings")}`}
                className="shrink-0 flex items-center justify-center min-h-9 min-w-9 text-muted-foreground hover:text-foreground"
              >
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
              {step.key === INLINE_ADD_EMPLOYEE_KEY && (
                <button
                  type="button"
                  onClick={() => setShowAddEmployee(true)}
                  className="flex items-center gap-1 shrink-0 text-xs font-semibold text-foreground border border-border rounded-full px-3 min-h-9"
                >
                  <UserPlus size={13} aria-hidden="true" />{" "}
                  {t("app.onboarding.addEmployee", "Add Employee")}
                </button>
              )}
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

      {showAddEmployee && (
        <AddEmployeeModal
          onClose={() => setShowAddEmployee(false)}
          onAdded={() => {
            setShowAddEmployee(false);
            // Re-read, not splice: the server measures the roster, and the
            // row leaves when it says so (see the header).
            load();
          }}
        />
      )}

      {dialog}
    </section>
  );
}
