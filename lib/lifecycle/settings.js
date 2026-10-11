// lib/lifecycle/settings.js
//
// The two things about the trial sequence only a FieldQuo person can supply,
// stored as PlatformSetting rows and edited by a superadmin on
// /platform/companies (app/platform/companies/LifecycleEmailsCard.js):
//
//   1. WHO the personal day-3 note is from — name, title, a reply-to that
//      reaches that person, an optional phone, an optional booking link. The
//      owner has not said whose name it is. Until a name AND a reply-to are
//      set, the note is NOT sent (personalSenderReady) — never from a made-up
//      person, never from "the FieldQuo team" dressed up as one — and the
//      console says so in those words.
//   2. The customer stories the help-articles letter may show — title, trade,
//      a link, an optional image. Empty list, no block: never an invented
//      story (AGENTS.md failure class 5; the brief's rule on testimonials).
//
// Pure: normalise (whatever was stored → a usable value, junk dropped) and
// validate (a PUT body → { ok, value } or a sentence saying what is wrong),
// so scripts/check-lifecycle-emails.mjs runs both against hostile input.

import { emailProblem } from "@/lib/validation";
import { heroSrcAllowed } from "@/lib/email/platformLayout";
import { INDUSTRIES } from "@/app/data/industries";

export const PERSONAL_SENDER_KEY = "lifecycle.personalSender";
export const CUSTOMER_STORIES_KEY = "lifecycle.customerStories";

export const STORIES_MAX = 8;
/** The trades a story can be filed under — the discovery trades, the same keys a company's industries map to. */
export const STORY_TRADES = Object.freeze([...new Set(INDUSTRIES.map((i) => i.tradeKey).filter(Boolean))].sort());

const str = (v, max) => {
  const s = String(v ?? "").replace(/[\r\n\t]+/g, " ").trim();
  return s.length > max ? "" : s;
};

function httpsUrl(v) {
  const s = String(v ?? "").trim();
  if (!s || s.length > 500) return "";
  try {
    const u = new URL(s);
    return u.protocol === "https:" && !u.username && !u.password ? u.toString() : "";
  } catch {
    return "";
  }
}

const PHONE = /^[0-9+()\-.\s]{7,25}(\s*(ext|x)\.?\s*\d{1,6})?$/i;

/** Whatever was stored → { name, title, replyTo, phone, bookingUrl }, each "" when absent or unusable. */
export function normalisePersonalSender(value) {
  const v = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const replyTo = str(v.replyTo, 254);
  const phone = str(v.phone, 40);
  return {
    name: str(v.name, 80),
    title: str(v.title, 80),
    replyTo: replyTo && emailProblem(replyTo) === null ? replyTo : "",
    phone: phone && PHONE.test(phone) ? phone : "",
    bookingUrl: httpsUrl(v.bookingUrl),
  };
}

/** Can the personal note go out? A real name and a reply-to that reaches them. */
export function personalSenderReady(sender) {
  const s = normalisePersonalSender(sender);
  return Boolean(s.name && s.replyTo);
}

/** A PUT body → { ok, value } | { ok: false, error }. Empty strings clear a field. */
export function validatePersonalSender(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "Expected an object." };
  const out = {};
  const raw = (k) => String(body[k] ?? "").trim();
  if (raw("name").length > 80) return { ok: false, error: "The name is longer than 80 characters." };
  if (raw("title").length > 80) return { ok: false, error: "The title is longer than 80 characters." };
  out.name = raw("name");
  out.title = raw("title");
  if (raw("replyTo") && emailProblem(raw("replyTo")) !== null) return { ok: false, error: "The reply-to isn't a valid email address." };
  out.replyTo = raw("replyTo");
  if (raw("phone") && !PHONE.test(raw("phone"))) return { ok: false, error: "The phone number has characters a phone number doesn't." };
  out.phone = raw("phone");
  if (raw("bookingUrl") && !httpsUrl(raw("bookingUrl"))) return { ok: false, error: "The booking link must be a full https:// address." };
  out.bookingUrl = raw("bookingUrl") ? httpsUrl(raw("bookingUrl")) : "";
  return { ok: true, value: out };
}

/** Whatever was stored → the usable stories, in order; anything unusable is dropped, not repaired. */
export function normaliseStories(value, { cloudName } = {}) {
  const list = Array.isArray(value) ? value : [];
  const out = [];
  for (const s of list) {
    if (!s || typeof s !== "object") continue;
    const title = str(s.title, 140);
    const url = httpsUrl(s.url);
    if (!title || !url) continue;
    const trade = STORY_TRADES.includes(s.trade) ? s.trade : "";
    const imageUrl = s.imageUrl && heroSrcAllowed(s.imageUrl, cloudName !== undefined ? { cloudName } : undefined) ? String(s.imageUrl) : "";
    out.push({ title, trade, url, imageUrl });
    if (out.length >= STORIES_MAX) break;
  }
  return out;
}

/** A PUT body ({ stories: [...] }) → { ok, value } | { ok: false, error }. */
export function validateStories(body, { cloudName } = {}) {
  const list = body?.stories;
  if (!Array.isArray(list)) return { ok: false, error: "Expected { stories: [...] }." };
  if (list.length > STORIES_MAX) return { ok: false, error: `At most ${STORIES_MAX} stories.` };
  for (const [i, s] of list.entries()) {
    const n = i + 1;
    if (!s || typeof s !== "object") return { ok: false, error: `Story ${n} is empty.` };
    if (!str(s.title, 140)) return { ok: false, error: `Story ${n} needs a title (up to 140 characters).` };
    if (!httpsUrl(s.url)) return { ok: false, error: `Story ${n} needs a full https:// link.` };
    if (s.trade && !STORY_TRADES.includes(s.trade)) return { ok: false, error: `Story ${n}'s trade isn't one FieldQuo knows.` };
    if (s.imageUrl && !heroSrcAllowed(s.imageUrl, cloudName !== undefined ? { cloudName } : undefined)) {
      return { ok: false, error: `Story ${n}'s image must be hosted by FieldQuo (www.fieldquo.com or FieldQuo's Cloudinary) — email images are never hotlinked.` };
    }
  }
  return { ok: true, value: normaliseStories(list, { cloudName }) };
}

/** The stories one letter shows: this trade's first, then the ones filed under no trade. Never another trade's. */
export function storiesFor(stories, tradeKey, limit = 2) {
  const list = Array.isArray(stories) ? stories : [];
  const own = tradeKey ? list.filter((s) => s.trade === tradeKey) : [];
  const any = list.filter((s) => !s.trade);
  return [...own, ...any].slice(0, limit);
}
