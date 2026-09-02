# Sales Portal — where `SALES_REP` fits in auth/RBAC

Research only. No schema, no code. Every claim below cites the file/line that
makes it true today, and every claim about what a rep "cannot do" names the
server-side gate that would have to enforce it — per this repo's own rule,
hiding a button is not a permission.

---

## 0. The short answer

A sales rep is **a genuinely third kind of identity**, closer in shape to
`PlatformAdmin` than to `Member`, but neither fits without new machinery.
Reusing the Better Auth organization/`Member` join (Option A) is the wrong
foundation — it is built around "one session, one company," and a rep's
defining property is "one session, many companies, read-mostly." Extending
`PlatformAdmin` (Option B) reuses the right *shape* (a FieldQuo-staff
identity with no company membership) but none of today's platform-permission
vocabulary expresses "only the rows I'm attributed to" — that scoping concept
does not exist anywhere in `lib/platform/`. The owner's UX constraint
("invite them the way a company invites an employee") is satisfiable without
reusing the *company* invite pipeline — see §2, and note that `PlatformAdmin`
itself is **not** created through an invite/accept flow today, which is a
second reason the owner's mental model doesn't map onto either existing
system directly.

Recommendation: model `SALES_REP` as a new, parallel identity —
authenticated the way `PlatformAdmin` is (a FieldQuo-issued credential, no
Better Auth org membership, no `Member` row in any tenant) — but give it its
own JWT/cookie namespace and its own scoping primitive (an
`assignedJobWhere()`-shaped filter keyed on the rep, generalized from row-level
to company-level). Do **not** put it on the `PlatformAdminRole` enum or the
`PLATFORM_PERMISSIONS` map as a fourth role: that map has no scoping concept,
and every route that trusts a `PlatformAdmin` today trusts it with the whole
company list.

---

## 1. Which identity is a sales rep closest to

### The two candidates, and why each is disqualified in its pure form

**Option A — `Member` of a special company.** Rejected as the primary model.
The entire `Member`/permission-grid stack is scoped to exactly one company
per session:

- `Member` is keyed `@@unique([userId, companyId])` (`prisma/schema.prisma:1499-1528`)
  — one row per (user, company) pair, and `Company.authOrgId String? @unique`
  (`prisma/schema.prisma:1210`) — one Better Auth organization per company,
  1:1.
- `getCurrentMember()` resolves **one** `companyId` per request off
  `session.session?.activeOrganizationId` (`lib/currentMember.js:264-295`),
  then does `db.member.findUnique({ where: { userId_companyId: {...} } })`
  (`lib/currentMember.js:273-276`). There is no code path that returns "this
  session, several companies" — a user with two memberships (the codebase
  already allows this: `lib/auth.js:82-101` explicitly handles "someone who
  runs two businesses on one login") sees whichever org is *active*, one at a
  time, and switches by changing `activeOrganizationId`.
- Every permission primitive downstream — `hasLevel`/`hasToggle`
  (`lib/permissions/enforce.js:43-76`), `UNRESTRICTED_ROLES`
  (`lib/permissions/enforce.js:34`), `assignableRoles`/`ROLE_RANK`
  (`lib/permissions/roleManagement.js:40-45,198-201`), the seat/licence
  ladder (`lib/pricing/seatLimit.js:74-144`) — takes `member.companyId` as a
  given constant, not a filter over a set.
- A sales rep's defining requirement is the **opposite** shape: one identity,
  *N* attributed companies, **read**-mostly. That is a cross-tenant query
  (`Company.salesRepId = me` or similar, across every tenant), which is
  precisely the shape `Member` cannot express — a `Member` row lives *inside*
  one tenant's blast radius, and every tenant-scope check in this codebase
  (`scripts/check-tenant-scope.mjs`, see §7) exists to guarantee a `Member`
  can never see past `companyId`. Building "sees several companies" out of
  `Member` means either (a) one `Member` row per attributed company — which
  makes the rep indistinguishable from a real employee inside each of those
  companies' rosters, defeats every non-negotiable about a company's own data
  being theirs, and pollutes seat counts (`seatCheck` in
  `lib/pricing/seatLimit.js:74-144` counts every active `Member` as a
  billable seat or crew slot) — or (b) a special "sales" pseudo-company that
  isn't real tenant data at all, which is Option A in name only and Option B
  (see below) in substance.
- Also disqualifying on the non-negotiable itself: AGENTS.md #2 says
  impersonation is superadmin-only and read-only, enforced twice
  (`middleware.js:161-225` and `lib/currentMember.js:214-238`) specifically
  *because* "staff" must never reach a contractor's data by virtue of being
  staff. A `Member` row, however constrained by the grid, **is** "staff of
  that company" in Better Auth's own model — it is an organization member,
  full stop. Modeling a rep as a `Member` — even a heavily grid-restricted
  one — puts them one misconfigured grid entry away from being a company
  employee with real write access, which is exactly the shape of risk
  non-negotiable #2 exists to close off for platform staff. `PlatformAdmin`
  never has this problem because it holds no `Member` row anywhere; it reads
  through an entirely separate, explicitly read-only channel.

**Option B — `PlatformAdmin` with a restricted permission set.** Closer, but
also not a straight fit as-is:

- Structurally right: `PlatformAdmin` already proves the "FieldQuo staff
  identity independent of any company" pattern works — `id`, `email`,
  `passwordHash`, `role`, `active`, no `companyId`, no `Member` join
  (`prisma/schema.prisma:45-56`). Its session is a signed JWT in its own
  cookie namespace (`platform-token`), verified in `middleware.js:237-248`
  and again in `lib/platform/currentPlatformAdmin.js:31-47` — a second,
  independent identity system that never touches Better Auth's session
  machinery at all. That is exactly the isolation a rep needs: nothing in the
  rep's session should be able to satisfy `getCurrentMember()` or acquire an
  `activeOrganizationId`.
- Its permission vocabulary, though, is **global capabilities**, not
  **row-scoped** ones. `PLATFORM_PERMISSIONS` (`lib/platform/permissions.js:2-15`)
  is `{ superadmin: ["*"], admin: [...], support: ["company:view", "impersonate", ...] }`
  — `canPlatform(role, "company:view")` is a yes/no over *every* company, with
  no notion of "only the ones I'm assigned." Nothing in `lib/platform/` today
  answers "which companies does this admin see" as anything other than "all
  of them or none" — there is no `assignedCompanyWhere()`. That has to be
  built new (see §3); it is not a restriction of an existing dial, because no
  dial like it exists.
- Its lowest role, `support`, already demonstrates FieldQuo is comfortable
  with a narrower platform role (`company:view`, `impersonate`,
  `analytics:view` — no `company:manage`, no billing, no migrations) — so the
  *precedent* for "a platform role that can see but not touch" exists
  (`lib/platform/permissions.js:14`). A rep is that idea taken one step
  further: not just fewer capabilities, but a **filtered set of rows** within
  the capabilities it does hold. Nothing in the platform system has ever
  needed that before, because `support`/`admin`/`superadmin` are all meant to
  see the whole company list.
- One inconsistency worth flagging while it's in view: `PlatformAdminRole`
  the Postgres enum only has two values —
  `enum PlatformAdminRole { support, superadmin }`
  (`prisma/schema.prisma:5751-5754`) — but `PLATFORM_PERMISSIONS` defines a
  third key, `admin` (`lib/platform/permissions.js:4-13`), and
  `POST /api/platform/admins` accepts `role: "admin"` as valid input and
  attempts `db.platformAdmin.create({ data: { role: "admin", ... } })`
  (`app/api/platform/admins/route.js:49,77-80`). That `create()` would fail
  against the current enum. I did not trace whether this has actually been
  exercised in production or is dead input validation for a role nobody has
  ever POSTed — it is out of scope to fix here — but it means "how many
  platform roles really exist today" is itself not settled, and adding a
  fourth (`SALES_REP`) to the same enum/map pair without resolving that
  drift first would compound an existing bug rather than a clean baseline.

### Recommendation and trade-offs

Treat `SALES_REP` as **a third identity that borrows `PlatformAdmin`'s
isolation and none of its permission vocabulary**:

- Same isolation properties: its own credential, own cookie/JWT namespace, no
  `Member` row, no Better Auth organization membership, unreachable through
  `getCurrentMember()`.
- New scoping primitive: not "all companies" (superadmin/admin/support) and
  not "one company" (`Member`), but "companies where `Company.salesRepId =
  me`" (or equivalent) — a filter that has to be threaded through every route
  a rep touches, the same way `assignedJobWhere()` threads `userId` through
  the job list (§3).
- Do **not** add `SALES_REP` to `PlatformAdminRole` / `PLATFORM_PERMISSIONS`.
  Every existing caller of `canPlatform()` / `requirePlatformPermission()`
  assumes "holds this permission" implies "over every company." A fourth row
  in that table with an implicit *also* apply a company filter is exactly
  the kind of two-part rule (`AGENTS.md`'s "recurring failure classes" —
  copy-paste duplication, a check that's half of a pair) that gets forgotten
  on the eleventh route. A parallel table/module (`lib/sales/permissions.js`,
  a `SalesRep` model, its own `getCurrentSalesRep()`) keeps "is this a
  platform superadmin" and "is this a rep, scoped to their own book" from
  ever being answerable by the same yes/no.

Trade-off: this is more new surface than reusing `PlatformAdmin` outright
(new table, new session/cookie, new middleware branch, new gate library) —
but reusing `PlatformAdmin` would mean every future `canPlatform(role, "*")`-
style shortcut, and every route that currently trusts "if `getCurrentPlatformAdmin`
returns non-null, this caller may see this company" (which is most of
`/api/platform/*` today — see the migration-service doc's own framing of
`lib/currentMember.js`'s `assertReadOnly` comment,
`docs/MIGRATION-SERVICE.md:81-96`), becomes a landmine: the day a rep's
JWT satisfies `getCurrentPlatformAdmin()`, it satisfies *every* platform
route that checks for a non-null admin and nothing else, including ones that
were never audited with "a non-superadmin, non-full-visibility caller" in
mind.

---

## 2. Can the employee-invite flow be reused?

**The owner's ask, verbatim: "I will be able to add the salespeople in the
same way a company adds an employee."** Read literally as "reuse
`POST /api/settings/members`," the answer is no — every assumption that
route makes is false for a rep. Read as "give the owner the same *UX shape*
(type an email, pick an access level, click Invite, they get a link)," it is
fully achievable, just not by calling the same code.

What the employee-invite pipeline assumes, and where it breaks for a rep:

1. **A company exists and the actor is a member of it.**
   `POST /api/settings/members` resolves `member` via `memberOrRefusal`
   (`app/api/settings/members/route.js:161-162`), which is
   `getCurrentMember()` — there is no equivalent for "a FieldQuo owner acting
   as FieldQuo." The natural actor for a rep-invite is a `PlatformAdmin`
   (superadmin), which has no `companyId` at all. Nothing about the route
   generalizes to "invite this person into FieldQuo itself."

2. **A seat/licence.** `checkUserLimit(member.companyId)`
   (`app/api/settings/members/route.js:173-187`) and `seatCheck()`
   (`app/api/settings/members/route.js:288-310`, defined in
   `lib/pricing/seatLimit.js:74-144`) both answer "does *this company's*
   `Subscription`/`Plan` have room." A rep is not billed against any
   company's plan — FieldQuo pays the rep, not the reverse. There is no seat
   concept to check, and running the existing one would either wrongly block
   (no plan resolves for "FieldQuo the org") or wrongly pass (the sentinel
   `seatsAllowed === null` path, `lib/pricing/seatLimit.js:81-93`, which
   exists for legacy companies with no seat promise — reusing it for reps
   would be an accident, not a decision).

3. **A role from the company grid.** `role` must be one of
   `["admin", "supervisor", "employee"]`
   (`app/api/settings/members/route.js:208-213`), validated against
   `assignableRoles(actorRole)` (`lib/permissions/inviteGuard.js:38-54`,
   `lib/permissions/roleManagement.js:198-201`) — a hierarchy that only makes
   sense relative to `ROLE_RANK` inside one company
   (`lib/permissions/roleManagement.js:40-45`). `permissions` is clamped
   through `clampPermissions()` against `PERMISSION_CATEGORIES`
   (`lib/permissions/roleManagement.js:219-249`), the per-company granular
   grid (quotes, jobs, invoices, payroll, …) — none of which describes
   anything a sales rep does. There is no rank for `SALES_REP` to sit below
   or above, and no category in that grid a rep would ever hold.

4. **Better Auth's organization plugin.** The invite is a real Better Auth
   `createInvitation` call against `organizationId: member.authOrgId`
   (`app/api/settings/members/route.js:369-376`, `lib/auth.js:271-303`
   wires the send hook). Better Auth's `organization` plugin only knows
   `admin`/`member` as roles (`app/api/settings/members/route.js:367`
   comment: "Better Auth only knows admin/member — supervisor/employee throw
   ROLE_NOT_FOUND"); the granular role is smuggled through a side table,
   `PendingTeamProfile` (`app/api/settings/members/route.js:401-433`). A
   sales rep has no organization to be invited into — inventing a
   FieldQuo-internal "organization" to host them would be reintroducing
   Option A (§1) by the back door, dragging seat counting, `Member` rank
   rules, and the tenant-scope checks (§7) along with it for no reason.

5. **Accept lands a `Member` row scoped to one company.**
   `POST /api/invitations/[id]/accept` upserts
   `db.member.upsert({ where: { userId_companyId: {...} }, ... role: fieldquoRole ... })`
   (`app/api/invitations/[id]/accept/route.js:110-121`) and then
   `setActiveOrganization` (`...:124-131`). That is the exact opposite of
   what a rep needs — a rep must never acquire an `activeOrganizationId` for
   any tenant, because that is the credential `getCurrentMember()` reads to
   grant company access (`lib/currentMember.js:264-276`).

**Verdict:** the invite pipeline cannot be reused as code. It can be
*paralleled* — same UX (an email, a link, an accept page that sets a
password), built as a new, structurally similar flow that creates a
`SalesRep` row instead of a `Member` row and never touches Better Auth's
organization plugin. Notably, this parallel-not-reused pattern already has
one internal precedent worth citing: FieldQuo's own `PlatformAdmin` accounts
are **not** created through an invite/accept flow at all —
`POST /api/platform/admins` has a superadmin set the new admin's password
directly server-side (`app/api/platform/admins/route.js:41-63`), and the
credential is handed over out of band. If the owner's stated preference is
specifically the *emailed-link, self-service-password* shape (which
"the same way a company adds an employee" suggests), that is a **new**
pattern for FieldQuo-staff-identity creation — it doesn't yet exist for
`PlatformAdmin` either, so building it for `SALES_REP` isn't "extend
something," it's "build the first one."

---

## 3. "Only my own companies" — does `assignedJobWhere()` generalize?

`assignedJobWhere()`/`seesOnlyAssignedJobs()`
(`lib/permissions/enforce.js:158-233`) is the right *shape* to copy, and the
comparison is worth being precise about, because the two cases differ in a
way that matters for correctness:

- **What it scopes today:** a `Member`'s view of `Job` rows *within the one
  company they already belong to*. The `where` fragment
  (`{ visits: { some: { assignedToId: member.userId || "__none__" } } }`,
  `lib/permissions/enforce.js:228-233`) narrows a query that is *already*
  filtered to `companyId` by every caller — `seesOnlyAssignedJobs` never has
  to prove tenant isolation itself, because the surrounding route did that
  first (that's what `scripts/check-tenant-scope.mjs` audits, §7). It answers
  "which rows, inside the tenant I'm already scoped to."

- **What a rep needs:** "which *tenants*, across the whole database, belong
  to me" — there is no outer `companyId` filter to narrow, because the rep's
  query *is* the top-level company list. This is a materially different
  guarantee to build: `assignedJobWhere()` is a second line of defense behind
  an existing tenant boundary; a rep's `assignedCompanyWhere()`-equivalent
  **is** the tenant boundary. Getting it wrong doesn't leak one job inside a
  company the rep already has some access to — it leaks an entire company's
  quotes, clients and financials to someone who was never a member of it.
  That is a strictly higher-stakes version of the same pattern, and it
  deserves the same fall-closed posture `assignedJobWhere()` uses (a member
  it "cannot identify at all is scoped… to nothing rather than to
  everything," `lib/permissions/enforce.js:183-187`) — arguably a stricter
  one, since here "everything" is every customer's business, not one job
  inside a business the caller is already inside.

- **Where the analogous filter would have to be threaded:** every future
  `/sales` route that lists or reads a company (`/api/sales/companies`,
  whatever the demo/prospect list becomes) would need the rep-scoped
  equivalent of `loadEnforceableMember` + `assignedJobWhere` — a
  `loadEnforceableSalesRep(db, repId)` returning `{ id, ... }` and a
  `assignedCompanyWhere(rep)` fragment spread into every query, mirroring
  `lib/permissions/enforce.js:242-275` and `:228-233`. The one demo account
  the owner mentioned ("their own prospects, their own attributed companies…
  and one demo account") is a **third** kind of row a rep may see beyond
  "attributed" — closer to the existing `demo_sandbox` impersonation carve-out
  (`lib/currentMember.js:74-127`, gated strictly on `Company.isDemo` read
  fresh from the database, never from client input) than to attribution. Any
  new scope filter should keep those as two explicit predicates ORed
  together (`assignedToRep OR isDemo`), not one collapsed rule — collapsing
  them is exactly the kind of "two questions answered by one predicate" this
  codebase has already been burned by (`lib/permissions/settingsAccess.js:591-595`'s
  own comment on why `canSee`/`gridAllowsSettingsRow` are kept apart).

- **What does NOT generalize:** the *level* half of the pattern
  (`hasLevel`/`hasToggle`, `lib/permissions/enforce.js:43-76`) is about "how
  much of one company's document can I see" (view-only vs. edit, price
  visible or not). A rep's access to an attributed company's data is a
  different question entirely — likely "prospect/lead metadata + the
  company's plan/billing status for commission purposes," never the
  company's own quotes, clients or job data. Nothing in the existing grid
  vocabulary (`PERMISSION_CATEGORIES` in `lib/permissions.js`) describes
  that; a rep's permitted fields are a new, much narrower read shape,
  probably closer to `redactClient`/`redactQuote`'s pattern of an explicit
  field allowlist (`lib/permissions/enforce.js:303-344`) than to the
  level-ladder pattern.

---

## 4. What must a rep be structurally unable to do

Four things named in the prompt, each with the gate that would have to
enforce it (none of these exist yet — this section states what each gate
would need to check against, and the closest existing precedent):

- **Change attribution** (which rep a company/prospect is credited to).
  Nearest precedent: `Company.referredByCode`
  (`prisma/schema.prisma:970-971`) is written exactly once, at signup
  (`app/api/companies/route.js` — not read in this pass, but the referral
  code is looked up and stored, never mutated by the referred company or by
  the referrer: `app/api/settings/referral/route.js:22-39` only ever
  *creates* a company's own outbound code, never touches
  `referredByCode` on another row). The gate for a rep's attribution field
  would need the same one-way-write posture: settable only at the moment a
  prospect enters the pipeline (by whatever creates it — an inbound lead
  route, or a superadmin), and refused on every route a rep can reach
  thereafter. A rep must never hold write access to their own or anyone
  else's attribution column — full stop, not "clamped."

- **Create or pay their own commission.** This is the sharpest fraud vector
  in the whole feature (see §"Security risks" below). The nearest existing
  precedent for "money moves only from one narrowly gated, re-verified-at-write-time
  path" is the migration-write mechanism: `canWrite()`
  (`lib/migrations/state.js`, described in `docs/MIGRATION-SERVICE.md:61-96`)
  is checked **fresh from the database inside the write's own transaction,
  on every single write** — never trusted from an earlier read — and the
  write is restricted to `SUPERADMIN_ONLY_PERMISSIONS`
  (`lib/platform/permissions.js:37-42`), never granted to `admin`/`support`,
  let alone to the party the money concerns. Directly transplanted: a rep
  must have **zero** write path to `Commission`-shaped rows at all — not a
  restricted one, none — and whatever creates a commission (an event: a
  company converts, pays its first invoice, renews) must be system-derived,
  never rep-submitted, with the actual payout requiring a *second*, human
  (superadmin) approval step the same way `migration:quote` requires a
  superadmin to price before `migration:write` can fire
  (`lib/platform/permissions.js:29-33`).

- **Mark a subscription paid.** The one function that may ever write
  `status: "paid"` on FieldQuo's own billing today is `settleMigrationPayment()`,
  called from exactly two doors — the Stripe webhook and the Checkout
  return-trip GET, both idempotent (`docs/MIGRATION-SERVICE.md:184-197`).
  There is no analogous "mark paid" affordance anywhere a `Member` or
  `support`/`admin` platform role can reach directly — company billing
  status is Stripe-webhook-driven exclusively. A rep must be held to the
  same rule: no route a rep's identity can authenticate against may write to
  `Subscription`/`Payment`/billing-status fields, ever, full stop, mirroring
  `billing:manage` in `SUPERADMIN_ONLY_PERMISSIONS`
  (`lib/platform/permissions.js:38`).

- **See another rep's data.** This is exactly the §3 scoping problem again —
  every `/sales` route must filter on `me`, never on an unscoped list, and
  (per §3) that filter has to be a hard boundary, not a second layer behind
  an already-scoped query.

None of the four above can be satisfied by hiding a control in the rep
portal's UI. Each needs its own server-side check, re-derived from the
database at write time, the same way `assertReadOnly()`
(`lib/currentMember.js:214-238`) and `canWrite()` are re-derived rather than
trusted from a claim the request carries.

---

## 5. Middleware ordering for `/sales`

`middleware.js`'s comment states its own order is load-bearing
(`middleware.js:14-16`, restated in `AGENTS.md`): subdomain rewrite first,
then the read-only impersonation gate, then the platform gates, then the app
gate. Tracing why, and where `/sales` would have to sit:

1. **Subdomain rewrite** (`middleware.js:116-159`) runs first and returns
   immediately, because a stranger on a tenant's subdomain must never be
   asked for a session. `/sales` is not a subdomain-reachable surface (no
   contractor's `sunset.fieldquo.com` should ever resolve a sales route), so
   this stage is a pure pass-through for it — but it has to run *before*
   `/sales`'s own gate regardless, for the same reason it runs before
   everything: the check is "is this host a tenant's," and that question has
   nothing to do with which staff surface is being requested.

2. **Impersonation gate** (`middleware.js:161-225`) is deliberately scoped
   *away* from `/platform` and `/api/platform`
   (`isPlatformSurface`, `middleware.js:181-183`) — the comment explains why:
   without that exclusion, holding an impersonation cookie would satisfy the
   block and return `next()` before the platform-token check ever ran,
   "turning a support token into read access to the platform console's own
   APIs" (`middleware.js:174-180`). `/sales` and `/api/sales` need the
   **identical** exclusion, for the identical reason: a real customer support
   session (impersonation cookie) must never be treated as a valid sales-rep
   session just because both are FieldQuo-staff-shaped paths. If `/sales` is
   *not* added to whatever check plays the role of `isPlatformSurface`, an
   impersonation cookie would satisfy the `pathname.startsWith("/app")`-style
   branch check only if `/sales` routes are matched by the same string test —
   they should not be, but the exclusion has to be **explicit**, not assumed,
   because the whole point of the existing comment is that "not exploitable
   yet" was true right up until it wasn't.

3. **Platform token gate** (`middleware.js:227-273`) is `PlatformAdmin`-only
   and must **not** also accept a rep's credential unless `SALES_REP` is
   folded into `PlatformAdminRole` — which §1 argues against. So a new
   `/sales` and `/api/sales` gate is a **new, separate stage**, structurally
   parallel to the platform-token stage (its own cookie name, its own
   `jwtVerify` against its own secret) rather than a branch inside it. It
   must sit **after** the impersonation-exclusion logic (so an impersonation
   cookie can't satisfy it) and **before** the generic `/app` gate falls
   through — `/sales` paths must never reach the `pathname.startsWith("/app")`
   branch (`middleware.js:276-282`), which only checks for a Better Auth
   session cookie and would happily let a signed-in company employee wander
   onto `/sales` pages that a downstream page-layout check might not
   anticipate. Concretely: a `pathname.startsWith("/sales")` /
   `pathname.startsWith("/api/sales")` block, placed alongside the
   `/platform` and `/api/platform` blocks, checked against its own cookie,
   returning 401/redirect the same way.

**What breaks if it's placed wrong:**

- **Before the impersonation-exclusion, or without adding `/sales` to that
  exclusion's path list:** a live customer-support impersonation session
  could be treated as satisfying `/sales`'s gate, or vice versa — a
  read-only support token reaching a rep surface it was never scoped for.
  This is precisely the class of bug the existing comment already flags as
  live-but-currently-harmless for `/platform` ("only superadmins can obtain
  [an impersonation token] today, so it isn't currently exploitable, but
  'not exploitable yet' is not the same as correct,"
  `middleware.js:178-180`) — adding a *fourth* staff surface without
  re-checking that exclusion list is exactly how "not exploitable yet"
  becomes exploitable.
- **After the generic `/app` gate, or matched by the same path prefix check:**
  a company employee's ordinary Better Auth session would satisfy `/sales`'s
  entry check with nothing but "signed in," because `middleware.js:276-282`
  asks only "does a session cookie exist," not "for whom." `/sales` needs its
  own credential type checked explicitly, not "any authenticated session."
- **Sharing the platform-token cookie/secret with `PlatformAdmin`:** collapses
  the two identity systems the moment a token is accepted by both gates —
  the exact hazard §1 argues against for the permission layer, reproduced at
  the transport layer.

---

## 6. Session and impersonation

**Non-negotiable #2 does not, as written, cover "an admin viewing a rep's
portal."** It is scoped specifically to a support session viewing a
*customer's* (company's) account — `getImpersonatedMember()` resolves a
`companyId` from the token and stands in for a `Member`
(`lib/currentMember.js:38-56`); there is no analogous notion of
impersonating a `PlatformAdmin`, and by extension none for impersonating a
`SALES_REP`. If FieldQuo wants "an owner/superadmin can see what a rep sees,"
that is **a different mechanism**, not a reuse of `startImpersonation`/the
`impersonation-token` cookie — the same way the migration-write exception was
explicitly built as a separate mechanism from impersonation rather than a
carve-out inside it (`docs/MIGRATION-SERVICE.md:110-127`,
`lib/currentMember.js:204-213`'s comment says this in almost identical
words: "This is a DIFFERENT mechanism… impersonation stays absolutely
read-only, with no exception").

Two shapes worth distinguishing for whatever gets built:

- **"View the rep's own dashboard as read-only, to help/audit them"** — this
  is structurally identical to today's impersonation (a superadmin sees
  exactly what the rep sees, cannot write). It could genuinely reuse the
  *pattern* (a short-lived signed token, a cookie, a strict method-based
  write gate re-checked in two independent places — middleware and the
  data-loading function, exactly as `assertReadOnly` is deliberately
  duplicated, `lib/currentMember.js:149-155`) without reusing the *code*,
  because the underlying identity (`SalesRep`, not `Member`) is different.
  Call it `sales_impersonation` with its own token/cookie namespace, gated to
  superadmin the same way `impersonate` already is
  (`lib/platform/permissions.js:12,14`).

- **"See every rep's book at once, as a manager view"** — this is not
  impersonation at all; it's a superadmin-role capability (`canPlatform(role,
  "sales:view_all")` or similar), answered the same way `company:view`
  answers "see every company" today. Worth naming explicitly as a separate
  question so it doesn't get built as a degenerate case of the impersonation
  mechanism, which would inherit read-only-and-time-limited semantics that a
  standing management view doesn't need or want.

Either way: whichever mechanism is chosen, it must independently prove it
cannot write on behalf of a rep — a commission, an attribution change, a
"paid" flag — for the same reason `assertReadOnly()` exists as a *second*,
independently-derived enforcement point rather than trusting the middleware
check alone (`lib/currentMember.js:204-213`'s comment on why: "the whole
reason it exists is that it must not agree with the first by copying it").

---

## 7. Existing checks that would need to learn about `SALES_REP`

Read each script's header/opening assertions (all under `scripts/`, run via
`npm run check:*`) against what a `SALES_REP` identity would introduce:

- **`check:rbac-nav`** (`scripts/check-rbac-nav.mjs`) — executes
  `navRowAllowed`/`NAV_REQUIREMENTS` against `Member`-shaped fixtures
  (`role`/`permissions`) (`scripts/check-rbac-nav.mjs:26-38`). It has no
  concept of a `/sales` sidebar and no reason to gain one *unless* the sales
  portal's own nav is built on `lib/permissions/nav.js`'s
  `navRowAllowed`/`filterNavGroupsByPermission` machinery — which it
  shouldn't be, per §1, since that machinery is keyed on `Member.role`. If
  the sales portal instead gets its own `lib/sales/nav.js` (recommended,
  mirroring the *pattern* not the *table*), this check needs no change and a
  **parallel** `check:sales-nav` should exist instead — same reasoning
  `check-nav-audit.mjs` gives for treating `/platform` and `/app` with the
  same rigor rather than a lighter pass
  (`scripts/check-nav-audit.mjs`'s point 5 comment).

- **`check:rbac-side-doors`** (`scripts/check-rbac-sideDoors.mjs`) — asserts
  both invite routes (`/api/settings/members`,
  `/api/team/quick-add`) call the **one** shared `validateInvite()` guard
  (`scripts/check-rbac-sideDoors.mjs:32-42`), because history shows a second
  invite door got hardened later and separately, and that gap was a real
  privilege-escalation bug. This is the single most important precedent for
  building the rep-invite flow: whatever creates a `SalesRep` row needs
  **one** shared guard function from day one (mirroring `validateInvite`'s
  role), and this script (or a sibling `check:sales-side-doors`) should
  assert every rep-creation entry point calls it — the exact failure mode
  this script exists to catch (one door hardened, a sibling door left open)
  is the single most likely way a `SALES_REP` feature ships with a hole.

- **`check:rbac-supervisors`** (`scripts/check-rbac-supervisors.mjs`) — built
  entirely from `PERMISSION_PRESETS`/`PRESET_TO_ROLE`
  (`scripts/check-rbac-supervisors.mjs:31-63`), which are `Member`-grid
  concepts. Not applicable to `SALES_REP` under the recommended model (§1) —
  no change needed, and no reason to force one.

- **`check:settings-access`** (`scripts/check-settings-access.mjs`) — walks
  `SettingsSidebar`, `SETTINGS_ROW_CAPABILITY`, `SETTINGS_ROW_REQUIREMENTS`
  (all `Member`/company-settings concepts, `lib/permissions/settingsAccess.js`).
  Not applicable unless a sales portal grows its own settings sidebar reusing
  the same component — if it does, this exact deny-by-default,
  every-row-must-have-an-answer discipline (`lib/permissions/settingsAccess.js:107-134`'s
  own header explains why the *old* fall-through-to-visible default was the
  bug) should be copied for a sales-settings equivalent, not silently
  skipped.

- **`check:tenant-scope`** (`scripts/check-tenant-scope.mjs`) — the most
  consequential one to get right. It is **exhaustive by construction**: it
  reads every `app/api/**/route.js` off disk and every `companyId`-bearing
  model from `schema.prisma`, and asserts every single-record lookup and
  every foreign key write is provably company-scoped
  (`scripts/check-tenant-scope.mjs:33-50`). If `/api/sales/*` routes are
  added under `app/api/`, this script will pick them up automatically (it's
  filesystem-driven, not a list someone updates) and will demand each one
  prove tenant scoping the normal way — which a rep route legitimately
  **can't**, because a rep route's whole point is to read across many
  tenants. This script's global-route declaration mechanism ("where a route
  is legitimately global, it DECLARES so below by name and with a reason,"
  `scripts/check-tenant-scope.mjs:47-50`, the same pattern
  `/api/platform/*` presumably already uses) is exactly the escape hatch
  `/api/sales/*` routes will need — but each one still has to prove the
  *narrower* invariant this script doesn't currently check for anybody: "this
  route's cross-tenant read is filtered to `assignedCompanyWhere(rep)`, not
  unfiltered." That is a **new** assertion this script does not make today
  for any existing route (nothing in the current codebase legitimately reads
  a *subset* of tenants by a non-company-scoped identity), and it is the
  single highest-value new check this feature should ship with — the
  cross-tenant version of what `assignedJobWhere()`'s own tests already prove
  at the row level (§3).

- **`check:crew-access`** (`scripts/check-crew-access.mjs`) — exercises the
  `none`-rung ladder for the lowest `Member` tier (`Crew`) end to end,
  including `seesOnlyAssignedJobs`/`assignedJobWhere`
  (`scripts/check-crew-access.mjs:29-34`). Not applicable to `SALES_REP`
  directly, but it is the concrete precedent for how a scoped-read fixture
  gets mutation-tested (the header explains testing index-shift bugs by
  actually running the functions rather than reading them,
  `scripts/check-crew-access.mjs:15-26`) — the sales-portal equivalent of
  `assignedCompanyWhere()` should get the same treatment: a fixture rep with
  a known attribution set, asserted to see exactly those companies and none
  other, mutation-tested by deliberately breaking the filter and confirming
  the assertion catches it.

- **`check:nav-audit`** (`scripts/check-nav-audit.mjs`) — walks
  `app/app/` and `app/platform/` page trees for orphaned pages and dangling
  nav rules (`scripts/check-nav-audit.mjs:1-30`). It is scoped to those two
  prefixes explicitly; a new `app/sales/` tree would be invisible to it
  unless the script's page-walk is widened to include it — the header's own
  reasoning for why `/platform` got the same rigor as `/app` ("built, linked
  only from a conditional alert banner… and invisible the moment that alert
  wasn't firing," `scripts/check-nav-audit.mjs`'s point 5) applies just as
  much to a sales portal: a rep-facing page that becomes unreachable from any
  nav row is the same silent-dead-screen failure this script exists to catch,
  and `app/sales/` should be added to whatever the script's root prefixes
  list is, not left uncovered.

**Not investigated:** `check:rbac-redaction` and `check:role-vocabulary` were
referenced by `check-rbac-supervisors.mjs`'s header
(`scripts/check-rbac-supervisors.mjs:19-23`) as adjacent coverage but were
not in the requested reading list and I did not open them; they are almost
certainly `Member`-grid-scoped like their siblings above and unaffected
unless the sales portal reuses `redactClient`/`redactQuote`-style payload
shaping, which §4's recommendation (a narrow, purpose-built field allowlist
rather than the existing redactors) argues against.

---

## Security risks — stated plainly

1. **Commission-on-influence is the sharpest fraud surface in this whole
   feature**, and it is not a hypothetical: a commission system pays real
   money on events a rep can, by the job's own nature, influence (which
   prospects get logged, when a demo is booked, how a conversion is
   attributed). Every one of AGENTS.md's non-negotiables about the platform
   console and about the browser never carrying money (`#3`, `#5`) exists
   because "the person closest to a number is the person who most needs to
   be kept away from writing it." A rep must have **zero** write path to
   anything commission- or attribution-shaped — not a restricted one. The
   precedent that gets this right today (`canWrite()`, re-checked fresh from
   the database inside the write's own transaction, restricted to
   superadmin-only, §4) is the bar to match, and it took a dedicated feature
   (the migration service) with its own state machine and its own audit
   table (`MigrationWrite`, `docs/MIGRATION-SERVICE.md:98-107`) to get there
   safely for a *much* lower-stakes write (a hand-entered legacy quote) than
   "money paid to the person who requested it."

2. **The cross-tenant read is the one genuinely new trust boundary this
   feature introduces**, and nothing in the current codebase has ever needed
   to build it before. Every existing scoping mechanism — `Member`'s
   `companyId`, `assignedJobWhere()`'s `visits.some`, even
   `PlatformAdmin`'s "sees everything" — is either "exactly one tenant" or
   "every tenant." "A specific, named subset of tenants, filtered by a
   foreign key on `Company`" has no precedent, no existing check catches it
   by accident (§7's `check:tenant-scope` finding), and getting the filter
   wrong doesn't leak one row — it leaks an entire customer's business to
   someone who was never vetted the way a `Member` or `PlatformAdmin` is.
   This deserves the same "exhaustive, filesystem-driven, mutation-tested"
   treatment `check:tenant-scope` gives ordinary tenant isolation, built
   *before* the first `/api/sales/*` route ships, not retrofitted after.

3. **Two identity systems that both authenticate "FieldQuo staff" is an
   invitation to collapse them.** The instant a rep's token is accepted by
   any check that was written with only `PlatformAdmin` in mind (`if
   (admin) { ... }` with no role/scope check beyond non-null — a pattern
   that likely exists in some `/api/platform/*` routes today, though I did
   not audit every one), that route silently grants the rep whatever a
   platform admin holds. This is exactly the shape of bug non-negotiable #2's
   "enforced twice, deliberately" was designed to prevent for impersonation —
   the same discipline (a completely separate secret, cookie name, and
   verification function, never a shared one with an extra `if`) has to apply
   to `SALES_REP` from the first line of code, not as a hardening pass after
   the fact.

4. **The demo account is a privileged single row inside an otherwise
   filtered set**, and the filter logic needs to treat it as a named
   exception, not a row that happens to satisfy the attribution predicate. If
   "one demo account" is implemented by literally attributing the demo
   company to every rep (`salesRepId` = shared/null-meaning-demo), that is a
   silent, easy-to-misread special case; if it's implemented as a second,
   explicit `OR isDemo` clause (as §3 recommends), it stays legible and
   auditable the same way `demo_sandbox` mode is today — gated strictly on
   `Company.isDemo` read fresh from the database, never from anything a
   caller sends (`lib/currentMember.js:70-73`).

---

## What I could not determine

- **Whether a `SalesRep` model, `Commission` model, or any sales-attribution
  column exists anywhere in the schema already.** I grepped for
  `commission`/`sales rep`/`SALES_REP`/`salesrep` across `prisma/schema.prisma`
  and `lib/` and found nothing (the three `commission` hits are all inside
  `lib/marketing/competitors.js`'s competitor-feature-comparison copy, not
  product code). This confirms the feature is being built from a genuinely
  empty slate on the data-model side, which the prompt already scoped out of
  this document, but it means every scoping claim above (`Company.salesRepId`
  or equivalent) is a placeholder for a column that does not exist yet, not a
  reference to a real one.

- **The full extent of `/api/platform/*` routes that check only "is
  `getCurrentPlatformAdmin()` non-null" versus routes that additionally check
  a specific permission via `canPlatform()`.** I read
  `lib/platform/permissions.js` and `middleware.js`'s platform-token gate,
  which together establish that the *transport* layer (the JWT cookie check)
  does not encode role at all — role is only checked inside individual route
  handlers via `requirePlatformPermission()`. I did not enumerate every
  `/api/platform/*` route to confirm each one calls `requirePlatformPermission`
  rather than trusting "cookie verified" alone; risk #3 above names this as
  the reason a shared secret/cookie between `PlatformAdmin` and `SALES_REP`
  would be dangerous, but I cannot state how many existing routes are
  currently exposed to that exact failure mode even without a new rep
  identity in play — that would need its own audit, separate from this one.

- **Whether `PlatformAdminRole`'s missing `admin` enum value (§1) is a live
  bug or dead code.** I confirmed the mismatch between the enum
  (`prisma/schema.prisma:5751-5754`, two values) and
  `PLATFORM_PERMISSIONS`/`app/api/platform/admins/route.js`'s validation
  (three values, including `admin`) but did not trace git history or check
  whether any `PlatformAdmin` row in a real database actually holds
  `role: "admin"` today. Flagged in §1 because it bears directly on "how
  settled is the platform-role system I'm being asked to extend," not
  because fixing it is in scope here.

- **Product-level questions this document deliberately does not answer**,
  because they are decisions, not architecture: what a commission actually
  is (percentage of first payment? recurring residual? flat bounty?), what
  "attributed" means at the moment a prospect enters the pipeline (who
  assigns it — the rep, self-serve, a superadmin?), and what a rep is allowed
  to see about a company's plan/payment status for commission-verification
  purposes without seeing the company's actual quotes/invoices/client data.
  Each of those materially changes what the read-scope allowlist in §3/§4
  needs to contain, and none of them can be inferred from the existing
  codebase.
