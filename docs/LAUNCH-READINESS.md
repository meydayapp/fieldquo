# FieldQuo — Launch Readiness Report

_Generated from a pre-launch audit (parallel dead-control / correctness / security sweep across `/app`, client-facing surfaces, settings, and this session's new features). Baseline: `npm run check:all` passes, `npm run build` compiles._

## How to read this
- **FIXED** — corrected and pushed this session (commit `3caf863` and the contractor-quotes / financing commits before it).
- **DECISION NEEDED** — a real defect that is too big (or too risky) to fix blind overnight; each needs a **build-or-hide** call before launch. Leaving these as-is ships a dead control, which this codebase's cardinal rule forbids.
- **NOTE** — low-impact, recoverable, or informational.

---

## ✅ Fixed this session

| Sev | Area | What was wrong |
|---|---|---|
| BLOCKER | Invoices | New-invoice "Save & Send" emailed nobody and saved as draft. Now calls the real send route. |
| HIGH | White-label | Imported subcontractor cost with a blank label showed the **sub's company name** on the homeowner's quote. Now neutral. |
| HIGH | Permissions | CSV client import bypassed the client-create permission gate. Gate added. |
| HIGH | Contrast | Pay / Confirm-booking buttons hardcoded dark text on the brand colour — invisible on dark/default brands. Now measured. |
| MEDIUM | Portal | All amounts shown in CAD regardless of company currency. Now company currency. |
| MEDIUM | Booking | A committed booking whose email threw returned "couldn't book" → client retried into a 409. Email now best-effort. |
| MEDIUM | Clients | List always showed "0 quotes / 0 invoices". Added `_count`. |
| MEDIUM | Jobs | Status dropdown couldn't show "unscheduled" (the auto-created state); interacting silently flipped it. Added. |
| MEDIUM | Quotes | PATCH could edit line items on a **decided** quote — deleting a materialised subcontractor expense and overwriting totals. Now blocked. |
| MEDIUM | Jobs/Security | `POST /api/jobs` trusted body `quoteId`; a job against another company's quote could inject expenses into their ledger. Scoped to caller's company. |
| MEDIUM | Overhead | New company saving a blank capacity got a fabricated default of 3 → an invented price floor. Now stored as "unknown". |
| LOW | Financing | Base Checkout session pinned to `["card"]` so Affirm stays strictly opt-in. |

---

## ⚠️ DECISION NEEDED before launch (build or hide)

These are **confirmed** (traced on both sides). Each is a feature whose UI implies it works while the backend doesn't complete the loop. Per the cardinal rule, ship none of them as-is — either finish the wiring or replace the control with an honest "Coming soon". I did **not** fix them overnight because building them blind risks the most critical paths (email delivery, SMS on visit completion) that can't be tested locally.

### 1. BLOCKER — Custom email templates never reach real sends
- **Where:** `app/app/settings/email-templates/page.js` (says the Active template "is the one that's actually sent"); `app/api/quotes/[id]/send/route.js` uses hardcoded `buildQuoteEmail` and only reads a `quote_pdf` template (never `quote_email`); `lib/email/quoteEmail.js` / `invoiceEmail.js` reference no template at all; same for `app/api/invoices/[id]/send/route.js`.
- **Effect:** A contractor customises their quote/receipt/instructions email, clicks **Set Active**, sends a **test** (which renders their template, so it looks like it works) — but every real client gets the generic hardcoded email. "Set Active" only moves a badge. (Campaigns and the follow-ups cron *do* use templates, but by id, not the Active flag.)
- **Recommendation:** Highest-value fix of the four — wire `quote_email` / `receipt_email` / `instructions_email` active templates into the send routes via `renderTemplateSections`, with the hardcoded builder as fallback. **Do this with email testing, not blind.** Until then, hide "Set Active"/the "is actually sent" copy for these types.

### 2. HIGH — Visits can't be created or managed from the UI
- **Where:** `app/app/jobs/[id]/JobDetail.js:266` links to `/app/jobs/[id]/visits/new`, which **has no page** (404). The POST/PATCH visit APIs exist and are the only way visits get created — nothing in the UI calls them. No UI to add a visit, toggle its checklist, mark it completed, or attach visit photos.
- **Effect:** "Add visit" 404s. Downstream flows that key off visit completion (recurring-visit generation, review-request cron) can't be driven from the app. Visits are described as "the substance" of a job.
- **Recommendation:** Build the visit-create/manage UI (the backend is ready), OR remove the button and hide visit UI until it exists. Note visit completion fires customer SMS + spawns recurring visits — test before shipping.
- **Related:** `PATCH /api/jobs/[id]/visits/[visitId]` has **no permission gate** (any member could mark visits completed → SMS/recurring). Currently unreachable from the UI, so latent; gate it when the UI lands.

### 3. HIGH — Checklist templates are write-only
- **Where:** `app/app/settings/checklists/page.js` + API do full CRUD of `jobChecklistTemplate`, but **nothing reads it** — visit creation takes `checklistItems` from the request body, never from a template.
- **Effect:** A contractor builds job checklists that never appear on any visit or reach any crew.
- **Recommendation:** Stamp the matching template onto a visit at creation (depends on #2's UI existing), OR mark the page "Coming soon".

### 4. HIGH — Custom Fields is a dead-end feature
- **Where:** `app/app/settings/custom-fields/page.js` + `app/api/custom-fields/route.js`. The schema comment itself (`prisma/schema.prisma`) says `CustomFieldValue` "just exists so the data has somewhere to live once that integration happens."
- **Effect:** Owners add custom fields (incl. **required** ones like "Gate code" / "PO number") that never render on any form, are never collected, stored, or shown on any document.
- **Recommendation:** Either build the field rendering/collection on the relevant entity forms, or hide the page / mark it "Coming soon".

---

## Notes (low impact — verify but not launch-gating)
- `app/app/settings/booking-page/page.js` — the "optimistic" travel-settings merge uses API key names vs. state key names, so the optimistic step is a no-op; the toggle still saves, just updates after the server round-trip. Cosmetic lag.
- `app/api/settings/voice/route.js` — `transferTo` is saved/loaded but has no input and no consumer (Retell provisioning ignores it). Inert column; latent risk if a UI is later wired assuming transfers work.
- `app/app/settings/payments/page.js:32` — `loadCompany()` doesn't check `res.ok`; a Neon cold-start 500 can briefly show "Not connected" until "Check again". Transient.
- `app/app/settings/team/timesheets/page.js` — initial load has only `.finally`; a 500 shows an empty list with no error (user actions on the page are correctly guarded).
- `app/api/public/quotes/[token]/route.js` — the internal (staff) notification email hardcodes CAD. Staff-facing, but wrong for non-CAD tenants.
- `app/site/[subdomain]/SiteBlocks.js` — "Site by FieldQuo" footer renders on all tiers. AGENTS.md allows it on free sites; confirm whether paid tiers should drop it.
- `lib/quotes/importQuote.js` — `materializeImportedCosts` is idempotent across sequential retries (`expenseId` guard) but not transactional; a rare concurrent double job-create could double-count. Low likelihood.

---

## Confirmed CLEAN (examined, no defects)
Quote approval flow (IDs-only add-ons, server reprices, 404/409/410 for draft/decided/expired, signature-gated + audited); self-quote / instant estimates (no price leaks, IDs/answers only); booking availability & tenant scoping; embed + tenant site rendering (unpublished = 404, empty sections omitted not padded, measured colours); payroll (real state, CSV injection-escaped, honest "record as paid" wording); the contractor-to-contractor quotes feature's **cross-tenant isolation** (a sub can never retrieve the GC's markup/client price — traced through every endpoint) and money integrity (import/markup/remove all recompute consistently; received cost immutable on markup edit); Affirm financing gates + card fallback. No synchronous `params`/`searchParams` anywhere.

---

## Recommended launch gating
1. **Resolve the four DECISION-NEEDED items** (build or hide). #1 (email templates) is the one most likely to embarrass on a white-label product; #2 (visits) blocks a core job workflow.
2. Run the **QA-CHECKLIST.md** end-to-end on a real phone, both audiences.
3. Spot-check contrast on a **dark brand colour** (black / navy / dark green) on `/q`, `/book`, `/portal`.
4. Confirm a real email actually arrives for quote-send, invoice-send, and booking-confirm in staging (the audit can't send mail).
