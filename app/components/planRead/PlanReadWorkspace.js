"use client";

// app/components/planRead/PlanReadWorkspace.js
//
// "Start from drawings" — one project, read from its drawing set, scope
// sheet, site photos and what the client wants; then a draft quote priced
// from the company's own rates, and a chat that changes both.
//
// The owner-approved structure (2026-10-03 mockup): Files → the read (with
// its credit cost shown BEFORE the button) → Project overview (areas and
// quantities with their sources, "Estimated · verify" badges, access &
// equipment, complexity, your similar jobs, questions, "Check measurements
// on drawing") → Photos grouped by surface → Draft quote → Chat → Create
// quote.
//
// Every figure on this screen is computed by the server on each load
// (lib/planRead/view.js); nothing here does arithmetic on money.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Sparkles, AlertTriangle, Ruler, HelpCircle, HardHat, Gauge, History, Send, Split, Camera } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { jsonBody } from "@/lib/jsonBody";
import { showError } from "@/lib/clientErrors";
import { formatAppMoney } from "@/lib/format/money";
import { CREDIT_CURRENCY } from "@/lib/voice/creditCurrency";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useAiCreditTopup, AiCreditTopupDialog } from "@/app/components/ai/AiCreditTopupDialog";
import QuoteFilesCard from "./QuoteFilesCard";
import SheetMeasure from "./SheetMeasure";
import { UnmeasuredBanner, MeasuredCard, AssumptionsCard, CrewPlanCard, SlicesCard, PastJobsLine, AccessSource, ConfidenceChip } from "./FirstPassCards";
import { ReviewPanel, MaterialsCard, AccessReasonPicker } from "./ReviewPanel";
import { itemDef, ITEM_ATTRIBUTE_CHOICES } from "@/lib/planRead/tradeCatalogue";
import { coatHoursText } from "@/app/components/quotes/builder/coatHoursText";

const POLL_MS = 4000;
const card = "bg-card border border-border rounded-xl p-4 sm:p-5";

function Badge({ tone = "neutral", children }) {
  const tones = {
    neutral: "bg-muted text-muted-foreground",
    warn: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
    good: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>{children}</span>;
}

export default function PlanReadWorkspace({ id }) {
  const { t, language } = useTranslation();
  const router = useRouter();
  const [view, setView] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [starting, setStarting] = useState(false);
  const [reusing, setReusing] = useState(false);
  const [measure, setMeasure] = useState(null);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchJson(`/api/plan-reads/${id}`);
      setView(data);
      setLoadError("");
      return data;
    } catch (err) {
      setLoadError(err?.message || t("app.planRead.loadError", "Couldn't load this drawing read."));
      return null;
    }
  }, [id, t]);

  useEffect(() => {
    load();
    return () => clearTimeout(timer.current);
  }, [load]);

  // While a read runs, poll. Each poll also picks a paused read back up on
  // the server (GET /api/plan-reads/[id]).
  useEffect(() => {
    clearTimeout(timer.current);
    if (view?.status === "reading") timer.current = setTimeout(load, POLL_MS);
    return () => clearTimeout(timer.current);
  }, [view, load]);

  const topup = useAiCreditTopup({ pendingKey: `planRead.${id}`, onCredited: () => load() });

  const money = (n) => (n === undefined || n === null ? "" : formatAppMoney(n, view?.currency || null, language));
  const credits = (cents) => t("app.planRead.credits", "{n} credits ({money})", { n: cents, money: formatAppMoney(cents / 100, CREDIT_CURRENCY, language) });

  async function patch(body) {
    try {
      await fetchJson(`/api/plan-reads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: jsonBody(body) });
      await load();
    } catch (err) {
      showError(err?.message || t("app.planRead.saveError", "Couldn't save that."));
    }
  }

  // `force`: "Read again" — the whole read, after the confirm in ReadAgain
  // (lib/planRead/run.js startRead). A plain run sends no body, as before.
  async function run({ force = false } = {}) {
    setStarting(true);
    try {
      await fetchJson(`/api/plan-reads/${id}/run`, force ? { method: "POST", headers: { "Content-Type": "application/json" }, body: jsonBody({ force: true }) } : { method: "POST" });
      await load();
    } catch (err) {
      if (err.status === 402 && err.data?.topup) topup.open(err.data);
      else showError(err?.message || t("app.planRead.runError", "Couldn't start the read."));
    } finally {
      setStarting(false);
    }
  }

  // Copy an earlier read's sheet passes of the same file in, free; the cost
  // shown on the read button drops by what they would have cost.
  async function reuse(fromPlanReadId) {
    setReusing(true);
    try {
      await fetchJson(`/api/plan-reads/${id}/reuse`, { method: "POST", headers: { "Content-Type": "application/json" }, body: jsonBody({ fromPlanReadId }) });
      await load();
    } catch (err) {
      showError(err?.message || t("app.planRead.reuse.error", "Couldn't reuse those sheets."));
    } finally {
      setReusing(false);
    }
  }

  async function openMeasure({ sheetKey = null, photo = null } = {}) {
    if (photo) {
      const size = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = photo.url;
      });
      if (!size) return showError(t("app.planRead.measure.photoError", "Couldn't open that photo."));
      setMeasure({ sources: [{ key: `photo-${photo.n}`, name: t("app.planRead.photos.photoN", "Photo {n}", { n: photo.n }), image: { url: photo.url, ...size }, feetPerPixel: null, dims: [] }], initialKey: `photo-${photo.n}` });
      return;
    }
    const withImages = (view?.sheets || []).filter((s) => s.image);
    if (!withImages.length) return showError(t("app.planRead.measure.noSheets", "No drawing sheets to measure on yet."));
    const key = sheetKey || withImages[0].key;
    let dims = [];
    try {
      const one = await fetchJson(`/api/plan-reads/${id}?sheet=${encodeURIComponent(key)}`);
      dims = one?.sheets?.find((s) => s.key === key)?.dimList || [];
    } catch {
      dims = [];
    }
    setMeasure({
      sources: withImages.map((s) => ({ key: s.key, name: s.title ? `${s.name} · ${s.title}` : s.name, image: s.image, feetPerPixel: s.feetPerPixel, scaleText: s.scale?.text || null, dims: s.key === key ? dims : [] })),
      initialKey: key,
    });
  }

  if (loadError && !view) return <div className="p-4 sm:p-6 max-w-3xl mx-auto"><div className={`${card} text-sm text-red-700 dark:text-red-300`}>{loadError}</div></div>;
  if (!view) return <div className="p-4 sm:p-6 max-w-5xl mx-auto"><div className="h-96 rounded-xl bg-accent animate-pulse" /></div>;

  const reading = view.status === "reading";
  const project = view.project;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/app/quotes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline min-h-[44px]">
          <ArrowLeft className="w-4 h-4" aria-hidden />
          {t("app.planRead.back", "Quotes")}
        </Link>
      </div>

      <header className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("app.planRead.kicker", "Start from drawings")}</p>
            <TitleField key={view.title} value={view.title} onSave={(title) => patch({ title })} t={t} />
          </div>
          <StatusChip status={view.status} t={t} />
        </div>
        <ClientRequest key={view.clientRequest} value={view.clientRequest} disabled={reading} onSave={(clientRequest) => patch({ clientRequest })} t={t} />
        <ScopePicker key={(view.scope?.categories || []).map((c) => c.key).join(",")} view={view} disabled={reading} onSave={(scope) => patch({ scope })} t={t} />
      </header>

      <QuoteFilesCard
        endpoint={`/api/plan-reads/${id}/documents`}
        chains={view.documents || []}
        canUpload
        renderPdfPages
        locked={reading}
        onChanged={load}
      />

      <ReadCard view={view} t={t} language={language} credits={credits} starting={starting} onRun={run} onReuse={reuse} reusing={reusing} />

      {project && (
        <>
          <OverviewCard view={view} t={t} money={money} onMeasure={() => openMeasure()} onToggle={(op) => patch({ ops: [op] })} />
          <MeasuredCard view={view} t={t} />
          <AssumptionsCard view={view} t={t} disabled={reading} onOp={(op) => patch({ ops: [op] })} />
          <CrewPlanCard key={`${view.draft?.plan?.crew?.size}-${view.draft?.plan?.crew?.hoursPerDay}`} view={view} t={t} money={money} disabled={reading} onOp={(op) => patch({ ops: [op] })} />
          <SlicesCard view={view} t={t} money={money} onCreate={(key) => router.push(`/app/quotes/new?fromPlanRead=${id}&planScope=${encodeURIComponent(key)}`)} />
          {(project.trades || []).map((trade) => (
            <TradeCard
              key={trade.tradeKey}
              trade={trade}
              t={t}
              onOp={(op) => patch({ ops: [{ ...op, tradeKey: trade.tradeKey }] })}
              onMeasure={() => openMeasure()}
              pricing={view.pricing?.trades?.find((p) => p.tradeKey === trade.tradeKey) || null}
              recommendation={view.pricing?.recommendation || null}
              useSuggestions={view.pricing?.useSuggestions?.[trade.tradeKey] === true}
              money={money}
            />
          ))}
          <ReviewPanel view={view} t={t} disabled={reading} onOp={(op) => patch({ ops: [op] })} />
          <RecommendationCard view={view} t={t} money={money} onOp={(op) => patch({ ops: [op] })} />
          <MaterialsCard view={view} t={t} money={money} disabled={reading} onOp={(op) => patch({ ops: [op] })} />
          <PhotoGroupsCard view={view} t={t} onSplit={(gid) => patch({ photo: { op: "split", id: gid } })} onMerge={(ids) => patch({ photo: { op: "merge", ids } })} onAdjust={(photo) => openMeasure({ photo })} />
          <DraftCard view={view} t={t} money={money} onPrice={(accessId, price) => patch({ ops: [{ op: "set_access_price", accessId, price }] })} onConfirm={(accessId) => patch({ ops: [{ op: "confirm_access", accessId }] })} onOp={(op) => patch({ ops: [op] })} onPrep={(surfaceId, hours) => patch({ ops: [{ op: "set_prep_hours", surfaceId, hours }] })} onCreate={() => router.push(`/app/quotes/new?fromPlanRead=${id}`)} />
          <ChatCard view={view} t={t} language={language} credits={credits} money={money} onSent={load} onTopup={(data) => topup.open(data)} onApplyPricing={(assumptions) => patch({ ops: [{ op: "set_pricing_assumptions", assumptions }] })} />
        </>
      )}

      {measure && (
        <SheetMeasure
          open
          sources={measure.sources}
          initialKey={measure.initialKey}
          surfaces={[
            ...(project?.surfaces || []),
            // A trade item measured on the sheet is the estimator's own figure,
            // like a painting surface's (applyTradeOps "measure_item").
            ...(project?.trades || []).flatMap((tr) =>
              tr.items.map((it) => ({ ...it, id: `trade:${tr.tradeKey}:${it.id}`, label: `${tr.label}: ${it.label}` })),
            ),
          ]}
          onClose={() => setMeasure(null)}
          onUse={async (surfaceId, value, sourceText) => {
            const m = /^trade:([a-z]+):(.+)$/.exec(surfaceId);
            if (m) await patch({ ops: [{ op: "measure_item", tradeKey: m[1], itemId: m[2], value, sourceText }] });
            else await patch({ ops: [{ op: "measure", surfaceId, value, sourceText }] });
          }}
        />
      )}
      <AiCreditTopupDialog {...topup.dialogProps} />
    </div>
  );
}

function StatusChip({ status, t }) {
  const label = {
    draft: t("app.planRead.status.draft", "Not read yet"),
    reading: t("app.planRead.status.reading", "Reading…"),
    ready: t("app.planRead.status.ready", "Read"),
    failed: t("app.planRead.status.failed", "Read failed"),
  }[status] || status;
  return <Badge tone={status === "ready" ? "good" : status === "failed" ? "warn" : "neutral"}>{label}</Badge>;
}

function TitleField({ value, onSave, t }) {
  // Remounted (key) when the saved title changes, rather than synced in an
  // effect — see the call site.
  const [v, setV] = useState(value);
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() && v !== value && onSave(v.trim())}
      className="w-full text-lg font-semibold bg-transparent border-0 border-b border-transparent focus:border-border focus:outline-none py-1"
      aria-label={t("app.planRead.titleLabel", "Project name")}
    />
  );
}

function ClientRequest({ value, disabled, onSave, t }) {
  const [v, setV] = useState(value || "");
  const dirty = v !== (value || "");
  return (
    <div className="mt-3">
      <label htmlFor="plan-client-wants" className="text-sm font-medium">{t("app.planRead.clientWants", "What the client wants")}</label>
      <textarea
        id="plan-client-wants"
        value={v}
        disabled={disabled}
        onChange={(e) => setV(e.target.value)}
        rows={3}
        placeholder={t("app.planRead.clientWantsPlaceholder", "e.g. Repaint the sanctuary walls and ceiling, stain the exterior doors, paint all exterior trim. Not the basement.")}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      {dirty && (
        <button type="button" onClick={() => onSave(v)} className="mt-2 min-h-[40px] px-3 rounded-lg border border-border text-sm hover:bg-accent">
          {t("app.planRead.save", "Save")}
        </button>
      )}
    </div>
  );
}

/** "42s" / "3m 05s", in the screen's language. */
function duration(ms, t) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return t("app.planRead.durationSec", "{s}s", { s });
  return t("app.planRead.durationMin", "{m}m {s}s", { m: Math.floor(s / 60), s: String(s % 60).padStart(2, "0") });
}

function ReuseOffer({ reuse, t, language, credits, onReuse, reusing }) {
  const date = reuse.readAt ? new Date(reuse.readAt).toLocaleDateString(language, { day: "numeric", month: "short" }) : null;
  return (
    <div className="mb-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
      <p className="font-medium">
        {t("app.planRead.reuse.title", "{n} of these sheets were already read in “{title}”{date}.", {
          n: reuse.sheets,
          title: reuse.title || t("app.planRead.reuse.untitled", "an earlier read"),
          date: date ? ` (${date})` : "",
        })}
      </p>
      <p className="text-muted-foreground mt-0.5">
        {t("app.planRead.reuse.body", "Same file, byte for byte. Reuse those readings instead of paying for them again — saves about {credits}.", { credits: credits(reuse.savesCents) })}
      </p>
      {!reuse.sameRequest && (
        <p className="text-xs text-muted-foreground mt-1">{t("app.planRead.reuse.otherRequest", "That read was for a different request, so its sheet notes may weigh things a little differently. Read fresh if the scope changed a lot.")}</p>
      )}
      <button type="button" onClick={() => onReuse(reuse.fromId)} disabled={reusing} className="mt-2 inline-flex items-center gap-2 min-h-[40px] px-3 rounded-lg border border-border bg-background text-sm hover:bg-accent disabled:opacity-60">
        {reusing ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <History className="w-4 h-4" aria-hidden />}
        {t("app.planRead.reuse.button", "Reuse {n} sheets", { n: reuse.sheets })}
      </button>
    </div>
  );
}

/**
 * "Read again" — the whole read, with the current reader. A confirm first,
 * saying what it holds: it is paid, and it replaces what the chat changed.
 * Rendered only when the server says the read can be read again and priced
 * it (view.canReadAgain, credits.readAgainCents).
 */
function ReadAgain({ view, t, credits, starting, onRun, primary = false }) {
  const [asking, setAsking] = useState(false);
  const c = view.credits || {};
  if (!view.canReadAgain || !c.readAgainCents) return null;
  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        disabled={starting}
        className={
          primary
            ? "inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
            : "inline-flex items-center gap-2 min-h-[44px] px-3 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-60"
        }
      >
        <History className="w-4 h-4" aria-hidden />
        {primary ? t("app.planRead.runAgain", "Read again") : t("app.planRead.readAgainAll", "Read everything again")}
      </button>
    );
  }
  return (
    <div role="group" aria-label={t("app.planRead.readAgainConfirmTitle", "Read the whole project again?")} className="w-full rounded-lg border border-border bg-muted/40 p-3 text-sm">
      <p className="font-medium">{t("app.planRead.readAgainConfirmTitle", "Read the whole project again?")}</p>
      <p className="mt-1 text-muted-foreground">
        {t("app.planRead.readAgainConfirmBody", "FieldQuo reads every sheet, photo and measurement again with its current reader and puts the project together again. Changes made in the chat are replaced. This holds up to {max} of your AI credit (balance {balance}), usually about {expected}; you're charged what it actually uses.", {
          max: credits(c.readAgainCents),
          expected: credits(c.readAgainExpectedCents || c.readAgainCents),
          balance: credits(c.balanceCents ?? 0),
        })}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setAsking(false);
            onRun({ force: true });
          }}
          disabled={starting}
          className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
        >
          {starting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Sparkles className="w-4 h-4" aria-hidden />}
          {t("app.planRead.readAgainConfirm", "Hold {max} and read again", { max: credits(c.readAgainCents) })}
        </button>
        <button type="button" onClick={() => setAsking(false)} className="inline-flex items-center min-h-[44px] px-3 rounded-lg border border-border text-sm font-medium hover:bg-muted">
          {t("app.planRead.readAgainCancel", "Not now")}
        </button>
      </div>
    </div>
  );
}

function ReadCard({ view, t, language, credits, starting, onRun, onReuse, reusing }) {
  const c = view.credits || {};
  const p = view.progress || {};
  const took = view.timing?.outcome === "ready" && view.timing.totalMs ? duration(view.timing.totalMs, t) : null;
  if (view.status === "reading") {
    const stage =
      view.stage === "photos"
        ? t("app.planRead.progress.photos", "Reading the site photos…")
        : view.stage === "synthesis"
          ? t("app.planRead.progress.synthesis", "Putting the project together…")
          : // The sheets are read side by side now, so "sheet 1 of 13" would
            // name one sheet while thirteen are in flight: count what is done.
            `${t("app.planRead.progress.sheetsTogether", "Reading the sheets together — {done} of {total} done…", { done: p.sheetsDone || 0, total: p.sheetsTotal || 0 })}${
              p.photosTotal && !p.photosDone ? ` ${t("app.planRead.progress.photosAlongside", "The site photos are being read alongside.")}` : ""
            }`;
    const pct = p.sheetsTotal ? Math.round(((p.sheetsDone || 0) / p.sheetsTotal) * 80) + (view.stage === "synthesis" ? 15 : view.stage === "photos" ? 5 : 0) : 30;
    return (
      <section className={card} aria-live="polite">
        <div className="flex items-center gap-2 text-sm font-medium"><Loader2 className="w-4 h-4 animate-spin" aria-hidden />{stage}</div>
        <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${Math.min(98, pct)}%` }} /></div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("app.planRead.progress.held", "Holding up to {credits}; you're charged what the read actually uses. You can leave this page — it carries on when you come back.", { credits: credits(c.heldCents || 0) })}
        </p>
      </section>
    );
  }
  const hasFiles = (view.documents || []).length > 0;
  return (
    <section className={card}>
      {view.status === "failed" && (
        <p className="mb-3 flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300"><AlertTriangle className="w-4 h-4 mt-0.5" aria-hidden />{view.error || t("app.planRead.failed", "The read couldn't finish. Nothing was charged.")}</p>
      )}
      {view.staleMeasures > 0 && (
        <p className="mb-3 flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
          {t("app.planRead.measureStale", "Measured with an older version — Read again to update.")}
        </p>
      )}
      {view.canRead && view.reuse && <ReuseOffer reuse={view.reuse} t={t} language={language} credits={credits} onReuse={onReuse} reusing={reusing} />}
      {view.canRead ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <p className="font-medium">
              {view.status === "ready"
                ? view.firstPass?.measureMissing
                  ? t("app.planRead.measureAgain", "Measure the drawings — the first pass")
                  : t("app.planRead.readAgain", "New files since the last read")
                : t("app.planRead.readTitle", "Deep read of the project")}
            </p>
            {c.readCents ? (
              <p className="text-muted-foreground">
                {t("app.planRead.readCost", "Up to {max}, usually about {expected}. You're charged what it actually uses, from your AI credit (balance {balance}).", {
                  max: credits(c.readCents),
                  expected: credits(c.readExpectedCents || c.readCents),
                  balance: credits(c.balanceCents ?? 0),
                })}
              </p>
            ) : null}
            {view.status === "ready" && view.firstPass?.measureMissing && <p className="text-xs text-muted-foreground mt-1">{t("app.planRead.measureAgainNote", "This read was made before FieldQuo measured the drawings itself. Measuring scales every elevation, plan and section, prices height, prep and access, and keeps the sheet readings you already paid for.")}</p>}
            {view.status === "ready" && <p className="text-xs text-muted-foreground mt-1">{t("app.planRead.readAgainNote", "Reading again rebuilds the overview from all the files; changes made in the chat are replaced.")}</p>}
            <RoutedSheets view={view} t={t} />
            {took && <p className="text-xs text-muted-foreground mt-1">{t("app.planRead.lastReadTook", "The last read took {time}.", { time: took })}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => onRun()} disabled={starting} className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60">
              {starting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Sparkles className="w-4 h-4" aria-hidden />}
              {view.status === "ready" ? t("app.planRead.runAgain", "Read again") : t("app.planRead.run", "Read the project")}
            </button>
            {/* The new work above is a part of the read; this is all of it. */}
            {view.status === "ready" && <ReadAgain view={view} t={t} credits={credits} starting={starting} onRun={onRun} />}
          </div>
        </div>
      ) : view.status === "ready" ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {/* The read AND its chat — the chat is debited per message, not
              onto the read (lib/planRead/billing.js chatSpendCents). */}
          {c.chatChargedCents === null || c.chatChargedCents === undefined
            ? t("app.planRead.readDoneReadOnly", "Read · {charged} charged for the read.", { charged: credits(c.readChargedCents ?? c.chargedCents ?? 0) })
            : t("app.planRead.readDoneSplit", "Read · {charged} charged so far — {read} for the read, {chat} for the chat.", {
                charged: credits(c.chargedCents || 0),
                read: credits(c.readChargedCents || 0),
                chat: credits(c.chatChargedCents || 0),
              })}
          {took ? ` ${t("app.planRead.took", "Took {time}.", { time: took })}` : ""}
        </p>
        {/* Nothing new to read — but FieldQuo's reader may have improved
            since. The whole read again, after a confirm (never automatic). */}
        <ReadAgain view={view} t={t} credits={credits} starting={starting} onRun={onRun} primary />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {hasFiles ? t("app.planRead.nothingReadable", "None of these files can be read yet — add a drawing PDF, a scope sheet or photos.") : t("app.planRead.addFiles", "Add the drawing set, the scope sheet and any site photos to begin. Reading the files' text is free; the deep read's cost is shown before you start it.")}
        </p>
      )}
    </section>
  );
}

function SourceBadge({ q, t }) {
  if (!q) return null;
  if (q.source === "measured") return <Badge tone="good">{t("app.planRead.source.measured", "Measured")}</Badge>;
  if (q.source === "drawing" && !q.estimated) return <Badge tone="good">{t("app.planRead.source.drawing", "From drawing")}</Badge>;
  if (q.source === "excel") return <Badge tone="good">{t("app.planRead.source.excel", "From scope sheet")}</Badge>;
  if (q.source === "photo") return <Badge tone="warn">{t("app.planRead.source.photo", "From photo · verify")}</Badge>;
  if (q.source === "none") return <Badge tone="warn">{t("app.planRead.source.none", "No quantity")}</Badge>;
  return <Badge tone="warn">{t("app.planRead.source.estimated", "Estimated · verify")}</Badge>;
}

function OverviewCard({ view, t, money, onMeasure, onToggle }) {
  const p = view.project;
  const similar = view.similar;
  const areaName = (s) => s.areaName || "—";
  const openQs = (p.questions || []).filter((q) => !q.resolved);
  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h2 className="text-sm font-semibold">{t("app.planRead.overview.title", "Project overview")}</h2>
        <button type="button" onClick={onMeasure} className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg border border-border text-sm hover:bg-accent">
          <Ruler className="w-4 h-4" aria-hidden />
          {t("app.planRead.overview.measure", "Check measurements on drawing")}
        </button>
      </div>
      {p.summary && <p className="text-sm mb-1">{p.summary}</p>}
      <UnmeasuredBanner view={view} t={t} />
      {view.clientRequest && <p className="text-xs text-muted-foreground mb-3">{t("app.planRead.overview.client", "Client: {text}", { text: view.clientRequest })}</p>}
      {p.estimatedCount > 0 && (
        <p className="text-xs text-amber-800 dark:text-amber-300 mb-3">{t("app.planRead.overview.estimatedCount", "{n} quantities are estimated — check them before you send.", { n: p.estimatedCount })}</p>
      )}
      {p.painting === false ? (
        // The quote has no painting service: the painting tables would be
        // empty rows, so the trades' own cards below carry the overview.
        <p className="text-sm text-muted-foreground">{t("app.planRead.overview.noPainting", "This read is for {trades} — no painting. The quantities are in the cards below.", { trades: (view.scope?.trades || []).map((x) => x.label).join(", ") })}</p>
      ) : (
      <>
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="py-2 px-4 sm:px-2 font-medium">{t("app.planRead.overview.area", "Area")}</th>
              <th className="py-2 px-2 font-medium">{t("app.planRead.overview.surface", "Surface")}</th>
              <th className="py-2 px-2 font-medium text-right">{t("app.planRead.overview.quantity", "Quantity")}</th>
              <th className="py-2 px-2 font-medium">{t("app.planRead.overview.source", "Source")}</th>
              <th className="py-2 px-2 font-medium"><span className="sr-only">{t("app.planRead.overview.include", "Include")}</span></th>
            </tr>
          </thead>
          <tbody>
            {p.surfaces.map((s) => (
              <tr key={s.id} className={`border-b border-border/60 align-top ${s.active ? "" : "opacity-50"}`}>
                <td className="py-2 px-4 sm:px-2">{areaName(s)}</td>
                <td className="py-2 px-2">{s.label}</td>
                <td className="py-2 px-2 text-right whitespace-nowrap">
                  {s.quantity.value ? `${s.quantity.value.toLocaleString()} ${s.quantity.unit}` : "—"}
                  {s.quantity.low && s.quantity.high && s.quantity.low !== s.quantity.high ? (
                    <span className="block text-[11px] text-muted-foreground">{`${Math.round(s.quantity.low)}–${Math.round(s.quantity.high)}`}</span>
                  ) : null}
                </td>
                <td className="py-2 px-2">
                  <SourceBadge q={s.quantity} t={t} />
                  {s.quantity.confidence && s.quantity.source === "face" ? <span className="ml-1"><ConfidenceChip value={s.quantity.confidence} t={t} /></span> : null}
                  <span className="block text-[11px] text-muted-foreground mt-0.5 max-w-[280px]">{s.quantity.sourceText}</span>
                  {s.heightBasis && <span className="block text-[11px] text-muted-foreground mt-0.5 max-w-[280px]">{t("app.planRead.overview.heightBasis", "Height: {text}", { text: s.heightBasis })}</span>}
                </td>
                <td className="py-2 px-2">
                  <button type="button" onClick={() => onToggle({ op: s.active ? "remove_surface" : "set_surface", surfaceId: s.id, include: true })} className="text-xs min-h-[36px] px-2 rounded-md border border-border hover:bg-accent">
                    {s.active ? t("app.planRead.overview.leaveOut", "Leave out") : t("app.planRead.overview.putBack", "Put back")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 mt-4">
        <div className="border border-border rounded-lg p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold mb-1"><HardHat className="w-4 h-4" aria-hidden />{t("app.planRead.overview.access", "Access & equipment")}</p>
          {(p.access || []).filter((a) => a.included !== false).length ? (
            <ul className="space-y-1 text-sm">
              {p.access.filter((a) => a.included !== false).map((a) => (
                <li key={a.id}>
                  <span className="font-medium">{a.label}</span>
                  {a.areaName ? ` — ${a.areaName}` : ""}
                  {a.heightFt ? <span className="block text-xs text-muted-foreground">{t("app.planRead.overview.height", "Height {h} ft · {source}", { h: a.heightFt, source: a.heightSource || "" })}</span> : null}
                  {a.reason ? <span className="block text-xs text-muted-foreground">{a.reason}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("app.planRead.overview.noAccess", "Ladders only — nothing tall found.")}</p>
          )}
        </div>
        <div className="border border-border rounded-lg p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold mb-1"><Gauge className="w-4 h-4" aria-hidden />{t("app.planRead.overview.complexity", "Complexity")}</p>
          <p className="text-sm font-medium">{t(`app.planRead.complexity.${p.complexity?.level || "medium"}`, p.complexity?.level || "medium")}</p>
          <ul className="text-xs text-muted-foreground list-disc pl-4 mt-1">
            {(p.complexity?.factors || []).map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
        <div className="border border-border rounded-lg p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold mb-1"><History className="w-4 h-4" aria-hidden />{t("app.planRead.overview.similar", "Your similar jobs")}</p>
          {(view.firstPass?.slices || []).length === 1 && view.canSeeMoney && view.firstPass.slices[0].compare ? (
            <PastJobsLine compare={view.firstPass.slices[0].compare} t={t} money={money} />
          ) : similar?.hidden ? (
            <p className="text-sm text-muted-foreground">{t("app.planRead.overview.similarHidden", "Hidden by your access level.")}</p>
          ) : similar?.range ? (
            <p className="text-sm">
              {t("app.planRead.overview.similarRange", "Your last {n} won came in at {low}–{high} per sq ft.", { n: similar.range.count, low: money(similar.range.low), high: money(similar.range.high) })}
              {view.draft?.perSqft ? <span className="block text-xs text-muted-foreground">{t("app.planRead.overview.similarThis", "This draft: {v} per sq ft.", { v: money(view.draft.perSqft) })}</span> : null}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("app.planRead.overview.similarNone", "No won painting quotes with a measured area to compare yet.")}</p>
          )}
          {(similar?.matches || []).slice(0, 3).map((m) => (
            <Link key={m.quoteId} href={`/app/quotes/${m.quoteId}`} className="block text-xs text-muted-foreground hover:underline">
              {`${m.quoteNumber} · ${m.sqft.toLocaleString()} sq ft · ${money(m.perSqft)}/sq ft · ${t(`app.planRead.similarStatus.${m.status}`, m.status)}`}
            </Link>
          ))}
        </div>
      </div>
      </>
      )}

      {/* With the first pass's review panel, the assumptions, exclusions and
          open questions are IN it ("Check before sending") — not listed twice. */}
      {!view.firstPass?.review && (p.assumptions?.length > 0 || p.exclusions?.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2 mt-3 text-sm">
          {p.assumptions?.length > 0 && (
            <div><p className="text-xs font-semibold mb-1">{t("app.planRead.overview.assumptions", "Assumptions")}</p><ul className="list-disc pl-4 space-y-0.5">{p.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul></div>
          )}
          {p.exclusions?.length > 0 && (
            <div><p className="text-xs font-semibold mb-1">{t("app.planRead.overview.exclusions", "Exclusions")}</p><ul className="list-disc pl-4 space-y-0.5">{p.exclusions.map((a, i) => <li key={i}>{a}</li>)}</ul></div>
          )}
        </div>
      )}

      {!view.firstPass?.review && openQs.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold mb-1"><HelpCircle className="w-4 h-4" aria-hidden />{t("app.planRead.overview.questions", "Questions for you")}</p>
          <ul className="space-y-2 text-sm">
            {openQs.map((q) => (
              <li key={q.id} className="flex items-start justify-between gap-2">
                <span>{q.text}</span>
                <button type="button" onClick={() => onToggle({ op: "resolve_question", questionId: q.source === "model" ? q.id : null, text: q.text })} className="shrink-0 text-xs min-h-[36px] px-2 rounded-md border border-border bg-background hover:bg-accent">
                  {t("app.planRead.overview.answered", "Done")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/**
 * What the read is FOR — the services on the quote or the lead it came from
 * (the owner, 2026-10-04: the trade comes from the quote's service, never a
 * separate trade picker). When it came with none, the company's own
 * switched-on services are offered: choosing one is choosing the quote's
 * service, and the draft quote files its lines under it.
 */
function ScopePicker({ view, disabled, onSave, t }) {
  const chosen = view.scope?.categories || [];
  const options = view.scopeOptions || [];
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState(() => new Set(chosen.map((c) => c.key)));
  const from = view.scope?.from;
  return (
    <div className="mt-3">
      <p className="text-sm font-medium">{t("app.planRead.scope.title", "What this quote is for")}</p>
      {chosen.length ? (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {chosen.map((c) => {
            const opt = options.find((o) => o.key === c.key);
            return (
              <Badge key={c.key} tone={opt?.trade ? "good" : "neutral"}>
                {opt?.trade ? `${c.label} · ${t(`app.planRead.scope.focus.${opt.focus}`, opt.focus)}` : c.label}
              </Badge>
            );
          })}
          {from && <span className="text-xs text-muted-foreground">{t(`app.planRead.scope.from.${from}`, from)}</span>}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mt-0.5">{t("app.planRead.scope.none", "No service chosen — the read covers painting, inside and out, as before. Choose the quote's service so it reads only what that work needs.")}</p>
      )}
      {(view.scope?.unmapped || []).length > 0 && (
        <p className="text-xs text-muted-foreground mt-1">{t("app.planRead.scope.unmapped", "Some of these services aren't a trade the drawing read measures yet; their sheets are read for the others.")}</p>
      )}
      {!disabled && !editing && (
        <button type="button" onClick={() => setEditing(true)} className="mt-2 min-h-[40px] px-3 rounded-lg border border-border text-sm hover:bg-accent">
          {chosen.length ? t("app.planRead.scope.change", "Change") : t("app.planRead.scope.choose", "Choose the service")}
        </button>
      )}
      {editing && (
        <div className="mt-2 rounded-lg border border-border p-3">
          {!options.length ? (
            <p className="text-sm text-muted-foreground">{t("app.planRead.scope.noOptions", "You have no services switched on. Switch them on in Settings → Services.")}</p>
          ) : (
            <ul className="grid gap-1 sm:grid-cols-2">
              {options.map((o) => (
                <li key={o.key}>
                  <label className="flex items-center gap-2 min-h-[40px] text-sm">
                    <input
                      type="checkbox"
                      checked={picked.has(o.key)}
                      onChange={(e) =>
                        setPicked((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(o.key);
                          else next.delete(o.key);
                          return next;
                        })
                      }
                    />
                    <span>{o.label}</span>
                    {!o.trade && <span className="text-xs text-muted-foreground">{t("app.planRead.scope.notMeasured", "(not measured from drawings yet)")}</span>}
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => { onSave([...picked]); setEditing(false); }} className="min-h-[40px] px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
              {t("app.planRead.save", "Save")}
            </button>
            <button type="button" onClick={() => { setPicked(new Set(chosen.map((c) => c.key))); setEditing(false); }} className="min-h-[40px] px-3 rounded-lg border border-border text-sm hover:bg-accent">
              {t("app.planRead.scope.cancel", "Cancel")}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{t("app.planRead.scope.note", "Only the sheets that matter for these services are read — fewer sheets, a smaller charge. Changing them after a read means reading again.")}</p>
        </div>
      )}
    </div>
  );
}

/** "Reading 8 of 13 sheets — the rest aren't for drywall": routing is a
 *  saving the estimator should see, never a silent skip. */
function RoutedSheets({ view, t }) {
  const [open, setOpen] = useState(false);
  const s = view.scope;
  if (!s?.stated || !(s.total > 0) || s.sent === s.total) return null;
  const skipped = (view.sheets || []).filter((x) => x.route && !x.route.send);
  return (
    <div className="mt-1 text-xs text-muted-foreground">
      <p>
        {t("app.planRead.scope.routed", "Reading {sent} of {total} sheets — the others aren't for {trades}.", { sent: s.sent, total: s.total, trades: s.trades.map((x) => x.label).join(", ") })}{" "}
        <button type="button" onClick={() => setOpen((v) => !v)} className="underline min-h-[32px]">
          {open ? t("app.planRead.scope.hideSkipped", "Hide") : t("app.planRead.scope.showSkipped", "Which?")}
        </button>
      </p>
      {open && (
        <ul className="mt-1 list-disc pl-4">
          {skipped.map((x) => (
            <li key={x.key}>
              {x.title ? `${x.name} · ${x.title}` : x.name}
              {" — "}
              {x.route.reason === "spec" ? t("app.planRead.scope.specPage", "a specification page: its text is read for free") : t("app.planRead.scope.notForTrade", "not for this quote's services")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ConfidenceBadge({ q, t }) {
  if (!q) return null;
  if (q.source === "none") return <Badge tone="warn">{t("app.planRead.source.none", "No quantity")}</Badge>;
  if (q.source === "measured") return <Badge tone="good">{t("app.planRead.source.measured", "Measured")}</Badge>;
  if (q.confidence === "high") return <Badge tone="good">{t("app.planRead.confidence.high", "High")}</Badge>;
  if (q.confidence === "medium") return <Badge tone="neutral">{t("app.planRead.confidence.medium", "Medium")}</Badge>;
  return <Badge tone="warn">{t("app.planRead.confidence.low", "Low · verify")}</Badge>;
}

/** One trade beyond painting: every quantity with its confidence and the
 *  sheet, schedule row, count or cell it came from. Quantities only — the
 *  prices are the pricing card's (lib/planRead/tradePricing.js). */
function TradeCard({ trade, t, onOp, onMeasure, pricing, recommendation, useSuggestions, money }) {
  const openQs = (trade.questions || []).filter((q) => !q.resolved);
  const unitLabel = (q) => t(`app.planRead.unit.${q.unit}`, q.unitLabel || q.unit);
  const off = trade.included === false;
  return (
    <section className={`${card} ${off ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h2 className="text-sm font-semibold">{t(`app.planRead.trade.${trade.tradeKey}`, trade.label)}</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onMeasure} className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg border border-border text-sm hover:bg-accent">
            <Ruler className="w-4 h-4" aria-hidden />
            {t("app.planRead.overview.measure", "Check measurements on drawing")}
          </button>
          <button type="button" onClick={() => onOp({ op: off ? "include_trade" : "exclude_trade" })} className="min-h-[40px] px-3 rounded-lg border border-border text-sm hover:bg-accent">
            {off ? t("app.planRead.trade.include", "Put this trade back") : t("app.planRead.trade.exclude", "Leave this trade out")}
          </button>
        </div>
      </div>
      {trade.summary && <p className="text-sm mb-1">{trade.summary}</p>}
      <p className="text-xs text-muted-foreground mb-3">
        {t("app.planRead.trade.confidenceLine", "{high} high · {medium} medium · {low} low confidence — check the low ones before you send.", trade.confidence || { high: 0, medium: 0, low: 0 })}
      </p>
      {!trade.items.length ? (
        <p className="text-sm text-muted-foreground">{t("app.planRead.trade.empty", "Nothing for this trade was found on the sheets that were read.")}</p>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="py-2 px-4 sm:px-2 font-medium">{t("app.planRead.overview.area", "Area")}</th>
                <th className="py-2 px-2 font-medium">{t("app.planRead.trade.item", "Item")}</th>
                <th className="py-2 px-2 font-medium text-right">{t("app.planRead.overview.quantity", "Quantity")}</th>
                <th className="py-2 px-2 font-medium">{t("app.planRead.trade.confidence", "Confidence and source")}</th>
                <th className="py-2 px-2 font-medium"><span className="sr-only">{t("app.planRead.overview.include", "Include")}</span></th>
              </tr>
            </thead>
            <tbody>
              {trade.items.map((it) => (
                <tr key={it.id} className={`border-b border-border/60 align-top ${it.active ? "" : "opacity-50"}`}>
                  <td className="py-2 px-4 sm:px-2">{it.areaName || "—"}</td>
                  <td className="py-2 px-2">
                    {/* The catalogue's own label is translated; a label the
                        read wrote ("Kitchen GFCIs") is the read's words. */}
                    {it.label === itemDef(trade.tradeKey, it.itemKey)?.label ? t(`app.planRead.item.${trade.tradeKey}.${it.itemKey}`, it.label) : it.label}
                    {Object.keys(it.attributes || {}).length > 0 && (
                      <span className="block text-[11px] text-muted-foreground">
                        {Object.entries(it.attributes)
                          .filter(([k]) => !(it.itemKey === "water_heater" && k === "heaterType"))
                          .map(([k, v]) => `${t(`app.planRead.attr.${k}`, k)}: ${typeof v === "boolean" ? (v ? "✓" : "—") : Object.hasOwn(ITEM_ATTRIBUTE_CHOICES, k) ? t(`app.planRead.choice.${k}.${v}`, String(v).replace(/_/g, " ")) : v}`)
                          .join(" · ")}
                      </span>
                    )}
                    {/* A water heater's TYPE moves its hours fivefold (a
                        tankless is 16–20 h against a tank's 3–6). The read
                        fills it from the equipment schedule when it can; a
                        person chooses it when the drawings do not say. */}
                    {it.itemKey === "water_heater" && (
                      <label className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        {t("app.planRead.attr.heaterType", "type")}
                        <select
                          value={it.attributes?.heaterType || ""}
                          onChange={(e) => onOp({ op: "set_item_choice", itemId: it.id, attribute: "heaterType", value: e.target.value || null })}
                          className="min-h-[32px] rounded-md border border-border bg-background px-1.5 text-xs text-foreground"
                        >
                          <option value="">{t("app.planRead.choice.heaterType.unset", "Not stated — choose")}</option>
                          {ITEM_ATTRIBUTE_CHOICES.heaterType.map((v) => (
                            <option key={v} value={v}>
                              {t(`app.planRead.choice.heaterType.${v}`, { electric: "Electric tank", gas: "Gas tank, new", gas_replacement: "Gas tank, replacing one", tankless: "Tankless" }[v])}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </td>
                  <td className="py-2 px-2 text-right whitespace-nowrap">{it.quantity.value ? `${it.quantity.value.toLocaleString()} ${unitLabel(it.quantity)}` : "—"}</td>
                  <td className="py-2 px-2">
                    <ConfidenceBadge q={it.quantity} t={t} />
                    <span className="block text-[11px] text-muted-foreground mt-0.5 max-w-[300px]">{it.quantity.sourceText}</span>
                  </td>
                  <td className="py-2 px-2">
                    <button type="button" onClick={() => onOp({ op: it.included === false ? "include_item" : "exclude_item", itemId: it.id })} className="text-xs min-h-[36px] px-2 rounded-md border border-border hover:bg-accent">
                      {it.included === false ? t("app.planRead.overview.putBack", "Put back") : t("app.planRead.overview.leaveOut", "Leave out")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3 mt-3 text-sm">
        <div className="border border-border rounded-lg p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold mb-1"><Gauge className="w-4 h-4" aria-hidden />{t("app.planRead.overview.complexity", "Complexity")}</p>
          <p className="font-medium">{t(`app.planRead.complexity.${trade.complexity?.level || "medium"}`, trade.complexity?.level || "medium")}</p>
          <ul className="text-xs text-muted-foreground list-disc pl-4 mt-1">{(trade.complexity?.factors || []).map((f, i) => <li key={i}>{f}</li>)}</ul>
        </div>
        {trade.assumptions?.length > 0 && (
          <div className="border border-border rounded-lg p-3"><p className="text-xs font-semibold mb-1">{t("app.planRead.overview.assumptions", "Assumptions")}</p><ul className="list-disc pl-4 space-y-0.5 text-xs">{trade.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul></div>
        )}
        {trade.exclusions?.length > 0 && (
          <div className="border border-border rounded-lg p-3"><p className="text-xs font-semibold mb-1">{t("app.planRead.overview.exclusions", "Exclusions")}</p><ul className="list-disc pl-4 space-y-0.5 text-xs">{trade.exclusions.map((a, i) => <li key={i}>{a}</li>)}</ul></div>
        )}
      </div>
      {pricing && <TradePricing pricing={pricing} recommendation={recommendation} useSuggestions={useSuggestions} money={money} t={t} onOp={onOp} />}
      {openQs.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold mb-1"><HelpCircle className="w-4 h-4" aria-hidden />{t("app.planRead.overview.questions", "Questions for you")}</p>
          <ul className="space-y-2 text-sm">
            {openQs.map((q) => (
              <li key={q.id} className="flex items-start justify-between gap-2">
                <span>{q.text}</span>
                <button type="button" onClick={() => onOp({ op: "resolve_trade_question", questionId: q.source === "model" ? q.id : null, text: q.text })} className="shrink-0 text-xs min-h-[36px] px-2 rounded-md border border-border bg-background hover:bg-accent">
                  {t("app.planRead.overview.answered", "Done")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

const RUNG_TONE = { engine: "good", service: "good", suggestion: "warn", none: "warn" };

/** One trade's pricing, rung by rung — every block names where its numbers
 *  came from, and every coefficient is one click away. */
function TradePricing({ pricing, recommendation, useSuggestions, money, t, onOp }) {
  const [open, setOpen] = useState({});
  const sellOf = (b) => b.sell ?? recommendation?.suggestionSell?.find((s) => s.id === b.id)?.sell ?? null;
  const hasSuggestions = pricing.blocks.some((b) => b.rung === "suggestion");
  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="text-xs font-semibold mb-2">{t("app.planRead.pricing.tradeTitle", "Priced from")}</p>
      <ul className="space-y-2">
        {pricing.blocks.map((b) => (
          <li key={b.id} className="rounded-lg border border-border p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{b.label || pricing.label}</p>
                <Badge tone={RUNG_TONE[b.rung]}>{t(`app.planRead.rung.${b.rung}`, b.rungLabel)}</Badge>
                <span className="block text-[11px] text-muted-foreground mt-0.5">{b.source}</span>
              </div>
              <div className="text-right shrink-0">
                {sellOf(b) !== null ? <p className="font-medium">{money(sellOf(b))}</p> : <p className="text-xs text-muted-foreground">{t("app.planRead.pricing.noSell", "No price yet")}</p>}
                {b.rung === "suggestion" && b.sell === null && sellOf(b) !== null && (
                  <p className="text-[11px] text-muted-foreground">{t("app.planRead.pricing.atTarget", "at your {pct}% target", { pct: recommendation?.targetPct ?? "" })}</p>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {[
                b.hours !== null && b.hours !== undefined ? t("app.planRead.pricing.hours", "{h} crew-h", { h: b.hours }) : null,
                b.labourCost ? t("app.planRead.pricing.labourCost", "labour {v}", { v: money(b.labourCost) }) : null,
                b.materialCost !== null && b.materialCost !== undefined && b.materialCost > 0 ? t("app.planRead.pricing.materialCost", "materials {v}", { v: money(b.materialCost) }) : null,
                b.lineCost ? t("app.planRead.pricing.lineCost", "line costs {v}", { v: money(b.lineCost) }) : null,
                !b.costComplete ? t("app.planRead.pricing.costIncomplete", "cost incomplete") : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {b.lines?.length > 0 && (
              <ul className="mt-1 text-xs">
                {b.lines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>{`${l.description} — ${l.quantity} ${l.unit}`}</span>
                    <span>{money(l.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            {(b.notes || []).map((n, i) => (
              <p key={i} className="text-xs text-amber-800 dark:text-amber-300 mt-1">{n}</p>
            ))}
            {b.coefficients?.length > 0 && (
              <button type="button" onClick={() => setOpen((o) => ({ ...o, [b.id]: !o[b.id] }))} className="mt-1 text-xs underline min-h-[32px]">
                {open[b.id] ? t("app.planRead.pricing.hideWorking", "Hide the figures") : t("app.planRead.pricing.showWorking", "Show the figures used")}
              </button>
            )}
            {open[b.id] && (
              <ul className="mt-1 space-y-1 text-[11px] text-muted-foreground">
                {b.coefficients.map((c, i) => (
                  <li key={i}>
                    <span className="font-medium text-foreground">{`${c.name}: ${c.value} ${c.unit}`}</span>
                    {` [${c.tag}] — ${c.source}`}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {pricing.unpriced.length > 0 && (
        <div className="mt-2 text-xs">
          <p className="font-semibold">{t("app.planRead.pricing.noRateTitle", "No rate — add one")}</p>
          <ul className="list-disc pl-4 text-muted-foreground">
            {pricing.unpriced.map((u) => (
              <li key={u.itemId}>{`${u.label} — ${u.quantity} ${u.unit}`}</li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-1">{t("app.planRead.pricing.noRateNote", "Neither your rates, your services nor FieldQuo's published figures cover these. Add a service for them in Settings → Services, or price them on the quote.")}</p>
        </div>
      )}
      {hasSuggestions && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => onOp({ op: "use_suggestions", on: !useSuggestions })} className={`min-h-[40px] px-3 rounded-lg border text-sm ${useSuggestions ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30" : "border-border hover:bg-accent"}`}>
            {useSuggestions ? t("app.planRead.pricing.suggestionsOn", "FieldQuo's suggested lines will go on the quote — take them off") : t("app.planRead.pricing.suggestionsOff", "Put FieldQuo's suggested lines on the quote")}
          </button>
          <span className="text-xs text-muted-foreground">{t("app.planRead.pricing.suggestionsNote", "Each one is flagged as a suggestion on the quote. Your own rate is always better — set it in Settings → Services.")}</span>
        </div>
      )}
    </div>
  );
}

/** The price the read recommends at the company's target margin, with the
 *  working shown — and, when its rates miss the target, the gap and the
 *  one-click margin adjustment line (lib/planRead/recommendation.js). */
function RecommendationCard({ view, t, money, onOp }) {
  const p = view.pricing;
  if (!view.canSeeMoney) return null;
  if (!p) return null;
  if (p.error) return <section className={card}><p className="text-sm text-muted-foreground">{t("app.planRead.reco.error", "The price recommendation couldn't be worked out just now. The quantities above are unaffected.")}</p></section>;
  const r = p.recommendation;
  const o = r.overhead;
  const pct = (v) => (v === null || v === undefined ? "—" : `${v}%`);
  const overheadLine =
    o.basis === "per_hour"
      ? t("app.planRead.reco.overheadPerHour", "{monthly} a month ÷ {capacity} billable crew-hours × {hours} h on this job ({share}% of your month)", {
          monthly: money(o.monthlyFixedCosts),
          capacity: o.billableHoursPerMonth,
          hours: r.hours,
          share: Math.round((o.share || 0) * 1000) / 10,
        })
      : o.basis === "per_job"
        ? t("app.planRead.reco.overheadPerJob", "{monthly} a month ÷ {jobs} jobs — set billable crew hours a month in Settings → Overhead to share it by this job's time", { monthly: money(o.monthlyFixedCosts), jobs: o.jobsPerMonth })
        : t("app.planRead.reco.overheadPct", "{pct}% of the price — an estimate: set your overhead and billable crew hours in Settings → Overhead", { pct: o.pct });
  const row = (label, value, note) => (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/60 text-sm">
      <span className="min-w-0">
        {label}
        {note ? <span className="block text-[11px] text-muted-foreground">{note}</span> : null}
      </span>
      <span className="shrink-0 font-medium">{value}</span>
    </div>
  );
  const adj = p.marginAdjustment;
  const flagText = {
    loss: t("app.planRead.reco.flag.loss", "At your rates this job loses money."),
    below_target: t("app.planRead.reco.flag.belowTarget", "Your rates price it below your target margin."),
    suggestions: t("app.planRead.reco.flag.suggestions", "Based partly on FieldQuo suggestions, not your own rates."),
    cost_incomplete: t("app.planRead.reco.flag.costIncomplete", "Some costs aren't known — the margin leaves them out."),
    equipment_unpriced: t("app.planRead.reco.flag.equipment", "Equipment without a price isn't in the cost."),
    low_confidence_value: t("app.planRead.reco.flag.lowConfidence", "More than 10% of the price rests on low-confidence quantities — check them before sending."),
    below_minimum_price: t("app.planRead.reco.flag.minimum", "Below your minimum price per job."),
    below_hourly_floor: t("app.planRead.reco.flag.hourly", "Each crew-hour earns less than it costs you with overhead."),
  };
  return (
    <section className={card}>
      <h2 className="text-sm font-semibold mb-2">{t("app.planRead.reco.title", "Price at your target margin")}</h2>
      {row(
        t("app.planRead.reco.labour", "Labour"),
        money(r.labour.cost),
        t("app.planRead.reco.labourNote", "{hours} crew-hours × {rate}/h — {source}", {
          hours: r.hours,
          rate: money(r.labour.rate),
          source:
            r.labour.source === "crew"
              ? t("app.planRead.reco.labourCrew", "your field crew's average cost rate")
              : r.labour.source === "conversation"
                ? t("app.planRead.reco.labourChat", "your figure from the conversation")
                : t("app.planRead.reco.labourFallback", "FieldQuo's default rate — add your crew's rates in Team"),
        }),
      )}
      {row(t("app.planRead.reco.materials", "Materials"), money(r.materialCost))}
      {r.lineCost > 0 && row(t("app.planRead.reco.lineCost", "Your services' line costs"), money(r.lineCost))}
      {r.equipment.cost > 0 &&
        row(
          t("app.planRead.reco.equipmentAll", "Equipment"),
          money(r.equipment.cost),
          r.equipment.estimated > 0 ? t("app.planRead.reco.equipmentEstimated", "{v} of it estimated from your rental rates or the reference table — confirm it in the draft below", { v: money(r.equipment.estimated) }) : null,
        )}
      {row(t("app.planRead.reco.overhead", "Overhead"), money(o.amountAtRecommended), overheadLine)}
      {row(t("app.planRead.reco.cost", "Cost"), money(r.cost))}
      {row(
        t("app.planRead.reco.atTarget", "Price at your {pct}% target", { pct: r.targetPct }),
        r.targetPrice === null ? "—" : money(r.targetPrice),
        r.targetWhatIf ? t("app.planRead.reco.whatIf", "What-if from the conversation; your company target is {pct}%", { pct: r.targetWhatIf.companyPct }) : r.targetIsDefault ? t("app.planRead.reco.defaultTarget", "FieldQuo's 20% default — set yours in Settings → Overhead") : null,
      )}
      {row(
        t("app.planRead.reco.yourRates", "Your rates price it at"),
        money(r.withSuggestions),
        `${t("app.planRead.reco.margin", "margin {pct}", { pct: pct(r.yourMarginPct) })}${r.suggestedTotal > 0 ? ` · ${t("app.planRead.reco.includesSuggested", "includes {v} of FieldQuo suggestions", { v: money(r.suggestedTotal) })}` : ""}`,
      )}
      {r.minimumPrice !== null && row(t("app.planRead.reco.minimum", "Your minimum price per job"), money(r.minimumPrice))}
      {r.hourlyFloor !== null && row(t("app.planRead.reco.hourlyFloor", "Earned per crew-hour vs. your hourly floor"), `${money(r.earnedPerHour)} / ${money(r.hourlyFloor)}`)}
      <div className={`mt-3 rounded-lg p-3 ${r.meetsTarget ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-amber-50 dark:bg-amber-950/30"}`}>
        <p className="text-sm font-semibold">
          {r.meetsTarget
            ? t("app.planRead.reco.recommendYours", "Recommended: {v} — your rates hold your {pct}% target.", { v: money(r.recommended), pct: r.targetPct })
            : t("app.planRead.reco.recommendTarget", "Recommended: {v} to hold {pct}%. Your rates come to {yours} — {gap} short.", { v: money(r.recommended), pct: r.targetPct, yours: money(r.withSuggestions), gap: money(r.gap) })}
        </p>
        {!r.meetsTarget && r.gap > 0 && !adj && (
          <button type="button" onClick={() => onOp({ op: "add_margin_adjustment" })} className="mt-2 min-h-[44px] px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
            {t("app.planRead.reco.addAdjustment", "Add a margin adjustment line of {gap}", { gap: money(r.gap) })}
          </button>
        )}
        {adj && (
          <p className="mt-2 text-sm">
            {t("app.planRead.reco.adjustmentAdded", "A margin adjustment line of {v} goes on the quote.", { v: money(adj.amount) })}{" "}
            <button type="button" onClick={() => onOp({ op: "remove_margin_adjustment" })} className="underline min-h-[32px]">
              {t("app.planRead.reco.removeAdjustment", "Remove it")}
            </button>
          </p>
        )}
      </div>
      {r.flags.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {r.flags.map((f) => (
            <li key={f} className="flex items-start gap-1.5 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
              {flagText[f] || f}
            </li>
          ))}
        </ul>
      )}
      {(p.assumptions || []).length > 0 && (
        <div className="mt-3 text-xs">
          <p className="font-semibold">{t("app.planRead.reco.fromChat", "Figures from the conversation, in use on this read")}</p>
          <ul className="mt-1 space-y-1">
            {p.assumptions.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-2">
                <span>{`“${a.quote}”`}</span>
                <button type="button" onClick={() => onOp({ op: "remove_pricing_assumption", id: a.id })} className="shrink-0 underline min-h-[32px]">
                  {t("app.planRead.reco.removeFigure", "Stop using")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function PhotoGroupsCard({ view, t, onSplit, onMerge, onAdjust }) {
  const photoRead = view.photoRead;
  const groups = view.project?.photoSurfaces || [];
  if (!photoRead || !groups.length) return null;
  const photoBy = new Map((photoRead.photos || []).map((p) => [p.n, p]));
  return (
    <section className={card}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Camera className="w-4 h-4" aria-hidden />{t("app.planRead.photos.title", "Photos · grouped by surface")}</h2>
        <span className="text-xs text-muted-foreground">{t("app.planRead.photos.count", "{p} photos · {s} surfaces", { p: (photoRead.photos || []).length, s: groups.length })}</span>
      </div>
      {photoRead.failed && <p className="text-sm text-amber-800 dark:text-amber-300 mb-2">{t("app.planRead.photos.failed", "The photos couldn't be read this time; the overview was built from the drawings and the scope sheet.")}</p>}
      <ul className="space-y-3">
        {groups.map((g, i) => (
          <li key={g.id} className="border border-border rounded-lg p-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {g.photos.map((n) => {
                const ph = photoBy.get(n);
                return ph ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={n} src={ph.url} alt={t("app.planRead.photos.photoN", "Photo {n}", { n })} className="h-16 w-20 object-cover rounded-md border border-border shrink-0" loading="lazy" />
                ) : null;
              })}
            </div>
            <p className="text-sm font-medium mt-2">
              {g.label}
              {g.photos.length > 1 ? <span className="text-muted-foreground font-normal">{` · ${t("app.planRead.photos.countedOnce", "counted once")}`}</span> : null}
            </p>
            {g.sentence && <p className="text-xs text-muted-foreground">{t("app.planRead.photos.same", "Photos {list} show the same {label}.", { list: g.photos.join(", "), label: String(g.label || "").toLowerCase() })}</p>}
            {g.estimate ? (
              <p className="text-sm mt-1">
                {g.estimate.widthFt && g.estimate.heightFt
                  ? `≈ ${g.estimate.widthFt} ft × ${g.estimate.heightFt} ft = ${Math.round(g.estimate.value).toLocaleString()} sq ft `
                  : `≈ ${Math.round(g.estimate.value).toLocaleString()} ${g.estimate.unit} `}
                <Badge tone="warn">{t("app.planRead.source.photo", "From photo · verify")}</Badge>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">{t("app.planRead.photos.noScale", "No reference object to size it against.")}</p>
            )}
            {g.estimate && (
              <p className="text-xs text-muted-foreground">
                {t("app.planRead.photos.reference", "Measured against: {ref} — photo {n}.", { ref: g.estimate.reference, n: g.estimate.photo })}
                {g.estimate.others?.length ? ` ${t("app.planRead.photos.others", "Also checked in photo {list}.", { list: g.estimate.others.map((o) => o.photo).join(", ") })}` : ""}
              </p>
            )}
            {g.drawing && (
              <p className="text-xs mt-1">
                <Badge tone="good">{t("app.planRead.photos.matchesDrawing", "Matches drawing {sheet}", { sheet: g.drawing })}</Badge>{" "}
                <span className="text-muted-foreground">{t("app.planRead.photos.drawingUsed", "Drawing dimensions were used; the photos set condition and complexity.")}</span>
              </p>
            )}
            {g.condition && <p className="text-xs text-muted-foreground mt-1">{g.condition}</p>}
            <div className="flex flex-wrap gap-2 mt-2">
              {g.photos.length > 1 && (
                <button type="button" onClick={() => onSplit(g.id)} className="inline-flex items-center gap-1 text-xs min-h-[36px] px-2 rounded-md border border-border hover:bg-accent">
                  <Split className="w-3.5 h-3.5" aria-hidden />
                  {t("app.planRead.photos.split", "Split group")}
                </button>
              )}
              {i > 0 && (
                <button type="button" onClick={() => onMerge([groups[i - 1].id, g.id])} className="text-xs min-h-[36px] px-2 rounded-md border border-border hover:bg-accent">
                  {t("app.planRead.photos.mergeUp", "Same as the one above")}
                </button>
              )}
              {photoBy.get(g.estimate?.photo || g.photos[0]) && (
                <button type="button" onClick={() => onAdjust(photoBy.get(g.estimate?.photo || g.photos[0]))} className="inline-flex items-center gap-1 text-xs min-h-[36px] px-2 rounded-md border border-border hover:bg-accent">
                  <Ruler className="w-3.5 h-3.5" aria-hidden />
                  {t("app.planRead.photos.adjust", "Adjust")}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DraftCard({ view, t, money, onPrice, onConfirm, onPrep, onCreate, onOp }) {
  const d = view.draft;
  if (!d) return null;
  const quoteHref = view.quoteId ? `/app/quotes/${view.quoteId}` : null;
  // The trades' lines go on the quote too (app/api/plan-reads/[id]/draft-quote):
  // your rates' blocks always, FieldQuo's suggestions only where a person
  // turned them on.
  const tradeLines = (view.pricing?.trades || []).reduce(
    (n, tr) => n + tr.blocks.filter((b) => b.rung === "engine" || b.rung === "service" || (b.rung === "suggestion" && view.pricing?.useSuggestions?.[tr.tradeKey])).length,
    0,
  );
  const noPainting = view.project?.painting === false;
  if (noPainting) {
    return (
      <section className={card}>
        <h2 className="text-sm font-semibold mb-2">{t("app.planRead.draft.title", "Draft quote")}</h2>
        <p className="text-sm text-muted-foreground">{t("app.planRead.draft.tradesOnly", "The quote opens with each trade's lines priced from your rates (above), and the margin adjustment if you added one.")}</p>
        <div className="flex flex-wrap items-center justify-end gap-2 mt-4">
          {quoteHref && (
            <Link href={quoteHref} className="min-h-[44px] inline-flex items-center px-4 rounded-lg border border-border text-sm hover:bg-accent">{t("app.planRead.draft.openQuote", "Open the quote")}</Link>
          )}
          <button type="button" onClick={onCreate} disabled={!tradeLines} className="min-h-[44px] px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
            {quoteHref ? t("app.planRead.draft.createAnother", "Create another quote") : t("app.planRead.draft.create", "Create quote")}
          </button>
        </div>
        {!tradeLines && <p className="text-xs text-muted-foreground mt-2 text-right">{t("app.planRead.draft.nothingPriced", "Nothing is priced from your rates yet — add your services, or put FieldQuo's suggestions on the quote.")}</p>}
      </section>
    );
  }
  return (
    <section className={card}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <h2 className="text-sm font-semibold">{t("app.planRead.draft.title", "Draft quote")}</h2>
        <span className="text-xs text-muted-foreground">
          {d.ownRates?.interior_painting || d.ownRates?.exterior_painting
            ? t("app.planRead.draft.ownRates", "Priced from your painting rates")
            : t("app.planRead.draft.defaultRates", "Priced from FieldQuo's default painting rates — set your own in Settings → Services")}
        </span>
      </div>
      {!view.canSeeMoney && <p className="text-sm text-muted-foreground mb-2">{t("app.planRead.draft.hidden", "Prices are hidden by your access level.")}</p>}
      <ul className="divide-y divide-border/60">
        {d.lines.map((l, i) => (
          <li key={`${l.surfaceId}-${i}`} className="py-2 flex items-start justify-between gap-3 text-sm">
            <span className="min-w-0">
              {`${l.area} — ${l.label}`}
              {/* Coats beside the hours, as the builder shows them, and the
                  hours in coats — "2 coats × 2.07 h a coat" — so a change of
                  coats is visible as the rule it is (coatsNote below). */}
              <span className="block text-xs text-muted-foreground">
                {[`${l.quantity.toLocaleString()} ${l.unit}`, l.coats ? `${l.coats} ${t("app.paint.coatsShort", "coats")}` : null, `${Math.round(l.hours * 10) / 10} h`].filter(Boolean).join(" · ")}
              </span>
              {coatHoursText(l.coatHours, t) && (
                <span className="block text-[11px] text-muted-foreground mt-0.5">{coatHoursText(l.coatHours, t)}</span>
              )}
              {l.prepHours > 0 && (
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <span>{`${t("app.planRead.draft.prep", "+{h} h prep", { h: Math.round(l.prepHours * 10) / 10 })}${l.prepNote ? ` — ${l.prepNote}` : ""}`}</span>
                  {l.prepSource === "ai" && <Badge tone="warn">{t("app.planRead.draft.aiEntered", "Entered by FieldQuo AI · verify")}</Badge>}
                  {l.surfaceId && (
                    <button type="button" onClick={() => onPrep(l.surfaceId, 0)} className="underline min-h-[32px]">
                      {t("app.planRead.draft.removePrep", "Take off")}
                    </button>
                  )}
                </span>
              )}
              {l.height && l.height.factor > 1 && (
                <span className="block text-[11px] text-muted-foreground mt-0.5">
                  {t("app.planRead.draft.height", "Height ×{f}: {why}", { f: l.height.factor, why: l.height.why })}
                </span>
              )}
              {l.prep && l.prep.auto?.lines?.length > 0 && !l.prep.manual && (
                <span className="block text-[11px] text-muted-foreground mt-0.5">{t("app.planRead.draft.prepAuto", "Prep {h} h: {why}", { h: l.prep.hours, why: l.prep.auto.lines.map((x) => `${x.label} — ${x.why}`).join("; ") })}</span>
              )}
              {l.setup && l.why && <span className="block text-[11px] text-muted-foreground mt-0.5">{l.why}</span>}
              {l.estimated && <Badge tone="warn">{t("app.planRead.source.estimated", "Estimated · verify")}</Badge>}
            </span>
            {view.canSeeMoney && <span className="shrink-0 font-medium">{money(l.amount)}</span>}
          </li>
        ))}
        {d.access.map((a) => (
          <li key={a.id} className="py-2 flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="min-w-0">
              {`${a.label}${a.areaName ? ` — ${a.areaName}` : ""}`}
              <span className="block mt-0.5">
                <AccessSource a={a} t={t} />
              </span>
              {view.canSeeMoney && a.why && <span className="block text-[11px] text-muted-foreground mt-0.5 max-w-[420px]">{a.why}</span>}
            </span>
            {a.id !== "delivery" && a.price === 0 && !a.zeroReason && (
              <AccessReasonPicker accessId={a.id} reasons={view.firstPass?.review?.reasons || []} onOp={(op) => onOp(op)} t={t} />
            )}
            {a.zeroReason && <span className="text-[11px] text-muted-foreground">{t(`app.planRead.accessReason.${a.zeroReason}`, a.zeroReason)}</span>}
            {view.canSeeMoney && a.id !== "delivery" && (
              <span className="inline-flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => onOp({ op: "remove_access", accessId: a.id })} className="min-h-[40px] px-2 rounded-md border border-border text-xs hover:bg-accent">
                  {t("app.planRead.overview.leaveOut", "Leave out")}
                </button>
                {(a.priceSource === "reference" || a.priceSource === "company") && a.price !== null && (
                  <button type="button" onClick={() => onConfirm(a.id)} className="min-h-[40px] px-3 rounded-md border border-border text-xs hover:bg-accent">
                    {t("app.planRead.access.confirm", "Confirm {v}", { v: money(a.price) })}
                  </button>
                )}
                <AccessPrice key={String(a.price)} value={a.priceSource === "reference" || a.priceSource === "company" ? "" : a.price} onSave={(p) => onPrice(a.id, p)} t={t} />
              </span>
            )}
            {view.canSeeMoney && a.id === "delivery" && <span className="font-medium">{money(a.price)}</span>}
          </li>
        ))}
      </ul>
      {d.lines.some((l) => l.coats) && (
        <p className="text-xs text-muted-foreground mt-2">
          {d.lines.some((l) => l.coatHours?.applies)
            ? t("app.planRead.draft.coatsNote", "Coats change the hours as well as the paint: your production rates are for each surface's standard coats, and each coat takes about the same time — as on a typed quote. Prep never scales with coats. For slow or high work, ask the chat for extra prep hours on that surface.")
            : t("app.planRead.draft.coatsNoteOff", "Coats change the paint, not the hours: your production rates are per finished surface, as on a typed quote. For slow or high work, ask the chat for extra prep hours on that surface.")}
        </p>
      )}
      {d.skipped?.length > 0 && (
        <p className="text-xs text-muted-foreground mt-2">{t("app.planRead.draft.skipped", "{n} surfaces have no quantity yet and aren't priced — measure them or tell the chat.", { n: d.skipped.length })}</p>
      )}
      {view.canSeeMoney && (
        <div className="flex items-baseline justify-between border-t border-border mt-2 pt-3">
          <span className="text-sm font-semibold">{t("app.planRead.draft.subtotal", "Subtotal before tax")}</span>
          <span className="text-lg font-semibold">{money(d.subtotal)}</span>
        </div>
      )}
      {d.unpricedAccess > 0 && <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">{t("app.planRead.draft.unpricedAccessWhy", "{n} equipment items have no price — the reason is on each line. Type your price, or set your rental rates in Settings → Services.", { n: d.unpricedAccess })}</p>}
      <div className="flex flex-wrap items-center justify-end gap-2 mt-4">
        {quoteHref && (
          <Link href={quoteHref} className="min-h-[44px] inline-flex items-center px-4 rounded-lg border border-border text-sm hover:bg-accent">{t("app.planRead.draft.openQuote", "Open the quote")}</Link>
        )}
        <button type="button" onClick={onCreate} disabled={!d.lines.length && !d.access.some((a) => a.price) && !tradeLines} className="min-h-[44px] px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
          {quoteHref ? t("app.planRead.draft.createAnother", "Create another quote") : t("app.planRead.draft.create", "Create quote")}
        </button>
      </div>
      <p className="text-xs text-muted-foreground mt-2 text-right">{t("app.planRead.draft.createNote", "Opens the quote builder with these areas, priced from your rates. Nothing is saved until you press Save there; the files move to the quote when you do.")}</p>
    </section>
  );
}

function AccessPrice({ value, onSave, t }) {
  const [v, setV] = useState(value ?? "");
  return (
    <span className="inline-flex items-center gap-2">
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={t("app.planRead.draft.pricePlaceholder", "Your price")}
        className="w-28 min-h-[40px] rounded-md border border-border bg-background px-2 text-right"
        aria-label={t("app.planRead.draft.priceLabel", "Price for this equipment")}
      />
      <button type="button" onClick={() => onSave(v === "" ? null : Number(v))} className="min-h-[40px] px-2 rounded-md border border-border text-xs hover:bg-accent">
        {t("app.planRead.save", "Save")}
      </button>
    </span>
  );
}

/**
 * "Update pricing from this conversation" — the manual trigger (the owner,
 * 2026-10-04). Finds the figures YOU stated in the chat, shows what they
 * would change, and applies nothing until Apply. Only figures printed in your
 * own messages survive (lib/planRead/pricingChat.js).
 */
function PricingFromChat({ view, t, money, credits, onTopup, onApply }) {
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState(null);
  async function find() {
    setBusy(true);
    try {
      setFound(await fetchJson(`/api/plan-reads/${view.id}/pricing-from-chat`, { method: "POST" }));
    } catch (err) {
      if (err.status === 402 && err.data?.topup) onTopup(err.data);
      else showError(err?.message || t("app.planRead.pricingChat.error", "Couldn't read the conversation."));
    } finally {
      setBusy(false);
    }
  }
  const fmt = (label, v) => (v === null || v === undefined ? "—" : label === "margin" || label === "target" ? `${v}%` : label === "hours" ? `${v} h` : money(v));
  return (
    <div className="mt-3 border-t border-border pt-3">
      <button type="button" onClick={find} disabled={busy} className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-lg border border-border text-sm hover:bg-accent disabled:opacity-60">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Sparkles className="w-4 h-4" aria-hidden />}
        {t("app.planRead.pricingChat.button", "Update pricing from this conversation")}
      </button>
      <p className="text-xs text-muted-foreground mt-1">{t("app.planRead.pricingChat.note", "Finds the figures you said — a production rate, your labour cost, a material cost, waste, a target margin — and shows what they change before anything is applied. About {credits}.", { credits: credits(view.credits?.chatCents || 0) })}</p>
      {found && (
        <div className="mt-2 rounded-lg border border-border p-3 text-sm" role="dialog" aria-label={t("app.planRead.pricingChat.diffTitle", "What these figures change")}>
          {!found.proposals.length ? (
            <p className="text-muted-foreground">{t("app.planRead.pricingChat.none", "No pricing figures found in your messages. Say them in the chat — e.g. \"my crew hangs 600 sq ft a day\" — and try again.")}</p>
          ) : (
            <>
              <p className="font-semibold">{t("app.planRead.pricingChat.found", "Figures you stated")}</p>
              <ul className="mt-1 list-disc pl-4">
                {found.proposals.map((a) => (
                  <li key={a.id}>{`“${a.quote}” → ${t(`app.planRead.pricingChat.kind.${a.kind}`, a.kind)}${a.tradeKey ? ` (${a.tradeKey}${a.itemKey ? ` · ${a.itemKey}` : ""})` : ""}`}</li>
                ))}
              </ul>
              {found.diff.rows.length > 0 && (
                <table className="w-full text-xs mt-2">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-1 font-medium">{t("app.planRead.pricingChat.what", "What")}</th>
                      <th className="py-1 font-medium text-right">{t("app.planRead.pricingChat.now", "Now")}</th>
                      <th className="py-1 font-medium text-right">{t("app.planRead.pricingChat.after", "With these figures")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {found.diff.rows.map((r) => (
                      <tr key={r.label} className="border-t border-border/60">
                        <td className="py-1">{t(`app.planRead.pricingChat.row.${r.label}`, r.label)}</td>
                        <td className="py-1 text-right">{fmt(r.label, r.before)}</td>
                        <td className="py-1 text-right font-medium">{fmt(r.label, r.after)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await onApply(found.proposals);
                    setFound(null);
                  }}
                  className="min-h-[40px] px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
                >
                  {t("app.planRead.pricingChat.apply", "Apply to this read")}
                </button>
                <button type="button" onClick={() => setFound(null)} className="min-h-[40px] px-3 rounded-lg border border-border text-sm hover:bg-accent">
                  {t("app.planRead.scope.cancel", "Cancel")}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t("app.planRead.pricingChat.applyNote", "Used on this read only. Your rates in Settings are never changed from the chat.")}</p>
            </>
          )}
          {found.rejected?.length > 0 && <p className="text-xs text-muted-foreground mt-2">{t("app.planRead.pricingChat.rejected", "{n} figures were left out because the number isn't in your own words.", { n: found.rejected.length })}</p>}
        </div>
      )}
    </div>
  );
}

function ChatCard({ view, t, language, credits, money, onSent, onTopup, onApplyPricing }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState(null);
  const end = useRef(null);
  const messages = [...(view.messages || []), ...(pending ? [{ id: "pending", role: "user", text: pending, changes: [] }] : [])];
  // A block body, never `() => el.scrollIntoView()`: Chrome now returns a
  // Promise from scrollIntoView, an arrow without braces hands it to React as
  // the effect's cleanup, and React CALLS it on the next change — "i is not
  // a function", the whole screen down, on every chat reply, price saved or
  // edit (each one grows the history) and on leaving the page for the quote
  // builder (the unmount runs the same cleanup). scripts/check-effect-cleanups.mjs.
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "nearest" });
  }, [messages.length]);

  async function send(e) {
    e.preventDefault();
    const message = text.trim();
    if (!message) return;
    setSending(true);
    setPending(message);
    setText("");
    try {
      await fetchJson(`/api/plan-reads/${view.id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: jsonBody({ message }) });
      await onSent();
    } catch (err) {
      setText(message);
      if (err.status === 402 && err.data?.topup) onTopup(err.data);
      else showError(err?.message || t("app.planRead.chat.error", "Couldn't send that."));
    } finally {
      setPending(null);
      setSending(false);
    }
  }

  return (
    <section className={card}>
      <h2 className="text-sm font-semibold">{t("app.planRead.chat.title", "Ask or change something")}</h2>
      <p className="text-xs text-muted-foreground mb-3">{t("app.planRead.history.note", "Your team's own edits and the AI's changes are listed here together, with who and when.")}</p>
      <div className="space-y-2 max-h-[420px] overflow-y-auto">
        {!messages.some((m) => m.role !== "edit") && <p className="text-sm text-muted-foreground">{t("app.planRead.chat.empty", "Try: \"the bell tower needs a 60 ft lift\", \"exclude the basement\", \"premium paint on the trim\".")}</p>}
        {messages.map((m) => {
          // Who and when, on every line of the history: the read's one record
          // of what was asked, what the AI changed, and what a person changed.
          const when = m.createdAt ? new Date(m.createdAt).toLocaleString(language, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null;
          const who = m.role === "assistant" ? t("app.planRead.history.ai", "AI") : m.author || t("app.planRead.history.someone", "Someone on your team");
          const caption = when ? `${who} · ${when}` : who;
          if (m.role === "edit") {
            return (
              <div key={m.id} className="rounded-lg border border-dashed border-border px-3 py-2 text-sm">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Ruler className="w-3.5 h-3.5" aria-hidden />
                  {t("app.planRead.history.edited", "{caption} — edited", { caption })}
                </p>
                <ul className="mt-1 list-disc pl-4">{(m.changes || []).map((c, i) => <li key={i}>{c}</li>)}</ul>
              </div>
            );
          }
          return (
            <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.changes?.length > 0 && (
                  <ul className="mt-1 text-xs opacity-80 list-disc pl-4">{m.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
                )}
              </div>
              {m.id !== "pending" && <span className="mt-0.5 px-1 text-[11px] text-muted-foreground">{caption}</span>}
            </div>
          );
        })}
        {sending && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" aria-hidden />{t("app.planRead.chat.thinking", "Updating the project…")}</p>}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="mt-3 flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder={t("app.planRead.chat.placeholder", "Tell it what to change…")}
          aria-label={t("app.planRead.chat.label", "Message")}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) send(e);
          }}
        />
        <button type="submit" disabled={sending || !text.trim()} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50" aria-label={t("app.planRead.chat.send", "Send")}>
          <Send className="w-4 h-4" aria-hidden />
        </button>
      </form>
      <p className="text-xs text-muted-foreground mt-1">{t("app.planRead.chat.cost", "About {credits} per message, from your AI credit.", { credits: credits(view.credits?.chatCents || 0) })}</p>
      {view.canSeeMoney && messages.some((m) => m.role === "user") && (
        <PricingFromChat view={view} t={t} money={money} credits={credits} onTopup={onTopup} onApply={onApplyPricing} />
      )}
    </section>
  );
}
