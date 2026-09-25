// app/api/me/language/route.js
//
// GET — the signed-in account's interface language, for pages that have no
// account to ask: the marketing site, /login, /signup, the help centre.
//
//   { signedIn: true,  language: "es" }
//   { signedIn: false, language: null }
//
// Called by lib/i18n/languageStorage.js learnAccountLanguage(), at most once
// per page load and only from a browser that has reached /app signed in — an
// anonymous visitor never makes this request, so the marketing pages stay
// static and pay nothing for it. Reading the session in the root layout
// instead would have made every one of them dynamic.
//
// Deliberately NOT getCurrentMember: that records account activity on every
// call (a write, fired from a marketing page view) and resolves a support
// session's impersonated company, whose language is not the viewer's. This is
// the Better Auth session alone, and the same lookup the account emails use
// (lib/i18n/accountLanguage.js), so the email, the page it links to and every
// public page answer alike.
//
// Never a 401: "not signed in" is an answer here, and the caller uses it to
// forget its signed-in flag. Never cached: it is one person's preference.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { accountLanguageContext } from "@/lib/i18n/accountLanguage";

const PRIVATE = { "Cache-Control": "private, no-store" };

export async function GET(request) {
  let userId = null;
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    userId = session?.user?.id || null;
  } catch (err) {
    // A session store hiccup is not "signed out" — answering that would make
    // the caller forget the flag for a blip. A 503 leaves it alone.
    console.error("[api/me/language] couldn't read the session:", err?.message);
    return NextResponse.json({ error: "Session unavailable" }, { status: 503, headers: PRIVATE });
  }

  if (!userId) {
    return NextResponse.json({ signedIn: false, language: null }, { headers: PRIVATE });
  }

  // accountLanguageContext never throws; a failed lookup is language null,
  // which the caller reads as "nothing to add" and keeps the device language.
  const { language } = await accountLanguageContext({ id: userId });
  return NextResponse.json({ signedIn: true, language: language || null }, { headers: PRIVATE });
}
