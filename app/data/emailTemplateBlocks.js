// app/data/emailTemplateBlocks.js
//
// Shared shape for the ordered-block email editor (Settings > Email
// Templates) and the renderer (lib/email/renderTemplateSections.js). A
// DocumentTemplate.sections value is an array of these blocks:
//   { id, type: "heading"|"text"|"image"|"button"|"divider"|"summary", ...fields }
//
// Kept intentionally simple (no free-positioning, no rich inline formatting)
// — an ordered list of typed blocks the company can add, edit, reorder, and
// remove renders reliably in real email clients and covers "move sections
// around, add pictures and text" without a page-builder canvas.

export const BLOCK_TYPES = [
  {
    type: "heading",
    label: "Heading",
    // align: left|center|right, size: small|medium|large
    defaults: { text: "Heading text", align: "left", size: "large" },
  },
  {
    type: "text",
    label: "Text",
    defaults: { text: "Write a paragraph here…", align: "left" },
  },
  {
    type: "image",
    // width: full|half, align: left|center|right
    defaults: { url: "", alt: "", width: "full", align: "center" },
    label: "Image",
  },
  {
    type: "button",
    label: "Button",
    // bg/color let a company match its brand colours
    defaults: {
      label: "Click here",
      url: "",
      align: "left",
      bg: "#111827",
      color: "#ffffff",
    },
  },
  {
    type: "divider",
    label: "Divider",
    defaults: {},
  },
  {
    type: "spacer",
    label: "Spacer",
    // height in px — vertical breathing room between blocks
    defaults: { height: 24 },
  },
  {
    type: "summary",
    label: "Quote/Invoice summary",
    defaults: {},
  },
  {
    type: "lineItems",
    label: "Itemized list",
    // Renders Quote.lineItems / Invoice.lineItems (both `Json?` in the
    // schema) as a proper table. Unlike "summary" — which prints only the
    // document number and grand total — this shows each line. Toggles let a
    // company hide columns that don't apply (e.g. a flat-rate job with no
    // meaningful per-unit price).
    defaults: {
      showQuantity: true,
      showUnitPrice: true,
      showSubtotals: true,
      title: "What's included",
    },
  },
  {
    type: "progress",
    label: "Project progress",
    // A horizontal stage tracker for the project lifecycle. `stages` is an
    // editable list so a company whose process differs can relabel them
    // without a code change; `activeStage` is the 0-based index of the
    // current stage, or the {{progressStage}} merge field at send time so a
    // single template works at every point in the lifecycle.
    defaults: {
      stages: [
        "Quote",
        "Deposit & scheduling",
        "Project start",
        "Project complete",
      ],
      activeStage: 0,
      useMergeField: true,
    },
  },
];

// Merge fields available for {{token}} substitution at send time — shown in
// the editor as insertable hints.
//
// ── "Harmless" was the wrong word, and it cost two chips ───────────────────
//
// This comment used to end: "the renderer just leaves unknown/blank tokens as
// empty strings rather than erroring, so showing the full list everywhere is
// harmless." The first half is true — applyMergeFields does
// `mergeData[token] ?? ""`. The conclusion does not follow.
//
// An empty string is WORSE than a visible {{token}}, not better. A homeowner
// reading "Please send a deposit of  to secure your booking" sees a typo, not
// a bug, so nobody reports it — and it went out under the contractor's brand,
// which is the one thing this product promises to protect.
//
// Two chips were offered that NO send path has ever supplied:
//   depositAmount — there is no deposit feature to derive it from. Staged
//                   payments are roughly 10% built (display only) — see
//                   docs/PAYMENT-SCHEDULE.md. Restore this chip when the
//                   thing it names exists.
// invoiceUrl was the same until this change. It is back, because the fix was
// to SUPPLY it: the follow-up cron now deep-links to the invoice inside the
// client portal. The default "Payment received" template already shipped a
// "View your invoice" button bound to it, so that button had an empty href —
// a link to nowhere in a homeowner's inbox, under the contractor's brand.
//
// Both removed rather than faked. scripts/check-follow-up-flow.mjs now asserts
// every token here is supplied by at least one real send path, so a chip that
// nothing populates cannot be offered again.
//
// Still true, and deliberately left alone: not every field applies to every
// template type. A marketing campaign supplies only the six client/company
// fields, so an entity token in a campaign renders empty. That is a narrower
// problem than the one fixed here — the token IS real, it just has no entity
// in that context — and scoping the palette per template kind is a separate
// change. Recorded so it is not mistaken for solved.
export const MERGE_FIELDS = [
  { token: "clientName", label: "Client name" },
  { token: "clientAddress", label: "Client / job address" },
  { token: "clientPhone", label: "Client phone" },
  { token: "companyName", label: "Your company name" },
  { token: "companyPhone", label: "Your company phone" },
  { token: "companyEmail", label: "Your company email" },
  { token: "quoteNumber", label: "Quote number" },
  { token: "quoteTotal", label: "Quote total" },
  { token: "quoteUrl", label: "Quote link" },
  { token: "invoiceNumber", label: "Invoice number" },
  { token: "invoiceTotal", label: "Invoice total" },
  { token: "invoiceUrl", label: "Invoice link" },
  { token: "dueDate", label: "Invoice due date" },
  { token: "balanceDue", label: "Balance due" },
  { token: "projectStartDate", label: "Project start date" },
  { token: "projectEndDate", label: "Project end date" },
  { token: "jobTitle", label: "Job title" },
  { token: "amountPaid", label: "Amount paid" },
];

// Deliberately NOT in MERGE_FIELDS: `progressStage` (a 0-based index that
// drives the Project progress block) and `lineItems` (an array consumed by
// the Itemized list block). Both are supplied by the send paths and would
// render as "1" and "[object Object]" if someone dropped them into a text
// block, so they're not offered as insertable chips.

export function newBlock(type) {
  const meta = BLOCK_TYPES.find((b) => b.type === type);
  if (!meta) return null;
  // Deep clone, not `{ ...meta.defaults }`. A shallow spread copies the
  // `stages` array on the progress block *by reference*, so every progress
  // block in every template would share one array — renaming a stage in one
  // email would silently rename it in the others.
  return {
    id: crypto.randomUUID(),
    type,
    ...structuredClone(meta.defaults),
  };
}

export const TEMPLATE_TYPE_META = {
  quote_email: { label: "Quote email", group: "Automated" },
  instructions_email: { label: "Instructions email", group: "Automated" },
  receipt_email: { label: "Receipt / invoice email", group: "Automated" },
  follow_up_email: { label: "Follow-up email", group: "Automated" },
  marketing_email: { label: "Marketing email", group: "Marketing" },
  custom_email: { label: "Custom", group: "Custom" },
};

// Starter content below is adapted from a real cabinet-refinishing shop's
// email templates (structure: header greeting → confirmation/summary →
// what's-included or how-to-prepare bullets → CTA → contact block), rewritten
// with merge fields so any company can use it as-is or edit it. Deliberately
// NOT ported: the source's financing/instalment calculator (hardcoded to a
// specific Shopify store's product tiers and a fixed 15% APR — not portable),
// its multi-language i18n, the before/after photo gallery (hardcoded image
// filenames), and named client-reference testimonials (that shop's actual
// customers' phone numbers). Those are business-specific, not template
// mechanics — add them by hand per company if wanted.
// The four project-lifecycle stages, shared by every default template that
// carries a progress block so the tracker reads consistently across the whole
// customer journey. A company can relabel them per block in the editor.
export const LIFECYCLE_STAGES = [
  "Quote",
  "Invoice & scheduling",
  "Project start",
  "Project complete",
];

// Which lifecycle stage each email type is sent at. Drives three things:
//   1. the `activeStage` baked into each starter template's progress block
//   2. what the editor preview shows, so a quote template previews at
//      "Quote" rather than pretending the deposit is already paid
//   3. the fallback the send paths use when a record's status doesn't map
//      cleanly onto a stage
// marketing_email and custom_email are absent on purpose — they aren't tied
// to a point in the project lifecycle, so they get no progress block by
// default (a company can still add one and set the stage by hand).
export const STAGE_INDEX = {
  quote_email: 0,
  follow_up_email: 0,
  receipt_email: 1,
  instructions_email: 2,
};

function progressAt(index) {
  return {
    ...newBlock("progress"),
    stages: LIFECYCLE_STAGES,
    activeStage: index,
  };
}

// Default subject lines. Merge tokens work here exactly as in the body.
export const DEFAULT_SUBJECTS = {
  quote_email: "Your quote from {{companyName}} is ready",
  instructions_email: "You're booked in — what to expect on {{projectStartDate}}",
  receipt_email: "Payment received — thank you, {{clientName}}",
  follow_up_email: "Still thinking it over, {{clientName}}?",
  marketing_email: "A note from {{companyName}}",
  custom_email: "A message from {{companyName}}",
};

export function defaultSubjectFor(type) {
  return DEFAULT_SUBJECTS[type] || DEFAULT_SUBJECTS.custom_email;
}

export function defaultSectionsFor(type) {
  if (type === "quote_email") {
    return [
      { ...newBlock("heading"), text: "Your quote is ready" },
      {
        ...newBlock("text"),
        text: "Hi {{clientName}},\n\nThank you for the opportunity to earn your business. We've put together a detailed quote for {{jobTitle}} — everything is broken out below so you can see exactly what's included.\n\nJob address: {{clientAddress}}",
      },
      progressAt(0),
      { ...newBlock("lineItems"), title: "Your quote" },
      {
        ...newBlock("button"),
        label: "View & approve your quote",
        url: "{{quoteUrl}}",
        align: "center",
      },
      {
        ...newBlock("text"),
        text: "Every job includes:\n• Full preparation and protection of the surrounding area\n• Premium materials and professional application\n• Complete cleanup and a final walkthrough with you\n• Our workmanship guarantee",
      },
      newBlock("divider"),
      {
        ...newBlock("text"),
        text: "Questions, or want to adjust anything? Just reply to this email or give us a call — we're happy to talk it through.",
      },
    ];
  }

  if (type === "instructions_email") {
    return [
      { ...newBlock("heading"), text: "You're all set" },
      {
        ...newBlock("text"),
        text: "Hi {{clientName}},\n\nGreat news — {{jobTitle}} is confirmed and on the schedule. Here's everything you need to know before we arrive.",
      },
      progressAt(2),
      {
        ...newBlock("summary"),
      },
      {
        ...newBlock("text"),
        text: "Your booking:\n• Address — {{clientAddress}}\n• Start date — {{projectStartDate}}\n• Estimated completion — {{projectEndDate}}",
      },
      {
        ...newBlock("text"),
        text: "How to prepare:\n• Clear the work area of personal items and furniture where possible\n• Make sure we have clear access to the job site on the start date\n• Keep pets in a separate area during work hours\n• We'll walk you through the finished work before we call the job complete",
      },
      newBlock("divider"),
      {
        ...newBlock("text"),
        text: "Something come up? Let us know as early as you can and we'll find another slot.",
      },
    ];
  }

  if (type === "receipt_email") {
    return [
      { ...newBlock("heading"), text: "Payment received — thank you" },
      {
        ...newBlock("text"),
        text: "Hi {{clientName}},\n\nThis confirms we've received your payment of {{amountPaid}}. Here's your receipt.",
      },
      progressAt(1),
      { ...newBlock("lineItems"), title: "Receipt" },
      {
        ...newBlock("text"),
        text: "Balance remaining: {{balanceDue}}",
        align: "center",
      },
      {
        ...newBlock("button"),
        label: "View your invoice",
        url: "{{invoiceUrl}}",
        align: "center",
      },
      newBlock("divider"),
      {
        ...newBlock("text"),
        text: "Thank you for your business — we genuinely appreciate it.",
      },
    ];
  }

  if (type === "follow_up_email") {
    return [
      { ...newBlock("heading"), text: "Still thinking it over?" },
      {
        ...newBlock("text"),
        text: "Hi {{clientName}},\n\nWe wanted to check in on quote #{{quoteNumber}} for {{jobTitle}}. It's still available at {{quoteTotal}}, and we'd love to get you on the schedule.\n\nIf anything's holding you up — timing, budget, scope — just reply and tell us. We can usually work something out.",
      },
      newBlock("summary"),
      {
        ...newBlock("button"),
        label: "View your quote",
        url: "{{quoteUrl}}",
        align: "center",
      },
      newBlock("divider"),
      {
        ...newBlock("text"),
        text: "No longer need it? Reply and let us know, and we'll stop following up.",
      },
    ];
  }

  if (type === "marketing_email") {
    return [
      { ...newBlock("heading"), text: "A quick note from {{companyName}}" },
      {
        ...newBlock("text"),
        text: "Hi {{clientName}},\n\nWrite your message here — an offer, a seasonal reminder, or an update about your business.",
      },
      { ...newBlock("image"), url: "", alt: "Add a photo of your work" },
      {
        ...newBlock("button"),
        label: "Get a free quote",
        url: "",
        align: "center",
      },
      newBlock("divider"),
      {
        ...newBlock("text"),
        text: "You're receiving this because you're a customer of {{companyName}}.",
      },
    ];
  }

  return [
    { ...newBlock("heading"), text: "Hello {{clientName}}" },
    newBlock("text"),
  ];
}
