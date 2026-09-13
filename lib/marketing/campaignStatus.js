// lib/marketing/campaignStatus.js
//
// What a person may do to a MarketingCampaign's status, and what each status
// means on screen. One table, read by the list, the detail page and the PATCH
// route, so the three cannot disagree about which button exists.
//
// ── Who writes each status ─────────────────────────────────────────────────
//
// `completed` and `partial` are written by ONE place, the email send route,
// from what actually happened to the deliveries. Nothing here sets them and
// the PATCH route refuses them from a browser — a campaign that says "sent"
// must have been sent.
//
// `active`, `paused`, `archived` and a return to `draft` are a person's
// statement: the route is being walked, the ad set is on, it is on hold, it is
// over. Before this file existed the schema had `active` and no screen ever
// wrote it, so the chip on the list said "draft" for every pamphlet campaign
// ever created, however many doors it had knocked on.
//
// ── Archive, never delete ──────────────────────────────────────────────────
//
// DELETE /api/marketing/campaigns/[id] had no caller and would have cascaded
// the stops (the doorstep record), the deliveries (the proof of who was
// emailed) and the budget. It is gone. A campaign that is over is archived:
// the list hides it behind "Show archived", the Spend page stops counting
// its budget, and every row it owns is still there.

/** Every status a browser may ASK for. `completed`/`partial` are not here. */
export const SETTABLE_STATUSES = Object.freeze(["draft", "active", "paused", "archived"]);

/** Chip label keys — the raw enum word was what the list printed. */
export const STATUS_LABEL_KEY = Object.freeze({
  draft: "app.marketing.status.draft",
  active: "app.marketing.status.active",
  paused: "app.marketing.status.paused",
  completed: "app.marketing.status.completed",
  partial: "app.marketing.status.partial",
  archived: "app.marketing.status.archived",
});

/**
 * The actions offered for a campaign, in the order the buttons render.
 *
 * Each is { action, to, labelKey }. `to` is the status the PATCH sends;
 * `labelKey` the button's catalogue key. Email campaigns get no
 * Activate/Pause: sending IS the act for an email blast, and a chip reading
 * "Active" on one that has not been sent would claim something the send
 * route has not done. Everything can be archived; an archived campaign can
 * only be restored (to draft — the row keeps no memory of what it was, and
 * "draft" is the honest word for "back on the list, say what it is now").
 */
export function campaignActions(campaign) {
  if (!campaign) return [];
  const { status, type } = campaign;
  if (status === "archived") {
    return [{ action: "restore", to: "draft", labelKey: "app.marketing.action.restore" }];
  }
  const out = [];
  const isEmail = type === "email";
  if (!isEmail) {
    if (status === "draft" || status === "paused") {
      out.push({
        action: status === "paused" ? "resume" : "activate",
        to: "active",
        labelKey: status === "paused" ? "app.marketing.action.resume" : "app.marketing.action.activate",
      });
    } else if (status === "active") {
      out.push({ action: "pause", to: "paused", labelKey: "app.marketing.action.pause" });
    }
  }
  out.push({ action: "archive", to: "archived", labelKey: "app.marketing.action.archive" });
  return out;
}

/**
 * Whether `to` is a status this campaign may be moved to by a person. The
 * route calls this rather than trusting the button that was pressed: a
 * hand-built request asking an email campaign to become "active", or any
 * campaign to become "completed", is refused the same way.
 */
export function canSetStatus(campaign, to) {
  if (!SETTABLE_STATUSES.includes(to)) return false;
  return campaignActions(campaign).some((a) => a.to === to);
}

/** Archived campaigns are hidden from the list unless asked for. */
export function isArchived(campaign) {
  return campaign?.status === "archived";
}
