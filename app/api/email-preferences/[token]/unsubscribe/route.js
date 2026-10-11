// app/api/email-preferences/[token]/unsubscribe/route.js
//
// RFC 8058 one-click unsubscribe — the target of the List-Unsubscribe header
// on every commercial FieldQuo→contractor email (lib/email/platformLayout.js
// listUnsubscribeHeaders). Gmail's and Yahoo's own "Unsubscribe" chip POSTs
// here with the body `List-Unsubscribe=One-Click` and no session; the POST
// must therefore do the whole job with no confirmation page.
//
//   POST ?c=tips    switch that one category off
//   POST (no ?c)    switch every optional category off — the honest reading
//                   of a bare "unsubscribe" from a sender
//   GET             never mutates (a scanner pre-fetching the header URL must
//                   not unsubscribe anybody); it sends the person to the
//                   preferences page instead, with the category named
//
// Transactional mail is not a category and cannot be switched off here.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { loadByToken, savePreferences } from "@/lib/email/preferencesStore";
import { PREFERENCE_CATEGORIES, oneClickCategory, plausibleToken } from "@/lib/email/preferences";
import { getAppOrigin } from "@/lib/appUrl";

export async function POST(request, { params }) {
  // Next 16: params is a Promise.
  const { token } = await params;
  if (!plausibleToken(token)) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  const found = await loadByToken(token);
  if (!found) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  const category = oneClickCategory(new URL(request.url).searchParams.get("c"));
  const data = Object.fromEntries((category ? [category] : PREFERENCE_CATEGORIES).map((k) => [k, false]));
  const preferences = await savePreferences(found.user.id, data, { via: "one_click" });
  return NextResponse.json({ ok: true, unsubscribed: category ? [category] : [...PREFERENCE_CATEGORIES], preferences });
}

export async function GET(request, { params }) {
  const { token } = await params;
  const category = oneClickCategory(new URL(request.url).searchParams.get("c"));
  const target = `${getAppOrigin(request)}/email-preferences/${encodeURIComponent(String(token || ""))}${category ? `?c=${category}` : ""}`;
  return NextResponse.redirect(target, 303);
}
