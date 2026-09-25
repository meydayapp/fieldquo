"use client";

// app/components/jobs/ChangeOrders.js
//
// Scope changes agreed after the client accepted the quote — "add this while
// you're here," a fixture swap, something discovered mid-job that changes the
// price. See prisma/schema.prisma's ChangeOrder model and
// docs/CALLBACKS-AND-CHANGE-ORDERS.md for why this is a deliberate log a
// person writes, never inferred from a quote or invoice edit.
//
// Still no edit or delete. A change order is a record of something agreed with
// the client — correcting a mistake gets a new entry that says so, not a
// rewritten history. What CAN change is its status, and only until it has
// been billed; see the PATCH route's own header.
//
// ── Two doors out of the form ──────────────────────────────────────────────
//
// "Send for approval" texts and emails the homeowner a link to the one-page
// addendum (app/co/[token]) to approve and sign; the row shows "Waiting on
// client approval" until they do, then "Approved · <time>" with their name.
// The staff-side "Has the client agreed?" question goes away on that path —
// the client's signature IS the agreement, and the PATCH route refuses a
// staff "Mark agreed" on a change order that is out for signature.
//
// "Save without sending" keeps the original path — a change agreed in
// person, marked agreed (or pending) by staff — so nothing that worked before
// stops working. An approved change order, by either door, adds or edits its
// step on the job plan (lib/jobs/changeOrderDecision.js) and is put on the
// draft invoice from here, as a labelled line.

import { useCallback, useEffect, useState } from "react";
import { Plus, FileEdit, Check, X, Undo2, FileText, AlertTriangle, Send, Loader2, Bold, Italic, List, Link2, Clock, PenLine } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useHasLevel, useHasToggle } from "@/app/providers/PermissionProvider";
import { reportResponseError } from "@/lib/clientErrors";
import { changeOrderStatus, changeOrderSummary } from "@/lib/jobs/changeOrderValue";
import { useCompanyMoney, useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import MediaUploader from "@/app/components/MediaUploader";

// `signed` takes the formatter rather than closing over a module-level one —
// the /app layout resolves the company's currency once (CompanyPreferencesProvider),
// and a change order is a number the CLIENT signs off: "+$450.00" on work
// priced in pounds is not a cosmetic slip.
const signed = (v, money) => `${Number(v) > 0 ? "+" : ""}${money(v)}`;

export default function ChangeOrders({ jobId, changeOrders, onChanged }) {
  const money = useCompanyMoney();
  const { formatDate, formatDateTime } = useCompanyPreferences();
  const { t } = useTranslation();
  // Two separate hook calls, combined afterward — `&&` between the calls
  // themselves would make the second one conditional, which breaks the rules
  // of hooks the moment the first is false.
  const hasJobsEdit = useHasLevel("jobs", "view_create_edit");
  const hasShowPricing = useHasToggle("showPricing");
  const canLog = hasJobsEdit && hasShowPricing;

  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [billing, setBilling] = useState(null);
  const [confirmBill, setConfirmBill] = useState(false);
  const [targets, setTargets] = useState(null);

  const orders = Array.isArray(changeOrders) ? changeOrders : [];
  const summary = changeOrderSummary(orders);

  // What would happen if the bill button were pressed, answered by the server
  // rather than guessed here — the screen must not offer an action the route
  // will refuse. 403 is the ordinary answer for someone without showPricing.
  const loadBilling = useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}/change-orders/bill`);
      setBilling(res.ok ? await res.json() : null);
    } catch {
      setBilling(null);
    }
  }, [jobId]);

  useEffect(() => {
    loadBilling();
  }, [loadBilling, orders.length, summary.unbilledTotal, summary.approvedTotal]);

  // The lines and steps a change order can be raised against — the plan
  // route already lists both. Loaded when the form opens, not on every job
  // page render.
  useEffect(() => {
    if (!adding || targets || !jobId) return;
    let live = true;
    fetch(`/api/jobs/${jobId}/plan`)
      .then((r) => (r.ok ? r.json() : null))
      .then((plan) => {
        if (!live) return;
        const steps = (plan?.steps || []).filter((s) => s.status !== "cancelled");
        setTargets({
          lines: steps.filter((s) => s.quoteLineKey && !s.quoteLineKey.startsWith("addon:")).map((s) => ({ key: s.quoteLineKey, label: s.title, lineNo: s.quoteLineNo })),
          steps: steps.map((s) => ({ id: s.id, label: s.title })),
        });
      })
      .catch(() => live && setTargets({ lines: [], steps: [] }));
    return () => {
      live = false;
    };
  }, [adding, targets, jobId]);

  async function refresh() {
    await onChanged?.();
    await loadBilling();
  }

  async function decide(co, status) {
    setError("");
    setBusyId(co.id);
    try {
      const res = await fetch(`/api/jobs/${jobId}/change-orders/${co.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const message = await reportResponseError(res, t("app.changeOrder.decideFailed", "Couldn't change that."));
        setError(message || t("app.changeOrder.decideFailed", "Couldn't change that."));
        return;
      }
      await refresh();
    } catch {
      setError(t("app.changeOrder.decideFailed", "Couldn't change that."));
    } finally {
      setBusyId(null);
    }
  }

  async function resend(co) {
    setError("");
    setNotice("");
    setBusyId(co.id);
    try {
      const res = await fetch(`/api/jobs/${jobId}/change-orders/${co.id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        setError(d?.error || t("app.changeOrder.sendFailed", "Couldn't send that."));
        return;
      }
      setNotice(t("app.changeOrder.sentNotice", "Sent by {via}.", { via: viaLabel(d?.sentVia, t) }));
      await refresh();
    } catch {
      setError(t("app.changeOrder.sendFailed", "Couldn't send that."));
    } finally {
      setBusyId(null);
    }
  }

  async function bill() {
    setError("");
    setBusyId("bill");
    try {
      const res = await fetch(`/api/jobs/${jobId}/change-orders/bill`, { method: "POST" });
      if (!res.ok) {
        const message = await reportResponseError(res, t("app.changeOrder.billFailed", "Couldn't add those to the invoice."));
        setError(message || t("app.changeOrder.billFailed", "Couldn't add those to the invoice."));
        return;
      }
      setConfirmBill(false);
      await refresh();
    } catch {
      setError(t("app.changeOrder.billFailed", "Couldn't add those to the invoice."));
    } finally {
      setBusyId(null);
    }
  }

  // Nothing recorded and nobody here can add one — an empty card with no
  // action on it is noise, the same rule JobCosting.js follows for a job with
  // no costs and no quote.
  if (orders.length === 0 && !canLog) return null;

  const invoiceLabel = billing?.invoice?.invoiceNumber || "";

  return (
    <div className="bg-card border border-border rounded-xl p-5" data-tour="job-change-orders">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <FileEdit size={15} className="text-muted-foreground" />
          {t("app.changeOrder.title", "Change orders")}
        </h2>
        {canLog && !adding && (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 border border-border text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-muted">
            <Plus size={13} />
            {t("app.changeOrder.new", "New change order")}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">{error}</div>
      )}
      {notice && (
        <div className="mb-3 text-sm text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg px-3 py-2">{notice}</div>
      )}

      {/* Agreed and not-yet-agreed money, kept apart. A blended total would
          state that a change nobody has said yes to is part of the job. */}
      {orders.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span className="text-muted-foreground">
            {t("app.changeOrder.approvedTotal", "Agreed changes")}: <span className="font-semibold text-foreground tabular-nums">{signed(summary.approvedTotal, money)}</span>
          </span>
          {summary.pendingTotal !== 0 && (
            <span className="text-muted-foreground">
              {t("app.changeOrder.pendingTotal", "Awaiting agreement")}: <span className="font-semibold text-foreground tabular-nums">{signed(summary.pendingTotal, money)}</span>
            </span>
          )}
        </div>
      )}

      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("app.changeOrder.none", "None logged. Use this once the client has agreed to a change in scope — never for an ordinary edit to the quote or invoice.")}
        </p>
      ) : (
        <div className="divide-y divide-border">
          {orders.map((co) => {
            const status = changeOrderStatus(co);
            const against = co.task?.title
              ? t("app.changeOrder.againstTask", "Against step: {title}", { title: co.task.title })
              : co.originalLine?.description
                ? t("app.changeOrder.againstLine", "Against line: {title}", { title: co.originalLine.description })
                : null;
            const facts = [against, co.createdBy?.name || t("app.changeOrder.unknownAuthor", "Someone"), formatDate(co.createdAt)].filter(Boolean).join(" · ");
            const extras = [
              Number.isInteger(co.scheduleDeltaDays) && co.scheduleDeltaDays !== 0 ? t("app.changeOrder.scheduleShort", "Schedule {days}", { days: `${co.scheduleDeltaDays > 0 ? "+" : ""}${co.scheduleDeltaDays} ${t("app.changeOrder.daysUnit", "d")}` }) : null,
              co.photos?.length ? t("app.changeOrder.photoCount", "{count} photo(s)", { count: co.photos.length }) : null,
            ].filter(Boolean);
            return (
              <div key={co.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">
                      <b>{co.label}</b> · {co.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{facts}</p>
                    {extras.length > 0 && <p className="text-xs text-muted-foreground mt-0.5">{extras.join(" · ")}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`tabular-nums text-sm font-semibold ${status !== "approved" ? "text-muted-foreground" : Number(co.priceDelta) < 0 ? "text-red-600 dark:text-red-400" : "text-foreground"} ${status === "rejected" ? "line-through" : ""}`}>
                      {signed(co.priceDelta, money)}
                    </span>
                    <div className="text-xs mt-0.5">
                      {status === "approved" && (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                          <Check size={11} />
                          {t("app.changeOrder.approvedAt", "Approved · {when}", { when: co.decidedAt ? formatDateTime(co.decidedAt) : "" })}
                        </span>
                      )}
                      {status === "approved" && (co.signedBy || co.invoiceId || co.decidedBy?.name) && (
                        <div className="text-muted-foreground">
                          {co.signedBy
                            ? t("app.changeOrder.signedBy", "Signed {name}", { name: co.signedBy })
                            : co.decidedBy?.name
                              ? t("app.changeOrder.markedBy", "Marked agreed by {name}", { name: co.decidedBy.name })
                              : ""}
                          {co.invoiceId ? ` · ${t("app.changeOrder.onInvoice", "on {invoice}", { invoice: co.invoice?.invoiceNumber || "—" })}` : ""}
                        </div>
                      )}
                      {status === "approved" && !co.invoiceId && <div className="text-amber-700 dark:text-amber-400">{t("app.changeOrder.unbilled", "Not yet invoiced")}</div>}
                      {status === "waiting_client" && (
                        <>
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">
                            <Clock size={11} />
                            {t("app.changeOrder.waitingClient", "Waiting on client approval")}
                          </span>
                          <div className="text-muted-foreground">
                            {co.sentAt ? t("app.changeOrder.sentAt", "Sent by {via} {when}", { via: viaLabel(co.sentVia, t), when: formatDateTime(co.sentAt) }) : ""}
                            {co.viewedAt ? ` · ${t("app.changeOrder.viewed", "opened")}` : ""}
                            {canLog && (
                              <>
                                {" · "}
                                <button type="button" disabled={busyId === co.id} onClick={() => resend(co)} className="underline underline-offset-2 hover:text-foreground disabled:opacity-60">
                                  {t("app.changeOrder.resend", "Resend")}
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                      {status === "pending" && <span className="text-muted-foreground">{t("app.changeOrder.statusPending", "Not yet agreed — affects nothing")}</span>}
                      {status === "rejected" && <span className="text-muted-foreground">{t("app.changeOrder.statusRejected", "Rejected — affects nothing")}</span>}
                      {status === "unrecognised" && <span className="text-muted-foreground">{t("app.changeOrder.statusUnknown", "Unknown status — affects nothing")}</span>}
                    </div>
                  </div>
                </div>

                {/* A billed change order has no controls: its money is on a
                    document. A change order out for signature has no "Mark
                    agreed" — the signature is the agreement. */}
                {canLog && !co.invoiceId && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {status === "pending" && (
                      <>
                        <button type="button" disabled={busyId === co.id} onClick={() => resend(co)} className="inline-flex items-center gap-1 border border-border text-xs font-semibold px-2.5 py-1 rounded-md hover:bg-muted disabled:opacity-60">
                          <Send size={12} />
                          {t("app.changeOrder.sendForApproval", "Send for approval")}
                        </button>
                        <button type="button" disabled={busyId === co.id} onClick={() => decide(co, "approved")} className="inline-flex items-center gap-1 border border-border text-xs font-semibold px-2.5 py-1 rounded-md hover:bg-muted disabled:opacity-60">
                          <Check size={12} />
                          {t("app.changeOrder.approve", "Mark agreed")}
                        </button>
                      </>
                    )}
                    {status === "rejected" && (
                      <button type="button" disabled={busyId === co.id} onClick={() => decide(co, "approved")} className="inline-flex items-center gap-1 border border-border text-xs font-semibold px-2.5 py-1 rounded-md hover:bg-muted disabled:opacity-60">
                        <Check size={12} />
                        {t("app.changeOrder.approve", "Mark agreed")}
                      </button>
                    )}
                    {status !== "rejected" && (
                      <button type="button" disabled={busyId === co.id} onClick={() => decide(co, "rejected")} className="inline-flex items-center gap-1 border border-border text-xs font-semibold px-2.5 py-1 rounded-md hover:bg-muted disabled:opacity-60">
                        <X size={12} />
                        {status === "waiting_client" ? t("app.changeOrder.withdraw", "Withdraw") : t("app.changeOrder.reject", "Reject")}
                      </button>
                    )}
                    {status !== "pending" && (
                      <button type="button" disabled={busyId === co.id} onClick={() => decide(co, "pending")} className="inline-flex items-center gap-1 border border-border text-xs font-semibold px-2.5 py-1 rounded-md hover:bg-muted disabled:opacity-60">
                        <Undo2 size={12} />
                        {t("app.changeOrder.reopen", "Back to pending")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Agreed work that nobody has billed ─────────────────────────────
          Loud on purpose: "explicit" billing is only safer than automatic
          billing if the contractor is actually told there is something to bill. */}
      {billing && billing.unbilled?.count > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {t("app.changeOrder.billTitle", "{amount} of agreed changes isn't on an invoice yet", { amount: signed(billing.unbilled.total, money) })}
              </p>
              {billing.canBill && canLog && !confirmBill && (
                <button type="button" onClick={() => setConfirmBill(true)} className="mt-2 inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground text-sm font-semibold px-3 py-1.5 rounded-lg">
                  <FileText size={13} />
                  {t("app.changeOrder.bill", "Add to {invoice}", { invoice: invoiceLabel })}
                </button>
              )}
              {billing.canBill && canLog && confirmBill && (
                <div className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <p className="text-sm text-foreground">
                    {t("app.changeOrder.billConfirm", "Add {amount} to {invoice}? Its total becomes {total}.", {
                      amount: signed(billing.preview?.added, money),
                      invoice: invoiceLabel,
                      total: money(billing.preview?.newTotal),
                    })}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={busyId === "bill"} onClick={bill} className="bg-inverted text-inverted-foreground text-sm font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60">
                      {busyId === "bill" ? t("app.changeOrder.billing", "Adding…") : t("app.action.confirm", "Confirm")}
                    </button>
                    <button type="button" onClick={() => setConfirmBill(false)} className="border border-border text-foreground text-sm font-semibold px-3 py-1.5 rounded-lg">
                      {t("app.action.cancel")}
                    </button>
                  </div>
                </div>
              )}
              {!billing.canBill && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {billing.reason === "no_invoice" && t("app.changeOrder.reasonNoInvoice", "There's no invoice on this job yet. These become billable once one is raised.")}
                  {billing.reason === "invoice_sent" && t("app.changeOrder.reasonInvoiceSent", "{invoice} has already been sent, so FieldQuo won't change it on its own. Amend it from the invoice page to bill these.", { invoice: invoiceLabel })}
                  {billing.reason === "tax_rate_underivable" && t("app.changeOrder.reasonTaxRate", "{invoice} charges tax but has nothing to work the rate out from, so these can't be added automatically. Add them on the invoice itself.", { invoice: invoiceLabel })}
                  {billing.reason === "already_on_invoice" && t("app.changeOrder.reasonAlreadyOn", "These are already on {invoice}.", { invoice: invoiceLabel })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {adding && (
        <ChangeOrderForm
          t={t}
          money={money}
          jobId={jobId}
          targets={targets}
          onCancel={() => setAdding(false)}
          onSaved={async (d) => {
            setAdding(false);
            setTargets(null);
            if (d?.sent) {
              if (d.sent.ok) setNotice(t("app.changeOrder.sentNotice", "Sent by {via}.", { via: viaLabel(d.sent.sentVia, t) }));
              else setError(t("app.changeOrder.savedNotSent", "Saved, but not sent: {reasons}", { reasons: (d.sent.errors || []).join(" ") }));
            }
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function viaLabel(sentVia, t) {
  const v = String(sentVia || "");
  if (v.includes("sms") && v.includes("email")) return t("app.changeOrder.viaBoth", "SMS and email");
  if (v.includes("sms")) return t("app.changeOrder.viaSms", "SMS");
  return t("app.changeOrder.viaEmail", "email");
}

// ── The form ───────────────────────────────────────────────────────────────
//
// A contentEditable box with four commands (bold, italic, list, link) rather
// than an editor library: the body is sanitised server-side to exactly that
// vocabulary (lib/jobs/changeOrderAddendum.js), so anything a richer editor
// produced would be stripped anyway. execCommand is deprecated and still what
// every browser ships for this — the day it goes, so does the toolbar, not
// the field.
function ChangeOrderForm({ t, money, targets, onCancel, onSaved, jobId }) {
  const [description, setDescription] = useState("");
  const [priceDelta, setPriceDelta] = useState("");
  const [scheduleDeltaDays, setScheduleDeltaDays] = useState("");
  const [target, setTarget] = useState("");
  const [photos, setPhotos] = useState([]);
  const [agreed, setAgreed] = useState(true);
  const [sms, setSms] = useState(true);
  const [email, setEmail] = useState(true);
  const [saving, setSaving] = useState("");
  const [formError, setFormError] = useState("");
  const [bodyEl, setBodyEl] = useState(null);

  const delta = Number(priceDelta);
  const valid = description.trim() && Number.isFinite(delta) && priceDelta !== "";

  function cmd(name, arg) {
    try {
      document.execCommand(name, false, arg);
    } catch {
      /* the toolbar is a convenience; the field keeps working */
    }
    bodyEl?.focus();
  }

  async function submit(send) {
    setFormError("");
    if (!description.trim()) {
      setFormError(t("app.changeOrder.descriptionRequired", "Describe what changed."));
      return;
    }
    if (!Number.isFinite(delta) || priceDelta === "") {
      setFormError(t("app.changeOrder.priceRequired", "Enter the effect on price — 0 if none."));
      return;
    }
    if (send && !sms && !email) {
      setFormError(t("app.changeOrder.pickChannel", "Pick SMS, email or both."));
      return;
    }
    setSaving(send ? "send" : "save");
    try {
      const [kind, id] = target ? target.split("|") : [null, null];
      const res = await fetch(`/api/jobs/${jobId}/change-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          bodyHtml: bodyEl?.innerHTML || "",
          priceDelta: delta,
          scheduleDeltaDays: scheduleDeltaDays === "" ? null : Number(scheduleDeltaDays),
          photos: photos.map((p) => p.url),
          ...(kind === "line" ? { quoteLineKey: id } : {}),
          ...(kind === "task" ? { taskId: id } : {}),
          ...(send ? { send: true, channels: { sms, email } } : { status: agreed ? "approved" : "pending" }),
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        setFormError(d?.error || t("app.changeOrder.saveFailed", "Couldn't log that."));
        return;
      }
      await onSaved(d);
    } catch {
      setFormError(t("app.changeOrder.saveFailed", "Couldn't log that."));
    } finally {
      setSaving("");
    }
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="mt-4 pt-4 border-t border-border space-y-3">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{t("app.changeOrder.changes", "Changes")}</label>
        <select value={target} onChange={(e) => setTarget(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card">
          <option value="">{t("app.changeOrder.targetNone", "Not against a particular line or step")}</option>
          {targets?.lines?.length > 0 && (
            <optgroup label={t("app.changeOrder.targetLines", "Quote lines")}>
              {targets.lines.map((l) => (
                <option key={l.key} value={`line|${l.key}`}>
                  {l.lineNo ? `${t("app.jobPlan.lineN", "Line {n}", { n: l.lineNo })} · ` : ""}
                  {l.label}
                </option>
              ))}
            </optgroup>
          )}
          {targets?.steps?.length > 0 && (
            <optgroup label={t("app.changeOrder.targetSteps", "Plan steps")}>
              {targets.steps.map((s) => (
                <option key={s.id} value={`task|${s.id}`}>
                  {s.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {targets && !targets.lines.length && !targets.steps.length && (
          <p className="text-xs text-muted-foreground mt-1">{t("app.changeOrder.noTargets", "This job has no plan steps yet, so the change stands on its own.")}</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{t("app.changeOrder.whatChanged", "What changed")}</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("app.changeOrder.whatChangedPlaceholder", "Client asked to add a subpanel while the wall was open")} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card" />
        <div className="mt-2 border border-border rounded-lg overflow-hidden bg-card">
          <div className="flex gap-1 px-2 py-1 border-b border-border bg-muted/40">
            <button type="button" aria-label={t("app.changeOrder.bold", "Bold")} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("bold")} className="p-1 rounded hover:bg-muted">
              <Bold size={13} />
            </button>
            <button type="button" aria-label={t("app.changeOrder.italic", "Italic")} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("italic")} className="p-1 rounded hover:bg-muted">
              <Italic size={13} />
            </button>
            <button type="button" aria-label={t("app.changeOrder.list", "List")} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("insertUnorderedList")} className="p-1 rounded hover:bg-muted">
              <List size={13} />
            </button>
            <button
              type="button"
              aria-label={t("app.changeOrder.link", "Link")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const url = window.prompt(t("app.changeOrder.linkPrompt", "Link address (https://…)"));
                if (url && /^https?:\/\//i.test(url)) cmd("createLink", url);
              }}
              className="p-1 rounded hover:bg-muted"
            >
              <Link2 size={13} />
            </button>
          </div>
          <div
            ref={setBodyEl}
            contentEditable
            suppressContentEditableWarning
            data-placeholder={t("app.changeOrder.bodyPlaceholder", "The detail the client should read before signing — what you found, what it takes now.")}
            className="min-h-[72px] px-3 py-2 text-sm text-foreground outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_a]:underline empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t("app.changeOrder.priceChange", "Price change")}</label>
          <input type="number" step="0.01" value={priceDelta} onChange={(e) => setPriceDelta(e.target.value)} placeholder="0.00" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card" />
          <p className="text-xs text-muted-foreground mt-1">
            {t("app.changeOrder.priceEffectHint", "Positive adds to what the client owes; negative credits them.")}
            {priceDelta !== "" && Number.isFinite(delta) ? ` ${t("app.changeOrder.taxNote", "Tax is added at the quote's rate on the addendum: {amount} before tax.", { amount: signed(delta, money) })}` : ""}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t("app.changeOrder.scheduleImpact", "Schedule impact")}</label>
          <div className="flex items-center gap-2">
            <input type="number" step="1" value={scheduleDeltaDays} onChange={(e) => setScheduleDeltaDays(e.target.value)} placeholder="0" className="w-24 border border-border rounded-lg px-3 py-2 text-sm bg-card" />
            <span className="text-sm text-muted-foreground">{t("app.changeOrder.daysLabel", "days — the finish moves by this much when approved")}</span>
          </div>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{t("app.changeOrder.photo", "Photo")}</label>
        <div className="flex gap-2 items-start flex-wrap">
          {photos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.url} src={p.url} alt="" className="w-20 h-14 object-cover rounded-lg border border-border" />
          ))}
          <MediaUploader uploadUrl="/api/upload" purpose="jobs" value={photos} max={6} label={t("app.changeOrder.addPhoto", "Add photo")} hint="" onChange={(next) => setPhotos((next || []).filter((m) => m?.url && m.kind === "photo"))} />
        </div>
      </div>

      <fieldset className="text-sm">
        <legend className="block text-sm font-medium text-foreground mb-1">{t("app.changeOrder.sendVia", "Send for approval by")}</legend>
        <label className="inline-flex items-center gap-2 mr-4">
          <input type="checkbox" checked={sms} onChange={(e) => setSms(e.target.checked)} /> {t("app.changeOrder.viaSms", "SMS")}
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} /> {t("app.changeOrder.viaEmail", "email")}
        </label>
      </fieldset>

      {/* The staff-side question only applies when nothing is sent — a
          change agreed in person. Sending replaces it with the signature. */}
      <fieldset>
        <legend className="block text-sm font-medium text-foreground mb-1">{t("app.changeOrder.agreedLabel", "Has the client agreed to this?")}</legend>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="radio" name="co-agreed" checked={agreed} onChange={() => setAgreed(true)} />
          {t("app.changeOrder.agreedYes", "Yes — count it toward this job's contract value")}
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground mt-1">
          <input type="radio" name="co-agreed" checked={!agreed} onChange={() => setAgreed(false)} />
          {t("app.changeOrder.agreedNo", "Not yet — record it, and change nothing until it is")}
        </label>
        <p className="text-xs text-muted-foreground mt-1">{t("app.changeOrder.agreedNote", "Only for \"Save without sending\". When you send it, the client's signature is the agreement.")}</p>
      </fieldset>

      {formError && <p className="text-sm text-red-700 dark:text-red-300">{formError}</p>}

      <div className="flex gap-2 flex-wrap items-center">
        <button type="button" disabled={Boolean(saving) || !valid} onClick={() => submit(true)} className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60">
          {saving === "send" ? <Loader2 size={13} className="animate-spin" /> : <PenLine size={13} />}
          {t("app.changeOrder.sendForApproval", "Send for approval")}
        </button>
        <button type="button" disabled={Boolean(saving) || !valid} onClick={() => submit(false)} className="border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60">
          {saving === "save" ? t("app.changeOrder.saving", "Saving…") : t("app.changeOrder.saveWithoutSending", "Save without sending")}
        </button>
        <button type="button" onClick={onCancel} className="text-sm font-semibold px-2 py-2 text-muted-foreground">
          {t("app.action.cancel")}
        </button>
        <span className="text-xs text-muted-foreground">{t("app.changeOrder.sendNote", "The client gets a link; nothing changes on the job or invoice until they sign.")}</span>
      </div>
    </form>
  );
}
