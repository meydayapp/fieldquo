// lib/sales/repLink.js
//
// A rep's link, both directions: the code a link is BUILT from, and the rep a
// code that arrives on a request RESOLVES to.
//
// ══ Built from the opaque token, never the name slug ══════════════════════
//
// SalesRep.code is the rep's real name, slugged. Every "copy my link", every
// texted signup link, every intro email and every demo-page address now
// carries SalesRep.referralToken instead (lib/sales/repIdentity.js says why).
//
// ══ Minted lazily, one row at a time ══════════════════════════════════════
//
// The owner's rule: no bulk backfill. A rep who predates the column has no
// token until something builds a link for them, and then ensureReferralToken
// mints exactly one, for exactly that row. The write is conditional
// (`referralToken: null` in the WHERE) so two tabs building the rep's link at
// once cannot give them two different tokens — the loser re-reads and uses
// the winner's, which is the one that will be in the prospect's inbox.
//
// ══ Resolved from both, token first ═══════════════════════════════════════
//
// Old links keep working: a printed card, a text from last month, a
// bookmarked demo page. findRepByLinkCode tries the token column, then the
// legacy code column, and nothing else — an unknown value resolves to null
// and the caller treats it exactly like no code at all (no attribution, the
// demo page's "not found"). A minted token is refused if it equals any rep's
// legacy code, so the two namespaces can never answer the same string with
// two different reps.
import { db } from "@/lib/db";
import { isReferralTokenShape, mintReferralToken } from "./repIdentity";

const MINT_ATTEMPTS = 6;

/**
 * The token for this rep, minting one on first use.
 *
 * @param {{ id: string, referralToken?: string|null }} rep  a row with at
 *   least `id`; pass `referralToken` when already loaded to skip the read.
 * @param {object} client  db or a transaction client.
 * @param {{ mint?: () => string }} opts  injectable for the check script.
 * @returns {Promise<string|null>} null only when `rep` has no id.
 */
export async function ensureReferralToken(rep, client = db, { mint = mintReferralToken } = {}) {
  if (!rep?.id) return null;
  if (rep.referralToken) return rep.referralToken;

  const current = await client.salesRep.findUnique({ where: { id: rep.id }, select: { referralToken: true } });
  if (!current) return null;
  if (current.referralToken) return current.referralToken;

  for (let i = 0; i < MINT_ATTEMPTS; i++) {
    const token = mint();
    // Neither another rep's token nor anybody's legacy code. The second half
    // matters: findRepByLinkCode reads the token column first, so a token
    // equal to a colleague's old slug would silently steal their printed
    // cards' signups.
    const clash = await client.salesRep.findFirst({
      where: { OR: [{ referralToken: token }, { code: { equals: token, mode: "insensitive" } }] },
      select: { id: true },
    });
    if (clash) continue;
    try {
      const res = await client.salesRep.updateMany({
        where: { id: rep.id, referralToken: null },
        data: { referralToken: token },
      });
      if (res.count === 1) return token;
      // Somebody else minted between our read and our write. Theirs stands.
      const again = await client.salesRep.findUnique({ where: { id: rep.id }, select: { referralToken: true } });
      if (again?.referralToken) return again.referralToken;
    } catch (err) {
      // A token minted for another rep in the same instant. Try another.
      if (err?.code !== "P2002") throw err;
    }
  }
  // Six 40-bit collisions in a row is not bad luck; say so rather than hand
  // back a link built from the name slug the token exists to replace.
  throw new Error(`Could not mint a referral token for rep ${rep.id}.`);
}

/**
 * The rep behind a code off a link — token first, legacy slug second.
 *
 * `raw` is expected to be already trimmed and lower-cased by the caller's own
 * reader (lib/sales/attribution.js readSalesCode) but is normalised again
 * here; this function is also the door for the demo page's path segment.
 *
 * @param {string|null} raw
 * @param {object} client
 * @param {object} select  Prisma select for the returned row.
 * @returns {Promise<object|null>}
 */
export async function findRepByLinkCode(raw, client = db, select = { id: true }) {
  const code = String(raw || "").trim().toLowerCase();
  if (!code) return null;
  if (isReferralTokenShape(code)) {
    const byToken = await client.salesRep.findUnique({ where: { referralToken: code }, select });
    if (byToken) return byToken;
  }
  return client.salesRep.findFirst({ where: { code: { equals: code, mode: "insensitive" } }, select });
}

/**
 * The rep ids a list of link codes resolves to — the batch form of the
 * above, for screens that match many SignupLead.salesCode values at once.
 * Returns a Map keyed by the lower-cased code as presented.
 */
export async function repIdsByLinkCodes(codes, client = db) {
  const wanted = [...new Set((codes || []).map((c) => String(c || "").trim().toLowerCase()).filter(Boolean))];
  const out = new Map();
  if (!wanted.length) return out;
  const tokens = wanted.filter(isReferralTokenShape);
  const rows = await client.salesRep.findMany({
    where: {
      OR: [
        ...(tokens.length ? [{ referralToken: { in: tokens } }] : []),
        // Legacy codes are stored lower-case (repCode.js isValidCode), and
        // `wanted` is lower-cased above, so a plain `in` matches.
        { code: { in: wanted } },
      ],
    },
    select: { id: true, code: true, referralToken: true },
  });
  // Legacy first, token second, so a token match overwrites — the same
  // precedence findRepByLinkCode keeps.
  for (const r of rows) if (r.code) out.set(r.code.toLowerCase(), r.id);
  for (const r of rows) if (r.referralToken) out.set(r.referralToken, r.id);
  return out;
}
