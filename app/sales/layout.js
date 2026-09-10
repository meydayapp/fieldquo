// app/sales/layout.js
//
// Shell for FieldQuo's sales portal — the third staff surface, after /app and
// /platform.
//
// Visually plain on purpose, and NOT the platform console's dark chrome: a rep
// and a superadmin are different people with different powers, and two dark
// consoles side by side is how somebody acts in the wrong one. Same reasoning
// app/platform/layout.js gives for looking unlike the tenant app.
//
// force-dynamic for the same reason /platform has it: every screen here reads
// live data behind a cookie check, so there is nothing to prerender, and
// prerendering would make the build depend on a reachable database.
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";

import { LanguageProvider } from "@/app/providers/LanguageProvider";
import { db } from "@/lib/db";
import { SALES_COOKIE, verifySalesToken } from "@/lib/sales/auth";
import { shellLanguage } from "@/lib/sales/repLanguage";
import SalesShell from "./SalesShell";

export const metadata = {
  title: "FieldQuo Sales",
};

/**
 * The signed-in rep's stated interface language, or null when they have not
 * stated one.
 *
 * ══ What this replaced, and why it was wrong ══════════════════════════════
 *
 * This layout used to render `<LanguageProvider initialLanguage="en"
 * fromAccount>`. `fromAccount` is the provider's own switch for "this came
 * from a signed-in user's SAVED preference", and it makes the provider skip
 * both fallbacks — localStorage and navigator.language. Passing it beside a
 * literal claimed a decision on behalf of somebody who had never been offered
 * one, which is AGENTS.md failure class #5, and it took the browser fallback
 * away from a francophone rep who would have got it as a stranger on the
 * marketing site.
 *
 * The comment it replaced was not wrong about its own moment. It records a
 * real incident: the console came up in German for a rep whose browser had
 * once visited fieldquo.com in German, because localStorage is per-BROWSER and
 * the marketing site shares the origin. With no per-rep preference to appeal
 * to, asserting English was the only lever there was. That comment also named
 * what would change the answer — "the day a per-rep language preference exists
 * this becomes one prop instead of a rewrite" — and SalesRep.language is that
 * day. A rep who lands in the wrong language now has two exits: /sales/welcome
 * asks on their first morning, and /sales/pay changes it forever after.
 *
 * ══ Why the resolution is in lib/sales/repLanguage.js ═════════════════════
 *
 * The language and the `fromAccount` flag have to be decided TOGETHER — they
 * are one statement about whether anybody chose anything, and computing them
 * in two places is how the flag ends up hardcoded true again. shellLanguage()
 * returns both, and scripts/check-rep-settings.mjs executes it.
 *
 * Never throws. This layout renders /sales/login and /sales/invite too — the
 * two screens reached WITHOUT a session — so a database hiccup here would take
 * down the only doors into the portal. It also short-circuits before touching
 * the database when there is no valid cookie, so the unauthenticated screens
 * cost no query at all.
 */
async function repLanguageRow() {
  try {
    const jar = await cookies();
    const claims = await verifySalesToken(jar.get(SALES_COOKIE)?.value);
    if (!claims) return null;
    return await db.salesRep.findUnique({
      where: { id: claims.salesRepId },
      select: { language: true },
    });
  } catch (err) {
    console.error("[SalesLayout] couldn't resolve the rep's language:", err?.message);
    return null;
  }
}

export default async function SalesLayout({ children }) {
  const { language, fromAccount } = shellLanguage(await repLanguageRow());

  return (
    // `language` is null when nothing is stored, and that is deliberate rather
    // than an omission: the provider already renders DEFAULT_LANGUAGE for an
    // unsupported initial value, so passing "en" here would put an invented
    // English back into the one argument that is supposed to say nothing.
    <LanguageProvider initialLanguage={language} fromAccount={fromAccount}>
      <SalesShell>{children}</SalesShell>
    </LanguageProvider>
  );
}
