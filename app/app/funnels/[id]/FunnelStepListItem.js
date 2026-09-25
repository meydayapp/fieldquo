// app/app/funnels/[id]/FunnelStepListItem.js
//
// One step in the funnel builder's left-hand step list, in its own file so the
// list can be drawn outside the builder — the /signup side panel renders this
// exact component against fixture steps rather than a hand-drawn lookalike.
// Presentational: the builder owns the step array and passes a handler for
// each control; with no handlers the buttons are inert.
"use client";

import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

// The step kinds, in the order the builder's "Add a step" palette offers them.
// Here rather than in page.js because the list item names a step by its kind,
// and a second copy of this table beside the first is the one that rots. The
// labels are back-office UI and go through t(); see the note in page.js on
// where the line between UI and the funnel's own copy falls.
export const STEP_KINDS = [
  { kind: "intro", labelKey: "app.funnels.step.intro" },
  { kind: "question_single", labelKey: "app.funnels.step.questionSingle" },
  { kind: "question_multi", labelKey: "app.funnels.step.questionMulti" },
  { kind: "instant_estimate", labelKey: "app.funnels.step.instantEstimate" },
  { kind: "photo_upload", labelKey: "app.funnels.step.photoUpload" },
  { kind: "form", labelKey: "app.funnels.step.form" },
  { kind: "thankyou", labelKey: "app.funnels.step.thankyou" },
];

/**
 * @param step        a Funnel.steps entry: id, kind, question | headline
 * @param selected    the step open in the editor
 * @param isFirst     disables "move up"
 * @param isLast      disables "move down"
 * @param canRemove   draws the delete button (the builder keeps at least one step)
 * @param onSelect, onMoveUp, onMoveDown, onRemove   the builder's handlers
 */
export default function FunnelStepListItem({
  step: s, selected, isFirst, isLast, canRemove, onSelect, onMoveUp, onMoveDown, onRemove,
}) {
  const { t } = useTranslation();
  return (
    <div
      className={`rounded-lg border px-3 py-2 flex items-center gap-2 ${
        selected ? "border-foreground bg-accent" : "border-border"
      }`}
    >
      <button
        onClick={onSelect}
        className="flex-1 text-left min-w-0"
      >
        <div className="text-xs font-medium text-foreground truncate">
          {(() => {
            const kind = STEP_KINDS.find((k) => k.kind === s.kind);
            return kind ? t(kind.labelKey) : s.kind;
          })()}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">
          {s.question || s.headline || "—"}
        </div>
      </button>
      <div className="flex flex-col">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="text-muted-foreground disabled:opacity-30"
          aria-label={t("app.funnels.moveStepUp")}
          title={t("app.funnels.moveStepUp")}
        >
          <ChevronUp size={13} />
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="text-muted-foreground disabled:opacity-30"
          aria-label={t("app.funnels.moveStepDown")}
          title={t("app.funnels.moveStepDown")}
        >
          <ChevronDown size={13} />
        </button>
      </div>
      {canRemove && (
        <button
          onClick={onRemove}
          className="text-muted-foreground hover:text-red-600"
          aria-label={t("app.funnels.removeStep")}
          title={t("app.funnels.removeStep")}
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}
