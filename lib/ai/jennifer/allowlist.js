// lib/ai/jennifer/allowlist.js
//
// Every route Jennifer may ever point somebody at, named by a short KEY —
// never a URL the model writes itself.
//
// ── Why a key and not a path ────────────────────────────────────────────────
//
// A tool argument typed `path: string` is an invitation: nothing stops a
// model from returning "https://evil.example.com" or "/app/settings/team?.."
// with a query string it made up. A tool argument typed as an ENUM of keys
// pulled from this object is not — the JSON Schema itself only offers the
// keys below, and even if a model somehow emitted something else,
// resolveNavRoute() looks it up in this table and returns null for anything
// that isn't here. There is no code path from "what the model said" to "what
// the browser navigates to" that skips this file.
//
// ── Why click-through, not automatic ────────────────────────────────────────
//
// Jennifer OFFERS a route; app/components/jennifer/JenniferPanel.js renders it
// as a button the visitor presses themselves. Nothing in this module or in
// tools.js ever calls next/navigation — a model must never move somebody off
// the page they are reading. See the check script's "navigation is
// click-through" assertion, which executes this by rendering the button and
// confirming there is no auto-navigate effect anywhere near it.
//
// ── Two separate tables, because the two audiences can reach different things ──
//
// An anonymous visitor may be pointed at public marketing pages and the
// signup flow. A signed-in company member may be pointed at THEIR OWN settings
// pages — company-relative routes under /app, never another company's
// anything (there is no company id in any of these paths; /app resolves the
// signed-in session's own company the same way every other /app page does).
//
// The one non-page entry, `contactSupport`, is a fully-formed mailto: built
// from lib/supportContact.js's fixed address — never a URL assembled from
// anything a model or a visitor supplied. It carries no dynamic subject or
// body for exactly that reason: a mailto whose body could vary would no
// longer be a genuinely FIXED target, only a fixed prefix, and this table
// exists to make "fixed" a fact about the whole string.
import { supportMailto } from "@/lib/supportContact";

const CONTACT_SUPPORT_MAILTO = supportMailto({ subject: "FieldQuo support" });

/** Anonymous visitor — public marketing site only. */
export const ANONYMOUS_NAV_ROUTES = Object.freeze({
  signup: Object.freeze({ path: "/signup", label: "Start a free trial" }),
  pricing: Object.freeze({ path: "/pricing", label: "See pricing" }),
  compare: Object.freeze({ path: "/compare", label: "Compare against what you use now" }),
  savings: Object.freeze({ path: "/savings", label: "See what you'd save" }),
  cost: Object.freeze({ path: "/cost", label: "Cost comparison" }),
  features: Object.freeze({ path: "/features", label: "See everything included" }),
  contact: Object.freeze({ path: "/contact", label: "Talk to a person" }),
});

/**
 * Signed-in company member — their own account's settings, never another
 * company's anything. Every path here is company-relative under /app; the
 * company itself is resolved server-side from the session on the page they
 * land on, exactly like every other /app page.
 */
export const COMPANY_NAV_ROUTES = Object.freeze({
  voiceSettings: Object.freeze({ path: "/app/settings/voice", label: "Settings → Voice" }),
  aiCreditSettings: Object.freeze({ path: "/app/settings/ai-credit", label: "Settings → AI credit" }),
  overheadSettings: Object.freeze({ path: "/app/settings/overhead", label: "Settings → Overhead" }),
  emailSettings: Object.freeze({ path: "/app/settings/email-domain", label: "Settings → Email domain" }),
  bookingSettings: Object.freeze({ path: "/app/settings/booking-page", label: "Settings → Booking page" }),
  paymentsSettings: Object.freeze({ path: "/app/settings/payments", label: "Settings → Payments" }),
  teamSettings: Object.freeze({ path: "/app/settings/team", label: "Settings → Team" }),
  copilot: Object.freeze({ path: "/app/copilot", label: "Ask FieldQuo AI about your numbers" }),
  contactSupport: Object.freeze({ path: CONTACT_SUPPORT_MAILTO, label: "Email FieldQuo support" }),
});

export function routesFor(mode) {
  return mode === "company" ? COMPANY_NAV_ROUTES : ANONYMOUS_NAV_ROUTES;
}

/**
 * The ONLY function that turns a model-supplied key into a route. A key not
 * in the table returns null — never a guess, never the key echoed back as a
 * path.
 */
export function resolveNavRoute(mode, key) {
  const table = routesFor(mode);
  const hit = table[String(key || "")];
  return hit ? { key, ...hit } : null;
}

/** The enum a tool's JSON Schema offers the model — nothing outside this list. */
export function navRouteKeys(mode) {
  return Object.keys(routesFor(mode));
}
