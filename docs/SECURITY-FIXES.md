# Security fixes — pre-launch blockers 1, 2, 3

Three verified blockers from `docs/HEALTH-CHECK.md` and `docs/health/`, fixed
in this pass. Nothing else in that report was touched.

---

## 1. Stored XSS on every public contractor site

**What it was.** `app/site/[subdomain]/page.js` built a JSON-LD `<script>`
block with `dangerouslySetInnerHTML={{ __html: JSON.stringify({...company
fields...}) }}`. `JSON.stringify` does not escape `<`, `>` or `&` — a string
value containing `</script>` closes the tag early and whatever follows runs
as markup/script. `company.name` (and phone, email, address, city, province)
reached that call with no escaping anywhere in the chain, and
`app/api/settings/business-info/route.js` wrote `name` with no sanitisation
either. Company signup is self-serve by design (non-negotiable #1), so
anyone could start a trial, name their company
`Acme</script><script>alert(1)</script>`, and run arbitrary JS in the
browser of every visitor to their subdomain.

**The fix — at the sink.** New file `lib/security/scriptSafeJson.js` exports
`scriptSafeJson(value)`: `JSON.stringify`, then `\uXXXX`-escape `<`, `>` and
`&`. This is the standard technique for embedding JSON inside a `<script>`
tag (the same one React, Rails' `escape_html_entities_in_json`, and
`serialize-javascript` use) — the escapes are valid inside a JSON string
literal, so any spec-compliant reader (including a search engine's JSON-LD
parser) decodes them straight back to the original characters. Nothing about
the *data* changes; only how it's allowed to appear inside HTML.
`app/site/[subdomain]/page.js` now calls `scriptSafeJson({...})` instead of
`JSON.stringify({...})` at the one sink that had it.

**Every `dangerouslySetInnerHTML` site in the repo**, found by
`grep -rl "dangerouslySetInnerHTML=" app lib` (three total, none others exist):

| Site | Carries user data? | Disposition |
|---|---|---|
| `app/site/[subdomain]/page.js` (JSON-LD) | **Yes** — company name, phone, email, address, city, province | Fixed: now uses `scriptSafeJson` |
| `app/layout.js` (`NO_FLASH`) | No — a hardcoded template-literal constant with zero interpolation, ever | Left as-is; verified no `${` appears in it |
| `app/components/BrandTheme.js` (brand CSS) | No — `brandColor`/`brandColors.secondary` are gated on `isValidHex()` before reaching `deriveBrandTokens`/`tokensToCss`; anything that fails the `^#?[0-9a-f]{3,6}$` regex never reaches the `<style>` tag | Left as-is; verified the `isValidHex` gate is still in place |

**The fix — at the source, second layer.** New file
`lib/security/rejectMarkupCharacters.js` exports
`containsMarkupCharacters(value)` — true if the string contains `<` or `>`.
Applied to `name` in both places a company name is written:
`app/api/companies/route.js` (signup, the self-serve, unauthenticated path)
and `app/api/settings/business-info/route.js` (the settings PATCH). Both
return `400` with `"Company name can't contain < or >"` rather than
silently stripping or truncating.

**Is a script tag ever a legitimate company name? No.** `<` and `>` have no
legitimate use in a business name in any of the six languages this product
ships (English, French, Spanish, Ukrainian, Punjabi, Tagalog) — every
character that *does* legitimately appear (`&`, apostrophes, accented
letters, em dashes, digits) passes through untouched, since only `<`/`>` are
rejected. This is explicitly a **second layer, not the fix**: it stops a
*new* `<script>` from being typed into the one field known to reach a
`<script>` tag today. It does nothing for a row already in the database
before this shipped, or for a field added tomorrow that forgets to call it —
which is exactly why the sink fix is the one that matters and the source
check is commented as secondary in both files.

**Does this XSS reach a login session? No — but read the caveat.**

`lib/auth.js`'s `betterAuth({...})` call has **no `advanced` block, no
`crossSubDomainCookies`, and no explicit cookie `domain`** — confirmed by
reading the whole 344-line file and grepping for `advanced|crossSubDomain|
cookies:|domain`. Better Auth's default, with none of that configured, is a
**host-only cookie**: a session cookie set while signed in at (say)
`app.fieldquo.com` is scoped to exactly that host. A browser never attaches
it to a request whose target is a different host, including
`evil-tenant.fieldquo.com` — and JavaScript running in `evil-tenant
.fieldquo.com`'s origin has no access to `app.fieldquo.com`'s cookie jar via
`document.cookie` either, because that's ordinary same-origin cookie
isolation, nothing Better Auth has to opt into.

This means **`AGENTS.md` non-negotiable #7's claim — "cookies scope to
`.fieldquo.com`" — is not actually implemented in the code.** It's an
assumption baked into `lib/site/subdomain.js`'s own header comment ("every
session cookie scoped to `.fieldquo.com` would be readable by a page they
control") and into the reserved-subdomain list's stated rationale, but
nothing in `lib/auth.js` makes it true. In this specific case the gap
happens to work in the app's favour: because cookies are host-only rather
than domain-wide, this XSS **cannot read or steal the session cookie's
value**.

**The caveat — same-site CSRF, not session theft.** SameSite cookie policy
(the browser mechanism that *would* otherwise block a cross-origin request
from carrying credentials) is defined in terms of the **registrable domain**
(`fieldquo.com`), not the full hostname. `app.fieldquo.com` and
`evil-tenant.fieldquo.com` are different origins but the **same site** under
that definition, so SameSite=Lax or Strict does *not* block a
credentialed cross-origin request between them. If a signed-in staff member's
browser (holding an `app.fieldquo.com` session cookie) loads a malicious
tenant's page, that page's script *can* issue
`fetch("https://app.fieldquo.com/api/...", { credentials: "include" })` and
the browser will attach the real cookie — because the cookie's Domain scope
matches the *target* of the request, regardless of which origin's script
initiated it. No CORS headers were found anywhere in the codebase
(`grep -rln "Access-Control-Allow-Origin|trustedOrigins"` returns nothing),
so the attacker cannot *read* the response, but can still fire **blind
state-changing requests** (POST/PATCH/DELETE) as that signed-in user. This
is a real, if narrower, exposure — same-site CSRF, not session-cookie
theft — and it exists independently of this XSS (any XSS on any
`*.fieldquo.com` origin would have it) and independently of whether
`AGENTS.md #7`'s claim is true, since same-site CSRF isn't blocked by
Domain scoping either way. Fixing it (CSRF tokens, or `SameSite=strict` plus
verifying it actually stops same-site requests, which it doesn't, or an
`Origin` header check on state-changing routes) is out of scope for this
pass and is called out here as a follow-up, not fixed.

---

## 2. All 16 crons fail open

**What it was.** Every route under `app/api/cron/` compared the
`Authorization` header against `` `Bearer ${process.env.CRON_SECRET}` ``.
Verified directly: when `CRON_SECRET` is unset, that template literal
evaluates to the literal string `"Bearer undefined"` — not "no valid value,"
a **fixed, publicly-knowable password**. A deploy that forgot to set the env
var didn't fail closed; it opened all 16 crons (email, outbound AI phone
calls, saved-card charges) to anyone who sent that exact header.

**The fix.** New file `lib/security/cronAuth.js` exports
`requireCronSecret(request)`:

- Returns a `401` `NextResponse` (with a `console.error` naming the cause)
  when `CRON_SECRET` is unset or empty — **always denies**, never falls
  through to "so nothing matches, so nothing is authorised" the way the old
  comparison did.
- Otherwise compares the header against `` `Bearer ${secret}` `` using
  `node:crypto`'s `timingSafeEqual` (length-checked first, to avoid
  `timingSafeEqual` throwing on a length mismatch rather than just
  comparing false) — closing the byte-at-a-time timing-attack gap a plain
  `!==` comparison leaves open on a correctly-configured secret.
- Returns `null` when the request is authorised.

All 16 routes now do:

```js
const denied = requireCronSecret(request);
if (denied) return denied;
```

replacing the old two- or three-line hand comparison. One shared helper, not
sixteen copies — AGENTS.md names copy-paste duplication as failure class #4,
and this bug lived precisely in the copy nobody was looking at.

**Files changed:** `lib/security/cronAuth.js` (new), and all 16 of
`app/api/cron/{appointment-reminders,booking-fees,crew-line-rent,
follow-ups,grace-warning,large-quote-check,monthly-digest,recurring-jobs,
renewal-reminders,review-requests,service-plans,voice-auto-topup,
voice-outbound,voice-reconcile,voice-rent,voice-resync}/route.js`.

**Two pre-existing checks had to be updated, not just the new one added.**
`scripts/check-voice-spend.mjs` and `scripts/check-voice-metering.mjs` each
had their own hand-rolled assertion — a literal `/CRON_SECRET/` or
`"process.env.CRON_SECRET"` text match against `voice-rent/route.js` and
`voice-reconcile/route.js` respectively — which broke the moment those
routes stopped containing that literal text. Both were updated to check for
`requireCronSecret(request)` instead, which is the *stronger* proof (the old
text would still match a stray comment with no real check behind it). This
was found by actually running `npm run check:all`, not anticipated in
advance.

---

## 3. The client portal ships internal fields to homeowners

**What it was.** `GET /api/portal/[token]` fetched with `db.client.findUnique
({ where: {...}, include: {...} })` — an `include`, not a `select`, at the
top level. Every scalar on `Client` reached the browser, and the nested
`quotes`/`invoices` relations had no `select` either, so every scalar on
`Quote` and `Invoice` reached it too — `Quote.reviewNotes` (whose own schema
comment says it must never reach a client-facing surface) included, plus
`aiReview`, `aiReviewedAt`, `aiVisionPasses`, `autoEstimated`, `needsReview`,
`processNotes`, `declineReason`, `followUpCount`, `followUpSentAt`,
`estimateSource`, `estimateData`, `composeSeconds`, `sourceCallId`, and
internal staff ids (`createdById`, `assignedToId`, `reviewedById`). The
`invoices` relation also carried `include: { payments: true }` (every
`Payment` row, unfiltered) and a `jobs` relation (`include: { visits: true
}`) that reached the browser too.

**What actually reads the response.** Read both consumers in full —
`app/portal/[token]/ClientPortal.js` and
`app/portal/[token]/invoices/[id]/PortalInvoice.js` (both fetch the same
`GET /api/portal/[token]`, by design — see that file's own header comment on
why a second, per-invoice endpoint would need to re-derive the token scoping
check). Neither reads `data.jobs` or `invoice.payments` **at all** —
`docs/TODO.md` independently confirms this is the intended scope: "the
client portal shows invoices only." The fields the two components actually
render:

- Client: `name` (as `clientName`), `language` (via `resolveClientLanguage`)
- Quote: `id`, `quoteNumber`, `total`, `createdAt`, `status`, `shareToken`
  (deliberately kept — the portal links to `/q/{shareToken}`)
- Invoice: `id`, `invoiceNumber`, `total`, `amountPaid`, `dueDate`,
  `lineItems`, `notes`, `subtotal`, `discount`, `tax`
- Plus, read server-side only (never forwarded raw): `Client.country`/
  `province` and `Invoice.taxEnabled`/`createdAt`, both consumed by
  `taxStatement()` to compute `taxKind`/`taxAssumedRegion`, which *are*
  forwarded.

**The fix.** `app/api/portal/[token]/route.js` now uses an explicit
`select` at every level — Client, `company` (already narrow; unchanged),
`quotes`, `invoices` — naming only the fields above. `jobs` is dropped from
the query entirely rather than select-narrowed: the correct allow-list for a
relation nothing reads is no relation at all, with a comment saying to add
it back with a real `select` the day the portal actually shows job status.
`include: { payments: true }` is dropped the same way. The per-invoice
response object, previously built with `{ ...invoice, taxKind, ... }`
(spreading the whole fetched row, including the `taxEnabled`/`createdAt`
that were only fetched to *compute* `taxKind`), is now built as an explicit
field-by-field object too — so even a field that slips back into the Prisma
`select` doesn't automatically reach the browser via the spread.

An allow-list `select` was chosen over deleting fields after the fetch (the
pattern already used for the two Stripe fields and five tax settings on
`company`) because a `select` **fails closed** when a column is added to
one of these models tomorrow — it has to be named here to leave the
building. A `delete`-based approach fails open by default.

---

## Regression guards

Added to `scripts/check-public-payload.mjs` (existing file, already in
`check:all` — no new entry was added to the chain, per instruction). Three
new sections, all **executed**, not read-only regex-over-source:

1. **XSS.** Runs `scriptSafeJson` against a hostile payload
   (`"Acme</script><script>alert(1)</script>"`) and asserts (a) plain
   `JSON.stringify` really does leave `</script>` intact — proof the bug is
   real, not assumed — (b) `scriptSafeJson`'s output contains neither `<`
   nor `>`, and (c) `JSON.parse` on the escaped output round-trips back to
   the original string, proving the escaping doesn't corrupt the data a real
   JSON-LD reader would see. Then enumerates every
   `dangerouslySetInnerHTML=` site in `app/` and `lib/` from disk (not a
   hand-kept list — a fourth site added later fails this check by name) and
   asserts the known three are exactly what's found, that
   `app/site/[subdomain]/page.js` calls `scriptSafeJson` (and not a bare
   `JSON.stringify` feeding `__html`), that `app/layout.js`'s `NO_FLASH`
   template literal contains no `${` interpolation, and that
   `BrandTheme.js` still gates on `isValidHex` before deriving CSS.

2. **Cron secret.** Statically confirms all 16 (well, "≥16", derived from
   `find app/api/cron -name route.js`) cron routes call
   `requireCronSecret(request)` and no longer hand-compare
   `process.env.CRON_SECRET`. Then — the part a regex can't prove —
   **executes** `requireCronSecret` itself: with `CRON_SECRET` deleted, both
   the exact string the old bug accepted (`"Bearer undefined"`) and a
   request with no `Authorization` header at all are denied; with a secret
   configured, a wrong value and a missing header are denied and the correct
   value is allowed through.

3. **Portal select.** The one the task called out as needing a behavioural
   assertion specifically. **Executes** the real
   `app/api/portal/[token]/route.js` `GET` handler against a fixture client,
   using the existing `scripts/fixtures/dbStub.mjs` (the same stub
   `check-trade-gate.mjs` and three other checks already use to run product
   code without a live database) plus a small, additive `reads` log added to
   that stub — symmetrical to its existing `writes` log — that records every
   `findUnique`/`findFirst`/`findMany` call's full arguments. `next/server`
   and `@/lib/db` are stubbed via one `node:module` `register()` hook at the
   top of the file (the same technique `scripts/check-refusal-shape.mjs`
   already uses, needed here because bare Node can't resolve `next/server`
   at all and because importing the real `@/lib/db` would construct a
   PrismaClient against Neon at import time). The check then inspects the
   captured `db.client.findUnique` call's `select` argument — the actual
   runtime query object, not source text — and asserts: `select` is used
   (not `include`) at the top level; no `include` key appears **anywhere**
   in the tree at any depth; and a named list of forbidden fields
   (`reviewNotes`, `aiReview`, `aiReviewedAt`, `aiVisionPasses`,
   `autoEstimated`, `needsReview`, `processNotes`, `declineReason`,
   `followUpCount`, `followUpSentAt`, `estimateSource`, `estimateData`,
   `composeSeconds`, `sourceCallId`, `createdById`, `assignedToId`,
   `reviewedById` on the Quote branch; `email`, `phone`, `address`, `notes`,
   `contactName`, `city`, `portalToken`, `type`, `createdAt` on the Client
   branch; `payments` on the Invoice branch) is absent — checked **per
   branch**, not as one flattened key set, because `Company.email`/`phone`
   and `Invoice.notes` are legitimately selected elsewhere in the same query
   under those same field names. Also asserts `jobs` is absent from both the
   query and the JSON response body.

`scripts/fixtures/dbStub.mjs`'s new `reads` array is purely additive — every
model method still returns exactly what it did before (fixture rows,
unfiltered by `select`/`include`, matching how it already worked); the four
existing checks that use it (`check-trade-gate`, `check-instant-quote-draft`,
`check-call-refinishing`, `check-voice-quote-scope`) were re-run after the
change and still pass with no differences.

## Mutation testing

Every assertion above was broken, confirmed to fail with the expected
message, then restored. Details in the commit; summary:

- **XSS sink:** reverted `scriptSafeJson(` back to `JSON.stringify(` in
  `app/site/[subdomain]/page.js` → `"the JSON-LD sink uses scriptSafeJson"`
  failed, `"...and not a bare JSON.stringify feeding __html"` failed.
  Restored.
- **XSS enumeration:** added a throwaway `dangerouslySetInnerHTML={{ __html:
  x }}` to a fourth file → `"no unreviewed dangerouslySetInnerHTML site
  exists"` failed, naming the exact file. Restored (file deleted).
- **Cron helper, one route:** reverted
  `app/api/cron/voice-rent/route.js` to the old inline comparison → both
  `"...calls requireCronSecret"` and `"...no longer hand-compares
  CRON_SECRET"` failed for that one file, all 15 others still passed.
  Restored.
- **Cron helper itself:** temporarily made `requireCronSecret` return `null`
  (authorise) when `CRON_SECRET` is unset instead of denying → `"an unset
  CRON_SECRET denies the literal string the old bug accepted"` and the
  no-header variant both failed. Restored.
- **Portal select:** reverted the query back to `include: {...}` with no
  `select` → `"the query uses select, not include"` failed, and
  `"no forbidden Client/Quote/Invoice field is selected"` failed listing the
  actual leaked field names. Restored.
- **Portal per-branch scoping:** temporarily added `reviewNotes: true` to
  the `quotes.select` → `"no forbidden Quote field is selected"` failed,
  naming `reviewNotes`. Restored.

## What could not be verified without a running deployment

- **The cookie-domain finding** is read directly from `lib/auth.js` and
  cross-checked against Better Auth's documented default behaviour, but
  wasn't confirmed by inspecting a `Set-Cookie` header from the actual
  running app (local dev has no working database connection in this
  environment either). If a `advanced.crossSubDomainCookies` block exists
  somewhere this search missed, the conclusion in §1 would need revisiting.
- **Whether `CRON_SECRET` is actually set in Vercel.** This fix makes a
  missing secret loud and safe; it can't confirm the secret is present in
  production. `[cron] CRON_SECRET is not set...` in the function logs is the
  signal to check for after this deploys.
- **The same-site CSRF gap named in §1** is described, not fixed — it needs
  a product decision (CSRF tokens vs. an `Origin` check vs. something else)
  that's out of scope for "fix the three verified blockers."
- `npm run build` and `npm run check:all` were both run to completion in
  this environment (see the commit message / task log for exit codes) — not
  run against a live Vercel/Neon deployment.
