// app/components/admin/DeleteConfirmModal.js
"use client";

import { AlertTriangle, X } from "lucide-react";

import { useTranslation } from "@/app/hooks/useTranslation";

// ── The dialog's own words ────────────────────────────────────────────────
//
// Every caller passes a translated `title` and most pass a translated
// `message`, and the two buttons underneath them still read "Cancel" and
// "Delete" in English on a French screen — the half-translated dialog is worse
// than an untranslated one, because the sentence a person read carefully was in
// their language and the button they then pressed was not.
//
// The defaults are keyed too. They are what a caller that passes neither shows,
// and "Delete Item" in title case was never a sentence anybody wrote on
// purpose.
export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  itemName,
  busy = false,
}) {
  // Before the early return: hooks cannot run conditionally, and this component
  // is rendered with isOpen={false} by every screen that uses it.
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={26} className="text-red-500" />
        </div>

        <h2 className="text-lg font-semibold text-foreground text-center">
          {title ?? t("app.deleteModal.title", "Delete item")}
        </h2>
        <p className="text-sm text-muted-foreground text-center mt-1.5">
          {message ??
            t(
              "app.deleteModal.message",
              "Are you sure you want to delete this? This cannot be undone.",
            )}
        </p>

        {itemName && (
          <div className="bg-red-50 dark:bg-red-950/40 rounded-lg px-4 py-2.5 mt-4 text-center">
            <strong className="text-sm text-foreground">{itemName}</strong>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 border border-border text-foreground py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
          >
            {t("app.action.cancel", "Cancel")}
          </button>
          {/* onClose is NOT called here any more. It used to fire immediately
              alongside onConfirm, which closed the dialog before the delete
              had happened — so a server refusal (a job carrying logged hours,
              say) arrived with the modal already gone and nothing on screen
              tying the message to what was attempted. The caller closes it
              when it knows the outcome. */}
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 bg-red-600 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
          >
            {busy ? t("app.action.deleting", "Deleting…") : t("app.action.delete", "Delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
