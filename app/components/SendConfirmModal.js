"use client";

// app/components/SendConfirmModal.js
//
// "Send this to someone@example.com?"
//
// ── Why this replaced window.confirm ───────────────────────────────────────
//
// Sending is outbound and irreversible: it lands in a stranger's inbox under
// the contractor's name, and there is no unsend. Delete already had a proper
// modal; send had nothing, then briefly had window.confirm.
//
// window.confirm was the wrong instrument for two reasons. It is styled by the
// browser, so the one screen where the contractor should slow down looks less
// considered than the delete they can undo. And an automated browser
// auto-accepts it — QA sent two real emails and reported no confirmation at
// all, which is exactly what a native dialog looks like from the outside.
//
// A rendered modal is visible to a person, visible to a test, and can name the
// recipient — which is the thing actually worth checking. QA created a client
// through the quick-add and sent to whatever address happened to be on it.

import { Send, X } from "lucide-react";

export default function SendConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  busy = false,
  title,
  recipient,
  detail,
  confirmLabel,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={busy ? undefined : onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <Send size={24} className="text-foreground" />
        </div>

        <h2 className="text-lg font-semibold text-foreground text-center">
          {title}
        </h2>

        {/* The address, on its own line and hard to skim past. This is the
            single fact the person is being asked to check. */}
        {recipient && (
          <div className="bg-muted rounded-lg px-4 py-2.5 mt-4 text-center break-all">
            <strong className="text-sm text-foreground">{recipient}</strong>
          </div>
        )}

        {detail && (
          <p className="text-sm text-muted-foreground text-center mt-3">
            {detail}
          </p>
        )}

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 border border-border rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            <X size={14} className="inline mr-1.5 -mt-0.5" />
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 bg-inverted text-inverted-foreground rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {confirmLabel || "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
