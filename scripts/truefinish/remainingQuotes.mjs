// scripts/truefinish/remainingQuotes.mjs
//
// The plan for TrueFinish's quotes that never became work — pure, so
// scripts/check-truefinish-quote-import.mjs can execute it against fixtures,
// and the runner (scripts/import-truefinish-quotes.mjs) only reads and writes.
//
// The owner, 2026-10-05: import the rest of TrueFinish's quotes "to help with
// the stats of the company: how many leads turn into a quote, how many turn
// into an invoice". The 19 ACCEPTED ones are already in FieldQuo (past jobs,
// lost quotes and one live draft — scripts/import-truefinish-history.mjs);
// this is the other 106: 46 sent and never answered, 60 declined.
//
// ── What one TrueFinish quote becomes ─────────────────────────────────────
//
//   TrueFinish status   FieldQuo                       written by
//   sent                Quote, status sent, historical  createRecordedQuote "sent"
//   declined            Quote, status declined, hist.   createRecordedQuote "declined"
//   accepted            — skipped: the history import's
//   draft               — skipped: never reached a client, not a quote they saw
//
// No job, no invoice, no payment, no share token, nothing sent. The lines and
// figures are TrueFinish's as stored (docFigures — the same mapping the
// history import used), the dates are TrueFinish's own (createdAt, sentAt; it
// never recorded when a quote was declined, so declinedAt stays null), and
// the old number goes on the internal note's first line ("Old system:
// Q2026-0134") for the quote page to show.
//
// ── Who the client is ─────────────────────────────────────────────────────
//
// One matcher, lib/contacts/matchContact.js, read with this import's rule on
// top — the owner asked for "email, then phone, then exact name", and the
// matcher's points already rank them in that order (100 / 80 / 30):
//
//   email or phone agree, and the name agrees or is one typo away
//                       → that client. "Gladys Antionios Massaad" at
//                         TrueFinish is "Gladys Antonios Massaad" here.
//   email or phone agree, the name does NOT
//                       → REFUSED for a person to decide. TrueFinish's Paul
//                         Machaka shared a phone number with two of the
//                         company's test clients; an identifier on its own
//                         filed his job under "Emilio" once already in a
//                         dry run. Not guessed, and not a new client either
//                         — a duplicate is as wrong as the wrong one.
//   only the exact name agrees, nothing conflicts
//                       → that client.
//   two clients equally good
//                       → REFUSED (the matcher's own rule: ambiguity is
//                         reported, never resolved by picking).
//   nothing             → a new client, created by createRecordedQuote with
//                         nothing sent to it; a second quote for the same
//                         TrueFinish client in the same run reuses it.
//
// ── Which lead it answered ────────────────────────────────────────────────
//
// FieldQuo's leads have no client link, so the same matcher runs against
// them with one more allowance, because a lead is a pointer and not a record
// of money: a name one typo away counts even when the two emails differ by a
// typo of their own (Gladys: "gladant.ga@" at TrueFinish, "glandant.ga@" on
// her Messenger lead). The lead is linked (LeadRequest.quoteId) only when it
// has no quote yet — re-checked in the write's WHERE — to the client's most
// recent quote, because the lead is the newer enquiry. Its status is never
// touched.

import { matchContactAgainst } from "@/lib/contacts/matchContact";
import { normaliseEmail } from "@/lib/sales/suppressionRules";
import { nextHistoricalQuoteNumber } from "@/lib/quotes/quoteNumber";
import { normalisePastJob, recordedQuoteProblems, oldSystemNumber } from "@/lib/jobs/pastJobImport";
import { tfDay, categoryKeyFor, clean, docFigures } from "./source.mjs";

/** TrueFinish QuoteStatus → the recorded kind, or why it is not imported here. */
export function kindForTrueFinishStatus(status) {
  if (status === "sent") return { kind: "sent" };
  if (status === "declined") return { kind: "declined" };
  if (status === "accepted") {
    return { skip: "accepted at TrueFinish — carried over by import-truefinish-history.mjs (past job, lost quote or live draft)" };
  }
  if (status === "draft") return { skip: "a draft at TrueFinish — never reached the client" };
  return { skip: `unknown TrueFinish status "${status}"` };
}

export const sourceRefFor = (tfQuote) => `truefinish:quote:${tfQuote.id}`;

/**
 * Every TrueFinish quote FieldQuo already holds: by the bracketed source
 * marker on a job's or quote's internal note (both earlier runs wrote it), and
 * by the old NUMBER — on an "Old system:" line, or in a "TrueFinish Q2026-…"
 * source label. Two keys, so a note somebody edited still stops a duplicate
 * as long as either survives.
 */
export function alreadyImported({ jobNotes = [], quoteNotes = [] }) {
  const refs = new Set();
  const numbers = new Set();
  for (const note of [...jobNotes, ...quoteNotes]) {
    if (typeof note !== "string") continue;
    for (const m of note.matchAll(/\[(truefinish:quote:[^\]\s]+)\]/g)) refs.add(m[1]);
    for (const m of note.matchAll(/TrueFinish (Q\d{4}-\d{3,})/g)) numbers.add(m[1]);
    const old = oldSystemNumber(note);
    if (old) numbers.add(old);
  }
  return { refs, numbers };
}

/** Two emails one or two typos apart — "gladant.ga@gmail.com" / "glandant.ga@gmail.com". */
function emailsClose(a, b) {
  const x = normaliseEmail(a);
  const y = normaliseEmail(b);
  if (!x || !y || x === y) return false;
  const [xl, xd] = x.split("@");
  const [yl, yd] = y.split("@");
  if (xd !== yd || xl.length < 5 || yl.length < 5) return false;
  // Levenshtein ≤ 2 on the local part.
  const m = xl.length;
  const n = yl.length;
  if (Math.abs(m - n) > 2) return false;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (xl[i - 1] === yl[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n] <= 2;
}

const nameAgrees = (reasons) => reasons.includes("name") || reasons.includes("name_similar");
const viaIdentifier = (reasons) => reasons.filter((r) => r === "email" || r === "phone");

/**
 * Who a TrueFinish client is among FieldQuo's clients. Decides; writes
 * nothing. See the header for the rule.
 *
 * @returns {{ kind: "existing"|"new"|"refused", clientId?, name?, by?, note?, reason? }}
 */
export function matchClient(tfClient, fqClients, companyId) {
  const contact = { name: tfClient.name, email: tfClient.email, phone: tfClient.phone, address: tfClient.address };
  const m = matchContactAgainst({ clients: fqClients, companyId, contact, minConfidence: "possible", tolerantNames: true, onTie: "refuse" });
  if (m.ambiguous) {
    const names = fqClients.filter((c) => (m.tiedIds || []).includes(c.id)).map((c) => String(c.name).trim());
    return { kind: "refused", reason: `${names.length} FieldQuo clients match equally (${m.reasons.join(" + ")}): ${names.join(", ")}` };
  }
  const best = m.bestId ? fqClients.find((c) => c.id === m.bestId) : null;
  if (!best) return { kind: "new" };
  const ids = viaIdentifier(m.reasons);
  if (ids.length) {
    if (nameAgrees(m.reasons)) {
      return {
        kind: "existing",
        clientId: best.id,
        name: best.name,
        by: ids.join(" + "),
        ...(m.reasons.includes("name_similar") ? { note: `name spelled "${String(best.name).trim()}" in FieldQuo` } : {}),
      };
    }
    return { kind: "refused", reason: `shares ${ids.join(" + ")} with FieldQuo client "${String(best.name).trim()}" under a different name — decide by hand` };
  }
  if (m.reasons.includes("name") && !m.conflicts.length) {
    return { kind: "existing", clientId: best.id, name: best.name, by: "exact name" };
  }
  return {
    kind: "new",
    note: `FieldQuo has "${String(best.name).trim()}" (${m.reasons.join(" + ")}${m.conflicts.length ? `, but ${m.conflicts.join(" and ")} differ` : ""}) — treated as a different person`,
  };
}

/**
 * The enquiry a TrueFinish client made in FieldQuo, if any. Leads carry no
 * client link, so they are matched as contacts. See the header.
 *
 * @returns {{ lead, by } | { lead: null, note? }}
 */
export function matchLead(tfClient, leads, companyId) {
  const rows = leads.map((l) => ({ ...l, companyId: l.companyId ?? companyId }));
  const contact = { name: tfClient.name, email: tfClient.email, phone: tfClient.phone };
  const m = matchContactAgainst({ clients: rows, companyId, contact, minConfidence: "possible", tolerantNames: true, onTie: "refuse" });
  if (!m.bestId) return { lead: null };
  if (m.ambiguous) {
    return { lead: null, note: `${(m.tiedIds || []).length} leads match equally — none linked` };
  }
  const best = rows.find((l) => l.id === m.bestId);
  const ids = viaIdentifier(m.reasons);
  let by = null;
  if (ids.length && nameAgrees(m.reasons)) by = ids.join(" + ");
  else if (!ids.length && nameAgrees(m.reasons)) {
    const onlyEmailTypo = m.conflicts.every((c) => c === "email") && (!m.conflicts.length || emailsClose(tfClient.email, best.email));
    if (onlyEmailTypo) by = m.conflicts.length ? `${m.reasons.includes("name") ? "name" : "similar name"} + email one typo apart` : m.reasons.includes("name") ? "exact name" : "similar name";
  }
  if (!by) {
    return { lead: null, note: `lead "${String(best.name).trim()}" agrees on ${m.reasons.join(" + ") || "nothing"}${m.conflicts.length ? ` but ${m.conflicts.join(" and ")} differ` : ""} — not linked` };
  }
  return { lead: best, by };
}

/**
 * Everything the run would do, decided from the two snapshots. Pure.
 *
 * @param tf  { quotes, clients }   TrueFinish rows; quotes carry id, quoteNumber,
 *            status, clientId, lineItems, subtotal, discount, tax, total,
 *            taxEnabled, notes, language, quoteType, createdAt, sentAt
 * @param fq  { companyId, clients, leads, quoteNumbers, jobNotes, quoteNotes, categories }
 * @param opts { today, only }
 */
export function planRemainingQuotes(tf, fq, { today = new Date(), only = [] } = {}) {
  const clientsById = new Map(tf.clients.map((c) => [c.id, c]));
  const categoriesByKey = new Map((fq.categories || []).map((c) => [c.key, c]));
  const done = alreadyImported({ jobNotes: fq.jobNotes, quoteNotes: fq.quoteNotes });
  const taken = new Set(fq.quoteNumbers || []);
  const clientInRun = new Map(); // TrueFinish client id → plan of its first quote's client
  const items = [];

  const ordered = [...tf.quotes].sort((a, b) => {
    const t = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return t || String(a.quoteNumber).localeCompare(String(b.quoteNumber));
  });

  for (const quote of ordered) {
    if (only.length && !only.includes(quote.quoteNumber)) continue;
    const item = { quote, tfClient: clientsById.get(quote.clientId) || null, problems: [], notes: [] };
    items.push(item);
    const k = kindForTrueFinishStatus(quote.status);
    if (k.skip) {
      item.decision = "skip";
      item.reason = k.skip;
      continue;
    }
    item.kind = k.kind;
    item.sourceRef = sourceRefFor(quote);
    if (done.refs.has(item.sourceRef) || done.numbers.has(quote.quoteNumber)) {
      item.decision = "skip";
      item.reason = done.refs.has(item.sourceRef) ? "already in FieldQuo (source marker on file)" : `already in FieldQuo (old number ${quote.quoteNumber} on file)`;
      continue;
    }
    if (!item.tfClient) {
      item.decision = "error";
      item.problems.push("TrueFinish client row not found");
      continue;
    }

    // The client.
    const client = clientInRun.get(item.tfClient.id) || matchClient(item.tfClient, fq.clients, fq.companyId);
    if (clientInRun.has(item.tfClient.id)) item.client = { ...client, batch: true };
    else item.client = client;
    if (client.kind === "refused") {
      item.decision = "error";
      item.problems.push(`client: ${client.reason}`);
      continue;
    }
    if (client.note) item.notes.push(client.note);

    // Figures, as stored.
    const computed = [];
    const fig = docFigures(quote, computed);
    if (computed.length) item.notes.push(`line total computed with TrueFinish's rule (none stored): ${computed.join(", ")}`);

    const createdAt = quote.createdAt ? new Date(quote.createdAt) : null;
    const sentAt = quote.sentAt ? new Date(quote.sentAt) : null;
    item.recorded = {
      kind: item.kind,
      sourceRef: item.sourceRef,
      sourceLabel: `TrueFinish ${quote.quoteNumber}`,
      oldNumber: quote.quoteNumber,
      internalNote:
        item.kind === "sent"
          ? `Sent at TrueFinish${sentAt ? ` on ${tfDay(sentAt)}` : ""} and never answered there. Carried over for the record (owner, 2026-10-05) — not sent again, and nothing chases it.`
          : `Declined at TrueFinish${sentAt ? ` after it was sent on ${tfDay(sentAt)}` : ""}. TrueFinish did not record the day it was declined, so no decline date is shown.`,
      language: clean(quote.language),
      createdAt,
      sentAt,
      ...(item.kind === "declined" ? { declinedAt: null, declineReason: null } : {}),
      quote: { lineItems: fig.lineItems, subtotal: fig.subtotal, discount: fig.discount, tax: fig.tax, total: fig.total, taxEnabled: fig.taxEnabled, notes: fig.notes },
    };

    // The category.
    const cat = categoryKeyFor(quote);
    item.category = cat.key ? categoriesByKey.get(cat.key) || null : null;
    if (cat.key && !item.category) item.problems.push(`service category "${cat.key}" not found`);

    // Client fields through the past-jobs normaliser, as the history import
    // did; only its client refusals apply to a quote with no job.
    const c = item.tfClient;
    const address = clean(c.address) || [clean(c.city), clean(c.province)].filter(Boolean).join(", ") || "";
    const n = normalisePastJob(
      { clientId: client.clientId || "", clientName: c.name, clientEmail: c.email || "", clientPhone: c.phone || "", clientAddress: address },
      { today, defaultTaxApplied: true },
    );
    for (const e of n.errors.filter((x) => x.field.startsWith("client"))) item.problems.push(`${e.field}: ${e.code}`);
    item.row = {
      clientId: n.value.clientId,
      clientName: n.value.clientName,
      clientEmail: n.value.clientEmail,
      clientPhone: n.value.clientPhone,
      clientAddress: n.value.clientAddress,
      quoteDate: createdAt,
    };
    for (const p of recordedQuoteProblems(item.recorded, { today })) item.problems.push(`${p.field}: ${p.code}`);
    if (!createdAt || Number.isNaN(createdAt.getTime())) {
      item.problems.push("createdAt: missing");
    } else {
      item.quoteNumber = nextHistoricalQuoteNumber([...taken], createdAt.getUTCFullYear());
    }

    item.decision = item.problems.length ? "error" : "create";
    if (item.decision === "create") {
      taken.add(item.quoteNumber);
      if (!clientInRun.has(c.id)) clientInRun.set(c.id, client);
    }
  }

  // Leads: one per TrueFinish client, to that client's MOST RECENT quote in
  // this run, only when the lead has no quote. Decided after the loop because
  // "most recent" needs every quote of the client.
  const linkedLeads = new Set();
  const byClient = new Map();
  for (const it of items) {
    if (it.decision !== "create") continue;
    const list = byClient.get(it.tfClient.id) || [];
    list.push(it);
    byClient.set(it.tfClient.id, list);
  }
  for (const list of byClient.values()) {
    const latest = list.reduce((a, b) => (new Date(b.quote.createdAt) > new Date(a.quote.createdAt) ? b : a));
    const found = matchLead(latest.tfClient, fq.leads || [], fq.companyId);
    if (!found.lead) {
      if (found.note) latest.notes.push(found.note);
      continue;
    }
    if (found.lead.quoteId) {
      latest.notes.push(`lead "${String(found.lead.name).trim()}" (${found.by}) already has a quote — left as it is`);
      continue;
    }
    if (linkedLeads.has(found.lead.id)) {
      latest.notes.push(`lead "${String(found.lead.name).trim()}" is already being linked to another quote in this run — not linked twice`);
      continue;
    }
    linkedLeads.add(found.lead.id);
    latest.lead = { id: found.lead.id, name: found.lead.name, by: found.by, status: found.lead.status };
    latest.recorded.leadId = found.lead.id;
  }
  return items;
}

/** The dry run's counts, from a plan. Pure. */
export function summarise(items) {
  const create = items.filter((i) => i.decision === "create");
  const sum = (list) => list.reduce((s, i) => s + Number(i.recorded.quote.total || 0), 0);
  const sent = create.filter((i) => i.kind === "sent");
  const declined = create.filter((i) => i.kind === "declined");
  const newClients = new Set(create.filter((i) => i.client.kind === "new" && !i.client.batch).map((i) => i.tfClient.id));
  return {
    create: create.length,
    sent: sent.length,
    declined: declined.length,
    sentTotal: Math.round(sum(sent) * 100) / 100,
    declinedTotal: Math.round(sum(declined) * 100) / 100,
    existingClientQuotes: create.filter((i) => i.client.kind === "existing").length,
    newClients: newClients.size,
    leadsLinked: create.filter((i) => i.lead).length,
    skipped: items.filter((i) => i.decision === "skip").length,
    refused: items.filter((i) => i.decision === "error").length,
  };
}

