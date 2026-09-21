// app/sales/page.js
//
// The portal's front door: what a rep should do next, and their own numbers.
//
// ══ What was here before, and why it moved ═══════════════════════════════
//
// The attributed-companies table, now at /sales/companies. It is a good screen
// and it was the wrong front door: it answers "did the ones I closed stick?",
// which is a month-end question, while a rep opening this portal is standing
// outside a shop between calls asking "who is waiting on me". Two different
// questions, so two screens rather than one screen with a scoreboard bolted on.
//
// ══ Five independent loads, and one of them failing is not a zero ════════
//
// Every card fetches its own endpoint and holds its own state. That is more
// code than one aggregating call and it is the shape the data forces: there is
// no /api/sales/home, this work may not add one (the API surface belongs to
// another brief), and — more importantly — a rep on a driveway connection gets
// four cards and one honest "couldn't load" instead of a blank page. Nothing
// here ever renders 0 for a load that failed; `null` and `0` are different
// values all the way from the fetch to the sentence at the top. lib/loadState.js
// argues the general case; app/sales/nextAction.js is where it is enforced.
//
// ══ The check-in texts waiting ════════════════════════════════════════════
//
// The owner: "a little banner on the side that calls the rep's attention
// that a check-in or follow-up text has been created waiting to be sent".
// The card below the next-action sentence lists them — company, which
// touchpoint (day 1, day 7, the milestone), Open — from
// /api/sales/checkins/waiting, which is lib/sales/checkin/waiting.js's ONE
// count, the same number the sidebar badge and the texts banner show.
//
// ══ The signup link finally has a reader ═════════════════════════════════
//
// /api/sales/me has returned `signupLink` and `signups` since it was written
// and NOTHING rendered either — the first recurring failure class in
// AGENTS.md, a field written and never read, sitting on the one artefact a rep
// actually hands to a contractor. Both are on this screen now.
//
// ══ Translated, and that reversed an earlier decision ════════════════════
//
// This header used to say the screen was English "like the four screens beside
// it", and that was a defensible call at the time: the shell and
// /sales/companies were translated and the working screens were not, so
// following the neighbours kept the portal internally consistent. It stopped
// being defensible the moment the owner opened the portal with a Spanish rep
// account and read a tab bar half in Spanish and half in English. Half
// translated is worse than untranslated — it reads as broken rather than as
// unsupported — so the screens moved rather than the tabs.
//
// One sentence on this screen is composed OUTSIDE it, in app/sales/nextAction.js,
// and that module returns keys as well as English precisely so this file can
// resolve them in the rep's language. See its header for why both.
//
// The UTC day boundary that lib/sales/repStats.js asks the UI to state lives in
// "app.salesToday.signupsToday" ("today (UTC)") and in the paragraph below it —
// scripts/check-sales-portal-i18n.mjs asserts the catalogue still says it in
// every language, because the phrase left this file when it became a key.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ClipboardCopy,
  Clock,
  Loader2,
  Mail,
  PencilLine,
  Phone,
  RefreshCw,
  Users,
} from "lucide-react";
import { touchpointLabelKey } from "@/lib/sales/checkin/touchpointLabel";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import {
  LAPSE_WARNING_HOURS,
  nextAction,
  queueSummary,
  repliesWaiting,
  untouchedLeads,
} from "./nextAction";
import { UnloggedCallsList } from "@/app/components/sales/UnloggedCalls";
import OutreachNotice from "./leads/OutreachNotice";
import MyFunnelCard from "./MyFunnelCard";
import YourSignupsCard from "@/app/sales/YourSignupsCard";
import ProductUsageCard from "./ProductUsageCard";

const CARD = "rounded-xl border border-border bg-card p-4 space-y-3";
const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";

/**
 * One fetch, one piece of state, three outcomes.
 *
 * `data === null && error === ""` is "still loading"; `error` set is "we asked
 * and did not get an answer". Kept as one hook so no card can accidentally
 * collapse the two into a falsy check and render an empty list for a failure.
 */
function useEndpoint(url, loadFailedMessage) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchJson(url));
    } catch (err) {
      // The failed load REPLACES the data. Leaving a stale payload beside a
      // red banner is how a screen shows yesterday's number as today's.
      setData(null);
      setError(err?.message || loadFailedMessage);
    } finally {
      setLoading(false);
    }
  }, [url, loadFailedMessage]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, reload: load };
}

/** A card that says what failed and offers the one control that can fix it. */
function CardError({ message, onRetry, retryLabel }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
      <div className="min-w-0 space-y-2">
        <p className="text-foreground break-words">{message}</p>
        <button type="button" onClick={onRetry} className={`${BTN} border border-border text-foreground`}>
          <RefreshCw size={15} /> {retryLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * A number, or the reason there isn't one. Never a zero standing in for either.
 */
function Figure({ value, label, loading, notLoadedLabel }) {
  return (
    <div className="min-w-0">
      <p className="text-2xl font-semibold text-foreground tabular-nums">
        {loading ? (
          <Loader2 size={18} className="animate-spin inline text-muted-foreground" />
        ) : value === null || value === undefined ? (
          <span className="text-base font-medium text-muted-foreground">{notLoadedLabel}</span>
        ) : (
          value
        )}
      </p>
      <p className="text-xs text-muted-foreground break-words">{label}</p>
    </div>
  );
}

export default function SalesHomePage() {
  const { t } = useTranslation();
  // Resolved once, here, rather than inside useEndpoint: the hook is called
  // four times and the sentence is the same one every time, and passing it in
  // keeps useEndpoint free of the LanguageProvider it would otherwise need.
  const loadFailed = t("app.salesToday.loadFailed");
  const notLoaded = t("app.salesToday.notLoaded");
  const tryAgain = t("app.salesToday.tryAgain");

  const me = useEndpoint("/api/sales/me", loadFailed);
  // No trade filter: the home screen wants the rep's whole book and the whole
  // pool, which is what this route returns when nothing is named.
  const queue = useEndpoint("/api/sales/queue", loadFailed);
  const leads = useEndpoint("/api/sales/leads", loadFailed);
  const threads = useEndpoint("/api/sales/threads", loadFailed);
  const waiting = useEndpoint("/api/sales/checkins/waiting", loadFailed);
  // Calls with no outcome — "write it up later" and walked-away-from. The
  // count is the badge's; the list is UnloggedCalls.js, drawn in place.
  const unlogged = useEndpoint("/api/sales/calls/unlogged", loadFailed);
  const [unloggedOpen, setUnloggedOpen] = useState(false);
  // What the intro emails asked for: call-back and demo requests nobody has
  // dealt with yet (lib/sales/outreach/introRequests.js says what counts).
  const introRequests = useEndpoint("/api/sales/intro-email/requests", loadFailed);

  const [copied, setCopied] = useState(false);

  const q = queueSummary(queue.data);
  const replies = repliesWaiting(threads.data?.threads);
  const untouched = untouchedLeads(leads.data?.counts);

  const action = nextAction({
    repliesWaiting: replies,
    prospectsToCall: q.toCall,
    freeToClaim: q.freeToClaim,
    newLeads: untouched,
  });

  // The sentence at the top, assembled in ONE language. `sourceKey` is
  // resolved here and handed in as a value so "your conversations didn't load"
  // is a French sentence for a French rep rather than a French frame around an
  // English fragment — see app/sales/nextAction.js.
  const actionValues = {
    ...action.values,
    ...(action.sourceKey ? { source: t(action.sourceKey) } : {}),
  };

  const stillLoading = me.loading || queue.loading || leads.loading || threads.loading;
  const signupLink = me.data?.signupLink || null;
  // Clipboard access is absent on an insecure origin and in some in-app
  // browsers. The button only exists where the API does; the link itself is in
  // a selectable field either way, so nothing is unreachable without it.
  const canCopy =
    typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function";

  async function copyLink() {
    if (!signupLink || !canCopy) return;
    try {
      await navigator.clipboard.writeText(signupLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // A refused clipboard permission is not a success. Say nothing rather
      // than showing "Copied" over a clipboard that still holds something else.
      setCopied(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        {/* Not "Good morning" — this is read at 07:00 and at 20:00 and the
            portal has no idea which, so it says nothing it cannot know. */}
        <h1 className="text-xl font-semibold text-foreground break-words">
          {t("app.salesToday.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("app.salesToday.intro")}</p>
      </header>

      {/* ── The one sentence ────────────────────────────────────────────────
          Its own card, at the top, because it is the reason the screen exists.
          When a card below it failed to load, this says so instead of ranking
          the rungs it can still see — see app/sales/nextAction.js. */}
      <section
        // What the portal tour rings for its first step. See app/sales/tourSteps.js.
        data-tour="sales-today-next"
        className={`rounded-xl border p-4 space-y-3 ${
          action.code === "unknown"
            ? "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40"
            : "border-border bg-card"
        }`}
      >
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("app.salesToday.nextLabel")}
        </p>
        {stillLoading && action.code === "unknown" ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" /> {t("app.salesToday.working")}
          </p>
        ) : (
          <>
            <p
              className={`text-lg font-semibold break-words ${
                action.code === "unknown"
                  ? "text-amber-900 dark:text-amber-200"
                  : "text-foreground"
              }`}
            >
              {t(action.headlineKey, actionValues)}
            </p>
            <p
              className={`text-sm break-words ${
                action.code === "unknown"
                  ? "text-amber-900 dark:text-amber-200"
                  : "text-muted-foreground"
              }`}
            >
              {t(action.detailKey, actionValues)}
            </p>
            {action.href && (
              <Link href={action.href} className={`${BTN} bg-primary text-primary-foreground w-full`}>
                {t(action.ctaKey)} <ArrowRight size={16} />
              </Link>
            )}
          </>
        )}
      </section>

      {/* Outreach readiness, from whichever of the two lists answered. Both
          routes compute it; taking the first that arrived avoids claiming
          sending is fine because the other request is still in flight. */}
      <OutreachNotice outreach={leads.data?.outreach || threads.data?.outreach} />

      {/* ── Calls to write up ─────────────────────────────────────────────
          "Write it up later" put them here. A card whatever the count, so
          "nothing to write up" is a sentence and not a card that vanished;
          the list opens in place and each row takes the same six buttons
          the pop-up offers. What is still here at day end is logged by the
          line (the cron), marked so. */}
      <section className={CARD} data-unlogged-calls={Number.isFinite(unlogged.data?.count) ? unlogged.data.count : undefined}>
        <div className="flex items-center gap-2">
          <ClipboardCheck size={16} className="text-muted-foreground shrink-0" />
          <h2 className="text-base font-semibold text-foreground">{t("app.salesCall.unlogged.title")}</h2>
        </div>
        {unlogged.error ? (
          <CardError message={unlogged.error} onRetry={unlogged.reload} retryLabel={tryAgain} />
        ) : unlogged.loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" /> {t("app.salesToday.loading")}
          </p>
        ) : !Number.isFinite(unlogged.data?.count) ? (
          <p className="text-sm text-muted-foreground">{notLoaded}</p>
        ) : unlogged.data.count === 0 ? (
          <p className="text-sm text-muted-foreground break-words">{t("app.salesCall.unlogged.none")}</p>
        ) : (
          <>
            <p className="text-sm text-foreground break-words">
              {t("app.salesCall.unlogged.todayLine", { count: t("app.salesCall.unlogged.count", { value: unlogged.data.count }) })}
            </p>
            {unloggedOpen ? (
              <UnloggedCallsList
                onCountChange={(c) => {
                  if (c === 0) {
                    setUnloggedOpen(false);
                    unlogged.reload();
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
                onClick={() => setUnloggedOpen(true)}
                data-unlogged-open
              >
                {t("app.salesCall.unlogged.writeThemUp")} <ArrowRight size={16} />
              </button>
            )}
          </>
        )}
      </section>

      {/* ── Requests from the intro email ─────────────────────────────────
          "{n} call-back requests from emails", "{n} demo requests" — the two
          buttons in the intro email, pressed. Each row opens the lead, where
          the request sits on the timeline with "Mark as handled"; a dial to
          the lead after the request counts as handled by itself. */}
      <section className={CARD} data-intro-requests={Number.isFinite(introRequests.data?.callbacks) ? introRequests.data.callbacks + introRequests.data.demos + (introRequests.data.demoBookings || 0) : undefined}>
        <div className="flex items-center gap-2">
          <Phone size={16} className="text-muted-foreground shrink-0" />
          <h2 className="text-base font-semibold text-foreground">{t("app.salesIntro.today.title")}</h2>
        </div>
        {introRequests.error ? (
          <CardError message={introRequests.error} onRetry={introRequests.reload} retryLabel={tryAgain} />
        ) : introRequests.loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" /> {t("app.salesToday.loading")}
          </p>
        ) : !Number.isFinite(introRequests.data?.callbacks) ? (
          <p className="text-sm text-muted-foreground">{notLoaded}</p>
        ) : introRequests.data.callbacks + introRequests.data.demos + (introRequests.data.demoBookings || 0) === 0 ? (
          <p className="text-sm text-muted-foreground break-words">{t("app.salesIntro.today.none")}</p>
        ) : (
          <>
            {/* "{n} demo bookings" once the rep's page has real bookings; the
                older "{n} demo requests" stays only while a lead pressed the
                button and chose no slot. */}
            <div className={`grid gap-4 ${introRequests.data.demoBookings > 0 && introRequests.data.demos > 0 ? "grid-cols-3" : "grid-cols-2"}`}>
              <Figure value={introRequests.data.callbacks} label={t("app.salesIntro.today.callbacks", { value: introRequests.data.callbacks })} loading={false} notLoadedLabel={notLoaded} />
              {introRequests.data.demoBookings > 0 ? (
                <Figure value={introRequests.data.demoBookings} label={t("app.salesIntro.today.demoBookings", { value: introRequests.data.demoBookings })} loading={false} notLoadedLabel={notLoaded} />
              ) : null}
              {introRequests.data.demos > 0 || !(introRequests.data.demoBookings > 0) ? (
                <Figure value={introRequests.data.demos} label={t("app.salesIntro.today.demos", { value: introRequests.data.demos })} loading={false} notLoadedLabel={notLoaded} />
              ) : null}
            </div>
            <ul className="divide-y divide-border/60 rounded-lg border border-border" data-intro-requests-list>
              {introRequests.data.items.map((item) => (
                <li key={`${item.id}:${item.kind}`} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{item.businessName || t("app.salesToday.checkinsUnnamed")}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t(`app.salesIntro.today.kind.${item.kind}`)} · {new Date(item.at || item.requestedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </span>
                  <Link href={`/sales/leads/${encodeURIComponent(item.leadId)}`} className={`${BTN} shrink-0 border border-border text-foreground px-3`}>
                    {t("app.salesIntro.today.open")} <ArrowRight size={14} />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* ── Check-in texts waiting to be sent ───────────────────────────────
          The engine wrote them; only the rep can send them. Drawn as a card
          whatever the count, so "none waiting" is a sentence the rep reads
          and not a card that quietly disappears. */}
      <section className={CARD} data-checkins-waiting={Number.isFinite(waiting.data?.count) ? waiting.data.count : undefined}>
        <div className="flex items-center gap-2">
          <PencilLine size={16} className="text-muted-foreground shrink-0" />
          <h2 className="text-base font-semibold text-foreground">{t("app.salesToday.checkinsTitle")}</h2>
        </div>
        {waiting.error ? (
          <CardError message={waiting.error} onRetry={waiting.reload} retryLabel={tryAgain} />
        ) : waiting.loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" /> {t("app.salesToday.loading")}
          </p>
        ) : !Number.isFinite(waiting.data?.count) ? (
          <p className="text-sm text-muted-foreground">{notLoaded}</p>
        ) : waiting.data.count === 0 ? (
          <p className="text-sm text-muted-foreground break-words">{t("app.salesToday.checkinsNone")}</p>
        ) : (
          <>
            <p className="text-sm text-foreground break-words">
              {t("app.salesToday.checkinsLine", { count: t("app.salesToday.checkinsCount", { value: waiting.data.count }) })}
              {waiting.data.demoCount > 0 ? ` ${t("app.salesText.waitingDemoNote", { count: waiting.data.demoCount })}` : null}
            </p>
            <ul className="divide-y divide-border/60 rounded-lg border border-border" data-checkins-list>
              {waiting.data.items.map((item) => {
                const labelKey = touchpointLabelKey(item);
                // A numberless draft has no thread to open; My companies is
                // where the number gets added, so that is where Open goes.
                const href = item.noNumber
                  ? "/sales/companies"
                  : `/sales/messages?thread=${encodeURIComponent(item.toE164)}`;
                return (
                  <li key={item.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      {/* The badge sits BESIDE the truncating name, not inside
                          it, so a long demo name on a phone loses letters and
                          never the word "Demo". */}
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate text-sm font-medium text-foreground">
                          {item.companyName || item.toE164 || t("app.salesToday.checkinsUnnamed")}
                        </span>
                        {item.isDemo ? (
                          <span className="shrink-0 inline-flex rounded-full border border-border bg-card px-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {t("app.salesPortal.demoBadge")}
                          </span>
                        ) : null}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {t(labelKey, { day: item.touchpoint })}
                        {item.noNumber ? ` · ${t("app.salesPortal.checkInNoNumber")}` : null}
                      </span>
                    </span>
                    <Link href={href} className={`${BTN} shrink-0 border border-border text-foreground px-3`}>
                      {t("app.salesToday.checkinsOpen")} <ArrowRight size={14} />
                    </Link>
                  </li>
                );
              })}
            </ul>
            {waiting.data.count > waiting.data.items.length ? (
              <p className="text-xs text-muted-foreground">
                {t("app.salesToday.checkinsMore", { shown: waiting.data.items.length, count: waiting.data.count })}
              </p>
            ) : null}
            <Link href="/sales/messages?filter=drafts" className={`${BTN} border border-border text-foreground w-full`}>
              {t("app.salesToday.checkinsAll")}
            </Link>
          </>
        )}
      </section>

      {/* ── Conversations ─────────────────────────────────────────────────── */}
      <section className={CARD}>
        <div className="flex items-center gap-2">
          <Mail size={16} className="text-muted-foreground shrink-0" />
          <h2 className="text-base font-semibold text-foreground">
            {t("app.salesToday.conversations")}
          </h2>
        </div>
        {threads.error ? (
          <CardError message={threads.error} onRetry={threads.reload} retryLabel={tryAgain} />
        ) : (
          <>
            <div className="flex gap-6">
              <Figure
                value={replies}
                label={t("app.salesToday.waitingOnReply")}
                loading={threads.loading}
                notLoadedLabel={notLoaded}
              />
              <Figure
                value={threads.data?.threads ? threads.data.threads.length : null}
                label={t("app.salesToday.openThreads")}
                loading={threads.loading}
                notLoadedLabel={notLoaded}
              />
            </div>
            <Link href="/sales/threads" className={`${BTN} border border-border text-foreground w-full`}>
              {t("app.salesToday.ladderRepliesCta")}
            </Link>
          </>
        )}
      </section>

      {/* ── The queue ─────────────────────────────────────────────────────── */}
      <section className={CARD}>
        <div className="flex items-center gap-2">
          <Phone size={16} className="text-muted-foreground shrink-0" />
          <h2 className="text-base font-semibold text-foreground">
            {t("app.salesToday.yourQueue")}
          </h2>
        </div>
        {queue.error ? (
          <CardError message={queue.error} onRetry={queue.reload} retryLabel={tryAgain} />
        ) : (
          <>
            <div className="flex gap-6">
              <Figure
                value={q.toCall}
                label={t("app.salesToday.claimedNotCalled")}
                loading={queue.loading}
                notLoadedLabel={notLoaded}
              />
              <Figure
                value={q.freeToClaim}
                label={t("app.salesToday.freeToClaim")}
                loading={queue.loading}
                notLoadedLabel={notLoaded}
              />
            </div>
            {/* The platform console handed this rep leads — lib/sales/
                assignLeads.js, read by GET /api/sales/queue as `adminAssigned`.
                Only while some of them are still held; nothing otherwise,
                for the same reason as the lapse line below. The trade and
                the province are named only when the hand-out agreed on one. */}
            {queue.data?.adminAssigned?.latest ? (
              <p className="flex items-start gap-2 text-sm text-foreground break-words" data-admin-assigned>
                <Users size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
                {t(
                  queue.data.adminAssigned.latest.tradeLabel
                    ? "app.salesToday.assignedLine"
                    : "app.salesToday.assignedLineNoTrade",
                  {
                    admin: queue.data.adminAssigned.latest.adminName,
                    count: t("app.salesToday.assignedCount", { value: queue.data.adminAssigned.latest.count }),
                    trade: queue.data.adminAssigned.latest.tradeLabel || "",
                    where: queue.data.adminAssigned.latest.provinceName
                      ? `${queue.data.adminAssigned.latest.tradeLabel ? ", " : " · "}${queue.data.adminAssigned.latest.provinceName}`
                      : "",
                  },
                )}
              </p>
            ) : null}
            {/* Rendered only when it is true. A permanently visible "0 lapse
                soon" trains a rep to stop reading the line that matters. */}
            {q.lapsingSoon ? (
              <p className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-200 break-words">
                <Clock size={15} className="mt-0.5 shrink-0" />
                {/* Reworded from "N claims lapse within 12 hours" so no verb has
                    to agree with the count: "N claims going back in the pool
                    within 12 hours" is grammatical for one and for many, in
                    every language here, and the two counted nouns decline
                    themselves through Intl.PluralRules. The old
                    `n === 1 ? … : …` was the English plural rule wearing a
                    ternary. */}
                {t("app.salesToday.lapsingLine", {
                  count: t("app.salesToday.lapsingCount", { value: q.lapsingSoon }),
                  hours: t("app.duration.hours", { value: LAPSE_WARNING_HOURS }),
                })}
              </p>
            ) : null}
            <Link href="/sales/queue" className={`${BTN} border border-border text-foreground w-full`}>
              {t("app.salesToday.ladderCallCta")}
            </Link>
          </>
        )}
      </section>

      {/* ── Leads ─────────────────────────────────────────────────────────── */}
      <section className={CARD}>
        <div className="flex items-center gap-2">
          <Users size={16} className="text-muted-foreground shrink-0" />
          <h2 className="text-base font-semibold text-foreground">
            {t("app.salesToday.myLeads")}
          </h2>
        </div>
        {leads.error ? (
          <CardError message={leads.error} onRetry={leads.reload} retryLabel={tryAgain} />
        ) : (
          <>
            <div className="flex gap-6">
              <Figure
                value={untouched}
                label={t("app.salesToday.addedNotContacted")}
                loading={leads.loading}
                notLoadedLabel={notLoaded}
              />
              <Figure
                value={leads.data?.counts ? (leads.data.counts.contacted ?? 0) : null}
                label={t("app.salesToday.contacted")}
                loading={leads.loading}
                notLoadedLabel={notLoaded}
              />
            </div>
            <Link href="/sales/leads" className={`${BTN} border border-border text-foreground w-full`}>
              {t("app.salesToday.ladderWriteCta")}
            </Link>
          </>
        )}
      </section>

      {/* ── The rep's own numbers ─────────────────────────────────────────── */}
      <section className={CARD}>
        <h2 className="text-base font-semibold text-foreground">
          {t("app.salesToday.signupsTitle")}
        </h2>
        {me.error ? (
          <CardError message={me.error} onRetry={me.reload} retryLabel={tryAgain} />
        ) : (
          <>
            <div className="flex flex-wrap gap-6">
              <Figure
                value={me.data?.signups?.today ?? null}
                label={t("app.salesToday.signupsToday")}
                loading={me.loading}
                notLoadedLabel={notLoaded}
              />
              <Figure
                value={me.data?.signups?.thisWeek ?? null}
                label={t("app.salesToday.signupsThisWeek")}
                loading={me.loading}
                notLoadedLabel={notLoaded}
              />
              <Figure
                value={me.data?.signups?.total ?? null}
                label={t("app.salesToday.signupsAllTime")}
                loading={me.loading}
                notLoadedLabel={notLoaded}
              />
            </div>
            <p className="text-xs text-muted-foreground break-words">
              {/* lib/sales/repStats.js fixes the day boundary at UTC on purpose,
                  and its own comment asks the UI to say so rather than let a rep
                  read it as their local midnight. */}
              {t("app.salesToday.utcNote")}
            </p>
            <Link href="/sales/companies" className={`${BTN} border border-border text-foreground w-full`}>
              {t("app.salesToday.whatHappened")}
            </Link>
          </>
        )}
      </section>

      {/* ── Your signups — the ones that came in on this rep's link ────────── */}
      <YourSignupsCard />

      {/* ── The rep's funnel this month — its own card, its own fetch ──────── */}
      <MyFunnelCard />

      {/* ── The rep's own scorecards — the page fetches; this is the door ──── */}
      <section className={CARD} data-call-quality-card>
        <h2 className="text-base font-semibold text-foreground">{t("app.salesMyCallQa.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("app.salesMyCallQa.cardIntro")}</p>
        <Link href="/sales/call-quality" className={`${BTN} border border-border text-foreground w-full mt-3`}>
          {t("app.salesMyCallQa.open")}
        </Link>
      </section>

      {/* ── What contractors use most — gated at 150 /app views by the route ── */}
      <ProductUsageCard />

      {/* ── The signup link ───────────────────────────────────────────────── */}
      <section className={CARD}>
        <h2 className="text-base font-semibold text-foreground">
          {t("app.salesToday.signupLinkTitle")}
        </h2>
        {me.error ? (
          <CardError message={me.error} onRetry={me.reload} retryLabel={tryAgain} />
        ) : me.loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" /> {t("app.salesToday.loading")}
          </p>
        ) : signupLink ? (
          <>
            <p className="text-sm text-muted-foreground break-words">
              {t("app.salesToday.signupLinkIntro")}
            </p>
            {/* readOnly, not disabled: a disabled input cannot be selected, and
                selecting the text is the fallback when there is no clipboard. */}
            <input
              readOnly
              value={signupLink}
              onFocus={(e) => e.target.select()}
              aria-label={t("app.salesToday.signupLinkTitle")}
              className="w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-muted text-foreground"
            />
            {canCopy && (
              <button type="button" onClick={copyLink} className={`${BTN} border border-border text-foreground w-full`}>
                {copied ? <CheckCircle2 size={16} /> : <ClipboardCopy size={16} />}
                {copied ? t("app.salesToday.copied") : t("app.salesToday.copyLink")}
              </button>
            )}
            {/* One key with the code interpolated, rather than a sentence split
                around a <span>: where the code falls in the sentence differs by
                language, and handing a translator markup to reassemble is how a
                sentence ends up half in one language. The monospace face on the
                code went with the split — a rep code is one short token and
                reads correctly in the body face, which is a cheaper loss than a
                broken sentence in eight languages. */}
            {me.data?.code && (
              <p className="text-xs text-muted-foreground break-words">
                {t("app.salesToday.repCode", { code: me.data.code })}
              </p>
            )}
          </>
        ) : (
          // signupLinkFor() returns null when it has no origin or no code, and
          // a half-built URL handed to a contractor is worse than none.
          <p className="text-sm text-muted-foreground break-words">
            {t("app.salesToday.noSignupLink")}
          </p>
        )}
      </section>
    </div>
  );
}
