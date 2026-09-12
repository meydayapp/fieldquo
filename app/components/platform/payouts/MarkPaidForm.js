"use client";

// app/components/platform/payouts/MarkPaidForm.js
//
// The "Mark paid" form — and, on a batch already paid, the "Add proof" form,
// which is the same form with a different verb. ONE component, mounted on
// /platform/sales/payouts and inside a rep's card on /platform/sales/reps,
// posting to the one route that flips a batch to paid. Two copies of a form
// that moves FieldQuo's money is AGENTS.md failure class #4 with a cost.
//
// ══ What it insists on, and why it is said on the form ═════════════════════
//
// A file or a reference. lib/sales/payoutProof.js refuses without one and
// says why in proofProblem(); the button is disabled on the same rule so the
// refusal is read before the click, not after. The rep sees the receipt link
// and the reference on their own Pay screen, so the form says so: whoever is
// filling it in should know the rep is the audience.
//
// ══ Superadmin only ═══════════════════════════════════════════════════════
//
// Rendered only when the route said `canMarkPaid`; the route and
// markBatchPaid refuse anyone else anyway. Hiding the form is a courtesy,
// not the control.
import { useRef, useState } from "react";
import { Loader2, Paperclip, Send } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { classifyProofFile, proofProblem } from "@/lib/sales/payoutProofRules";

const FIELD =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";
const LABEL = "block text-xs font-medium text-foreground mb-1";
const BTN =
  "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50";

/**
 * @param batch    { id, status, paymentReference, proofUrl, paidVia, paymentNote, cents }
 * @param onDone   called with the route's answer after a successful save.
 * @param onCancel optional — draws a Cancel button when given.
 */
export default function MarkPaidForm({ batch, onDone, onCancel = null }) {
  const alreadyPaid = batch?.status === "paid";
  const [file, setFile] = useState(null);
  const [fileProblem, setFileProblem] = useState("");
  const [paidVia, setPaidVia] = useState(batch?.paidVia || "");
  const [reference, setReference] = useState(batch?.paymentReference || "");
  const [note, setNote] = useState(batch?.paymentNote || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef(null);

  // The same rule the server applies, evaluated here so the button says
  // "not yet" before the round trip. `existing` lets a batch that already
  // holds a receipt take a reference edit without a second upload.
  const problem = proofProblem({
    hasFile: Boolean(file),
    paymentReference: reference.trim() || null,
    existing: batch,
  });

  function pick(e) {
    const f = e.target.files?.[0] || null;
    setFileProblem("");
    if (!f) {
      setFile(null);
      return;
    }
    const verdict = classifyProofFile(f);
    if (!verdict.ok) {
      setFile(null);
      setFileProblem(verdict.error);
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setFile(f);
  }

  async function submit(e) {
    e.preventDefault();
    if (problem || busy) return;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      if (file) body.append("proof", file, file.name);
      body.append("paidVia", paidVia);
      body.append("paymentReference", reference);
      body.append("paymentNote", note);
      const answer = await fetchJson(`/api/platform/sales/payouts/${encodeURIComponent(batch.id)}/paid`, {
        method: "POST",
        body,
      });
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      onDone?.(answer);
    } catch (err) {
      setError(err.message || "Couldn’t save that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" data-mark-paid-form data-batch-id={batch?.id}>
      <p className="text-xs text-muted-foreground">
        {alreadyPaid
          ? "Add or update the proof on this batch. Nothing here is removed — a later save replaces a field, it never blanks one."
          : "Attach what you sent and how. The rep sees the receipt link, the reference and the note on their own Pay screen — that is the point of asking."}
      </p>

      <div>
        <label htmlFor={`proof-${batch.id}`} className={LABEL}>
          Receipt or transfer screenshot <span className="text-muted-foreground">(image or PDF)</span>
        </label>
        <input
          id={`proof-${batch.id}`}
          ref={fileInput}
          type="file"
          accept="image/*,application/pdf"
          onChange={pick}
          className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-2 file:py-1 file:text-xs"
          data-proof-file
        />
        {file ? (
          <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
            <Paperclip size={11} /> {file.name}
          </p>
        ) : null}
        {fileProblem ? <p className="mt-1 text-xs text-red-700 dark:text-red-300">{fileProblem}</p> : null}
        {batch?.proofUrl && !file ? (
          <p className="mt-1 text-xs text-muted-foreground">
            A receipt is already on file ({batch.proofFilename || "receipt"}). Attaching another replaces the link.
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`via-${batch.id}`} className={LABEL}>
            Paid via
          </label>
          <input
            id={`via-${batch.id}`}
            className={FIELD}
            value={paidVia}
            onChange={(e) => setPaidVia(e.target.value)}
            placeholder="Wise, Interac, Upwork…"
            maxLength={60}
            data-paid-via
          />
        </div>
        <div>
          <label htmlFor={`ref-${batch.id}`} className={LABEL}>
            Payment reference
          </label>
          <input
            id={`ref-${batch.id}`}
            className={FIELD}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Transfer id, e-Transfer reference…"
            maxLength={120}
            data-payment-reference
          />
        </div>
      </div>

      <div>
        <label htmlFor={`note-${batch.id}`} className={LABEL}>
          Note <span className="text-muted-foreground">(the rep sees this)</span>
        </label>
        <textarea
          id={`note-${batch.id}`}
          className={`${FIELD} min-h-[60px]`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={600}
          placeholder="Sent minus the Wise fee; the rest follows Monday."
          data-payment-note
        />
      </div>

      {problem ? (
        <p className="text-xs text-amber-800 dark:text-amber-300" data-proof-problem>
          {problem}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-red-700 dark:text-red-300" data-mark-paid-error>
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy || Boolean(problem)}
          className={`${BTN} bg-inverted text-inverted-foreground`}
          data-mark-paid-submit
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          {alreadyPaid ? "Save proof" : "Mark paid"}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} disabled={busy} className={`${BTN} border border-border text-foreground`}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
