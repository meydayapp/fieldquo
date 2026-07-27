// app/data/industryContent.js
//
// Per-trade page content for /industries/[slug].
//
// This used to template every industry off the same string — same headline
// shape, same four generic pain points for a roofer and a house cleaner.
// That's worthless for both conversion and SEO: a visitor recognises boilerplate
// instantly, and a dozen near-identical pages compete with each other in search
// rather than ranking.
//
// So each trade gets pain points drawn from how THAT trade actually loses money,
// each paired with the specific FieldQuo capability that addresses it. If you
// can't name a real pain for a trade, that's a signal the page shouldn't exist
// yet rather than a reason to pad it.
//
// Deliberately absent: testimonials, customer counts, review scores. Competitors
// lead with "400,000+ pros trust us" — FieldQuo has no such number yet, and
// inventing social proof is both dishonest and legally risky. The pages earn
// attention on specificity instead. Add a `videoId` per trade as real footage
// gets made; until then the slot renders as an honest placeholder rather than a
// broken embed.

import { INDUSTRIES } from "./industries";

const CONTENT = {
  cleaning: {
    headline: "Cleaning business software that keeps recurring work on track",
    description:
      "Residential and commercial cleaning runs on repeat visits, rotating crews, and tight margins per job. FieldQuo keeps the schedule, the checklist, and the invoice in one place.",
    painPoints: [
      {
        pain: "Recurring clients get rebooked by hand every week",
        fix: "Set a visit cadence once and let the schedule repeat itself, with the right crew assigned each time.",
      },
      {
        pain: "Crews skip steps and clients notice before you do",
        fix: "Per-job checklists your team ticks off on their phone, so the standard is the same whoever shows up.",
      },
      {
        pain: "Small invoices pile up unpaid because chasing them isn't worth the time",
        fix: "Automatic follow-ups on overdue invoices, and clients pay online from the email.",
      },
      {
        pain: "You don't know which contracts are actually profitable",
        fix: "Time tracked against each job, compared to what you billed, so unprofitable contracts surface early.",
      },
    ],
  },

  "construction-contracting": {
    headline: "Construction software that protects your margin on every bid",
    description:
      "Scope creep, subcontractors, and material prices that move between quoting and starting. FieldQuo keeps bids, schedules, and real costs connected so you know where a project stands.",
    painPoints: [
      {
        pain: "Bids take a full evening and still miss things",
        fix: "Build from your own priced catalogue with reusable scope groups, so a bid is assembly rather than authorship.",
      },
      {
        pain: "Material costs move between quoting and breaking ground",
        fix: "Material cost tracking with price history, so you're quoting from what things cost now, not last season.",
      },
      {
        pain: "Change orders get agreed verbally and forgotten at invoicing",
        fix: "Revise the quote, get it re-approved online, and the invoice reflects the change automatically.",
      },
      {
        pain: "You find out a project lost money after it's finished",
        fix: "Labour, materials and expenses tracked against each job as it runs, not reconstructed afterwards.",
      },
    ],
  },

  electrical: {
    headline: "Electrical contractor software built around service calls",
    description:
      "Between service calls, panel upgrades, and inspection scheduling, the admin adds up fast. FieldQuo handles the paperwork so your licensed hours go to billable work.",
    painPoints: [
      {
        pain: "Emergency calls wreck a scheduled day",
        fix: "Drag work to another slot and the affected clients and crew are notified automatically.",
      },
      {
        pain: "Quoting a panel upgrade means rebuilding the same line items again",
        fix: "Saved service catalogue with your own rates — pick the work, adjust, send.",
      },
      {
        pain: "Job photos and inspection notes live on someone's phone",
        fix: "Photos and notes attach to the job record, so they're findable when a client or inspector asks months later.",
      },
      {
        pain: "Apprentice hours are guessed at payroll time",
        fix: "Time entries against real jobs, approved by a supervisor, feeding straight into payouts.",
      },
    ],
  },

  hvac: {
    headline: "HVAC software for seasonal peaks and maintenance contracts",
    description:
      "Your year is two crushes and two quiet stretches. FieldQuo helps you book the peak without dropping anyone, and keep maintenance revenue flowing through the quiet months.",
    painPoints: [
      {
        pain: "The first heatwave produces more calls than you can schedule",
        fix: "A booking page showing real availability, so clients self-serve into open slots instead of queuing on the phone.",
      },
      {
        pain: "Maintenance agreements get forgotten until the client calls",
        fix: "Recurring visits scheduled ahead with automatic reminders, so contract work books itself.",
      },
      {
        pain: "Techs arrive without knowing what equipment is on site",
        fix: "Full job and client history on their phone, including what was done last visit.",
      },
      {
        pain: "Install quotes lose to whoever replied first",
        fix: "Build and send the quote from the driveway; clients approve online without waiting for you to get back to the office.",
      },
    ],
  },

  handyman: {
    headline: "Handyman software for jobs that are never the same twice",
    description:
      "Lots of small jobs, wide variety, and pricing that has to be quick without being careless. FieldQuo keeps the admin proportional to the job size.",
    painPoints: [
      {
        pain: "Every job is different, so nothing is reusable",
        fix: "A catalogue of your common tasks and rates you assemble from, however unusual the combination.",
      },
      {
        pain: "Small jobs don't feel worth a formal quote, then get disputed",
        fix: "Send a quote from your phone in under a minute — the client approves in writing, and it's on record.",
      },
      {
        pain: "Half a day disappears into scheduling calls",
        fix: "Clients book themselves into slots you've actually got free.",
      },
      {
        pain: "Cash and e-transfer payments never get recorded properly",
        fix: "Log any payment method against the invoice, so the books match reality.",
      },
    ],
  },

  landscaping: {
    headline: "Landscaping software for design builds and seasonal crews",
    description:
      "Design-build projects, seasonal staffing, and weather that rewrites your week. FieldQuo keeps quotes, crews and costs together when the plan keeps moving.",
    painPoints: [
      {
        pain: "Rain rewrites the week and everyone needs telling",
        fix: "Move jobs on the calendar and affected clients and crew are notified automatically.",
      },
      {
        pain: "Design-build quotes are long and take days to produce",
        fix: "Group scope into sections with photos, so a large quote reads clearly and builds quickly.",
      },
      {
        pain: "Seasonal hires make labour cost hard to pin down",
        fix: "Time tracked per job and per worker, so you know the real labour cost of a build.",
      },
      {
        pain: "Plant and material costs eat the margin quietly",
        fix: "Track material costs with price history, and see them against what you quoted.",
      },
    ],
  },

  "lawn-care": {
    headline: "Lawn care software built for route density",
    description:
      "High volume, low ticket, and profit that lives or dies on how tight your route is. FieldQuo keeps recurring visits and billing running with minimal admin per stop.",
    painPoints: [
      {
        pain: "Rebooking the same weekly clients is a job in itself",
        fix: "Set the cadence once — the visits generate themselves with the right crew attached.",
      },
      {
        pain: "Invoicing dozens of small accounts eats an evening",
        fix: "Generate invoices from completed visits in a batch, with online payment links.",
      },
      {
        pain: "A skipped or rained-out visit gets billed anyway",
        fix: "Mark visits complete or skipped in the field, and billing follows what actually happened.",
      },
      {
        pain: "You can't tell which routes are worth keeping",
        fix: "Revenue and time per job, so you can see which accounts justify the drive.",
      },
    ],
  },

  painting: {
    headline: "Painting software for quotes clients actually approve",
    description:
      "Painting is won on the quote — clarity, photos, and getting there before the other two bidders. FieldQuo helps you send a professional quote the same day.",
    painPoints: [
      {
        pain: "You're the third quote and the slowest to send",
        fix: "Build the quote on site from your own rates and send before you leave the driveway.",
      },
      {
        pain: "Clients don't understand what's included and haggle",
        fix: "Itemised scope with photos and clear inclusions, so the conversation is about the work rather than the number.",
      },
      {
        pain: "Colour and prep decisions get agreed verbally then disputed",
        fix: "It's in the approved quote, timestamped, with the client's online approval attached.",
      },
      {
        pain: "Paint and materials cost more than you allowed for",
        fix: "Material cost tracking with history, so your quoting assumptions stay current.",
      },
    ],
  },

  plumbing: {
    headline: "Plumbing software for emergency calls and planned work",
    description:
      "Emergencies don't respect the schedule, and the admin still has to happen. FieldQuo keeps dispatch, job history and invoicing moving without a back office.",
    painPoints: [
      {
        pain: "An emergency call blows up a booked day",
        fix: "Reschedule affected jobs in a few taps; clients and crew are notified without you making calls.",
      },
      {
        pain: "You're invoicing at 10pm because the day was flat out",
        fix: "Turn the completed job into an invoice on the spot, with a payment link the client can use immediately.",
      },
      {
        pain: "Nobody remembers what was done at this property last time",
        fix: "Full job history per client, including photos and notes, on the tech's phone.",
      },
      {
        pain: "Callback work gets done free because nobody logged the original",
        fix: "Every visit is a record — what was replaced, when, and under what terms.",
      },
    ],
  },

  "pressure-washing": {
    headline: "Pressure washing software for fast quotes and quick turnarounds",
    description:
      "Short jobs, high volume, and quoting that often happens from a photo. FieldQuo keeps the admin light enough to be worth it on a two-hour job.",
    painPoints: [
      {
        pain: "Quoting from photos means guessing and hoping",
        fix: "Rate-per-area pricing from your own catalogue, so estimates stay consistent job to job.",
      },
      {
        pain: "Short jobs make paperwork feel disproportionate",
        fix: "Quote, schedule and invoice from your phone in a couple of minutes each.",
      },
      {
        pain: "Driving across town for scattered jobs kills the day",
        fix: "See the day's jobs together so you can cluster work sensibly.",
      },
      {
        pain: "Before-and-after photos live in a camera roll",
        fix: "Photos attach to the job — useful for disputes and for marketing later.",
      },
    ],
  },

  roofing: {
    headline: "Roofing software for big-ticket quotes and crew coordination",
    description:
      "High-value jobs, weather dependency, and clients who need convincing before they sign. FieldQuo helps you quote clearly and keep crews coordinated once you win.",
    painPoints: [
      {
        pain: "A five-figure quote gets a one-line email and no answer",
        fix: "Detailed quotes with scope, photos and options the client approves online — and automatic follow-up if they go quiet.",
      },
      {
        pain: "Weather moves the schedule and the crew finds out late",
        fix: "Reschedule once; crew and client notifications go out automatically.",
      },
      {
        pain: "Deposits and progress payments are tracked in your head",
        fix: "Record deposits and partial payments against the invoice, with the balance always visible to both sides.",
      },
      {
        pain: "Material waste quietly eats the margin",
        fix: "Track material costs against each job and compare to what you allowed at quote.",
      },
    ],
  },

  "tree-care": {
    headline: "Tree care software for high-risk, high-value work",
    description:
      "Equipment, crew safety, and jobs priced on judgement rather than a rate card. FieldQuo keeps the record straight from assessment through to invoice.",
    painPoints: [
      {
        pain: "Every job is priced on judgement and nothing is comparable",
        fix: "Past jobs with their scope, photos and final price stay searchable, so your judgement has a reference.",
      },
      {
        pain: "Site risks are discussed on site and never written down",
        fix: "Notes, photos and checklists attach to the job before the crew arrives.",
      },
      {
        pain: "Emergency storm work arrives all at once",
        fix: "Take requests through a booking form and triage them without the phone ringing constantly.",
      },
      {
        pain: "Equipment and crew time aren't reflected in the price",
        fix: "Time tracking per job against what you billed, so pricing improves with evidence.",
      },
    ],
  },
};

export const INDUSTRY_CONTENT = Object.fromEntries(
  INDUSTRIES.map((ind) => {
    const content = CONTENT[ind.slug];

    // Fall back to something honest rather than crashing if an industry is
    // added to INDUSTRIES before its copy is written.
    return [
      ind.slug,
      {
        ...ind,
        headline:
          content?.headline ||
          `Software built for ${ind.label.toLowerCase()} businesses`,
        description:
          content?.description ||
          `Quotes, scheduling, invoicing and payments for ${ind.label.toLowerCase()} businesses.`,
        painPoints: content?.painPoints || [],
        // YouTube/Vimeo id once real footage exists. Null renders a placeholder.
        videoId: content?.videoId || null,
      },
    ];
  }),
);
