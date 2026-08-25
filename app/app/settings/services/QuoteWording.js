// app/app/settings/services/QuoteWording.js
//
// What this company's quotes SAY about a trade, beyond the price.
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// CompanyServiceCategory.includedItems and .processSteps have been in the
// schema since scope groups shipped, and lib/documents/serviceContent.js has
// always read them. Nothing ever WROTE one. Every company was on the code
// defaults with no way off them, and the comment promising "a company that has
// customised theirs is never overwritten" described a state no company could
// reach. That is the read-but-never-written failure class, and this is the
// missing half.
//
// ── Empty means inherited, not blank ────────────────────────────────────────
//
// Clearing every row here removes the override and the trade goes back to
// inheriting the default wording — it does NOT publish a quote with no
// included list. Same rule as the rate card: a blank field un-customises, it
// does not zero. The API stores null for an empty result for the same reason.
//
// ── Why it edits the DRAFT rather than what prints ──────────────────────────
//
// resolveServiceContent withholds any line still carrying an unfilled
// [placeholder], because those defaults reach a homeowner whether or not
// anyone here has ever opened this screen. This editor is the one place that
// must show them anyway — a company cannot fill in a bracket it is not allowed
// to see — so it reads `content.draft`, and the banner says plainly which
// lines are being held back until they are finished.
"use client";

import { useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

const inputClass =
  "w-full border border-border rounded px-2 py-1 text-sm bg-background";

export default function QuoteWording({
  category,
  onChange,
  defaultOpen = false,
}) {
  const { t } = useTranslation();
  // `defaultOpen` exists so the render check can exercise the panel's contents
  // rather than only its collapsed header — the first version of that check
  // passed against corrupt input purely because the panel was shut.
  const [open, setOpen] = useState(defaultOpen);

  // The resolved content — defaults filled in — is what a quote would print,
  // so it is what the editor shows. The sparse override decides only whether
  // this reads as "customised".
  const resolved = category.content || {};
  const draft = resolved.draft || resolved;
  const overrides = category.contentOverrides || {};
  const customised = Boolean(
    (Array.isArray(overrides.includedItems) &&
      overrides.includedItems.length) ||
      (Array.isArray(overrides.processSteps) && overrides.processSteps.length) ||
      (typeof overrides.scopeDescription === "string" &&
        overrides.scopeDescription.trim()),
  );

  // Array-guarded, not just null-guarded. These are Json columns: a row
  // written before the API sanitiser existed, or by anything other than this
  // screen, can hold a string or a number, and `"nope".map` is a blank page
  // for a company that only came here to fix a typo.
  const asList = (v, fallback) =>
    Array.isArray(v) ? v : Array.isArray(fallback) ? fallback : [];
  const included = asList(overrides.includedItems, draft.included);
  const steps = asList(overrides.processSteps, draft.steps);
  const description =
    typeof overrides.scopeDescription === "string"
      ? overrides.scopeDescription
      : typeof draft.description === "string"
        ? draft.description
        : "";

  const unfilled = Array.isArray(resolved.unfilled) ? resolved.unfilled : [];

  // An edit promotes the resolved list into an override wholesale. Editing one
  // bullet of an inherited list has to capture the rest of it, or saving would
  // silently delete the four the company never touched.
  const setIncluded = (next) =>
    onChange({ includedItems: next.length ? next : null });
  const setSteps = (next) =>
    onChange({
      processSteps: next.length
        ? next.map((s) => ({
            title: s.title || "",
            body: s.body || "",
            ...(s.timeline ? { timeline: s.timeline } : {}),
          }))
        : null,
    });
  const setDescription = (next) =>
    onChange({ scopeDescription: next.trim() ? next : null });

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-sm"
      >
        <span className="font-medium text-foreground">
          {t("app.quoteWording.title")}
          {customised && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-normal text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              {t("app.quoteWording.customised")}
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-3 space-y-5">
          <p className="text-xs text-muted-foreground">
            {t("app.quoteWording.intro")}
          </p>

          {/* The withheld lines. Without this the filtering in
              resolveServiceContent is invisible, which is its own dead
              control — a bullet a company can see here and never sees print. */}
          {unfilled.length > 0 && (
            <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {t("app.quoteWording.unfilled")}{" "}
              <span className="font-mono">{unfilled.slice(0, 8).join("  ")}</span>
            </p>
          )}

          {/* The scope paragraph. First, because it prints first — above the
              priced lines, where it answers "what IS this" before the client
              reaches a number. */}
          <div>
            <h4 className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("app.quoteWording.scopeHeading")}
            </h4>
            <p className="mb-2 text-[11px] text-muted-foreground">
              {resolved.variesWith
                ? t("app.quoteWording.scopeVaries", {
                    field: resolved.variesWith,
                  })
                : t("app.quoteWording.scopeHint")}
            </p>
            <textarea
              value={description}
              rows={5}
              placeholder={t("app.quoteWording.scopePlaceholder")}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* What's included */}
          <div>
            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("app.quoteWording.includedHeading")}
            </h4>
            <div className="space-y-1.5">
              {included.map((line, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={line}
                    onChange={(e) => {
                      const next = [...included];
                      next[i] = e.target.value;
                      setIncluded(next);
                    }}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setIncluded(included.filter((_, j) => j !== i))
                    }
                    className="shrink-0 text-muted-foreground hover:text-red-600"
                    aria-label={t("app.quoteWording.removeLine")}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIncluded([...included, ""])}
              className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus size={13} /> {t("app.quoteWording.addLine")}
            </button>
          </div>

          {/* Process steps */}
          <div>
            <h4 className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("app.quoteWording.stepsHeading")}
            </h4>
            <p className="mb-2 text-[11px] text-muted-foreground">
              {t("app.quoteWording.stepsHint")}
            </p>
            <div className="space-y-2">
              {steps.map((step, i) => (
                <div key={i} className="rounded-lg border border-border p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">
                      {i + 1}
                    </span>
                    <input
                      value={step.title || ""}
                      placeholder={t("app.quoteWording.stepName")}
                      onChange={(e) => {
                        const next = [...steps];
                        next[i] = { ...next[i], title: e.target.value };
                        setSteps(next);
                      }}
                      className={inputClass}
                    />
                    <input
                      value={step.timeline || ""}
                      placeholder={t("app.quoteWording.stepTimeline")}
                      onChange={(e) => {
                        const next = [...steps];
                        next[i] = { ...next[i], timeline: e.target.value };
                        setSteps(next);
                      }}
                      className={`${inputClass} w-28 shrink-0`}
                    />
                    <button
                      type="button"
                      onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                      className="shrink-0 text-muted-foreground hover:text-red-600"
                      aria-label={t("app.quoteWording.removeStep")}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <textarea
                    value={step.body || ""}
                    placeholder={t("app.quoteWording.stepBody")}
                    rows={2}
                    onChange={(e) => {
                      const next = [...steps];
                      next[i] = { ...next[i], body: e.target.value };
                      setSteps(next);
                    }}
                    className={`${inputClass} mt-1.5`}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setSteps([...steps, { title: "", body: "", timeline: "" }])
              }
              className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus size={13} /> {t("app.quoteWording.addStep")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
