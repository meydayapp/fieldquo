# Activepieces as the AI employee's core — decision memo

Date: 2026-09-19. Source read: `/Users/emilioboves/Downloads/activepieces-main`,
version 0.92.0 (`package.json`, `docker-compose.yml`). Read-only research; no
FieldQuo code was changed. Every claim below cites the file it came from.
Paths without a leading slash are relative to the Activepieces checkout;
FieldQuo paths are marked `fq:`.

## (a) Verdict — brain vs hands

**The brain stays in FieldQuo. Activepieces is, at most, the hands — and only
the MIT hands.** The thing the owner is picturing when he says "the agent
runtime" is not in the MIT part of the repo: the agent (instructions, tool
attachment, conversation, credits, approval gate) lives in
`packages/server/api/src/app/ee/agent/*` and its run loop in
`packages/server/worker/src/lib/execute/jobs/ee/agent/*`, and `app.ts`
registers `agentModule` only under `ApEdition.CLOUD` and `ApEdition.ENTERPRISE`
(`packages/server/api/src/app/app.ts` lines 355–356 and 395–396); the
`ApEdition.COMMUNITY` branch registers exactly three modules —
`platformProjectModule`, `communityPiecesModule`, `otpModule` (lines 393–397).
The Enterprise licence (`packages/ee/LICENSE`) forbids copying, merging or
distributing that code, so we cannot lift it either. Even if we paid for it, it
is the wrong shape for us on four counts the code makes plain: (1) the model
fills piece inputs itself — "Let agent decide" is a per-input mode
(`docs/agents/tools.mdx`, `ee/agent/tools/piece-input-filler.ts`), which is
the opposite of `fq: lib/aiEmployee/tools.js`'s rule that the server prices and
companyId is injected last; (2) its "approval" is a Redis key with a 15-minute
TTL (`GATE_TTL_SECONDS = 15 * 60`, `ee/agent/agent-approval-gate.ts`) polled
by the worker for at most 5 minutes (`APPROVAL_TIMEOUT_MS = 5 * 60 * 1_000`,
`worker/.../ee/agent/execute-agent-run.ts` line 14) — a live chat pause, not a
proposal a contractor answers from the van tomorrow — and when the agent runs
as a flow step the gate returns `declined` unconditionally
(`execute-agent-run.ts` line 537–539); (3) read-vs-write is classified by
regex on the action name (`packages/core/shared/src/lib/ee/agent/tool-classification.ts`
lines 1–2: `list|get|search|…` vs `delete|remove|send|…`), so a tool we named
`book_callback` would fall to `needsConfirmation ?? true` and a competitor's
`quote_job` would be gated by luck; (4) tenancy is Activepieces' own
*project*, metered in Activepieces' own credits
(`packages/server/api/src/app/ai/ai-credits.ts`, `AP_AI_CREDIT_USD_VALUE`,
`CREDITS_PER_TOOL_CALL = 1`) through the Vercel AI SDK (`streamText` in
`worker/.../ee/agent/run-agent-turn.ts` lines 4, 77) — a second metering
system beside `fq: lib/ai/usage.js` and a second vendor client beside
`fq: lib/ai/provider.js`, which AGENTS.md says must be the only one. What
Activepieces genuinely has that we do not, and which *is* MIT: 734 piece
directories (`ls packages/pieces/community | wc -l`), OAuth connection storage
with refresh, a trigger lifecycle (`onEnable`/`onDisable`/`renewConfiguration`
in `packages/pieces/community/google-calendar/src/lib/triggers/new-event.ts`
lines 114–165), durable waitpoints (`packages/server/api/src/app/waitpoints/`),
and an MCP server whose `ap_run_action` tool runs any piece action once
(`packages/server/api/src/app/mcp/tools/ap-run-action.ts`). Those are hands.
The 20k stars are earned by the pieces and the builder, not by an agent brain
we could adopt.

## (b) Licensing — what is MIT and what is not

| Claim | Evidence |
|---|---|
| Root is MIT except two directories | `LICENSE` (root): everything under `packages/ee/` and `packages/server/api/src/app/ee` is under `packages/ee/LICENSE`; the rest is "MIT Expat". Restated in `docs/about/license.mdx` and `README.md` ("License"). |
| The Enterprise licence permits dev/test use only; production needs a paid subscription, and copying/merging/distributing is forbidden | `packages/ee/LICENSE`: "may only be used in production, if you … have a valid Activepieces Enterprise license … it is forbidden to copy, merge, publish, distribute, sublicense, and/or sell the Software." |
| **Embedding the builder into another SaaS is Enterprise** | The SDK itself is `packages/ee/embed-sdk/` (under the EE licence). `docs/embedding/overview.mdx` opens with `<Snippet file="embed-feature.mdx" />`, which reads "Embedding is available on our enterprise plan" (`docs/_snippets/embed-feature.mdx`). Provisioning users needs signing keys + JWT exchange (`docs/embedding/provision-users.mdx`), implemented in `ee/signing-key` and `ee/managed-authn`, registered only in the CLOUD/ENTERPRISE branches of `app.ts` (lines 333–335, 374–376). The web side checks `embedState.isEmbedded` (`packages/web/src/lib/navigation-utils.tsx` line 8) and routes under `packages/web/src/app/routes/embed/`. **No, embedding is not allowed on the community licence.** |
| Agents are Enterprise | `ee/agent/*` (see (a)); `platform_plan.agentsEnabled` flag (`ee/platform/platform-plan/platform-plan.entity.ts` line 71). |
| Flow Approvals (publish-time review) are Enterprise | `docs/flows/flow-approvals.mdx`: "Flow Approvals is an Enterprise / Cloud feature"; `ee/flows/flow-approval/`. |
| REST API keys are Enterprise | `docs/endpoints/overview.mdx` line 7: API keys "only available in the Platform and Enterprise editions"; `ee/api-keys`, `apiKeyModule` registered only in EE branches of `app.ts`. On Community, the only programmatic principal is a signed-in USER token. |
| **Branded OAuth apps are Enterprise; Community shows "Activepieces" on every consent screen** | `docs/admin-guide/guides/manage-oauth2.mdx` carries the enterprise snippet and says: "When users connect to services like Google Sheets or Slack, they see 'Activepieces' as the app requesting access." The default apps are Activepieces-owned: the `CLOUD_OAUTH2` connection type claims and refreshes tokens through `https://secrets.activepieces.com/claim` and `/refresh` (`packages/server/api/src/app/app-connection/app-connection-service/oauth2/services/cloud-oauth2-service.ts` lines 28, 55) — a contractor's Google refresh token would transit Activepieces Inc's servers. The alternative on Community is `AppConnectionType.OAUTH2`, where the *end user* pastes their own client id and secret (`app-connection-service.ts` line 740 case). `PLATFORM_OAUTH2` (our own apps for everyone) is the EE `oauth-apps` module. **This is the finding that decides the white-label question**: on the free licence, every "Connect Google Business Profile" a painter clicks says Activepieces, which AGENTS.md's white-label rule does not permit. |
| Everything we would actually want is MIT | Pieces (`packages/pieces/community/*`, each `package.json` under the root MIT), engine + worker + sandbox, flows, waitpoints (`app/waitpoints`), MCP server (`app/mcp`, registered unconditionally at `app.ts` line 255), tables (`app/tables`, line 269), knowledge base, AI provider module with your own keys (`app/ai`, line 267). |
| How EE is unlocked, for completeness | `brain/knowledge/platform-editions-ee/license-keys.md` (their internal notes): a licence key resolves to an Autumn billing customer; entitlements, not the key, project the flags; an unlicensed EE instance lands on a `free` plan with `usersLimit: 1`, `billingEnforced: true`, `showPoweredBy: true`. Pricing is not in the repo; `README.md` points at activepieces.com/pricing. |

## (c) Three integration options

Effort is in agent-weeks of one agent in its own worktree, build-verified.
Running cost is monthly and excludes model tokens, which we already meter.

### Option 1 — Publish FieldQuo as a piece (MIT, contribute upstream)

What it is: a `createPiece({ auth: PieceAuth.SecretText, actions, triggers })`
package following `packages/pieces/community/slack/src/index.ts` and the
action contract in `.../slack/src/lib/actions/request-approval-direct-message.ts`
(`createAction({ auth, name, classification: 'WRITE', props, run(context) })`),
with triggers on `TriggerStrategy.WEBHOOK` as in
`google-calendar/src/lib/triggers/new-event.ts`.

What FieldQuo lacks for it: a public, per-company API key and outbound
webhooks. `fq: app/api/public/` has only `quotes` and `refer`;
`fq: app/api/webhooks/` has only inbound handlers; `fq: prisma/schema.prisma`
has no ApiKey/OutboundWebhook model (grep on 2026-09-19). Those are the real
work — the piece is a week.

- Effort: **3–4 agent-weeks** (ApiKey model + hashed keys + scope; ~8
  read endpoints (leads, quotes, jobs, invoices, clients, bookings) that never
  return internal rates beyond what the company's own user could see; an
  outbound webhook fan-out with retries; the piece; PR upstream).
- Running cost: **~$0** (their cloud or the customer's self-host runs it).
- Unlocks: contractors who already use Activepieces/Zapier-style tools get
  "new lead in FieldQuo → …" flows; a marketing line ("works with 700+ apps").
  It does **not** give our employee any hands; it makes FieldQuo a hand for
  someone else's brain. Non-negotiable #4/#5 hold only if the piece's write
  actions never accept prices — `create_lead` yes, `create_quote` never.

### Option 2 — Self-hosted Activepieces CE beside Vercel, MCP into our employee

What it is: one Activepieces Community instance; one Activepieces *project*
per FieldQuo company (projects are the connection boundary — `ProjectScopedMcpServer`
in `app/mcp/mcp-server-builder.ts`; `platformProjectModule` is registered on
Community and `billedTeamProjectsLimit` is null there, so `assertMaximumNumberOfProjectsReachedByEdition`
returns early — `ee/projects/platform-project-controller.ts` lines 148–153);
our `runToolLoop` gains a tool family whose implementation calls the
project's MCP endpoint (`/mcp`, OAuth — `docs/mcp/overview.mdx`) with
`ap_search_actions` → `ap_get_piece_props` → `ap_run_action`
(`docs/mcp/tools.mdx`; `app/mcp/tools/ap-run-action.ts`), every write first
recorded as a proposal row in FieldQuo and executed only when the employee's
mode or a human allows it. On Community the MCP permission checker is
`ALLOW_ALL` (`app/mcp/mcp-permissions.ts` lines 7–16), so the permission
model is ours or nobody's.

- Effort: **5–7 agent-weeks.** Two for infra (compose per
  `docker-compose.yml`: app + N workers + `pgvector/pgvector:0.8.0-pg14` +
  `redis:7.0.7`; `AP_EXECUTION_MODE=SANDBOX_CODE_ONLY` is the only mode that
  is both multi-tenant-safe and unprivileged — `docs/_snippets/execution-mode.mdx`;
  2 vCPU / 4 GB minimum — `docs/install/options/docker-compose.mdx` line 27).
  One for project + MCP-OAuth-client provisioning per company (no API keys
  on Community, so provisioning runs as a signed-in FieldQuo service user's
  token — a workaround, not a supported path). Two–three for the tool family,
  the proposal record, the connection-picker UI in `/app`, and a check script
  that proves no price crosses the wire.
- Running cost: **~$60–120/month** — a 4 GB VPS or Fly/Railway box
  ($25–50), managed Postgres with pgvector ($20–40), managed Redis ($10–30).
  Plus ops: it is a second production system with its own upgrades
  (`docs/install/reference/breaking-changes.mdx` is long).
- Unlocks: every MIT piece in (e), OAuth storage + refresh, and triggers we
  could route back into FieldQuo as flows.
- The blocker: OAuth branding (see (b)). For Google Business Profile,
  QuickBooks and Canva, the consent screen would say Activepieces unless each
  contractor pastes a client id and secret — which a painter will not do — or
  we buy Enterprise for `PLATFORM_OAUTH2`. Meta is the exception: FieldQuo
  already holds its own Meta OAuth (`fq: prisma/schema.prisma` models
  `MetaAdConnection`, `MetaPageConnection`), so the Meta pieces add nothing.

### Option 3 — Embedded builder inside `/app` (Enterprise licence)

What it is: `packages/ee/embed-sdk` mounts an iframe
(`packages/ee/embed-sdk/src/index.ts` lines 272–306) authenticated by an
RS256 JWT we mint per member with a platform signing key
(`docs/embedding/provision-users.mdx`), with `embedding.hideFolders`,
`disableNavigation`, `styling.fontUrl/fontFamily/mode`,
`hideExportAndImportFlow` (`docs/embedding/embed-builder.mdx` lines 69–89)
and predefined connections so a company never re-enters credentials
(`docs/embedding/predefined-connection.mdx`, prerequisite "Run the Enterprise
Edition").

- Effort: **3 agent-weeks after the licence** (signing key, JWT mint,
  `/app/automations` route with the iframe, project-per-company via the
  Enterprise API keys, predefined FieldQuo connection, brand-colour pass —
  the iframe's theme is Activepieces' own, so `lib/documents/theme.js`
  contrast rules do not reach inside it).
- Running cost: the Option 2 hosting **plus an Enterprise subscription whose
  price is not in the repo** (`README.md` → pricing page; ask sales).
- Unlocks: contractors build their own automations; branded OAuth
  (`PLATFORM_OAUTH2`); agents, if we wanted them, with their chat-only gate.
- Risk: a second product's UI inside ours. Even with `hideLogo`-style options
  it is visibly a different app, and every flow a company builds there is a
  control we did not write and cannot verify against "never ship a control
  that appears to work and doesn't".

## (d) "Propose → human approves": waitpoints vs our proposals inbox

Activepieces has three different pause mechanisms, and only one is the shape
we need:

1. **Agent approval gate** (EE) — `ee/agent/agent-approval-gate.ts`. Keyed by
   `toolCallId`, stored in Redis with a 15-minute TTL, the worker blocks in
   50-second RPC slices (`APPROVAL_BLOCK_MS`) for up to 5 minutes and then
   returns `timeout`; a flow-step run auto-declines. The approved input is
   bound to the decision ("so a consumer can verify the action … matches what
   was approved") — a good idea worth copying into our proposals row. But the
   employee is *waiting* while the human decides. That is a chat UX, not a
   dispatcher proposing tomorrow's route at 6 pm.

2. **Waitpoints** (MIT) — `app/waitpoints/waitpoint-types.ts`: a Postgres row
   per paused *flow run* (`flowRunId`, `type: PauseType`, `resumeDateTime`,
   `resumePayload`, `sealed`, `policy: BarrierPolicy`), created from a piece
   with `context.run.createWaitpoint({ type: 'WEBHOOK' })` and resumed by any
   HTTP hit on `/:id/waitpoints/:waitpointId` (`app/waitpoints/resume-controller.ts`
   lines 22–39, with `/sync` and `/confirm` variants). The Slack piece shows
   the whole pattern: `waitpoint.buildResumeUrl({ queryParams: { action: 'approve' } })`
   becomes the button's value (`slack/src/lib/actions/request-approval-direct-message.ts`
   lines 41–58). Durable for days, survives worker restarts, one row per
   pending decision. **This is the shape of a proposal** — but it pauses a
   *flow*, not a model turn.

3. **Flow Approvals** (EE) — publish-time review of a flow definition
   (`docs/flows/flow-approvals.mdx`). Governance of automations, unrelated to
   run-time proposals.

Mapping onto ours: the proposals inbox the concurrent agent is building is
already the waitpoint pattern done in FieldQuo's own tables — a row with
`toolName`, the exact `toolInput` the human saw, who may approve, and a
`resolvedAt`. Our `runToolLoop` is synchronous (`fq: lib/aiEmployee/respond.js`
imports `runToolLoop` and returns one reply), so the correct design is the
one Activepieces' waitpoints imply and its agent gate does not: **the turn
ends when the proposal is written; approval is a separate request that
executes the recorded input, never a re-run of the model.** If Option 2 is
ever taken, an approved proposal whose action lives in Activepieces is
executed by calling `ap_run_action` with the stored input; a FieldQuo-side
action is executed by `executeFor()` with the stored input. Nothing in
Activepieces needs to be running while the contractor thinks. Two details
to copy from their gate: bind the decision to a hash of the previewed input
(`resolveGate` stores `approvedInput`), and treat a turn that read untrusted
content as tainted so nothing it wants to write is auto-approved
(`wrapToolsWithTaint`, `tool-primitives.ts` line 183; `requiresActionPreview`
ignores `needsConfirmation` when `tainted` — `tool-classification.ts` lines
35–37). The second one matters for us today: an inbound SMS is untrusted
content, and `accept_edits` should not let it drive a write.

## (e) Pieces a contractor needs — do they exist, and are they MIT

All of these are under `packages/pieces/community/` and therefore MIT
(root `LICENSE`). Counts are `ls src/lib/actions | wc -l` /
`ls src/lib/triggers | wc -l` on 2026-09-19; auth is the `PieceAuth.*` used.

| Need | Piece | Actions / triggers | Auth | Notes |
|---|---|---|---|---|
| QuickBooks | `quickbooks` (+ `quickbooks-sandbox`, `quickbooks-desktop-conductor`) | 12 / 8 (`src/actions`: create-invoice, record-payment, create-expense, find-customer …; `src/triggers`: new-invoice, payment-received …) | OAuth2 | Real accounting sync for Invoice → Payment. Consent screen says Activepieces on Community. |
| Google Calendar | `google-calendar` | 25 / 7 incl. `find-free-slots`, `create-event`, webhook trigger `new-event` with `renewConfiguration` | OAuth2 + service account | Useful for the dispatcher only if the company lives in Google Calendar; FieldQuo's own bookings are the primary calendar. |
| Google Business Profile | `google-my-business` | 6 / 1 (create/update/delete/get/list post, create-reply) | OAuth2 | Exactly the marketing employee's "post the finished job" and "reply to the review". Google Business Profile API access requires Google's quota approval — the same block noted in memory for Sunset Space. |
| Gmail | `gmail` | 36 / 5, incl. `request-approval-in-email` (a waitpoint) | OAuth2 + custom | Our From-line white-label already exists via Resend; Gmail matters only for reading a contractor's mailbox. |
| Mailchimp | `mailchimp` | 17 / 9 | OAuth2 | Campaign sends from job photos. |
| Slack | `slack` | 72 / 14, approval and "request action" pieces | OAuth2 | Internal team notifications, not client-facing. |
| DocuSign | `docusign` | 7 / 11 | SecretText / custom (integration key) | FieldQuo quotes are already signed in-product; DocuSign only for contractors whose GC demands it. |
| Canva | `canva` | 9 / 0 (create-design, export-design, import-design, upload-asset, find/get design, folders) | OAuth2 | No "fill a template with text and a photo" action — it creates and exports designs, so FieldQuo's own designer still writes the post. |
| Meta | `facebook-pages` (3 actions: create post / photo post / video post), `instagram-business` (2: upload photo / reel), `facebook-leads` (trigger) | — | OAuth2 | No Ads piece. FieldQuo already owns Meta OAuth and Ads (`MetaAdConnection`, `MetaPageConnection`), so these add nothing. |
| Not present | Jobber, FreshBooks, Wave, Google Maps/Solar | — | — | `housecall-pro` exists with 45 actions (a competitor's piece, SecretText auth) — worth knowing for migration imports. `xero`, `stripe`, `twilio`, `whatsapp` exist. |

## (f) What to do first

Keep the brain where it is — finish permission modes and the proposals inbox
in `lib/aiEmployee/` — and spend at most two agent-days on a throwaway spike
that boots Activepieces CE from `docker-compose.yml` on a laptop, connects one
Google Business Profile account, and calls `ap_run_action` on
`google-my-business.create_post` from a script through `/mcp`, so the OAuth
consent screen and the round-trip latency are measured before anyone budgets
Option 2 or asks Activepieces for an Enterprise price.
