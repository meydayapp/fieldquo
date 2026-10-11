// app/api/email-preferences/[token]/route.js
//
// The "Manage email preferences" link in every commercial FieldQuo→contractor
// email (lib/email/platformLayout.js), with no login: the token in the URL is
// the EmailPreference row's own (lib/email/preferencesStore.js says why it is
// stored rather than derived).
//
// GET reads, PUT writes. GET never mutates — mail scanners pre-fetch every
// link in a delivered email (the reason app/api/no-contact/[token]/route.js
// gives), so a page load must not change what somebody receives.
//
// Only the three optional categories can be written (validatePreferencePatch);
// billing, security and trial notices are not on the row at all. FieldQuo's
// do-not-contact list is read and REPORTED, never written from here: lifting
// it is a superadmin's act on /platform/suppressions, and this page saying
// "on" beside a suppressed address would be a switch that does nothing — so
// the page is told, and says so.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadByToken, savePreferences } from "@/lib/email/preferencesStore";
import { maskEmail, plausibleToken, resolvePreferences, validatePreferencePatch } from "@/lib/email/preferences";
import { checkSuppression } from "@/lib/sales/suppression";

const invalid = () => NextResponse.json({ error: "This link isn't valid.", code: "invalid_link" }, { status: 404 });

async function suppressed(email) {
  try {
    return Boolean((await checkSuppression(db, { channel: "email", email }))?.suppressed);
  } catch {
    // Unknown is reported as unknown, not as "not suppressed".
    return null;
  }
}

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const { token } = await params;
  if (!plausibleToken(token)) return invalid();
  const found = await loadByToken(token);
  if (!found) return invalid();
  return NextResponse.json({
    email: maskEmail(found.user.email),
    language: found.user.language || null,
    preferences: resolvePreferences(found.row, found.user),
    doNotContact: await suppressed(found.user.email),
  });
}

export async function PUT(request, { params }) {
  const { token } = await params;
  if (!plausibleToken(token)) return invalid();
  const found = await loadByToken(token);
  if (!found) return invalid();
  const body = await request.json().catch(() => null);
  const checked = validatePreferencePatch(body);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  const preferences = await savePreferences(found.user.id, checked.data, { via: "email_link" });
  return NextResponse.json({ ok: true, preferences });
}
