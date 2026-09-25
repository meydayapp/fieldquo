// app/api/street-view/route.js
//
// GET ?kind=lead|client|job|quote&id=…   a staff record, /app session
// GET ?token=…                           the client-facing quote (/q/[token])
//
// Answers whether there is an outdoor Street View of the record's property
// and, when there is, the Maps Embed URL the "See the property" button puts
// in an iframe WHEN TAPPED. Nothing loads before the tap: this route makes
// one free metadata request (lib/maps/streetView.js) and returns a URL; the
// panorama itself is only fetched by the browser once somebody asks for it.
//
// ══ Never an open proxy ════════════════════════════════════════════════════
//
// The address is resolved HERE from a record the caller may read
// (lib/maps/streetViewTarget.js) — the browser sends an id or a share token
// and never an address, a coordinate or a key. A request carrying one of those
// is refused with 400, not silently ignored, so a test can see the refusal.
// Another company's id, a bad token and a draft opened by a stranger all
// answer the same 404 a wrong id gets on the record's own page.
//
// ══ What the answer never contains ═════════════════════════════════════════
//
// The address. The client-facing quote deliberately prints only the job
// address, never the homeowner's own (app/api/public/quotes/[token]), and a
// JSON field here would undo that. The Maps link is built from the panorama.
// The server key either — the embed URL carries NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
// the browser key that is public already (see lib/maps/streetView.js).
//
// ══ No imagery is no button ════════════════════════════════════════════════
//
// ZERO_RESULTS, REQUEST_DENIED (the API not enabled on the key), a timeout, no
// browser key — all answer `{ available: false }` with status 200, and the
// component renders nothing. There is never a grey "no imagery" box.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { serverMapsKey } from "@/lib/measure/roofMeasurement";
import {
  parseStreetViewQuery,
  fetchStreetViewMetadata,
  streetViewEmbedUrl,
  mapsPanoUrl,
  bearingDegrees,
} from "@/lib/maps/streetView";
import { staffStreetViewTarget, publicStreetViewTarget } from "@/lib/maps/streetViewTarget";

// Nothing is cached anywhere — see "Why nothing is cached" in
// lib/maps/streetView.js. The metadata is free, so a cache would save nothing.
const NO_STORE = { "Cache-Control": "private, no-store" };

const REFUSALS = {
  address_not_accepted: { status: 400, error: "This route looks a property up from a record, not from an address." },
  bad_request: { status: 400, error: "Name a record." },
  not_found: { status: 404, error: "Not found" },
};

function refuse(reason) {
  const r = REFUSALS[reason] || REFUSALS.not_found;
  return NextResponse.json({ error: r.error }, { status: r.status, headers: NO_STORE });
}

const unavailable = () => NextResponse.json({ available: false }, { headers: NO_STORE });

export async function GET(request) {
  const query = parseStreetViewQuery(new URL(request.url).searchParams);
  if (!query.ok) return refuse(query.reason);

  let target;
  if (query.token) {
    target = await publicStreetViewTarget({ request, token: query.token });
    if (!target) return refuse("not_found");
  } else {
    const { member, response } = await memberOrRefusal(request);
    if (response) return response;
    const out = await staffStreetViewTarget({ member, kind: query.kind, id: query.id });
    if (out.response) return out.response;
    if (out.notFound) return refuse("not_found");
    // A record with no address is not an error on its page — it simply has
    // no property to show, so no button.
    if (!out.target) return unavailable();
    target = out.target;
  }

  const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || null;
  if (!browserKey) return unavailable();

  const meta = await fetchStreetViewMetadata(target.point || target.address, { key: serverMapsKey() });
  if (!meta.ok) {
    if (meta.status === "REQUEST_DENIED") {
      // The owner's to-do, not a customer's problem: say it once per request
      // in the log and keep the button hidden.
      console.warn("[street-view] metadata REQUEST_DENIED — enable the Street View Static API on the server Maps key");
    }
    return unavailable();
  }

  const heading = target.point ? bearingDegrees(meta.location, target.point) : null;
  return NextResponse.json(
    {
      available: true,
      embedUrl: streetViewEmbedUrl({
        key: browserKey,
        panoId: meta.panoId,
        heading,
        language: query.token ? target.language : null,
      }),
      mapsUrl: mapsPanoUrl({ panoId: meta.panoId, location: meta.location, heading }),
    },
    { headers: NO_STORE },
  );
}
