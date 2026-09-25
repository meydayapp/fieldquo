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
//   company  accepted and unused — the builder has always passed it
"use client";

import { Check } from "lucide-react";
import { readableForeground } from "@/lib/brand/colour";
import { useTranslation } from "@/app/hooks/useTranslation";

// A faithful single-step preview in a phone frame, brand-accented.
export default function StepPreview({ step, accent, company }) {
  // Only the EDITOR'S annotations inside this frame are keyed — "No step
  // selected", "Add a size option", the note under the placeholder price.
  // Everything that stands in for the funnel's own copy stays as it is,
  // because that is the text a homeowner will read and it belongs to the
  // contractor, not to the interface. See the note above newStep() in
  // page.js on where that line falls.
  const { t } = useTranslation();
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
              {step.headline || "Thanks!"}
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
              {step.buttonText || "Get started"}
            </button>
          </div>
        ) : step.kind === "form" ? (
          <div>
            <h3 className="font-bold text-[#2d2520]">
              {step.headline || "Your details"}
            </h3>
            <div className="mt-3 space-y-2">
              {(step.fields || ["name", "email", "phone"]).map((f) => (
                <div
                  key={f}
                  className="border border-black/15 rounded-lg px-3 py-2 text-xs text-neutral-400 capitalize"
                >
                  {f}
                </div>
              ))}
            </div>
            <button
              className="w-full mt-3 py-2.5 rounded-full text-sm font-bold"
              style={{ backgroundColor: accent, color: on }}
            >
              {step.buttonText || "Submit"}
            </button>
          </div>
        ) : step.kind === "instant_estimate" ? (
          <div>
            <h3 className="font-bold text-[#2d2520]">
              {step.headline || "Your instant price"}
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
                    {/* Editor annotation: an unlabelled band never reaches a
                        homeowner (estimateStepIssues flags it), so the
                        placeholder speaks the contractor's language. */}
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
                {step.buttonText || "Continue"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
