// scripts/check-lead-qualification.mjs
//
//   npm run check:lead-qualification
//
// The owner, 2026-10-05, on TrueFinish Cabinets' real inbox (599 threads, 80
// leads, 69 from Messenger): "Yes it should stop — that's why we allow the AI
// to read, so it can determine whether it is a lead or not", and "FB counts
// any click as a conversation even if accidental, but we should really
// understand how much is spent per actual conversation or lead."
//
// Every claim the four tiers make is EXECUTED here against fixtures modelled
// on that evidence — the real lib files, with "@/lib/db" stubbed
// (db-stub-loader) and an in-memory Prisma for the paths that write:
//
//   1. Tiers: identical ice-breakers across ≥3 threads, Moss's triple tap,
//      emoji, the basement video the owner declined, Tony / Louise / Gladys
//      with their counts, "pressed the button by mistake", the ad marker,
//      Meta's system lines, "we specialize in" as an introduction (not a
//      decline), a company with no services.
//   2. The capture: only `lead` makes a lead; a tap never pays for a model
//      read; the counts land on intake.scope with their sentence; a person's
//      tier sticks across later messages and makes the lead on the tap; the
//      "not a lead" mark still wins over it; templates are the company's own.
//   3. Follow-ups: "when I'm back" → 7 days, "after the 17th of October" →
//      that date, one task per conversation, the notification once.
//   4. Value: scope from counts at the company's own price, nothing without
//      scope, never "average".
//   5. The ad funnel: the arithmetic, cost per real conversation with spend
//      missing and present, Meta's numbers kept apart.
//   6. The review action: suggestions, and apply refuses anything it did not
//      suggest — a quoted lead, another company's lead.
//   7. Create quote: the scope lines, the intake values, the language.
//
// No live AI call anywhere: the model is a stub that counts its calls.

import {
  classifyConversation,
  countFirstKeys,
  textKey,
  adMarker,
  isSystemLine,
  isEmojiOnly,
  serviceVocabulary,
  applyAiVerdict,
  effectiveTier,
  storableQualification,
  withOverride,
  publicQualification,
  reasonInEnglish,
  TIERS,
  BUILTIN_ICE_BREAKERS,
  TEMPLATE_MIN_OTHER_THREADS,
} from "@/lib/leads/qualification";
import { extractScope, countsInText, storableScope, scopeCountsLabel } from "@/lib/leads/scopeExtract";
import { followUpFromMessage, pendingFollowUp, dateFromText, DEFAULT_DAYS } from "@/lib/leads/followUpIntent";
import { ensureFollowUpTask, followUpsForThreads, notifyDueFollowUps, followUpSourceKey, threadIdOfFollowUp } from "@/lib/leads/followUpTask";
import { estimateFromScope, inferService } from "@/lib/leads/scopeEstimate";
import { potentialValueForLead, BASES, summarisePotential } from "@/lib/leads/potentialValue";
import { buildAdFunnel, funnelSource } from "@/lib/analytics/adFunnel";
import { buildOutcomeIndex } from "@/lib/analytics/campaignRollup";
import { captureLeadFromConversation, CAPTURE_PLATFORMS } from "@/lib/leads/conversationLead";
import { qualifyCompanyThreads, QUALIFY_PLATFORMS, verdictForThread } from "@/lib/leads/qualifyThreads";
import { reviewSuggestion, summariseReview, buildConversationReview, applyConversationReview } from "@/lib/leads/conversationReview";
import { setTierOverride, cleanTier } from "@/lib/leads/tierOverride";
import { scopeNoteLines, intakeValuesFromScope } from "@/lib/leads/convertLead";
import { languageOfText } from "@/lib/leads/textLanguage";
import { getPriceBook } from "@/app/data/tradePriceBooks";
import { readFileSync } from "node:fs";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) => {
  if (cond) pass++;
  else fails.push([label, detail]);
  console.log(`  ${cond ? "✓" : "✗"} ${label}${!cond && detail !== undefined ? `  — ${JSON.stringify(detail).slice(0, 400)}` : ""}`);
};
const section = (s) => console.log(`\n${s}\n`);

const CO = "co_truefinish";
const OTHER = "co_other";
const T0 = new Date("2026-07-16T22:57:00Z").getTime();
const at = (sec) => new Date(T0 + sec * 1000);
const msg = (id, direction, body, sec = 0, attachments = null) => ({ id, direction, body, sentAt: at(sec), attachments, private: false });
const SERVICES = [
  { id: "svc_ref", label: "Cabinet Refinishing", key: "cabinet_refinishing" },
  { id: "svc_face", label: "Cabinet Refacing", key: "cabinet_refacing" },
  { id: "svc_floor", label: "Hardwood Floor Refinishing", key: "flooring" },
];
const ICE = "What is the average cost of a kitchen cabinet refinishing?";
// Four threads of this company open with the company's own ice-breaker.
const TEMPLATES = countFirstKeys(new Map([["a", textKey(ICE)], ["b", textKey(ICE)], ["c", textKey(ICE)], ["d", textKey(ICE)], ["e", textKey("hi")], ["f", textKey("hi")], ["g", textKey("hi")], ["h", textKey("hi")]]));

const classify = (messages, extra = {}) => classifyConversation({ messages, templateCounts: TEMPLATES, services: SERVICES, ...extra });

// ════════════════════════════════════════════════════════════════════════════
section("1. The four tiers, on the evidence");
// ════════════════════════════════════════════════════════════════════════════
{
  ok("four tiers, closed", JSON.stringify(TIERS) === JSON.stringify(["tap_only", "conversation", "lead", "not_relevant"]));
  ok("a quick-reply is a first message shared with ≥3 OTHER threads", TEMPLATE_MIN_OTHER_THREADS === 3);

  const ice = classify([msg("m0", "out", "Louise Coburn replied to an ad."), msg("m1", "in", ICE)]);
  ok("the company's own ice-breaker, identical in 4 threads → tap_only", ice.tier === "tap_only" && ice.reasonKey === "app.leads.tier.reason.tapOnly", ice);
  ok("…and the reason quotes what they tapped", /average cost of a kitchen cabinet/.test(reasonInEnglish(ice)), reasonInEnglish(ice));
  ok("…and the ad marker (outbound, in Meta's history) makes the origin `ad`", ice.origin === "ad", ice.origin);

  const fewer = classifyConversation({ messages: [msg("m1", "in", ICE)], templateCounts: countFirstKeys(new Map([["a", textKey(ICE)], ["b", textKey(ICE)], ["c", textKey(ICE)]])), services: SERVICES });
  ok("the same question in only 2 OTHER threads is the person's own words (conversation)", fewer.tier === "conversation", fewer);

  ok("Meta's standard ice-breaker 'I would like to get a free quote' is built in", classify([msg("m1", "in", "I would like to get a Free Quote")]).tier === "tap_only");
  ok("…in French too", classifyConversation({ messages: [msg("m1", "in", "Quels services offrez-vous ?")], services: SERVICES }).tier === "tap_only");
  ok("…and Spanish", classifyConversation({ messages: [msg("m1", "in", "¿Qué servicios ofrecen?")], services: SERVICES }).tier === "tap_only");
  ok("the built-in list has en, fr and es", BUILTIN_ICE_BREAKERS.length >= 40);

  const moss = classify([msg("m1", "in", "What services do you offer?", 0), msg("m2", "in", "What services do you offer?", 20), msg("m3", "in", "What services do you offer?", 40)]);
  ok("Moss's triple tap → tap_only, 'tapped 3 times'", moss.tier === "tap_only" && moss.params.count === 3, moss);
  const doubleTyped = classify([msg("m1", "in", "Do you paint oak cabinets white?", 0), msg("m2", "in", "Do you paint oak cabinets white?", 15)]);
  ok("a typed question sent twice in seconds is a tap (no detail in it)", doubleTyped.tier === "tap_only", doubleTyped);
  const doubleCounts = classify([msg("m1", "in", "22 doors and 15 drawers", 0), msg("m2", "in", "22 doors and 15 drawers", 10)]);
  ok("…but '22 doors and 15 drawers' sent twice is still 22 doors (a detail survives)", doubleCounts.tier === "lead" && doubleCounts.scope.counts.doors === 22, doubleCounts);

  ok("emoji only → tap_only", classify([msg("m1", "in", "👍"), msg("m2", "in", "❤️❤️")]).tier === "tap_only");
  ok("a sticker with no text → tap_only", classify([msg("m1", "in", "", 0, [{ type: "sticker" }])]).tier === "tap_only");
  ok("isEmojiOnly: ':)' yes, 'ok 👍' no", isEmojiOnly(":)") && !isEmojiOnly("ok 👍"));
  ok("'hi' and nothing else → tap_only (a greeting, said so)", classify([msg("m1", "in", "Hi")]).reasonKey === "app.leads.tier.reason.greetingOnly");

  const john = classify([msg("m0", "out", "John Brown replied to an ad."), msg("m1", "in", "", 0, [{ type: "video", url: "https://res.cloudinary.com/x/v.mp4" }]), msg("m2", "out", "Thanks for the video but is that a basement?", 60), msg("m3", "out", "We do focus on kitchen refinishing", 70)]);
  ok("John Brown's basement video, owner: 'we do focus on kitchen refinishing' → not_relevant", john.tier === "not_relevant" && john.reasonKey === "app.leads.tier.reason.declined", john);
  const typedBasement = classify([msg("m1", "in", "Can you finish my basement? need a quote")]);
  ok("a typed basement request to a cabinet company → not_relevant ('basement' isn't a service)", typedBasement.tier === "not_relevant" && typedBasement.params.word === "basement", typedBasement);
  const intro = classify([msg("m1", "in", "Ok contact us in two weeks to book an app"), msg("m2", "out", "Hi Moss! We specialize in professionally painting and refinishing kitchen cabinets.")]);
  ok("'We specialize in…' is the contractor's introduction, not a decline (Moss's real thread)", intro.tier !== "not_relevant", intro);
  ok("…and a booking word with no kitchen in it is a conversation, not a lead", intro.tier === "conversation", intro);

  const tony = classify([
    msg("t0", "out", "Tony Tohme replied to an ad.", 0),
    msg("t1", "in", "I would like to get a Free Quote", 1),
    msg("t2", "in", "I would like an in person quote if possible to explain what needs to be done the process and the cost.", 1300),
    msg("t3", "in", "29 Rialto way. Are you able to match the paint color and style", 1440),
    msg("t4", "out", "How many doors and drawers are you looking to refinish?", 1500),
    msg("t5", "in", "22 closets and 15 drawers.", 1620),
  ]);
  ok("Tony → lead", tony.tier === "lead", tony);
  ok("…22 'closets' (his word for doors) + 15 drawers extracted", tony.scope.counts.doors === 22 && tony.scope.counts.drawers === 15, tony.scope.counts);
  ok("…with the sentence it came from", tony.scope.sources.doors.quote === "22 closets and 15 drawers." && tony.scope.sources.doors.messageId === "t5", tony.scope.sources);
  ok("…the details name the counts and the address", tony.details.some((d) => d.key === "counts") && tony.details.some((d) => d.key === "address"), tony.details);
  ok("…origin ad (the marker)", tony.origin === "ad");

  const louise = classify([msg("l1", "in", "Do you service Limoges Ontario?"), msg("l2", "out", "Yes! How many doors and drawers?"), msg("l3", "in", "7 drawers,23 doors"), msg("l4", "in", "louise@example.com 613-555-0177")]);
  ok("Louise → lead, 23 doors + 7 drawers", louise.tier === "lead" && louise.scope.counts.doors === 23 && louise.scope.counts.drawers === 7, louise.scope.counts);
  ok("…the reason quotes the counts sentence, not her first question", louise.params.quote === "7 drawers,23 doors", louise.params);

  const gladys = classify([msg("g1", "in", "I would like to get a Free Quote"), msg("g2", "in", "Hi I have 24 doors and 4 drawers I want to put handles…no repairs needs just painting and one colour")]);
  ok("Gladys → lead, 24 doors + 4 drawers, handles noted", gladys.tier === "lead" && gladys.scope.counts.doors === 24 && gladys.scope.counts.drawers === 4 && gladys.scope.hardware, gladys.scope);
  const gladysEmail = classify([msg("g1", "in", "24 doors and 4 drawers, painting"), msg("g2", "in", "Sorry wrong email It's: gladys@example.com")]);
  ok("'Sorry wrong email' is a correction, not a mis-tap", gladysEmail.tier === "lead", gladysEmail);

  const oops = classify([msg("m1", "in", "What services do you offer?"), msg("m2", "in", "Sorry I pressed the button by mistake")]);
  ok("'pressed the button by mistake' → not_relevant, quoted", oops.tier === "not_relevant" && oops.reasonKey === "app.leads.tier.reason.misTap" && /by mistake/.test(oops.params.quote), oops);
  ok("'Mistake' on its own → not_relevant", classify([msg("m1", "in", "Mistake")]).tier === "not_relevant");
  ok("'Not at this time thanks' → conversation (a person saying no for now), no AI", (() => {
    const v = classify([msg("m1", "in", "Not at this time thanks")]);
    return v.tier === "conversation" && v.reasonKey === "app.leads.tier.reason.notNow" && !v.needsAi;
  })());
  const scam = classify([msg("m1", "in", "⚠️ 𝖨𝗆𝗉𝗈𝗋𝗍𝖺𝗇𝗍 𝖭𝗈𝗍𝗂𝖼𝖾 from the Meta Policy Support Team: your page will be disabled")]);
  ok("the 'Meta Policy' scam in look-alike letters → not_relevant (spam)", scam.tier === "not_relevant" && scam.reasonKey === "app.leads.tier.reason.spam", scam);
  ok("a vendor pitch → not_relevant", classify([msg("m1", "in", "I'm with Our Homes magazine, who do I speak to about marketing and advertising?")]).tier === "not_relevant");

  ok("Meta's 'You can call X within the next 7 days.' is a system line, not typing", isSystemLine("You can call Helen Mary within the next 7 days.") && classify([msg("m1", "in", "You can call Helen Mary within the next 7 days.")]).tier === "tap_only");
  ok("'Facebook created this chat because…' is a system line", isSystemLine("Facebook created this chat because Vera commented on your post. Vera won't see this until you start a conversation."));
  ok("adMarker reads the name, en/fr/es", adMarker("Louise Coburn replied to an ad.")?.name === "Louise Coburn" && adMarker("Marie a répondu à une publicité.")?.name === "Marie" && adMarker("Ana respondió a un anuncio.")?.name === "Ana");
  ok("an adReferral alone makes the origin ad", classify([msg("m1", "in", "hi")], { adReferral: { adId: "123456", source: "ADS" } }).origin === "ad");

  const unsure = classify([msg("m1", "in", "My sister said you did a great job for her last year")]);
  ok("words the rules cannot place → conversation, unsure, needsAi", unsure.tier === "conversation" && unsure.unsure && unsure.needsAi, unsure);
  const settled = applyAiVerdict(unsure, { ok: true, kind: "not_work", reason: "A thank-you, no work." });
  ok("…the model's 'not_work' settles it: not_relevant, method ai, reason kept", settled.tier === "not_relevant" && settled.method === "ai" && settled.params.reason === "A thank-you, no work.", settled);
  const noService = applyAiVerdict(unsure, { ok: true, kind: "work_request", fields: {} });
  ok("…a work request for no service the company lists → not_relevant", noService.tier === "not_relevant");
  ok("…the model never overrides a verdict the rules were sure of", applyAiVerdict(tony, { ok: true, kind: "not_work" }) === tony);

  const noList = classifyConversation({ messages: [msg("m1", "in", "Hi, I sent the form about my roof, when can you come?")], services: [] });
  ok("a company with no services listed is not held to relevance (an empty list is no statement)", noList.tier === "lead", noList);
  ok("service vocabulary comes from the company's own labels", serviceVocabulary(SERVICES).groups.includes("cabinets") && !serviceVocabulary(SERVICES).groups.includes("roofing"));
}

// ════════════════════════════════════════════════════════════════════════════
section("2. Scope extraction against hostile text");
// ════════════════════════════════════════════════════════════════════════════
{
  const c = (t) => JSON.stringify(countsInText(t));
  ok("'22 doors + 15 drawers'", c("I have 22 doors + 15 drawers") === JSON.stringify({ doors: 22, drawers: 15 }));
  ok("'doors: 24, drawers: 4' (the 24 is not also drawers)", c("doors: 24, drawers: 4") === JSON.stringify({ doors: 24, drawers: 4 }), c("doors: 24, drawers: 4"));
  ok("'Doors: 22 Drawers 15' — the 22 after a colon is never ALSO read as drawers", countsInText("Doors: 22 Drawers 15").doors === 22 && countsInText("Doors: 22 Drawers 15").drawers !== 22, countsInText("Doors: 22 Drawers 15"));
  ok("'7 drawers, 123 Main St' — a house number is not a count", c("23 doors and 7 drawers, 123 Main St") === JSON.stringify({ doors: 23, drawers: 7 }));
  ok("'twenty two doors and fifteen drawers'", c("twenty two doors and fifteen drawers") === JSON.stringify({ doors: 22, drawers: 15 }));
  ok("'12 upper doors and 10 lower doors' sums to 22", c("12 upper doors and 10 lower doors") === JSON.stringify({ doors: 22 }));
  ok("'1,200 sq ft' is 1200, not 200", c("1,200 sq ft of hardwood") === JSON.stringify({ sqft: 1200 }));
  ok("'J'ai 20 portes et 8 tiroirs'", c("J'ai 20 portes et 8 tiroirs") === JSON.stringify({ doors: 20, drawers: 8 }));
  ok("'Tengo 18 puertas y 6 cajones'", c("Tengo 18 puertas y 6 cajones") === JSON.stringify({ doors: 18, drawers: 6 }));
  ok("'1000 doors lol' is a typo, not a kitchen", c("1000 doors lol") === "{}");
  ok("a phone number is not a count", c("call 613 555 0142") === "{}");
  ok("'my front door painted' is not cabinet scope", c("I need my front door painted") === "{}");
  const s = extractScope([msg("a", "in", "22 doors and 15 drawers. White please."), msg("b", "in", "sorry, 24 doors"), msg("c", "out", "a typical kitchen is 30 doors")]);
  ok("the latest mention wins; the contractor's own number is never read", s.counts.doors === 24 && s.counts.drawers === 15 && s.sources.doors.messageId === "b", s);
  ok("colour kept as the person's sentence", s.colour?.quote === "White please.", s.colour);
  ok("a tap is never read for scope (skip)", Object.keys(extractScope([msg("a", "in", "22 doors")], { skip: new Set(["a"]) }).counts).length === 0);
  ok("storableScope → counts, sources and from: conversation", storableScope(s).from === "conversation" && storableScope(s).counts.doors === 24);
  ok("nothing said → null", storableScope(extractScope([msg("a", "in", "hello")])) === null);
  ok("scopeCountsLabel '22 doors + 15 drawers'", scopeCountsLabel({ doors: 22, drawers: 15 }) === "22 doors + 15 drawers");
}

// ════════════════════════════════════════════════════════════════════════════
section("3. Follow-up dates");
// ════════════════════════════════════════════════════════════════════════════
{
  const sent = "2026-07-19T15:00:00Z";
  const f = (body) => followUpFromMessage({ id: "m", direction: "in", body, sentAt: sent });
  const back = f("I'll get in touch when I'm back");
  ok("'I'll get in touch when I'm back' → a task in 7 days", back && back.vague && Math.round((back.due - new Date(sent)) / 86400000) === DEFAULT_DAYS && DEFAULT_DAYS === 7, back);
  const oct = f("I'll get back to you after the 17th of October");
  ok("'after the 17th of October' → 17 October", oct && oct.due.toISOString().slice(0, 10) === "2026-10-17", oct);
  ok("'in 3 weeks' → 21 days", f("I'm away, I'll reach out in 3 weeks").due.toISOString().slice(0, 10) === "2026-08-09");
  ok("'Out of town until Monday' → the Monday", f("Out of town until Monday").due.toISOString().slice(0, 10) === "2026-07-20");
  ok("French: 'je vous recontacte dans 3 semaines'", f("Je suis en vacances, je vous recontacte dans 3 semaines").due.toISOString().slice(0, 10) === "2026-08-09");
  ok("'Can you come on Monday?' is a booking, not 'later'", f("Can you come on Monday?") === null);
  ok("an outbound message never makes a follow-up", followUpFromMessage({ direction: "out", body: "I'll get back to you next week", sentAt: sent }) === null);
  ok("a month earlier in the year than the message means next year", dateFromText("back on the 3rd of March", sent).date.toISOString().slice(0, 10) === "2027-03-03");
  ok("the person wrote again afterwards → the promise is spent", pendingFollowUp([{ id: "a", direction: "in", body: "I'll get in touch when I'm back", sentAt: sent }, { id: "b", direction: "in", body: "Hi I'm back", sentAt: sent }]) === null);
  ok("our reply after it does NOT cancel it", Boolean(pendingFollowUp([{ id: "a", direction: "in", body: "I'll get in touch when I'm back", sentAt: sent }, { id: "b", direction: "out", body: "ok talk soon", sentAt: sent }])));
  ok("sourceKey round-trips the thread", threadIdOfFollowUp(followUpSourceKey("T1", "m9")) === "T1");
}

// ════════════════════════════════════════════════════════════════════════════
// An in-memory Prisma for the paths that write.
// ════════════════════════════════════════════════════════════════════════════
function matches(row, where) {
  if (!where) return true;
  for (const [k, cond] of Object.entries(where)) {
    if (k === "OR") {
      if (!cond.some((c) => matches(row, c))) return false;
      continue;
    }
    if (k === "NOT") {
      if (matches(row, cond)) return false;
      continue;
    }
    const v = row[k];
    if (cond !== null && typeof cond === "object" && !(cond instanceof Date) && !Array.isArray(cond)) {
      if ("in" in cond && !cond.in.includes(v)) return false;
      if ("not" in cond && (cond.not === null ? v === null || v === undefined : v === cond.not)) return false;
      if ("startsWith" in cond && !(typeof v === "string" && v.startsWith(cond.startsWith))) return false;
      if ("lte" in cond && !(v && new Date(v) <= new Date(cond.lte))) return false;
      if ("gte" in cond && !(v && new Date(v) >= new Date(cond.gte))) return false;
      const plain = Object.keys(cond).filter((x) => !["in", "not", "startsWith", "lte", "gte"].includes(x));
      if (plain.length && !matches(v || {}, Object.fromEntries(plain.map((x) => [x, cond[x]])))) return false;
    } else if (v !== cond) return false;
  }
  return true;
}
function memDb(seed) {
  const st = {
    threads: (seed.threads || []).map((t) => ({ leadId: null, clientId: null, assignedToId: null, leadCapture: null, adReferral: null, routingIntent: null, participantExternalId: "PSID", createdAt: at(0), ...t })),
    messages: seed.messages || [],
    leads: seed.leads || [],
    tasks: [],
    events: [],
    members: seed.members || [{ companyId: CO, userId: "u_owner", role: "owner", active: true, createdAt: at(0) }, { companyId: OTHER, userId: "u_other", role: "owner", active: true, createdAt: at(0) }],
    services: seed.services || {},
    writes: [],
    queries: [],
  };
  const threadView = (t) => ({
    ...t,
    channel: { platform: t.platform },
    messages: st.messages.filter((m) => m.threadId === t.id).sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt)),
  });
  const db = {
    st,
    messageThread: {
      async findFirst({ where }) {
        st.queries.push(["thread.findFirst", where]);
        const t = st.threads.find((x) => matches(x, where));
        return t ? threadView(t) : null;
      },
      async findMany({ where, take, cursor, skip }) {
        st.queries.push(["thread.findMany", where]);
        let rows = st.threads.filter((x) => matches({ ...x, channel: { platform: x.platform } }, where)).sort((a, b) => (a.id < b.id ? -1 : 1));
        if (cursor) rows = rows.slice(rows.findIndex((r) => r.id === cursor.id) + (skip || 0));
        if (take) rows = rows.slice(0, take);
        return rows.map((t) => ({ ...t, channel: { platform: t.platform } }));
      },
      async update({ where, data }) {
        st.writes.push(["thread.update", where]);
        const t = st.threads.find((x) => x.id === where.id);
        Object.assign(t, data);
        return t;
      },
      async updateMany({ where, data }) {
        st.writes.push(["thread.updateMany", where]);
        const hits = st.threads.filter((x) => matches(x, where));
        for (const t of hits) Object.assign(t, data);
        return { count: hits.length };
      },
    },
    message: {
      async findMany({ where }) {
        st.queries.push(["message.findMany", where]);
        return st.messages.filter((m) => matches(m, where)).sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt));
      },
    },
    leadRequest: {
      async findFirst({ where }) {
        st.queries.push(["lead.findFirst", where]);
        return st.leads.find((l) => matches(l, where)) || null;
      },
      async findMany({ where }) {
        st.queries.push(["lead.findMany", where]);
        return st.leads.filter((l) => matches(l, where));
      },
      async update({ where, data }) {
        st.writes.push(["lead.update", where]);
        const l = st.leads.find((x) => x.id === where.id);
        if (l) Object.assign(l, data);
        return { id: where.id };
      },
    },
    companyServiceCategory: {
      async findMany({ where }) {
        st.queries.push(["csc.findMany", where]);
        return (st.services[where.companyId] || []).map((s) => ({ category: s, categoryId: s.id, rates: null, defaultRate: null, unit: null }));
      },
    },
    member: { async findFirst({ where }) { return st.members.find((m) => matches(m, where)) || null; } },
    company: { async findUnique() { return { defaultLanguage: "en" }; } },
    task: {
      async findFirst({ where }) { return st.tasks.find((t) => matches(t, where)) || null; },
      async findMany({ where }) { return st.tasks.filter((t) => matches(t, where)); },
      async create({ data }) {
        if (st.tasks.some((t) => t.sourceKey === data.sourceKey)) { const e = new Error("dup"); e.code = "P2002"; throw e; }
        const row = { id: `task_${st.tasks.length + 1}`, ...data };
        st.tasks.push(row);
        st.writes.push(["task.create", data.companyId]);
        return { id: row.id, dueDate: row.dueDate };
      },
      async updateMany({ where, data }) {
        const hits = st.tasks.filter((t) => matches(t, where));
        for (const t of hits) Object.assign(t, data);
        return { count: hits.length };
      },
    },
    notificationEvent: { async findMany({ where }) { return st.events.filter((e) => matches(e, where)); } },
  };
  return db;
}
function captureDeps(db, { aiKind = "work_request" } = {}) {
  const created = [];
  let aiCalls = 0;
  const deps = {
    createLead: async (input) => {
      const lead = { id: `L_${created.length + 1}`, companyId: input.companyId, status: "new", createdAt: at(0), conversationEvidence: null, intake: input.intake || null, ...input };
      created.push(lead);
      db.st.leads.push(lead);
      return lead;
    },
    rescore: async () => null,
    extract: async () => {
      aiCalls++;
      return { ok: true, metered: true, kind: aiKind, reason: "stub", notLeadReason: null, kindMessage: null, fields: {}, refused: [] };
    },
    resolveCampaign: async () => null,
    aiConfigured: () => true,
    reviewRecords: async () => ({ conversion: null, clientDocs: [] }),
    rejected: async () => new Set(),
    linkThread: async () => ({ id: "lt" }),
    linkClient: async () => ({ id: "lc" }),
    // The company's OWN templates: counted from its own threads only.
    templates: async (_p, companyId) => countFirstKeys(new Map(db.st.threads.filter((t) => t.companyId === companyId).map((t) => [t.id, textKey((db.st.messages.filter((m) => m.threadId === t.id && m.direction === "in").sort((a, b) => a.sentAt - b.sentAt)[0] || {}).body)]))),
    servicesFor: async (_p, companyId) => db.st.services[companyId] || [],
  };
  return { deps, created, aiCalls: () => aiCalls };
}

// ════════════════════════════════════════════════════════════════════════════
section("4. The capture: only a `lead` makes a lead, and a tap never pays for AI");
// ════════════════════════════════════════════════════════════════════════════
{
  const iceThreads = ["I1", "I2", "I3", "I4"];
  const db = memDb({
    threads: [
      ...iceThreads.map((id) => ({ id, companyId: CO, platform: "facebook", participantName: `Person ${id}` })),
      { id: "T_tony", companyId: CO, platform: "facebook", participantName: "Tony Tohme" },
      { id: "X1", companyId: OTHER, platform: "facebook", participantName: "Other" },
    ],
    messages: [
      ...iceThreads.map((id, i) => ({ id: `${id}m`, threadId: id, direction: "in", body: ICE, sentAt: at(i), private: false })),
      { id: "tm0", threadId: "T_tony", direction: "out", body: "Tony Tohme replied to an ad.", sentAt: at(10), private: false },
      { id: "tm1", threadId: "T_tony", direction: "in", body: "I would like to get a Free Quote", sentAt: at(11), private: false },
      { id: "tm2", threadId: "T_tony", direction: "in", body: "22 closets and 15 drawers. 29 Rialto Way, Ottawa", sentAt: at(200), private: false, attachments: [{ type: "image", url: "https://res.cloudinary.com/x/k.jpg" }] },
      { id: "xm1", threadId: "X1", direction: "in", body: ICE, sentAt: at(1), private: false },
    ],
    services: { [CO]: SERVICES, [OTHER]: [] },
  });
  const d = captureDeps(db);
  const r = await captureLeadFromConversation({ companyId: CO, threadId: "I1", prisma: db, deps: d.deps, now: at(1000) });
  ok("an ice-breaker tap → no lead", !r.leadId && d.created.length === 0, r);
  ok("…tier stored on the thread", db.st.threads.find((t) => t.id === "I1").leadCapture?.qualification?.tier === "tap_only");
  ok("…and the model was NEVER called (no AI credit spent on a tap)", d.aiCalls() === 0 && r.decision === "tier_tap_only", r);

  const r2 = await captureLeadFromConversation({ companyId: CO, threadId: "T_tony", prisma: db, deps: d.deps, now: at(1000) });
  ok("Tony's thread → a lead", r2.created && r2.tier === "lead", r2);
  const tonyLead = d.created[0];
  ok("…intake.scope carries 22 doors + 15 drawers with the sentence", tonyLead?.intake?.scope?.counts?.doors === 22 && tonyLead.intake.scope.counts.drawers === 15 && /22 closets/.test(tonyLead.intake.scope.sources.doors.quote), tonyLead?.intake);
  ok("…the address from the pattern is on intake too", /29 Rialto Way/.test(tonyLead?.intake?.address || ""), tonyLead?.intake);
  ok("…no service guessed: the company sells two cabinet services and he named neither", !tonyLead.categoryId, tonyLead.categoryId);

  // Tenant isolation: the other company's identical first message is not
  // a template for it (it has ONE thread with it), and its threads never
  // count towards this company's.
  const dOther = captureDeps(db);
  await captureLeadFromConversation({ companyId: OTHER, threadId: "X1", prisma: db, deps: dOther.deps, now: at(1000) });
  const xq = db.st.threads.find((t) => t.id === "X1").leadCapture?.qualification;
  ok("tenant isolation: the same words in ANOTHER company's single thread are that person's own words there (conversation), not a quick-reply", xq?.tier === "conversation", xq);
  ok("…every thread/lead query of the capture carried the company id", db.st.queries.filter(([k]) => k.startsWith("thread") || k.startsWith("lead")).every(([, w]) => JSON.stringify(w).includes(CO) || JSON.stringify(w).includes(OTHER)), db.st.queries.filter(([, w]) => !JSON.stringify(w).includes("co_")));

  // A person's tier sticks.
  const db2 = memDb({
    threads: [{ id: "P1", companyId: CO, platform: "facebook", participantName: "Pat Doe" }],
    messages: [{ id: "p1", threadId: "P1", direction: "in", body: "What services do you offer?", sentAt: at(0), private: false }],
    services: { [CO]: SERVICES },
  });
  const d2 = captureDeps(db2);
  await captureLeadFromConversation({ companyId: CO, threadId: "P1", prisma: db2, deps: d2.deps, now: at(100) });
  ok("Pat's tap → tap_only, no lead", effectiveTier(db2.st.threads[0].leadCapture.qualification) === "tap_only" && d2.created.length === 0);
  const set = await setTierOverride(db2, { companyId: CO, threadId: "P1", tier: "lead", actor: { userId: "u_owner", name: "Emilio" }, deps: { capture: (args) => captureLeadFromConversation({ ...args, deps: d2.deps }) } });
  ok("a person taps 'Lead' → the lead is made on the tap", set.ok && set.leadId && d2.created.length === 1, set);
  ok("…the tier reads 'set by Emilio', the rules' own verdict kept beside it", set.qualification.method === "person" && set.qualification.override.byName === "Emilio" && set.qualification.ruleTier === "tap_only", set.qualification);
  db2.st.messages.push({ id: "p2", threadId: "P1", direction: "in", body: "👍", sentAt: at(300), private: false });
  await captureLeadFromConversation({ companyId: CO, threadId: "P1", prisma: db2, deps: d2.deps, now: at(400) });
  ok("…and it STICKS when the next message arrives and the rules re-run", effectiveTier(db2.st.threads[0].leadCapture.qualification) === "lead" && db2.st.threads[0].leadCapture.qualification.override?.byName === "Emilio", db2.st.threads[0].leadCapture.qualification);
  const cleared = await setTierOverride(db2, { companyId: CO, threadId: "P1", tier: null, actor: {}, deps: { capture: async () => null } });
  ok("'Back to the rules' clears it", cleared.ok && cleared.qualification.method !== "person", cleared.qualification);
  ok("cleanTier refuses junk, allows null", cleanTier("lead").ok && cleanTier(null).ok && !cleanTier("hot").ok && !cleanTier({}).ok);
  const foreign = await setTierOverride(db2, { companyId: OTHER, threadId: "P1", tier: "lead", actor: {} });
  ok("another company's thread → 404, nothing written", !foreign.ok && foreign.status === 404);

  // The "not a lead" mark wins over a person's "lead".
  const db3 = memDb({
    threads: [{ id: "N1", companyId: CO, platform: "facebook", participantName: "Nina", leadCapture: { notALead: { at: at(0).toISOString() } } }],
    messages: [{ id: "n1", threadId: "N1", direction: "in", body: "22 doors and 15 drawers, 12 Elm St", sentAt: at(0), private: false }],
    services: { [CO]: SERVICES },
  });
  const d3 = captureDeps(db3);
  await setTierOverride(db3, { companyId: CO, threadId: "N1", tier: "lead", actor: {}, deps: { capture: (args) => captureLeadFromConversation({ ...args, deps: d3.deps }) } });
  ok("the 'not a lead' mark (a deleted lead's tombstone on the thread) wins over a 'lead' tap", d3.created.length === 0);

  // Not relevant by the rules: the model is not paid either.
  const db4 = memDb({
    threads: [{ id: "B1", companyId: CO, platform: "facebook", participantName: "Basement Bob" }],
    messages: [{ id: "b1", threadId: "B1", direction: "in", body: "Can you finish my basement? need a quote asap 613-555-0100", sentAt: at(0), private: false }],
    services: { [CO]: SERVICES },
  });
  const d4 = captureDeps(db4);
  const r4 = await captureLeadFromConversation({ companyId: CO, threadId: "B1", prisma: db4, deps: d4.deps, now: at(100) });
  ok("a basement request with a phone number → no lead, no model read", !r4.leadId && d4.aiCalls() === 0 && r4.tier === "not_relevant", r4);

  // The backfill's own case: a thread an EARLIER pass already called a work
  // request (the model, or the front desk's "price"), whose person only ever
  // tapped an ice-breaker. Before the tiers that verdict made a lead; now the
  // tier is what decides.
  const db5 = memDb({
    threads: [
      ...["J1", "J2", "J3", "J4"].map((id) => ({ id, companyId: CO, platform: "facebook", participantName: id })),
      { id: "J5", companyId: CO, platform: "facebook", participantName: "Earlier Verdict", routingIntent: "price", leadCapture: { kind: "work_request", kindMethod: "ai", aiRuns: 1, inboundAtRun: 1, contactsSeen: [] } },
    ],
    messages: ["J1", "J2", "J3", "J4", "J5"].map((id, i) => ({ id: `${id}m`, threadId: id, direction: "in", body: ICE, sentAt: at(i), private: false })),
    services: { [CO]: SERVICES },
  });
  const d5 = captureDeps(db5);
  const r5 = await captureLeadFromConversation({ companyId: CO, threadId: "J5", prisma: db5, deps: d5.deps, now: at(100) });
  ok("an earlier 'work request' verdict on a thread that only TAPPED makes no lead now", d5.created.length === 0 && !r5.leadId && r5.tier === "tap_only", r5);

  ok("the bulk classifier and the capture cover the same platforms", JSON.stringify(QUALIFY_PLATFORMS) === JSON.stringify(CAPTURE_PLATFORMS));
}

// ════════════════════════════════════════════════════════════════════════════
section("5. Follow-up tasks and the notification on the day");
// ════════════════════════════════════════════════════════════════════════════
{
  const db = memDb({
    threads: [{ id: "F1", companyId: CO, platform: "facebook", participantName: "Tony Tohme" }],
    messages: [
      { id: "f1", threadId: "F1", direction: "in", body: "22 doors and 15 drawers, kitchen refinishing", sentAt: new Date("2026-07-19T14:00:00Z"), private: false },
      { id: "f2", threadId: "F1", direction: "in", body: "I'll be out next week… I'll get in touch when I'm back", sentAt: new Date("2026-07-19T15:00:00Z"), private: false },
    ],
    services: { [CO]: SERVICES },
  });
  const d = captureDeps(db);
  const r = await captureLeadFromConversation({ companyId: CO, threadId: "F1", prisma: db, deps: { ...d.deps, followUp: ensureFollowUpTask }, now: new Date("2026-08-01T12:00:00Z") });
  const task = db.st.tasks[0];
  ok("'I'll get in touch when I'm back' → a follow-up task", Boolean(task) && r.followUp?.created, r.followUp);
  ok("…due 7 days after he said it (26 July)", task && new Date(task.dueDate).toISOString().slice(0, 10) === "2026-07-26", task?.dueDate);
  ok("…for the owner (no assignee yet), attributed to the owner", task?.assignedToId === "u_owner" && task?.createdById === "u_owner");
  ok("…keyed to the conversation and the message", task?.sourceKey === followUpSourceKey("F1", "f2"));
  ok("…titled in the company's language with his name", /Tony Tohme/.test(task?.title || ""), task?.title);
  await captureLeadFromConversation({ companyId: CO, threadId: "F1", prisma: db, deps: { ...d.deps, followUp: ensureFollowUpTask }, now: new Date("2026-08-01T13:00:00Z") });
  ok("a second pass makes no second task", db.st.tasks.length === 1);
  db.st.messages.push({ id: "f3", threadId: "F1", direction: "in", body: "Actually I'll get back to you after the 17th of October", sentAt: new Date("2026-08-02T10:00:00Z"), private: false });
  await captureLeadFromConversation({ companyId: CO, threadId: "F1", prisma: db, deps: { ...d.deps, followUp: ensureFollowUpTask }, now: new Date("2026-08-02T11:00:00Z") });
  ok("a new promise MOVES the open task to 17 October, still one task", db.st.tasks.length === 1 && new Date(db.st.tasks[0].dueDate).toISOString().slice(0, 10) === "2026-10-17", db.st.tasks);

  const map = await followUpsForThreads(db, CO, ["F1"]);
  ok("the board finds the follow-up through the thread", map.get("F1")?.id === db.st.tasks[0].id);
  const none = await followUpsForThreads(db, OTHER, ["F1"]);
  ok("…never for another company", none.size === 0);

  const sent = [];
  const notify = async (e) => { sent.push(e); db.st.events.push({ type: e.type, entityId: e.entityId }); return { created: true }; };
  const early = await notifyDueFollowUps(db, { now: new Date("2026-10-16T12:00:00Z"), notify });
  ok("nothing is announced before the day", early.sent === 0 && sent.length === 0);
  const day = await notifyDueFollowUps(db, { now: new Date("2026-10-17T14:00:00Z"), notify });
  ok("on the day: one notification, to the assignee only", day.sent === 1 && sent[0].type === "lead.follow_up_due" && JSON.stringify(sent[0].recipientUserIds) === JSON.stringify(["u_owner"]) && sent[0].params.leadName === "Tony Tohme", sent);
  await notifyDueFollowUps(db, { now: new Date("2026-10-17T14:15:00Z"), notify });
  ok("…and only once (the next tick sends nothing)", sent.length === 1);

  const tap = memDb({ threads: [{ id: "F2", companyId: CO, platform: "facebook", participantName: "Tapper" }], messages: [{ id: "x", threadId: "F2", direction: "in", body: "What services do you offer?", sentAt: at(0), private: false }, { id: "y", threadId: "F2", direction: "in", body: "👍", sentAt: at(5), private: false }], services: { [CO]: SERVICES } });
  await captureLeadFromConversation({ companyId: CO, threadId: "F2", prisma: tap, deps: { ...captureDeps(tap).deps, followUp: ensureFollowUpTask }, now: at(100) });
  ok("a tap-only thread never makes a follow-up", tap.st.tasks.length === 0);
}

// ════════════════════════════════════════════════════════════════════════════
section("6. Lead value: scope at the company's own price, never 'average'");
// ════════════════════════════════════════════════════════════════════════════
{
  const pricing = {
    svc_ref: { categoryId: "svc_ref", key: "cabinet_refinishing", label: "Cabinet Refinishing", book: getPriceBook("cabinet_refinishing", null), defaultRate: null, unit: null },
  };
  const v = potentialValueForLead({ categoryId: "svc_ref", intake: { scope: { counts: { doors: 22, drawers: 15 } } } }, { pricing });
  ok("22 doors + 15 drawers × the company's book (150/150) = 5550, basis scope", v.basis === "scope" && v.amount === 5550, v);
  const small = potentialValueForLead({ categoryId: "svc_ref", intake: { scope: { counts: { doors: 4 } } } }, { pricing });
  ok("4 doors = 600, raised to the book's job minimum (3800) and flagged", small.amount === 3800 && small.minimumApplied === true, small);
  const nothing = potentialValueForLead({ categoryId: "svc_ref", intake: {} }, { pricing, averages: { svc_ref: { amount: 9999, count: 40 } } });
  ok("no scope → no figure (even with averages handed in), counted as 'no figure'", nothing.amount === null && nothing.basis === "unknown" && summarisePotential([{ status: "new", potential: nothing }]).withoutFigure === 1);
  ok("'average' is not a basis any more", !BASES.includes("average"));
  const noPrice = estimateFromScope({ rooms: 3 }, pricing.svc_ref);
  ok("counts the company has no price for → no figure, and why", noPrice.amount === null && noPrice.why === "no_pricing" && noPrice.unpriced.includes("rooms"), noPrice);
  ok("no service to price under → why = no_service", estimateFromScope({ doors: 4 }, null).why === "no_service");
  const svcs = [{ categoryId: "a", key: "cabinet_refinishing" }, { categoryId: "b", key: "cabinet_refacing" }];
  ok("two cabinet services: 'reface' picks refacing, 'paint' picks refinishing, silence picks none", inferService(svcs, { doors: 2 }, "want to reface")?.categoryId === "b" && inferService(svcs, { doors: 2 }, "paint them")?.categoryId === "a" && inferService(svcs, { doors: 2 }, "") === null);
  const rate = estimateFromScope({ sqft: 500 }, { key: "epoxy", label: "Epoxy", book: null, defaultRate: 6, unit: "sq ft" });
  ok("a single per-sq-ft rate prices sq ft", rate.amount === 3000);
  const hostile = estimateFromScope({ doors: "x", drawers: -5, sqft: NaN }, pricing.svc_ref);
  ok("hostile counts are no scope", hostile.why === "no_scope");
}

// ════════════════════════════════════════════════════════════════════════════
section("7. The ad funnel");
// ════════════════════════════════════════════════════════════════════════════
{
  const threads = [
    // Facebook ads: 6 chats — 3 taps, 1 not relevant, 1 conversation, 1 lead
    { id: "a1", platform: "facebook", origin: "ad", tier: "tap_only", leadId: "LA" },
    { id: "a2", platform: "facebook", origin: "ad", tier: "tap_only" },
    { id: "a3", platform: "facebook", origin: "ad", tier: "tap_only" },
    { id: "a4", platform: "facebook", origin: "ad", tier: "not_relevant" },
    { id: "a5", platform: "facebook", origin: "ad", tier: "conversation" },
    { id: "a6", platform: "facebook", origin: "ad", tier: "lead", leadId: "LB" },
    // Instagram ads: 2 chats — 1 tap, 1 lead that became a quote and a job
    { id: "i1", platform: "instagram", origin: "ad", tier: "tap_only" },
    { id: "i2", platform: "instagram", origin: "ad", tier: "lead", leadId: "LC" },
    // Organic: 2 chats
    { id: "o1", platform: "facebook", origin: "organic", tier: "conversation" },
    { id: "o2", platform: "facebook", origin: "organic", tier: null },
  ];
  const leads = [{ id: "LA", quoteId: null }, { id: "LB", quoteId: null }, { id: "LC", quoteId: "Q1" }];
  const outcomeIndex = buildOutcomeIndex({ jobs: [{ id: "J1", quoteId: "Q1" }], invoices: [{ id: "I1", parentInvoiceId: null, version: 1, total: 5550, jobId: "J1", quoteId: "Q1" }] });
  const missing = buildAdFunnel({ threads, leads, outcomeIndex, spend: null });
  const fb = missing.sources.find((s) => s.source === "facebook_ads");
  const ig = missing.sources.find((s) => s.source === "instagram_ads");
  ok("facebook ads: 6 chats, 3 taps, 1 not relevant, 2 real, 1 lead", fb.threads === 6 && fb.tapOnly === 3 && fb.notRelevant === 1 && fb.realConversations === 2 && fb.leads === 1, fb);
  ok("a tap-only thread's backfilled lead does not count as a lead", fb.leads === 1);
  ok("instagram ads: the lead became a quote, a won job, $5,550 invoiced", ig.leads === 1 && ig.quotes === 1 && ig.won === 1 && ig.invoiced === 5550, ig);
  ok("all ads = facebook + instagram (organic kept out)", missing.allAds.threads === 8 && missing.allAds.realConversations === 3 && missing.allAds.leads === 2, missing.allAds);
  ok("organic counted apart, an unclassified chat said so", missing.sources.find((s) => s.source === "organic").unclassified === 1);
  ok("no WhatsApp row when there were no WhatsApp ad chats", !missing.sources.some((s) => s.source === "whatsapp_ads"));
  ok("spend missing → every cost null, and said", missing.spendMissing && missing.allAds.costPerRealConversation === null && missing.allAds.costPerLead === null && missing.allAds.metaCostPerConversation === null);
  const present = buildAdFunnel({ threads, leads, outcomeIndex, spend: { amount: 600, metaConversations: 8, metaLeads: 4, currency: "CAD" } });
  ok("Meta's cost per conversation = 600 / 8 = 75 (Meta's count, labelled Meta's)", present.allAds.metaCostPerConversation === 75);
  ok("cost per REAL conversation = 600 / 3 = 200", present.allAds.costPerRealConversation === 200, present.allAds);
  ok("cost per real lead = 600 / 2 = 300; Meta's own = 600 / 4 = 150", present.allAds.costPerLead === 300 && present.allAds.metaCostPerLead === 150);
  ok("Meta's numbers are never overwritten", present.allAds.metaConversations === 8 && present.allAds.metaLeads === 4);
  const zero = buildAdFunnel({ threads: [], leads: [], spend: { amount: 100, metaConversations: 0, metaLeads: null } });
  ok("zero denominators are null, never Infinity or 0", zero.allAds.costPerRealConversation === null && zero.allAds.metaCostPerConversation === null && zero.allAds.metaCostPerLead === null);
  ok("funnelSource: a whatsapp ad thread", funnelSource({ platform: "whatsapp", origin: "ad" }) === "whatsapp_ads");
}

// ════════════════════════════════════════════════════════════════════════════
section("8. The review action — never automatic, never beyond what it suggested");
// ════════════════════════════════════════════════════════════════════════════
{
  ok("tap_only → remove; not_relevant → remove", reviewSuggestion({ id: "x" }, { tier: "tap_only" }).action === "remove" && reviewSuggestion({ id: "x" }, { tier: "not_relevant" }).action === "remove");
  ok("lead / conversation → keep", reviewSuggestion({ id: "x" }, { tier: "lead" }).action === "keep" && reviewSuggestion({ id: "x" }, { tier: "conversation" }).action === "keep");
  ok("a quoted lead is kept whatever its first message was", reviewSuggestion({ id: "x", quoteId: "Q" }, { tier: "tap_only" }).why === "quoted");
  ok("…and one with a confirmed-match quote", reviewSuggestion({ id: "x", inferredQuoteId: "Q" }, { tier: "tap_only" }).why === "quoted");
  ok("Won or Lost → kept (a person already decided)", reviewSuggestion({ id: "x", status: "lost" }, { tier: "tap_only" }).why === "decided");
  ok("no conversation found → kept", reviewSuggestion({ id: "x" }, null).why === "no_conversation");
  ok("summary counts", JSON.stringify(summariseReview([{ action: "remove", why: "tap_only" }, { action: "keep", why: "lead" }, { action: "remove", why: "tap_only" }])) === JSON.stringify({ total: 3, remove: 2, keep: 1, byWhy: { tap_only: 2, lead: 1 } }));

  // Wiring of apply: every refusal leaves the rows exactly as they were.
  const src = readFileSync("lib/leads/conversationReview.js", "utf8");
  ok("apply acts only on ids the review itself suggests removing", /const go = wanted\.filter\(\(id\) => removable\.has\(id\)\)/.test(src));
  ok("apply deletes through deleteLeads with notALead: true", /deleteLeads\(prisma, \{ companyId, ids: go, actor, notALead: true, bulk: true, now \}\)/.test(src));
  ok("GET builds with write: false (reads only)", /classify\(prisma, \{ companyId, threadIds, write: false, now \}\)/.test(src));
  const route = readFileSync("app/api/leads/review-conversations/route.js", "utf8");
  ok("owner or admin only, AND the delete rung, AND no support session", /member\.role !== "owner" && member\.role !== "admin"/.test(route) && /view_create_edit_delete/.test(route) && /supportSessionRefusal/.test(route));

  // Executed against the in-memory db: a foreign id and a quoted lead are refused.
  const db = memDb({
    threads: [
      { id: "R1", companyId: CO, platform: "facebook", participantName: "Moss", leadId: "LM" },
      { id: "R2", companyId: CO, platform: "facebook", participantName: "Tony", leadId: "LT" },
      { id: "R3", companyId: CO, platform: "facebook", participantName: "Quoted Q", leadId: "LQ" },
    ],
    messages: [
      { id: "r1", threadId: "R1", direction: "in", body: "What services do you offer?", sentAt: at(0), private: false },
      { id: "r1b", threadId: "R1", direction: "in", body: "What services do you offer?", sentAt: at(20), private: false },
      { id: "r2", threadId: "R2", direction: "in", body: "22 doors and 15 drawers, 29 Rialto Way", sentAt: at(0), private: false },
      { id: "r3", threadId: "R3", direction: "in", body: "What services do you offer?", sentAt: at(0), private: false },
    ],
    leads: [
      { id: "LM", companyId: CO, name: "Moss", source: "meta_messenger", status: "new", quoteId: null, createdAt: at(0), conversationEvidence: { threadId: "R1" } },
      { id: "LT", companyId: CO, name: "Tony", source: "meta_messenger", status: "new", quoteId: null, createdAt: at(0), conversationEvidence: { threadId: "R2" } },
      { id: "LQ", companyId: CO, name: "Quoted Q", source: "meta_messenger", status: "contacted", quoteId: "Q9", createdAt: at(0), conversationEvidence: { threadId: "R3" } },
      { id: "LX", companyId: OTHER, name: "Foreign", source: "meta_messenger", status: "new", quoteId: null, createdAt: at(0), conversationEvidence: null },
    ],
    services: { [CO]: SERVICES },
  });
  const review = await buildConversationReview(db, { companyId: CO, deps: { inferQuotes: async () => null } });
  const byId = Object.fromEntries(review.rows.map((r) => [r.id, r]));
  ok("Moss (triple tap) → remove; Tony → keep; the quoted lead → keep", byId.LM?.action === "remove" && byId.LT?.action === "keep" && byId.LQ?.action === "keep" && byId.LQ.why === "quoted", review.rows);
  ok("another company's lead is not in this company's review", !byId.LX);
  ok("the review wrote nothing", db.st.writes.length === 0, db.st.writes);
  const refused = await applyConversationReview(db, { companyId: CO, ids: ["LT", "LQ", "LX"], deps: { inferQuotes: async () => null } });
  ok("applying a KEEP, a quoted and a foreign id → refused, nothing deleted", !refused.ok && refused.status === 409 && db.st.leads.length === 4, refused);
}

// ════════════════════════════════════════════════════════════════════════════
section("9. Create quote carries the scope; the language they wrote in");
// ════════════════════════════════════════════════════════════════════════════
{
  const lead = { intake: { scope: { counts: { doors: 22, drawers: 15 }, sources: { doors: { quote: "22 closets and 15 drawers." } }, colour: { quote: "White please." }, hardware: { quote: "new handles" }, damage: { quote: "some are peeling" } } } };
  const lines = scopeNoteLines(lead);
  ok("notes: the counts with the sentence, colour, hardware, damage", lines[0] === "From the conversation: 22 doors + 15 drawers — “22 closets and 15 drawers.”" && lines.some((l) => /Colour/.test(l)) && lines.some((l) => /Hardware/.test(l)) && lines.some((l) => /Damage/.test(l)), lines);
  ok("no scope → no lines", scopeNoteLines({ intake: {} }).length === 0);
  ok("cabinet refinishing's own intake fields get the counts", JSON.stringify(intakeValuesFromScope("cabinet_refinishing", { doors: 22, drawers: 15 })) === JSON.stringify({ doorCount: 22, drawerCount: 15 }));
  ok("a trade without those fields gets none (never a field the builder can't draw)", intakeValuesFromScope("roofing_service", { doors: 22 }) === null);
  ok("English, unmistakably", languageOfText(["Hi I have 24 doors and 4 drawers, I want them painted, can you give me a quote please"]) === "en");
  ok("French, unmistakably", languageOfText(["Bonjour, j'ai 20 portes et 8 tiroirs pour ma cuisine, combien pour les armoires ?"]) === "fr");
  ok("one 'merci' is not French (timid on purpose)", languageOfText(["merci"]) === null);
  const convert = readFileSync("lib/leads/convertLead.js", "utf8");
  ok("convert puts the counts in the scope group, the conversation photos on the quote", /\.\.\.\(intakeValues \? \{ intakeValues \} : \{\}\)/.test(convert) && /conversationPhotos\(company\.id, lead\)/.test(convert));
}

// ════════════════════════════════════════════════════════════════════════════
section("10. Stored shapes: the override is carried, never dropped");
// ════════════════════════════════════════════════════════════════════════════
{
  const rules = classify([msg("m1", "in", "What services do you offer?")]);
  const first = storableQualification(rules, { previous: null });
  const withPerson = withOverride(first, { tier: "lead", byName: "Emilio" });
  const again = storableQualification(classify([msg("m1", "in", "What services do you offer?")], { override: withPerson.override }), { previous: withPerson });
  ok("a re-run stores the rules' tier and carries the person's", again.tier === "tap_only" && again.override?.tier === "lead" && effectiveTier(again) === "lead", again);
  const pub = publicQualification(again);
  ok("the screen sees the person's tier, the rules' beside it", pub.tier === "lead" && pub.ruleTier === "tap_only" && pub.method === "person");
  ok("withOverride refuses an unknown tier", (() => { try { withOverride(first, { tier: "hot" }); return false; } catch { return true; } })());
  ok("verdictForThread keeps a stored AI verdict where the rules are unsure", verdictForThread({ leadCapture: { qualification: { tier: "not_relevant", method: "ai", reasonKey: "app.leads.tier.reason.ai", params: { reason: "x" } } } }, [msg("m1", "in", "My sister said you did a great job")], { templateCounts: new Map(), services: SERVICES }).tier === "not_relevant");
}

console.log(`\n${fails.length ? `FAILED — ${fails.length} of ${pass + fails.length}` : `PASSED — ${pass}/${pass} assertions`}`);
if (fails.length) {
  for (const [l] of fails) console.log(`  ✗ ${l}`);
  process.exit(1);
}
