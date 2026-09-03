// lib/sales/pipeline/handlers/enrichBusiness.js
//
// ENRICH_BUSINESS — the gate between the bank and the worked set.
//
// ══ What this stage is, stated plainly, because the name oversells it ══════
//
// It does not buy data. There is no enrichment vendor wired into this product
// and this file does not pretend otherwise: `PROVIDER_BY_KIND` maps it to
// `local` for exactly that reason, and `resolveProvider` lets a task name a
// real vendor's budget the day one exists.
//
// What it does is the four things that have to happen once, before a prospect
// costs anybody anything:
//
//   1. REFUSE. A business that said do-not-contact, or that is on FieldQuo's
//      platform suppression list, stops here — before the crawler fetches
//      their pages and before a model is asked to write about them. The
//      crawler checks the list too; this is the same deliberate double gate
//      middleware.js and lib/currentMember.js keep on impersonation, and for
//      the same reason: the cheapest place to stop is not the only place that
//      may stop.
//   2. REPAIR. `domain` derived from `websiteUrl`, `phoneE164` normalised.
//      Only ever filling a hole — a value that exists is never overwritten,
//      and nothing is ever written back as null. Discovery normalises both
//      already; a hand-typed prospect and a row from a future provider have
//      not been through that path.
//   3. PROMOTE. `status` moves `discovered` → `researching`, guarded on the
//      value that was read. That transition is what bounds the discovery
//      fan-out: DISCOVER_BUSINESSES queues research for prospects still at
//      `discovered`, so a row that has been picked up is not offered again.
//   4. ROUTE. A prospect with a website goes to the crawler. One without goes
//      STRAIGHT to the opportunity analysis, skipping the crawl, the
//      fingerprint and the capability pass — three stages that, with no page
//      to read, can only spend three ticks writing "we did not look".
//
// ══ What it must never do ══════════════════════════════════════════════════
//
// Write `hasWebsite: false`. The source listing no website is a gap in a
// directory (Overture's website fill is 92.7%, measured) and not a finding
// about the business, and `WEBSITE: false` is the highest-priority
// non-competitor opportunity rule there is. A rep opening with "I see you have
// no website" to somebody who has one is the single most expensive sentence
// this pipeline can produce. Only a crawl may make that claim, and today
// nothing does — see the report accompanying this work.
import { db } from "@/lib/db";
import { registerHandler } from "@/lib/sales/pipeline/registry";
import { advanceChain } from "@/lib/sales/pipeline/chain";
import { checkSuppression } from "@/lib/sales/suppression";
import { normaliseDomain, normalisePhone } from "@/lib/sales/suppressionRules";

/** The status a prospect must be in to be promoted, and the one it moves to. */
export const RESEARCHABLE_STATUS = "discovered";
export const RESEARCHING_STATUS = "researching";

/**
 * Where a prospect goes next.
 *
 * Exported and pure so the branch can be driven without a database — it is the
 * decision that separates a two-second chain from a four-tick one, and it is
 * the one place a website that is merely unreachable could be mistaken for a
 * business without a website.
 */
export function routeAfterEnrich(prospect) {
  const url = typeof prospect?.websiteUrl === "string" ? prospect.websiteUrl.trim() : "";
  if (url) return { next: "CRAWL_WEBSITE", reason: "website_listed" };
  // NOT "they have no website" — "we have no address to fetch". The
  // distinction is the whole of this file's closing comment.
  return { next: "DETECT_OPPORTUNITIES", reason: "no_website_to_crawl" };
}

/**
 * What, if anything, to write back onto the row.
 *
 * Pure, and it returns an EMPTY object when there is nothing to fix, so the
 * handler can skip the write entirely rather than touching `updatedAt` on
 * every prospect on every run.
 */
export function repairsFor(prospect) {
  const data = {};

  if (!prospect?.domain && prospect?.websiteUrl) {
    const domain = normaliseDomain(prospect.websiteUrl);
    if (domain) data.domain = domain;
  }

  // A phone that is stored unnormalised. `Prospect.phoneE164` is the only
  // phone column there is, so this is a repair of a value written by something
  // that did not normalise — a hand-typed row, or a future provider — and
  // never an invention: normalisePhone returning null leaves what was there.
  if (prospect?.phoneE164) {
    const phone = normalisePhone(prospect.phoneE164);
    if (phone && phone !== prospect.phoneE164) data.phoneE164 = phone;
  }

  return data;
}

/**
 * @param payload { prospectId? } — falls back to the task's own column, the
 *        same as every other stage, so both enqueue shapes work.
 */
export async function handleEnrichBusiness({ task, payload = {}, db: prisma } = {}) {
  const prospectId = payload.prospectId || task?.prospectId || null;
  if (!prospectId) {
    return { done: false, retry: false, reason: "enrich_business: no prospectId on the task or its payload" };
  }

  // Read fresh. A prospect marked do-not-contact three hours after this task
  // was queued must stop here, and the only way to know that is to ask now —
  // the discipline lib/migrations/state.js's canWrite() applies to a far more
  // dangerous write.
  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId },
    select: {
      id: true,
      status: true,
      businessName: true,
      phoneE164: true,
      domain: true,
      websiteUrl: true,
      doNotContactAt: true,
      doNotContactReason: true,
      campaignId: true,
    },
  });

  if (!prospect) {
    return { done: false, retry: false, reason: "enrich_business: prospect not found" };
  }

  if (prospect.doNotContactAt) {
    // Terminal, and terminal WITHOUT a successor: the chain stops here rather
    // than spending a crawl and a model call researching somebody who asked us
    // not to. Returned as a refusal rather than `done` so the row says why.
    return {
      done: false,
      retry: false,
      reason: `enrich_business: do not contact — ${prospect.doNotContactReason || "no reason recorded"}`,
    };
  }

  // The platform list, keyed independently on phone and registrable domain.
  // Channel "phone" because a research pipeline exists to produce a call; an
  // unqualified opt-out closes every channel anyway (see suppressionRules.js).
  const suppression = await checkSuppression(prisma, {
    channel: "phone",
    phone: prospect.phoneE164,
    domain: prospect.domain || prospect.websiteUrl,
  });
  if (suppression.suppressed) {
    return {
      done: false,
      retry: false,
      reason: `enrich_business: suppressed — ${suppression.reason}`,
    };
  }

  const repairs = repairsFor(prospect);
  const route = routeAfterEnrich(prospect);

  // The promotion and the repairs in one write. Guarded on the status that was
  // read, so two runners that both claimed a stale task cannot both count this
  // prospect into the worked set — and an already-promoted prospect being
  // re-enriched (a superadmin re-running research) simply matches nothing and
  // carries on, because the promotion is a bookkeeping detail and the routing
  // below is the actual work.
  let promoted = 0;
  if (prospect.status === RESEARCHABLE_STATUS || Object.keys(repairs).length) {
    const written = await prisma.prospect.updateMany({
      where: { id: prospect.id, status: prospect.status },
      data: {
        ...repairs,
        ...(prospect.status === RESEARCHABLE_STATUS ? { status: RESEARCHING_STATUS } : {}),
      },
    });
    promoted = written.count;
  }

  await advanceChain({ kind: "ENRICH_BUSINESS", task, db: prisma, next: route.next });

  return {
    done: true,
    note: [
      `routed to ${route.next} (${route.reason})`,
      Object.keys(repairs).length ? `repaired ${Object.keys(repairs).join(", ")}` : null,
      promoted ? `promoted to ${RESEARCHING_STATUS}` : null,
    ]
      .filter(Boolean)
      .join("; "),
  };
}

// Registered WITHOUT withChain: this stage picks its own successor, and the
// wrapper would queue a second one from NEXT_STAGE. NEXT_STAGE.ENRICH_BUSINESS
// is null for that reason and chain.js says so.
// No `now` in the signature: this stage writes no timestamp of its own. Every
// date it could stamp is already owned by something else — `assignedAt` by the
// claim, `detectedAt` by the detectors, `computedAt` by the score — and a
// parameter nothing reads is the first recurring failure class.
registerHandler("ENRICH_BUSINESS", async ({ task, payload, db: prisma }) =>
  handleEnrichBusiness({ task, payload, db: prisma || db }),
);
