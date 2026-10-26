"use client";

// app/app/quotes/drawings/page.js
//
// Every drawing read this company has started, newest first.
//
// ══ Why this page exists ═══════════════════════════════════════════════════
//
// GET /api/plan-reads has listed the company's last thirty reads since the
// feature shipped, and nothing rendered it. Its only caller was
// drawings/new/page.js, which uses the POST. So a read — the conversation, the
// sheets, the parsed scope spreadsheet, the priced draft, all of it kept in
// PlanRead and PlanReadMessage — could only be reopened by someone who still
// had its id in their browser history, and no screen showed an id. That is
// AGENTS.md's first recurring failure class with the halves reversed: the data
// was written and never read back.
//
// ══ What a row may and may not claim ═══════════════════════════════════════
//
// The list endpoint selects id, title, status, quoteId, leadId, createdAt and
// readAt, and nothing else. So a row says what the read is called, where it
// got to, when, and — when `quoteId` is set — that a quote came out of it.
// It does NOT name the quote: the endpoint sends no quote number, and
// inventing "Quote #—" or fetching every quote one by one to decorate a list
// would be padding absent data (failure class #5). The link is labelled for
// what it does, which is all this page actually knows.
//
// `leadId` is selected and deliberately unused here. A lead's own page is the
// place that relationship is read from, and a row reading "From a lead" that
// cannot say WHICH lead is a worse sentence than no sentence.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ScanLine, Plus } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useHasLevel } from "@/app/providers/PermissionProvider";
import { fetchList } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import { formatShortDate } from "@/lib/format/localeDate";

// What GET /api/plan-reads returns at most (`take: 30`). A full page is a page
// that may be hiding older reads, and the row count is the only way this
// screen can tell — so it says so instead of looking complete. There is no
// paging on that endpoint; adding one would change its behaviour.
const PAGE_SIZE = 30;

/**
 * The four values PlanRead.status takes, as the workspace already names them.
 *
 * Reusing app.planRead.status.* rather than a second set of words: the badge
 * on this list and the heading inside the read are the same statement, and two
 * catalogues of the same four strings is the duplication where the copy rots.
 * An unknown value prints nothing — a status FieldQuo does not recognise is
 * not "Not read yet".
 */
const STATUS_KEYS = {
  draft: "app.planRead.status.draft",
  reading: "app.planRead.status.reading",
  ready: "app.planRead.status.ready",
  failed: "app.planRead.status.failed",
};

/**
 * The key for a status, or null — looked up with `Object.hasOwn` rather than
 * `STATUS_KEYS[status]`.
 *
 * Probed with hostile values before this was written: a plain object's index
 * also answers for the prototype, so `STATUS_KEYS.constructor` is a truthy
 * FUNCTION and `STATUS_KEYS.__proto__` a truthy object. Either would reach
 * `t()` and React as a non-string child. `PlanRead.status` is our own column
 * and holds one of four words today, so this is not a live bug — it is one
 * character of carelessness away from being one, and the check costs nothing.
 */
function statusKeyFor(status) {
  return Object.hasOwn(STATUS_KEYS, status) ? STATUS_KEYS[status] : null;
}

// Only `failed` is coloured, and it carries its own word as well — colour is
// never the only signal (the Tenders list's rule, same reason).
const statusClass = (status) =>
  status === "failed"
    ? "text-red-700 dark:text-red-300"
    : "text-muted-foreground";

export default function DrawingReadsPage() {
  const { t, language } = useTranslation();
  // POST /api/plan-reads refuses below view_create_edit on the quotes ladder,
  // so the button is not offered below it either. Affordance, not access
  // control — the route refuses regardless (PermissionProvider's own note).
  const canCreate = useHasLevel("quotes", "view_create_edit");
  // null until the server answers. [] would claim "you have no drawing reads"
  // before anything had said so — see lib/loadState.js.
  const [reads, setReads] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchList("/api/plan-reads");
    if (result.aborted) return;
    if (!result.ok) {
      setErrorKey(result.errorKey);
      setLoading(false);
      return;
    }
    setErrorKey("");
    setReads(Array.isArray(result.data?.reads) ? result.data.reads : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ScanLine size={22} />
            {t("app.planRead.list.title", "Drawing reads")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              "app.planRead.list.intro",
              "Every set of drawings you have had read, newest first. Opening one brings back its sheets, its chat and the draft it priced — nothing is charged again.",
            )}
          </p>
        </div>
        {canCreate && (
          <Link
            href="/app/quotes/drawings/new"
            className="inline-flex items-center gap-1.5 border border-border rounded-full px-4 py-2 text-sm font-semibold min-h-[44px] shrink-0"
          >
            <Plus size={14} /> {t("app.planRead.list.new", "New read")}
          </Link>
        )}
      </div>

      <ListState
        loading={loading}
        errorKey={errorKey}
        isEmpty={reads !== null && reads.length === 0}
        onRetry={load}
        empty={
          <div className="bg-card border border-border rounded-xl p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-foreground">
              {t("app.planRead.list.emptyTitle", "No drawing reads yet")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(
                "app.planRead.list.emptyBody",
                "A drawing read turns a drawing set, a scope sheet and site photos into a priced draft quote: FieldQuo reads the sheets your quote's service needs, measures the quantities and prices them from your own rates. What a read costs is shown before it starts.",
              )}
            </p>
            {canCreate && (
              <Link
                href="/app/quotes/drawings/new"
                className="inline-block text-sm font-semibold underline text-foreground min-h-[44px] py-3"
              >
                {t("app.planRead.list.emptyStart", "Start from drawings")}
              </Link>
            )}
          </div>
        }
      >
        <div className="space-y-3">
          {(reads || []).map((read) => {
            const statusKey = statusKeyFor(read.status);
            // readAt is the day the deep read finished; a read that has not run
            // has only the day it was started, and the row says which of the
            // two it is showing.
            //
            // formatShortDate answers "" for anything it cannot parse, so the
            // sentence is built only when there IS a date — "Read " with the
            // date missing would be a claim about a day nobody stated.
            const stamp = read.readAt || read.createdAt;
            const date = formatShortDate(stamp, language);
            const when = !date
              ? ""
              : read.readAt
                ? t("app.planRead.list.readOn", "Read {date}", { date })
                : t("app.planRead.list.startedOn", "Started {date}", { date });
            return (
              <div
                key={read.id}
                className="bg-card border border-border rounded-xl p-4 space-y-2"
              >
                {/* The whole row is one link to the read. The quote link below
                    is a second link beside it, never nested inside it — an
                    anchor inside an anchor is invalid and the inner one stops
                    being clickable. */}
                <Link
                  href={`/app/quotes/drawings/${read.id}`}
                  className="block min-h-[44px]"
                >
                  <p className="text-sm font-semibold text-foreground break-words">
                    {read.title?.trim() ||
                      t("app.planRead.list.untitled", "Untitled project")}
                  </p>
                  {(statusKey || when) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {statusKey && (
                        <span className={statusClass(read.status)}>
                          {t(statusKey)}
                        </span>
                      )}
                      {statusKey && when ? " · " : null}
                      {when}
                    </p>
                  )}
                </Link>
                {read.quoteId && (
                  <Link
                    href={`/app/quotes/${read.quoteId}`}
                    className="inline-block text-xs font-semibold underline text-foreground min-h-[44px] py-3"
                  >
                    {t("app.planRead.list.openQuote", "Open the quote this became")}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </ListState>

      {reads !== null && reads.length >= PAGE_SIZE && (
        <p className="text-xs text-muted-foreground">
          {t("app.planRead.list.capped", "Showing your {n} most recent reads.", {
            n: String(PAGE_SIZE),
          })}
        </p>
      )}
    </div>
  );
}
