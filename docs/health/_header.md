# FieldQuo — pre-launch health check

**Date:** 2026-08-31 · **Scope:** whole repository · **Status: INTERIM** — 9 of 10 audits complete. The tour (§10) is still running; this file is regenerated when it lands.

Ten parallel audits, mapped onto the eight testing areas you named. Nothing in this report has been fixed — that was the instruction, and it is the right one: several of these are decisions, not defects.

## What I could not do, stated first

Three of your eight areas cannot honestly be closed from a repository. Pretending otherwise would be the most dangerous thing in this document.

| Area | What was done | What still needs you |
|---|---|---|
| **Cross-device / browser** | Static scan for APIs needing fallbacks; a separate mobile pass is fixing layout issues | Real Safari, Chrome, Firefox, Edge, on a real iPhone and a real Android |
| **Performance / load** | Query shapes, index coverage, connection pooling — estimates only | An actual load test. No number in §7 was measured |
| **Production / recovery** | Env vars, crons, webhooks read from the repo | Vercel and Neon dashboards, and a restore actually performed |

Two audits are also **partial by their own admission**, and must not be read as clean bills of health: the functional audit (§9) deep-traced 14 pages of 123, and the dead-code audit (§1) sampled rather than exhausted the `if (res.ok)` sites. Both list by name what they did not reach.

## Launch blockers

Ranked by what I would want fixed before a stranger can sign up. Each was verified against the code directly, not taken from an agent's summary.

| # | Finding | Where | Verified |
|---|---|---|---|
| 1 | **Stored XSS on every public contractor site.** Company name is injected into a `<script type="application/ld+json">` via `dangerouslySetInnerHTML`. `JSON.stringify` does **not** escape `</script>` — proven by execution — and the name is written unsanitised. Signup is self-serve by design, so anyone can start a trial, name their company `Acme</script><script>…`, and run arbitrary JavaScript in the browser of every visitor to their subdomain. | [page.js:374](app/site/[subdomain]/page.js:374), [business-info/route.js:322](app/api/settings/business-info/route.js:322) | Yes — all four links in the chain |
| 2 | **Stripe is still on test keys.** No real money can move. Three env vars and two live webhook endpoints outstanding. | `docs/TODO.md` | Known, restated |
| 3 | **All 16 crons fail open.** Each compares `Authorization` against `` `Bearer ${process.env.CRON_SECRET}` ``. Unset, that string is literally `"Bearer undefined"`, which any stranger can send. These crons send email, place outbound AI calls, and charge saved cards. | every `app/api/cron/*/route.js` | Yes — pattern in all 16, and the string proven |
| 4 | **The client portal ships internal fields to the homeowner.** `GET /api/portal/[token]` selects quotes with no `select` clause, so every scalar on `Quote` reaches the browser — including `reviewNotes`, whose own schema comment says it must never reach a client-facing surface. Also `aiReview`, `autoEstimated`, `needsReview`, `processNotes`, `declineReason`, `followUpCount`, `estimateSource` and internal staff ids. A homeowner with devtools can read that their quote was auto-generated, never reviewed by a human, what the AI flagged, and how many times they were chased. | [portal/route.js:61](app/api/portal/[token]/route.js:61) | Yes — enumerated all 52 scalars |
| 5 | **Marketing campaigns can double-send.** The subscriber loop has an unguarded `await` and no try/catch; `sentAt` is written only after it finishes. A mid-loop failure means the resend guard never fires and pressing Send again re-emails everyone already reached. No per-recipient ledger exists to recover from. | [send/route.js:92](app/api/marketing/campaigns/[id]/send/route.js:92) | Yes — including the absent ledger |

**On #4:** the security audit ranked this SOON; I rank it a blocker and the disagreement is yours to settle. It is the same class as the draft-invoice leak the file's own comments describe fixing — and for a white-label product whose promise is that the paperwork looks like the contractor's, "this was auto-generated and nobody checked it" is the worst possible sentence to leave in a payload. Costs and margin do NOT leak: `costing` is a relation and is not included.

**On #1:** I could not confirm whether this reaches a login session. `AGENTS.md` non-negotiable #7 asserts cookies scope to `.fieldquo.com`, which would make it session theft from any signed-in user who visits a malicious tenant site. I found no cookie-domain configuration in `lib/auth.js`, and Better Auth defaults to host-only cookies. **This needs checking against the running deployment**, not the repo. It changes the severity from "bad" to "critical".

## Money moving wrongly

| Finding | Where | Impact |
|---|---|---|
| **A refund still reads "paid" forever.** Neither webhook nor the shared dispatcher handles `charge.refunded` or `charge.dispute.created`. | both Stripe webhooks | Your records say you were paid for work whose money went back |
| **Two AI paths bill you with no quota gate.** `expenseSummary.js` and `monthlyDigest.js` call `recordAiUsage` after but never `checkAiQuota` before, against the rule stated in `AGENTS.md`. | `lib/ai/` | `monthlyDigest` is a **cron running for every company monthly** — the leak scales with your customer base |
| **Nothing tells you an invoice was paid.** The webhook handles `payment_intent.succeeded` only for service-plan occurrences; no notification fires anywhere. | [webhook/route.js:121](app/api/stripe/webhook/route.js:121) | The one question a contractor asks, answerable only by going to look |
| **Quote acceptance has no uniqueness constraint.** `Job.quoteId` and `Invoice.quoteId` are not `@unique`; idempotency rests on check-then-create. | `prisma/schema.prisma` | A retried accept on bad signal creates a duplicate job, invoice, and homeowner email |

## A correction to my own briefing

`AGENTS.md:67` says *"167 API routes, 62 `/app` pages, 12 `/platform` pages."* The real counts are **349, 97 and 26**. I briefed the security audit with "~170 routes" and told it to be systematic, so its denominator was half the truth. I sent it a correction mid-run. That line needs fixing before another agent reads it — it is the file every agent reads first.

Two other documented claims turned out to be prose with no code behind them:

- **The `P1001` retry does not exist.** `AGENTS.md` and `docs/VERCEL.md` both describe retrying Neon's cold-start failure. `grep -rn "P1001"` across the repo returns nothing.
- **No backup or restore procedure exists anywhere.** Recovery has not been proven, because there is nothing to prove.

## Security: the coverage number, and what it cost to get

The security audit initially worked to my stale "~170 routes". After the correction it re-derived the real list itself and read **100% of the 19 routes a stranger can reach with no session** — `public/*`, `self-quote/*`, `booking/*`, `instant-quote/*`, `portal/*`, `plan/[token]`, `leads/public` — in full, not sampled. Beyond that: ~65 files read whole by grep-driven triage (every `updateMany`/`deleteMany`, every bare `findUnique` ownership check, every platform write, all webhooks), ~50 pattern-checked, and ~280 covered only by the repo's own executable regression suite, which it **ran** rather than read — roughly 2,000 assertions across `check:tenant-scope`, `check:rbac-redaction`, `check:rbac-side-doors`, `check:public-payload` and others, all passing.

**No cross-tenant leak, no price leak, no unauthenticated write was found.** That is the headline and it is a good one. Its other findings: platform-admin sessions do not re-check `active` per request, so deactivating an admin does not take effect until their 12-hour JWT expires; and four public POST routes lack the rate limiting their siblings have, including `instant-quote/[companySlug]/measure`, which makes a billable Google API call.

The known open question is unchanged: `PATCH /api/platform/companies/[id]` lets the console edit a company's name and suspend it, which is either the sanctioned exception to non-negotiable #3 or a violation of it. Still yours to decide.

## What is genuinely strong

Worth stating, because a report of only bad news distorts the picture as much as one of only good news.

- **Payments.** Both Stripe integrations route through one idempotent dispatcher, every money-writing table carries a real unique-index idempotency key, out-of-order delivery degrades to a guarded no-op, and booking fees, invoice payments and voice credit each have cron reconciliation behind them.
- **The dead-control class this codebase was built to prevent.** Every send path checked actually sends. Both bugs found yesterday were independently re-verified as fixed.
- **Hostile input.** A 576-colour contrast sweep found zero failures. Pricing, tax, CSV import and the site-block sanitiser withstood deliberate attack.
- **No caching anywhere**, so the tenant-data-leaking-through-a-cache risk had nothing to find.
