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

import { LanguageProvider } from "@/app/providers/LanguageProvider";
import SalesShell from "./SalesShell";

export const metadata = {
  title: "FieldQuo Sales",
};

// ── English, and NOT whatever the marketing site last stored ───────────────
//
// The root LanguageProvider falls back to localStorage and then navigator when
// no account preference is passed. localStorage is per-BROWSER, so a rep whose
// browser had once visited fieldquo.com in German got the whole rep console in
// German — VERTRIEBSPORTAL, Anrufliste, Meine Firmen — while every screen body
// stayed English, because the bodies here are written in English rather than
// through t(). Seen live against a real rep session:
// localStorage["fieldquo-language"] was "de" while navigator.language was
// "en-US", so this was not even the browser's own language.
//
// Half-translated is worse than either whole one. This is internal FieldQuo
// tooling, the same class as /platform, which is deliberately English-only for
// the same reason: a rep and a superadmin are FieldQuo staff, not tenants, and
// a visitor's choice on the public pricing page is not a statement about the
// language they work in.
//
// `fromAccount` is the provider's own switch for "this is a DECISION, not a
// guess", and it skips the localStorage and navigator fallbacks entirely. Used
// rather than deleting the t() calls in SalesShell, so the day a per-rep
// language preference exists this becomes one prop instead of a rewrite.
export default function SalesLayout({ children }) {
  return (
    <LanguageProvider initialLanguage="en" fromAccount>
      <SalesShell>{children}</SalesShell>
    </LanguageProvider>
  );
}
