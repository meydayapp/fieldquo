// lib/company/chat/cards.js
//
// A shared job, work order or quote in team chat — a CARD, not a URL.
//
// ══ Ids in the row, words per reader ══════════════════════════════════════
//
// CompanyChatMessage.card stores { type, id } and nothing else (rules.js
// parseCard). Every reader's thread resolves it with THEIR OWN access, at
// read time:
//
//   job         title, status, next visit, "Open job" — for a reader who can
//               see the job (jobs: view_only, and for the crew the job must
//               be theirs: lib/permissions/enforce.js assignedJobWhere, a
//               visit or a published shift). Anybody else: "for the people on
//               this job", nothing more.
//   work_order  the same scope, and the link is the work order — the crew's
//               no-prices page (lib/workOrder). A reader who can also open
//               quotes gets the quote's link too, so ONE card serves the
//               crew and the office in the same room.
//   quote       number and client, "Open quote" — for a reader whose grid
//               opens quotes (lib/quotes/shareWithStaff.js canOpenQuote, the
//               rung GET /api/quotes/[id] refuses below). Anybody else:
//               "Office only".
//
// No card carries a total, a rate, a cost or any other money key, for
// anybody: a total in chat is a total in a screenshot. check:company-chat and
// check:role-access walk every resolved card's keys for money.
//
// Re-resolving on read is also what keeps a card honest over time: take a
// crew member off the job and their old card stops opening the job, the same
// day the job list stops listing it.
import { hasLevel, assignedJobWhere, loadEnforceableMember } from "@/lib/permissions/enforce";
import { canOpenQuote } from "@/lib/quotes/shareWithStaff";
import { workOrderPath } from "@/lib/workOrder/url";
import { parseCard } from "./rules";

/**
 * The grid the card decisions read. A real member is re-read from the
 * database (the session object may be stale or partial); a read-only support
 * session holds no row and is judged as itself — it sees the whole company,
 * read-only, as everywhere else.
 */
export async function enforceableFor(client, member) {
  if (member?.id) {
    const row = await loadEnforceableMember(client, member.id);
    if (row && row.companyId && row.companyId !== member.companyId) return null;
    return row;
  }
  if (member?.impersonation) return member;
  return null;
}

/** May this person see jobs at all? The rung GET /api/jobs/[id] refuses below. */
function seesJobs(full) {
  return Boolean(full) && hasLevel(full, "jobs", "view_only");
}

/**
 * May the POSTER share this card? They must be able to open what they share,
 * in their own company — a card is not a way to learn that a job id exists.
 * @returns { ok: true, card } | { ok: false, code: "bad_card" }
 */
export async function checkCardForPoster(client, member, input) {
  const card = parseCard(input);
  if (card === null) return { ok: true, card: null };
  if (card === false) return { ok: false, code: "bad_card" };
  const full = await enforceableFor(client, member);
  if (!full) return { ok: false, code: "bad_card" };
  if (card.type === "quote") {
    if (!canOpenQuote(full)) return { ok: false, code: "bad_card" };
    const quote = await client.quote.findFirst({ where: { id: card.id, companyId: member.companyId }, select: { id: true } });
    return quote ? { ok: true, card } : { ok: false, code: "bad_card" };
  }
  if (!seesJobs(full)) return { ok: false, code: "bad_card" };
  const job = await client.job.findFirst({
    where: { id: card.id, companyId: member.companyId, ...assignedJobWhere(full) },
    select: { id: true },
  });
  return job ? { ok: true, card } : { ok: false, code: "bad_card" };
}

/**
 * Resolve the cards on these message rows for this reader, by two queries at
 * most. Returns Map(messageId → resolved card). Rows without a card, and
 * removed rows (their card is never drawn), are skipped.
 */
export async function resolveCards(client, member, rows, { now = new Date(), full: given } = {}) {
  const out = new Map();
  const wanted = [];
  for (const m of Array.isArray(rows) ? rows : []) {
    if (!m || m.deletedAt) continue;
    const card = parseCard(m.card);
    if (card) wanted.push({ messageId: m.id, card });
  }
  if (!wanted.length) return out;
  const full = given !== undefined ? given : await enforceableFor(client, member);
  const jobIds = [...new Set(wanted.filter((w) => w.card.type !== "quote").map((w) => w.card.id))];
  const quoteIds = [...new Set(wanted.filter((w) => w.card.type === "quote").map((w) => w.card.id))];
  const openQuotes = Boolean(full) && canOpenQuote(full);

  const jobs = jobIds.length && seesJobs(full)
    ? await client.job.findMany({
        where: { id: { in: jobIds }, companyId: member.companyId, ...assignedJobWhere(full) },
        select: {
          id: true,
          title: true,
          status: true,
          quoteId: true,
          visits: { where: { scheduledAt: { gte: startOfDay(now) } }, orderBy: { scheduledAt: "asc" }, take: 1, select: { scheduledAt: true } },
        },
      })
    : [];
  const quotes = quoteIds.length && openQuotes
    ? await client.quote.findMany({
        where: { id: { in: quoteIds }, companyId: member.companyId },
        select: { id: true, quoteNumber: true, status: true, client: { select: { name: true } } },
      })
    : [];
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const quoteById = new Map(quotes.map((q) => [q.id, q]));

  for (const { messageId, card } of wanted) {
    if (card.type === "quote") {
      const q = quoteById.get(card.id);
      out.set(
        messageId,
        q
          ? { type: "quote", open: true, number: q.quoteNumber || null, clientName: q.client?.name || null, status: q.status || null, href: `/app/quotes/${encodeURIComponent(q.id)}` }
          : { type: "quote", open: false, restricted: "office" },
      );
      continue;
    }
    const j = jobById.get(card.id);
    if (!j) {
      out.set(messageId, { type: card.type, open: false, restricted: "job_crew" });
      continue;
    }
    const base = {
      type: card.type,
      open: true,
      title: j.title || null,
      status: j.status || null,
      nextVisitAt: j.visits?.[0]?.scheduledAt ? new Date(j.visits[0].scheduledAt).toISOString() : null,
    };
    if (card.type === "work_order") {
      out.set(messageId, {
        ...base,
        href: workOrderPath(j.id),
        quoteHref: openQuotes && j.quoteId ? `/app/quotes/${encodeURIComponent(j.quoteId)}` : null,
      });
    } else {
      out.set(messageId, { ...base, href: `/app/jobs/${encodeURIComponent(j.id)}`, workOrderHref: workOrderPath(j.id) });
    }
  }
  return out;
}

function startOfDay(now) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}
