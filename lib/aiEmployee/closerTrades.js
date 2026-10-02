// lib/aiEmployee/closerTrades.js
//
// The services a company has switched on, read for the closer's prompt.
//
// Split from lib/aiEmployee/closerTechnique.js so that file stays pure text —
// roles.js imports it on every reply and the check executes it with no
// database. This one does the read, through the prisma respond.js hands it.
//
// ══ What is read, and what deliberately is not ═════════════════════════════
//
// CompanyServiceCategory rows with enabled = true — the same rows Settings ›
// Services writes, lib/trades/companyCategories.js reads, and the instant
// estimator prices from — and from each only the category's KEY and LABEL.
// `rates`, `defaultRate`, `crewRate*` are never selected: a rate that is never
// loaded is a rate that cannot reach a prompt a homeowner's reply is written
// from (the same stance upsellTopicsForCompany takes in
// lib/voice/quoteQuestions.js, for the same reason).
//
// A company's own custom category carries a label the contractor TYPED, so it
// goes through safeMaterialLabel — the one guard this repo already uses for a
// company-typed label read into a model prompt. It rejects money-shaped and
// instruction-shaped text rather than repairing it; a rejected label costs the
// closer one service name, a kept one could put "$4,500" in its mouth.
//
// ══ Never the reason a reply fails ═════════════════════════════════════════
//
// Any failure — a scripted test database without the table, a Neon cold
// start — returns [], which the prompt states as "no services listed" and
// answers with the general approach. Plainer guidance, never a broken reply.

import { safeMaterialLabel } from "@/lib/voice/quoteQuestions";

/** At most this many services are read; the prompt shows fewer still. */
const MAX_ROWS = 40;

/**
 * @returns [{ key, label }] in the company's own sort order, catalogue
 *          trades labelled by the catalogue, custom ones by their own guarded
 *          label (dropped when the guard rejects it).
 */
export async function closerTradesFor(prisma, companyId) {
  if (!companyId || typeof prisma?.companyServiceCategory?.findMany !== "function") return [];
  try {
    const rows = await prisma.companyServiceCategory.findMany({
      where: { companyId, enabled: true },
      select: { category: { select: { key: true, label: true, isSystem: true, sortOrder: true } } },
      orderBy: { category: { sortOrder: "asc" } },
      take: MAX_ROWS,
    });
    return (Array.isArray(rows) ? rows : [])
      .map((r) => r?.category)
      .filter((c) => c?.key)
      .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
      .map((c) => ({
        key: String(c.key),
        // A system category's label is ours (lib/trades/catalog.js seeds it);
        // a custom one's is the contractor's own words, guarded.
        label: c.isSystem === false ? safeMaterialLabel(c.label) : String(c.label || "").trim() || null,
      }))
      .filter((t) => t.label);
  } catch (err) {
    console.error("[aiEmployee] could not read the company's services for the closer:", err?.message);
    return [];
  }
}
