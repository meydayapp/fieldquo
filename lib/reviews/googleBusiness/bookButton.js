// lib/reviews/googleBusiness/bookButton.js
//
// The "Book" button on a company's Google Business Profile — the one Google
// Search and Maps draw beside Call and Directions — pointed at the company's
// FieldQuo booking page. Settings › Booking Page offers it two ways: the link
// and Google's own manual steps (always), and "Add it for me" (only when
// googleBusinessAvailable() and a listing is picked). This file is the second.
//
// ── Which type: APPOINTMENT, not ONLINE_APPOINTMENT ────────────────────────
//
// Google's PlaceActionType enum (developers.google.com/my-business/reference/
// placeactions/rest/v1/locations.placeActionLinks) says APPOINTMENT is
// "booking an appointment" and ONLINE_APPOINTMENT is "booking an online
// appointment". The second is the appointment HELD online — Google's help
// page for these links (support.google.com/business/answer/6218037) lists
// that button separately, for "a list of services (such as telemedicine or
// virtual)". A contractor's booking page books a site visit, a phone call or
// a video call; the visit is the default and the common case, so the booking
// PAGE is an appointment page, not a virtual-care one. It is exactly the
// "Book an appointment" link the owner would add by hand.
//
// ── Only ever our own link ──────────────────────────────────────────────────
//
// A profile can carry other links of the same type — a Reserve-with-Google
// partner (providerType AGGREGATOR_3P, not editable by us), another booking
// tool, one the owner typed. FieldQuo touches exactly one: the APPOINTMENT
// link whose uri IS this company's booking page. Google keys a link on
// (location, uri, type) — its create call treats a repeat of that triple as
// the same link — so the uri alone identifies ours, and the browser never
// names a link to delete: the server re-lists and matches.
//
// That is also why the link's resource name is not stored. Storing it would
// need a new column (a schema change and a db push this change is not
// allowed to make), and it would add nothing: Google's own key is the triple,
// and a name stored here could go stale the moment the owner edits the
// profile by hand, where a fresh list cannot.
//
// Every function takes `google` (defaultBusinessGoogle's shape) so the check
// executes the whole thing against a scripted fake — and the route, against a
// stubbed fetch, runs the real client.

import { db as realDb } from "@/lib/db";
import { defaultBusinessGoogle, placeActionParent } from "./client";
import { quotaMessage } from "./sync";

export const BOOK_ACTION_TYPE = "APPOINTMENT";

/**
 * The public booking page's URL — the same `bookingSlug || slug` the page's
 * resolver (lib/booking/findBookingCompany.js) prefers and Settings › Lead
 * Capture Form hands out. Null when there is nothing to point at.
 */
export function bookingPageUrl(origin, company) {
  const base = String(origin || "").trim().replace(/\/+$/, "");
  const slug = String(company?.bookingSlug || company?.slug || "").trim();
  if (!base || !slug) return null;
  return `${base}/book/${encodeURIComponent(slug)}`;
}

/**
 * Google shows this link to strangers on Search and Maps, so it must be a
 * real public https address. A preview deployment on http://localhost would
 * otherwise be pushed onto a live listing.
 */
export function pushableUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (/^(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(u.hostname) || /\.(localhost|test)$/i.test(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

/** Same page? Case-insensitive host, trailing slash ignored, nothing else forgiven. */
export function sameUri(a, b) {
  const norm = (v) => {
    try {
      const u = new URL(String(v || "").trim());
      return `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, "")}${u.search}`;
    } catch {
      return null;
    }
  };
  const x = norm(a);
  return Boolean(x) && x === norm(b);
}

/**
 * The links on a listing that are ours, pure. Ours = an APPOINTMENT link whose
 * uri is this booking page, named under this location, and not marked
 * uneditable by Google (an aggregator's). Everything else is somebody else's.
 */
export function ourLinks(links, { parent, bookingUrl }) {
  return (Array.isArray(links) ? links : []).filter(
    (l) =>
      l &&
      l.placeActionType === BOOK_ACTION_TYPE &&
      l.isEditable !== false &&
      typeof l.name === "string" &&
      l.name.startsWith(`${parent}/placeActionLinks/`) &&
      sameUri(l.uri, bookingUrl),
  );
}

/** What the browser may see of a link. */
export function publicLinkShape(link) {
  if (!link) return null;
  return {
    uri: link.uri || null,
    isPreferred: link.isPreferred === true,
    createTime: link.createTime || null,
  };
}

/**
 * Is the booking page something a stranger can actually book on? The public
 * flow (app/book/[companySlug]/BookingFlow.js) offers the bookable estimators
 * or the active booking types, and a type only has times when the person it
 * belongs to has bookable hours (computeAvailableSlots reads
 * AvailabilitySchedule by the type's userId and returns nothing without
 * rows). The availability routes create each estimator's consultation type
 * the moment their hours are saved (lib/booking/bookableMembers.js), so "an
 * active type whose person has hours" is the whole answer.
 *
 * Read-only on purpose: listBookableMembers would answer the same question but
 * CREATES missing types as it goes, and this runs on a GET a read-only
 * support session may make.
 */
export async function bookingPageLive(companyId, db = realDb) {
  if (!companyId) return false;
  const types = await db.eventType.findMany({
    where: { companyId, active: true, userId: { not: null } },
    select: { userId: true },
  });
  const userIds = [...new Set(types.map((t) => t.userId).filter(Boolean))];
  if (!userIds.length) return false;
  const hours = await db.availabilitySchedule.count({ where: { userId: { in: userIds } } });
  return hours > 0;
}

/**
 * Google's refusal → a sentence about THIS feature, pure. quotaMessage()
 * (sync.js) words the quota case for reviews ("paste your reviews in
 * below"), which is the wrong advice here, and it reads every 403 as "the
 * account must be an owner or manager" — but the first 403 this feature is
 * likely to meet is the Place Actions API not being enabled in FieldQuo's
 * Cloud project, which no contractor can fix. That one names whose step it
 * is; the rest fall through to quotaMessage unchanged.
 */
export function bookButtonMessage(result) {
  const status = Number(result?.status) || 0;
  const said = String(result?.message || "").trim();
  const reason = String(result?.reason || "").toUpperCase();
  if (status === 403 && /has not been used in project|is disabled|SERVICE_DISABLED|accessNotConfigured/i.test(`${said} ${reason}`)) {
    return {
      kind: "api_disabled",
      message:
        `Google's Place Actions API is not switched on for FieldQuo yet. That is a step on FieldQuo's side, not yours — add the link by hand with the steps above for now. ` +
        `Google said: "${said || "API disabled"}"`,
    };
  }
  if (status === 429 || (status === 403 && /quota|RESOURCE_EXHAUSTED|rate ?limit/i.test(`${said} ${reason}`))) {
    return {
      kind: "quota",
      message: `Google is not accepting this request from FieldQuo right now. Add the link by hand with the steps above. Google said: "${said || "Quota exceeded"}"`,
    };
  }
  return quotaMessage(result);
}

async function tokenAndParent(connection, google) {
  const parent = placeActionParent(connection?.locationName);
  if (!connection || !parent) {
    return { refusal: { ok: false, kind: "no_location", message: "Pick your Google listing in Settings › Reviews first." } };
  }
  let token;
  try {
    token = await google.accessTokenFor(connection);
  } catch (err) {
    return { refusal: { ok: false, kind: "auth", message: `Stored token could not be read: ${err?.message || "unknown"}` } };
  }
  if (!token?.ok) return { refusal: { ok: false, ...bookButtonMessage(token) } };
  return { parent, accessToken: token.accessToken };
}

async function listAll(google, accessToken, parent) {
  const out = [];
  let pageToken = null;
  let pages = 0;
  do {
    const page = await google.listPlaceActionLinks({ accessToken, parent, placeActionType: BOOK_ACTION_TYPE, pageToken });
    if (!page.ok) return { refusal: { ok: false, ...bookButtonMessage(page) } };
    out.push(...(Array.isArray(page.data?.placeActionLinks) ? page.data.placeActionLinks : []));
    pageToken = page.data?.nextPageToken || null;
    // A listing has a handful of links; fifty pages is a runaway token, not data.
  } while (pageToken && ++pages < 50);
  return { links: out };
}

/**
 * Is our link on the listing right now?
 * @returns {{ ok:true, onGoogle:boolean, link }|{ ok:false, kind, message }}
 */
export async function bookButtonStatus({ connection, bookingUrl, google = defaultBusinessGoogle }) {
  const auth = await tokenAndParent(connection, google);
  if (auth.refusal) return auth.refusal;
  const listed = await listAll(google, auth.accessToken, auth.parent);
  if (listed.refusal) return listed.refusal;
  const mine = ourLinks(listed.links, { parent: auth.parent, bookingUrl });
  return { ok: true, onGoogle: mine.length > 0, link: publicLinkShape(mine[0]) };
}

/**
 * Put the booking page on the listing. Lists first: if the link is already
 * there — added here earlier, or by hand with the same address — nothing is
 * created and the answer says so.
 *
 * @returns {{ ok:true, status:"created"|"already", link }|{ ok:false, kind, message }}
 */
export async function addBookButton({ connection, bookingUrl, preferred = false, google = defaultBusinessGoogle }) {
  if (!pushableUrl(bookingUrl)) {
    return { ok: false, kind: "not_https", message: "Google needs a public https address for the Book button." };
  }
  const auth = await tokenAndParent(connection, google);
  if (auth.refusal) return auth.refusal;
  const listed = await listAll(google, auth.accessToken, auth.parent);
  if (listed.refusal) return listed.refusal;
  const mine = ourLinks(listed.links, { parent: auth.parent, bookingUrl });
  if (mine.length) return { ok: true, status: "already", link: publicLinkShape(mine[0]) };

  const created = await google.createPlaceActionLink({
    accessToken: auth.accessToken,
    parent: auth.parent,
    link: { uri: bookingUrl, placeActionType: BOOK_ACTION_TYPE, isPreferred: preferred === true },
  });
  if (!created.ok) return { ok: false, ...bookButtonMessage(created) };
  return { ok: true, status: "created", link: publicLinkShape(created.data || { uri: bookingUrl, isPreferred: preferred === true }) };
}

/**
 * Take our link off the listing — and only ours (ourLinks above). A listing
 * with no link of ours answers "not_found", not an error: the end state the
 * company asked for is true.
 *
 * @returns {{ ok:true, status:"removed"|"not_found", removed:number }|{ ok:false, kind, message }}
 */
export async function removeBookButton({ connection, bookingUrl, google = defaultBusinessGoogle }) {
  const auth = await tokenAndParent(connection, google);
  if (auth.refusal) return auth.refusal;
  const listed = await listAll(google, auth.accessToken, auth.parent);
  if (listed.refusal) return listed.refusal;
  const mine = ourLinks(listed.links, { parent: auth.parent, bookingUrl });
  if (!mine.length) return { ok: true, status: "not_found", removed: 0 };
  let removed = 0;
  for (const link of mine) {
    const res = await google.deletePlaceActionLink({ accessToken: auth.accessToken, name: link.name });
    if (!res.ok) return { ok: false, removed, ...bookButtonMessage(res) };
    removed++;
  }
  return { ok: true, status: "removed", removed };
}
