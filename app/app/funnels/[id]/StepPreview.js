// app/app/funnels/[id]/StepPreview.js
//
// The builder's right-hand preview, in its own file so it can be drawn outside
// the builder — the /signup side panel renders this exact component against
// fixture steps rather than a hand-drawn lookalike. Presentational: no fetch,
// no router.
//
// Props:
//   step     a Funnel.steps entry, or null for "no step selected" — reads
//            kind, headline, subhead, buttonText, fields, sizeQuestion,
//            bands [{ id, label }], order, question, help,
//            answers [{ id, label }]
//   accent   the company's brand hex; the frame and buttons are drawn in it,
//            with readableForeground() choosing the ink on top
//   company  the builder's company (needs `defaultLanguage`), or null on the
//            /signup panel
//
// ── Two languages in one frame, on purpose ──────────────────────────────────
//
// The frame stands in for the public page, so the words that stand in for
// the public page's chrome — "Get started", the contact placeholders, "Submit"
// where the contractor left a button blank — are the words the visitor will
// actually see: funnelCopy() in the COMPANY's language, by the same rule the
// public runner uses (lib/i18n/funnelCopy.js funnelPageLanguage). They used to
// be English, and not even the runner's English ("Your details" here, "Where
// should we send it?" there), so a French contractor previewed a page that
// did not exist. The editor's own annotations stay in the contractor's
// interface language through t(), below. With no company (the /signup panel,
// fixture steps) there is no page to be faithful to, and the frame follows
// the interface language like everything around it.
"use client";

import { Check } from "lucide-react";
import { readableForeground } from "@/lib/brand/colour";
import { useTranslation } from "@/app/hooks/useTranslation";
import { funnelCopy, funnelPageLanguage } from "@/lib/i18n/funnelCopy";

// A faithful single-step preview in a phone frame, brand-accented.
export default function StepPreview({ step, accent, company }) {
  // Only the EDITOR'S annotations inside this frame go through t() — "No step
  // selected", "Add a size option", the note under the placeholder price, an
  // unnamed option. The funnel's own copy is drawn as the contractor wrote
  // it, and where they left a field blank the frame shows the public page's
  // chrome in the public page's language (`copy`, see the header). See the
  // note above newStep() in page.js on where that line falls.
  const { t, language } = useTranslation();
  const copy = funnelCopy(company ? funnelPageLanguage(company) : language);
  const placeholder = {
    name: copy.namePlaceholder,
    email: copy.emailPlaceholder,
    phone: copy.phonePlaceholder,
  };
  const on = readableForeground(accent);
  return (
    <div
      className="rounded-2xl p-4 min-h-[380px] flex items-center justify-center"
      style={{ backgroundColor: accent }}
    >
      <div className="w-full bg-white rounded-xl p-5 shadow-lg">
        {!step ? (
          <p className="text-sm text-neutral-500 text-center">
            {t("app.funnels.noStepSelected")}
          </p>
        ) : step.kind === "thankyou" ? (
          <div className="text-center py-4">
            <div
              className="w-12 h-12 rounded-full grid place-items-center mx-auto mb-3"
              style={{ backgroundColor: accent, color: on }}
            >
              <Check size={22} />
            </div>
            <h3 className="font-bold text-[#2d2520]">
              {step.headline || copy.thanks}
            </h3>
            {step.subhead && (
              <p className="text-xs text-[#2d2520]/70 mt-1">{step.subhead}</p>
            )}
          </div>
        ) : step.kind === "intro" ? (
          <div className="text-center">
            <h3 className="text-lg font-bold text-[#2d2520]">
              {step.headline}
            </h3>
            {step.subhead && (
              <p className="text-xs text-[#2d2520]/70 mt-1">{step.subhead}</p>
            )}
            <button
              className="w-full mt-4 py-2.5 rounded-full text-sm font-bold"
              style={{ backgroundColor: accent, color: on }}
            >
              {step.buttonText || copy.getStarted}
            </button>
          </div>
        ) : step.kind === "form" ? (
          <div>
            <h3 className="font-bold text-[#2d2520]">
              {step.headline || copy.formTitle}
            </h3>
            <div className="mt-3 space-y-2">
              {(step.fields || ["name", "email", "phone"]).map((f) => (
                <div
                  key={f}
                  className="border border-black/15 rounded-lg px-3 py-2 text-xs text-neutral-400"
                >
                  {placeholder[f] || f}
                </div>
              ))}
            </div>
            <button
              className="w-full mt-3 py-2.5 rounded-full text-sm font-bold"
              style={{ backgroundColor: accent, color: on }}
            >
              {step.buttonText || copy.submit}
            </button>
          </div>
        ) : step.kind === "instant_estimate" ? (
          <div>
            <h3 className="font-bold text-[#2d2520]">
              {step.headline || copy.estimateTitle}
            </h3>
            {step.subhead && (
              <p className="text-xs text-[#2d2520]/70 mt-1">{step.subhead}</p>
            )}
            {step.sizeQuestion && (
              <p className="text-xs font-semibold text-[#2d2520] mt-3">
                {step.sizeQuestion}
              </p>
            )}
            <div className="mt-2 space-y-2">
              {(step.bands || []).length === 0 ? (
                <div className="border border-dashed border-black/15 rounded-lg px-3 py-4 text-center text-xs text-neutral-400">
                  {t("app.funnels.previewAddSizeOption")}
                </div>
              ) : (
                (step.bands || []).map((b) => (
                  <div
                    key={b.id}
                    className="border border-black/15 rounded-lg px-3 py-2 text-sm text-[#2d2520]"
                  >
                    {/* Editor chrome: an unnamed option cannot be published
                        (funnelBlocks.js refuses "unlabelled_band"), so this
                        only ever speaks to the contractor. */}
                    {b.label || t("app.funnels.previewUntitledOption")}
                  </div>
                ))
              )}
            </div>
            {/* A stand-in, never an invented figure: the real number is
                computed on the server from this company's saved rates and the
                option the visitor taps, so there is nothing truthful to show
                here until someone taps one. */}
            <div className="mt-3 rounded-lg border border-black/10 px-3 py-4 text-center">
              <div className="text-xl font-bold" style={{ color: accent }}>
                $—— – $——
              </div>
              <div className="text-[11px] text-neutral-400 mt-1">
                {step.order === "details_first"
                  ? t("app.funnels.previewPriceAfter")
                  : t("app.funnels.previewPriceBefore")}
              </div>
            </div>
          </div>
        ) : step.kind === "photo_upload" ? (
          <div>
            <h3 className="font-bold text-[#2d2520]">{step.headline}</h3>
            {step.subhead && (
              <p className="text-xs text-[#2d2520]/70 mt-1">{step.subhead}</p>
            )}
            <div className="mt-3 border-2 border-dashed border-black/15 rounded-lg py-6 text-center text-xs text-neutral-400">
              {/* Editor chrome, not funnel copy: the live step renders
                  MediaUploader, which has its own control and resolves the
                  VISITOR's language. This dashed box is a stand-in for it, the
                  same way "$—— – $——" stands in for a price, so it follows the
                  contractor's language like the rest of the preview frame. */}
              {t("app.funnels.previewAddPhotos")}
            </div>
          </div>
        ) : (
          <div>
            <h3 className="font-bold text-[#2d2520]">{step.question}</h3>
            {step.help && (
              <p className="text-xs text-[#2d2520]/60 mt-1">{step.help}</p>
            )}
            <div className="mt-3 space-y-2">
              {(step.answers || []).map((a) => (
                <div
                  key={a.id}
                  className="border border-black/15 rounded-lg px-3 py-2 text-sm text-[#2d2520]"
                >
                  {a.label}
                </div>
              ))}
            </div>
            {step.kind === "question_multi" && (
              <button
                className="w-full mt-3 py-2.5 rounded-full text-sm font-bold"
                style={{ backgroundColor: accent, color: on }}
              >
                {step.buttonText || copy.continue}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
