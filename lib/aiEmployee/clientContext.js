// lib/aiEmployee/clientContext.js
//
// What the AI employee may know about the customer on the other end of a
// thread that belongs to a KNOWN client (MessageThread.clientId): the
// equipment the company installed or services at their home, and the work
// it last did there. The "installed-equipment card" of the plan (§3).
//
// ══ Never money ════════════════════════════════════════════════════════════
//
// A troubleshooter has no business with a price, an invoice, a balance or a
// quote total, and the person typing may not even be the account holder.
// So every read below names its columns explicitly (EQUIPMENT_SELECT,
// JOB_SELECT) — no `include`, no spread of a whole row — and
// scripts/check-reference-library.mjs proves no money-shaped key can reach
// the card even when the database hands back more than was asked for.
//
// ══ Read under the company AND the client ═════════════════════════════════
//
// Every query carries both ids in its WHERE. The clientId comes from the
// thread, which respond.js read under companyId, never from the model.
//
// ══ How it is said ═════════════════════════════════════════════════════════
//
// A fenced block, data not instructions, like the company's material.
//   - warrantyEndsAt null is "warranty end: not on file" — UNKNOWN, never
//     "out of warranty" (the schema's own rule for this column);
//   - a date on file is a fact from a row, never a promise of coverage: the
//     prompt says the team decides what is covered;
//   - the serial number is there for the callback note the team reads, and
//     the card says it is never to be read out to the customer.
//
// Web-chat threads ARE matched since the owner's decision of 2026-10-04
// (lib/aiEmployee/webChatMatch.js — the Facebook leads' matcher, reversibly).
// Because somebody can type another person's email, a web-matched card says
// so at its top and the assistant may USE it (the right manual, the callback
// note) but must not volunteer anything from it the visitor has not said
// first. SMS (by the sending number) and a thread a person linked carry no
// such line.

export const MAX_EQUIPMENT = 8;

/** The columns of ClientEquipment the card may use. Nothing else is read. */
export const EQUIPMENT_SELECT = Object.freeze({
  id: true,
  name: true,
  manufacturer: true,
  modelNumber: true,
  serialNumber: true,
  siteAddress: true,
  installedAt: true,
  warrantyEndsAt: true,
  warrantyProvider: true,
  installedByJobId: true,
  services: { select: { servicedAt: true, description: true, underWarranty: true, jobId: true }, orderBy: { servicedAt: "desc" }, take: 2 },
});

/** The columns of Job the card may use — a title and dates, no money. */
export const JOB_SELECT = Object.freeze({ id: true, title: true, status: true, completedAt: true, endDate: true });

/** The columns of Client read for callbacks — contact only. */
export const CLIENT_SELECT = Object.freeze({ id: true, name: true, phone: true, email: true });

const day = (d) => {
  const t = d instanceof Date ? d : d ? new Date(d) : null;
  return t && Number.isFinite(t.getTime()) ? t.toISOString().slice(0, 10) : null;
};
const text = (v, n) => (typeof v === "string" && v.trim() ? v.replace(/\s+/g, " ").trim().slice(0, n) : null);

/**
 * The card's data, from rows. Pure — the check hands it rows carrying money
 * columns they should never have had and asserts none survive.
 */
export function shapeClientContext({ client = null, equipment = [], jobs = [] } = {}) {
  if (!client?.id) return null;
  const jobById = new Map((Array.isArray(jobs) ? jobs : []).map((j) => [j.id, j]));
  const jobView = (j) =>
    j ? { id: String(j.id), title: text(j.title, 120), completedOn: day(j.completedAt) || day(j.endDate), status: text(j.status, 30) } : null;
  const items = (Array.isArray(equipment) ? equipment : []).slice(0, MAX_EQUIPMENT).map((e) => ({
    id: String(e.id),
    name: text(e.name, 80) || "Equipment",
    manufacturer: text(e.manufacturer, 60),
    modelNumber: text(e.modelNumber, 60),
    serialNumber: text(e.serialNumber, 60),
    siteAddress: text(e.siteAddress, 160),
    installedOn: day(e.installedAt),
    warrantyEndsOn: day(e.warrantyEndsAt),
    warrantyProvider: text(e.warrantyProvider, 80),
    installJob: jobView(e.installedByJobId ? jobById.get(e.installedByJobId) : null),
    installedByJobId: e.installedByJobId ? String(e.installedByJobId) : null,
    lastServices: (Array.isArray(e.services) ? e.services : []).slice(0, 2).map((s) => ({
      on: day(s.servicedAt),
      what: text(s.description, 160),
      underWarranty: s.underWarranty === true,
    })),
  }));
  const done = (Array.isArray(jobs) ? jobs : []).filter((j) => j.completedAt).sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  return {
    clientId: String(client.id),
    contact: { name: text(client.name, 120), phone: text(client.phone, 40), email: text(client.email, 160) },
    equipment: items,
    lastJob: jobView(done[0] || null),
  };
}

/** Read the card's rows under the company and the client. Never throws. */
export async function loadClientContext(prisma, { companyId, clientId }) {
  if (!companyId || !clientId) return null;
  try {
    const client = await prisma.client.findFirst({ where: { id: clientId, companyId }, select: CLIENT_SELECT });
    if (!client) return null;
    const equipment = await prisma.clientEquipment.findMany({
      where: { companyId, clientId },
      orderBy: [{ installedAt: "desc" }, { createdAt: "desc" }],
      take: MAX_EQUIPMENT,
      select: EQUIPMENT_SELECT,
    });
    const jobIds = [...new Set(equipment.map((e) => e.installedByJobId).filter(Boolean))];
    const [installJobs, lastDone] = await Promise.all([
      jobIds.length ? prisma.job.findMany({ where: { id: { in: jobIds }, companyId, clientId }, select: JOB_SELECT }) : [],
      prisma.job.findMany({ where: { companyId, clientId, completedAt: { not: null } }, orderBy: { completedAt: "desc" }, take: 1, select: JOB_SELECT }),
    ]);
    return shapeClientContext({ client, equipment, jobs: [...installJobs, ...lastDone] });
  } catch (err) {
    console.error("[aiEmployee] client context failed:", err?.message);
    return null;
  }
}

/** Warranty, said as a fact from the record — never a promise, never
 *  "out of warranty" for an unknown date. */
export function warrantyPhrase(item, now = new Date()) {
  if (!item?.warrantyEndsOn) return "warranty end: not on file (unknown — do not say it is or isn't covered)";
  const ends = new Date(`${item.warrantyEndsOn}T23:59:59Z`);
  const by = item.warrantyProvider ? ` (${item.warrantyProvider})` : "";
  return ends.getTime() >= now.getTime()
    ? `warranty on file runs to ${item.warrantyEndsOn}${by}`
    : `warranty date on file was ${item.warrantyEndsOn}${by}`;
}

/** Is any piece's recorded warranty still running? For the ticket's type. */
export function underRecordedWarranty(item, now = new Date()) {
  if (!item?.warrantyEndsOn) return false;
  return new Date(`${item.warrantyEndsOn}T23:59:59Z`).getTime() >= now.getTime();
}

/**
 * The card, as prompt text — or null when there is nothing to say. Fenced
 * by the caller (roles.js), like every other block of company data.
 */
/** The first line of a web-matched card. Exported for the check. */
export const WEB_MATCH_NOTE =
  "Matched from details typed into the website chat, not confirmed. Use this record to pick the right manual and fill in a callback, but do not mention anything from it — an address, a date, a model, what was installed — unless they have said it first.";

export function equipmentCardText(ctx, { now = new Date(), webMatched = false } = {}) {
  if (!ctx) return null;
  const lines = webMatched ? [WEB_MATCH_NOTE] : [];
  if (!ctx.equipment.length) {
    lines.push("No equipment is recorded for this customer.");
  }
  ctx.equipment.forEach((e, i) => {
    const what = [e.manufacturer, e.name, e.modelNumber ? `model ${e.modelNumber}` : null].filter(Boolean).join(" · ");
    lines.push(`${i + 1}. ${what} [equipment_id: ${e.id}]`);
    if (e.installedOn) lines.push(`   installed ${e.installedOn}${e.installJob?.title ? ` (job: ${e.installJob.title})` : ""}`);
    lines.push(`   ${warrantyPhrase(e, now)}`);
    if (e.serialNumber) lines.push(`   serial on file: ${e.serialNumber} — for the team's note only, never say it to the customer`);
    if (e.siteAddress) lines.push(`   at: ${e.siteAddress}`);
    for (const s of e.lastServices) if (s.on || s.what) lines.push(`   serviced ${s.on || "(date not recorded)"}: ${s.what || ""}${s.underWarranty ? " (covered under warranty)" : ""}`);
  });
  if (ctx.lastJob) lines.push(`Last completed job: ${ctx.lastJob.title || "untitled"}${ctx.lastJob.completedOn ? `, ${ctx.lastJob.completedOn}` : ""}.`);
  lines.push(
    ctx.contact?.phone || ctx.contact?.email
      ? "Their contact details are on file — book_callback fills them in; don't ask for them again."
      : "No phone or email is on file for them.",
  );
  return lines.join("\n");
}
