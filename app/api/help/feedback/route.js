// app/api/help/feedback/route.js
//
// POST { slug, lang, helpful } from the "Was this helpful?" buttons on a
// public help article. Public by design — the reader has no account — and
// therefore shaped so that being public costs nothing:
//
//   · the body is three fields, validated against the tree and the chrome
//     language list, so the table can only ever hold votes on real pages;
//   · nothing about the sender is stored (see the HelpFeedback model);
//   · lib/rateLimit.js throttles per IP at the door and the IP goes no
//     further than that in-memory window.
//
// Reachable on both hosts: /api/* passes straight through middleware.js on
// help.fieldquo.com, and the impersonation gate ignores it (no cookie).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { articleMeta } from "@/lib/help/tree";
import { isHelpChromeLang } from "@/lib/help/chrome";

// Generous for a person, tight for a script: nobody reads thirty articles in
// ten minutes and votes on each.
const FEEDBACK_LIMIT = { limit: 30, windowMs: 10 * 60 * 1000 };

export async function POST(request) {
  const limited = rateLimit(request, "help-feedback", FEEDBACK_LIMIT);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug : "";
  const lang = typeof body?.lang === "string" ? body.lang : "";
  const helpful = body?.helpful;

  if (typeof helpful !== "boolean" || !articleMeta(slug) || !isHelpChromeLang(lang)) {
    return NextResponse.json({ error: "Invalid feedback." }, { status: 400 });
  }

  await db.helpFeedback.create({ data: { slug, lang, helpful } });
  return NextResponse.json({ ok: true });
}
