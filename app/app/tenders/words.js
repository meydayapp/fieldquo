// app/app/tenders/words.js
//
// The labels every tender screen prints for a closed vocabulary — status,
// source, document kind — in one place, through t(). The lists themselves
// are lib/tenders/constants.js; a value with no label here prints the raw
// key rather than nothing, so a missed entry is visible, not blank.

export function statusLabel(t, s) {
  return (
    {
      watching: t("app.tenders.status.watching", "Watching"),
      bid: t("app.tenders.status.bid", "Bidding"),
      no_bid: t("app.tenders.status.no_bid", "Not bidding"),
      preparing: t("app.tenders.status.preparing", "Preparing"),
      submitted: t("app.tenders.status.submitted", "Submitted"),
      won: t("app.tenders.status.won", "Won"),
      lost: t("app.tenders.status.lost", "Lost"),
      cancelled: t("app.tenders.status.cancelled", "Cancelled"),
      withdrawn: t("app.tenders.status.withdrawn", "Withdrawn"),
    }[s] || s
  );
}

/** The button that moves a tender INTO a status — a verb, not the state. */
export function moveLabel(t, s) {
  return (
    {
      watching: t("app.tenders.move.watching", "Back to watching"),
      bid: t("app.tenders.move.bid", "Decide to bid"),
      no_bid: t("app.tenders.move.no_bid", "Decide not to bid"),
      preparing: t("app.tenders.move.preparing", "Start preparing"),
      submitted: t("app.tenders.move.submitted", "Mark submitted"),
      won: t("app.tenders.move.won", "Mark won"),
      lost: t("app.tenders.move.lost", "Mark lost"),
      cancelled: t("app.tenders.move.cancelled", "Buyer cancelled it"),
      withdrawn: t("app.tenders.move.withdrawn", "Withdraw our bid"),
    }[s] || s
  );
}

export function sourceLabel(t, s) {
  return (
    {
      canadabuys: "CanadaBuys",
      sap_ariba: "SAP Ariba",
      merx: "MERX",
      bids_and_tenders: "Bids&Tenders",
      biddingo: "Biddingo",
      email: t("app.tenders.source.email", "By email"),
      other: t("app.tenders.source.other", "Other"),
    }[s] || s
  );
}

export function documentKindLabel(t, k) {
  return (
    {
      solicitation: t("app.tenders.docKind.solicitation", "Solicitation"),
      addendum: t("app.tenders.docKind.addendum", "Addendum"),
      submission: t("app.tenders.docKind.submission", "Our submission"),
      correspondence: t("app.tenders.docKind.correspondence", "Correspondence"),
      award: t("app.tenders.docKind.award", "Award / contract"),
      other: t("app.tenders.docKind.other", "Other"),
    }[k] || k
  );
}

/** Tailwind classes for a status pill — tone only, text always printed. */
export function statusTone(s) {
  if (s === "won") return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100";
  if (s === "lost" || s === "cancelled" || s === "withdrawn" || s === "no_bid")
    return "bg-muted text-muted-foreground";
  if (s === "submitted") return "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100";
  return "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100";
}

/** "3d 4h" / "5h 12m" / "12m" — the countdown, in the reader's words. */
export function countdownText(t, parts) {
  if (parts.days > 0) return t("app.tenders.countdown.days", "{days}d {hours}h", parts);
  if (parts.hours > 0) return t("app.tenders.countdown.hours", "{hours}h {minutes}m", parts);
  return t("app.tenders.countdown.minutes", "{minutes}m", parts);
}
