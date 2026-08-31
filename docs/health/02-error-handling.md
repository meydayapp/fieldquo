## 2. Error handling and silent failures

**Note on scope:** several agents are reportedly editing `app/globals.css`, `app/app/**`, `app/quote/**`, `app/portal/**`, `app/platform/**`, `lib/ai/crisisRule.js` and the voice prompts concurrently for a mobile pass. Everything below was read from this worktree's working tree at the time of the audit; line numbers in those paths may have already shifted.

**Headline finding:** the codebase has clearly already been swept hard for the exact failure classes AGENTS.md calls out — the overwhelming majority of `if (res.ok)` call sites, `catch {}` blocks and optimistic-UI updates carry an explicit comment saying so and a correct fix (revert-on-failure, `reportResponseError`, `.finally`). The worst thing still standing is in [app/api/marketing/campaigns/[id]/send/route.js:92-128](../../app/api/marketing/campaigns/[id]/send/route.js#L92-L128): the per-subscriber send loop does an *unguarded* `await db.marketingSubscriber.update(...)` (inside `ensureSubscriberToken`) before every email, with no try/catch around the loop body. If that write throws mid-batch — and AGENTS.md documents exactly this risk ("Neon scales to zero… the first connection after idle can fail with P1001") — the loop dies, `campaign.sentAt` is never set, and the campaign is left looking un-sent. The next click of "Send" re-emails everyone who already got it in the failed pass, with no record anywhere of how far the first attempt got.

| Severity | File:line | What | What the user sees |
|---|---|---|---|
| BLOCKER | [app/api/marketing/campaigns/[id]/send/route.js:92](../../app/api/marketing/campaigns/[id]/send/route.js#L92) | `for (const sub of subscribers)` loop with an unguarded `await` DB write (`ensureSubscriberToken`) and `await sendEmail(...)` per iteration; nothing sets `sentAt`/`recipientCount` until the whole loop finishes | A mid-batch failure (DB blip, Neon cold start) leaves the campaign marked un-sent. Re-pressing "Send" re-emails everyone from the partial batch a second time, with zero record of who already got it |
| SOON | [app/accept-invitation/[id]/page.js:33-42](../../app/accept-invitation/[id]/page.js#L33-L42) | `Promise.all([fetch(...).then(r=>r.json()), ...])` with no `res.ok` check on the invitation fetch, no try/catch, no `.catch` | If `/api/invitations/[id]` errors or returns a non-JSON body, `setLoading(false)` (line 42) never runs. The new hire's only way to join the company shows an infinite loading skeleton with no error, forever |
| SOON | [app/app/settings/overhead/page.js:217-233](../../app/app/settings/overhead/page.js#L217-L233) | `Promise.all([...])` loading salaries/debt/fixed-costs/forecast has no `.catch`; `/api/salaries` and `/api/debt` are parsed with `.then(r=>r.json())`, no `res.ok` check | If either fetch fails, `setLoading(false)` (line 232) never runs — the overhead/pricing-floor page spins forever. If it resolves with a non-array error body instead, `Array.isArray(s) ? s : []` silently renders "$0 salaries" / "$0 debt" into the minimum-price calculator with no error shown |
| SOON | [app/app/leads/page.js:619-623](../../app/app/leads/page.js#L619-L623) | `LeadDrawer.reload()`: `if (res.ok) setLead(await res.json()); setLoading(false);` — no `else` | Opening a lead whose fetch fails (403, 500, network) leaves `lead` null forever while `loading` is already false. The render guard `loading \|\| !lead` shows the loading skeleton permanently — indistinguishable from "still loading" |
| TIDY | [app/app/settings/team/page.js:77-106](../../app/app/settings/team/page.js#L77-L106) | `load()`'s `Promise.all` has no `.catch` and no error state; `/api/settings/members` is parsed with `.then(r=>r.json())`, no `res.ok` check | `.finally(() => setLoading(false))` does clear the spinner, so this doesn't hang — but on failure the page just renders an empty team list with no error banner, indistinguishable from "this company really has 0 members" |
| TIDY | [app/layout.js:52](../../app/layout.js#L52) | Genuinely empty `catch (e) {}` in the inline dark-mode-flash-prevention script | None — cosmetic-only (a `localStorage`/`matchMedia` failure just means the page loads in light mode instead of the stored theme for one paint) |

### BLOCKER — marketing campaign send: no partial-failure recovery

[app/api/marketing/campaigns/[id]/send/route.js](../../app/api/marketing/campaigns/[id]/send/route.js)

```js
let delivered = 0;
for (const sub of subscribers) {
  const unsubscribeToken = await ensureSubscriberToken(db, sub);   // line 99 — DB write, unguarded
  ...
  const result = await sendEmail({ ... });                        // line 121 — never throws, safe
  if (!result?.error) delivered++;
}

const updated = await db.marketingCampaign.update({                // line 133 — only reached if the loop completed
  where: { id },
  data: { sentAt: new Date(), recipientCount: delivered, status: "completed" },
});
```

`sendEmail()` (`lib/email/resend.js`) is internally try/caught and always returns `{ error }` rather than throwing, so the send itself is safe. The exposure is `ensureSubscriberToken` — a bare `db.marketingSubscriber.update(...)` with no try/catch, called once per recipient, before the email goes out. Any transient DB failure on subscriber N (Neon P1001 on cold start is the one AGENTS.md names explicitly as a live risk in this environment) throws out of the loop. The route has no top-level try/catch, so it becomes an unhandled 500. Concretely:

- Subscribers 1..N-1 already received the campaign email.
- `campaign.sentAt` is still `null` and `status` is not `"completed"` — the campaign still looks sendable.
- Nothing durable records `delivered` or which subscribers were reached.
- The `sentAt` guard at the top of the route ("This campaign has already been sent") does **not** trigger, so the contractor's obvious next move — press Send again — re-emails subscribers 1..N-1 a second time.

This is squarely the "await inside a loop where a failure aborts the rest" class named in the brief, on the one loop in the codebase that sends a document (an email) to a list of real people per iteration. Contrast with [app/api/expenses/import/commit/route.js](../../app/api/expenses/import/commit/route.js), which does the equivalent batch write as a single `db.$transaction` with `createMany` plus an idempotency key precisely so a mid-batch failure can't half-apply — that's the right pattern and this route doesn't use it.

### SOON — accept-invitation: unguarded Promise.all can strand the loading state

[app/accept-invitation/[id]/page.js:30-56](../../app/accept-invitation/[id]/page.js#L30-L56)

```js
useEffect(() => {
  let cancelled = false;
  (async () => {
    const [inviteRes, sessionRes] = await Promise.all([
      fetch(`/api/invitations/${id}`).then((r) => r.json()),        // line 34 — no r.ok check
      fetch("/api/auth/get-session").then((r) => (r.ok ? r.json() : null)),
    ]);
    if (cancelled) return;
    setInvite(inviteRes);
    setMode((current) => current ?? (inviteRes?.hasAccount ? "signin" : "signup"));
    setLoading(false);                                              // line 42 — never reached on failure
    ...
  })();
  return () => { cancelled = true; };
}, [id]);
```

No `res.ok` check on the invitation fetch, no try/catch around the IIFE, no `.catch()` on the `Promise.all`. `fetch(...).then(r => r.json())` on a non-2xx response either throws (non-JSON error body) or resolves to whatever error shape the API sent, which then gets treated as `inviteRes` without validation. Either way, on a genuine failure `setLoading(false)` is skipped and the component is stuck rendering its `if (loading)` branch (line 117) forever, with an unhandled promise rejection in the console and nothing on screen telling the invited person anything went wrong. This is the only entry point for joining an existing company (AGENTS.md: "joining a company is invite-only") — a broken invite link fails silently rather than saying so.

### SOON — overhead/pricing-floor page: same unguarded Promise.all, feeds a money calculation

[app/app/settings/overhead/page.js:217-233](../../app/app/settings/overhead/page.js#L217-L233)

```js
useEffect(() => {
  Promise.all([
    fetch("/api/salaries").then((r) => r.json()),                    // no r.ok check
    fetch("/api/debt").then((r) => r.json()),                        // no r.ok check
    fetch("/api/overhead/fixed-costs").then((r) => r.json()).catch(() => []),
    fetch("/api/settings/forecast").then((r) => r.json()).catch(() => ({})),
  ]).then(([s, d, f, forecast]) => {
    setSalaries(Array.isArray(s) ? s : []);
    setDebts(Array.isArray(d) ? d : []);
    ...
    setLoading(false);                                               // never reached if the Promise.all rejects
  });
  ...
}, [...]);
```

Two failure modes, both silent:

1. If `/api/salaries` or `/api/debt` rejects (network error, non-JSON 500 body), the whole `Promise.all` rejects with no `.catch` anywhere in the chain — `setLoading(false)` never runs and the page spins forever.
2. If either resolves with a 200-shaped-but-non-array error payload, `Array.isArray(s) ? s : []` quietly turns it into an empty list. This page feeds `calculateMinimumPrice()` (the pricing-floor calculator AGENTS.md specifically protects from invented numbers — "OVERHEAD PER JOB IS null, NOT 0, UNLESS…"). A failed salaries/debt load here renders as "$0 in salaries," which is exactly the kind of unknown-collapsed-into-zero AGENTS.md and `lib/analytics/kpis.js` go out of their way to prevent elsewhere in the app — this page doesn't have that guard.

### SOON — LeadDrawer: opening a lead that fails to load hangs on the skeleton forever

[app/app/leads/page.js:619-623](../../app/app/leads/page.js#L619-L623)

```js
const reload = useCallback(async () => {
  const res = await fetch(`/api/leads/${leadId}`);
  if (res.ok) setLead(await res.json());
  setLoading(false);
}, [leadId]);
```

No `else`. The render guard is `loading || !lead` (line ~692), which shows a pulsing skeleton. On any non-2xx response, `loading` becomes `false` but `lead` stays `null`, so the skeleton is shown forever with no error and no retry affordance — clicking a lead that 403s or 500s just looks broken, with no way to tell the user what happened. Every other mutating handler in the same component (`patch`, `addNote`, `convert`) correctly uses `reportResponseError(res, setErr, ...)`; `reload()` is the one path in this file that was missed.

### TIDY — team roster page: silent empty state on load failure

[app/app/settings/team/page.js:77-106](../../app/app/settings/team/page.js#L77-L106)

`load()`'s `Promise.all` has no `.catch`, and `/api/settings/members` (line 79) is parsed with `.then((r) => r.json())` with no `res.ok` check, unlike the three fetches beside it in the same array which all guard on `r.ok`. `useEffect(() => { load().finally(() => setLoading(false)); }, [load])` (line 110-112) does clear the spinner regardless, so this doesn't hang — but there is no `error` state on the page at all, so a failed load renders as "0 team members / 0 pending" with no banner, indistinguishable from a company that genuinely has none.

### TIDY — app/layout.js: a deliberately inert empty catch

[app/layout.js:52](../../app/layout.js#L52)

```js
try {
  ...
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
} catch (e) {}
```

The one genuinely empty (no comment, no code) `catch` block found in the app/lib/components tree. It guards the inline no-flash theme script that runs before hydration; a `localStorage`/`matchMedia` throw here just means the page paints in light mode for one frame instead of the stored theme. Not worth instrumenting — flagged only because it's the sole truly silent catch in an otherwise thoroughly-commented codebase.

### What was checked and found already correct

For the record, since these are exactly the shapes the brief asked to hunt for and each one checked out clean:

- **`if (res.ok)` with no `else`** — ~70 call sites checked across `app/app/settings/**`, `app/app/{invoices,quotes,appointments,leads,marketing}/**`, `app/signup`, `app/platform/sales-agent`, and the components named in the brief. All but the two listed above (`overhead`, `leads` drawer) have an explicit `else { await reportResponseError(res, …) }`, most with a `// Was silent: a failed request did nothing visible at all` comment marking a prior fix.
- **Empty/swallowing `catch` blocks** — of ~877 catch blocks in `app/`, `lib/`, `components/`, only one (`app/layout.js:52`, above) is genuinely empty. Every other candidate (`lib/platform/stripeBilling.js:71`, `lib/servicePlans/stripeMandate.js:73`, `lib/booking/reconcileBookingFee.js:55`, `lib/email/teamInvite.js:115`, `lib/voice/reconcileCalls.js:541`, `app/signup/page.js` x4, etc.) carries a comment explaining why swallowing is correct there (Stripe Customer Search eventual consistency, a detached SMS/diagnostic best-effort, a corrupted sessionStorage draft) and the reasoning holds up.
- **Optimistic UI without revert** — checked `app/app/tasks/page.js` (`toggle()`), `app/app/leads/page.js` (`moveLead()` drag-and-drop), `app/components/jobs/VisitChecklist.js` (checklist ticks). All three snapshot the prior state and explicitly restore it in the failure branch, with comments naming the exact "control that appears to work" bug they're avoiding.
- **Fire-and-forget without `.catch`** — the async IIFE in [app/api/jobs/[id]/visits/[visitId]/route.js:86-107](../../app/api/jobs/[id]/visits/[visitId]/route.js#L86-L107) (the "on my way" SMS) looked unguarded at a glance but does end in `.catch((err) => console.error(...))` on line 107.
- **Batch loops** — [app/api/expenses/import/commit/route.js](../../app/api/expenses/import/commit/route.js) is the reference-correct version of a batch write: single `db.$transaction` + `createMany` + idempotency key, so a mid-batch failure can't half-apply. The marketing-campaign send loop (BLOCKER above) is the one place that pattern wasn't followed.
- **Raw errors reaching client-facing pages** — checked `/api/self-quote/*`, `/api/booking/*`, `/api/quotes/received/[token]/*`, `/api/kitchen-design/*`, and the client components `app/q/[token]/QuoteApproval.js`, `app/portal/[token]/ClientPortal.js`. Every server catch returns a curated message (`ImportError.message`, `"Couldn't start the payment. Please try again."`, etc.), never a raw `err.message`/Prisma error, and every client catch falls back to a written copy string rather than printing the caught error directly.
- **`|| 0` / `?? 0` on client-facing money pages** (`app/quote/**`, `app/book/**`, `app/q/**`, `app/portal/**`) — the hits found (`Number(inv.total || 0)`, `Number(a.amount || 0)`, etc.) are numeric coercions on values the server always populates as real decimals, not "unknown collapsed to zero" in the sense AGENTS.md warns about for KPIs. `lib/analytics/kpis.js`'s null/`incomplete`/`reason` envelope is not replicated here, but nothing observed actually needed it.
