// app/components/leads/LeadLinkedDocuments.js
//
// The lead drawer's "Linked documents" block and the quote picker behind it —
// the owner's ask of 2026-09-24: "leads should be able to see the jobs,
// invoice, quotes linked to it", and a way back to Won for a lead whose win
// was recorded on a quote nobody had linked.
//
// Three pieces, one file because they share the same two endpoints:
//
//   LinkedDocuments   the block: the linked quote, its jobs, its invoices
//                     (GET /api/leads/[id]/documents — each section on its
//                     own permission dial, money on the pricing toggle), plus
//                     "Create quote from this lead" (the existing convert
//                     path), "Link an existing quote" and "Unlink".
//   QuoteLinkPicker   the search (GET/POST /api/leads/[id]/quote-link). In
//                     "won" mode it is "Link the quote that won it": linking
//                     and moving to Won in one request, the move still decided
//                     by the server's Won rule.
//   WonBlockedNote    the sentence under the status buttons saying exactly
//                     why Won is refused, with the next step as a button —
//                     never a greyed-out Won with no way forward.
//
// The Won rule itself lives in lib/leads/pipeline.js and is not re-derived
// here; wonReasonText only translates its `code`.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Briefcase,
  Receipt,
  Link2,
  Unlink,
  Loader2,
  Search,
  X,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { quoteStatusLabel, quoteStatusClasses } from "@/lib/quotes/statusLabels";
import { jobStatusLabel, jobStatusClasses } from "@/lib/jobs/statusLabels";
import { invoiceStatusClasses, invoiceStatusPresentation } from "@/lib/invoices/statusPresentation";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";

const WON_CODES = new Set(["no_quote", "quote_declined", "quote_not_approved", "quote_unverified"]);

/**
 * The Won rule's refusal in the reader's language. The server's English
 * `reason` is the fallback for a code this catalogue has never heard of.
 */
export function wonReasonText(check, t) {
  if (!check || check.ok) return "";
  if (WON_CODES.has(check.code)) {
    return t(`app.leads.won.${check.code}`, { number: check.quoteNumber || "" });
  }
  return check.reason || "";
}

/** The codes a linked quote could fix. `quote_unverified` is a reload. */
function linkFixes(code) {
  return code === "no_quote" || code === "quote_declined" || code === "quote_not_approved";
}

const BTN =
  "inline-flex items-center justify-center gap-1.5 min-h-[36px] px-3 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50";

function invoiceLabel(status, t) {
  const key = invoiceStatusPresentation(status).labelKey;
  return key ? t(key) : String(status || "").replace(/_/g, " ");
}

/**
 * Under the status buttons, when Won is refused.
 *
 * @param check     canSetLeadStatus(lead, "converted") — the same call the
 *                  button's disabled state uses
 * @param lead      needs quote { id, quoteNumber } for "Open quote"
 * @param canEdit   requests:view_create_edit — linking is a write
 * @param canQuotes quotes:view_only — the picker and the quote page
 */
export function WonBlockedNote({ check, lead, canEdit, canQuotes, onLinkWinning, t }) {
  if (!check || check.ok) return null;
  return (
    <div className="mt-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
      <p className="text-xs text-amber-900 dark:text-amber-200">{wonReasonText(check, t)}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {canEdit && canQuotes && linkFixes(check.code) && (
          <button type="button" onClick={onLinkWinning} className={BTN}>
            <Link2 size={13} aria-hidden="true" />
            {t("app.leads.won.linkWinning", "Link the quote that won it")}
          </button>
        )}
        {check.code === "quote_not_approved" && canQuotes && lead?.quote?.id && (
          <Link href={`/app/quotes/${encodeURIComponent(lead.quote.id)}`} className={BTN}>
            <FileText size={13} aria-hidden="true" />
            {t("app.leads.won.openQuote", { number: lead.quote.quoteNumber || "" })}
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * The block. `reloadKey` changes whenever the parent linked, unlinked or
 * converted, so the documents are re-read rather than patched by hand.
 */
export function LinkedDocuments({
  leadId,
  lead,
  reloadKey,
  canEdit,
  canQuotes,
  canCreateQuotes,
  converting,
  onConvert,
  onOpenPicker,
  onUnlinked,
  t,
}) {
  const money = useCompanyMoney();
  const [docs, setDocs] = useState(null);
  const [failed, setFailed] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await fetch(`/api/leads/${leadId}/documents`);
      if (!res.ok) {
        await reportResponseError(res, t("app.leads.docs.loadError", "Couldn't load the linked documents."));
        setFailed(true);
        return;
      }
      setDocs(await res.json());
    } catch {
      setFailed(true);
    }
  }, [leadId, t]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  async function unlink() {
    setUnlinking(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/quote-link`, { method: "DELETE" });
      if (!res.ok) {
        await reportResponseError(res, t("app.leads.docs.unlinkError", "Couldn't unlink that quote."));
        return;
      }
      const d = await res.json();
      setConfirmUnlink(false);
      onUnlinked?.(d.lead);
    } finally {
      setUnlinking(false);
    }
  }

  const quote = docs?.quote || null;
  const hasQuote = Boolean(lead?.quote?.id || quote);

  return (
    <div className="rounded-xl border border-border p-3 space-y-3" data-tour="lead-linked-documents">
      <div className="text-xs font-semibold text-foreground">
        {t("app.leads.docs.title", "Linked documents")}
      </div>

      {failed ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {t("app.leads.docs.loadError", "Couldn't load the linked documents.")}
          </p>
          <button type="button" onClick={load} className={BTN}>
            {t("app.action.retry")}
          </button>
        </div>
      ) : !docs ? (
        <div className="h-10 rounded bg-accent animate-pulse" />
      ) : (
        <>
          {/* Quote */}
          <section>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
              {t("app.leads.docs.quote", "Quote")}
            </div>
            {!quote ? (
              <p className="text-xs text-muted-foreground">
                {t("app.leads.docs.noQuote", "No quote linked yet.")}
              </p>
            ) : quote.restricted ? (
              <p className="text-xs text-muted-foreground">
                {quote.quoteNumber} · {quoteStatusLabel(quote.status, t)} ·{" "}
                <span className="italic">{t("app.access.restricted", "Hidden by your access level")}</span>
              </p>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <Link
                  href={`/app/quotes/${encodeURIComponent(quote.id)}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground underline underline-offset-2 min-w-0"
                >
                  <FileText size={14} className="shrink-0" aria-hidden="true" />
                  <span className="truncate">{quote.quoteNumber}</span>
                </Link>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${quoteStatusClasses(quote.status)}`}>
                  {quoteStatusLabel(quote.status, t)}
                </span>
                {quote.total != null && (
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground shrink-0">{money(quote.total)}</span>
                )}
              </div>
            )}
            {quote && !quote.restricted && quote.client?.name && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{quote.client.name}</p>
            )}
          </section>

          {/* Jobs */}
          {quote && (
            <section>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                {t("app.leads.docs.jobs", "Jobs")}
              </div>
              {docs.jobs?.restricted ? (
                <p className="text-xs text-muted-foreground italic">{t("app.access.restricted", "Hidden by your access level")}</p>
              ) : !docs.jobs?.length ? (
                <p className="text-xs text-muted-foreground">
                  {t("app.leads.docs.noJobs", "No job yet — one is created when the quote is approved.")}
                </p>
              ) : (
                <ul className="space-y-1">
                  {docs.jobs.map((j) => (
                    <li key={j.id} className="flex items-center gap-2 min-w-0">
                      <Link
                        href={`/app/jobs/${encodeURIComponent(j.id)}`}
                        className="inline-flex items-center gap-1.5 text-sm text-foreground underline underline-offset-2 min-w-0"
                      >
                        <Briefcase size={13} className="shrink-0" aria-hidden="true" />
                        <span className="truncate">{j.title || t("app.leads.docs.untitledJob", "Job")}</span>
                      </Link>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${jobStatusClasses(j.status)}`}>
                        {jobStatusLabel(j.status, t)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Invoices */}
          {quote && (
            <section>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                {t("app.leads.docs.invoices", "Invoices")}
              </div>
              {docs.invoices?.restricted ? (
                <p className="text-xs text-muted-foreground italic">{t("app.access.restricted", "Hidden by your access level")}</p>
              ) : !docs.invoices?.length ? (
                <p className="text-xs text-muted-foreground">{t("app.leads.docs.noInvoices", "No invoice yet.")}</p>
              ) : (
                <ul className="space-y-1">
                  {docs.invoices.map((inv) => (
                    <li key={inv.id} className="flex items-center gap-2 min-w-0">
                      <Link
                        href={`/app/invoices/${encodeURIComponent(inv.id)}`}
                        className="inline-flex items-center gap-1.5 text-sm text-foreground underline underline-offset-2 min-w-0"
                      >
                        <Receipt size={13} className="shrink-0" aria-hidden="true" />
                        <span className="truncate">{inv.invoiceNumber}</span>
                      </Link>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${invoiceStatusClasses(inv.status)}`}>
                        {invoiceLabel(inv.status, t)}
                      </span>
                      {inv.amountDue != null && inv.amountDue > 0 && (
                        <span className="ml-auto text-xs tabular-nums text-muted-foreground shrink-0">
                          {t("app.leads.docs.due", { amount: money(inv.amountDue) })}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <SocialEvidence lead={lead} conversion={docs.conversion} money={money} t={t} />
        </>
      )}

      {/* The ways to get a quote onto this lead, or off it. */}
      <div className="flex flex-wrap gap-2 pt-1">
        {!hasQuote && canCreateQuotes && (
          <button
            type="button"
            onClick={onConvert}
            disabled={converting}
            className="inline-flex items-center justify-center gap-1.5 min-h-[36px] px-3 rounded-lg bg-inverted text-inverted-foreground text-xs font-semibold disabled:opacity-60"
          >
            {converting ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
            {converting ? t("app.leads.converting") : t("app.leads.docs.createQuote", "Create quote from this lead")}
          </button>
        )}
        {!hasQuote && canEdit && canQuotes && (
          <button type="button" onClick={() => onOpenPicker(false)} className={BTN}>
            <Link2 size={13} aria-hidden="true" />
            {t("app.leads.docs.linkExisting", "Link an existing quote")}
          </button>
        )}
        {hasQuote && canEdit && lead?.status !== "converted" && !confirmUnlink && (
          <button type="button" onClick={() => setConfirmUnlink(true)} className={BTN}>
            <Unlink size={13} aria-hidden="true" />
            {t("app.leads.docs.unlink", "Unlink quote")}
          </button>
        )}
      </div>
      {confirmUnlink && (
        <div className="rounded-lg bg-muted/50 border border-border p-2.5 space-y-2">
          <p className="text-xs text-foreground">
            {t("app.leads.docs.unlinkConfirm", {
              number: lead?.quote?.quoteNumber || quote?.quoteNumber || "",
            })}
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmUnlink(false)} className={BTN}>
              {t("app.action.cancel", "Cancel")}
            </button>
            <button type="button" onClick={unlink} disabled={unlinking} className={BTN}>
              {unlinking ? <Loader2 size={13} className="animate-spin" /> : <Unlink size={13} aria-hidden="true" />}
              {t("app.leads.docs.unlinkYes", "Unlink")}
            </button>
          </div>
        </div>
      )}
      {hasQuote && canEdit && lead?.status === "converted" && (
        <p className="text-[11px] text-muted-foreground">
          {t("app.leads.docs.unlinkWon", "To unlink this quote, move the lead out of Won first.")}
        </p>
      )}
    </div>
  );
}

// ── "From Facebook / Instagram / WhatsApp" ─────────────────────────────────
//
// Two halves, both read-only:
//
//   * What the conversation told us — lead.conversationEvidence, written by
//     lib/leads/conversationLead.js: each field with the customer's own words
//     it came from, and what was NOT written because a person had already
//     filled that field (kept, and shown).
//   * Did it convert — docs.conversion, from lib/attribution/conversionEvidence.js
//     via GET /api/leads/[id]/documents: confirmed (with what matched, on
//     which record) or possible (shown, never counted), or no match at all,
//     which is said as "not matched", never as "did not convert".
//
// Renders nothing for a lead with neither — every non-social lead.

const EVIDENCE_FIELDS = ["name", "phone", "email", "address", "area", "service", "timeline"];
const OUTCOME_KEYS = { won: "won", quoted: "quoted", lost: "lost", no_quote: "no_quote" };

const REASONS = new Set(["recorded_link", "name_similar", "phone", "email", "name", "address"]);
function reasonLabel(reason, t) {
  return REASONS.has(reason) ? t(`app.leads.social.reason.${reason}`) : reason;
}

function SocialEvidence({ lead, conversion, money, t }) {
  const ev = lead?.conversationEvidence && typeof lead.conversationEvidence === "object" ? lead.conversationEvidence : null;
  if (!ev && !conversion) return null;

  const platform = conversion?.platform || ev?.platform || null;
  const from = platform
    ? t(`app.messages.platform.${platform}`, platform)
    : lead?.source === "meta_lead_form"
      ? t("app.leads.source.meta_lead_form", "Facebook lead form")
      : null;
  const fields = ev?.fields || {};
  const shown = EVIDENCE_FIELDS.filter((f) => fields[f]?.value);

  const matched = (conversion?.matchedOn || []).map((r) =>
    r === "address" && (conversion.addressOn || []).some((a) => a === "quote" || a === "job")
      ? t("app.leads.social.reason.siteAddress", "job-site address")
      : reasonLabel(r, t),
  );

  const docsLine = (d) => {
    if (!d) return null;
    const parts = [];
    if (d.quote?.restricted) parts.push(t("app.access.restricted", "Hidden by your access level"));
    else if (d.quote) parts.push(t("app.leads.social.quoteRef", { number: d.quote.number || "" }));
    if (d.outcome && OUTCOME_KEYS[d.outcome]) parts.push(t(`app.leads.social.outcome.${d.outcome}`));
    const inv = d.invoices;
    if (inv?.restricted) parts.push(t("app.access.restricted", "Hidden by your access level"));
    else if (inv && inv.count) {
      const numbers = (inv.numbers || []).join(", ");
      if (inv.pricingHidden) parts.push(numbers);
      else if (inv.fullyPaid) parts.push(t("app.leads.social.invoicePaid", { numbers, amount: money(inv.paid) }));
      else parts.push(t("app.leads.social.invoicePartial", { numbers, paid: money(inv.paid || 0), total: inv.total == null ? "—" : money(inv.total) }));
    } else if (d.quote && d.outcome === "won") parts.push(t("app.leads.social.notInvoiced", "Not invoiced yet"));
    return parts.join(" · ");
  };

  return (
    <section className="rounded-lg border border-border p-2.5 space-y-2" data-social-evidence>
      {from && (
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {t("app.leads.social.fromPlatform", { platform: from })}
        </div>
      )}

      {ev && (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-foreground">{t("app.leads.social.told", "What the conversation told us")}</div>
          {ev.summary && (
            <p className="text-xs text-foreground">{t("app.leads.social.summary", { text: ev.summary })}</p>
          )}
          {shown.length > 0 && (
            <ul className="space-y-0.5">
              {shown.map((f) => {
                const e = fields[f];
                const value = f === "service" ? e.label || e.value : f === "timeline" ? null : e.value;
                const how =
                  e.method === "profile"
                    ? t("app.leads.social.methodProfile", "Facebook profile name")
                    : e.method === "whatsapp_number"
                      ? t("app.leads.social.methodWhatsapp", "WhatsApp number")
                      : e.quote
                        ? `“${e.quote}”`
                        : null;
                return (
                  <li key={f} className="text-xs text-muted-foreground">
                    <span className="text-foreground">{t(`app.leads.social.field.${f}`, f)}</span>
                    {value ? <>: <span className="text-foreground">{value}</span></> : null}
                    {how ? <> · <span className="italic">{how}</span></> : null}
                  </li>
                );
              })}
            </ul>
          )}
          {Number(ev.photos?.total) > 0 && (
            <p className="text-xs text-muted-foreground">{t("app.leads.social.photos", { count: ev.photos.total })}</p>
          )}
          {(ev.skipped || []).map((s) => (
            <p key={s.field} className="text-xs text-amber-800 dark:text-amber-300">
              {t("app.leads.social.kept", { field: t(`app.leads.social.field.${s.field}`, s.field), offered: String(s.offered), kept: String(s.kept) })}
            </p>
          ))}
          {ev.campaign?.adTitle && <p className="text-xs text-muted-foreground">{t("app.leads.social.ad", { ad: ev.campaign.adTitle })}</p>}
          {ev.campaign?.campaignName && (
            <p className="text-xs text-muted-foreground">{t("app.leads.social.campaign", { campaign: ev.campaign.campaignName })}</p>
          )}
          {Array.isArray(ev.joinedOn) && ev.joinedOn.includes("profile_name") && (
            <p className="text-xs text-amber-800 dark:text-amber-300">{t("app.leads.social.joinedProfile")}</p>
          )}
        </div>
      )}

      {conversion && (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-foreground">{t("app.leads.social.conversion", "Did it convert?")}</div>
          {conversion.status === "confirmed" && (
            <p className="text-xs text-foreground">
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 size={12} aria-hidden="true" />
                {t("app.leads.social.confirmed", "Confirmed")}
              </span>{" "}
              · {t("app.leads.social.matchedOn", { fields: matched.join(" + ") })}
              {docsLine(conversion) ? ` · ${docsLine(conversion)}` : ""}
            </p>
          )}
          {conversion.status === "confirmed" && conversion.tieBrokenBy === "address" && (
            <p className="text-xs text-muted-foreground">
              {t("app.leads.social.tieBroken", { field: (conversion.matchedOn || []).filter((r) => r !== "address").map((r) => reasonLabel(r, t)).join(" + ") })}
            </p>
          )}
          {conversion.status === "possible" && (
            <>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                <span className="font-semibold">{t("app.leads.social.possible", "Possible match — not counted")}</span>
                {matched.length ? ` · ${t("app.leads.social.matchedOn", { fields: matched.join(" + ") })}` : ""}
                {docsLine(conversion.possible) ? ` · ${docsLine(conversion.possible)}` : ""}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {conversion.ambiguous ? t("app.leads.social.ambiguous") : t("app.leads.social.possibleNote")}
              </p>
            </>
          )}
          {conversion.status === "none" && <p className="text-xs text-muted-foreground">{t("app.leads.social.none")}</p>}
        </div>
      )}
    </section>
  );
}

/**
 * The picker. `markWon` is "Link the quote that won it": the same POST with
 * markWon (and replace, since the lead may already point at the wrong quote)
 * — the server links, then asks the Won rule, and moves the lead only if the
 * rule agrees.
 */
export function QuoteLinkPicker({ leadId, markWon, hasLinkedQuote, onClose, onLinked, t }) {
  const money = useCompanyMoney();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);
  const [linkingId, setLinkingId] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    const id = setTimeout(async () => {
      setFailed(false);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        const res = await fetch(`/api/leads/${leadId}/quote-link?${params.toString()}`);
        if (!alive) return;
        if (!res.ok) {
          await reportResponseError(res, t("app.leads.picker.loadError", "Couldn't search quotes."));
          setFailed(true);
          return;
        }
        const d = await res.json();
        if (alive) setRows(Array.isArray(d.candidates) ? d.candidates : []);
      } catch {
        if (alive) setFailed(true);
      }
    }, q ? 250 : 0);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [q, leadId, t]);

  async function link(quoteId) {
    setLinkingId(quoteId);
    setNotice("");
    try {
      const res = await fetch(`/api/leads/${leadId}/quote-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId, markWon: Boolean(markWon), replace: Boolean(markWon && hasLinkedQuote) }),
      });
      if (!res.ok) {
        await reportResponseError(res, setNotice, t("app.leads.picker.error", "Couldn't link that quote."));
        return;
      }
      const d = await res.json();
      onLinked(d.lead);
      if (markWon && !d.markedWon) {
        // Linked, but the rule said no — say so and keep the picker's
        // context rather than closing on a half-success that looks whole.
        setNotice(`${t("app.leads.picker.linkedNotWon", "Quote linked — the lead stays where it is.")} ${wonReasonText(d.won, t)}`);
        return;
      }
      onClose();
    } finally {
      setLinkingId("");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="quote-link-title">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[85vh] flex flex-col bg-card rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 id="quote-link-title" className="text-sm font-semibold text-foreground">
            {markWon
              ? t("app.leads.won.linkWinning", "Link the quote that won it")
              : t("app.leads.docs.linkExisting", "Link an existing quote")}
          </h2>
          <button type="button" onClick={onClose} aria-label={t("app.action.close")} className="min-h-[40px] min-w-[40px] flex items-center justify-center text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="px-4 pt-3">
          <label className="relative block">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("app.leads.picker.search", "Quote number or client name")}
              aria-label={t("app.leads.picker.search", "Quote number or client name")}
              className="w-full border border-border rounded-lg pl-8 pr-3 py-2 text-sm bg-card"
            />
          </label>
          {notice && (
            <p role="alert" className="mt-2 text-xs rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-900 px-2.5 py-2">
              {notice}
            </p>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {failed ? (
            <p className="text-sm text-muted-foreground">{t("app.leads.picker.loadError", "Couldn't search quotes.")}</p>
          ) : rows === null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> {t("app.state.loading")}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {q.trim()
                ? t("app.leads.picker.emptySearch", "No unlinked quote matches. Try the quote number or the client's name.")
                : t("app.leads.picker.emptyMine", "No unlinked quotes under this lead's email or phone. Search by quote number or client name.")}
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center gap-2 border border-border rounded-lg px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{r.quoteNumber}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${quoteStatusClasses(r.status)}`}>
                        {quoteStatusLabel(r.status, t)}
                      </span>
                      {r.matchesLead && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-border text-muted-foreground">
                          {t("app.leads.picker.thisClient", "This client")}
                        </span>
                      )}
                      {r.wouldWin && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold">
                          <CheckCircle2 size={11} aria-hidden="true" />
                          {t("app.leads.picker.wouldWin", "Makes it Won")}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.client?.name || ""}
                      {r.total != null && ` · ${money(r.total)}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => link(r.id)}
                    disabled={Boolean(linkingId)}
                    className="shrink-0 inline-flex items-center gap-1 min-h-[36px] px-3 rounded-lg bg-inverted text-inverted-foreground text-xs font-semibold disabled:opacity-50"
                  >
                    {linkingId === r.id ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} aria-hidden="true" />}
                    {t("app.leads.picker.link", "Link")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
