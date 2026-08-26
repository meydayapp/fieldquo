// lib/voice/creditCurrency.js
//
// The currency the voice credit ledger is denominated in.
//
// ── Why it lives alone in its own file ─────────────────────────────────────
//
// Because the settings page needs it and `lib/voice/credits.js` imports the
// Prisma client. Pulling this constant from there dragged the database driver
// into the browser bundle and broke the build with nine Turbopack errors — the
// same trap lib/voice/prompt.js already carries a warning about, where a pure
// helper reaches Prisma through numbers.js. A value a client component needs
// has to sit somewhere with no server imports at all.
//
// ── Why it is a constant and not company.currency ──────────────────────────
//
// Because that is what the code already does, and until now nothing said so.
// app/api/settings/voice/topup/route.js hardcodes `currency: "usd"` on the
// Stripe checkout — the only price_data in the repo that does not go through
// stripeCurrency(company.currency) — so every top-up is collected in US
// dollars. Retell also bills FieldQuo in USD, so cost and revenue are in the
// same unit and the margin arithmetic underneath is sound.
//
// What was not sound is the screen. The voice settings page formatted every
// figure as a bare `$`, on accounts whose every other invoice is CAD — all 29
// companies in production are CAD — so a contractor read "$30.00", pressed buy,
// and Stripe charged thirty US dollars. Around forty Canadian ones, and nothing
// anywhere said so.
//
// Named here so the page can say which dollars it means, and so the decision is
// visible rather than buried in one hardcoded string. Whether voice SHOULD be
// billed in the company's own currency is a pricing decision, not a refactor:
// moving it would mean raising the per-minute rate to cover a USD cost.
export const CREDIT_CURRENCY = "USD";
