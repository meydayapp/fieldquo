// app/api/settings/email-preferences/route.js
//
// The signed-in person's OWN email preferences — the Settings › Notifications
// card ("Emails from FieldQuo"). The same three categories and the same
// write as the no-login page behind an email's footer
// (app/api/email-preferences/[token]); this door is keyed on the session's
// user instead of a token, and only ever reads or writes that one user's row.
//
// Per person, not per company: a crew member's choice about FieldQuo's tips
// is theirs, and an owner cannot switch it on for them.
//
// A support session (impersonation) is read-only twice over — middleware
// refuses the PUT before it arrives, and it is refused again here, the way
// AGENTS.md non-negotiable #2 asks: hiding a button is not access control.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { preferencesForUser, savePreferences } from "@/lib/email/preferencesStore";
import { maskEmail, validatePreferencePatch } from "@/lib/email/preferences";
import { checkSuppression } from "@/lib/sales/suppression";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!member.userId) return NextResponse.json({ error: "This session has no person to hold preferences." }, { status: 409 });
  const found = await preferencesForUser(member.userId);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let doNotContact = null;
  try {
    doNotContact = Boolean((await checkSuppression(db, { channel: "email", email: found.user.email }))?.suppressed);
  } catch {
    doNotContact = null;
  }
  return NextResponse.json({
    email: maskEmail(found.user.email),
    language: found.user.language || null,
    preferences: found.prefs,
    doNotContact,
  });
}

export async function PUT(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) {
    return NextResponse.json({ error: "A support session is read-only." }, { status: 403 });
  }
  if (!member.userId) return NextResponse.json({ error: "This session has no person to hold preferences." }, { status: 409 });
  const body = await request.json().catch(() => null);
  const checked = validatePreferencePatch(body);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  const preferences = await savePreferences(member.userId, checked.data, { via: "app" });
  return NextResponse.json({ ok: true, preferences });
}
