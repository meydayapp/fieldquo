#!/usr/bin/env node
//
// scripts/check-lead-language.mjs
//
//   npm run check:lead-language
//
// The owner's rule, executed: "the leads from quebec will be most likely
// french speakers so they can't be handed out to anybody unless they have a
// French profile in their settings."
//
// ══ What this holds ═══════════════════════════════════════════════════════
//
//   1. lib/sales/leadLanguage.js, pure, against fixtures: QC in every
//      spelling → "fr"; NB, ON, nothing → null; repCanTake; the where
//      fragment for both kinds of rep, including the NULL-province clause;
//      the Quebec area codes; parseSellsIn against hostile input.
//   2. Every path that hands a lead out carries the rule, source-asserted:
//      claimCandidateWhere takes the rep and both claim sites pass it; the
//      batch counts what it kept back; planReassign refuses; ringPlan
//      filters; the console pickers grey.
//   3. The column round-trips: the schema, the two writers, the platform
//      PATCH, and the response maps that once dropped a field.
//   4. The check is wired into check:all.
//
// ══ Judged by exit code ═══════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FRENCH,
  QUEBEC_AREA_CODES,
  QUEBEC_PROVINCE_SPELLINGS,
  inboundNeedsFrench,
  isQuebec,
  languageExcludedWhereFor,
  languageWhereFor,
  parseSellsIn,
  repCanTake,
  repSellsFrench,
  requiredLanguageFor,
  sellsInOf,
} from "@/lib/sales/leadLanguage";
import { claimCandidateWhere } from "@/lib/sales/prospectView";
import { planReassign } from "@/lib/sales/reassign";
import { ringPlan } from "@/lib/sales/calls/inboundDistribution";
import { STATE_AVAILABLE, livePresence } from "@/lib/sales/calls/agentState";
import { CANADIAN_AREA_CODES } from "@/lib/voice/nanp";
import { LANGUAGE_CODES } from "@/app/i18n/languages";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got === undefined ? "" : ` — got ${JSON.stringify(got)}`}`);
  }
}
const section = (t) => console.log(`\n${t}\n`);

const NOW = new Date("2026-09-11T14:00:00Z");
const FR_REP = { id: "rep_fr", sellsIn: ["fr", "en"] };
const EN_REP = { id: "rep_en", sellsIn: ["en"] };
const UNSET_REP = { id: "rep_unset", sellsIn: [] };

// ═══════════════════════════════════════════════════════════════════════════
section("1. Which prospects need French");

ok("QC → fr", requiredLanguageFor({ province: "QC" }) === FRENCH);
ok("qc → fr (case)", requiredLanguageFor({ province: "qc" }) === FRENCH);
ok("Québec → fr (spelled out, accented)", requiredLanguageFor({ province: "Québec" }) === FRENCH);
ok("Quebec → fr (spelled out)", requiredLanguageFor({ province: "Quebec" }) === FRENCH);
ok("QUÉBEC → fr", requiredLanguageFor({ province: "QUÉBEC" }) === FRENCH);
ok("CA-QC → fr", requiredLanguageFor({ province: "CA-QC" }) === FRENCH);
ok("PQ → fr (the old abbreviation)", requiredLanguageFor({ province: "PQ" }) === FRENCH);
ok(" qc  → fr (whitespace)", requiredLanguageFor({ province: " qc " }) === FRENCH);
ok("NB → null — bilingual, no requirement", requiredLanguageFor({ province: "NB" }) === null);
// ── The rule is symmetric now (owner, 2026-09-12: "someone who sets their
// sales language to French only will only receive leads from Quebec?") ──
ok("ON → en: everywhere that is not Quebec is an English call", requiredLanguageFor({ province: "ON" }) === "en");
ok("TX → en", requiredLanguageFor({ province: "TX" }) === "en");
ok("Nouveau-Brunswick → null, bilingual either way", requiredLanguageFor({ province: "Nouveau-Brunswick" }) === null);
ok("a French-only rep may take Quebec and not Ontario", repCanTake({ sellsIn: ["fr"] }, { province: "QC" }) && !repCanTake({ sellsIn: ["fr"] }, { province: "ON" }));
ok("…but may take New Brunswick and a row with no province", repCanTake({ sellsIn: ["fr"] }, { province: "NB" }) && repCanTake({ sellsIn: ["fr"] }, { province: null }));
ok("an unset rep is English only: Ontario yes, Quebec no", repCanTake({ sellsIn: [] }, { province: "ON" }) && !repCanTake({ sellsIn: [] }, { province: "QC" }));
ok("a bilingual rep takes both", repCanTake({ sellsIn: ["en", "fr"] }, { province: "ON" }) && repCanTake({ sellsIn: ["en", "fr"] }, { province: "QC" }));
ok("a Spanish-only rep takes neither Ontario nor Quebec", !repCanTake({ sellsIn: ["es"] }, { province: "ON" }) && !repCanTake({ sellsIn: ["es"] }, { province: "QC" }));
{
  const frOnly = languageWhereFor({ sellsIn: ["fr"] });
  const j = JSON.stringify(frOnly);
  ok("a French-only rep's WHERE keeps Quebec, New Brunswick and no-province rows", /"province":null/.test(j) && /"QC"/.test(j) && /"NB"/.test(j) && !/notIn/.test(j));
  ok("a bilingual rep's WHERE is empty", JSON.stringify(languageWhereFor({ sellsIn: ["fr", "en"] })) === "{}");
  const ex = JSON.stringify(languageExcludedWhereFor({ sellsIn: ["fr"] }));
  ok("…and what it kept back is every provinced row outside Quebec and New Brunswick", /"not":null/.test(ex) && /notIn/.test(ex) && /"QC"/.test(ex) && /"NB"/.test(ex));
  const esOnly = JSON.stringify(languageWhereFor({ sellsIn: ["es"] }));
  ok("a Spanish-only rep's WHERE is only the open rows", /"province":null/.test(esOnly) && /"NB"/.test(esOnly) && !/"QC"/.test(esOnly));
}
ok("no province → null: absence is not a statement", requiredLanguageFor({ province: null }) === null);
ok("no prospect → null", requiredLanguageFor(null) === null && requiredLanguageFor(undefined) === null);
ok("a number is not a province", requiredLanguageFor({ province: 12 }) === null);
ok("Quebec City as a CITY does not make ON a French row", requiredLanguageFor({ city: "Québec", province: "ON" }) === "en");
ok("every listed spelling is recognised by isQuebec", QUEBEC_PROVINCE_SPELLINGS.every(isQuebec));
{
  const { inboundNeedsEnglish } = await import("../lib/sales/leadLanguage.js");
  ok("a 416 caller is an English call", inboundNeedsEnglish("+14165550100") === true);
  ok("a 514 caller is not", inboundNeedsEnglish("+15145550100") === false);
  ok("a 506 (New Brunswick) caller is neither", inboundNeedsEnglish("+15065550100") === false && inboundNeedsFrench("+15065550100") === false);
  ok("garbage is not an English call", inboundNeedsEnglish("hello") === false && inboundNeedsEnglish(null) === false);
  const { ringPlan } = await import("../lib/sales/calls/inboundDistribution.js");
  const { livePresence, STATE_AVAILABLE } = await import("../lib/sales/calls/agentState.js");
  const now = Date.now();
  const live = (id) => ({ salesRepId: id, presence: livePresence({ state: STATE_AVAILABLE, startedAt: new Date(now), heartbeatAt: new Date(now), endedAt: null }, now, { portalSeenAt: new Date(now) }) });
  const presence = [live("fr-only"), live("both")];
  const plan = ringPlan({ presence, needsEnglish: true, englishRepIds: ["both"], now: new Date(now) });
  ok("an English caller does not ring a French-only rep", plan.targets.every((t) => t.value !== "fr-only") && plan.targets.some((t) => String(t.value).includes("both")), plan.targets);
}
ok("…and the list carries the bare code the data actually holds", QUEBEC_PROVINCE_SPELLINGS.includes("QC"));

// ═══════════════════════════════════════════════════════════════════════════
section("2. Which reps may take them");

ok("a rep with fr can take QC", repCanTake(FR_REP, { province: "QC" }));
ok("a rep with en only cannot", !repCanTake(EN_REP, { province: "QC" }));
ok("an unset rep cannot — empty is English-only for allocation", !repCanTake(UNSET_REP, { province: "QC" }));
ok("a rep with no sellsIn at all cannot", !repCanTake({ id: "x" }, { province: "QC" }));
ok("anybody can take ON", repCanTake(EN_REP, { province: "ON" }) && repCanTake(UNSET_REP, { province: "ON" }));
ok("anybody can take NB", repCanTake(UNSET_REP, { province: "NB" }));
ok("anybody can take a row with no province", repCanTake(UNSET_REP, { province: null }));
ok("FR in upper case still counts", repSellsFrench({ sellsIn: ["FR"] }));
ok("fr-CA does not — the writer never stores it", !repSellsFrench({ sellsIn: ["fr-CA"] }));
ok("a non-array sellsIn is []", sellsInOf({ sellsIn: "fr" }).length === 0 && sellsInOf({ sellsIn: null }).length === 0);
ok("unknown codes are dropped, duplicates collapse", JSON.stringify(sellsInOf({ sellsIn: ["fr", "zz", "fr", "es"] })) === '["fr","es"]');

// ═══════════════════════════════════════════════════════════════════════════
section("3. The where fragment, for both kinds of rep");

{
  const fr = languageWhereFor(FR_REP);
  ok("a rep with fr gets {} — no restriction", Object.keys(fr).length === 0, fr);
  const en = languageWhereFor(EN_REP);
  ok("a rep without gets an AND of one", Array.isArray(en.AND) && en.AND.length === 1, en);
  const or = en.AND?.[0]?.OR;
  ok("…whose one clause is an OR", Array.isArray(or) && or.length === 2, en);
  ok("…keeping rows with NO province (NOT IN over NULL is NULL in Postgres)", or?.some((c) => c.province === null));
  const notIn = or?.find((c) => c.province && Array.isArray(c.province.notIn))?.province.notIn;
  ok("…and excluding every Quebec spelling", Array.isArray(notIn) && QUEBEC_PROVINCE_SPELLINGS.every((s) => notIn.includes(s)));
  ok("…and nothing else", Array.isArray(notIn) && notIn.every((s) => QUEBEC_PROVINCE_SPELLINGS.includes(s)));
  ok("it has no top-level OR, so it can be spread beside the lease clause", !("OR" in en) && !("NOT" in en));
  ok("an unset rep gets the same restriction as an English one", JSON.stringify(languageWhereFor(UNSET_REP)) === JSON.stringify(en));
  ok("no rep at all is restricted (never trust a missing row as French)", Array.isArray(languageWhereFor(null).AND));
  const ex = languageExcludedWhereFor(EN_REP);
  ok("the complement for an English rep is the Quebec spellings", Array.isArray(ex?.province?.in) && ex.province.in.includes("QC"));
  ok("…and null for a French rep — nothing was kept back", languageExcludedWhereFor(FR_REP) === null);

  // Executed against the in-memory matcher the batch check uses, with
  // Postgres NULL semantics, so the fragment's shape is proven to do what
  // its comment says rather than merely to look right.
  const matches = (row, where) => {
    if (!where) return true;
    for (const [key, cond] of Object.entries(where)) {
      if (key === "AND") { if (!cond.every((w) => matches(row, w))) return false; continue; }
      if (key === "OR") { if (!cond.some((w) => matches(row, w))) return false; continue; }
      const v = row[key];
      if (cond === null) { if (v !== null && v !== undefined) return false; continue; }
      if (typeof cond !== "object") { if (v !== cond) return false; continue; }
      if ("in" in cond && !cond.in.includes(v)) return false;
      if ("notIn" in cond && (v == null || cond.notIn.includes(v))) return false;
    }
    return true;
  };
  ok("executed: QC row fails the English rep's fragment", !matches({ province: "QC" }, en));
  ok("executed: Québec row fails it too", !matches({ province: "Québec" }, en));
  ok("executed: ON row passes it", matches({ province: "ON" }, en));
  ok("executed: NULL-province row passes it", matches({ province: null }, en));
  ok("executed: QC row passes the French rep's fragment", matches({ province: "QC" }, fr));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. claimCandidateWhere carries it");

{
  const en = claimCandidateWhere({ tradeKey: "painting", now: NOW, rep: EN_REP });
  const fr = claimCandidateWhere({ tradeKey: "painting", now: NOW, rep: FR_REP });
  const none = claimCandidateWhere({ tradeKey: "painting", now: NOW });
  ok("with an English rep the WHERE carries the AND fragment", Array.isArray(en.AND) && en.AND[0]?.OR?.some((c) => c.province === null), en);
  ok("with a French rep it does not", !("AND" in fr), fr);
  ok("with no rep it does not — the pool count stays total", !("AND" in none), none);
  ok("the lease OR is still there beside it", Array.isArray(en.OR) && en.OR.length === 2);
  ok("…and the trade, status and do-not-contact clauses are untouched", en.tradeKey === "painting" && en.doNotContactAt === null && Array.isArray(en.status.in));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The inbound side: area codes");

for (const code of ["514", "438", "450", "579", "418", "581", "819", "873"]) {
  ok(`+1${code}… needs French`, inboundNeedsFrench(`+1${code}5551234`));
}
ok("the three CRTC overlays are in the table", ["263", "354", "468"].every((c) => QUEBEC_AREA_CODES.includes(c)));
ok("every Quebec area code is a Canadian one in lib/voice/nanp.js", QUEBEC_AREA_CODES.every((c) => CANADIAN_AREA_CODES.includes(c)));
ok("416 (Toronto) does not", !inboundNeedsFrench("+14165551234"));
ok("506 (New Brunswick) does not", !inboundNeedsFrench("+15065551234"));
ok("613 (Ottawa) does not, even though Gatineau is across the river", !inboundNeedsFrench("+16135551234"));
ok("a bare ten-digit number is read", inboundNeedsFrench("5145551234"));
ok("an eleven-digit one too", inboundNeedsFrench("15145551234"));
ok("a UK number is not", !inboundNeedsFrench("+442071234567"));
ok("garbage is not", !inboundNeedsFrench("hello") && !inboundNeedsFrench(null) && !inboundNeedsFrench(514));

// ═══════════════════════════════════════════════════════════════════════════
section("6. ringPlan rings only French reps for a Quebec caller");

{
  // Rows built by the REAL producer, the way check-inbound-distribution
  // builds them: a SalesRepActivity row through livePresence, nested under
  // `presence` as presenceFor nests it.
  const fresh = (id, minutesAgo = 1) => ({
    salesRepId: id,
    presence: livePresence(
      {
        state: STATE_AVAILABLE,
        startedAt: new Date(NOW.getTime() - minutesAgo * 60000),
        heartbeatAt: new Date(NOW.getTime() - minutesAgo * 60000),
        endedAt: null,
      },
      NOW,
      { portalSeenAt: new Date(NOW.getTime() - minutesAgo * 60000) },
    ),
  });
  const rows = [fresh("anglo", 1), fresh("franco", 5), fresh("anglo2", 9)];
  const plan = ringPlan({ presence: rows, needsFrench: true, frenchRepIds: ["franco"], now: NOW });
  ok("a 514 caller rings only the French rep", plan.targets.length === 1 && plan.targets[0].salesRepId === "franco", plan.targets);
  ok("…and the plan says it needed French", plan.needsFrench === true);
  const owner = ringPlan({ assignedRepId: "anglo", presence: rows, needsFrench: true, frenchRepIds: ["franco"], now: NOW });
  ok("the number's OWNER is filtered too when they have no French", !owner.targets.some((t) => t.salesRepId === "anglo"), owner.targets);
  const last = ringPlan({ presence: rows, lastCalledBy: "anglo", needsFrench: true, frenchRepIds: ["franco"], now: NOW });
  ok("…and so is the rep who rang them last", !last.targets.some((t) => t.salesRepId === "anglo"));
  const nobody = ringPlan({ presence: [fresh("anglo")], needsFrench: true, frenchRepIds: [], transferTo: null, now: NOW });
  ok("no French rep live → no targets (the route falls through to the queue/voicemail)", nobody.targets.length === 0);
  ok("…with its own reason, so the log says why", nobody.reason === "nobody_french", nobody.reason);
  const transfer = ringPlan({ presence: [fresh("anglo")], needsFrench: true, frenchRepIds: [], transferTo: "+15145550000", now: NOW });
  ok("the transfer number is a phone, not a rep, and survives", transfer.targets.length === 1 && transfer.targets[0].kind === "number");
  const off = ringPlan({ presence: rows, needsFrench: false, frenchRepIds: ["franco"], now: NOW });
  ok("without the flag everybody rings as before", off.targets.length === 3 && off.needsFrench === false);
  const dflt = ringPlan({ presence: rows, now: NOW });
  ok("…and the default is off", dflt.targets.length === 3);
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. planReassign refuses a target who cannot take a held row");

{
  const prospects = [
    { id: "p_qc", assignedRepId: "dan", assignedAt: NOW, claimExpiresAt: new Date(NOW.getTime() + 3600e3), province: "QC" },
    { id: "p_on", assignedRepId: "dan", assignedAt: NOW, claimExpiresAt: new Date(NOW.getTime() + 3600e3), province: "ON" },
    { id: "p_lapsed_qc", assignedRepId: "dan", assignedAt: NOW, claimExpiresAt: new Date(NOW.getTime() - 3600e3), province: "QC" },
  ];
  const refused = planReassign({ prospects, leads: [], fromRepId: "dan", toRepId: "eve", toRep: { id: "eve", name: "Eve", active: true, sellsIn: ["en"] }, now: NOW });
  ok("an English-only target is refused", Boolean(refused.error), refused);
  ok("…with code language and the count", refused.code === "language" && refused.cannot === 1, refused);
  ok("…and the sentence names Quebec, French, and the fix", /Quebec/.test(refused.error) && /French/.test(refused.error) && /set it on their card/.test(refused.error));
  ok("…and does not count the lapsed Quebec lease", refused.cannot === 1);
  const allowed = planReassign({ prospects, leads: [], fromRepId: "dan", toRepId: "eve", toRep: { id: "eve", active: true, sellsIn: ["fr"] }, now: NOW });
  // Two rows, one Quebec and one Ontario: a French-ONLY target may take the
  // Quebec row but not the Ontario one now, so the whole move is refused.
  ok("a French-only target is refused the Ontario row", Boolean(allowed.error), allowed.counts);
  const bilingual = planReassign({ prospects, leads: [], fromRepId: "dan", toRepId: "eve", toRep: { id: "eve", active: true, sellsIn: ["fr", "en"] }, now: NOW });
  ok("a bilingual target is allowed", !bilingual.error && bilingual.counts.prospects === 2, bilingual.counts);
  const onlyOn = planReassign({ prospects: [prospects[1]], leads: [], fromRepId: "dan", toRepId: "eve", toRep: { id: "eve", active: true, sellsIn: [] }, now: NOW });
  ok("an unset target may take ON rows", !onlyOn.error);
  const unset = planReassign({ prospects, leads: [], fromRepId: "dan", toRepId: "eve", toRep: { id: "eve", active: true, sellsIn: [] }, now: NOW });
  ok("…but not QC rows", unset.code === "language");
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. parseSellsIn against hostile input");

ok("a list of codes is accepted", parseSellsIn({ sellsIn: ["fr", "en"] }).ok);
ok("an empty list is accepted — it is the rep un-ticking everything", parseSellsIn({ sellsIn: [] }).ok && parseSellsIn({ sellsIn: [] }).sellsIn.length === 0);
ok("case is folded, duplicates collapse", JSON.stringify(parseSellsIn({ sellsIn: ["FR", "fr", " en "] }).sellsIn) === '["fr","en"]');
ok("an unknown code is refused, not trimmed", !parseSellsIn({ sellsIn: ["fr", "zz"] }).ok);
ok("fr-CA is refused", !parseSellsIn({ sellsIn: ["fr-CA"] }).ok);
ok("a string is refused", !parseSellsIn({ sellsIn: "fr" }).ok);
ok("a missing key is refused", !parseSellsIn({}).ok && !parseSellsIn(null).ok);
ok("a number inside is refused", !parseSellsIn({ sellsIn: [12] }).ok);
ok("every supported language is accepted", parseSellsIn({ sellsIn: [...LANGUAGE_CODES] }).ok);

// ═══════════════════════════════════════════════════════════════════════════
section("9. Every hand-out path carries the rule — source");

{
  const pv = decomment(read("lib/sales/prospectView.js"));
  ok("claimCandidateWhere takes `rep`", /export function claimCandidateWhere\(\{ tradeKey = null, now = new Date\(\), rep = null \}/.test(pv));
  ok("…and spreads languageWhereFor(rep)", /\.\.\.\(rep \? languageWhereFor\(rep\) : \{\}\)/.test(pv));

  const route = decomment(read("app/api/sales/queue/route.js"));
  ok("the single claim's read passes the rep", /findFirst\(\{\s*where: claimCandidateWhere\(\{ tradeKey, now: at, rep \}\)/.test(route));
  ok("…and its write is guarded by the same WHERE with the rep", /where: \{ id: candidate\.id, \.\.\.claimCandidateWhere\(\{ tradeKey, now: at, rep \}\) \}/.test(route));
  ok("the per-trade available count is this rep's, not the pool's", /db\.prospect\.count\(\{ where: claimCandidateWhere\(\{ tradeKey: key, now, rep \}\) \}\)/.test(route));
  ok("the queue row carries the language for the chip", /language: requiredLanguageFor\(p\)/.test(route));
  const gate = decomment(read("lib/sales/queueGate.js"));
  ok("the queue gate selects sellsIn so the rep row carries it", /sellsIn: true/.test(gate));

  const qb = decomment(read("lib/sales/queueBatch.js"));
  ok("the batch's read passes the rep", /const base = claimCandidateWhere\(\{ tradeKey, now, rep \}\)/.test(qb));
  ok("…and its write in the transaction does too", /tx\.prospect\.updateMany\(\{\s*where: \{ id: \{ in: picked\.ids \}, \.\.\.claimCandidateWhere\(\{ tradeKey, now: at, rep \}\) \}/.test(qb));
  ok("…and what the rule kept back is counted against the unrestricted pool", /db\.prospect\.count\(\{ where: \{ AND: \[claimCandidateWhere\(\{ tradeKey, now \}\), excluded\] \} \}\)/.test(qb));
  ok("…and returned as skippedForLanguage", /skippedForLanguage,/.test(qb));

  const screen = decomment(read("app/sales/queue/page.js"));
  ok("the queue screen says how many Quebec leads were not offered", /batchResult\.skippedForLanguage > 0/.test(screen) && /app\.salesQueue\.batchSkippedForLanguage/.test(screen));
  ok("…and draws a Français chip on a QC row", /item\.language === "fr"/.test(screen) && /app\.salesQueue\.frenchChip/.test(screen));
  const lead = decomment(read("app/sales/leads/[id]/page.js"));
  ok("the lead page draws the same chip from the same rule", /requiredLanguageFor\(lead\) === "fr"/.test(lead) && /app\.salesQueue\.frenchChip/.test(lead));
  for (const lang of Object.keys(APP_MESSAGES)) {
    for (const key of ["app.salesQueue.batchSkippedForLanguage", "app.salesQueue.frenchChip", "app.salesQueue.frenchChipTitle", "app.salesSellsIn.heading", "app.salesSellsIn.hint", "app.salesSellsIn.unset"]) {
      ok(`${key} exists in ${lang}`, typeof APP_MESSAGES[lang][key] === "string" && APP_MESSAGES[lang][key].length > 0);
    }
  }
  ok("the English skipped line tells the rep the fix, both directions", /French for Quebec, English everywhere else/.test(APP_MESSAGES.en["app.salesQueue.batchSkippedForLanguage"]) && /Pay tab/.test(APP_MESSAGES.en["app.salesQueue.batchSkippedForLanguage"]));
  ok("…and the settings hint says the rule is symmetric", /everywhere else needs English/.test(APP_MESSAGES.en["app.salesSellsIn.hint"]));

  const reassign = decomment(read("lib/sales/reassign.js"));
  ok("planReassign judges every held row with repCanTake", /held\.filter\(\(p\) => !repCanTake\(toRep, p\)\)/.test(reassign));
  ok("reassignHeld selects province so it can", /select: \{ id: true, assignedRepId: true, assignedAt: true, claimExpiresAt: true, province: true \}/.test(reassign));
  ok("handoffTargets selects sellsIn and marks eligibility", /sellsIn: true/.test(reassign) && /eligible,/.test(reassign) && /frenchHeld/.test(reassign));
  ok("summariseHeld counts the French rows", /french\+\+/.test(reassign) && /french,/.test(reassign));
  const qroute = decomment(read("app/api/platform/sales/reps/[id]/queue/route.js"));
  ok("the console's reassign loads the target WITH sellsIn", /select: \{ id: true, name: true, email: true, active: true, sellsIn: true \}/.test(qroute));
  ok("…refuses with 409 and the code", /code: moved\.code, cannot: moved\.cannot/.test(qroute) && /\{ status: 409 \}/.test(qroute));
  ok("…and hands the picker the French count", /handoffTargets\(\{ db, admin, excludeRepId: rep\.id, frenchHeld: queue\.french \}\)/.test(qroute));
  const patch = decomment(read("app/api/platform/sales/reps/[id]/route.js"));
  ok("the deactivation hand-off refuses an ineligible target before the transaction", /frenchHeldCount\(\{/.test(patch) && /code: "language"/.test(patch));
  ok("…with the release mode narrowed to the lead-bearing prospects", /onlyWithOpenLead: handoff\.prospects === "release"/.test(patch));
  const page = decomment(read("app/platform/sales/reps/page.js"));
  ok("both console pickers grey an ineligible rep and say why", (page.match(/disabled=\{t\.eligible === false\}/g) || []).length === 2 && (page.match(/— no French/g) || []).length === 2);
  ok("…and the panel explains the greying", /reps without French are greyed/.test(page));

  const inbound = decomment(read("app/api/rep-dial/inbound/route.js"));
  ok("the inbound route reads reps WITH sellsIn", (inbound.match(/select: \{ id: true, sellsIn: true \}/g) || []).length === 2);
  ok("…and the matched prospect's province", /select: \{ id: true, businessName: true, assignedRepId: true, province: true \}/.test(inbound));
  ok("…decides French by area code OR matched row", /inboundNeedsFrench\(caller\) \|\| \(matchedProspect \? requiredLanguageFor\(matchedProspect\) === "fr" : false\)/.test(inbound));
  ok("…and passes both to ringPlan at both call sites", (inbound.match(/needsFrench/g) || []).length >= 3 && (inbound.match(/frenchRepIds/g) || []).length >= 3);
  ok("the hold queue re-judges it every round from the caller's number", /needsFrench: inboundNeedsFrench\(callerNumber\)/.test(inbound));
  const dist = decomment(read("lib/sales/calls/inboundDistribution.js"));
  ok("ringPlan filters inside pushRep, the one function every step uses", /const pushRep = \(salesRepId, why\) => \{[\s\S]*?if \(!mayRing\(salesRepId\)\) return;/.test(dist));

  // Discovery is untouched: the rule binds hand-outs, never what is banked.
  for (const f of ["lib/sales/discovery/ingest.js", "lib/sales/discovery/rbq/provider.js"]) {
    ok(`${f} does not import the language rule`, !/leadLanguage/.test(read(f)));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. The column round-trips");

{
  const schema = read("prisma/schema.prisma");
  const at = schema.indexOf("model SalesRep {");
  const model = schema.slice(at, schema.indexOf("\n}", at));
  const line = model.split("\n").find((l) => /^\s*sellsIn\s+String\[\]/.test(l));
  ok("SalesRep.sellsIn is a String[] defaulting to []", Boolean(line) && /@default\(\[\]\)/.test(line), line);
  ok("…and the schema says empty is English-only for allocation and unset on screen", /Empty means "English only" for allocation/.test(model));

  const list = decomment(read("app/api/platform/sales/reps/route.js"));
  ok("the platform list selects sellsIn", /sellsIn: true/.test(list));
  ok("…AND maps it back (the response-map trap)", /sellsIn: sellsInOf\(r\)/.test(list));
  const patch = decomment(read("app/api/platform/sales/reps/[id]/route.js"));
  ok("the platform PATCH accepts sellsIn", /const touchesSellsIn = "sellsIn" in body;/.test(patch));
  ok("…validates it through parseSellsIn", /parseSellsIn\(body\)/.test(patch));
  ok("…writes it", /\.\.\.\(touchesSellsIn \? \{ sellsIn \} : \{\}\)/.test(patch));
  ok("…selects it back", /sellsIn: true,\s*commissionPlan:/.test(patch));
  ok("…returns it through the same normaliser", /sellsIn: sellsInOf\(updated\)/.test(patch));
  ok("…and audits the change", /sales_rep_sells_in_set/.test(patch));
  ok("the audit catalogue knows the action", /sales_rep_sells_in_set:/.test(read("lib/platform/auditActions.js")));

  const page = decomment(read("app/platform/sales/reps/page.js"));
  ok('the console has a "Sells in" row per rep with Set/Change', /Sells in/.test(page) && /saveSellsIn\(rep\)/.test(page));
  ok("…that PATCHes sellsIn", /body: JSON\.stringify\(\{ sellsIn: value \}\)/.test(page));
  ok("…and warns when there is no French", /holds every Quebec lead back/.test(page));

  const comp = decomment(read("app/components/sales/RepSellsInChoice.js"));
  ok("the rep's control loads and PUTs /api/sales/sells-in", /fetchJson\("\/api\/sales\/sells-in"\)/.test(comp) && /method: "PUT"/.test(comp));
  ok("…shows empty as unset, not as English", /const unset = stored\.length === 0;/.test(comp) && /app\.salesSellsIn\.unset/.test(comp));
  ok("…is on Pay & settings", /<RepSellsInChoice \/>/.test(decomment(read("app/sales/pay/page.js"))));
  ok("…and on the first-run pass", /<RepSellsInChoice \/>/.test(decomment(read("app/sales/welcome/page.js"))));
  const api = decomment(read("app/api/sales/sells-in/route.js"));
  ok("the rep route returns sellsIn on GET and PUT through sellsInOf", (api.match(/sellsIn: sellsInOf\(rep\)/g) || []).length === 1 && /export async function PUT/.test(api));
}

// ═══════════════════════════════════════════════════════════════════════════
section("11. Wired in");

{
  const pkg = JSON.parse(read("package.json"));
  ok("check:lead-language is a script", typeof pkg.scripts["check:lead-language"] === "string");
  ok("…and check:all runs it", /check:lead-language\b/.test(pkg.scripts["check:all"]));
}

console.log(`\n${failures.length === 0 ? "ALL PASS" : "FAILED"} — ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
