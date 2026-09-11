// lib/sales/playbook/defaults.js
//
// The four starter playbooks, and the words a rep actually says.
//
// ══ These scripts were REBUILT from the selling literature ════════════════
//
// The first version of this file was written by imagining what a sales call
// sounds like, and it reproduced, almost line for line, the openers the
// textbooks name as failures. It was deleted rather than patched. Every
// sentence below is here because a source says so, and every stage carries the
// source and the finding in a comment — so that a future editor rewriting one
// line has to argue with the finding rather than with somebody's taste.
//
// The sources, and what each contributes:
//
//   - Saylor / Richmond, *The Power of Selling*, ch.9 (the approach) and ch.13.
//     Fifteen seconds to win the customer. Name, company and purpose inside
//     twenty seconds. Connect inside thirty. Credibility comes from what you
//     know about THEM, not from your own credentials (Thull). Permission is
//     asked and phrased so YES is the helpful answer. The survey approach — an
//     opening that asks only for information, no services and no costs — is
//     named as the non-threatening one. And the number the whole close rests
//     on: 81% of sales happen on or after the FIFTH call.
//   - Futrell, *Fundamentals of Selling* 12e, ch.10 and ch.12. Questions beat
//     statements in an opening, because only a question uncovers a need. Never
//     phrase a question so that a single word ends the conversation — he calls
//     it hanging up the telephone on yourself. Never apologise for taking their
//     time. Never imply the call was unplanned. Do not name the product before
//     a need is perceived. Forestall the likely objection: a prospect who has
//     said an objection out loud is then obliged to defend it. Twelfth key to a
//     close: leave the door open.
//   - Barron, *Selling Made Simple*. The only goal of cold outreach is the next
//     meeting — no pitching, no pricing, no problem analysis. Ask for something
//     small and specific.
//   - Cialdini, *Influence*. Chapter 6: an expert who volunteers a real cost to
//     themselves buys trustworthiness faster than any credential, and that is
//     the ONE move available to a stranger inside thirty seconds. Chapter 7:
//     the same true fact persuades more stated as a loss than as a gain.
//     Chapter 1 (via Langer): give a reason — but the placebic reason collapses
//     as the ask grows, so the reason here is real and specific to the business.
//   - Godin, *This Is Marketing*. Used honestly: he never writes the phrase
//     "cold call" and is hostile to interruption, so nothing below claims his
//     endorsement. What he does supply is the Ziglar passage — take a room in
//     town, show up five to seven times over a month, build a human bridge
//     instead of skimming the easy sales — which is exactly a trade territory;
//     the stamp arithmetic (measure every step against lifetime value); the
//     distinction between tension and fear; and the finding that 80% of people
//     who hire a broker pick the first one to call them back.
//   - The owner's own twenty TrueFinish conversations. A contractor will not
//     confess a problem to a stranger — every admission costs them something —
//     but they will correct you when you are wrong about their business. So
//     discovery states a guess and invites the correction. And in that corpus
//     not one win closed on first contact; the biggest recovered deal came from
//     a follow-up months later.
//
// ══ What is deliberately NOT used ════════════════════════════════════════
//
// Cialdini's own thresholds rule these out inside a first call, and a script
// that reached for them would be reaching for the mimicry his book teaches
// people to detect:
//
//   - LIKING. His alarm threshold is twenty-five minutes. Manufactured
//     similarity, mirrored speech and warmth-on-arrival are the cheap versions
//     and they are what a contractor is braced for.
//   - FLATTERY. The North Carolina study is the reason: praise works when it is
//     false and works when the target knows the flatterer wants something. That
//     combination makes it the most tempting move here and the least defensible.
//   - COMMITMENT AND CONSISTENCY. Foot-in-the-door needs a prior commitment and
//     there is none. A yes squeezed out of a leading question in the first
//     minute meets none of his four conditions and is pressure wearing its
//     clothes.
//   - RECIPROCATION. We have given nothing. A call is a cost to the person who
//     answers it, not a gift.
//   - DOOR-IN-THE-FACE. Structurally it fits ninety seconds, which is exactly
//     why it is tempting. It needs an opening ask we would genuinely accept,
//     and Bar-Ilan's finding is that an opener read as unreasonable destroys
//     the good faith the retreat depends on. A cold caller starts with less
//     good faith than anyone.
//   - MANUFACTURED SCARCITY, invented deadlines, counterfeit social proof.
//     Named as fraud. There is no real scarcity in a software subscription and
//     no other tenant's data may be quoted (AGENTS.md non-negotiable 8).
//
// The concession in each RELEVANCE stage is the one Cialdini move that IS
// available, and it is honest only while it is true and costly. Vincent the
// waiter is in the book as a TRICK because his weakness was fabricated and his
// conceded drawback was engineered to be painless. The test each of these has
// to pass: could this sentence lose the call? If it cannot, it is theatre.
// scripts/check-playbook-copy.mjs pins them one by one for that reason.
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
// ══ The variables, and the two rules about them ══════════════════════════
//
// A line may interpolate any of PLAYBOOK_VARS, and `{competitor}` may appear
// ONLY in a playbook whose selector requires a competitor. Anywhere else it is
// a line that renders with a hole in it, live, on a call — which is why
// `validatePlaybook` refuses it at write time rather than `renderLine` failing
// at read time. Same argument as `unresolved_reason` in
// lib/sales/intel/opportunity.js.
//
// The second rule is a judgement rather than a check, and it is why nothing
// below says `{city}` or `{tradeName}`: those two come from a third-party
// directory and are often absent, and `renderLine` correctly refuses a line it
// cannot fill. A refused RELEVANCE line costs a sentence. A refused OPEN line
// costs the call, because the rep has nothing to say at the second the call
// connects. `{businessName}` and `{repName}` are the only two that are always
// there. A superadmin may still use the others further down a script.
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

// ══ The opener the owner corrected, and why it is three constants ═════════
//
// The four openers used to state the reason for the call in the first breath:
// "I'm calling because I went through your website this morning…". That is
// what Saylor ch.9 prescribes and it is not wrong — but the owner listened to
// it and named what it sounds like on a phone in a van: a SaaS salesperson
// with a script. His correction, in his words, is that the first call should
// open by asking for permission, then ask a question about the contractor's
// own day, and only then give the reason — attached to what they just said:
//
//   Rep:  "Hey Mike, Emilio calling from FieldQuo. I know I'm catching you out
//          of nowhere — can I take 30 seconds to tell you why I called?"
//   Him:  "Sure."
//   Rep:  "Thanks. Quick question first — when you go look at a job, are you
//          usually able to give the customer the quote while you're there, or
//          do you have to go home and put everything together afterward?"
//   Him:  "Usually later that night."
//   Rep:  "That's actually exactly why I'm calling."
//
// Cognism's cold-call scripts (Frida Ottosson's, the ones the owner pointed
// at) reach the same shape from the data side: their opener after a transfer
// is a PERMISSION-BASED one — "have you got 30 seconds?" — and their discovery
// rule is 70% prospect, 30% rep, which an opener that spends its first breath
// explaining itself cannot hit.
//
// ══ This is not the banned time-limit promise, and the line is sharp ══════
//
// SCRIPT-PRINCIPLES.md §6 bans "I promise I'm not going to waste your time"
// on Saylor's finding that it suggests you are somebody who might. A reader
// who stops there will delete the constant below, so the distinction is
// written down rather than left to taste:
//
//   BANNED — a promise about the REP'S behaviour, volunteered, unasked:
//     "I'll be ninety seconds", "I won't waste your time", "I'll be quick".
//     It is defensive, it is about us, and the prospect never gets a turn.
//
//   PERMITTED — a QUESTION that hands the prospect control and names the size
//     of what is being asked for, so a yes is cheap and a no is real:
//     "Can I give you thirty seconds on why I called?"
//
// The first says what we will do. The second asks what they will allow. The
// detector in scripts/check-playbook-copy.mjs is written on that difference
// and is mutation-tested against both spellings, because they are one word
// apart and the ban is easy to reintroduce by accident.
//
// ══ The next step is a demo, and the rep is not tech support ══════════════
//
// The next_step stages used to promise work: "I'll put that button on the
// site you already have", "I'll build one real quote with your name on it",
// "I'll build the form round them". The owner's rule, on reading the booking
// script: reps are not tech support. A rep cannot put anything on a
// contractor's website and must not say they will. So every next step is now
// the same offer — fifteen minutes on a screen, "I can show you in fifteen
// minutes how it works for a business like yours" — and NEXT_STEP_OFFER is
// the one string the four carry, for the reason OPENER is one string.
//
// ══ No day and no time in the close ═══════════════════════════════════════
//
// "Thursday at eight then, before you're out" was a rule line a rep read out
// loud, whatever day it was. The close now proposes the booking and lets the
// rep read the slot off their own calendar: "What works better for you,
// mornings or afternoons?" — and the invite and the reminder are what the
// calendar sends. scripts/check-playbook-voice.mjs holds every close to it:
// no weekday name, no clock time.
//
// ══ Why these are constants and not four hand-written lines ═══════════════
//
// AGENTS.md failure class 4. Four copies of one sentence is four sentences
// that drift, and the copy that rots is the one nobody re-reads. One string,
// four uses, and the check asserts every opener ends with it.

/**
 * The permission ask that closes every opener.
 *
 * Three things it has to be, all asserted: a question (so the prospect is the
 * one who decides), phrased so YES is the helpful answer (Saylor's rule —
 * "did I catch you at a bad time" is answered by agreeing, and agreeing ends
 * the call), and specific about what the thirty seconds buys them, which is
 * the REASON. Deferring the reason by one beat is the whole of the owner's
 * correction; dropping it would be a different and much worse change.
 */
export const PERMISSION_ASK = "Can I give you thirty seconds on why I called?";

/**
 * The candour line that earns the permission ask.
 *
 * Cialdini ch.6: a true admission against your own interest is the fastest
 * trust available to a stranger, and it is the ONE move that survives a phone
 * line. "You do not know me and I have come at you out of nowhere" is simply
 * true, and saying it first is what separates this from the flattery and the
 * manufactured similarity a contractor is braced for.
 *
 * It is a STATEMENT, deliberately, and that is what keeps it out of Saylor's
 * bad-time ban: "did I catch you at a bad time?" is a question a single word
 * ends. This hands them nothing to end with — the only question in the opener
 * is the one phrased for a yes.
 */
export const CANDOUR = "I know I'm catching you out of nowhere";

/**
 * The pivot, said the moment the contractor has described their own day.
 *
 * The owner's sentence, and the reason the reason moved: a fact about their
 * business is a stronger reason when it answers something they just said than
 * when it opens the call. Langer, Blank & Chanowitz's twenty-page condition is
 * the licence — a placebic reason collapses as the ask grows, and a meeting is
 * a large ask, so the reason has to carry information. Nothing carries more
 * information than the words they used thirty seconds ago.
 *
 * BOTH BRANCHES ARE SPOKEN. A pivot that only works when the prospect gives
 * the expected answer is a dead control — the rep reads it out, the contractor
 * says "no, I price it on the spot", and the script has nothing. So the line
 * is conditional out loud, and it is true either way round.
 */
export const PIVOT =
  "If that's how it goes, that's exactly why I'm calling. And if I've got it wrong — if it " +
  "works the other way round for you — say so now, because then most of what I was going to " +
  "say doesn't apply.";

/**
 * The opener, and it is ONE opener for all four playbooks.
 *
 * That is a change worth naming rather than sliding past. The old openers
 * differed because each carried its own reason for the call in its second
 * sentence — "I went through your website this morning", "I went looking for
 * you online the way a homeowner would". Under the correction the reason no
 * longer lives in the opener at all, so there is nothing left for four
 * versions to differ about, and four copies of one sentence is the duplication
 * AGENTS.md names as failure class 4.
 *
 * What differs per playbook is now the QUESTION under it — `open.prompts[0]`,
 * the one about the contractor's own day. That is where the research shows,
 * and it is the beat that decides whether the pivot lands.
 */
/** The one next step every playbook asks for. See the header. */
export const NEXT_STEP_OFFER = "I can show you in fifteen minutes how it works for a business like yours";

/**
 * The close's first two sentences, the same in all four. The rep reads the
 * slot off the scheduler; the calendar sends the invite. The reminder the
 * night before is the rep's own text from the event on their calendar —
 * nothing in the sales portal sends on a timer by decision (SalesCheckIn's
 * schema header), so the sentence promises what a rep can keep.
 */
export const CLOSE_ASK =
  "What works better for you, mornings or afternoons? I'll send the invite and a reminder " +
  "the night before.";

export const OPENER =
  `Hi — is that {businessName}? {repName} here, from FieldQuo. ${CANDOUR}, and you've never ` +
  `heard of me. ${PERMISSION_ASK}`;

/**
 * The four.
 *
 * Priorities match the OpportunityRule families they pair with (100 / 90 / 80 /
 * 70) so a superadmin reading both screens sees the same ordering twice rather
 * than two numbers to reconcile.
 *
 * All four run the same spine, because the spine is what the sources agree on:
 *
 *   open            who, where from, the candour line, permission phrased for yes
 *                   — then ONE question about their own day, which is the beat
 *                   the reason for the call now hangs off
 *   relevance       the pivot, then proof of research, then a true concession
 *                   that could lose it
 *   discovery       permission to ask, then information only — no services, no costs
 *   current_process a stated guess, offered to be corrected
 *   pain            their problem in their words, and their number, not ours
 *   fit             one claim, tied to what they just said, plus the forestall
 *   objections      rendered from the store (objections.js), never authored here
 *   next_step       one small, specific, dated thing
 *   close           confirm it, and keep the door open
 */
const PLAYBOOKS = [
  {
    key: "COMPETITIVE_DISPLACEMENT",
    name: "Competitive displacement",
    selectorKey: "competitor_detected",
    priority: 100,
    stages: {
      // OPEN. Saylor ch.9 still sets the frame — name, company, permission,
      // inside twenty seconds — and the shared OPENER carries all three. What
      // changed is where the REASON goes; see the OPENER and PIVOT headers.
      //
      // The question below is the whole point of the correction. It is a
      // leading question with two options in it (Saylor's ladder: closed risks
      // a one-word end, open invites a vague answer, leading shows the
      // homework), and the two options are the two ways a contractor actually
      // prices work. Whichever he picks, he has described his own day in his
      // own words, and the pivot in RELEVANCE answers what he said rather than
      // what we assumed. Futrell's rule that this satisfies: do not name what
      // you sell before the buyer perceives a need.
      open: {
        say: OPENER,
        prompts: [
          "Thanks. Quick question before I do — when you go out and look at a job, are you " +
            "usually able to give them a price while you're standing there, or does it get put " +
            "together back at the house afterwards?",
        ],
      },
      // RELEVANCE. Saylor's customer-benefit approach: the second sentence is
      // the one that proves the research happened. Then the Cialdini ch.6 move
      // — a limitation volunteered against our own interest, which is the
      // fastest trust available to a stranger. It is honest here because it is
      // true and because it can lose the call: a contractor who has never
      // thought about branding is told, in the first minute, not to spend the
      // meeting. Nothing is asserted about what {competitor} does; we observed
      // that it is installed, not how it behaves.
      relevance: {
        say:
          `${PIVOT} ` +
          "You're already running {competitor} — so I'm not calling to tell you your scheduling " +
          "is broken. You solved that, and I'm not going to pretend I know your business better " +
          "than you do from the outside. The narrow thing I called about is whose name and whose " +
          "colours a homeowner sees on the quote, the invoice and the emails in between. And the " +
          "unhelpful half first: if that has never once bothered you, I'm the wrong call, and I'd " +
          "rather hear that now than fifteen minutes in.",
        prompts: [],
      },
      // DISCOVERY. Saylor's survey approach — information only, no services and
      // no costs — which he names as the non-threatening first contact, and
      // Rackham's opening element via Saylor: get agreement to ask questions
      // before asking them. The prompts are leading rather than open (Saylor's
      // ladder: closed risks a one-word end, open invites a vague answer, a
      // leading question shows the homework) and each offers two options, so
      // the cheapest reply is a correction rather than a disclosure — the
      // owner's own reading of his twenty conversations.
      discovery: {
        say:
          "Can I ask you three things about how the work comes in? Nothing about what you charge " +
          "— I'm trying to work out whether there's anything here for you or not.",
        prompts: [
          "How many of you are on the tools at the moment — you and a crew, or you and a couple of subs?",
          "Is most of it repeat and referral now, or are you still bidding against two others on a lot of jobs?",
          "How far out are you booked — weeks, or months?",
        ],
      },
      // CURRENT PROCESS. Rackham via Saylor: ask situation questions sparingly,
      // and only the ones research could not answer. Futrell: opening too
      // specific makes a prospect deny the problem. So the stage states that we
      // are guessing and hands them the authority — the correction is the
      // information.
      current_process: {
        say:
          "Everything I could see from outside is a guess. You're the only one who knows how it " +
          "actually runs, so correct me where I've got it wrong.",
        prompts: [
          "A homeowner calls on a Tuesday — who writes that quote, and when? Evenings?",
          "Does {competitor} carry it all the way through to the invoice, or is part of it still in a notebook?",
          "When the quote lands in their inbox, whose name is on the email it came from?",
        ],
      },
      // PAIN. Problem questions, then Futrell's instruction that makes an
      // implication question worth asking: attach a bottom-line figure — and
      // get the PROSPECT to state it. Every number in this stage is theirs. We
      // do not bring one, and the AI half is forbidden figures entirely
      // (generate.js).
      pain: {
        say: "",
        prompts: [
          "Which part of that is the one that annoys you?",
          "In a normal month, how many quotes go out later than you meant them to?",
          "And when one goes out late, what usually happens to it?",
        ],
      },
      // FIT. Rackham's strongest empirical result, carried by Saylor: a rep who
      // presents a BENEFIT tied to a need the prospect has stated meets fewer
      // objections than one presenting generic advantages — which is why this
      // stage opens by pointing back at what they just said. The second half is
      // Futrell's forestalling: the switching objection is raised by us, before
      // they say it, because once said out loud they have to defend it.
      // ── Two claims, both checkable, and neither about their supplier ────
      //
      // This stage carried ONE claim — whose name is on the quote — and the
      // owner's note is that it under-sells against an incumbent: a contractor
      // who already has scheduling solved needs a reason that is about the
      // work, not only about the letterhead. Both additions are real and are
      // named in the code they come from:
      //
      //   · lib/ai/quoteReview.js runs on EVERY quote, free
      //     (lib/features/registry.js says so in as many words, distinguishing
      //     it from the paid deep photo read). Its valuable half is arithmetic,
      //     not language: completeness checks, and the price compared against
      //     THIS company's own accepted and declined history.
      //   · That comparison is deliberately their own history and never a
      //     cross-tenant benchmark — non-negotiable #8, and quoteReview.js's
      //     own header calls the alternative "a data leak dressed up as a
      //     feature". It is worth saying out loud to somebody being asked to
      //     put their prices into somebody else's software.
      //
      // What is NOT said is anything about what {competitor} does or does not
      // do. Saylor ch.11: never knock the competition — and a claim about
      // another vendor's product is the misrepresentation exposure Futrell
      // ch.3 describes, on a fact we have not checked. So the comparison is
      // put to the prospect as a QUESTION about their own setup, which they
      // can answer and we cannot get wrong.
      fit: {
        say:
          "Then two things, and they answer what you just said. The first is whose name is on " +
          "it: the quote, the invoice, the booking page and every email between them carry " +
          "yours, and none of them carry ours — somebody holding three quotes cannot tell that " +
          "two were written in the same software. The second is what happens before it goes: " +
          "every quote gets read back to you, free, on every quote — what you have left off, and " +
          "whether the price sits above or below what you have actually been winning at. Not " +
          "what other contractors charge; your own accepted and declined jobs. Nobody else's " +
          "numbers come into it and yours do not go out. Does the one you use now tell you that " +
          "before you send it? And before you have to raise it: nothing comes off {competitor} " +
          "to look at this. Nothing gets switched off, nothing gets imported, nobody learns " +
          "anything this week.",
        prompts: [],
      },
      // OBJECTIONS. Rendered from the objection store, filtered to this
      // prospect. Authored prose here would be a second copy of it that nobody
      // maintains — see stages.js.
      objections: { say: "", prompts: [] },
      // NEXT STEP. Barron: the whole point of the outreach is the next
      // conversation, and the ask is small and specific. It is a demo — the
      // rep shows, the contractor watches — and never a promise to build
      // anything; see the NEXT_STEP_OFFER header.
      next_step: {
        say:
          `So here's what I'd like. Give me fifteen minutes and ${NEXT_STEP_OFFER}: a quote with ` +
          "your name on it next to the one you send now, and what the review says before it goes " +
          "out. Nothing to set up on your side. You just watch.",
        prompts: [],
      },
      // CLOSE. Confirm what was agreed in concrete terms, then Futrell's
      // twelfth key: leave the door open. The contingency is not politeness —
      // Saylor's own figure is that 81% of sales happen on or after the fifth
      // call, and in the owner's twenty conversations not one win closed on
      // first contact while the largest recovery came from a follow-up months
      // later. A closing line that invites refusal ("say so and that's the end
      // of it") throws the other four calls away. After the last sentence, stop
      // talking — Futrell is emphatic that anything said after the ask takes
      // the pressure off the decision.
      close: {
        say:
          `${CLOSE_ASK} And if the day falls apart — it's a job site, it happens — tell me and ` +
          "we'll move it rather than drop it. If I don't hear anything I'll try you again in a " +
          "couple of weeks.",
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
      // OPEN. Same shared opener. The question asks about the stranger's route
      // to them rather than announcing what we found — Saylor names "I heard
      // you've been having trouble" as a failure because it puts the customer
      // on guard and makes them wonder who has been talking. Asked this way,
      // the contractor is the one who says there is nowhere to send people.
      open: {
        say: OPENER,
        prompts: [
          "Thanks. One question before I do — when somebody who's never met you goes looking to " +
            "see whether you're any good, is there somewhere you'd send them, or is it whatever " +
            "comes up when they search your name?",
        ],
      },
      // RELEVANCE. The observation, then Cialdini ch.7's loss framing — the
      // insulation and self-examination studies show the identical true fact
      // persuades more stated as what is being lost. Nothing is invented: the
      // loss described is people who searched and did not find them. Then the
      // concession, and this one is expensive on purpose. Every clause of it is
      // true and checkable in this codebase: sites are served from a
      // fieldquo.com subdomain (lib/site/subdomain.js), they are assembled from
      // the company's own jobs rather than designed (lib/site/generateSite.js),
      // and the free tier carries the "Site by FieldQuo" credit (the Terms, and
      // lib/billing/access.js). Naming all three, unprompted, in a call whose
      // pitch is white-labelling, is the sentence that could end it.
      relevance: {
        say:
          `${PIVOT} ` +
          "There's no website I could find. Your number's out there, so anyone who already has " +
          "your name gets to you fine — it's the ones who don't have your name I called about. " +
          "They search, they find two others with photographs of finished work, and you were " +
          "never in that comparison at all. Now the part that costs me: what we'd build isn't a " +
          "site somebody designed for you. It's put together out of jobs you've already done, it " +
          "lives at an address on fieldquo.com, and while it's free it carries a small \"Site by " +
          "FieldQuo\" line at the bottom. If that's beneath how you want to look, tell me — that's " +
          "a real reason not to do this.",
        prompts: [],
      },
      discovery: {
        say:
          "Can I ask you three things about where the work comes from? Nothing about money — I " +
          "want to know whether this is even for you.",
        prompts: [
          "Where does most of it come from now — word of mouth, a board, or the ads?",
          "How many of you are there?",
          "How far will you travel for a job worth having?",
        ],
      },
      current_process: {
        say: "You're the authority on this and I'm guessing from outside. Tell me where I'm wrong.",
        prompts: [
          "When somebody wants a price, what do they actually do — call the mobile?",
          "How do they get that number in the first place, if nobody's given it to them?",
          "Has anyone ever said they nearly went elsewhere because they couldn't find anything about you?",
        ],
      },
      pain: {
        say: "",
        prompts: [
          "How many of those calls come in while you're up a ladder?",
          "In a week, how many go to voicemail and never call back?",
          "Do people ask you for photos of previous work before they'll commit?",
        ],
      },
      fit: {
        say:
          "Then the photos you've just described are the site. We build it out of the jobs you've " +
          "already done: your name at the top, your colour, the work, and a way for somebody to " +
          "ask you for a price at nine at night while you're asleep. You don't write anything. " +
          "And the objection you're about to have — that it's a project — it isn't. It's built " +
          "out of what you've already done, and I can show you one in fifteen minutes.",
        prompts: [],
      },
      objections: { say: "", prompts: [] },
      // NEXT STEP. The smallest thing that can be done from a van. Godin's
      // funnel rule is to remove steps so fewer decisions are required, and
      // Barron's is that the ask should be small and specific. The photos are
      // what the demo is built from, not a job the rep takes away.
      next_step: {
        say:
          `Here's what I'd like. Give me fifteen minutes and ${NEXT_STEP_OFFER}: a site built out ` +
          "of jobs you've already done, with your name on it, and what a homeowner sees at nine " +
          "at night. Send me three photos of a job you're proud of, to the number I'm calling " +
          "from, and we'll use those.",
        prompts: [],
      },
      // CLOSE. The follow-up is not conditional on them doing their half — the
      // call happens either way. Godin's Ziglar passage is the argument: the
      // salesman who took a room in town and stayed made his sales in the
      // middle of the curve on the fifth, sixth and seventh contact, which is
      // where everyone else had already driven away.
      close: {
        say:
          `${CLOSE_ASK} Three photos to this number whenever you get a minute. If the photos ` +
          "don't happen before then, that's fine — I'll call anyway and we'll use what's on your " +
          "phone.",
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
      // OPEN. The question is about the hour a contractor cannot work — nine
      // at night, when the homeowner is on the site and he is asleep. He
      // answers it from his own week, and the pivot lands on his answer.
      open: {
        say: OPENER,
        prompts: [
          "Thanks. One question first — when somebody's on your site at nine at night and wants " +
            "you, can they put themselves in your diary there and then, or does it hang on them " +
            "remembering to ring in the morning?",
        ],
      },
      // RELEVANCE. The concession here disqualifies the biggest reason a
      // contractor would say yes for the wrong reason: a booking page does not
      // generate demand. Saying it out loud can end the call with anybody whose
      // real problem is an empty diary, which is exactly what makes it worth
      // saying — Cialdini's test is whether the admission can cost you.
      // Futrell reaches the same place from the other side: if the customer
      // does not have the need, accept it and move on.
      relevance: {
        say:
          `${PIVOT} ` +
          "The site does its job — that's not what I called about. What it hasn't got is any way for " +
          "somebody to put themselves into your diary: every page ends with give us a call. And " +
          "the honest limit on it, before you spend anything: a booking page will not bring you " +
          "one extra enquiry. It doesn't get you found. If the problem is that the phone isn't " +
          "ringing enough, this is the wrong conversation and I'd rather say so now.",
        prompts: [],
      },
      discovery: {
        say: "Can I ask you three things about the enquiries you do get? Nothing about your rates.",
        prompts: [
          "Roughly how many does the site bring you in a week?",
          "Who picks up when you're out on a job?",
          "Are you booking a visit to measure, or quoting off photos people send?",
        ],
      },
      current_process: {
        say: "Tell me where my guess is wrong here.",
        prompts: [
          "Somebody's on the site at nine at night and they want you — what do they do next?",
          "How many messages back and forth before a time is actually agreed?",
          "Does that time go into a calendar, or is it in your head until the morning?",
        ],
      },
      pain: {
        say: "",
        prompts: [
          "Out of the ones who message you, how many go quiet before a time's agreed?",
          "Have you ever turned up and they'd forgotten, or had somebody else in?",
        ],
      },
      fit: {
        say:
          "Nobody books a kitchen off a form and I'm not going to suggest they should. What gets " +
          "booked is you turning up to measure — a slot you've allowed, the address, the photos " +
          "already attached, and none of that back-and-forth to arrange it. And the bit you'd " +
          "raise: you keep the site you've got. It gains a button. It doesn't get rebuilt.",
        prompts: [],
      },
      objections: { say: "", prompts: [] },
      next_step: {
        say:
          `Give me fifteen minutes and ${NEXT_STEP_OFFER}: somebody on your site at nine at ` +
          "night, picking a time you've already said you'll accept, and where that lands for you " +
          "in the morning. Nothing gets rebuilt. You keep the site you've got.",
        prompts: [],
      },
      close: {
        say:
          `${CLOSE_ASK} If the day goes wrong, message me and we'll find another one — and if I ` +
          "don't hear back I'll try you again after month end.",
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
      // OPEN. The closest of the four to the owner's own transcript, because
      // this playbook's prospect is the one whose quoting really does happen
      // twice — once to ask the four questions, once to price the answers.
      open: {
        say: OPENER,
        prompts: [
          "Thanks. One question before I do — when an enquiry comes in, does it usually arrive " +
            "with enough on it to price, or are you writing back to ask the same few things " +
            "before you can even start?",
        ],
      },
      // RELEVANCE. The concession is the plainest of the four: the thing we
      // sell does not solve all of what we've just described, and the part it
      // misses is named before they can find it. Cialdini's warning about the
      // Listerine/Avis pattern is the reason it is phrased this way — a
      // drawback engineered to be costless is the theatrical version, so this
      // one concedes the case the prospect would actually care about.
      relevance: {
        say:
          `${PIVOT} ` +
          "There's an email address on the site and nothing else — no form, no questions. So " +
          "every enquiry arrives as somebody's free text, and you're the one writing back to ask " +
          "the same four things before you can price any of it. What I should say straight away: " +
          "a form doesn't fix all of that. Some people won't fill one in, and those will still " +
          "land in your inbox exactly as they do now. What changes is the ones who do.",
        prompts: [],
      },
      discovery: {
        say: "Can I ask you three things about that inbox? Nothing about your prices.",
        prompts: [
          "Roughly how many enquiries a week land in it?",
          "What do you always end up having to ask them?",
          "Who else can see it — anybody, or just you?",
        ],
      },
      current_process: {
        say: "Correct me where I've got this wrong.",
        prompts: [
          "An email arrives on a Tuesday morning while you're on site — then what?",
          "How long is it usually before you get to reply?",
          "How do you know which ones you've already answered?",
        ],
      },
      pain: {
        say: "",
        prompts: [
          "How many go cold while they're waiting on you?",
          "Have you ever priced the same job twice because the first one got lost?",
        ],
      },
      fit: {
        say:
          "Then it's the four things you just named. They get asked before the enquiry reaches " +
          "you, and what arrives isn't a note in an inbox — it's a job in a list, with the " +
          "answers and the photos on it, one press from a quote you can send from the van. And " +
          "before you ask: you keep the address that's on the site. Anyone who'd rather just " +
          "email you still can.",
        prompts: [],
      },
      objections: { say: "", prompts: [] },
      next_step: {
        say:
          `Tell me the four things you always end up asking, and give me fifteen minutes. ${NEXT_STEP_OFFER}: ` +
          "those four questions asked before the enquiry reaches you, and what lands in your list " +
          "with the answers already on it. Your questions, not ours.",
        prompts: [],
      },
      close: {
        say:
          `${CLOSE_ASK} Send me the four questions whenever they come to you, a text is fine. If ` +
          "they don't arrive I'll bring my guess at them and you can cross them out — and if the " +
          "day moves, I'll find you the week after.",
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
 *
 * It checks SHAPE, not judgement. Whether a line apologises, promises a time
 * limit or ends the sequence is checked in scripts/check-playbook-copy.mjs
 * against the seeds — deliberately not here, because a superadmin editing a
 * live script at nine at night must not be blocked by a phrase-matcher that
 * cannot know what they meant, and because a regex that refuses a save is a
 * control that appears to understand English and does not.
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
