# FieldQuo — pre-launch health check

**Date:** 2026-08-31 · **Scope:** whole repository · **Status: INTERIM** — 8 of 10 audits complete. Security (§3) and the tour (§10) are still running; this file is regenerated when they land.

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
| 4 | **Marketing campaigns can double-send.** The subscriber loop has an unguarded `await` and no try/catch; `sentAt` is written only after it finishes. A mid-loop failure means the resend guard never fires and pressing Send again re-emails everyone already reached. No per-recipient ledger exists to recover from. | [send/route.js:92](app/api/marketing/campaigns/[id]/send/route.js:92) | Yes — including the absent ledger |

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

## What is genuinely strong

Worth stating, because a report of only bad news distorts the picture as much as one of only good news.

- **Payments.** Both Stripe integrations route through one idempotent dispatcher, every money-writing table carries a real unique-index idempotency key, out-of-order delivery degrades to a guarded no-op, and booking fees, invoice payments and voice credit each have cron reconciliation behind them.
- **The dead-control class this codebase was built to prevent.** Every send path checked actually sends. Both bugs found yesterday were independently re-verified as fixed.
- **Hostile input.** A 576-colour contrast sweep found zero failures. Pricing, tax, CSV import and the site-block sanitiser withstood deliberate attack.
- **No caching anywhere**, so the tenant-data-leaking-through-a-cache risk had nothing to find.
