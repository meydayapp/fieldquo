// lib/junk/guidance.js
//
// Default junk-removal content: the FAQ a company shows its customers, and the
// plain-language guide a new operator needs to price and run jobs.
//
// ══ Why ship defaults at all ═══════════════════════════════════════════════
//
// A contractor starting a junk business doesn't have a pricing philosophy or a
// customer FAQ written yet — and a blank one is why they under-charge and get
// surprised at the dump. These are STARTING points, in FieldQuo's own words,
// that a company edits to its own market. Nothing here is a promise the software
// makes; it's a template the owner adopts.
//
// Pure data. No database, no imports.

/**
 * The customer FAQ, English defaults. A junk company edits these on its site.
 * Written to answer what a homeowner actually asks before booking, and to set
 * expectations the crew can keep (no exact price sight-unseen, what isn't taken).
 */
export const JUNK_FAQ = [
  {
    q: "How is the price decided?",
    a: "By volume — how much space your items take in the truck, not their weight. That's why a full sofa and a small dresser can cost the same: they fill similar space. You'll get an estimated range up front, and the exact price is confirmed on site before any work starts.",
  },
  {
    q: "Do I need to be home?",
    a: "For most jobs, someone should be there to point out what stays and what goes and to approve the final price. For a driveway or curbside pile that's clearly marked, we can sometimes handle it without you — just ask when you book.",
  },
  {
    q: "What won't you take?",
    a: "Hazardous materials — propane tanks, gasoline, paint, solvents, and anything flammable or toxic. Those need a specialized disposal facility, and we'll point you to one. Everything else, from a single item to a full house, we can usually handle.",
  },
  {
    q: "Do fridges, TVs, and mattresses cost extra?",
    a: "Yes, a little. Appliances with refrigerant (fridges, freezers, AC units), electronics, mattresses, and tires carry a recycling or disposal fee we pay at the depot — it's shown as a separate line so there are no surprises. Refrigerant appliances and electronics sometimes travel on a separate run.",
  },
  {
    q: "What happens to my stuff?",
    a: "We divert as much as we can from the landfill — usable furniture and appliances go to donation or reuse, metal and electronics to recycling, and only what's left goes to the dump. Responsible disposal is part of the price, not an add-on.",
  },
  {
    q: "How soon can you come?",
    a: "Often same-day or next-day, depending on the schedule. When you book you'll pick a window that works, and we'll text when the crew is on the way.",
  },
  {
    q: "Do I have to move everything outside?",
    a: "No. The crew does the lifting and carrying, including from a basement, an upstairs unit, or a shed. Stairs, a long carry, or no elevator can add a little to the price, which you'll see before we start.",
  },
];

/**
 * How to PRICE a junk job — for the owner who just started and is guessing.
 * The single most important lesson is first: know your dump cost.
 */
export const JUNK_PRICING_GUIDE = {
  title: "How to price a junk-removal job",
  intro:
    "Junk removal looks simple to price and isn't — the money leaks at the dump, not the driveway. Here's the shape of a price that stays profitable.",
  points: [
    {
      heading: "Price by volume, not by item or weight",
      body: "Charge for the truck space the load takes. One item is a whole trip — the truck, the fuel, two people, the dump run — so it's expensive per item. A full load spreads all that, so the per-item price drops. Quoting a flat price per item overcharges big jobs and loses you the small ones.",
    },
    {
      heading: "Set a real minimum",
      body: "Your smallest job still costs you a truck, two people, and a dump run. Your minimum has to cover that even if it's one mattress — otherwise a $60 single-item call loses money the moment you pull out of the yard.",
    },
    {
      heading: "Know your dump cost before you quote",
      body: "The transfer station bills you — by the tonne for heavy debris, and per item for refrigerant appliances, electronics, mattresses, and tires. Call your local depot, write those numbers down, and put them into your rates. This is the number that turns a busy week into a broke one if you guess it.",
    },
    {
      heading: "Charge the special items separately",
      body: "A fridge owes a Freon-reclaim fee, a TV an e-waste fee, a mattress a recycling fee — every one a real cost you pay. Show them as their own lines. Customers accept a named fee far more easily than a higher total with no explanation.",
    },
    {
      heading: "Price the access, not just the pile",
      body: "The same load is a different job up three flights with no elevator, or with a long carry from a back yard, or when a bed and a shed need taking apart. Add for stairs, long carries, disassembly and small demolition — that's labour you're really spending.",
    },
    {
      heading: "Give a range, confirm on site",
      body: "You can't see the pile from a form, so quote a range from what the customer tells you and confirm the exact price when you arrive. It protects you from the underestimate and them from the surprise.",
    },
  ],
};

/**
 * The job PROCESS — the steps of a clean junk job, for training a new crew or
 * writing the company's own runbook.
 */
export const JUNK_PROCESS_GUIDE = {
  title: "How a junk job runs, start to finish",
  steps: [
    {
      heading: "1. Estimate",
      body: "Customer describes the load (items, or a room/house), the access, and the address. Give an estimated range and book a window. Photos or a short video of the pile make the estimate far more accurate — ask for them.",
    },
    {
      heading: "2. On-the-way",
      body: "Text the customer when the crew leaves. A homeowner waiting with no word is the number-one complaint in this trade, and it's free to fix.",
    },
    {
      heading: "3. Walk-through & final price",
      body: "On site, look at the actual pile, confirm what goes, flag anything you don't take (hazards) or that needs a separate run (fridges, electronics), and give the exact price. Get a yes before you lift anything.",
    },
    {
      heading: "4. Haul",
      body: "The crew does all the lifting and carrying. Protect floors and doorways on the way out — a scuff on a client's wall costs more than the job earned.",
    },
    {
      heading: "5. Dispose responsibly",
      body: "Sort on the way out or at the yard: donation and reuse first, recycling and metal next, landfill last. Keep the depot receipts — they're your proof of the disposal cost and your recycling story for the next customer.",
    },
    {
      heading: "6. Invoice & follow up",
      body: "Collect payment, send the invoice, and ask for a review while the empty room is still fresh in their mind. A photo of the cleared space is worth sending — it's the before/after that wins the next job.",
    },
  ],
};

/** FAQ shaped for a website FAQ block ({ question, answer }). */
export function junkFaqBlocks() {
  return JUNK_FAQ.map((f) => ({ question: f.q, answer: f.a }));
}
