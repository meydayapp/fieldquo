// app/app/quotes/[id]/EmailSectionsPanel.js
//
// The two optional sections of THIS quote's email, on the quote page.
//
// ── Why it sits outside the document frame ─────────────────────────────────
//
// Everything inside the <article> on this page mirrors what the client reads.
// This is a decision about what to SEND, not a part of the document, so it
// belongs with the command strip — the same seam the page header explains.
//
// ── Three states, shown as three states ────────────────────────────────────
//
// A checkbox would be a lie here. "Include references" can be true because
// somebody ticked it on this quote, or true because it is on for every quote —
// and a tick that silently stops following the company setting the first time
// anyone touches it is the sort of thing nobody notices until half their
// quotes stop carrying a section they thought was global. So the control is
// three buttons and the current state says which one it is.
//
// ── The warning is the same rule the server enforces ───────────────────────
//
// "On with nothing in it" is refused at send. Saying so HERE, while the quote
// is still being worked on, is the difference between a warning and an
// ambush — but it is not the enforcement, and this panel is not what makes it
// safe. lib/quotes/emailSections.js is.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
// The section metadata — field names and i18n keys — comes from the same
// module the server resolves and gates with. It is pure JS with no Prisma and
// no server-only import, so a client component can hold it, and a restatement
// here is exactly how the panel and the gate would come to disagree.
import { QUOTE_EMAIL_SECTIONS } from "@/lib/quotes/emailSections";

const SETTINGS_HREF = "/app/settings/quote-email";

function StateButton({ active, onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || active}
      aria-pressed={active}
      className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
        active
          ? "bg-inverted text-inverted-foreground border-transparent font-medium"
          : "bg-card text-muted-foreground border-border hover:text-foreground disabled:opacity-50"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * @param editable  false once the quote is accepted or declined. The email has
 *                  already gone; offering a control that changes what a
 *                  delivered message contained would be a control that appears
 *                  to work and doesn't.
 * @param onBlockedChange  told whether anything currently blocks a send, so
 *                  the page can keep its own Send button honest.
 */
export default function EmailSectionsPanel({ quoteId, editable = true, onBlockedChange }) {
  const { t } = useTranslation();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const apply = useCallback(
    (data) => {
      setState(data);
      onBlockedChange?.(data.blocked || []);
    },
    [onBlockedChange],
  );

  useEffect(() => {
    let alive = true;
    fetchJson(`/api/quotes/${quoteId}/email-sections`)
      .then((data) => {
        if (alive) apply(data);
      })
      .catch((err) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [quoteId, apply]);

  async function set(key, value) {
    const field = QUOTE_EMAIL_SECTIONS[key].quoteIncludeField;
    setBusy(key);
    setError("");
    try {
      apply(
        await fetchJson(`/api/quotes/${quoteId}/email-sections`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        }),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  // Nothing to say while it loads, and nothing to say when the company has
  // never switched either section on and this quote hasn't either — an empty
  // titled panel on a page that is already long is noise. It appears the
  // moment there is a decision to show.
  if (loading) return null;

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
        {error}
      </div>
    );
  }

  const sections = state?.sections || [];
  const interesting = sections.filter(
    (s) => s.included || !s.inherited || s.companyItemCount > 0,
  );
  if (!interesting.length) return null;

  return (
    <div className="bg-card border border-border rounded-lg px-4 py-3 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">
          {t("app.quoteEmail.panelTitle")}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("app.quoteEmail.panelSubtitle")}
        </p>
      </div>

      {interesting.map((s) => (
        <div key={s.key} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-medium text-foreground">
                {t(QUOTE_EMAIL_SECTIONS[s.key].labelKey)}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {s.included
                  ? t("app.quoteEmail.countIncluded", {
                      count: s.items.length,
                      source:
                        s.source === "quote"
                          ? t("app.quoteEmail.sourceQuote")
                          : t("app.quoteEmail.sourceCompany"),
                    })
                  : t("app.quoteEmail.notIncluded")}
              </div>
            </div>

            {editable && (
              <div className="flex items-center gap-1.5">
                {busy === s.key && (
                  <Loader2 size={13} className="animate-spin text-muted-foreground" />
                )}
                <StateButton
                  active={!s.inherited && s.included}
                  disabled={Boolean(busy)}
                  onClick={() => set(s.key, true)}
                >
                  {t("app.quoteEmail.on")}
                </StateButton>
                <StateButton
                  active={!s.inherited && !s.included}
                  disabled={Boolean(busy)}
                  onClick={() => set(s.key, false)}
                >
                  {t("app.quoteEmail.off")}
                </StateButton>
                <StateButton
                  active={s.inherited}
                  disabled={Boolean(busy)}
                  onClick={() => set(s.key, null)}
                >
                  {s.companyDefault
                    ? t("app.quoteEmail.defaultOn")
                    : t("app.quoteEmail.defaultOff")}
                </StateButton>
              </div>
            )}
          </div>

          {s.blocksSend && (
            <div className="mt-2 flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>
                {t("app.quoteEmail.blocksSend")}{" "}
                <Link href={SETTINGS_HREF} className="underline font-medium">
                  {t("app.quoteEmail.manageInSettings")}
                </Link>
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
