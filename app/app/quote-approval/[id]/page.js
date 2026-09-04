// app/app/quote-approval/[id]/page.js
//
// The internal side of getting a quote approved: mint the share link, see
// what the client has done with it, and record a decision they gave you some
// other way.
//
// That last part is the reason this page exists rather than just a "copy link"
// button on the quote. Most quotes in this trade are approved on the phone or
// in someone's kitchen, not by clicking a link. If the only path to "accepted"
// runs through the client-facing page, the pipeline numbers are wrong.
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Link2,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { useTranslation } from "@/app/hooks/useTranslation";
import { formatMoney } from "@/lib/currency";
import { fetchList } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import { quoteStatusLabel, quoteStatusClasses } from "@/lib/quotes/statusLabels";

export default function QuoteApprovalPage() {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const { id } = useParams();

  const [quote, setQuote] = useState(null);
  const [share, setShare] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [quoteErrorKey, setQuoteErrorKey] = useState("");
  const [shareErrorKey, setShareErrorKey] = useState("");
  // "They declined" opens a box before it commits. Until this existed, the
  // back office had NOWHERE to type why — PATCH /api/quotes/[id] has always
  // accepted `declineReason` and this page posted `{ status }` alone, so the
  // only door to the field was the public link, which does not ask either.
  // A column written by nobody is the same as a column nobody reads.
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");

  // ── "This quote doesn't exist" was every failure's answer ────────────────
  //
  // Both fetches were `r.ok ? r.json() : null`, and a null `quote` renders
  // t("app.quoteApproval.notFound"). So a 403 for a member without quotes
  // access, a 500, and a Neon cold start all told a contractor their quote was
  // gone. The sibling page (app/app/marketing/[id]) fixed exactly this and the
  // fix was never carried across.
  //
  // The share leg is worse than a wrong sentence. A failed GET .../share set
  // `share` to null, and null draws "Create client link" — offering to mint a
  // second token for a quote that may already have a live link out with a
  // client. So its failure is held separately and the panel says it could not
  // be read rather than guessing there is nothing there.
  const load = useCallback(async () => {
    setError("");
    const [q, s] = await Promise.all([
      fetchList(`/api/quotes/${id}`),
      fetchList(`/api/quotes/${id}/share`),
    ]);
    if (q.aborted || s.aborted) return;

    if (q.ok) {
      setQuote(q.data);
      setQuoteErrorKey("");
    } else {
      setQuote(null);
      // 404 is the ONE status that really does mean "no such quote" on a
      // detail route — unlike a list, where lib/loadState.js deliberately
      // refuses to say so. Everything else keeps its sentence and its retry.
      setQuoteErrorKey(q.status === 404 ? "" : q.errorKey);
    }

    if (s.ok) {
      setShare(s.data);
      setShareErrorKey("");
    } else {
      setShare(null);
      // A 404 here means no link has been minted yet, which is the state the
      // Create button is FOR. Any other failure means we do not know, and
      // offering to mint one would risk replacing a link already in the wild.
      setShareErrorKey(s.status === 404 ? "" : s.errorKey);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function createLink(rotate = false) {
    setBusy(rotate ? "rotate" : "create");
    setError("");
    try {
      const res = await fetch(`/api/quotes/${id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotate }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || t("app.quoteApproval.linkError"));
      setShare(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t("app.quoteApproval.clipboardError"));
    }
  }

  async function record(status) {
    setBusy(status);
    setError("");
    try {
      // Blank stays blank. An empty box is somebody who did not ask or was not
      // told, and quoteLifecycle writes the column only when a reason is
      // truthy — so silence lands as null and the win/loss report counts it as
      // unexplained instead of inventing a category for it.
      const trimmed = reason.trim();
      const res = await fetch(`/api/quotes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          ...(status === "declined" && trimmed ? { declineReason: trimmed } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || t("app.quoteApproval.updateError"));
      setDeclining(false);
      setReason("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  if (loading)
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto animate-pulse h-80 bg-accent rounded-xl" />
    );

  // A real 404 says "not found". Anything else says what happened and offers
  // a retry — telling somebody their quote is gone because Neon was asleep is
  // the sort of sentence people act on.
  if (quoteErrorKey)
    return (
      <div className="p-4 sm:p-6 max-w-lg mx-auto">
        <ListState loading={false} isEmpty={false} errorKey={quoteErrorKey} onRetry={load}>
          {null}
        </ListState>
      </div>
    );

  if (!quote)
    return (
      <div className="p-4 sm:p-6 max-w-lg mx-auto text-sm text-muted-foreground">
        {t("app.quoteApproval.notFound")}
      </div>
    );

  const decided = ["accepted", "declined"].includes(quote.status);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <Link
        href={`/app/quotes/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} /> {t("app.quoteApproval.backTo", { number: quote.quoteNumber })}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("app.quoteApproval.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {/* The company's own currency, which GET /api/quotes/[id] selects
              precisely so this page can use it — see the comment on that
              select. This read `toLocaleString("en-CA", { currency: "CAD" })`,
              so a GBP contractor's own quote said CA$8,400.00 to him. It is
              invisible to check:app-currency, which greps for a literal "$",
              and that is how it survived a sweep of 114 of them. */}
          {quote.quoteNumber} · {quote.client?.name} ·{" "}
          {formatMoney(quote.total, quote.company?.currency)}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {quote.status === "draft" && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          {t("app.quoteApproval.draftNotice")}
        </div>
      )}

      {/* Share link */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Link2 size={16} className="text-muted-foreground" /> {t("app.quoteApproval.clientLink")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.quoteApproval.clientLinkHint")}
        </p>

        {share?.url ? (
          <>
            <div className="mt-4 flex gap-2">
              <input
                readOnly
                value={share.url}
                onFocus={(e) => e.target.select()}
                className="flex-1 min-w-0 border border-border rounded-lg px-3 py-2 text-sm font-mono bg-muted text-foreground"
              />
              <button
                onClick={copy}
                className="inline-flex items-center gap-1.5 border border-border px-3 py-2 rounded-lg text-sm font-semibold text-foreground shrink-0"
              >
                {copied ? (
                  <>
                    <Check size={14} className="text-green-600 dark:text-green-400" /> {t("app.action.copied")}
                  </>
                ) : (
                  <>
                    <Copy size={14} /> {t("app.quoteApproval.copy")}
                  </>
                )}
              </button>
            </div>

            <div className="mt-3 flex gap-4 flex-wrap text-sm">
              <a
                href={share.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <ExternalLink size={13} /> {t("app.quoteApproval.previewWhatTheySee")}
              </a>
              <button
                onClick={() => createLink(true)}
                disabled={busy === "rotate"}
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground disabled:opacity-60"
              >
                {busy === "rotate" ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <RefreshCw size={13} />
                )}
                {t("app.quoteApproval.replaceLink")}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t("app.quoteApproval.replaceHint")}
            </p>
          </>
        ) : shareErrorKey ? (
          /* We do not know whether a link exists. "Create client link" here
             would offer to mint a second token for a quote that may already
             have a live one out with a client — a control whose label is the
             opposite of what pressing it might do. */
          <div className="mt-4">
            <ListState
              loading={false}
              isEmpty={false}
              errorKey={shareErrorKey}
              onRetry={load}
            >
              {null}
            </ListState>
          </div>
        ) : (
          <button
            onClick={() => createLink(false)}
            disabled={busy === "create"}
            className="mt-4 inline-flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
          >
            {busy === "create" && <Loader2 size={14} className="animate-spin" />}
            {t("app.quoteApproval.createClientLink")}
          </button>
        )}
      </div>

      {/* Where it stands */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground">{t("app.quoteApproval.whereItStands")}</h2>

        <dl className="mt-4 grid gap-4 sm:grid-cols-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("app.quoteApproval.statusLabel")}
            </dt>
            {/* lib/quotes/statusLabels.js, the same map the quotes list reads.
                This rendered the raw column — lowercase English in the middle
                of an otherwise French screen — and it also DISAGREED with the
                list, which calls `accepted` "Approved". One quote, two words,
                two screens. */}
            <dd className="mt-1">
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${quoteStatusClasses(quote.status)}`}
              >
                {quoteStatusLabel(quote.status, t)}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("app.quoteApproval.sentLabel")}
            </dt>
            <dd className="mt-1 text-foreground">
              {quote.sentAt
                ? formatDate(quote.sentAt)
                : t("app.quoteApproval.notYet")}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("app.quoteApproval.validUntil")}
            </dt>
            <dd className="mt-1 text-foreground">
              {quote.validUntil
                ? formatDate(quote.validUntil)
                : t("app.quoteApproval.noExpiry")}
            </dd>
          </div>
        </dl>
      </div>

      {/* Record a decision made elsewhere */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground">{t("app.quoteApproval.recordAnswer")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.quoteApproval.recordHint")}
        </p>

        {decided ? (
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <div>
              {t("app.quoteApproval.alreadyMarked")}{" "}
              <span className="font-semibold text-foreground">
                {quoteStatusLabel(quote.status, t)}
              </span>
              .{" "}
              {t("app.quoteApproval.changeIfWrong")}
            </div>
            {/* Written and READ. The reason was collected on both doors and
                shown only in FieldQuo's own console; the least this screen can
                do is show the person who typed it that it landed. */}
            {quote.status === "declined" && quote.declineReason && (
              <div className="rounded-lg bg-muted px-3 py-2">
                <div className="text-xs uppercase tracking-wide">
                  {t("app.quoteApproval.reasonRecorded", "Reason recorded")}
                </div>
                <p className="mt-1 text-foreground whitespace-pre-wrap">
                  {quote.declineReason}
                </p>
              </div>
            )}
          </div>
        ) : declining ? (
          // ── The box, before the button commits ────────────────────────────
          //
          // Optional and free text, for the reason the schema field gives: a
          // required dropdown collects whatever is nearest the cursor, which is
          // worse than no data at all. So there is no list to pick from, and
          // "Record it" works with the box empty.
          <div className="mt-4 space-y-3">
            <label
              htmlFor="decline-reason"
              className="block text-sm font-medium text-foreground"
            >
              {t("app.quoteApproval.whyLost", "Did they say why? (optional)")}
            </label>
            <textarea
              id="decline-reason"
              rows={3}
              maxLength={500}
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t(
                "app.quoteApproval.whyLostPlaceholder",
                "Went with a cheaper bid — about $800 under us.",
              )}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground"
            />
            <p className="text-xs text-muted-foreground">
              {t(
                "app.quoteApproval.whyLostHint",
                "Their words, not a category. Leave it blank if they didn't say — a guess here is worse than nothing, and your win/loss report counts an empty one as “nobody said” rather than inventing a reason.",
              )}
            </p>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => record("declined")}
                disabled={Boolean(busy)}
                className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {busy === "declined" && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                {t("app.quoteApproval.recordAsLost", "Record as lost")}
              </button>
              <button
                onClick={() => {
                  setDeclining(false);
                  setReason("");
                }}
                disabled={Boolean(busy)}
                className="inline-flex items-center gap-2 border border-border text-foreground px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {t("app.action.cancel", "Cancel")}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex gap-3 flex-wrap">
            <button
              onClick={() => record("accepted")}
              disabled={Boolean(busy) || quote.status === "draft"}
              className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {busy === "accepted" && (
                <Loader2 size={14} className="animate-spin" />
              )}
              {t("app.quoteApproval.theyApproved")}
            </button>
            <button
              onClick={() => setDeclining(true)}
              disabled={Boolean(busy) || quote.status === "draft"}
              className="inline-flex items-center gap-2 border border-border text-foreground px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {t("app.quoteApproval.theyDeclined")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
