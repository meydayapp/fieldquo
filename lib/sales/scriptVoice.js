// lib/sales/scriptVoice.js
//
// Does a generated call script sound like a person on the phone?
//
// ══ Why this exists ═══════════════════════════════════════════════════════
//
// The owner read the first AI-generated script for a real prospect and
// rewrote the opener himself. The model had written:
//
//   "…and it's about what happens after somebody's read it rather than about
//    the site itself. Is this a good time?"
//
// and he wrote:
//
//   "Hi — is that South County Electric, LLC? My name's Daniel and I'm from
//    FieldQuo. I'm calling because I've been through your website and we
//    noticed a few things that are missing that could help you bring in more
//    clients and book more jobs. Do you have a few minutes so I can show you
//    how?"
//
// His words: "missing prepositions and sentence structure that make it sound
// natural and human. We are not pitching to robots." The difference is not
// content — both sentences carry the same facts — it is register: the model
// reaches for the clever inversion ("rather than about the site itself"), the
// fragment that leans on the previous sentence, the twenty-word clause with
// no verb of its own. A rep reads it out and sounds like a script.
//
// ══ What this lints, and what it deliberately does not ════════════════════
//
// Mechanical properties only — the ones that can be counted on a sentence
// without understanding it, and that separate the two openers above:
//
//   1. a sentence over MAX_WORDS words             (a breath, not an essay)
//   2. "rather than"                               (the inversion nobody says)
//   3. "that's not why I called"                   (defensive; the model's tic)
//   4. a sentence with no finite verb              (a fragment read aloud)
//   5. "put that button on the site"               (a promise reps cannot keep;
//                                                    see lib/sales/playbook/defaults.js)
//   6. the opener and whyThemNow each cite a detail  (when there was material
//      that really is in the supplied material        to cite — see below)
//
// ══ Rule 6: the script is about THIS company, provably ═══════════════════
//
// The owner's second note: a script that could be read to any electrician in
// the state is a template. So when the prompt carried page text or
// inferences, the reply must cite, for the opener and for whyThemNow, a
// quote that appears VERBATIM in that material (whitespace and case aside)
// and that shares at least one content word with the sentence it claims to
// support — the mechanical half of "quoted or paraphrased". A quote nothing
// was given is a fact the model made up, and it fails. With no material at
// all the rule is off: the honest generic opener is the right answer, and
// the handler's note says so.
//
// Not linted: warmth, rhythm, whether a sentence is persuasive. A regex that
// claimed to know those would be a control that appears to understand
// English and does not — the same argument validatePlaybook makes for
// checking shape and not judgement.
//
// ══ The finite-verb test is a list, not a parser ═════════════════════════
//
// A real part-of-speech tagger is a dependency and a model; this is a spoken
// script of thirty sentences in a closed register. A sentence passes if it
// carries an auxiliary, a modal, a copula, a contraction that IS one ('s, 'm,
// 're, 've, 'll, 'd, n't), or one of the plain verbs of selling — bring, book,
// get, pay, show, call — in base, -s, -ed or irregular past form. What that
// misses (an unlisted verb) fails safe: the script is regenerated once and
// then, if the same fragment comes back, rejected — and the rules-built script
// underneath it still renders. What it lets through is a fragment that
// happens to contain a listed word as a noun ("The book."), which is rare in
// this register and costs nothing when it happens.
//
// Interjections of one or two words — "Thanks.", "Sure.", "Hi there." — are
// how people actually speak on the phone and are exempt from rule 4.
//
// Pure: no I/O, no clock, no model. scripts/check-call-script.mjs drives it
// with both openers above and asserts the model's fails and the owner's
// passes.

/**
 * A breath.
 *
 * The brief said twenty-eight. The owner's own opener — the ONE style example
 * the prompt carries — has a twenty-nine-word sentence in it ("I'm calling
 * because I've been through your website and we noticed a few things that
 * are missing that could help you bring in more clients and book more jobs"),
 * and a lint that rejected the sentence it holds up as the model would be
 * a control at war with its own example. Thirty is the smallest bound that
 * admits it; the model's original sentence fails on other rules anyway.
 */
export const MAX_WORDS = 30;

/**
 * The bound a sentence is REFUSED at. Thirty is what the prompt asks for;
 * forty is where a sentence stops being a breath and becomes a paragraph.
 * The gap is deliberate and it was measured: the first two live v2 drafts
 * for the owner's own prospect were both thrown away, paid for, on a
 * thirty-one-word whyThemNow and a handful of unlisted verbs — the same
 * economy the validator's paragraph bound learned on the first 73 scripts.
 * A sentence over thirty is quoted back on the retry; only one over forty
 * costs the script.
 */
export const HARD_MAX_WORDS = 40;

/**
 * The fields the fragment rule applies to: the ones a rep reads out loud.
 * `doNotSay` is a list of don'ts for the rep's eyes — "Their crew size:
 * unknown." is a fine note and a fragment — and is exempt from rule 4 only.
 * Every other rule still applies to it.
 */
export const SPOKEN_FIELDS = Object.freeze(["opener", "whatWeSaw", "whyThemNow", "threeQuestions", "objections", "closeAsk"]);

/** The phrases, as they are matched. Exported so the check can name them. */
export const VOICE_PHRASES = Object.freeze({
  rather_than: /\brather than\b/i,
  not_why_i_called: /\bthat(?:'|’)?s not why i(?:'|’)?m? ?(?:calling|called)\b|\bthat is not why i (?:am calling|called)\b/i,
  put_that_button: /\bput that button on (?:the|your) site\b/i,
});

/** Why a sentence was refused. A closed list, for the task note. */
export const VOICE_PROBLEMS = Object.freeze({
  too_long: `a sentence ran past ${HARD_MAX_WORDS} words`,
  rather_than: 'a sentence said "rather than"',
  not_why_i_called: 'a sentence said "that\'s not why I called"',
  no_finite_verb: "a sentence had no finite verb — a fragment, read aloud",
  put_that_button: 'a sentence promised to "put that button on the site"',
  no_citation: "the opener or whyThemNow cited nothing about this business, though its website was read",
  citation_not_in_source: "a citation quoted words that are not in the material the model was given",
});

/** The fields rule 6 holds to a citation. Mirrors CITED_FIELDS in callScript.js. */
export const CITED_FIELDS = Object.freeze(["opener", "whyThemNow"]);

const STOPWORDS = new Set([
  "that", "this", "with", "from", "your", "have", "been", "they", "them", "their", "there",
  "what", "when", "where", "which", "will", "would", "could", "should", "about", "into",
  "more", "than", "then", "were", "also", "just", "very", "some", "each", "other", "here",
  "call", "calling", "because", "fieldquo", "business", "company", "website", "site",
]);

const squeeze = (s) => String(s || "").toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
const contentWords = (s) =>
  new Set(
    squeeze(s)
      .replace(/[^a-z0-9' ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w)),
  );

/**
 * The material a quote may be checked against, in the form the check runs
 * on: lower-cased, curly quotes straightened, whitespace collapsed. One
 * function, because "is this quote in the text" is asked by the script
 * lint below AND by the site-inference stage
 * (lib/sales/intel/siteInference.js), and two spellings of the comparison
 * would let a quote pass one and fail the other.
 */
export function quoteMaterial(sources = []) {
  return (Array.isArray(sources) ? sources : [])
    .map((s) => ({ url: s?.url || "", text: squeeze(s?.text) }))
    .filter((s) => s.text);
}

/**
 * Where a quote appears in the material — the first source whose text
 * contains it, or null when no source does.
 *
 * Verbatim after squeezing: the model may not paraphrase a citation. A
 * quote with nothing to match, or an empty material, is null; the caller
 * decides whether that is a rejection (the script lint) or a dropped row
 * (the inference stage).
 */
export function findQuoteSource(quote, sources = []) {
  const q = squeeze(quote);
  if (!q) return null;
  // squeeze() is idempotent, so material that was already squeezed by the
  // caller passes through unchanged. Four pages a call; not worth a flag.
  return quoteMaterial(sources).find((m) => m.text.includes(q)) || null;
}

/**
 * Rule 6, on its own so the check can drive it directly.
 *
 * @param script   the validated script, with `citations`
 * @param sources  [{ url, text }] — the material the model was given
 * @returns { ok, problems, findings }  same shape as voiceLint's
 */
export function lintCitations(script, sources = [], { ignoreWords = [] } = {}) {
  const findings = [];
  const material = quoteMaterial(sources);
  if (!material.length) return { ok: true, problems: [], findings };
  // The business's own name is in every opener and on every page, so a
  // quote that shares only that with the sentence has not been used by it.
  const ignore = new Set((Array.isArray(ignoreWords) ? ignoreWords : []).flatMap((w) => [...contentWords(w)]));

  const citations = Array.isArray(script?.citations) ? script.citations : [];
  const verified = new Set();
  for (const c of citations) {
    const quote = squeeze(c?.quote);
    const field = String(c?.field || "");
    if (!quote || !field) continue;
    const inSource = findQuoteSource(quote, material) !== null;
    if (!inSource) {
      findings.push({ field: `citations.${field}`, sentence: c.quote, problems: ["citation_not_in_source"] });
      continue;
    }
    // "Quoted or paraphrased": the sentence the citation supports has to
    // share a content word with the quote. A citation attached to a field
    // that never mentions it is decoration.
    const target = typeof script?.[field] === "string" ? script[field] : "";
    const targetWords = contentWords(target);
    const shared = [...contentWords(quote)].some((w) => !ignore.has(w) && targetWords.has(w));
    if (shared) verified.add(field);
  }
  for (const field of CITED_FIELDS) {
    if (!verified.has(field)) {
      findings.push({ field, sentence: typeof script?.[field] === "string" ? script[field].slice(0, 160) : "", problems: ["no_citation"] });
    }
  }
  const problems = [];
  if (findings.some((f) => f.problems.includes("citation_not_in_source"))) problems.push("citation_not_in_source");
  if (findings.some((f) => f.problems.includes("no_citation"))) problems.push("no_citation");
  return { ok: findings.length === 0, problems, findings };
}

// ── The finite-verb list ───────────────────────────────────────────────────
//
// Auxiliaries, modals and copulas first: any one of these makes a clause
// finite on its own.
const AUX = [
  "am", "is", "are", "was", "were", "be", "been", "being",
  "do", "does", "did", "have", "has", "had",
  "can", "could", "will", "would", "shall", "should", "may", "might", "must",
  "let", "lets",
];

// The plain verbs of a sales call. Each is listed in the base form; the
// -s, -es, -ed and -ing forms are derived below, and irregular pasts are
// listed by hand because "brought" is not "bring" + anything.
const BASE = [
  "bring", "book", "get", "pay", "send", "show", "call", "ring", "phone", "want",
  "need", "know", "see", "look", "take", "give", "help", "work", "run", "go",
  "come", "ask", "say", "tell", "use", "find", "keep", "think", "mean", "sound",
  "happen", "notice", "read", "hear", "pick", "put", "make", "try", "check",
  "fix", "sit", "stand", "cost", "save", "lose", "win", "sign", "start", "stop",
  "miss", "spend", "talk", "speak", "wait", "leave", "move", "turn", "answer",
  "quote", "price", "charge", "handle", "deal", "matter", "depend", "agree",
  "mind", "like", "love", "hate", "hope", "guess", "wonder", "suppose", "bet",
  "reach", "land", "arrive", "open", "close", "click", "type", "write", "fill",
  "chase", "follow", "remember", "forget", "decide", "choose", "prefer",
  "carry", "hold", "hand", "drop", "pass", "catch", "walk", "drive", "measure",
  "build", "set", "add", "change", "compare", "review", "email", "text",
  "live", "thank", "appreciate", "understand", "worry", "care", "count",
  "grow", "manage", "own", "hire", "seem", "feel", "become", "stay", "end",
  "begin", "finish", "sell", "buy", "cover", "search", "google", "scroll",
  "convert", "trust", "expect", "plan", "schedule", "confirm", "cancel",
  "shift", "suit", "fit", "belong", "involve", "include", "require", "allow",
  "sort", "figure", "walk", "mention", "explain", "describe", "promise",
  // What a website "does", as a rep describes it: the site lists, offers,
  // shows, provides, serves. Added after the first live v2 drafts were
  // refused for these.
  "list", "offer", "feature", "display", "provide", "serve", "operate", "advertise",
  "highlight", "name", "link", "point", "state", "claim", "specialise", "specialize",
  "focus", "promote", "present", "publish", "post", "accept", "respond", "reply",
  "contact", "request", "submit", "invoice", "bill", "collect", "deliver", "repair",
  "replace", "wire", "upgrade", "maintain", "inspect", "design", "paint", "clean",
  "remove", "haul", "seal", "estimate", "note", "appear", "tend", "rely", "lead",
  "refer", "recommend", "rate", "employ", "staff", "train", "guarantee", "exist",
  "treat", "view", "visit", "browse", "greet", "welcome", "direct", "invite",
  "encourage", "push", "pull", "tap", "press", "load", "redirect", "route", "hide",
  "bury", "lack", "seek", "target", "cater", "supply", "stock", "ship", "book",
  "reserve", "warn", "remind", "suggest", "imply", "assume", "claim", "boast",
  "show", "tell", "let", "avoid", "skip", "waste", "risk", "stall", "delay",
];

const IRREGULAR_PAST = [
  "brought", "got", "gotten", "paid", "sent", "showed", "shown", "rang", "rung",
  "took", "taken", "gave", "given", "ran", "went", "gone", "came", "said",
  "told", "found", "kept", "thought", "meant", "heard", "read", "made", "lost",
  "won", "spent", "spoke", "spoken", "left", "sat", "stood", "cost", "built",
  "held", "caught", "drove", "driven", "wrote", "written", "felt", "became",
  "began", "begun", "sold", "bought", "chose", "chosen", "forgot", "forgotten",
  "understood", "knew", "known", "saw", "seen", "grew", "grown", "fell",
  "fallen", "hit", "let", "put", "set", "shut", "cut", "quit", "lit", "led",
  "fed", "met", "dealt", "dug", "hung", "stuck", "struck", "swung", "flew",
  "threw", "thrown", "woke", "woken", "wore", "worn", "tore", "torn",
];

function inflect(base) {
  const forms = new Set([base]);
  if (base.endsWith("y") && !/[aeiou]y$/.test(base)) {
    const stem = base.slice(0, -1);
    forms.add(`${stem}ies`);
    forms.add(`${stem}ied`);
  } else if (/(?:s|x|z|ch|sh)$/.test(base)) {
    forms.add(`${base}es`);
    forms.add(`${base}ed`);
  } else if (base.endsWith("e")) {
    forms.add(`${base}s`);
    forms.add(`${base}d`);
  } else {
    forms.add(`${base}s`);
    forms.add(`${base}ed`);
    // Doubled consonant: stop → stopped, plan → planned, fit → fitted.
    if (/[^aeiou][aeiou][^aeiouwxy]$/.test(base)) forms.add(`${base}${base.at(-1)}ed`);
  }
  return [...forms];
}

/** Every token that makes a clause finite. Frozen, for the check. */
export const FINITE_VERBS = Object.freeze(
  new Set([...AUX, ...IRREGULAR_PAST, ...BASE.flatMap(inflect)]),
);

// A contraction that is itself a finite verb: I'm, you're, we've, it's, I'll,
// I'd, don't, isn't. Matched on the token before the apostrophe is split off,
// so "somebody's read it" (has) and "it's about" (is) both count.
const CONTRACTION = /(?:'|’)(?:s|m|re|ve|ll|d|t)$/i;

/**
 * Split spoken prose into sentences.
 *
 * On ., !, ? and … — and on the em dash ONLY when both sides are long enough
 * to be sentences on their own; a short aside ("— it's a job site, it
 * happens —") stays inside its sentence, which is what the word count then
 * measures. Abbreviations the register actually uses (LLC, Inc, Ltd, Mr, Mrs,
 * St, vs, e.g.) do not split.
 */
export function splitSentences(text) {
  const s = typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
  if (!s) return [];
  const protectedText = s.replace(/\b(LLC|Inc|Ltd|Co|Mr|Mrs|Ms|Dr|St|vs|e\.g|i\.e)\./gi, (m) => m.replace(".", " "));
  return protectedText
    .split(/(?<=[.!?…])\s+/)
    .map((part) => part.replace(/ /g, ".").trim())
    .filter(Boolean);
}

/** The words of a sentence, as a person would count them. */
export function wordCount(sentence) {
  return String(sentence || "")
    .replace(/[—–-]/g, " ")
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w)).length;
}

/**
 * Does this sentence carry a finite verb?
 *
 * See the header for what the test is and is not. Interjections of one or
 * two words are how people speak and are exempt.
 */
export function hasFiniteVerb(sentence) {
  const raw = String(sentence || "");
  const tokens = raw
    .toLowerCase()
    .replace(/[—–]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-z']+|[^a-z']+$/g, ""))
    .filter(Boolean);
  if (tokens.length <= 2) return true;
  for (const tok of tokens) {
    if (CONTRACTION.test(tok)) return true;
    const bare = tok.replace(/(?:'|’).*$/, "");
    if (FINITE_VERBS.has(bare)) return true;
  }
  return false;
}

/**
 * Lint one sentence. Returns the problem codes it trips, in the order of
 * VOICE_PROBLEMS. Empty means it passes.
 */
export function lintSentence(sentence, { spoken = true } = {}) {
  const problems = [];
  const s = String(sentence || "");
  if (wordCount(s) > HARD_MAX_WORDS) problems.push("too_long");
  if (VOICE_PHRASES.rather_than.test(s)) problems.push("rather_than");
  if (VOICE_PHRASES.not_why_i_called.test(s)) problems.push("not_why_i_called");
  if (spoken && !hasFiniteVerb(s)) problems.push("no_finite_verb");
  if (VOICE_PHRASES.put_that_button.test(s)) problems.push("put_that_button");
  return problems;
}

/**
 * The sentences the retry note quotes without refusing the draft: over the
 * asked-for length but under the hard bound. Advice, not a verdict.
 */
export function longSentences(script) {
  const out = [];
  const walk = (value, path) => {
    if (path === "citations") return;
    if (typeof value === "string") {
      for (const sentence of splitSentences(value)) {
        const n = wordCount(sentence);
        if (n > MAX_WORDS && n <= HARD_MAX_WORDS) out.push({ field: path, sentence, words: n });
      }
    } else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${i}]`));
    else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k);
  };
  walk(script, "");
  return out;
}

/**
 * Walk a script — the validated ProspectCallScript shape, or any nested
 * object of strings — and lint every sentence in every string.
 *
 * @returns { ok, problems: [code], findings: [{ field, sentence, problems }] }
 *
 * `findings` names the field and the sentence so the regeneration prompt
 * can quote exactly what was wrong, and so a task note can say "opener:
 * a sentence ran past 28 words" rather than "voice".
 */
export function voiceLint(script, { sources = [], ignoreWords = [] } = {}) {
  const findings = [];
  const seen = new Set();
  const walk = (value, path) => {
    // Citations are quotes of the source and are judged by lintCitations,
    // not by the sentence rules: a quote is allowed to be a fragment.
    if (path === "citations") return;
    if (typeof value === "string") {
      const top = path.split(/[.[]/)[0];
      const spoken = SPOKEN_FIELDS.includes(top);
      for (const sentence of splitSentences(value)) {
        const problems = lintSentence(sentence, { spoken });
        if (problems.length) {
          findings.push({ field: path, sentence, problems });
          for (const p of problems) seen.add(p);
        }
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk(script, "");
  const cited = lintCitations(script, sources, { ignoreWords });
  findings.push(...cited.findings);
  for (const p of cited.problems) seen.add(p);
  const problems = Object.keys(VOICE_PROBLEMS).filter((p) => seen.has(p));
  return { ok: findings.length === 0, problems, findings };
}

/**
 * The sentence appended to the prompt when a draft failed the lint, so the
 * second attempt is told what to fix rather than asked to guess. Sentences
 * are quoted so the model can find them; at most `limit` of them, because
 * the point is the correction, not a transcript.
 */
export function voiceRetryNote(lint, { limit = 6, long = [] } = {}) {
  const lines = (lint?.findings || []).slice(0, limit).map((f) => {
    const why = f.problems.map((p) => VOICE_PROBLEMS[p] || p).join("; ");
    return `- ${f.field}: "${f.sentence}" — ${why}`;
  });
  // Over the asked-for length but under the bound: quoted as advice on the
  // retry, since the draft is being rewritten anyway.
  for (const l of (Array.isArray(long) ? long : []).slice(0, 4)) {
    lines.push(`- ${l.field}: "${l.sentence}" — ${l.words} words; split it, ${MAX_WORDS} or fewer each`);
  }
  if (!lines.length) return "";
  return [
    "YOUR PREVIOUS DRAFT DID NOT SOUND LIKE A PERSON. Fix these and keep everything else:",
    ...lines,
    `Every sentence: ${MAX_WORDS} words or fewer, a subject and a verb, no "rather than", nothing about putting anything on their site.`,
    "The opener and whyThemNow must each use a detail from THEIR OWN WEBSITE or WHAT WE INFERRED, and cite it with the exact words.",
  ].join("\n");
}
