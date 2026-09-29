// lib/marketing/videoAllowance.js
//
// How many video posts a company may make this month, and what a "Video pack"
// costs. The ONE file these numbers live in: the video screen, the upload
// gate, the pack checkout, the pricing page and the help article all read
// them from here, so no copy can drift from what the gate enforces.
//
// ══ The rule (owner, 2026-09-29) ════════════════════════════════════════════
//
//   - A video is ONE clip, up to 2:30 (150 s). A longer clip is refused before
//     it uploads, and Cloudinary trims anything that slips past at 2:30
//     (the incoming transformation's eo_150 — lib/marketing/videoPost.js).
//   - One video counts ONCE, whatever its length (3 s or 2:30) and however many
//     places it is posted to (Instagram, Facebook and TikTok = still one).
//   - Every plan includes 5 videos a calendar month, in the company's own
//     time zone (Company.timezone).
//   - A "Video pack" is a monthly add-on: US$77/month for up to 90 more videos
//     a month. More than one pack stacks (5 + 90 × packs).
//   - A video is COUNTED when it arrives prepared — uploaded and converted by
//     Cloudinary — because that is when Cloudinary charges for it. A clip still
//     on its way in is RESERVED so ten uploads started at once cannot all slip
//     under the last free slot; a clip that never arrives stops reserving
//     (UPLOAD_RESERVATION_HOURS) and is never counted.
//   - When the month is used up, a new upload is refused with the reason and,
//     for an owner or admin, an "Add a video pack" button. Never a silent
//     failure, never an upload that is accepted and then thrown away.
//
// ══ Worked example (asserted by scripts/check-video-posts.mjs) ═════════════
//
//   One pack. 95 videos made this month: 5 included + 90 from the pack = 95
//   of 95 used. The 96th is refused: "You've used all 95 videos for this
//   month" + "Add another video pack" (owner/admin) or "Ask an owner or admin
//   to add a video pack" (everyone else). Length does not change the count:
//   95 clips of 2:30 is still 95.
//
// ══ Why US$77 (owner, 2026-09-29) ══════════════════════════════════════════
//
//   Cloudinary Plus: ~0.39 credits per minute of 1080p video (≈0.24 processing
//   the incoming transformation + ≈0.06 storage + ≈0.09 bandwidth as Meta and
//   TikTok download it) at ~US$0.44/credit ≈ US$0.17 per minute.
//
//   Priced at the WORST case: 90 videos × 2.5 min × US$0.17 ≈ US$38 of cost,
//   × 2 = US$77. The ×2 is a deliberate buffer for what nobody can forecast —
//   a Cloudinary price change, a clip re-uploaded or re-cropped, a platform
//   retrying its download. Typical short clips widen the margin further
//   (90 × 1 min ≈ US$15 of cost).
//
//   USD only, for the same reason as the AI credit plans
//   (lib/ai/creditBundle.js bundleAvailability): the cost is in US dollars,
//   and Stripe holds one currency per customer across its subscriptions.
//
// Pure: no database, no Stripe. The server half is lib/marketing/videoPack.js
// and lib/marketing/videoPostServer.js.

import { resolveWallClock, DEFAULT_TIMEZONE } from "../time/wallClock.js";

/** Longest clip a video post takes, in seconds (2:30). */
export const VIDEO_MAX_SECONDS = 150;

/** Videos every plan includes each calendar month. */
export const INCLUDED_VIDEOS_PER_MONTH = 5;

/** The monthly add-on. `priceCents` is what Stripe is asked to charge. */
export const VIDEO_PACK = Object.freeze({
  key: "video_pack_90",
  videos: 90,
  priceCents: 7700,
  currency: "USD",
  interval: "month",
});

/** A clip that was signed but never arrived stops holding a slot after this. */
export const UPLOAD_RESERVATION_HOURS = 3;

/** One clip = one video. Stated as a function so there is one place to change it. */
export function videosFor(/* clip */) {
  return 1;
}

/** "$77" / "$77.50" — from the constant, never typed into a page. */
export function formatPackPrice(cents = VIDEO_PACK.priceCents) {
  const n = Number(cents) / 100;
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

/** "2:30" for 150. */
export function formatClipLength(seconds = VIDEO_MAX_SECONDS) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function partsIn(date, timeZone) {
  try {
    const f = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" });
    const parts = Object.fromEntries(f.formatToParts(date).map((p) => [p.type, p.value]));
    return { year: Number(parts.year), month: Number(parts.month) };
  } catch {
    return null;
  }
}

/**
 * The calendar month `now` falls in, in `timeZone`, as UTC instants
 * [start, end). An unknown zone uses the schema's own default — the same
 * value Postgres writes for a company that never chose one.
 */
export function monthWindow(now = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const zone = partsIn(now, timeZone) ? timeZone : DEFAULT_TIMEZONE;
  const { year, month } = partsIn(now, zone);
  const pad = (n) => String(n).padStart(2, "0");
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return {
    start: resolveWallClock(`${year}-${pad(month)}-01T00:00`, zone),
    end: resolveWallClock(`${next.year}-${pad(next.month)}-01T00:00`, zone),
    timeZone: zone,
    label: `${year}-${pad(month)}`,
  };
}

/** Is this pack paying for today? Only a paid period counts — see VideoPack.paidThrough. */
export function packCountsNow(pack, now = new Date()) {
  const through = pack?.paidThrough ? new Date(pack.paidThrough) : null;
  return Boolean(through) && !Number.isNaN(through.getTime()) && through > now;
}

/** The month's allowance: the plan's 5, plus 90 for every pack paid for today. */
export function allowanceFor(packs = [], now = new Date()) {
  const active = (Array.isArray(packs) ? packs : []).filter((p) => packCountsNow(p, now)).length;
  return {
    included: INCLUDED_VIDEOS_PER_MONTH,
    packs: active,
    fromPacks: active * VIDEO_PACK.videos,
    total: INCLUDED_VIDEOS_PER_MONTH + active * VIDEO_PACK.videos,
  };
}

/**
 * May one more clip start uploading?
 *
 * @param {{ used: number, reserved: number, allowance: {total:number} }} a
 *   used — clips counted this month; reserved — clips on their way in.
 * @returns {{ ok: boolean, code?: "allowance_used", used, reserved, total, remaining }}
 */
export function decideNewVideo({ used = 0, reserved = 0, allowance }) {
  const total = Math.max(0, Number(allowance?.total) || 0);
  const u = Math.max(0, Math.floor(Number(used) || 0));
  const r = Math.max(0, Math.floor(Number(reserved) || 0));
  const remaining = Math.max(0, total - u - r);
  if (remaining < videosFor()) return { ok: false, code: "allowance_used", used: u, reserved: r, total, remaining };
  return { ok: true, used: u, reserved: r, total, remaining };
}
