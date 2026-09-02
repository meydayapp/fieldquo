// app/api/settings/business-info/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { normaliseHours } from "@/lib/company/businessHours";
import { clampWindow } from "@/lib/booking/arrivalWindow";
import { currencyForCountry } from "@/lib/currency";
import { containsMarkupCharacters } from "@/lib/security/rejectMarkupCharacters";

/**
 * Coordinates for a stored address that has none.
 *
 * The mini map on Company Settings is gated on latitude/longitude, and those are
 * only written when someone picks an address from the autocomplete. An address
 * that arrived at SIGNUP has neither — so the map said "Enter an address to
 * preview it on the map" while the address fields right above it were filled in,
 * which reads as the page not working.
 *
 * Geocoded once, on read, and persisted so it costs one Google call ever. Silent
 * on failure: no coordinates means no map, which is what the company already had,
 * and a geocoding outage must not stop Company Settings loading.
 */
async function backfillCoordinates(companyId, company) {
  if (!company?.address) return company;
  if (company.latitude != null && company.longitude != null) return company;

  try {
    const { geocodeAddress } = await import("@/lib/measure/roofMeasurement");
    const full = [company.address, company.city, company.province, company.postalCode]
      .filter(Boolean)
      .join(", ");
    const hit = await geocodeAddress(full);
    if (!hit?.lat || !hit?.lng) return company;

    await db.company.update({
      where: { id: companyId },
      data: { latitude: hit.lat, longitude: hit.lng },
    });
    return { ...company, latitude: hit.lat, longitude: hit.lng };
  } catch (err) {
    console.error("[business-info] coordinate backfill failed:", err?.message);
    return company;
  }
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: {
      name: true,
      email: true,
      phone: true,
      address: true,
      city: true,
      province: true,
      // New — read-only display of what was picked at signup, see
      // app/app/settings/company/page.js
      industries: true,
      // New — Company Settings page (address autocomplete + mini map)
      postalCode: true,
      country: true,
      servesAbroad: true,
      latitude: true,
      longitude: true,
      website: true,
      logoUrl: true,
      logoPublicId: true,
      brandColor: true,
      brandColors: true,
      paymentTerms: true,
      defaultProcessNotes: true,
      taxRate: true,
      paymentMethods: true,
      shareAnonymizedPricing: true,
      bookingSlug: true,
      // New — read-only identity used for the {slug}.fieldquo.com preview
      slug: true,
      // New — "Help clients find my business" toggle
      discoverable: true,
      // New — Tax settings
      taxIdName: true,
      taxIdNumber: true,
      taxRegistrationDismissedAt: true,
      autoApplyLocalTax: true,
      // "It's just me — no crew right now". Written from here (see the PATCH)
      // and read by Settings > Team, which renders the checkbox, and by
      // lib/onboarding.js, which drops the "Invite your team" step while it
      // holds. Company Settings does not render it — the statement belongs
      // beside the roster it is about, not beside the tax fields.
      worksAloneAt: true,
      // Three-state; see the schema comment. Null must survive the round trip
      // to the settings form, because "not answered" is what the control has
      // to be able to show.
      vatRegistered: true,
      taxRates: {
        select: { id: true, name: true, rate: true, isDefault: true },
        orderBy: { createdAt: "asc" },
      },
      // New — Regional settings
      timezone: true,
      dateFormat: true,
      weekStartsOn: true,
      currency: true,
      // When the business is open. Feeds the website's hours block, the
      // "Open now" pill, and openingHoursSpecification in the LocalBusiness
      // JSON-LD — which is what puts opening hours in a Google result.
      businessHours: true,
      defaultVisitMinutes: true,
      bookingModes: true,
      travelCheckEnabled: true,
      travelBufferMinutes: true,
      arrivalWindowMinutes: true,
      // Changes & cancellations. Read by lib/booking/changePolicy.js on the
      // public side and edited on Settings > Booking page — both ends of the
      // same three columns, so neither can be written and never read.
      bookingChangeNoticeHours: true,
      refundVisitFeeOnCancel: true,
      refundCutoffHours: true,
      // New — website/subdomain publish stub
      sitePublished: true,

      stripeAccountId: true,
      stripeOnboarded: true,
      stripeChargesEnabled: true,
      // Offer Affirm pay-over-time alongside card on the invoice pay page.
      // Opt-in: the connected account must have Affirm activated in Stripe.
      offerFinancing: true,
    },
  });

  // One-time geocode so the map works for an address that came from signup.
  const withCoords = await backfillCoordinates(member.companyId, company);

  return NextResponse.json(withCoords);
}

// A year. Not a real policy, just the point past which a number is a typo:
// "8760" hours of notice is already absurd, and anything larger is certainly a
// slipped keypress rather than a contractor's intent.
const MAX_NOTICE_HOURS = 8760;

/**
 * Hours of notice, as typed by a human.
 *
 * REJECTED rather than clamped, and rejected here rather than only in the
 * browser. These two numbers decide whether a stranger may cancel a booked
 * visit and whether money goes back to them (lib/booking/changePolicy.js), so a
 * value nobody can read must not be quietly rewritten into one this file
 * invented — the owner would see it save and never learn it saved something
 * else.
 *
 * `allowNull` covers refundCutoffHours only, where "unset" is a real answer:
 * changePolicy falls it back to the change window rather than to zero.
 *
 * Number(null) is 0 and Number("") is 0 and Number(true) is 1 — all finite, all
 * the most permissive value there is — so the type is checked BEFORE Number(),
 * the same trap changeNoticeHours() guards against on the read side.
 */
function parseNoticeHours(value, { allowNull = false } = {}) {
  const bad = { ok: false, error: "Enter a whole number of hours, 0 or more." };

  if (typeof value !== "number" && typeof value !== "string" && value !== null) {
    return bad;
  }
  // Trimmed first: Number(" ") is 0, so a field containing a space would
  // otherwise save as "cancellable until the van pulls up" — the single most
  // permissive setting there is, arrived at by accident.
  const raw = typeof value === "string" ? value.trim() : value;
  if (raw === null || raw === "") {
    return allowNull ? { ok: true, value: null } : bad;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return bad;
  if (n > MAX_NOTICE_HOURS) {
    return { ok: false, error: "That's more than a year of notice — check the number." };
  }
  return { ok: true, value: n };
}

export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can edit business info" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const {
    name,
    email,
    phone,
    address,
    city,
    province,
    postalCode,
    country,
    latitude,
    longitude,
    website,
    logoUrl,
    logoPublicId,
    brandColor,
    brandColors,
    paymentTerms,
    defaultProcessNotes,
    taxRate,
    paymentMethods,
    shareAnonymizedPricing,
    discoverable,
    taxIdName,
    taxIdNumber,
    taxRegistrationDismissed,
    worksAlone,
    autoApplyLocalTax,
    vatRegistered,
    currency,
    servesAbroad,
    timezone,
    dateFormat,
    weekStartsOn,
    businessHours,
    defaultVisitMinutes,
    bookingModes,
    travelCheckEnabled,
    travelBufferMinutes,
    arrivalWindowMinutes,
    bookingChangeNoticeHours,
    refundVisitFeeOnCancel,
    refundCutoffHours,
    sitePublished,
    offerFinancing,
  } = body;

  // This field reaches a `<script type="application/ld+json">` on the
  // company's public site (app/site/[subdomain]/page.js). The sink escapes
  // it (lib/security/scriptSafeJson.js) so this isn't the fix — it's a second
  // layer that stops a NEW `<`/`>` from being typed in; see
  // lib/security/rejectMarkupCharacters.js.
  if (name !== undefined && containsMarkupCharacters(name)) {
    return NextResponse.json(
      { error: "Company name can't contain < or >" },
      { status: 400 },
    );
  }

  // Validated before anything is written, so a bad cancellation window can't
  // land alongside a good logo change and leave the settings half-saved.
  let noticeHours;
  if (bookingChangeNoticeHours !== undefined) {
    const parsed = parseNoticeHours(bookingChangeNoticeHours);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    noticeHours = parsed.value;
  }
  let cutoffHours;
  if (refundCutoffHours !== undefined) {
    // null is meaningful here and distinct from 0: it means "same notice as the
    // change window", while 0 means "refund right up to the start time".
    const parsed = parseNoticeHours(refundCutoffHours, { allowNull: true });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    cutoffHours = { value: parsed.value }; // boxed, because null is a value here
  }

  // Replacing a logo used to leave the old file on Cloudinary forever. On a
  // shared account that's storage nobody is using and everybody is paying for,
  // and it compounds — a company fiddling with its branding for an afternoon
  // leaves a dozen dead images behind.
  //
  // Deliberately fired before the update and NOT awaited into the response
  // path: if Cloudinary is down or the asset is already gone, the company's
  // branding still saves. A failed cleanup is a housekeeping problem; a failed
  // save is the user's problem.
  if (logoPublicId !== undefined) {
    const current = await db.company.findUnique({
      where: { id: member.companyId },
      select: { logoPublicId: true },
    });

    if (current?.logoPublicId && current.logoPublicId !== logoPublicId) {
      const stale = current.logoPublicId;
      import("@/lib/cloudinary")
        .then(({ deleteAsset }) => deleteAsset(stale))
        .catch((err) =>
          console.error("[branding] couldn't remove old logo:", err?.message),
        );
    }
  }

  // An address typed by hand (rather than picked from the autocomplete) arrives
  // with no coordinates, and stale coordinates from a PREVIOUS address would put
  // the map on the wrong house. So: if the address changed and the caller didn't
  // supply coordinates, look them up.
  let coords = null;
  if (address !== undefined && latitude === undefined && longitude === undefined) {
    const before = await db.company.findUnique({
      where: { id: member.companyId },
      select: { address: true },
    });
    if ((before?.address || "") !== (address || "")) {
      try {
        const { geocodeAddress } = await import("@/lib/measure/roofMeasurement");
        const full = [address, city, province, postalCode].filter(Boolean).join(", ");
        const hit = full ? await geocodeAddress(full) : null;
        // null when it fails, which CLEARS the old coordinates rather than
        // leaving the map pointing at the previous address.
        coords = { latitude: hit?.lat ?? null, longitude: hit?.lng ?? null };
      } catch (err) {
        console.error("[business-info] geocode on save failed:", err?.message);
        coords = { latitude: null, longitude: null };
      }
    }
  }

  // Currency follows the country unless the company bills abroad. Enforced
  // server-side (not just hidden in the UI) so a company that only serves its
  // home country can't end up with a mismatched stored currency. Loads the
  // current country/servesAbroad so a partial PATCH still resolves correctly.
  let enforcedCurrency = currency; // used only when servesAbroad is on
  if (servesAbroad !== undefined || country !== undefined || currency !== undefined) {
    const cur = await db.company.findUnique({
      where: { id: member.companyId },
      select: { country: true, servesAbroad: true },
    });
    const nextServesAbroad =
      servesAbroad !== undefined ? Boolean(servesAbroad) : Boolean(cur?.servesAbroad);
    const nextCountry = country !== undefined ? country : cur?.country;
    if (!nextServesAbroad) enforcedCurrency = currencyForCountry(nextCountry);
  }

  const updated = await db.company.update({
    where: { id: member.companyId },
    data: {
      ...(coords || {}),
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
      ...(city !== undefined && { city }),
      ...(province !== undefined && { province }),
      ...(postalCode !== undefined && { postalCode }),
      ...(country !== undefined && { country }),
      ...(latitude !== undefined && { latitude }),
      ...(longitude !== undefined && { longitude }),
      ...(website !== undefined && { website }),
      ...(logoUrl !== undefined && { logoUrl }),
      ...(logoPublicId !== undefined && { logoPublicId }),
      ...(brandColor !== undefined && { brandColor }),
      ...(brandColors !== undefined && { brandColors }),
      ...(paymentTerms !== undefined && { paymentTerms }),
      ...(defaultProcessNotes !== undefined && { defaultProcessNotes }),
      ...(taxRate !== undefined && { taxRate }),
      ...(paymentMethods !== undefined && { paymentMethods }),
      ...(shareAnonymizedPricing !== undefined && { shareAnonymizedPricing }),
      ...(discoverable !== undefined && { discoverable }),
      ...(taxIdName !== undefined && { taxIdName }),
      ...(taxIdNumber !== undefined && { taxIdNumber }),
      // "I don't have one", from the checkbox beside the field. Stored as a
      // timestamp rather than a boolean so the record says WHEN they said it —
      // useful the day someone asks why the reminder stopped.
      //
      // Entering a number clears the flag on the same save: the two answers
      // contradict each other, and leaving a stale "not registered" beside a
      // real registration number is the kind of quiet inconsistency that
      // outlives whoever created it.
      ...(String(taxIdNumber ?? "").trim()
        ? { taxRegistrationDismissedAt: null }
        : taxRegistrationDismissed !== undefined && {
            taxRegistrationDismissedAt: taxRegistrationDismissed ? new Date() : null,
          }),
      // "It's just me — no crew right now", from the checkbox on Settings >
      // Team. Same shape as the tax answer above and for the same reason: a
      // timestamp rather than a boolean, so the record says WHEN they said it.
      //
      // No counterpart to the "entering a number clears the flag" clause
      // above, because nothing this route writes can contradict it — hiring
      // happens through the members routes, not here. That contradiction is
      // settled at READ time instead: lib/onboarding.js only honours the claim
      // while the roster still says one person, so an owner who hires and
      // never comes back to untick this gets the team step back anyway.
      ...(worksAlone !== undefined && {
        worksAloneAt: worksAlone ? new Date() : null,
      }),
      // Only true and false are written; anything else (including the string
      // "" the radio group sends for "not answered") stores null. That is what
      // keeps the third state reachable — a company that answered and then
      // changed its mind can get back to "we haven't said", and the tax lookup
      // goes back to refusing rather than asserting.
      ...(vatRegistered !== undefined && {
        vatRegistered: vatRegistered === true || vatRegistered === false ? vatRegistered : null,
      }),
      ...(autoApplyLocalTax !== undefined && { autoApplyLocalTax }),
      ...(timezone !== undefined && { timezone }),
      ...(dateFormat !== undefined && { dateFormat }),
      ...(weekStartsOn !== undefined && { weekStartsOn }),
      // Clamped to a sane range rather than trusted: a 0-minute visit makes
      // computeAvailability emit infinite slots, and a 10-hour one emits none.
      ...(defaultVisitMinutes !== undefined && {
        defaultVisitMinutes: Math.min(480, Math.max(10, Number(defaultVisitMinutes) || 60)),
      }),
      // Filtered to the known set, and never allowed to be empty: a company with
      // no bookable modes has a booking page that cannot be completed. Falls back
      // to a site visit, which is the default for a field trade.
      ...(Array.isArray(bookingModes) && {
        bookingModes: (() => {
          const clean = bookingModes.filter((m) => ["call", "visit", "video"].includes(m));
          return clean.length ? clean : ["visit"];
        })(),
      }),
      ...(travelCheckEnabled !== undefined && {
        travelCheckEnabled: Boolean(travelCheckEnabled),
      }),
      // Clamped, not trusted. This number ADDS to the drive between jobs, so a
      // fat-fingered 600 would quietly empty the booking page — every slot
      // ten hours from the last one. Two hours is already generous for
      // parking, unloading and writing up the previous job.
      ...(travelBufferMinutes !== undefined && {
        travelBufferMinutes: Math.min(120, Math.max(0, Math.round(Number(travelBufferMinutes) || 0))),
      }),
      // Clamped by the same helper the renderer uses, so what's stored and
      // what's shown can't disagree.
      ...(arrivalWindowMinutes !== undefined && {
        arrivalWindowMinutes: clampWindow(arrivalWindowMinutes),
      }),
      // The three columns lib/booking/changePolicy.js reads. Validated above,
      // never clamped — see parseNoticeHours.
      ...(noticeHours !== undefined && { bookingChangeNoticeHours: noticeHours }),
      ...(refundVisitFeeOnCancel !== undefined && {
        refundVisitFeeOnCancel: Boolean(refundVisitFeeOnCancel),
      }),
      ...(cutoffHours !== undefined && { refundCutoffHours: cutoffHours.value }),
      // enforcedCurrency, not the raw body value: when the company doesn't serve
      // abroad this is the country-derived currency regardless of what was sent.
      ...(enforcedCurrency !== undefined && { currency: enforcedCurrency }),
      ...(servesAbroad !== undefined && { servesAbroad: Boolean(servesAbroad) }),
      // Normalised on the way in, not trusted. This column is read by the
      // public website and by the structured data a search engine indexes, so
      // a close time earlier than the open time would become a Google listing
      // that says "Closes 8 AM". normaliseHours treats that as closed rather
      // than guessing which of the two numbers was the typo.
      //
      // `null` is meaningful and distinct from an empty array: it means "never
      // told us", which renders as nothing. Seven closed days means "shut all
      // week", which renders as a table of closures.
      ...(businessHours !== undefined && {
        businessHours:
          businessHours === null ? null : normaliseHours(businessHours),
      }),
      ...(sitePublished !== undefined && { sitePublished }),
      ...(offerFinancing !== undefined && {
        offerFinancing: Boolean(offerFinancing),
      }),
    },
  });

  // Record which fields changed — enough for support to answer "who changed
  // the tax rate / branding / hours", without dumping full before/after values.
  const changed = Object.keys(body).filter((k) => body[k] !== undefined);
  await recordActivity(member, {
    action: "settings.business_info_updated",
    entityType: "settings",
    summary: `Updated business settings: ${changed.join(", ") || "—"}`,
    metadata: { fields: changed },
  });

  return NextResponse.json(updated);
}
