// lib/sales/playbook/defaults.js
//
// The four starter playbooks, and the words a rep actually says.
//
// ══ Seeds, exactly like lib/sales/intel/rules.js ══════════════════════════
//
// Written here and then living in the database, editable by a superadmin. The
// selector, the priority and the nine stage bodies are all rows. What is NOT
// editable is the selector VOCABULARY (selectors.js), the stage list
// (stages.js) or the evidence gate (talkingPoints.js) — a superadmin may
// decide what a rep says to somebody with no booking page; they may not decide
// that a claim can go out with nothing behind it.
//
// ══ Why exactly these four, and no fifth "general" one ════════════════════
//
// The brief names four rules and they map one-to-one onto the four
// OpportunityRule families that already exist. There is deliberately no
// fallback playbook that matches everybody: a playbook that opens when nothing
// has been observed is a rep phoning a stranger with a script that claims to
// know something about them. `selectPlaybook` returns no selection and the
// reason "nothing has been observed about this business yet", which is the
// true sentence and the one that sends somebody to run the crawl rather than
// to make a call.
//
// ══ The variables, and the one rule about them ═══════════════════════════
//
// A line may interpolate any of PLAYBOOK_VARS, and `{competitor}` may appear
// ONLY in a playbook whose selector requires a competitor. Anywhere else it is
// a line that renders with a hole in it, live, on a call — which is why
// `validatePlaybook` refuses it at write time rather than `renderLine` failing
// at read time. Same argument as `unresolved_reason` in
// lib/sales/intel/opportunity.js.
import { STAGE_KEYS } from "./stages";
import { selector } from "./selectors";

/** Everything a playbook line may name. Nothing else resolves. */
export const PLAYBOOK_VARS = Object.freeze([
  "businessName",
  "city",
  "tradeName",
  "competitor",
  "repName",
]);

/** Only a competitor-gated playbook may say this word. See the header. */
export const COMPETITOR_VARS = Object.freeze(["competitor"]);

export const MAX_SAY = 900;
export const MAX_PROMPT = 220;
export const MAX_PROMPTS = 8;

/**
 * The four.
 *
 * Priorities match the OpportunityRule families they pair with (100 / 90 / 80 /
 * 70) so a superadmin reading both screens sees the same ordering twice rather
 * than two numbers to reconcile.
 */
const PLAYBOOKS = [
  {
    key: "COMPETITIVE_DISPLACEMENT",
    name: "Competitive displacement",
    selectorKey: "competitor_detected",
    priority: 100,
    stages: {
      open: {
        say:
          "Hi — is that {businessName}? It's {repName} at FieldQuo. I'll be ninety seconds and " +
          "then you can tell me to go away. Have I caught you on site?",
        prompts: [],
      },
      relevance: {
        say:
          "I had a look before I rang and you're already running {competitor}, so I'm not going " +
          "to tell you that you need a scheduler. There's one thing it doesn't do and that's the " +
          "only reason I called.",
        prompts: [],
      },
      discovery: {
        say: "",
        prompts: [
          "How many of you are on the tools at the moment?",
          "What's the mix — is it mostly repeat work, or are you still bidding?",
          "How far out are you booked?",
        ],
      },
      current_process: {
        say:
          "You're the one who knows how this actually runs. Whatever I could see from outside is " +
          "a guess.",
        prompts: [
          "When a homeowner rings, what happens between that call and a quote landing with them?",
          "Who writes the quote, and when — evenings?",
          "Does {competitor} do the whole thing, or are there bits still in a notebook?",
        ],
      },
      pain: {
        say: "",
        prompts: [
          "Which part of that is the one that annoys you?",
          "How often does a quote go out later than you meant it to?",
          "When a homeowner opens your quote, whose name is on it?",
        ],
      },
      fit: {
        say:
          "That last one is the whole of my pitch, so I'll say it once: everything the homeowner " +
          "sees is yours. Your logo, your colour, your name in the from line, your domain. " +
          "Nobody comparing three quotes can tell that two of them run the same software.",
        prompts: [],
      },
      objections: { say: "", prompts: [] },
      next_step: {
        say:
          "I'm not asking you to move anything. What I'd like is to put your logo and your colour " +
          "on a real quote, send it to you, and let you look at it next to the one you sent last " +
          "week. Fifteen minutes, and you pick the day.",
        prompts: [],
      },
      close: {
        say:
          "So — Thursday, and I'll send the quote across before then so you've already seen it. " +
          "If it doesn't look better than what you send now, say so and that's the end of it. " +
          "Thanks for the ninety seconds.",
        prompts: [],
      },
    },
  },

  {
    key: "ONLINE_PRESENCE",
    name: "Online presence — no website",
    selectorKey: "no_website",
    priority: 90,
    stages: {
      open: {
        say:
          "Hi — {businessName}? It's {repName} at FieldQuo. Two minutes, and it's about where " +
          "your work comes from rather than anything technical. All right?",
        prompts: [],
      },
      relevance: {
        say:
          "I went looking for you online before I rang, the way a homeowner would, and I couldn't " +
          "find a site. Your number's out there, so people who already know your name will find " +
          "you. It's the ones who don't that I'm ringing about.",
        prompts: [],
      },
      discovery: {
        say: "",
        prompts: [
          "Where does most of your work come from at the moment?",
          "How many of you are there?",
          "How far will you travel for a job?",
        ],
      },
      current_process: {
        say: "",
        prompts: [
          "When somebody wants a price, what do they do — ring you?",
          "How do they find the number in the first place?",
          "Have you ever had somebody say they nearly went elsewhere because they couldn't find you?",
        ],
      },
      pain: {
        say: "",
        prompts: [
          "How many of those calls come in while you're on a job?",
          "What happens to the ones you can't answer?",
          "Do you ever get asked for photos of previous work?",
        ],
      },
      fit: {
        say:
          "The short version: we build the site out of the jobs you've already done, on your own " +
          "domain, and it takes an afternoon rather than a project. You don't write anything.",
        prompts: [],
      },
      objections: { say: "", prompts: [] },
      next_step: {
        say:
          "Here's what I'd like to do. Send me three photos of a job you're proud of and I'll " +
          "have a site to show you by Thursday, with your name on it. If you hate it, you've lost " +
          "the time it took to send three photos.",
        prompts: [],
      },
      close: {
        say:
          "Right — three photos to the number I'm ringing from, and I'll call you Thursday " +
          "morning. Thanks for your time.",
        prompts: [],
      },
    },
  },

  {
    key: "BOOKING_GAP",
    name: "Booking gap — a website with no way to book",
    selectorKey: "website_without_booking",
    priority: 80,
    stages: {
      open: {
        say:
          "Hi — is that {businessName}? {repName} at FieldQuo. Ninety seconds about your website, " +
          "and I've actually looked at it. Have you got a minute?",
        prompts: [],
      },
      relevance: {
        say:
          "The site's fine — that's not why I'm ringing. What it doesn't have is any way for " +
          "somebody to get themselves into your diary. Everything on it ends with 'give us a ring'.",
        prompts: [],
      },
      discovery: {
        say: "",
        prompts: [
          "How many enquiries would you say the site brings you in a week?",
          "Who takes the calls when you're out?",
          "Are you booking site visits, or quoting off photos?",
        ],
      },
      current_process: {
        say: "",
        prompts: [
          "So somebody's on the site at nine at night — what do they do next?",
          "How many messages does it take to settle on a time to come and measure?",
          "Does anything go in a calendar, or is it in your head?",
        ],
      },
      pain: {
        say: "",
        prompts: [
          "How many of those go quiet before you've agreed a time?",
          "Do you know how many people land on that site and leave?",
        ],
      },
      fit: {
        say:
          "Nobody's booking a kitchen off a form, and I'm not suggesting it. What gets booked is " +
          "you turning up to measure — a slot, an address, the photos already attached, and no " +
          "four-text conversation to arrange it.",
        prompts: [],
      },
      objections: { say: "", prompts: [] },
      next_step: {
        say:
          "Give me fifteen minutes and I'll put a booking page on your existing site — you keep " +
          "the site, it just gains a button. You pick the hours you'll accept.",
        prompts: [],
      },
      close: {
        say:
          "Thursday at eight, before you're out. I'll send the link so you can see it first. " +
          "Cheers.",
        prompts: [],
      },
    },
  },

  {
    key: "QUOTE_AUTOMATION",
    name: "Quote automation — enquiries arrive as email",
    selectorKey: "email_only_quote_request",
    priority: 70,
    stages: {
      open: {
        say:
          "Hi — {businessName}? It's {repName} at FieldQuo. Ninety seconds about how quotes come " +
          "in to you. Is now bad?",
        prompts: [],
      },
      relevance: {
        say:
          "Your site's got your email on it and nothing else — no form, no questions. So every " +
          "enquiry arrives as somebody's free text, and you're the one who has to write back and " +
          "ask the same four things.",
        prompts: [],
      },
      discovery: {
        say: "",
        prompts: [
          "Roughly how many enquiries a week land in that inbox?",
          "What do you always end up having to ask them?",
          "Who else sees that inbox?",
        ],
      },
      current_process: {
        say: "",
        prompts: [
          "Walk me through it — email arrives, then what?",
          "How long is it usually before you reply?",
          "How do you keep track of which ones you've answered?",
        ],
      },
      pain: {
        say: "",
        prompts: [
          "How many go cold while they're waiting?",
          "Have you ever quoted the same job twice because you'd lost the first one?",
        ],
      },
      fit: {
        say:
          "A form asks the four things you always end up asking. What comes back isn't a note in " +
          "an inbox, it's a job in a list — with the answers and the photos on it, one click from " +
          "a quote you can send from the van.",
        prompts: [],
      },
      objections: { say: "", prompts: [] },
      next_step: {
        say:
          "Tell me the four questions you always ask and I'll build the form round them, on the " +
          "site you already have. Fifteen minutes, and you'll see what comes out the other end.",
        prompts: [],
      },
      close: {
        say:
          "Thursday morning then. Send me the four questions whenever they come to you. Thanks " +
          "for your time.",
        prompts: [],
      },
    },
  },
];

/** Why a playbook row cannot be written. */
export const PLAYBOOK_PROBLEMS = Object.freeze({
  no_key: "A playbook needs a key. It is stamped on every assignment and every stored point.",
  no_name: "A playbook needs a name — it is what the list is scanned by.",
  unknown_selector:
    "The playbook names a selection rule this engine does not implement, so it could never open.",
  no_selector: "A playbook needs a selection rule. Without one nothing would ever choose it.",
  competitor_var_without_competitor_rule:
    "A line names {competitor}, and this playbook can open on a prospect with no competitor detected. That line would be read out with a hole in it.",
  unknown_var:
    "A line names a variable nothing supplies, so it would render with a hole in it on a call.",
  unknown_stage: "The playbook carries a stage that does not exist.",
  say_too_long: "A stage's script is longer than anybody reads aloud.",
  prompt_too_long: "A prompt is a question, not a paragraph.",
  too_many_prompts: "More questions than a rep asks in one stage.",
  empty_playbook: "The playbook has no stages at all.",
});

/** Every `{var}` in a string. */
export function varsIn(text) {
  const out = [];
  for (const m of String(text ?? "").matchAll(/\{(\w+)\}/g)) out.push(m[1]);
  return [...new Set(out)];
}

/**
 * Is this playbook writable?
 *
 * Runs at seed time AND on every superadmin save, which is the point: a
 * playbook that saves cleanly and then renders a hole mid-call is the dead
 * control this codebase has been swept for repeatedly.
 */
export function validatePlaybook(row) {
  const problems = [];
  if (!row?.key) problems.push("no_key");
  if (!row?.name || !String(row.name).trim()) problems.push("no_name");

  if (!row?.selectorKey) problems.push("no_selector");
  const def = row?.selectorKey ? selector(row.selectorKey) : null;
  if (row?.selectorKey && !def) problems.push("unknown_selector");

  const stages = Array.isArray(row?.stages) ? row.stages : [];
  if (stages.length === 0) problems.push("empty_playbook");

  for (const s of stages) {
    if (!STAGE_KEYS.includes(s?.stageKey)) {
      problems.push("unknown_stage");
      continue;
    }
    const say = typeof s.say === "string" ? s.say : "";
    if (say.length > MAX_SAY) problems.push("say_too_long");

    const prompts = Array.isArray(s.prompts) ? s.prompts : [];
    if (prompts.length > MAX_PROMPTS) problems.push("too_many_prompts");
    for (const p of prompts) {
      if (typeof p === "string" && p.length > MAX_PROMPT) problems.push("prompt_too_long");
    }

    for (const v of [...varsIn(say), ...prompts.flatMap((p) => varsIn(p))]) {
      if (!PLAYBOOK_VARS.includes(v)) {
        problems.push("unknown_var");
        continue;
      }
      // The one cross-field rule, and the reason it is checked here rather
      // than at render: a playbook that can open without a competitor may not
      // contain a sentence that only makes sense with one.
      if (COMPETITOR_VARS.includes(v) && def?.needsCompetitor !== true) {
        problems.push("competitor_var_without_competitor_rule");
      }
    }
  }

  return { ok: problems.length === 0, problems: [...new Set(problems)] };
}

/**
 * The starter rows, validated before anybody sees them. Throws rather than
 * filtering — see seedOpportunityRules for the argument.
 */
export function seedPlaybooks() {
  const rows = PLAYBOOKS.map((p) => ({
    key: p.key,
    name: p.name,
    selectorKey: p.selectorKey,
    priority: p.priority,
    active: true,
    version: "1",
    stages: STAGE_KEYS.map((stageKey) => ({
      stageKey,
      say: p.stages[stageKey]?.say ?? "",
      prompts: [...(p.stages[stageKey]?.prompts ?? [])],
    })),
  }));

  const problems = [];
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.key)) problems.push(`${row.key}: duplicate playbook key`);
    seen.add(row.key);
    const { ok, problems: found } = validatePlaybook(row);
    if (!ok) problems.push(`${row.key}: ${found.join(", ")}`);
  }
  if (problems.length) throw new Error(`seedPlaybooks: ${problems.join("; ")}`);
  return rows;
}
