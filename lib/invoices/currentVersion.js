// lib/invoices/currentVersion.js
//
// Which version of an invoice a back-office link should open, and whether the
// page it opened is allowed to render what it loaded.
//
// ══ Why one function and not two rules ═════════════════════════════════════
//
// Amending a sent invoice writes a NEW row and leaves the old one as the
// snapshot the client already holds (PATCH /api/invoices/[id]). The root's id
// never changes, so EVERY link in the office — the list grid, the dashboard,
// the client record, the quote, the schedule panel, the plan, the job's
// documents — points at the root, which after one amendment is v1. The owner
// pressed Save, came back, and was shown the old document with a banner
// offering to open the new one. The banner was right; being sent there at all
// was the bug.
//
// There are two places that answer "which id is current": the href, computed
// before the page loads, and the page itself, which has to cope with every
// other entry point. Writing that rule twice is exactly the drift that put the
// marketing dashboard and the lead page on opposite sides of "was this lead
// visited" — two rules for one question, each defensible, disagreeing on
// screen. So the rule is `currentVersionId` here, and both sides call it:
// GET /api/invoices sets the `currentVersionId` field with it, the list page
// builds its href with it, and the detail page decides whether to redirect
// with it.
//
// ══ Never a redirect that hides data ═══════════════════════════════════════
//
// "Always open the latest" on its own would make v1 unreachable, and v1 is a
// document a household received. So an explicit flag on the URL — the one the
// Earlier-versions list emits — says "I asked for this old one on purpose",
// and the page renders it with the superseded banner it has always had.
// Nothing else in the office emits that flag, so a stale bookmark or a link
// from an email still lands on the version that stands.

/** The query flag meaning "show me this exact version, replaced or not". */
export const HISTORY_PARAM = "history";
const HISTORY_ON = "1";

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Every row in this invoice's family, as {id, version}, including the row
 * itself — from whatever the caller happens to hold.
 *
 * `family` is GET /api/invoices/[id]/versions: the whole family, from any
 * member. `invoice.versions` is the Prisma relation, which is this row's
 * CHILDREN — the whole family only when the row is the root. Both shapes are
 * accepted and merged by id, because the list route holds the second and the
 * detail page holds the first.
 */
function familyRows(invoice, family) {
  const byId = new Map();
  if (invoice?.id) byId.set(invoice.id, { id: invoice.id, version: num(invoice.version, 1) });
  for (const list of [family, invoice?.versions]) {
    for (const row of Array.isArray(list) ? list : []) {
      if (!row?.id) continue;
      // The row's own version wins over a stub: the family query carries it,
      // and `invoice.versions` entries without one would otherwise read as 0.
      const prev = byId.get(row.id);
      byId.set(row.id, { id: row.id, version: num(row.version, prev ? prev.version : 0) });
    }
  }
  return [...byId.values()];
}

/**
 * The id of the version that stands — the highest `version` in the family.
 *
 * Ordered by the version NUMBER, never by id or by creation time: an invoice
 * imported from history, or a family whose rows were written out of order,
 * has a latest version that is not its newest id. Ties keep the row handed in,
 * so a page can never redirect to itself.
 *
 * Pure. `invoice` needs `id`, `version`, and either a `versions` relation or a
 * `family` list (see familyRows).
 */
export function currentVersionId(invoice, family = null) {
  if (!invoice?.id) return null;
  let bestId = invoice.id;
  let bestVersion = num(invoice.version, 1);
  for (const row of familyRows(invoice, family)) {
    if (row.id === invoice.id) continue;
    if (row.version > bestVersion) {
      bestVersion = row.version;
      bestId = row.id;
    }
  }
  return bestId;
}

/** How many distinct versions this invoice has, counting itself. */
export function familySize(invoice, family = null) {
  return familyRows(invoice, family).length;
}

/**
 * Where the office should link an invoice: the version that stands.
 *
 * `currentVersionId` on the row is GET /api/invoices' own answer, computed by
 * the function below — so this prefers it rather than re-deriving what the
 * server already worked out, and the two cannot disagree. Until this call site
 * existed that field was written and read by nothing: a correct answer sitting
 * in the very file whose link was wrong. The fallback is for every row that
 * arrives without it.
 */
export function invoiceHref(invoice, family = null) {
  const id = invoice?.currentVersionId || currentVersionId(invoice, family);
  return id ? `/app/invoices/${id}` : "/app/invoices";
}

/** Where the Earlier-versions list points: this exact version, on purpose. */
export function invoiceVersionHref(id, { history = true } = {}) {
  if (!id) return "/app/invoices";
  return history
    ? `/app/invoices/${id}?${HISTORY_PARAM}=${HISTORY_ON}`
    : `/app/invoices/${id}`;
}

/**
 * Did this URL ask for a specific version on purpose?
 *
 * Takes a query string, a URLSearchParams, or null. Anything other than the
 * flag's one value is "no": a truthy-string test would make `?history=0` mean
 * yes, which is the kind of thing nobody notices until a replaced invoice is
 * sitting on screen again.
 */
export function askedForVersion(search) {
  if (!search) return false;
  const params =
    typeof search === "string" ? new URLSearchParams(search) : search;
  try {
    return params.get(HISTORY_PARAM) === HISTORY_ON;
  } catch {
    return false;
  }
}

/**
 * What the invoice detail page should do with what it loaded.
 *
 * @returns {{render: boolean, redirectTo: string|null, currentId: string|null,
 *            isCurrent: boolean, showHistory: boolean}}
 *
 *   render       draw the document (false means a redirect is pending — the
 *                page must keep showing its loading state rather than flash
 *                the replaced document for a frame)
 *   redirectTo   the id to replace the URL with, or null
 *   showHistory  draw the "Earlier versions" control: only on the version that
 *                stands, and only when there is actually more than one. On a
 *                replaced version the superseded banner already offers the one
 *                useful move, and a history list under it would be a second
 *                answer to the same question.
 */
export function resolveInvoiceVersionView({
  invoice,
  family = null,
  askedForThisVersion = false,
} = {}) {
  if (!invoice?.id)
    return { render: false, redirectTo: null, currentId: null, isCurrent: false, showHistory: false };

  const currentId = currentVersionId(invoice, family);
  const isCurrent = currentId === invoice.id;

  if (!isCurrent && !askedForThisVersion)
    return { render: false, redirectTo: currentId, currentId, isCurrent, showHistory: false };

  return {
    render: true,
    redirectTo: null,
    currentId,
    isCurrent,
    showHistory: isCurrent && familySize(invoice, family) > 1,
  };
}
