"use client";

// app/components/leads/LeadDeleteDialog.js
//
// The one confirm for deleting leads — from the lead panel, from a card's ⋯
// menu, and for a board selection. One component so the three say the same
// thing; a second copy of a destructive confirm is the one that drifts into
// promising something the server does not do.
//
// ══ What it says, and why each sentence is there ═══════════════════════════
//
//   * The lead BY NAME (or the count), so nobody deletes the wrong card.
//   * That it is permanent, and that Lost is the answer for a real enquiry —
//     Lost keeps the win/loss numbers honest; delete is for rows that should
//     never have counted (lib/leads/deleteLead.js).
//   * What is KEPT: the quote, client, job, invoice and the conversation —
//     the server clears their pointer and touches nothing else.
//   * That counts and reports drop it, and the Activity log records it.
//
// The "don't create a lead from this conversation again" box is offered only
// when a selected lead looks like it came from a conversation
// (lib/leads/conversationSources.js). The server marks only the threads it
// can actually find and returns the leads it found none for; that is said in
// the toast rather than claimed away.
//
// No Undo. It is a hard delete, and an Undo that rebuilt the row would leave
// the conversation and Meta guards stating something untrue — see
// lib/leads/deleteLead.js. The dialog carries the weight instead: the
// destructive button is not the one focused when it opens.

import { useEffect, useRef, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import AlertDialog from "@/app/components/AlertDialog";
import { reportResponseError } from "@/lib/clientErrors";
import { showToast } from "@/lib/toast";
import { looksLikeConversationLead } from "@/lib/leads/conversationSources";

/**
 * @param {object}   props
 * @param {object[]} props.leads      the leads to delete ({ id, name, source, conversationEvidence }); empty = closed
 * @param {(ids: string[]) => void} props.onDeleted  after the server said so
 * @param {() => void} props.onClose
 * @param {Function} props.t
 */
export default function LeadDeleteDialog({ leads, onDeleted, onClose, t }) {
  const list = Array.isArray(leads) ? leads.filter((l) => l && l.id) : [];
  const open = list.length > 0;
  const many = list.length > 1;
  const offerNotALead = list.some(looksLikeConversationLead);

  const [notALead, setNotALead] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const cancelRef = useRef(null);

  // A fresh dialog each time it opens: a box ticked for the last lead must
  // not ride along to the next one.
  const openKey = list.map((l) => l.id).join(",");
  useEffect(() => {
    setNotALead(false);
    setErr("");
    setBusy(false);
  }, [openKey]);

  async function confirm() {
    if (!open || busy) return;
    setBusy(true);
    setErr("");
    try {
      const wantsMark = offerNotALead && notALead;
      const res = many
        ? await fetch("/api/leads", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: list.map((l) => l.id), notALead: wantsMark }),
          })
        : await fetch(`/api/leads/${list[0].id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notALead: wantsMark }),
          });
      if (!res.ok) {
        await reportResponseError(res, setErr, t("app.leads.delete.error"));
        return;
      }
      const data = await res.json().catch(() => ({}));
      const deleted = Array.isArray(data.deleted) ? data.deleted : [];
      showToast({
        tone: "success",
        message:
          deleted.length === 1
            ? t("app.leads.delete.doneOne")
            : t("app.leads.delete.doneMany", { count: deleted.length }),
      });
      const missed = Array.isArray(data.noConversation) ? data.noConversation.length : 0;
      if (wantsMark && missed > 0) {
        showToast({ tone: "info", message: t("app.leads.delete.noConversation", { count: missed }) });
      }
      onDeleted(deleted);
    } catch {
      setErr(t("app.leads.delete.error"));
    } finally {
      setBusy(false);
    }
  }

  const titleId = "lead-delete-title";
  const bodyId = "lead-delete-body";

  return (
    <AlertDialog
      open={open}
      role="alertdialog"
      labelledBy={titleId}
      describedBy={bodyId}
      initialFocusRef={cancelRef}
      onEscape={busy ? undefined : onClose}
      onScrim={busy ? undefined : onClose}
      scrimLabel={t("app.action.cancel", "Cancel")}
    >
      <h2 id={titleId} className="text-base font-semibold text-foreground break-words">
        {many
          ? t("app.leads.delete.titleMany", { count: list.length })
          : t("app.leads.delete.titleOne", { name: list[0]?.name || "" })}
      </h2>
      <div id={bodyId} className="space-y-2 text-sm text-muted-foreground">
        <p>{t("app.leads.delete.body")}</p>
        <p>{t("app.leads.delete.keeps")}</p>
        <p>{t("app.leads.delete.counts")}</p>
      </div>

      {many && (
        <ul className="max-h-32 overflow-y-auto rounded-lg border border-border px-3 py-2 text-sm text-foreground space-y-0.5">
          {list.map((l) => (
            <li key={l.id} className="truncate">{l.name}</li>
          ))}
        </ul>
      )}

      {offerNotALead && (
        <label className="flex items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={notALead}
            onChange={(e) => setNotALead(e.target.checked)}
            disabled={busy}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span className="text-sm">
            <span className="block font-medium text-foreground">
              {many ? t("app.leads.delete.notALeadMany") : t("app.leads.delete.notALead")}
            </span>
            <span className="block text-xs text-muted-foreground mt-0.5">{t("app.leads.delete.notALeadHint")}</span>
          </span>
        </label>
      )}

      {err && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {err}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
        <button
          ref={cancelRef}
          type="button"
          onClick={onClose}
          disabled={busy}
          className="min-h-[44px] px-4 rounded-lg border border-border text-sm font-semibold text-foreground disabled:opacity-50"
        >
          {t("app.action.cancel", "Cancel")}
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="min-h-[44px] px-4 rounded-lg bg-red-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
          {busy
            ? t("app.leads.delete.deleting")
            : many
              ? t("app.leads.delete.confirmMany", { count: list.length })
              : t("app.leads.delete.confirmOne")}
        </button>
      </div>
    </AlertDialog>
  );
}
