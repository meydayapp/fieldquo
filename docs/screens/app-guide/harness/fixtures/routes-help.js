// docs/screens/app-guide/harness/fixtures/routes-help.js
//
// The API surface behind the help centre's figures — the rows of screens.js
// that carry `chapter: "help"`: the detail pages the sidebar rows link to,
// the pages a homeowner opens from a link, and the crew's phone. Consulted
// FIRST in routes.js, so a screen that is the owner's page seen by a Crew
// member (the home page's money tiles answer 403 to Léo, as the real route
// does) can say so here without touching the group file the owner's row
// reads.
//
// Same people, same job, same numbers as company.js and the group files:
// Sophie Dubois's Q-1042 is the quote she approves at /q/…, the deposit on
// INV-2071 is the balance her portal shows, and J-318 is the job on Léo's
// phone. A rep flipping between a figure in "Quotes" and one in "For your
// clients" should see one business.
import { COMPANY, PEOPLE, CLIENT, QUOTE, JOB, INVOICE, day, iso, TODAY } from "./company.js";
import { EVENT_TYPES, SERVICE_CATEGORIES, HANDYMAN_CATEGORY, SEEDED_HANDYMAN, PRODUCTS_FIXTURE, BUSINESS_INFO_FIXTURE } from "./routes-settings-a.js";
import { JOBS, INVOICES, PLANS, TASKS, J_318, INV_2069, INV_2066, Q_1042, Q_1044, Q_1045, Q_1046, LAVOIE, FORTIN, RIVENORD } from "./routes-work.js";
import { PAY_RUNS, PAY_RUN_LINES } from "./routes-money.js";
import { CAMPAIGNS, PLANS as BILLING_PLANS } from "./routes-grow.js";
import { W, TIME_ENTRIES, POLICIES, TEAM_REQUESTS, TEAM_BALANCES, INCIDENTS, CLOCK } from "./routes-people.js";
import { publicIntakeFields } from "@/app/data/quoteIntakeFields";
import { budgetBands } from "@/lib/estimate/budgetBands";
import { effectiveFormFields } from "@/lib/estimate/formFields";
import { sanitiseFunnelSteps } from "@/app/data/funnelBlocks";
import { parsePaymentSchedule } from "@/lib/documents/paymentSchedule";
import { seedRowsFor } from "@/lib/quotes/textBlockDefaults";
import { presentTextBlock } from "@/lib/quotes/textBlocks";
import { GUTTER_MEASUREMENT, ROOF_MEASUREMENT } from "./takeoffs.js";
import { JOB_PHOTOS as JOB_PHOTO_URLS } from "./public.js";
import { INSTALLED_CHECKLISTS } from "./routes-settings-b.js";
import { itemsFromTemplate, answerItem } from "@/lib/checklists/typedItems";

const [MARC, JULIE, SAM, , LEO, ANA] = PEOPLE;
const who = (m) => ({ id: m.userId, name: m.name });
const SLUG = COMPANY.bookingSlug || COMPANY.slug;
const round2 = (n) => Math.round(n * 100) / 100;
const isCrew = (ctx) => ctx.screen?.member === "crew";
const forbidden = () => new Response(JSON.stringify({ error: "Your access level does not include this." }), { status: 403, headers: { "Content-Type": "application/json" } });

// The client-facing fixtures speak the language of the frame: a French
// figure is the French client's page, because the document's language and
// the covering email's agree (AGENTS.md #6) and the figure must show that.
const docLang = (ctx) => (["en", "fr", "es"].includes(ctx.lang) ? ctx.lang : "fr");

// The public shape of the company, as every client route selects it.
const COMPANY_PUBLIC = {
  name: COMPANY.name,
  logoUrl: COMPANY.logoUrl,
  brandColor: COMPANY.brandColor,
  email: COMPANY.email,
  phone: COMPANY.phone,
  website: COMPANY.website,
  address: `${COMPANY.address}, ${COMPANY.city}, ${COMPANY.province} ${COMPANY.postalCode}`,
  paymentTerms: COMPANY.paymentTerms,
  paymentMethods: COMPANY.paymentMethods,
  currency: COMPANY.currency,
  defaultLanguage: "fr",
  province: COMPANY.province,
  country: COMPANY.country,
  taxIdName: COMPANY.taxIdName,
  taxIdNumber: COMPANY.taxIdNumber,
};

// ── /q/<token> — the quote Sophie opens from her email ──────────────────────
// app/api/public/quotes/[token] present(). Still "sent" here: the figure is
// the moment before she taps Approve, with the add-ons the estimator
// attached still unpicked. (company.js's Q-1042 is the accepted quote the
// back office shows; this is the same document a week earlier.)
export const QUOTE_TOKEN = "qt_8f2c1a7d4e";

// ── /q/<token> before it is sent — the estimator's own preview ─────────────
// Since 2026-09-22 the share token is minted when the quote is SAVED, so the
// office can open the client's copy while the quote is still a draft. The
// payload carries `preview: true`, which is what app/api/public/quotes/[token]
// sets for a signed-in member of the owning company and for nobody else — a
// homeowner's payload never has it, and a draft's link answers a stranger with
// the ordinary not-found.
export const QUOTE_PREVIEW_TOKEN = "qt_2d7b4e91c0";

// ── /api/measure/* — what the roofing and gutter takeoff cards ask ─────────
// Answered for the intro email's per-trade frames (TakeoffFrame.jsx). The
// measurement is fixed; the still is a live tile when a key was given.
const MEASURE_ROUTES = [
  { path: "/api/measure/roof", reply: () => ROOF_MEASUREMENT },
  { path: "/api/measure/gutters", reply: () => GUTTER_MEASUREMENT },
];
const ADD_ONS = [
  { id: "ao1", description: "Under-cabinet LED lighting", detail: "Warm white strip under every upper run, hard-wired to a wall switch", amount: 640, taxable: true, selected: false },
  { id: "ao2", description: "Pull-out waste and recycling", detail: "Two-bin unit in the base beside the sink", amount: 385, taxable: true, selected: false },
  { id: "ao3", description: "Soft-close upgrade on all drawers", detail: "Blum undermount runners", amount: 520, taxable: true, selected: true },
];
const SCOPE_GROUPS = [
  {
    label: "Kitchen cabinets",
    subtotal: 17620,
    accent: null,
    description: "Every box and door built in our Laval shop, sprayed in the booth, installed level and plumb.",
    included: ["Site measure and shop drawings for approval", "Soft-close hinges on every door", "Removal and disposal of the old cabinets", "Two-year workmanship warranty"],
    mayChange: [{ title: "Countertops", body: "Quoted separately once the boxes are set — the template is taken on site." }],
    lineItems: QUOTE.items.slice(0, 3).map((it) => ({ description: `${it.name} — ${it.description}`, quantity: it.quantity, amount: it.total })),
  },
  {
    label: "Installation",
    subtotal: 830,
    accent: null,
    description: "",
    included: ["Two installers, two days", "Hardware fitted and hinges adjusted before we leave"],
    mayChange: [],
    lineItems: [{ description: "Installation — 2 installers, 2 days", quantity: 2, amount: 830 }],
  },
];
const publicQuote = (ctx) => ({
  quoteNumber: QUOTE.quoteNumber,
  status: "sent",
  language: docLang(ctx),
  notes: "Colour: Benjamin Moore OC-17 White Dove on the perimeter; the island stays natural white oak with a matte clear coat.",
  processNotes: COMPANY.defaultProcessNotes,
  validUntil: QUOTE.validUntil,
  sentAt: QUOTE.sentAt,
  subtotal: QUOTE.subtotal,
  discount: 0,
  tax: QUOTE.taxTotal,
  taxKind: "charged",
  taxAssumedRegion: null,
  total: QUOTE.total,
  acceptedTotal: null,
  taxRate: COMPANY.taxRate / 100,
  addOns: ADD_ONS,
  client: { name: CLIENT.name },
  company: COMPANY_PUBLIC,
  financing: null,
  scopeGroups: SCOPE_GROUPS,
  glossary: [
    { term: "Shaker", body: "A flat centre panel framed by four square-edged rails — the plainest door profile, and the one that hides wear best." },
    { term: "Rift sawn", body: "White oak cut so the grain runs straight and tight across the face, with none of the cathedral figure of plain-sawn boards." },
  ],
  processSteps: [
    { num: 1, title: "Measure", body: "We measure on site and draw every elevation for your approval.", timeline: "Week 1" },
    { num: 2, title: "Build", body: "Boxes, doors and the island are built and sprayed in our Laval shop.", timeline: "Weeks 2–5" },
    { num: 3, title: "Install", body: "Day one we remove the old cabinets and set the boxes; day two we hang doors and fit hardware.", timeline: "Week 6" },
  ],
  paymentTerms: COMPANY.paymentTerms,
  paymentSchedule: [
    { pct: "50%", label: "Deposit to book the shop time" },
    { pct: "50%", label: "Balance on installation" },
  ],
  // ── The proposal beside the document (client mockup §1, 2026-09-21) ──
  // Every section the fixture company has content for, in the shape
  // app/api/public/quotes/[token] publishes: rendered sections only, no ids.
  // The day plan is what lib/proposal/sections.js dayPlan() derives from
  // the cabinet takeoff's hours for a crew of two; the waiver is attached,
  // pending, with its public token.
  proposal: proposalFor(ctx),
});

const proposalFor = (ctx) => {
  const lang = docLang(ctx);
  const t = (en, fr, es) => (lang === "fr" ? fr : lang === "es" ? es : en);
  return {
    sections: ["about", "beforeAfter", "documents", "testimonials", "services"],
    about: {
      headline: t("Two brothers, one shop, sixteen years", "Deux frères, un atelier, seize ans", "Dos hermanos, un taller, dieciséis años"),
      story: t(
        "Érable started in a garage in Laval in 2010. Today four of us build, spray and install every kitchen ourselves — one of the two brothers is on every site, and we don't leave until you've opened every door.",
        "Érable a commencé dans un garage à Laval en 2010. Aujourd'hui, nous sommes quatre à fabriquer, peindre et installer chaque cuisine nous-mêmes — l'un des deux frères est sur chaque chantier, et nous ne partons pas avant que vous ayez ouvert chaque porte.",
        "Érable empezó en un garaje de Laval en 2010. Hoy somos cuatro los que fabricamos, pintamos e instalamos cada cocina — uno de los dos hermanos está en cada obra, y no nos vamos hasta que haya abierto cada puerta.",
      ),
      videoUrl: null,
      teamPhotoUrl: JOB_PHOTO_URLS[5],
    },
    gallery: [
      { before: JOB_PHOTO_URLS[4], after: JOB_PHOTO_URLS[0], caption: t("Split-level in Vimont — dated oak to white shaker", "Split-level à Vimont — chêne daté vers shaker blanc", "Casa en Vimont — roble antiguo a shaker blanco") },
      { before: JOB_PHOTO_URLS[2], after: JOB_PHOTO_URLS[3], caption: t("Rift white oak island, Sainte-Rose", "Îlot en chêne blanc, Sainte-Rose", "Isla de roble blanco, Sainte-Rose") },
    ],
    documents: [
      { type: "insurance", title: t("Certificate of insurance", "Certificat d'assurance", "Certificado de seguro"), summary: t("$2M liability · to Mar 31, 2027", "Responsabilité 2 M$ · jusqu'au 31 mars 2027", "Responsabilidad 2 M$ · hasta el 31 mar 2027"), url: "https://res.cloudinary.com/demo/raw/upload/coi.pdf", mimeType: "application/pdf" },
      { type: "licence", title: t("RBQ licence", "Licence RBQ", "Licencia RBQ"), summary: "RBQ 5812-4471-01", url: "https://res.cloudinary.com/demo/raw/upload/rbq.pdf", mimeType: "application/pdf" },
      { type: "warranty", title: t("Workmanship warranty", "Garantie de main-d'œuvre", "Garantía de mano de obra"), summary: t("5 years on finish and hardware", "5 ans sur la finition et la quincaillerie", "5 años en acabado y herrajes"), url: "https://res.cloudinary.com/demo/raw/upload/warranty.pdf", mimeType: "application/pdf" },
    ],
    testimonials: [
      { quote: t("They measured twice, showed up when they said, and the island is dead level. Our kitchen looks like a magazine.", "Ils ont mesuré deux fois, sont venus quand ils l'ont dit, et l'îlot est parfaitement de niveau. Notre cuisine ressemble à un magazine.", "Midieron dos veces, llegaron cuando dijeron, y la isla está perfectamente nivelada. Nuestra cocina parece de revista."), author: "Priya M. — ★★★★★ — Google" },
      { quote: t("Fixed a sagging pantry two other shops said needed replacing. Hasn't moved since.", "Ils ont réparé un garde-manger affaissé que deux autres ateliers voulaient remplacer. Il n'a pas bougé depuis.", "Arreglaron una despensa vencida que otros dos talleres querían reemplazar. No se ha movido desde entonces."), author: "Tom & Elise R." },
    ],
    services: SERVICE_CATEGORIES.filter((c) => c.enabled).slice(0, 4).map((c) => ({ key: c.key, label: c.label })),
    plan: {
      crewSize: 2,
      days: [
        { day: 1, labels: [t("Remove old cabinets, set boxes", "Retirer les anciennes armoires, poser les caissons", "Retirar gabinetes viejos, colocar cajas")], hours: 16, halfDay: false },
        { day: 2, labels: [t("Hang doors, fit hardware, island", "Poser les portes, la quincaillerie, l'îlot", "Colgar puertas, herrajes, isla")], hours: 16, halfDay: false },
        { day: 3, labels: [t("Touch-ups, walkthrough", "Retouches, visite finale", "Retoques, recorrido final")], hours: 5, halfDay: true },
      ],
      paint: { products: ["Benjamin Moore Advance"], coats: [2] },
    },
    waivers: [
      {
        token: "wv_fixture000000000000001",
        title: t("Release of liability — cabinet installation", "Décharge de responsabilité — installation d'armoires", "Exención de responsabilidad — instalación de gabinetes"),
        sections: [
          { heading: t("Furniture and belongings", "Meubles et effets personnels", "Muebles y pertenencias"), text: t("We move and cover furniture in the rooms we work in. Fragile items, electronics and valuables should be removed by you before we arrive.", "Nous déplaçons et couvrons les meubles dans les pièces où nous travaillons. Les objets fragiles, l'électronique et les objets de valeur doivent être retirés par vous avant notre arrivée.", "Movemos y cubrimos los muebles de las habitaciones donde trabajamos. Los objetos frágiles, la electrónica y los objetos de valor deben retirarse antes de nuestra llegada.") },
          { heading: t("Existing surfaces", "Surfaces existantes", "Superficies existentes"), text: t("Removing old cabinets can reveal damage behind them. Repairs beyond the quoted lines are agreed with you as a change order before they are done.", "Le retrait des anciennes armoires peut révéler des dommages derrière elles. Les réparations au-delà des lignes soumises sont convenues avec vous par avenant avant d'être faites.", "Retirar los gabinetes viejos puede revelar daños detrás. Las reparaciones más allá de lo presupuestado se acuerdan con usted como orden de cambio antes de hacerse.") },
        ],
        acknowledgements: [
          t("I understand I am responsible for removing fragile items and valuables before the crew arrives.", "Je comprends que je suis responsable de retirer les objets fragiles et de valeur avant l'arrivée de l'équipe.", "Entiendo que soy responsable de retirar los objetos frágiles y de valor antes de que llegue la cuadrilla."),
          t("I understand that hidden damage may show once the old cabinets are out and that additional repair is quoted separately.", "Je comprends que des dommages cachés peuvent apparaître une fois les anciennes armoires retirées et que toute réparation supplémentaire est soumise séparément.", "Entiendo que pueden aparecer daños ocultos al retirar los gabinetes viejos y que cualquier reparación adicional se presupuesta por separado."),
        ],
        status: "pending",
        signedAt: null,
        signedName: null,
      },
    ],
  };
};

// ── /portal/<token> — Sophie's portal ───────────────────────────────────────
export const PORTAL_TOKEN = "pt_3a9d7c2f1b";
const portal = (ctx) => ({
  clientName: CLIENT.name,
  language: docLang(ctx),
  company: COMPANY_PUBLIC,
  onlinePayments: true,
  quotes: [
    { id: QUOTE.id, quoteNumber: QUOTE.quoteNumber, total: QUOTE.total, createdAt: QUOTE.createdAt, status: "accepted", shareToken: QUOTE_TOKEN },
    { id: "q_1021", quoteNumber: "Q-1021", total: 2874.52, createdAt: iso(day(-140, 10)), status: "declined", shareToken: "qt_old_1021" },
  ],
  invoices: [
    {
      id: INVOICE.id, invoiceNumber: INVOICE.invoiceNumber, total: INVOICE.total, amountPaid: 0, dueDate: INVOICE.dueDate,
      // INVOICE.items is the harness's list-row shape ({ name, unitPrice,
      // total }); the portal reads Invoice.lineItems ({ description, amount }),
      // so passed through raw it printed a blank line at $0.00.
      lineItems: INVOICE.items.map((it) => ({ description: it.name, quantity: it.quantity, rate: it.unitPrice, amount: it.total })), notes: null, subtotal: INVOICE.subtotal, discount: 0, tax: INVOICE.taxTotal,
      jobPaymentStages: [], taxKind: "charged", taxAssumedRegion: null,
    },
  ],
  // The job card (app/portal/[token]/JobProgressCard.js): the plan's
  // client-visible steps as the route derives them — status, what each
  // waits on, the photos filed against a step. No notes, hours or money.
  jobs: [
    {
      id: JOB.id, title: JOB.title, status: JOB.status, startDate: iso(day(-8, 8)), endDate: JOB.endDate, completedAt: null, onSchedule: true,
      steps: [
        { id: "st_1", title: "Cut and assemble carcasses — uppers and bases", status: "done", waitingOn: [], dueDate: iso(day(-8, 8)), doneAt: iso(day(-4, 16)), photos: [] },
        { id: "st_2", title: "Doors and drawer fronts — prime and spray", status: "done", waitingOn: [], dueDate: iso(day(-2, 8)), doneAt: iso(day(-1, 17)), photos: [{ id: "jp_3", url: JOB_PHOTO_URLS[3], at: iso(day(-1, 16, 40)) }, { id: "jp_2b", url: JOB_PHOTO_URLS[2], at: iso(day(-1, 16, 45)) }] },
        { id: "st_3", title: "Island top — glue up, sand, first coat", status: "in_progress", waitingOn: [], dueDate: iso(day(0, 8)), doneAt: null, photos: [{ id: "jp_2", url: JOB_PHOTO_URLS[1], at: iso(day(0, 11, 38)) }] },
        { id: "st_4", title: "Install base run and uppers", status: "not_started", waitingOn: [], dueDate: iso(day(1, 8)), doneAt: null, photos: [] },
        { id: "st_5", title: "Install island and waterfall end", status: "waiting", waitingOn: [{ kind: "change_order", label: "CO-2", changeOrderLabel: "CO-2", shareToken: CO_TOKEN }], dueDate: iso(day(2, 8)), doneAt: null, photos: [] },
        { id: "st_6", title: "Hardware, adjust doors, final clean", status: "waiting", waitingOn: [{ kind: "task", label: "Install island and waterfall end" }], dueDate: iso(day(2, 13)), doneAt: null, photos: [] },
        { id: "st_8", title: "Countertop template — Granite Lachapelle", status: "waiting", waitingOn: [{ kind: "external", label: "the countertop shop's templating slot · Thu a.m." }], dueDate: iso(day(3, 9)), doneAt: null, photos: [] },
      ],
      changeOrders: [{ id: "co_2", label: "CO-2", description: "Island top upgraded to 2-inch white oak with a mitred waterfall", shareToken: CO_TOKEN }],
      onSite: [{ name: LEO.name, since: iso(day(0, 8, 10)) }, { name: ANA.name, since: iso(day(0, 8, 25)) }],
    },
  ],
});

// ── /co/<token> — the change-order addendum (app/co/[token]) ───────────────
// GET /api/public/change-orders/[token]: what the homeowner sees before
// signing CO-2 — the original line, the change, the delta with tax at the
// quote's rate, the new total and the schedule. Never anything else about
// the job.
export const CO_TOKEN = "co_9c2e7b1a4f";
const changeOrderPublic = (ctx) => {
  const change = 640;
  const rate = QUOTE.taxTotal / QUOTE.subtotal;
  const tax = round2(change * rate);
  return {
    language: docLang(ctx),
    company: { name: COMPANY.name, logoUrl: COMPANY.logoUrl, brandColor: COMPANY.brandColor, phone: COMPANY.phone, email: COMPANY.email, currency: COMPANY.currency },
    client: { name: CLIENT.name, address: `${CLIENT.address}, ${CLIENT.city}` },
    quote: { quoteNumber: QUOTE.quoteNumber, acceptedAt: iso(day(-6, 15)) },
    changeOrder: {
      id: "co_2", label: "CO-2", description: "Island top upgraded to 2-inch white oak with a mitred waterfall",
      bodyHtml: "<p>The 1.5-inch top we quoted reads thin beside the waterfall end. A <b>2-inch</b> slab, mitred at the corner, carries the grain down the side in one piece.</p>",
      priceDelta: change, scheduleDeltaDays: 1, photos: [JOB_PHOTO_URLS[1]],
      originalLine: { description: "Island — white oak, rift sawn (7 ft × 3 ft, waterfall end)", amount: 4200, quantity: 1 },
      createdAt: iso(day(0, 11, 40)), status: "waiting_client", signedBy: null, signedAt: null,
    },
    money: { quoteTotal: QUOTE.total, priorApproved: 385, change, taxRate: rate, tax, changeWithTax: round2(change + tax), newTotal: round2(QUOTE.total + 385 * (1 + rate) + change + tax), taxKnown: true },
    schedule: { finishBefore: JOB.endDate, finishAfter: iso(day(3, 17)) },
  };
};

// ── /book/<slug> — the booking page ─────────────────────────────────────────
// app/api/booking/[companySlug]: the public columns plus the two active
// event types Settings › Booking page lists, and the enabled services as
// { key, label }. Two event types, so the flow opens on the menu; the scene
// picks the consultation to reach the calendar.
const bookingCompany = () => ({
  id: COMPANY.id,
  name: COMPANY.name,
  logoUrl: COMPANY.logoUrl,
  brandColor: COMPANY.brandColor,
  phone: COMPANY.phone,
  email: COMPANY.email,
  currency: COMPANY.currency,
  bookingModes: COMPANY.bookingModes,
  defaultLanguage: "fr",
  eventTypes: EVENT_TYPES.map((e) => ({
    id: e.id, name: e.name, slug: e.slug, durationMinutes: e.durationMinutes,
    feeCents: e.promoActive && e.promoFeeCents != null ? e.promoFeeCents : e.feeCents,
    feeStandardCents: e.promoActive && e.promoFeeCents != null ? e.feeCents : null,
    // Each mode's preset, as app/api/booking/[companySlug] resolves it from
    // lib/booking/fee.js: the event's own length and fee for a visit, the
    // company's call length (default 20) and a free call. No `location` —
    // the route stopped sending that free-text label.
    modes: Object.fromEntries(
      COMPANY.bookingModes.map((m) => [
        m,
        m === "visit"
          ? {
              minutes: e.durationMinutes,
              feeCents: e.promoActive && e.promoFeeCents != null ? e.promoFeeCents : e.feeCents || 0,
              feeStandardCents: e.promoActive && e.promoFeeCents != null ? e.feeCents : null,
            }
          : { minutes: m === "call" ? 20 : 30, feeCents: 0, feeStandardCents: null },
      ]),
    ),
  })),
  services: SERVICE_CATEGORIES.filter((c) => c.enabled).map((c) => ({ key: c.key, label: c.label })),
});
// Working days from tomorrow to the end of the month, three starts a day,
// in the company's timezone (Toronto, UTC-4 in September).
const slotsBetween = (from, to) => {
  const out = {};
  const start = new Date(`${from}T00:00:00-04:00`);
  const end = new Date(`${to}T00:00:00-04:00`);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    if (d.getTime() <= TODAY.getTime()) continue;
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
    const k = `${y}-${m}-${dd}`;
    const hours = dow === 5 ? [9, 11] : dow === 3 ? [9, 13, 15] : [9, 11, 14];
    out[k] = hours.map((h) => new Date(`${k}T${String(h).padStart(2, "0")}:00:00-04:00`).toISOString());
  }
  return out;
};

// ── /visit/<token> — manage a booked visit ──────────────────────────────────
// lib/booking/manageVisit.js visitView(): Sophie's design consultation,
// Thursday morning, booked against Q-1042, the promo fee paid.
export const VISIT_TOKEN = "vm_5c1e8b3a2d";
const visitView = (ctx) => ({
  status: "confirmed",
  clientName: CLIENT.name,
  eventTypeName: EVENT_TYPES[0].name,
  startTime: iso(day(3, 9, 30)),
  endTime: iso(day(3, 10, 30)),
  durationMinutes: 60,
  timezone: COMPANY.timezone,
  mode: "visit",
  address: `${CLIENT.address}, ${CLIENT.city}, ${CLIENT.province} ${CLIENT.postalCode}`,
  language: docLang(ctx),
  arrivalWindowMinutes: COMPANY.arrivalWindowMinutes,
  company: { name: COMPANY.name, logoUrl: COMPANY.logoUrl, brandColor: COMPANY.brandColor, phone: COMPANY.phone, currency: COMPANY.currency },
  fee: { paidCents: 4900, currency: "CAD", refundedAt: null, refundedCents: null },
  quoteNumber: QUOTE.quoteNumber,
  policy: { canChange: true, reason: "ok", hoursLeft: 68, noticeHours: COMPANY.bookingChangeNoticeHours },
  refund: { willRefund: true, reason: "before_cutoff", amountCents: 4900, cutoffHours: COMPANY.refundCutoffHours },
});

// ── /quote/<slug> — the self-quote form ─────────────────────────────────────
// app/api/self-quote/[companySlug]: enabled categories with their public
// intake fields (number and select only, three at most — the same helper the
// route calls), never a rate (non-negotiable #4).
const selfQuote = (ctx) => ({
  company: { name: COMPANY.name, logoUrl: COMPANY.logoUrl, brandColor: COMPANY.brandColor, phone: COMPANY.phone, email: COMPANY.email, currency: COMPANY.currency },
  // The first language is the one the form opens in; the frame's language
  // leads so the French figure is the form in French.
  languages: [docLang(ctx), ...["fr", "en"].filter((l) => l !== docLang(ctx))],
  services: SERVICE_CATEGORIES.filter((c) => c.enabled)
    .map((c) => ({ id: c.id, key: c.key, label: c.label, icon: c.icon, fields: publicIntakeFields(c.key) }))
    .sort((a, b) => a.label.localeCompare(b.label)),
  booking: { canBookVisit: true, slug: SLUG },
});

// ── /instant-quote/<slug> — the instant estimator ───────────────────────────
// app/api/instant-quote/[companySlug]: the trades Settings › Instant quotes
// has switched on, as mode names and labels — the range itself only ever
// comes back from POST /measure, which is not on the page at first paint.
//
// The docs/screens/form-look rows (screens.js, slugs `form-look-tf-*`) ask
// for the same payload in TrueFinish's shape — the owner's real company,
// whose three instant trades are this fixture's two plus stairs, and whose
// brand is the gold on its row — with the photos field optional on the row
// whose slug says so. The row is read off window.__harness, which guide.jsx
// sets before anything fetches; every other screen gets the cabinet maker.
const instantQuote = (ctx) => {
  const language = docLang(ctx) === "fr" ? "fr" : "en";
  const bands = budgetBands(null, { currency: COMPANY.currency, language }).map((b) => ({ index: b.index, label: b.label }));
  const slug = (typeof window !== "undefined" && window.__harness?.slug) || "";
  const trueFinish = slug.startsWith("form-look-tf");
  const savedFields = slug.includes("photos-optional") ? { photos: "optional", notes: "optional" } : null;
  const fields = effectiveFormFields(savedFields, { measure: "manual_units", serviceAreaConfigured: false }).fields;
  return {
    company: trueFinish
      ? { name: "TrueFinish Cabinets Inc.", slug: SLUG, logoUrl: null, brandColor: "#bd9d60" }
      : { name: COMPANY.name, slug: SLUG, logoUrl: COMPANY.logoUrl, brandColor: COMPANY.brandColor },
    mapsKey: null,
    language,
    currency: COMPANY.currency,
    trades: [
      { trade: "cabinet_refinishing", label: "Cabinet refinishing", estimateDisplay: trueFinish ? "after_submit" : "range", budgetBands: bands, measure: "manual_units", hasMaterials: false, materials: [], fields },
      {
        trade: "cabinet_refacing", label: "Cabinet refacing", estimateDisplay: trueFinish ? "after_submit" : "range", budgetBands: bands, measure: "manual_units", hasMaterials: true,
        materials: [
          { key: "shaker_painted_mdf", label: "Shaker, painted MDF" },
          { key: "shaker_maple", label: "Shaker, painted maple" },
          { key: "slab_white_oak", label: "Slab, white oak veneer" },
        ],
        fields,
      },
      ...(trueFinish
        ? [{ trade: "stair", label: "Stairs & Railings", estimateDisplay: "after_submit", budgetBands: bands, measure: "stair_count", hasMaterials: false, materials: [], fields }]
        : []),
    ],
    booking: { canBookVisit: true, slug: SLUG },
  };
};

// ── /f/<slug>/<funnel> — the kitchen landing page ───────────────────────────
// One funnel, shared by the builder (app/app/funnels/[id], GET /api/funnels/
// [id]) and the public runner (GET /api/funnels/public/…): the steps go
// through the same sanitiser the save route and the public route apply, so a
// step this file gets wrong is dropped here the way it would be there.
export const FUNNEL_STEPS = sanitiseFunnelSteps([
  { id: "s_intro", kind: "intro", headline: "A new kitchen, priced in two minutes", subhead: "Answer four quick questions and we'll come back with a range — no visit needed for a first number.", buttonText: "Start" },
  {
    id: "s_style", kind: "question_single", question: "What look are you after?", help: "Pick the closest — we can mix.",
    answers: [
      { id: "a_shaker", label: "Shaker, painted", value: "shaker", weight: 10 },
      { id: "a_slab", label: "Flat slab, wood veneer", value: "slab", weight: 10 },
      { id: "a_mixed", label: "Painted perimeter, wood island", value: "mixed", weight: 20 },
      { id: "a_unsure", label: "Not sure yet", value: "unsure", weight: 0 },
    ],
  },
  {
    id: "s_scope", kind: "question_multi", question: "What's in scope?", buttonText: "Next",
    answers: [
      { id: "b_uppers", label: "Upper cabinets", value: "uppers", weight: 5 },
      { id: "b_bases", label: "Base cabinets", value: "bases", weight: 5 },
      { id: "b_island", label: "An island", value: "island", weight: 15 },
      { id: "b_pantry", label: "A pantry wall", value: "pantry", weight: 10 },
    ],
  },
  {
    id: "s_budget", kind: "question_single", question: "Roughly what budget do you have in mind?", maps: "budget",
    answers: [
      { id: "c_1", label: "Under $15,000", value: "under_15k", weight: 0, maps: "budget" },
      { id: "c_2", label: "$15,000 – $30,000", value: "15_30k", weight: 10, maps: "budget" },
      { id: "c_3", label: "$30,000 – $50,000", value: "30_50k", weight: 20, maps: "budget" },
      { id: "c_4", label: "Over $50,000", value: "over_50k", weight: 25, maps: "budget" },
    ],
  },
  { id: "s_form", kind: "form", headline: "Where should we send your range?", subhead: "We reply within one business day.", buttonText: "Send me my range", fields: ["name", "email", "phone"], consent: "By sending this you agree to be contacted about your kitchen." },
  { id: "s_thanks", kind: "thankyou", headline: "Thanks — your range is on its way.", subhead: "Marc or Samuel will call to talk through it and book a measure if you'd like one." },
]);
export const FUNNEL = {
  id: "fn_kitchen",
  name: "Kitchen quote — landing page",
  slug: "kitchen-quote",
  status: "published",
  channel: "web",
  steps: FUNNEL_STEPS,
  theme: null,
  metaPixelId: null,
  tiktokPixelId: null,
  ga4Id: null,
  createdAt: iso(day(-40, 9)),
  updatedAt: iso(day(-3, 15)),
  publishedAt: iso(day(-30, 11)),
  _count: { responses: 14 },
};
const publicFunnel = () => ({
  company: { name: COMPANY.name, logoUrl: COMPANY.logoUrl, brandColor: COMPANY.brandColor, phone: COMPANY.phone, currency: COMPANY.currency },
  funnel: { id: FUNNEL.id, name: FUNNEL.name, slug: FUNNEL.slug, steps: FUNNEL.steps, theme: null, pixels: { meta: null, tiktok: null, ga4: null } },
});

// ── /design/<token> — the kitchen Sophie can move around ────────────────────
// app/api/kitchen-design/[token] GET, prices stripped: a U-shaped kitchen on
// walls A, B and D with the white-oak island in the middle. Inches, the way
// lib/kitchen/geometry.js measures.
export const DESIGN_TOKEN = QUOTE_TOKEN;
const el = (id, kind, wall, pos, width, height, depth, config = {}) => ({ id, kind, wall, pos, width, height, depth, config });
const KITCHEN = {
  serviceType: "kitchen",
  room: { width: 168, depth: 144, ceiling: 96, walls: { A: { length: 168, ceiling: 96 }, B: { length: 144, ceiling: 96 }, C: { length: 168, ceiling: 96 }, D: { length: 144, ceiling: 96 } } },
  elements: [
    el("e1", "sinkBase", "A", 60, 36, 34.5, 24, { doors: 2, doorMaterial: "shaker_painted", boxMaterial: "plywood" }),
    el("e2", "drawerBase", "A", 24, 36, 34.5, 24, { doorMaterial: "shaker_painted", boxMaterial: "plywood" }),
    el("e3", "dishwasher", "A", 96, 24, 34.5, 24),
    el("e4", "base", "A", 120, 30, 34.5, 24, { doors: 2, doorMaterial: "shaker_painted", boxMaterial: "plywood" }),
    el("e5", "wall", "A", 24, 36, 30, 12, { doors: 2, doorMaterial: "shaker_painted", boxMaterial: "plywood" }),
    el("e6", "wall", "A", 60, 36, 30, 12, { doors: 2, doorMaterial: "shaker_painted", boxMaterial: "plywood" }),
    el("e7", "wall", "A", 120, 30, 30, 12, { doors: 2, doorMaterial: "shaker_painted", boxMaterial: "plywood" }),
    el("e8", "window", "A", 62, 36, 42, 4),
    el("e9", "stove", "B", 36, 30, 36, 25),
    el("e10", "hoodCabinet", "B", 36, 30, 24, 12, { doorMaterial: "shaker_painted", boxMaterial: "plywood" }),
    el("e11", "base", "B", 66, 30, 34.5, 24, { doors: 2, doorMaterial: "shaker_painted", boxMaterial: "plywood" }),
    el("e12", "wall", "B", 66, 30, 30, 12, { doors: 2, doorMaterial: "shaker_painted", boxMaterial: "plywood" }),
    el("e13", "fridge", "D", 24, 36, 70, 30),
    el("e14", "fridgeSurround", "D", 24, 36, 96, 24, { doorMaterial: "shaker_painted", boxMaterial: "plywood" }),
    el("e15", "tall", "D", 60, 24, 84, 24, { doors: 2, doorMaterial: "shaker_painted", boxMaterial: "plywood" }),
    el("e16", "island", "C", 48, 84, 36, 36, { doors: 4, doorMaterial: "slab_white_oak", boxMaterial: "plywood" }),
  ],
  finish: { doorMaterial: "shaker_painted", colour: "OC-17 White Dove", islandMaterial: "slab_white_oak" },
  modules: null,
  accessories: [{ id: "soft_close", quantity: 1 }, { id: "pullout_waste", quantity: 1 }],
};
const kitchenDesign = () => ({
  quoteNumber: QUOTE.quoteNumber,
  clientName: CLIENT.name,
  companyName: COMPANY.name,
  companyLogoUrl: COMPANY.logoUrl,
  companyBrandColor: COMPANY.brandColor,
  locked: false,
  kitchenConfig: KITCHEN,
});


// ═══════════════════════════════════════════════════════════════════════════
// The back office's detail pages
// ═══════════════════════════════════════════════════════════════════════════

// ── /app/quotes/q_1042 ──────────────────────────────────────────────────────
// app/api/quotes/[id]: the row with client, company, assignedTo, invoices,
// scopeGroups (category + lineItems + takeoff) and addOns. Accepted, and
// converted into INV-2071's deposit, so the page shows the "already
// converted" band the sales rep is asked about most.
const CAT_KITCHEN = SERVICE_CATEGORIES[0];
const QUOTE_DETAIL = {
  ...Q_1042,
  discount: 0,
  tax: QUOTE.taxTotal,
  taxEnabled: true,
  acceptedTotal: null,
  notes: "Colour: Benjamin Moore OC-17 White Dove on the perimeter; the island stays natural white oak with a matte clear coat.",
  processNotes: null,
  clientPhotos: [],
  historicalImportedAt: null,
  clientDesignAt: iso(day(-8, 20, 15)),
  sentToEmail: CLIENT.email,
  followUpSentAt: iso(day(-10, 9)),
  followUpCount: 1,
  canOpenKitchenDesigner: true,
  importedGroupIds: [],
  client: { id: CLIENT.id, name: CLIENT.name, contactName: null, email: CLIENT.email, phone: CLIENT.phone, address: CLIENT.address, city: CLIENT.city, province: CLIENT.province, country: CLIENT.country, language: CLIENT.language },
  company: { currency: COMPANY.currency, outboundCallsEnabled: true },
  invoices: [{ id: INVOICE.id, invoiceNumber: INVOICE.invoiceNumber, status: INVOICE.status }],
  scopeGroups: [
    {
      id: "sg_1042a", label: "Kitchen cabinets", subtotal: 17620, sortOrder: 0, categoryId: CAT_KITCHEN.id,
      category: { id: CAT_KITCHEN.id, key: CAT_KITCHEN.key, label: CAT_KITCHEN.label, icon: CAT_KITCHEN.icon },
      lineItems: [
        { description: "Upper cabinets — shaker, painted", detail: "12 lin. ft, soft-close hinges", quantity: 12, unit: "lin. ft", rate: 425, amount: 5100 },
        { description: "Base cabinets — shaker, painted", detail: "16 lin. ft, dovetail drawers", quantity: 16, unit: "lin. ft", rate: 520, amount: 8320 },
        { description: "Island — white oak, rift sawn", detail: "7 ft × 3 ft, waterfall end", quantity: 1, unit: "ea", rate: 4200, amount: 4200, meta: { complexityLevel: "high", baseUnitPrice: 3600, complexityReasons: ["waterfall_end", "rift_sawn"] } },
      ],
      takeoff: { doorCount: 26, drawerCount: 9, boxLinearFt: 28 },
      intakeValues: { doorCount: 26, drawerCount: 9, boxLinearFt: 28 },
    },
    {
      id: "sg_1042b", label: "Installation", subtotal: 830, sortOrder: 1, categoryId: CAT_KITCHEN.id,
      category: { id: CAT_KITCHEN.id, key: CAT_KITCHEN.key, label: CAT_KITCHEN.label, icon: CAT_KITCHEN.icon },
      lineItems: [{ description: "Installation", detail: "2 installers, 2 days", quantity: 2, unit: "day", rate: 415, amount: 830 }],
      takeoff: null,
      intakeValues: null,
    },
  ],
  addOns: ADD_ONS.map((a, i) => ({ ...a, sortOrder: i, source: "estimator", selected: a.selected, selectedAt: a.selected ? QUOTE.approvedAt : null })),
};
const QUOTE_DOCUMENT = {
  groups: QUOTE_DETAIL.scopeGroups.map((g, i) => ({
    id: g.id, categoryKey: g.category.key, label: g.label, subtotal: g.subtotal, accent: null,
    description: SCOPE_GROUPS[i].description, included: SCOPE_GROUPS[i].included, mayChange: SCOPE_GROUPS[i].mayChange,
  })),
  processSteps: publicQuote({ lang: "en" }).processSteps,
  glossary: publicQuote({ lang: "en" }).glossary.map((g) => ({ title: g.term, body: g.body })),
  processNotes: COMPANY.defaultProcessNotes,
  processNotesSource: "company",
  paymentTerms: COMPANY.paymentTerms,
  paymentSchedule: parsePaymentSchedule(COMPANY.paymentTerms),
};
// app/api/quotes/[id]/costing — what the shop expects the job to cost against
// the price, from the crew's rates and the material recipes.
const QUOTE_COSTING = {
  saved: true,
  labourHours: 96,
  labourCost: 3552,
  materialTotal: 6840,
  unpricedMaterials: 0,
  overhead: 1845,
  overheadBasis: "pct_of_price",
  overheadPct: 10,
  estimatedCost: 12237,
  price: QUOTE.subtotal,
  profit: 6213,
  marginPct: 33.7,
  marginTargetPct: 30,
  signal: "green",
  costIncomplete: false,
  crew: [
    { name: LEO.name, hourlyRate: 34, hours: 48, cost: 1632 },
    { name: ANA.name, hourlyRate: 40, hours: 48, cost: 1920 },
  ],
  blendedRate: 37,
  groups: [
    {
      label: "Kitchen cabinets", categoryKey: CAT_KITCHEN.key, labourHours: 80, materialTotal: 6840,
      materials: [
        { name: "Maple plywood 3/4\" — boxes", qty: 22, unit: "sheet", unitCost: 96, cost: 2112, unpriced: false },
        { name: "MDF shaker doors — 26", qty: 26, unit: "ea", unitCost: 68, cost: 1768, unpriced: false },
        { name: "White oak, rift sawn — island", qty: 1, unit: "lot", unitCost: 1890, cost: 1890, unpriced: false },
        { name: "Blum soft-close hinges", qty: 52, unit: "ea", unitCost: 6.5, cost: 338, unpriced: false },
        { name: "Primer, lacquer, tint", qty: 1, unit: "lot", unitCost: 732, cost: 732, unpriced: false },
      ],
    },
    { label: "Installation", categoryKey: CAT_KITCHEN.key, labourHours: 16, materialTotal: 0, materials: [] },
  ],
  addedLabourHours: 0,
  addedMaterialCost: 0,
  labourRate: 37,
  note: "Island oak priced from Langevin's July quote.",
};
const EMAIL_SECTIONS = {
  quoteId: QUOTE.id,
  sections: [
    { key: "references", included: true, inherited: true, source: "company", items: [{ name: "Isabelle Fortin", city: "Sainte-Rose" }, { name: "Karim Bensaïd", city: "Vimont" }], companyDefault: true, companyItemCount: 2, blocksSend: false },
    { key: "beforeAfter", included: false, inherited: true, source: "company", items: [], companyDefault: false, companyItemCount: 0, blocksSend: false },
  ],
  blocked: [],
  blockedDetail: [],
};

// Lavoie's refacing quote, sent last Thursday and still open — the page
// with Send again, Follow up and Get approved on it, which the accepted
// Q-1042 above no longer shows.
const CAT_REFACING = SERVICE_CATEGORIES.find((c) => c.key === "cabinet_refacing");
const QUOTE_1044_DETAIL = {
  ...Q_1044,
  discount: 0,
  tax: Q_1044.taxTotal,
  taxEnabled: true,
  acceptedTotal: null,
  notes: null,
  processNotes: null,
  clientPhotos: [],
  historicalImportedAt: null,
  clientDesignAt: null,
  sentToEmail: LAVOIE.email,
  followUpSentAt: null,
  followUpCount: 0,
  canOpenKitchenDesigner: false,
  importedGroupIds: [],
  client: { id: LAVOIE.id, name: LAVOIE.name, contactName: null, email: LAVOIE.email, phone: LAVOIE.phone, address: LAVOIE.address, city: LAVOIE.city, province: LAVOIE.province, country: LAVOIE.country, language: LAVOIE.language },
  company: { currency: COMPANY.currency, outboundCallsEnabled: true },
  invoices: [],
  scopeGroups: [{
    id: "sg_1044a", label: "Kitchen refacing", subtotal: 9800, sortOrder: 0, categoryId: CAT_REFACING.id,
    category: { id: CAT_REFACING.id, key: CAT_REFACING.key, label: CAT_REFACING.label, icon: CAT_REFACING.icon },
    lineItems: [
      { description: "New doors and drawer fronts — painted maple, shaker", detail: "22 doors, 8 drawer fronts", quantity: 30, unit: "ea", rate: 210, amount: 6300 },
      { description: "Box veneer and end panels", detail: "Matching painted finish", quantity: 1, unit: "lot", rate: 1900, amount: 1900 },
      { description: "Hinges, pulls and installation", detail: "Soft-close, 1 day", quantity: 1, unit: "lot", rate: 1600, amount: 1600 },
      // A library text block on the quote: unpriced prose, kept off the
      // crew's work order (lib/quotes/textBlocks.js lineFromTextBlock).
      { description: "Exclusions", detail: "This quote does not include:\n- Plumbing or electrical changes\n- Countertop removal or reinstallation\n\nAnything found once the work starts is **priced separately** and agreed before it is done.", quantity: 1, unit: "flat", rate: 0, amount: 0, kind: "text", priceMode: "none", hiddenOnWorkOrder: true, textBlockId: "tb_exclusions" },
    ],
    takeoff: { doorCount: 22, drawerCount: 8 },
    intakeValues: { doorCount: 22, drawerCount: 8 },
  }],
  // Where the work is — the Lavoies' cottage, not the address on the client
  // record (the Lavoies' cottage) — and the e-transfer / cheque offer the quote carries (the fixture
  // company is Canadian; lib/payments/offlineDiscount.js).
  siteAddress: "88 chemin du Lac, Sainte-Adèle, QC J8B 1A2",
  offlineDiscountPct: 3,
  offlineDiscountChosen: false,
  archivedAt: null,
  addOns: [
    { id: "ao_1044a", description: "Soft-close upgrade on all drawers", detail: "Blum undermount runners", amount: 380, taxable: true, sortOrder: 0, source: "estimator", selected: false, selectedAt: null },
    { id: "ao_1044b", description: "Under-cabinet LED lighting", detail: "Warm white strip, hard-wired", amount: 540, taxable: true, sortOrder: 1, source: "estimator", selected: false, selectedAt: null },
  ],
};
// Benali's vanity quote, saved this afternoon and not yet sent — the state the
// Send… menu's Preview and Copy link rows used to be greyed in.
const DRAFT_DETAIL = {
  ...QUOTE_1044_DETAIL,
  id: Q_1045.id,
  quoteNumber: Q_1045.quoteNumber,
  number: Q_1045.number,
  title: Q_1045.title,
  status: "draft",
  sentAt: null,
  sentToEmail: null,
  acceptedAt: null,
  declinedAt: null,
  approvedAt: null,
};

const QUOTE_1044_DOCUMENT = {
  groups: [{ id: "sg_1044a", categoryKey: CAT_REFACING.key, label: "Kitchen refacing", subtotal: 9800, accent: null, description: "Your boxes stay; every door, drawer front and visible surface is replaced and finished to match.", included: ["Removal and disposal of the old doors", "Soft-close hinges on every door", "Two-year workmanship warranty"], mayChange: [{ title: "Box condition", body: "Water-damaged boxes found on removal are repaired at cost, agreed before we continue." }] }],
  processSteps: [
    { num: 1, title: "Measure", body: "We measure every opening and confirm the colour sample.", timeline: "Week 1" },
    { num: 2, title: "Build", body: "Doors are made and sprayed in our Laval shop.", timeline: "Weeks 2–4" },
    { num: 3, title: "Install", body: "One day on site: veneer, doors, hardware.", timeline: "Week 5" },
  ],
  glossary: [{ title: "Refacing", body: "New doors and fronts on your existing cabinet boxes — the layout stays, the look changes." }],
  processNotes: COMPANY.defaultProcessNotes,
  processNotesSource: "company",
  paymentTerms: COMPANY.paymentTerms,
  paymentSchedule: parsePaymentSchedule(COMPANY.paymentTerms),
};

// ── /app/quotes/q_1046/edit and /app/quotes/q_1045/edit ─────────────────────
// The two edit screens the owner compared: an instant-estimate draft and a
// hand-built draft of the SAME service, each in the shape the product now
// stores — the builder's own lines ("Cabinet Refinishing — doors × 25 @ per-
// door rate", with the complexity meta), the intake counts, and the offered
// extras seeded from the catalogue. The instant draft's client is the
// Q-2026-0003 case: a US address with city, state and country on file and a
// company default of 0%, so the tax line reads "not worked out" and the hint
// names the place rather than asking for a country that is set. The only
// visible difference between the two screens is the auto-estimated banner.
const CAT_REFINISHING = SERVICE_CATEGORIES.find((c) => c.key === "cabinet_refinishing");
const REFINISHING_LINES = [
  { description: "Cabinet Refinishing — doors", quantity: 25, unit: "door", rate: 190, amount: 4750, meta: { baseUnitPrice: 190, complexityLevel: "standard", complexityReasons: [] } },
  { description: "Cabinet Refinishing — drawer fronts", quantity: 10, unit: "drawer", rate: 190, amount: 1900, meta: { baseUnitPrice: 190, complexityLevel: "standard", complexityReasons: [] } },
];
const REFINISHING_GROUP = (id) => ({
  id, label: null, subtotal: 6650, sortOrder: 0, categoryId: CAT_REFINISHING.id,
  category: { id: CAT_REFINISHING.id, key: CAT_REFINISHING.key, label: CAT_REFINISHING.label, icon: CAT_REFINISHING.icon },
  lineItems: REFINISHING_LINES,
  takeoff: null,
  intakeValues: { doorCount: 25, drawerCount: 10, complexityLevel: "standard" },
});
const OFFERED_FROM_CATALOGUE = (prefix) => [
  { id: `${prefix}a`, description: "Soft-Close Hinges (25 × door)", detail: "Install soft-close hinges, per door.", amount: 875, taxable: true, sortOrder: 50, source: "catalog", selected: false, selectedAt: null },
  { id: `${prefix}b`, description: "Two-Tone Finish", detail: "Second colour — additional masking, staging and spray cycles.", amount: 600, taxable: true, sortOrder: 51, source: "catalog", selected: false, selectedAt: null },
];
const BRAVO = { id: "cl_bravo", name: "Jonny Bravo", contactName: null, email: "jonny.bravo@example.com", phone: "+1 212 555 0100", address: "5th Ave, New York, NY, USA", city: "New York", province: "NY", country: "US", postalCode: null, county: "New York County", language: "en" };
const QUOTE_1046_DETAIL = {
  ...Q_1046,
  subtotal: 6650, tax: 0, taxTotal: 0, total: 6650, discount: 0, taxEnabled: true, language: "en",
  acceptedTotal: null, notes: null, processNotes: COMPANY.defaultProcessNotes, clientPhotos: [],
  historicalImportedAt: null, clientDesignAt: null, sentToEmail: null, followUpSentAt: null, followUpCount: 0,
  canOpenKitchenDesigner: false, importedGroupIds: [], validUntil: iso(day(29)),
  createdVia: "instant_quote",
  clientId: BRAVO.id,
  client: BRAVO,
  company: { currency: COMPANY.currency, outboundCallsEnabled: true },
  invoices: [],
  appointments: [],
  jobs: [],
  scopeGroups: [REFINISHING_GROUP("sg_1046a")],
  addOns: OFFERED_FROM_CATALOGUE("ao_1046"),
  reviewNotes: "When needed: Within a month\nActive leak: No",
};
const QUOTE_1045_DETAIL = {
  ...Q_1045,
  subtotal: 6650, tax: 997.5, taxTotal: 997.5, total: 7647.5, discount: 0, taxEnabled: true,
  acceptedTotal: null, notes: null, processNotes: COMPANY.defaultProcessNotes, clientPhotos: [],
  historicalImportedAt: null, clientDesignAt: null, sentToEmail: null, followUpSentAt: null, followUpCount: 0,
  canOpenKitchenDesigner: false, importedGroupIds: [], validUntil: iso(day(29)),
  createdVia: "staff",
  client: { id: FORTIN.id, name: FORTIN.name, contactName: null, email: FORTIN.email, phone: FORTIN.phone, address: FORTIN.address, city: FORTIN.city, province: FORTIN.province, country: FORTIN.country, postalCode: FORTIN.postalCode, language: FORTIN.language },
  company: { currency: COMPANY.currency, outboundCallsEnabled: true },
  invoices: [],
  appointments: [],
  jobs: [],
  scopeGroups: [REFINISHING_GROUP("sg_1045a")],
  addOns: OFFERED_FROM_CATALOGUE("ao_1045"),
  reviewNotes: null,
};
// ── The client proposal, staff side (client mockup §2) ─────────────────────
// Settings › Presentation and a quote's Presentation panel: the story, the
// one gallery, the document library (one expired, one waiver) and what the
// quote will show. Shapes from app/api/settings/{presentation,gallery,
// company-documents} and app/api/quotes/[id]/presentation.
const GALLERY_PAIRS = [
  { id: "gp_1", beforeUrl: JOB_PHOTO_URLS[4], afterUrl: JOB_PHOTO_URLS[0], beforePublicId: null, afterPublicId: null, caption: "Split-level in Vimont — dated oak to white shaker", sortOrder: 0, source: "quote_email" },
  { id: "gp_2", beforeUrl: JOB_PHOTO_URLS[2], afterUrl: JOB_PHOTO_URLS[3], beforePublicId: null, afterPublicId: null, caption: "Rift white oak island, Sainte-Rose", sortOrder: 1, source: "website" },
];
const COMPANY_DOCUMENTS = [
  { id: "cd_coi", type: "insurance", title: "Certificate of insurance", summary: "$2M liability · to Mar 31, 2027", fileUrl: "https://res.cloudinary.com/demo/raw/upload/coi.pdf", mimeType: "application/pdf", expiresAt: iso(day(190, 0)), showOnQuotes: true, sortOrder: 0, body: null, attachToQuotes: false, attachToJobs: false, attachToInvoices: false, expired: false, expiresSoon: false, signable: null, visibleToClients: true },
  { id: "cd_rbq", type: "licence", title: "RBQ licence", summary: "RBQ 5812-4471-01", fileUrl: "https://res.cloudinary.com/demo/raw/upload/rbq.pdf", mimeType: "application/pdf", expiresAt: iso(day(20, 0)), showOnQuotes: true, sortOrder: 1, body: null, attachToQuotes: false, attachToJobs: false, attachToInvoices: false, expired: false, expiresSoon: true, signable: null, visibleToClients: true },
  { id: "cd_cnesst", type: "wsib", title: "CNESST clearance", summary: null, fileUrl: "https://res.cloudinary.com/demo/raw/upload/cnesst.pdf", mimeType: "application/pdf", expiresAt: iso(day(-12, 0)), showOnQuotes: true, sortOrder: 2, body: null, attachToQuotes: false, attachToJobs: false, attachToInvoices: false, expired: true, expiresSoon: false, signable: null, visibleToClients: false },
  { id: "cd_warranty", type: "warranty", title: "Workmanship warranty", summary: "5 years on finish and hardware", fileUrl: "https://res.cloudinary.com/demo/raw/upload/warranty.pdf", mimeType: "application/pdf", expiresAt: null, showOnQuotes: true, sortOrder: 3, body: null, attachToQuotes: false, attachToJobs: false, attachToInvoices: false, expired: false, expiresSoon: false, signable: null, visibleToClients: true },
  { id: "cd_waiver", type: "waiver", title: "Release of liability — cabinet installation", summary: null, fileUrl: null, mimeType: null, expiresAt: null, showOnQuotes: false, sortOrder: 4, body: { sections: [{ heading: "Furniture and belongings", text: "We move and cover furniture in the rooms we work in." }, { heading: "Existing surfaces", text: "Removing old cabinets can reveal damage behind them." }], acknowledgements: ["I understand I am responsible for removing fragile items and valuables before the crew arrives.", "I understand that hidden damage may show once the old cabinets are out and that additional repair is quoted separately."] }, attachToQuotes: true, attachToJobs: false, attachToInvoices: false, expired: false, expiresSoon: false, signable: true, visibleToClients: false },
];
const PRESENTATION_SETTINGS = {
  story: "Érable started in a garage in Laval in 2010. Today four of us build, spray and install every kitchen ourselves — one of the two brothers is on every site, and we don't leave until you've opened every door.",
  storyHeadline: "Two brothers, one shop, sixteen years",
  storyVideoUrl: "",
  teamPhotoUrl: JOB_PHOTO_URLS[5],
  sections: [
    { key: "about", on: true, hasContent: true },
    { key: "beforeAfter", on: true, hasContent: true },
    { key: "documents", on: true, hasContent: true },
    { key: "testimonials", on: true, hasContent: true },
    { key: "services", on: true, hasContent: true },
  ],
  counts: { beforeAfter: 2, documents: 3, testimonials: 2, services: 4 },
};
const QUOTE_PRESENTATION = (detail) => ({
  quoteId: detail.id,
  sections: [
    { key: "about", labelKey: "app.proposal.section.about", fillHref: "/app/settings/presentation#story", on: true, inherited: true, companyDefault: true, hasContent: true, rendered: true, override: null },
    { key: "beforeAfter", labelKey: "app.proposal.section.beforeAfter", fillHref: "/app/settings/presentation#gallery", on: true, inherited: true, companyDefault: true, hasContent: true, rendered: true, override: null },
    { key: "documents", labelKey: "app.proposal.section.documents", fillHref: "/app/settings/presentation#documents", on: true, inherited: true, companyDefault: true, hasContent: true, rendered: true, override: null },
    { key: "testimonials", labelKey: "app.proposal.section.testimonials", fillHref: "/app/settings/reviews#google-business", on: true, inherited: true, companyDefault: true, hasContent: true, rendered: true, override: null },
    { key: "services", labelKey: "app.proposal.section.services", fillHref: "/app/settings/services", on: false, inherited: false, companyDefault: true, hasContent: true, rendered: false, override: false },
  ],
  counts: { beforeAfter: 2, documents: 3, testimonials: 2, services: 4 },
  documents: COMPANY_DOCUMENTS.filter((d) => d.type !== "waiver").map((d) => ({ id: d.id, title: d.title, type: d.type, expired: d.expired, visibleToClients: d.visibleToClients, included: d.visibleToClients && d.id !== "cd_warranty" })),
  documentIds: ["cd_coi", "cd_rbq"],
  plan: { totalHours: 37, crewSize: 2, crewSizeOverride: 2, days: [{ day: 1 }, { day: 2 }, { day: 3 }] },
  waivers: [{ id: "ds_1", documentId: "cd_waiver", title: "Release of liability — cabinet installation", status: "pending", signedAt: null, sentAt: iso(day(-1, 16)) }],
  waiverLibrary: [{ id: "cd_waiver", title: "Release of liability — cabinet installation", signable: true }],
});
const WAIVERS_FOR = (target) => ({
  waivers: [{ id: "ds_1", documentId: "cd_waiver", title: "Release of liability — cabinet installation", status: "pending", signedAt: null, sentAt: iso(day(-1, 16)), signedName: "", acknowledged: 0, jobDocumentId: null, ...target }],
  library: [{ id: "cd_waiver", title: "Release of liability — cabinet installation", signable: true }],
});

const EDIT_ROUTES = (detail) => [
  { path: `/api/quotes/${detail.id}/presentation`, method: "GET", reply: () => QUOTE_PRESENTATION(detail) },
  { path: "/api/waivers", method: "GET", reply: () => WAIVERS_FOR({ quoteId: detail.id }) },
  { path: `/api/quotes/${detail.id}`, method: "GET", reply: () => detail },
  { path: `/api/quotes/${detail.id}/costing`, method: "GET", reply: () => ({ ...QUOTE_COSTING, price: detail.subtotal, saved: false, labourHours: 26.25, labourCost: 1181.25, materialTotal: 612, overhead: 665, estimatedCost: 2458.25, profit: 4191.75, marginPct: 63, crew: [], groups: [] }) },
  { path: `/api/quotes/${detail.id}/review`, method: "GET", reply: () => ({ review: null, reviewedAt: null }) },
  { path: `/api/quotes/${detail.id}/add-ons`, method: "GET", reply: () => detail.addOns },
  { path: `/api/quotes/${detail.id}/vision`, method: "GET", reply: () => ({ passes: [], spend: null }) },
  { path: `/api/quotes/${detail.id}/email-sections`, method: "GET", reply: () => ({ ...EMAIL_SECTIONS, quoteId: detail.id }) },
  { path: `/api/quotes/${detail.id}/imports`, method: "GET", reply: () => ({ asSource: [], asImporter: [] }) },
];

// ── /app/jobs/j_318 ─────────────────────────────────────────────────────────
// app/api/jobs/[id]: the row with quote, client, visits (assignee, checklist,
// location stamps), payment stages and change orders. Day one of the
// install is tomorrow; the deposit stage was requested through INV-2071.
const CHECKLIST = [
  { label: "Photograph the kitchen before removal", done: true, phase: "pre", photoRequired: true },
  { label: "Confirm water and power are shut off", done: true, phase: "pre", critical: true },
  { label: "Remove old cabinets, protect floors", done: false, phase: "during" },
  { label: "Set base boxes level and plumb", done: false, phase: "during", responseType: "measure", unit: "mm", expectedMin: 0, expectedMax: 2, criteria: "Out of level across the run" },
  { label: "Walk the client through hinge adjustment", done: false, phase: "post" },
  { label: "Finished photos, every elevation", done: false, phase: "post", photoRequired: true },
];
// The cabinet painting form, auto-attached when the job was created from the
// cabinet refinishing quote (lib/checklists/autoAdd.js), part-way through day
// one: prep and safety answered, the finish-quality stop-light and the
// client's signature still to come.
const CABINET_FORM = (() => {
  const tpl = INSTALLED_CHECKLISTS.find((t) => t.seedKey === "fq.cl.cabinet_refinishing.painting");
  const answers = [
    { response: 24 },
    { done: true },
    { media: [{ url: JOB_PHOTO_URLS[0], kind: "photo", caption: null }] },
    { response: "Two chipped edges on the sink base doors — photographed, not in scope" },
    { done: true },
    { done: true },
    { done: true },
    { done: true },
    { done: true },
    { response: "HVLP spray, 1.3 tip" },
    { response: 2 },
    { response: "amber" },
  ];
  return itemsFromTemplate({ ...tpl, id: "ck_seed_0" }, "en").map((item, i) =>
    answers[i] ? answerItem(item, answers[i].done ? { ...answers[i] } : answers[i]) : item,
  ).map((item, i) => (answers[i]?.done ? { ...item, done: true } : item));
})();
const JOB_DETAIL = {
  ...J_318,
  checklistItems: CABINET_FORM,
  siteAddress: `${CLIENT.address}, ${CLIENT.city}, ${CLIENT.province} ${CLIENT.postalCode}`,
  latitude: 45.5901,
  longitude: -73.7175,
  archivedAt: null,
  historicalImportedAt: null,
  costReviewedAt: null,
  callbackReason: null,
  originalJob: null,
  callbackJobs: [],
  quote: { id: QUOTE.id, quoteNumber: QUOTE.quoteNumber },
  client: { id: CLIENT.id, name: CLIENT.name, phone: CLIENT.phone, email: CLIENT.email, address: CLIENT.address, city: CLIENT.city, province: CLIENT.province },
  paymentStages: [
    { id: "ps_1", seq: 1, label: "Deposit to book", percentage: 50, status: "requested", dueDate: iso(day(-5, 9)), blockedReason: null, amountCents: Math.round(INVOICE.total * 100) },
    { id: "ps_2", seq: 2, label: "Balance on installation", percentage: 50, status: "pending", dueDate: iso(day(2, 17)), blockedReason: null, amountCents: Math.round(INVOICE.total * 100) },
  ],
  // As GET /api/jobs/[id] presents them (lib/jobs/changeOrderPresent.js):
  // labelled CO-n, the signature's name only, never the PNG or the token.
  changeOrders: [
    {
      id: "co_2", seq: 2, label: "CO-2", description: "Island top upgraded to 2-inch white oak with a mitred waterfall", priceDelta: 640, status: "waiting_client", invoiceId: null, invoice: null,
      bodyHtml: "<p>The 1.5-inch top we quoted reads thin beside the waterfall end. A <b>2-inch</b> slab, mitred at the corner, carries the grain down the side in one piece.</p>",
      quoteLineKey: null, originalLine: null, taskId: "st_5", task: { id: "st_5", title: "Install island and waterfall end" }, scheduleDeltaDays: 1, photos: [JOB_PHOTO_URLS[1]],
      sentAt: iso(day(0, 11, 42)), sentVia: "sms+email", viewedAt: iso(day(0, 12, 5)), decidedAt: null, decidedBy: null, signedBy: null, signedAt: null,
      createdBy: { name: SAM.name }, createdById: SAM.userId, createdAt: iso(day(0, 11, 40)),
    },
    {
      id: "co_1", seq: 1, label: "CO-1", description: "Add pull-out waste and recycling in the sink base", priceDelta: 385, status: "approved", invoiceId: null, invoice: null,
      bodyHtml: null, quoteLineKey: "sg_1042:1", originalLine: { description: "Base cabinets — shaker, painted", amount: 8320, quantity: 16 }, taskId: null, task: null, scheduleDeltaDays: null, photos: [],
      sentAt: iso(day(-3, 14, 12)), sentVia: "email", viewedAt: iso(day(-3, 15, 2)), decidedAt: iso(day(-3, 16, 14)), decidedBy: null, signedBy: "Sophie Dubois", signedAt: iso(day(-3, 16, 14)),
      createdBy: { name: SAM.name }, createdById: SAM.userId, createdAt: iso(day(-3, 14, 10)),
    },
  ],
  visits: [
    {
      id: "v_318a", scheduledAt: iso(day(1, 8)), status: "scheduled", assignedToId: LEO.userId, assignedTo: who(LEO),
      checklistItems: CHECKLIST, notes: "Carcasses and base run — Léo + Ana", returnReason: null, returnNotes: null, locationStamps: [],
    },
    {
      id: "v_318b", scheduledAt: iso(day(2, 8)), status: "scheduled", assignedToId: ANA.userId, assignedTo: who(ANA),
      checklistItems: CHECKLIST.map((c) => ({ ...c, done: false })), notes: "Uppers, island, hardware", returnReason: null, returnNotes: null, locationStamps: [],
    },
  ],
};
const JOB_COSTING = {
  actual: {
    expenses: { total: 6412.5, byCategory: [{ category: "Materials", amount: 5980 }, { category: "Fuel & Vehicle", amount: 432.5 }] },
    labour: { approvedHours: 64, pendingHours: 3, cost: 2368, unratedHours: 0, workers: 2 },
    overhead: { amount: 1845, basis: "pct_of_price" },
    equipment: null,
    subcontracts: null,
    total: 10625.5,
    incomplete: true,
  },
  unattributed: null,
  comparison: { estimatedCost: 12237, actualCost: 10625.5, revenue: QUOTE.subtotal + 385, variance: -1611.5, variancePct: -13.2, profit: 8209.5, marginPct: 43.6, overBudget: false },
  contract: { quotedTotal: QUOTE.subtotal, quotedTotalKnown: true, approvedChanges: 385, currentContractValue: QUOTE.subtotal + 385 },
  estimatedHours: 96,
  revision: { thresholdPct: 15, decision: null, decidedAt: null, ask: false },
  estimatedAt: iso(day(-6, 15)),
  currency: COMPANY.currency,
};
// ── The AI material list, the crew work order and the supply requests ────
//
// The same five JobMaterial rows, now carrying the grouped list's columns
// (app/api/jobs/[id]/materials shape): the takeoff's own lines under
// Primary, the build's sundries and consumables with a reason each, "on
// hand" summed from the stock fixture's movements, and the banner's facts.
const stockLevel = (id) => STOCK_FOR_MATERIALS.find((l) => l.materialId === id)?.level ?? null;
const STOCK_FOR_MATERIALS = [
  { materialId: "mat_birch", level: 14 },
  { materialId: "mat_hinge", level: 68 },
  { materialId: "mat_slide", level: 26 },
  { materialId: "mat_tape", level: 3 },
];
const onHand = (qty, materialId) => {
  const level = materialId ? stockLevel(materialId) : null;
  if (level === null) return { onHand: null, short: null, status: "untracked" };
  const short = Math.max(0, qty - level);
  return { onHand: level, short, status: short > 0 ? "short" : "covered" };
};
const MATERIAL_LIST_ROWS = [
  { id: "jm_1", name: "Maple plywood 3/4\" — boxes", qty: 22, actualQty: 22, unit: "sheet", materialKey: "plywood_maple_34", categoryKey: CAT_KITCHEN.key, estUnitCost: 96, actualCost: 2068, supplier: "Langevin Bois", purchasedAt: iso(day(-12, 10)), addedByHand: false, sortOrder: 0, group: "primary", reason: "38 lin. ft of boxes at 0.55 sheet per ft, +10%, rounded up", wastePct: 10, stockMaterialId: null, source: "takeoff" },
  { id: "jm_2", name: "MDF shaker doors — 26", qty: 26, actualQty: 26, unit: "ea", materialKey: "door_shaker_mdf", categoryKey: CAT_KITCHEN.key, estUnitCost: 68, actualCost: 1742, supplier: "Portes Lacroix", purchasedAt: iso(day(-9, 14)), addedByHand: false, sortOrder: 1, group: "primary", reason: "26 door and drawer fronts on the approved lines", wastePct: null, stockMaterialId: null, source: "takeoff" },
  { id: "jm_3", name: "White oak, rift sawn — island", qty: 1, actualQty: 1, unit: "lot", materialKey: "oak_rift", categoryKey: CAT_KITCHEN.key, estUnitCost: 1890, actualCost: 1890, supplier: "Langevin Bois", purchasedAt: iso(day(-12, 10)), addedByHand: false, sortOrder: 2, group: "primary", reason: "7 × 3 ft top with a waterfall end", wastePct: null, stockMaterialId: null, source: "takeoff" },
  { id: "jm_4", name: "Blum soft-close hinges", qty: 52, actualQty: null, unit: "ea", materialKey: "hinge_blum", categoryKey: CAT_KITCHEN.key, estUnitCost: 6.5, actualCost: null, supplier: "Richelieu", purchasedAt: null, addedByHand: false, sortOrder: 3, group: "fasteners", reason: "26 doors × 2 hinges", wastePct: null, stockMaterialId: "mat_hinge", source: "takeoff" },
  { id: "jm_5", name: "Pull-out waste unit — 2 bins", qty: 1, actualQty: null, unit: "ea", materialKey: null, categoryKey: null, estUnitCost: 148, actualCost: null, supplier: "Richelieu", purchasedAt: null, addedByHand: true, sortOrder: 4, group: null, reason: null, wastePct: null, stockMaterialId: null, source: null },
  { id: "jm_6", name: "Blum Tandem 21\" undermount slides", qty: 14, actualQty: null, unit: "pair", materialKey: null, categoryKey: null, estUnitCost: null, actualCost: null, supplier: null, purchasedAt: null, addedByHand: false, sortOrder: 5, group: "fasteners", reason: "14 drawers on the base run, one pair each", wastePct: null, stockMaterialId: "mat_slide", source: "ai" },
  { id: "jm_7", name: "Baltic birch 3/4 — drawer boxes", qty: 6, actualQty: null, unit: "sheet", materialKey: null, categoryKey: null, estUnitCost: null, actualCost: null, supplier: null, purchasedAt: null, addedByHand: false, sortOrder: 6, group: "primary", reason: "14 dovetail drawers, ~2.3 boxes per sheet, +10%", wastePct: 10, stockMaterialId: "mat_birch", source: "ai" },
  { id: "jm_8", name: "Painter's tape 1½\"", qty: 6, actualQty: null, unit: "roll", materialKey: null, categoryKey: null, estUnitCost: null, actualCost: null, supplier: null, purchasedAt: null, addedByHand: false, sortOrder: 7, group: "sundries", reason: "Masking the island top and the finished floor for install", wastePct: null, stockMaterialId: "mat_tape", source: "ai" },
  { id: "jm_9", name: "Sanding discs 5\" — 180 / 220", qty: 2, actualQty: null, unit: "box", materialKey: null, categoryKey: null, estUnitCost: null, actualCost: null, supplier: null, purchasedAt: null, addedByHand: false, sortOrder: 8, group: "consumables", reason: "26 fronts and the island top between coats", wastePct: null, stockMaterialId: null, source: "ai" },
  { id: "jm_10", name: "Wood glue, 1 gal", qty: 1, actualQty: null, unit: "ea", materialKey: null, categoryKey: null, estUnitCost: null, actualCost: null, supplier: null, purchasedAt: null, addedByHand: false, sortOrder: 9, group: "fasteners", reason: "Dovetails and the island glue-up", wastePct: null, stockMaterialId: null, source: "ai" },
  { id: "jm_11", name: "Scribe moulding, oak — 8 ft", qty: 4, actualQty: null, unit: "ea", materialKey: null, categoryKey: null, estUnitCost: null, actualCost: null, supplier: null, purchasedAt: null, addedByHand: false, sortOrder: 10, group: "transitions", reason: "28 lin. ft of uppers against an out-of-plumb wall", wastePct: null, stockMaterialId: null, source: "ai" },
].map((m) => ({ ...m, ...onHand(m.qty, m.stockMaterialId) }));
const MATERIAL_LIST = {
  materials: MATERIAL_LIST_ROWS,
  progress: { total: 11, bought: 3, outstanding: 8, complete: false, estimatedTotal: 6338, actualTotal: 5700, unpriced: 6, short: 2 },
  built: { at: iso(day(0, 7, 42)), model: "gpt-5-mini", by: SAM.name },
  spend: { allowed: true, reason: null, needCents: 10, balanceCents: 1840, shortfallCents: 0 },
};
const stripMoney = (m) => { const { estUnitCost, actualCost, ...rest } = m; return { ...rest, costHidden: true }; };

// The crew work order for the same job (app/api/jobs/[id]/work-order shape,
// lib/workOrder/build.js): one step per scope group of a cabinet quote —
// no per-area takeoff, so hours come from the recipe's productivity figure
// — plus the two lines the office hid from the crew's copy.
const WORK_ORDER = {
  job: { id: JOB.id, title: JOB.title, status: "in_progress", startDate: iso(day(1, 8)), endDate: iso(day(2, 17)), siteAddress: JOB_DETAIL.siteAddress, quoteNumber: QUOTE.quoteNumber, language: "en" },
  client: { name: CLIENT.name, phone: null, email: null, restricted: true },
  crew: [LEO.name, ANA.name],
  totalHours: 42,
  displayHours: "42.0",
  clockedHours: 19.5,
  areas: [
    { key: "g:sg_boxes:", label: "Cabinet boxes — uppers and base run", trade: "Kitchen cabinets", hours: 18, displayHours: "18.0", scope: "12 lin. ft uppers, shaker, painted; 16 lin. ft base, shaker, painted, dovetail drawers", lines: [{ key: "g:sg_boxes:l:0", label: "Upper cabinets — shaker, painted", detail: "12 lin. ft, soft-close hinges", quantity: 12, unit: "lin. ft", hidden: false }, { key: "g:sg_boxes:l:1", label: "Base cabinets — shaker, painted", detail: "16 lin. ft, dovetail drawers", quantity: 16, unit: "lin. ft", hidden: false }], crewNote: "Carcasses and base run first — Léo + Ana. The fridge panel scribes to the bulkhead, check it before glue-up.", hidden: false, taskId: "t_wo_1", done: true, assignee: LEO.name, photos: [{ id: "jp_2", url: JOB_PHOTO_URLS[1], createdAt: iso(day(-2, 15, 5)) }] },
    { key: "g:sg_island:", label: "Island — white oak, rift sawn", trade: "Kitchen cabinets", hours: 14, displayHours: "14.0", scope: "7 ft × 3 ft top, waterfall end", lines: [{ key: "g:sg_island:l:0", label: "Island — white oak, rift sawn", detail: "7 ft × 3 ft, waterfall end", quantity: 1, unit: "ea", hidden: false }], crewNote: "Waterfall mitre is glued in the shop — it travels as one piece. Two people to carry.", hidden: false, taskId: null, done: false, assignee: null, photos: [] },
    { key: "g:sg_install:", label: "Installation", trade: "Kitchen cabinets", hours: 10, displayHours: "10.0", scope: "2 installers, 2 days", lines: [{ key: "g:sg_install:l:0", label: "Installation", detail: "2 installers, 2 days", quantity: 2, unit: "day", hidden: false }, { key: "g:sg_install:l:1", label: "Final walkthrough & touch-ups", detail: null, quantity: 1, unit: "flat", hidden: true }], crewNote: null, hidden: false, taskId: null, done: false, assignee: null, photos: [] },
  ],
  stats: { done: 1, areas: 3, photos: 1 },
  hiddenCount: 1,
};
// The crew's copy: hidden lines absent, the office's flags gone.
const CREW_WORK_ORDER = { ...WORK_ORDER, areas: WORK_ORDER.areas.map((a) => ({ ...a, lines: a.lines.filter((l) => !l.hidden) })) };

// Supply requests (app/api/supply-requests shape): the office's list with
// the reorder banner's pre-fill, and Léo's own.
const SUPPLY_REQUESTS = [
  { id: "sr_1", materialId: "mat_tape", itemName: "Painter's tape 1½\"", quantity: 6, unit: "roll", jobId: JOB.id, jobTitle: JOB.title, requestedById: LEO.userId, requestedByName: LEO.name, neededBy: iso(day(1, 8)), photoUrl: JOB_PHOTO_URLS[3], note: "Down to the last roll and a half — masking the island tomorrow.", status: "requested", source: "field", purchaseOrderId: null, purchaseOrderNumber: null, orderedAt: null, restockedAt: null, restockNote: null, cancelledAt: null, createdAt: iso(day(0, 14, 12)) },
  { id: "sr_2", materialId: "mat_slide", itemName: "Blum Tandem 21\" undermount slides", quantity: 4, unit: "pair", jobId: JOB.id, jobTitle: JOB.title, requestedById: SAM.userId, requestedByName: SAM.name, neededBy: null, photoUrl: null, note: null, status: "ordered", source: "material_list", purchaseOrderId: "po_014", purchaseOrderNumber: "PO-014", orderedAt: iso(day(-2, 11)), restockedAt: null, restockNote: null, cancelledAt: null, createdAt: iso(day(-2, 10, 40)) },
  { id: "sr_3", materialId: "mat_hinge", itemName: "Blum Clip-top soft-close hinges, 110°", quantity: 12, unit: "each", jobId: null, jobTitle: null, requestedById: SAM.userId, requestedByName: SAM.name, neededBy: null, photoUrl: null, note: null, status: "ordered", source: "low_stock", purchaseOrderId: "po_014", purchaseOrderNumber: "PO-014", orderedAt: iso(day(-2, 11)), restockedAt: null, restockNote: null, cancelledAt: null, createdAt: iso(day(-2, 10, 45)) },
  { id: "sr_4", materialId: null, itemName: "Scribe moulding, oak — 8 ft", quantity: 4, unit: "ea", jobId: JOB.id, jobTitle: JOB.title, requestedById: ANA.userId, requestedByName: ANA.name, neededBy: null, photoUrl: null, note: null, status: "restocked", source: "field", purchaseOrderId: null, purchaseOrderNumber: null, orderedAt: iso(day(-4, 9)), restockedAt: iso(day(-1, 16)), restockNote: "in van 2", cancelledAt: null, createdAt: iso(day(-5, 15, 20)) },
];
const SUPPLY_OPTIONS = {
  jobs: [{ id: JOB.id, title: JOB.title, client: CLIENT.name }],
  materials: [
    { id: "mat_birch", name: "Baltic birch 3/4 — 5 × 5", unit: "sheet", level: 14, threshold: 10 },
    { id: "mat_hinge", name: "Blum Clip-top soft-close hinges, 110°", unit: "each", level: 68, threshold: 80 },
    { id: "mat_slide", name: "Blum Tandem 21\" undermount slides", unit: "pair", level: 26, threshold: 12 },
    { id: "mat_tape", name: "Painter's tape 1½\"", unit: "roll", level: 3, threshold: 6 },
  ],
};

const JOB_PHOTOS = {
  photos: [
    { id: "jp_1", url: JOB_PHOTO_URLS[0], stage: "start", featured: false, caption: "Existing kitchen — before removal", createdAt: iso(day(-18, 10, 30)), annotationJson: null, annotationWidth: null, annotationHeight: null, flattenedUrl: null, annotationUpdatedAt: null, tags: [{ id: "pt_before", name: "Before", color: "#6b7280", active: true }] },
    { id: "jp_2", url: JOB_PHOTO_URLS[1], stage: "progress", featured: true, caption: "Island top — rift sawn oak, first coat", createdAt: iso(day(-2, 15, 5)), annotationJson: null, annotationWidth: null, annotationHeight: null, flattenedUrl: null, annotationUpdatedAt: null, tags: [{ id: "pt_shop", name: "In the shop", color: "#1f4e3d", active: true }] },
    { id: "jp_3", url: JOB_PHOTO_URLS[3], stage: "progress", featured: false, caption: "Doors out of the booth", createdAt: iso(day(-1, 16, 40)), annotationJson: null, annotationWidth: null, annotationHeight: null, flattenedUrl: null, annotationUpdatedAt: null, tags: [{ id: "pt_shop", name: "In the shop", color: "#1f4e3d", active: true }] },
  ],
  stages: [{ key: "start", label: "Before / start" }, { key: "progress", label: "In progress" }, { key: "finish", label: "Finished" }, { key: "issue", label: "Issue / snag" }],
  tags: [{ id: "pt_before", name: "Before", color: "#6b7280" }, { id: "pt_shop", name: "In the shop", color: "#1f4e3d" }, { id: "pt_after", name: "After", color: "#2f855a" }],
};
const JOB_TASKS = TASKS.filter((t) => t.job?.id === JOB.id);

// ── GET /api/jobs/[id]/plan — the job plan (lib/jobs/planPayload.js) ───────
//
// One step per approved line of Q-1042, in build order, with the hours the
// takeoff gave each and the buy-list rows it consumes. Step 5 is on hold for
// CO-2 (Task.waitingOnChangeOrderId) and step 6 waits on step 5; the derived
// planStatus / waitingOn are what lib/jobs/plan.js would compute for them.
const step = (o) => ({
  description: null, status: "open", priority: "normal", dueDate: null, estimatedHours: null, quoteLineKey: null, quoteLineNo: null, categoryKey: CAT_KITCHEN.key,
  materialKeys: [], waitingReason: null, waitingOnChangeOrderId: null, clientVisible: true, scheduledStart: null, scheduledEnd: null, sourceKey: null,
  requiredPhotoCount: null, requiresComment: false, completionComment: null, createdAt: iso(day(-6, 15)), assignedToId: null, assignedTo: null,
  clockedHours: 0, photoCount: 0, dependsOn: [], planStatus: "not_started", waitingOn: [], waitingOnChangeOrder: null, materials: [], fromChangeOrder: null, photos: [],
  ...o,
});
const PLAN_STEPS = [
  step({ id: "st_1", sortOrder: 0, title: "Cut and assemble carcasses — uppers and bases", quoteLineKey: "sg_1042:0", quoteLineNo: 1, sourceKey: "quote_line:q_1042:sg_1042:0", status: "done", planStatus: "done", estimatedHours: 32, clockedHours: 34.5, dueDate: iso(day(-8, 8)), assignedToId: LEO.userId, assignedTo: who(LEO), materials: [{ id: "jm_1", name: "Maple plywood 3/4\" — boxes", qty: 22, unit: "sheet", purchased: true }], materialKeys: ["plywood_maple_34"] }),
  step({ id: "st_2", sortOrder: 1, title: "Doors and drawer fronts — prime and spray", quoteLineKey: "sg_1042:1", quoteLineNo: 2, sourceKey: "quote_line:q_1042:sg_1042:1", status: "done", planStatus: "done", estimatedHours: 18, clockedHours: 16, dueDate: iso(day(-2, 8)), assignedToId: ANA.userId, assignedTo: who(ANA), dependsOn: [{ id: "st_1", title: "Cut and assemble carcasses — uppers and bases", status: "done" }], materials: [{ id: "jm_2", name: "MDF shaker doors — 26", qty: 26, unit: "ea", purchased: true }], materialKeys: ["door_shaker_mdf"], photoCount: 2, photos: [{ id: "jp_3", url: JOB_PHOTO_URLS[3], stage: "progress", createdAt: iso(day(-1, 16, 40)) }] }),
  step({ id: "st_3", sortOrder: 2, title: "Island top — glue up, sand, first coat", quoteLineKey: "sg_1042:2", quoteLineNo: 3, sourceKey: "quote_line:q_1042:sg_1042:2", status: "in_progress", planStatus: "in_progress", estimatedHours: 12, clockedHours: 7.5, dueDate: iso(day(0, 8)), assignedToId: LEO.userId, assignedTo: who(LEO), materials: [{ id: "jm_3", name: "White oak, rift sawn — island", qty: 1, unit: "lot", purchased: true }], materialKeys: ["oak_rift"], photoCount: 1, photos: [{ id: "jp_2", url: JOB_PHOTO_URLS[1], stage: "progress", createdAt: iso(day(-2, 15, 5)) }] }),
  step({ id: "st_4", sortOrder: 3, title: "Install base run and uppers", quoteLineKey: "sg_1042:3", quoteLineNo: 4, sourceKey: "quote_line:q_1042:sg_1042:3", estimatedHours: 16, dueDate: iso(day(1, 8)), scheduledStart: iso(day(1, 8)), scheduledEnd: iso(day(1, 16, 30)), assignedToId: LEO.userId, assignedTo: who(LEO), dependsOn: [{ id: "st_1", title: "Cut and assemble carcasses — uppers and bases", status: "done" }, { id: "st_2", title: "Doors and drawer fronts — prime and spray", status: "done" }], materials: [{ id: "jm_4", name: "Blum soft-close hinges", qty: 52, unit: "ea", purchased: false }], materialKeys: ["hinge_blum"] }),
  step({ id: "st_5", sortOrder: 4, title: "Install island and waterfall end", quoteLineKey: "sg_1042:2", quoteLineNo: null, sourceKey: "quote_line:q_1042:sg_1042:2b", estimatedHours: 8, dueDate: iso(day(2, 8)), scheduledStart: iso(day(2, 8)), scheduledEnd: iso(day(2, 12)), assignedToId: ANA.userId, assignedTo: who(ANA), waitingOnChangeOrderId: "co_2", waitingOnChangeOrder: { id: "co_2", label: "CO-2", status: "waiting_client" }, planStatus: "waiting", waitingOn: [{ kind: "change_order", id: "co_2", label: "CO-2" }], dependsOn: [{ id: "st_3", title: "Island top — glue up, sand, first coat", status: "in_progress" }, { id: "st_4", title: "Install base run and uppers", status: "open" }] }),
  step({ id: "st_6", sortOrder: 5, title: "Hardware, adjust doors, final clean", quoteLineKey: "sg_1042:3", quoteLineNo: null, sourceKey: "quote_line:q_1042:sg_1042:3b", estimatedHours: 6, dueDate: iso(day(2, 13)), scheduledStart: iso(day(2, 13)), scheduledEnd: iso(day(2, 17)), assignedToId: LEO.userId, assignedTo: who(LEO), planStatus: "waiting", waitingOn: [{ kind: "task", id: "st_5", label: "Install island and waterfall end" }], dependsOn: [{ id: "st_5", title: "Install island and waterfall end", status: "open" }] }),
  step({ id: "st_7", sortOrder: 6, title: "Pull-out waste and recycling in the sink base", sourceKey: "change_order_approved:co_1", quoteLineKey: "sg_1042:1", estimatedHours: 2, dueDate: iso(day(2, 8)), fromChangeOrder: { id: "co_1", label: "CO-1", status: "approved", description: "Add pull-out waste and recycling in the sink base" }, dependsOn: [{ id: "st_4", title: "Install base run and uppers", status: "open" }], planStatus: "waiting", waitingOn: [{ kind: "task", id: "st_4", label: "Install base run and uppers" }], materials: [{ id: "jm_5", name: "Pull-out waste unit — 2 bins", qty: 1, unit: "ea", purchased: false }] }),
  step({ id: "st_8", sortOrder: 7, title: "Countertop template — Granite Lachapelle", description: "They template once the bases are level; slab arrives ~10 days after.", estimatedHours: null, dueDate: iso(day(3, 9)), waitingReason: "the countertop shop's templating slot · Thu a.m.", planStatus: "waiting", waitingOn: [{ kind: "external", id: null, label: "the countertop shop's templating slot · Thu a.m." }], clientVisible: true }),
];
const planPayload = (crew) => ({
  job: { id: JOB.id, title: JOB.title, startDate: JOB.startDate, endDate: JOB.endDate, quoteNumber: QUOTE.quoteNumber, acceptedAt: iso(day(-6, 15)), clientName: CLIENT.name, timezone: "America/Toronto" },
  steps: PLAN_STEPS,
  summary: { count: 8, done: 2, estimatedHours: 94, clockedHours: 61 },
  members: PEOPLE.map(who),
  canEdit: !crew,
  canAssign: !crew,
  canCreate: !crew,
});
const DAILY_LOG = {
  id: "dl_1", logDate: iso(day(-1, 17)), day: "2026-09-13", body: [{ content: [{ text: "Doors and drawer fronts sprayed and racked. Island top glued up; final sanding tomorrow morning before loading." }] }],
  bodyText: "Doors and drawer fronts sprayed and racked. Island top glued up; final sanding tomorrow morning before loading.",
  weather: null, crewCount: 2, hoursOnSite: 0, delays: null, authorUserId: LEO.userId, authorName: LEO.name, createdAt: iso(day(-1, 17)), updatedAt: iso(day(-1, 17)),
};

// ── /app/invoices/inv_2069 ──────────────────────────────────────────────────
// The Fortin laundry room, paid by card last Thursday — the page's payment
// row prints the fee Stripe kept and what was deposited (routes-work.js
// FEE_2069). app/api/invoices/[id] adds the family-wide payments list and
// chaseTrail; /lifecycle is the banner strip and the job link.
const INVOICE_DETAIL = {
  ...INV_2069,
  discount: 0,
  tax: INV_2069.taxTotal,
  taxEnabled: true,
  amountRefunded: 0,
  notes: "Thank you for choosing Érable Design. Payment by e-transfer to hello@erabledesign.ca, or by card through the link in your email.",
  clientPhotos: [],
  historicalImportedAt: null,
  sentToEmail: FORTIN.email,
  client: { id: FORTIN.id, name: FORTIN.name, contactName: null, email: FORTIN.email, phone: FORTIN.phone, country: FORTIN.country, province: FORTIN.province },
  lineItems: [
    { description: "Laundry room cabinets — 9 lin. ft, painted shaker", quantity: 9, amount: 4230 },
    { description: "Laminate counter with backsplash", quantity: 1, amount: 1260 },
    { description: "Installation", quantity: 1, amount: 830 },
  ],
  chaseTrail: { lastChasedAt: null, chaseCount: 0, automated: [] },
};
const INVOICE_LIFECYCLE = {
  job: { id: "j_315", title: "Fortin laundry room — cabinets & counter", status: "completed", completedAt: iso(day(-4, 15, 10)), quoteId: "q_1036", startDate: iso(day(-4, 8)), endDate: iso(day(-4, 15)), visits: [{ id: "v_315a", scheduledAt: iso(day(-4, 8)), status: "completed", assignedToId: ANA.userId, assignedTo: who(ANA) }], linkSource: "invoice" },
  chaseTask: null,
  banners: [{ id: "paid", tone: "success", data: { paid: INV_2069.total, paidDate: INV_2069.paidDate } }],
  money: { total: INV_2069.total, paid: INV_2069.total, due: 0 },
  canLinkJob: false,
  costing: {
    estimatedCost: 3980, estimatedAt: iso(day(-16, 9)), estimatedBasis: "saved", revenue: 6320,
    actual: { expenses: { total: 2214, byCategory: [{ category: "Materials", amount: 2214 }] }, labour: { approvedHours: 30, pendingHours: 0, cost: 1200, unratedHours: 0, workers: 1 }, total: 3414, incomplete: false },
    comparison: { estimatedCost: 3980, actualCost: 3414, revenue: 6320, variance: -566, variancePct: -14.2, profit: 2906, marginPct: 46, overBudget: false },
  },
  payroll: { periods: [{ id: "run_0913", periodStart: "2026-08-31T00:00:00.000Z", periodEnd: "2026-09-13T00:00:00.000Z", status: "approved", paidAt: null, hours: 30 }], hoursNotInAnyRun: 0, crew: [{ workerId: W.u_ana.id, userId: ANA.userId, name: ANA.name, hours: 30, hourlyRate: 40, rateHidden: false }] },
};
const INVOICE_DOCUMENT = {
  groups: [{
    id: "sg_1036a", categoryKey: CAT_KITCHEN.key, label: "Laundry room", subtotal: 6320, accent: null,
    lineItems: INVOICE_DETAIL.lineItems,
    description: "Painted shaker cabinets over and under a laminate counter, built in our Laval shop.",
    included: ["Soft-close hinges on every door", "Removal and disposal of the old cabinet", "Two-year workmanship warranty"],
    mayChange: [],
  }],
  hasTradeContent: true,
  quote: { id: "q_1036", quoteNumber: "Q-1036" },
  processSteps: [],
  glossary: [],
  processNotes: COMPANY.defaultProcessNotes,
  processNotesSource: "company",
  paymentTerms: COMPANY.paymentTerms,
  paymentSchedule: parsePaymentSchedule(COMPANY.paymentTerms),
};

// The builder client's invoice, twelve days past due and chased once — the
// page the Chase (request payment) dialog opens on.
const INVOICE_2066_DETAIL = {
  ...INV_2066,
  discount: 0,
  tax: INV_2066.taxTotal,
  taxEnabled: true,
  amountRefunded: 0,
  notes: "Net 30. Please reference INV-2066 on the transfer.",
  clientPhotos: [],
  historicalImportedAt: null,
  sentToEmail: RIVENORD.email,
  client: { id: RIVENORD.id, name: RIVENORD.name, contactName: "Louis Archambault", email: RIVENORD.email, phone: RIVENORD.phone, country: RIVENORD.country, province: RIVENORD.province },
  lineItems: [{ description: "Model-home vanities — 3 units, delivered", quantity: 3, amount: 3450 }],
  chaseTrail: { lastChasedAt: INV_2066.lastChasedAt, chaseCount: 1, automated: [{ sentAt: iso(day(-9, 8)), ruleName: "7 days past due" }] },
};
const INVOICE_2066_LIFECYCLE = {
  job: null,
  chaseTask: { id: "task_chase_2066", status: "open", dueDate: iso(day(2, 9)), title: "Chase INV-2066 — Groupe Immobilier Rive-Nord" },
  banners: [
    { id: "overdue", tone: "critical", data: { days: 12, due: INV_2066.amountDue, dueDate: INV_2066.dueDate } },
    { id: "chaseDue", tone: "warning", action: "chase", data: { dueDate: iso(day(2, 9)), due: INV_2066.amountDue } },
  ],
  money: { total: INV_2066.total, paid: 0, due: INV_2066.amountDue },
  canLinkJob: false,
  costing: null,
  payroll: null,
};
const INVOICE_2066_DOCUMENT = {
  groups: [{ id: "sg_2066", categoryKey: SERVICE_CATEGORIES[1].key, label: "Bathroom vanities", subtotal: 3450, accent: null, lineItems: INVOICE_2066_DETAIL.lineItems, description: "", included: [], mayChange: [] }],
  hasTradeContent: false,
  quote: null,
  processSteps: [],
  glossary: [],
  processNotes: null,
  processNotesSource: null,
  paymentTerms: "Net 30.",
  paymentSchedule: null,
};

// ── /accept-invitation/<id> and /signup — a stranger at the door ─────────────
// app/api/invitations/[id]: Julie invited a new installer against the
// company's licensed seats (non-negotiable #1: joining is invite-only).
export const INVITE_ID = "inv_k7d2m9";
const INVITATION = { id: INVITE_ID, email: "thomas.lefebvre@example.com", role: "employee", roleLabel: "Employee", status: "pending", orgName: COMPANY.name, expired: false, hasAccount: false };
const isSignup = (ctx) => ctx.screen?.slug === "signup";

// ── /app/clients/cl_dubois ──────────────────────────────────────────────────
const CLIENT_DETAIL = {
  ...CLIENT,
  type: "individual",
  contactName: null,
  quotes: [Q_1042],
  invoices: INVOICES.filter((i) => i.clientId === CLIENT.id),
  jobs: JOBS.filter((j) => j.clientId === CLIENT.id).map((j) => ({ id: j.id, title: j.title, jobNumber: j.jobNumber, status: j.status })),
};
const CLIENT_EQUIPMENT = {
  equipment: [
    {
      id: "eq_dubois_hinges", clientId: CLIENT.id, name: "Blum Clip-top soft-close hinges", manufacturer: "Blum", modelNumber: "71B3550", serialNumber: null, siteAddress: CLIENT.address,
      installedAt: null, warrantyEndsAt: iso(day(365 * 2)), warrantyProvider: "Érable Design (workmanship)", warrantyNotes: "Two-year workmanship warranty from installation.", installedByJobId: JOB.id, notes: null,
      createdAt: iso(day(-6)), updatedAt: iso(day(-6)),
      warranty: { state: "ok", daysRemaining: 730, endsAt: iso(day(365 * 2)) },
      services: [],
      history: { count: 0, underWarranty: 0, last: null },
    },
  ],
  tally: { expired: 0, dueSoon: 0, ok: 1, unknown: 0, total: 1 },
};

// ── /app/plans/sp_dubois ────────────────────────────────────────────────────
const PLAN_DETAIL = {
  ...PLANS[0],
  occurrences: [1, 2, 3].map((seq) => ({ id: `po_dubois_${seq}`, seq, dueDate: iso(day(365 * seq, 9)), status: "pending", total: PLANS[0].perOccurrence.total, invoiceId: null, chargeFailureMessage: null })),
};

// ── /app/payroll/run_0913 ───────────────────────────────────────────────────
// The fortnight that closed yesterday, approved this morning, paid Thursday.
// Lines and totals are routes-money.js's, so this page and the Payroll list
// agree to the cent.
const PAY_RUN_DETAIL = {
  ...PAY_RUNS[0],
  companyId: COMPANY.id,
  notes: null,
  approvedById: MARC.userId,
  createdById: MARC.userId,
  createdAt: iso(day(0, 8, 12)),
  updatedAt: iso(day(0, 8, 40)),
  canRun: true,
  lines: PAY_RUN_LINES.map((l) => ({ ...l, workerId: W[PEOPLE.find((p) => p.name === l.workerName).userId].id })),
};

// ── /app/funnels/fn_kitchen ─────────────────────────────────────────────────
const FUNNEL_DETAIL = { ...FUNNEL, companyId: COMPANY.id, createdById: JULIE.userId, company: { name: COMPANY.name, slug: SLUG, logoUrl: COMPANY.logoUrl, brandColor: COMPANY.brandColor } };
const FUNNEL_ANALYTICS = {
  starts: 212,
  completions: 14,
  conversionRate: 7,
  steps: FUNNEL_STEPS.map((s, i) => ({ id: s.id, kind: s.kind, label: s.headline || s.question || s.kind, views: [212, 148, 121, 96, 41, 14][i] ?? 0, retention: i === 0 ? null : Math.round(([212, 148, 121, 96, 41, 14][i] / [212, 148, 121, 96, 41, 14][i - 1]) * 100) })),
};

// ── /app/marketing/mc_flyers ────────────────────────────────────────────────
// The flyer route through Sainte-Rose, 40 doors; Samuel has walked 26. No
// coordinates on the stops, so the page draws its "add addresses" map
// placeholder rather than asking Google for a static map.
const STOP_STATUS = ["delivered", "delivered", "spoke", "delivered", "not_home", "delivered", "spoke", "delivered", "delivered", "not_home"];
const CAMPAIGN_DETAIL = {
  ...CAMPAIGNS[0],
  companyId: COMPANY.id,
  assignedToId: SAM.userId,
  templateId: null,
  updatedAt: iso(day(-1, 17)),
  stops: Array.from({ length: 40 }, (_, i) => ({
    id: `st_${i + 1}`, campaignId: "mc_flyers", address: `${120 + i * 4} rue de la Sapinière, Laval, QC`, latitude: null, longitude: null, sortOrder: i,
    status: i < 26 ? STOP_STATUS[i % STOP_STATUS.length] : "pending",
    spokeToOwner: i < 26 && STOP_STATUS[i % STOP_STATUS.length] === "spoke",
    notes: i === 2 ? "Wants a vanity quote — call after the 20th." : i === 6 ? "Neighbour of the Fortins; saw the laundry room." : null,
    assignedToId: SAM.userId, assignedTo: who(SAM),
    clientId: i === 6 ? FORTIN.id : null, client: i === 6 ? { id: FORTIN.id, name: FORTIN.name } : null,
    appointmentId: null, quoteId: null, createdAt: iso(day(-12, 9)), updatedAt: iso(day(-1, 17)),
  })),
};

// ── /app/messages/review ────────────────────────────────────────────────────
// lib/messaging/monthlyReview.js over the month the page asks for (it opens
// on the current one — September, two weeks in): eleven conversations,
// three won, and the two nobody answered — the figure the "reply faster"
// article hangs on. The scores' reasons carry real signal keys
// (app.messages.signal.*). Day numbers stay within the first thirteen so the
// month reads as "so far" on the 14th.
let REVIEW_YM = { year: 2026, month: 9 };
const AUG = (d, h = 10) => new Date(`${REVIEW_YM.year}-${String(REVIEW_YM.month).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00-04:00`).toISOString();
const reason = (id, weight, quote, direction = "inbound") => ({ id, labelKey: `app.messages.signal.${id}`, weight, quote, direction, detail: null });
const thread = (id, name, platform, outcome, d, msgs, inbound, answered, firstMin, score) => ({
  id, participantName: name, platform, channelName: platform === "instagram" ? "@erabledesign" : platform === "facebook" ? "Érable Design Cabinetry" : "+1 450 555 0190",
  outcome, createdAt: AUG(d), lastMessageAt: AUG(Math.min(13, d + 1), 15), messageCount: msgs, inboundCount: inbound, source: platform,
  answered, firstResponseMinutes: firstMin, noInbound: false, score,
});
const reviewThreads = () => [
  thread("th_a", "Marie-Ève Lapointe", "instagram", "won", 3, 14, 7, true, 8, { temperature: "hot", score: 82, confidence: "clear", reasons: [reason("budget_stated", 25, "we've set aside about 30k for the kitchen"), reason("logistics_initiated", 20, "when could you come measure?"), reason("schedule_accommodation", 15, "we can do evenings")], disqualified: null, messageCount: 14, ai: false, scoredAt: AUG(7) }),
  thread("th_b", "Jonathan Pelletier", "facebook", "won", 5, 9, 4, true, 22, { temperature: "hot", score: 71, confidence: "clear", reasons: [reason("product_questions", 15, "is the island solid oak or veneer?"), reason("logistics_initiated", 20, "can you do the install before Thanksgiving?")], disqualified: null, messageCount: 9, ai: false, scoredAt: AUG(9) }),
  thread("th_c", "Amélie Gauthier", "sms", "won", 11, 6, 3, true, 5, { temperature: "warm", score: 58, confidence: "thin", reasons: [reason("scope_growth", 15, "and maybe the pantry too")], disqualified: null, messageCount: 6, ai: false, scoredAt: AUG(14) }),
  thread("th_d", "Éric Boisvert", "instagram", "lost", 6, 8, 4, true, 190, { temperature: "warm", score: 44, confidence: "clear", reasons: [reason("comparison_shopping", -10, "getting three quotes"), reason("budget_stated", 25, "under 20k ideally")], disqualified: null, messageCount: 8, ai: false, scoredAt: AUG(10) }),
  thread("th_e", "Sandra Nguyen", "facebook", "lost", 12, 5, 3, true, 1440, { temperature: "cold", score: 22, confidence: "clear", reasons: [reason("silence_after_quote", -20, null, "outbound"), reason("price_tier_rejection", -15, "that's more than we expected")], disqualified: null, messageCount: 5, ai: false, scoredAt: AUG(18) }),
  thread("th_f", "Patrick Morin", "sms", "no_reply", 9, 3, 2, true, 46, { temperature: "warm", score: 40, confidence: "thin", reasons: [reason("product_questions", 15, "do you do walnut?")], disqualified: null, messageCount: 3, ai: false, scoredAt: AUG(16) }),
  thread("th_g", "Geneviève Tremblay", "instagram", "no_reply", 10, 2, 2, false, null, { temperature: "warm", score: 38, confidence: "thin", reasons: [reason("logistics_initiated", 20, "are you taking new projects this fall?")], disqualified: null, messageCount: 2, ai: false, scoredAt: AUG(21) }),
  thread("th_h", "Mathieu Roy", "facebook", "no_reply", 13, 1, 1, false, null, { temperature: "cold", score: 18, confidence: "thin", reasons: [], disqualified: null, messageCount: 1, ai: false, scoredAt: AUG(25) }),
  thread("th_i", "Louise Bergeron", "sms", "not_a_job", 8, 4, 2, true, 12, { temperature: "cold", score: 5, confidence: "clear", reasons: [], disqualified: { labelKey: "app.messages.signal.out_of_area", quote: "we're in Sherbrooke" }, messageCount: 4, ai: false, scoredAt: AUG(9) }),
  thread("th_j", "Simon Lavallée", "instagram", null, 12, 6, 3, true, 15, { temperature: "warm", score: 52, confidence: "thin", reasons: [reason("budget_stated", 25, "around 25k"), reason("polite_pre_decline", -10, "we'll think about it")], disqualified: null, messageCount: 6, ai: false, scoredAt: AUG(29) }),
  thread("th_k", "Caroline Dubé", "facebook", null, 13, 4, 2, true, 31, { temperature: "warm", score: 47, confidence: "thin", reasons: [reason("product_questions", 15, "what paint do you use on the doors?")], disqualified: null, messageCount: 4, ai: false, scoredAt: AUG(30) }),
];
const median = (xs) => { const a = xs.filter((x) => Number.isFinite(x)).sort((x, y) => x - y); if (!a.length) return null; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const OUTCOMES = ["won", "lost", "no_reply", "not_a_job", "unset"];
const monthlyReview = (year, month) => {
  REVIEW_YM = { year, month };
  const REVIEW_THREADS = reviewThreads();
  const judged = REVIEW_THREADS.filter((r) => r.outcome).length;
  return {
  ok: true,
  month: `${year}-${String(month).padStart(2, "0")}`,
  range: { start: AUG(1, 0), end: new Date(Date.UTC(year, month, 1) - 1).toISOString() },
  totals: { started: REVIEW_THREADS.length, answered: REVIEW_THREADS.filter((r) => r.answered).length, neverAnswered: REVIEW_THREADS.filter((r) => !r.answered).length, noInbound: 0, judged },
  byOutcome: Object.fromEntries(OUTCOMES.map((o) => [o, REVIEW_THREADS.filter((r) => (r.outcome || "unset") === o).length])),
  // A fraction: the page multiplies by a hundred.
  wonRate: 3 / judged,
  medianFirstResponseMinutes: median(REVIEW_THREADS.filter((r) => r.answered).map((r) => r.firstResponseMinutes)),
  responseByOutcome: Object.fromEntries(OUTCOMES.map((o) => {
    const rows = REVIEW_THREADS.filter((r) => (r.outcome || "unset") === o);
    return [o, { answered: rows.filter((r) => r.answered).length, unanswered: rows.filter((r) => !r.answered).length, medianMinutes: median(rows.filter((r) => r.answered).map((r) => r.firstResponseMinutes)) }];
  })),
  neverAnswered: REVIEW_THREADS.filter((r) => !r.answered),
  threads: REVIEW_THREADS,
  ranked: [...REVIEW_THREADS].sort((a, b) => (b.score?.score || 0) - (a.score?.score || 0)),
  };
};
const REVIEW_AI = {
  connection: { connected: true },
  review: null,
  available: true,
  price: { estimatedTokens: 18400, estimated: 0.06, remaining: 412000, cap: 500000, allowed: true },
  sample: { sampled: 11, won: 3, unmatched: 0 },
};

// ═══════════════════════════════════════════════════════════════════════════
// The crew's phone — Léo Bouchard, Crew preset
// ═══════════════════════════════════════════════════════════════════════════
// What the same routes answer when the caller is Léo: the money routes
// refuse (the real ones 403 a Crew member — lib/permissions/apiGate.js), the
// clock and the leave routes resolve the worker from the session and answer
// HIS punches and HIS balances, and the safety list is the incident he
// filed.
const LEO_OPEN = TIME_ENTRIES.find((e) => e.id === "te_20");
const CREW_CLOCK = {
  worker: { id: W.u_leo.id, name: LEO.name },
  open: { id: LEO_OPEN.id, clockIn: LEO_OPEN.clockIn, jobId: JOB.id, job: { id: JOB.id, title: JOB.title } },
  today: [{ ...LEO_OPEN, clockOut: null, hours: null, status: "pending" }],
  todayHours: 5.5,
  jobOptions: CLOCK.jobOptions,
  todayCount: 1,
  suggestedJobId: JOB.id,
  truncated: false,
};
const CREW_LEAVE = {
  scope: "self",
  worker: { id: W.u_leo.id, name: LEO.name },
  policies: POLICIES,
  requests: TEAM_REQUESTS.filter((r) => r.workerId === W.u_leo.id),
  balances: TEAM_BALANCES.filter((b) => b.workerId === W.u_leo.id),
};
const CREW_TIME_ENTRIES = TIME_ENTRIES.filter((e) => e.workerId === W.u_leo.id);
// The job as the crew sees it: their visits and the address, no client
// contact details beyond the name (clientsProperties: name_address_only),
// no money — redactJob strips the quote link and the stage amounts.
const CREW_JOB = {
  ...JOB_DETAIL,
  total: undefined,
  quote: null,
  client: { name: CLIENT.name, address: CLIENT.address, city: CLIENT.city, province: CLIENT.province, restricted: true },
  paymentStages: [],
  changeOrders: [],
};
const crewOr = (mine, theirs) => (ctx) => (isCrew(ctx) ? mine(ctx) : theirs(ctx));

const TEXT_BLOCKS = seedRowsFor(COMPANY.id, "en").map((r, i) =>
  presentTextBlock({ ...r, id: i === 3 ? "tb_exclusions" : `tb_${r.seedKey}`, updatedAt: iso(day(-3)) }),
);
const QUOTE_TEMPLATES = [
  {
    id: "qt_1",
    name: "Kitchen refacing — painted maple",
    language: "en",
    groups: [{ id: null, categoryId: CAT_REFACING.id, category: { id: CAT_REFACING.id, key: CAT_REFACING.key, label: CAT_REFACING.label }, label: "Kitchen refacing", lineItems: QUOTE_1044_DETAIL.scopeGroups[0].lineItems, takeoff: null, intakeValues: { doorCount: 22, drawerCount: 8 }, subtotal: 9800 }],
    notes: "",
    processNotes: COMPANY.defaultProcessNotes,
    createdAt: iso(day(-10)),
    sourceQuoteId: Q_1042.id,
  },
];

// ── The document-shaped builder and the painter's first screen ────────────
//
// Two fixture companies from one: a slug carrying "doc-builder" answers
// business-info with quoteBuilderLayout "document" (the flag the platform
// flips per company); a slug carrying "painter" answers the categories with
// the two painting trades switched on, which is what puts "What kind of
// estimate is this?" first on New quote (EstimateTypeFirst.js). Every other
// frame keeps the cabinet shop it always had. Consulted first; a miss defers
// to the group file's answer.
const isDocBuilder = (ctx) => /doc-builder/.test(ctx.screen?.slug || "");
const isPainter = (ctx) => /painter/.test(ctx.screen?.slug || "");
const PAINTER_CATEGORIES = SERVICE_CATEGORIES.map((c) =>
  c.key === "interior_painting" || c.key === "exterior_painting" ? { ...c, enabled: true } : c,
);
// The document builder's cabinet shop sells stone as well as cabinets —
// refinishing, refacing AND countertops, which is the trade set the owner's
// own company runs. Without it the many-services frames say nothing: a
// company with two enabled trades cannot show three scopes on one quote.
const DOC_BUILDER_CATEGORIES = SERVICE_CATEGORIES.map((c) =>
  c.key === "countertop" ? { ...c, enabled: true } : c,
);

const PURE_PAINTER_CATEGORIES = PAINTER_CATEGORIES.map((c) =>
  c.key === "cabinet_refinishing" || c.key === "cabinet_refacing" ? { ...c, enabled: false } : c,
);
const STAIRS_CATEGORIES = SERVICE_CATEGORIES.map((c) => (c.key === "stairs" ? { ...c, enabled: true } : c));

// ── Client tickets (2026-09-24) ─────────────────────────────────────────
// What the Tickets queue, one ticket and the open-count badge answer for the
// client-portal rows in screens.js.
const TICKET_1 = {
  id: "tk_hinge", companyId: COMPANY.id, clientId: CLIENT.id, jobId: JOB.id, jobVisitId: null, invoiceId: null, quoteId: null, servicePlanId: null,
  type: "warranty", subject: "Pantry door hinge is dropping", body: "Since last week the tall pantry door rubs the drawer below when it closes. Photo attached.",
  photos: [{ url: "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=400", kind: "photo" }],
  status: "in_progress", priority: "high", assignedToId: "u_julie", convertedJobId: null,
  firstResponseAt: iso(day(-1)), resolvedAt: null, createdAt: iso(day(-2)), updatedAt: iso(day(-1)),
  client: { id: CLIENT.id, name: CLIENT.name, email: CLIENT.email, phone: CLIENT.phone },
  messages: [
    { id: "tm_1", author: "member", memberId: "m_julie", authorName: "Julie Gagnon", body: "Thanks Sophie — that is covered. Léo can adjust the hinge Thursday morning; does 9:00 work?", photos: null, createdAt: iso(day(-1)) },
    { id: "tm_2", author: "client", memberId: null, authorName: null, body: "Thursday at 9 is perfect, thank you.", photos: null, createdAt: iso(day(0)) },
  ],
};
const TICKET_ROWS = [
  { id: "tk_hinge", type: "warranty", subject: TICKET_1.subject, status: "in_progress", priority: "high", assignedToId: "u_julie", assignee: "Julie Gagnon", jobId: JOB.id, convertedJobId: null, createdAt: TICKET_1.createdAt, updatedAt: TICKET_1.updatedAt, firstResponseAt: TICKET_1.firstResponseAt, client: { id: CLIENT.id, name: CLIENT.name }, _count: { messages: 2 } },
  { id: "tk_move", type: "reschedule", subject: "Move Interior repaint on Tue, Oct 6", status: "open", priority: "normal", assignedToId: null, assignee: null, jobId: null, convertedJobId: null, createdAt: iso(day(0)), updatedAt: iso(day(0)), firstResponseAt: null, client: { id: "cl_lavoie", name: "Martin Lavoie" }, _count: { messages: 0 } },
  { id: "tk_bill", type: "billing", subject: "Deposit shows twice on my statement", status: "waiting_on_client", priority: "normal", assignedToId: "u_marc", assignee: "Marc Tremblay", jobId: null, convertedJobId: null, createdAt: iso(day(-4)), updatedAt: iso(day(-3)), firstResponseAt: iso(day(-3)), client: { id: "cl_fortin", name: "Élise Fortin" }, _count: { messages: 1 } },
];
const CLIENT_TICKET_ROUTES = [
  {
    path: "/api/client-tickets",
    method: "GET",
    reply: ({ search }) =>
      search?.get("count") === "1"
        ? { open: 2 }
        : { tickets: TICKET_ROWS, counts: { open: 1, in_progress: 1, waiting_on_client: 1, resolved: 4, closed: 2 } },
  },
  {
    path: "/api/client-tickets/tk_hinge",
    method: "GET",
    reply: () => ({
      ticket: TICKET_1,
      job: { id: JOB.id, title: JOB.title },
      convertedJob: null,
      assignees: PEOPLE.map((p) => ({ userId: p.userId, name: p.name })),
    }),
  },
];

export const ROUTES_HELP = [
  ...CLIENT_TICKET_ROUTES,
  // Settings › Services, seeds screen: the same cabinet company with handyman
  // switched on, its seeded rows in the price book, and the industry preset
  // widened so the handyman card is shown. Every other screen falls through.
  { path: "/api/settings/service-categories", method: "GET", reply: (ctx) => (ctx.screen?.slug === "settings-services-seeds" ? [...SERVICE_CATEGORIES, HANDYMAN_CATEGORY] : ctx.next()) },
  { path: "/api/products", method: "GET", reply: (ctx) => (ctx.screen?.slug === "settings-services-seeds" ? [...PRODUCTS_FIXTURE, ...SEEDED_HANDYMAN] : ctx.next()) },
  { path: "/api/settings/business-info", method: "GET", reply: (ctx) => (ctx.screen?.slug === "settings-services-seeds" ? { ...BUSINESS_INFO_FIXTURE, industries: [...(BUSINESS_INFO_FIXTURE.industries || []), "handyman"] } : ctx.next()) },
  { path: "/api/settings/business-info", method: "GET", reply: (ctx) => (isDocBuilder(ctx) ? { ...COMPANY, quoteBuilderLayout: "document" } : ctx.next()) },
  // Company Settings › Save (2026-09-24): the PATCH answers the row plus the
  // auto-translation summary the route queues for the two client-facing
  // texts, which is what the "Translated automatically" banner reads.
  {
    path: "/api/settings/business-info",
    method: "PATCH",
    reply: () => ({
      ...BUSINESS_INFO_FIXTURE,
      autoTranslate: { queued: true, model: "company", keys: ["paymentTerms", "defaultProcessNotes"], languages: ["fr", "es", "uk", "pa", "tl", "de", "it"] },
    }),
  },
  // Two more shapes for the quote-fix frames (2026-09-22): "purepainter" is a
  // painter with NO cabinet trade, so the painter's own "Cabinets & millwork"
  // takeoff is what its card opens; "stairs" is the cabinet shop with Stairs
  // switched on, for the staircase whose price has to move with its level.
  // Both sit BEFORE the painter row: "purepainter" matches /painter/ too.
  { path: "/api/settings/service-categories", method: "GET", reply: (ctx) => (/purepainter/.test(ctx.screen?.slug || "") ? PURE_PAINTER_CATEGORIES : ctx.next()) },
  { path: "/api/settings/service-categories", method: "GET", reply: (ctx) => (/stairs/.test(ctx.screen?.slug || "") ? STAIRS_CATEGORIES : ctx.next()) },
  { path: "/api/settings/service-categories", method: "GET", reply: (ctx) => (isPainter(ctx) ? PAINTER_CATEGORIES : ctx.next()) },
  // After the painter row, and only for a slug that is not the painter's:
  // "quote-new-painter-doc-builder" matches both tests and must keep the
  // painting trades it is named for.
  { path: "/api/settings/service-categories", method: "GET", reply: (ctx) => (isDocBuilder(ctx) && !isPainter(ctx) ? DOC_BUILDER_CATEGORIES : ctx.next()) },
  // ── Settings › Presentation and the proposal's staff side ─────────────
  { path: "/api/settings/presentation", method: "GET", reply: () => PRESENTATION_SETTINGS },
  { path: "/api/settings/gallery", method: "GET", reply: () => ({ pairs: GALLERY_PAIRS }) },
  { path: "/api/settings/company-documents", method: "GET", reply: () => ({ documents: COMPANY_DOCUMENTS }) },
  { path: `/api/quotes/${QUOTE.id}/presentation`, method: "GET", reply: () => QUOTE_PRESENTATION(QUOTE) },
  { path: `/api/quotes/${Q_1044.id}/presentation`, method: "GET", reply: () => QUOTE_PRESENTATION(Q_1044) },
  { path: "/api/waivers", method: "GET", reply: () => WAIVERS_FOR({}) },
  ...MEASURE_ROUTES,
  // ── The crew's phone: the same routes, Léo's answers ────────────────────
  { path: "/api/settings/members/self/role", reply: crewOr(() => ({ assignableRoles: [], canGrantAccess: false, yourRole: "employee", role: "employee" }), () => ({ assignableRoles: ["admin", "supervisor", "employee"], canGrantAccess: true, yourRole: "owner", role: "owner" })) },
  { path: "/api/analytics/overview", reply: crewOr(forbidden, (ctx) => ctx.next()) },
  { path: "/api/analytics/receivables", reply: crewOr(forbidden, (ctx) => ctx.next()) },
  { path: "/api/analytics/goal", reply: crewOr(forbidden, (ctx) => ctx.next()) },
  { path: "/api/quotes", method: "GET", reply: crewOr(forbidden, (ctx) => ctx.next()) },
  { path: "/api/invoices", method: "GET", reply: crewOr(forbidden, (ctx) => ctx.next()) },
  { path: "/api/leads", method: "GET", reply: crewOr(forbidden, (ctx) => ctx.next()) },
  { path: "/api/bookings/awaiting-payment", reply: crewOr(forbidden, (ctx) => ctx.next()) },
  { path: "/api/quotes/estimate-reviews", reply: crewOr(forbidden, (ctx) => ctx.next()) },
  { path: "/api/voice/calls", reply: crewOr(forbidden, (ctx) => ctx.next()) },
  { path: "/api/migrations", reply: crewOr(forbidden, (ctx) => ctx.next()) },
  { path: "/api/time-clock", method: "GET", reply: crewOr(() => CREW_CLOCK, () => CLOCK) },
  { path: "/api/time-entries", method: "GET", reply: crewOr(() => CREW_TIME_ENTRIES, () => TIME_ENTRIES) },
  { path: "/api/leave", method: "GET", reply: crewOr((ctx) => (ctx.search.get("scope") === "team" ? forbidden() : CREW_LEAVE), (ctx) => ctx.next()) },
  { path: "/api/safety-incidents", method: "GET", reply: crewOr(() => ({ incidents: INCIDENTS.filter((i) => i.reportedByMemberId === LEO.id) }), (ctx) => ctx.next()) },

  // ── The back office's detail pages ──────────────────────────────────────
  { path: `/api/quotes/${QUOTE.id}`, method: "GET", reply: () => QUOTE_DETAIL },
  { path: `/api/quotes/${QUOTE.id}/document`, method: "GET", reply: () => QUOTE_DOCUMENT },
  { path: `/api/quotes/${QUOTE.id}/costing`, method: "GET", reply: () => QUOTE_COSTING },
  { path: `/api/quotes/${QUOTE.id}/email-sections`, method: "GET", reply: () => EMAIL_SECTIONS },
  { path: `/api/quotes/${QUOTE.id}/imports`, method: "GET", reply: () => ({ asSource: [], asImporter: [] }) },
  { path: `/api/quotes/${Q_1044.id}`, method: "GET", reply: () => QUOTE_1044_DETAIL },
  { path: `/api/quotes/${Q_1044.id}/document`, method: "GET", reply: () => QUOTE_1044_DOCUMENT },
  { path: `/api/quotes/${Q_1044.id}/costing`, method: "GET", reply: forbidden },
  { path: `/api/quotes/${Q_1044.id}/email-sections`, method: "GET", reply: () => ({ ...EMAIL_SECTIONS, quoteId: Q_1044.id }) },
  { path: `/api/quotes/${Q_1044.id}/imports`, method: "GET", reply: () => ({ asSource: [], asImporter: [] }) },
  { path: `/api/quotes/${Q_1044.id}/share`, method: "GET", reply: () => ({ url: `https://app.fieldquo.com/q/${QUOTE_TOKEN}`, token: QUOTE_TOKEN }) },
  // ── The same screen on an UNSENT draft ────────────────────────────────────
  // Since the share token is minted at save, a draft has a link too, and the
  // Send… menu's Preview and Copy link rows are live on it — with the copy
  // row saying what a draft link does and does not do. GET /share answers a
  // token here because the quote was saved, not because it was sent.
  { path: `/api/quotes/${DRAFT_DETAIL.id}`, method: "GET", reply: () => DRAFT_DETAIL },
  { path: `/api/quotes/${DRAFT_DETAIL.id}/document`, method: "GET", reply: () => ({ ...QUOTE_1044_DOCUMENT, id: DRAFT_DETAIL.id, status: "draft", sentAt: null }) },
  { path: `/api/quotes/${DRAFT_DETAIL.id}/costing`, method: "GET", reply: forbidden },
  { path: `/api/quotes/${DRAFT_DETAIL.id}/email-sections`, method: "GET", reply: () => ({ ...EMAIL_SECTIONS, quoteId: DRAFT_DETAIL.id }) },
  { path: `/api/quotes/${DRAFT_DETAIL.id}/imports`, method: "GET", reply: () => ({ asSource: [], asImporter: [] }) },
  { path: `/api/quotes/${DRAFT_DETAIL.id}/presentation`, method: "GET", reply: () => QUOTE_PRESENTATION(DRAFT_DETAIL) },
  { path: `/api/quotes/${DRAFT_DETAIL.id}/share`, method: "GET", reply: () => ({ url: `https://app.fieldquo.com/q/${QUOTE_PREVIEW_TOKEN}`, shareToken: QUOTE_PREVIEW_TOKEN }) },
  // The text-block library the builder's "+ Add area or line item" opens on
  // and Settings › Services lists: the nine shipped painting defaults, as
  // the route would seed them for an English company
  // (lib/quotes/textBlockSeed.js), plus one template saved from Q-1042.
  { path: "/api/quote-text-blocks", method: "GET", reply: () => TEXT_BLOCKS },
  { path: "/api/quote-templates", method: "GET", reply: () => QUOTE_TEMPLATES },
  ...EDIT_ROUTES(QUOTE_1046_DETAIL),
  ...EDIT_ROUTES(QUOTE_1045_DETAIL),
  { path: `/api/jobs/${JOB.id}`, method: "GET", reply: crewOr(() => CREW_JOB, () => JOB_DETAIL) },
  { path: `/api/jobs/${JOB.id}/costing`, method: "GET", reply: crewOr(forbidden, () => JOB_COSTING) },
  { path: `/api/jobs/${JOB.id}/subcontractors`, method: "GET", reply: crewOr(forbidden, () => ({ rows: [], roster: [], visits: JOB_DETAIL.visits.map((v) => ({ id: v.id, scheduledAt: v.scheduledAt })), imports: [], canManage: true, canSeeMoney: true })) },
  { path: `/api/jobs/${JOB.id}/change-orders/bill`, method: "GET", reply: crewOr(forbidden, () => ({ canBill: true, reason: null, unbilled: { count: 1, total: 385 }, invoice: { id: INVOICE.id, invoiceNumber: INVOICE.invoiceNumber, status: INVOICE.status }, preview: { added: 442.65, newTotal: round2(INVOICE.total + 442.65) } })) },
  { path: `/api/jobs/${JOB.id}/plan`, method: "GET", reply: crewOr(() => planPayload(true), () => planPayload(false)) },
  { path: `/api/public/change-orders/${CO_TOKEN}`, method: "GET", reply: (ctx) => changeOrderPublic(ctx) },
  { path: `/api/jobs/${JOB.id}/materials`, method: "GET", reply: crewOr(() => ({ materials: MATERIAL_LIST.materials.map(stripMoney), progress: { total: 11, bought: 3, outstanding: 8, complete: false, unpriced: 6, short: 2, costHidden: true }, built: MATERIAL_LIST.built, spend: MATERIAL_LIST.spend }), () => MATERIAL_LIST) },
  { path: `/api/jobs/${JOB.id}/work-order`, method: "GET", reply: crewOr(() => ({ workOrder: CREW_WORK_ORDER }), () => ({ workOrder: WORK_ORDER })) },
  { path: "/api/supply-requests", method: "GET", reply: crewOr(() => ({ requests: SUPPLY_REQUESTS.filter((r) => r.requestedById === LEO.userId), scope: "mine", open: 1, lowStock: [] }), () => ({ requests: SUPPLY_REQUESTS, scope: "company", open: 3, lowStock: [{ materialId: "mat_tape", itemName: "Painter's tape 1½\"", unit: "roll", level: 3, threshold: 6, quantity: 3 }] })) },
  { path: "/api/supply-requests/options", method: "GET", reply: () => SUPPLY_OPTIONS },
  { path: `/api/jobs/${JOB.id}/asset-use`, method: "GET", reply: () => ({ logs: [], assets: [] }) },
  { path: `/api/jobs/${JOB.id}/documents`, method: "GET", reply: crewOr(() => ({ chains: [], hiddenCount: 0, canUpload: false, canSeeMoney: false }), () => ({ chains: [{ id: "doc_1", current: { id: "doc_1", name: "Dubois — shop drawings v2.pdf", kind: "plan", url: "#", sizeBytes: 1843200, mimeType: "application/pdf", supersedesId: "doc_0", uploadedById: SAM.userId, uploadedAt: iso(day(-9, 11)), updatedAt: iso(day(-9, 11)) }, history: [{ id: "doc_0", name: "Dubois — shop drawings v1.pdf", kind: "plan", url: "#", sizeBytes: 1790000, mimeType: "application/pdf", supersedesId: null, uploadedById: SAM.userId, uploadedAt: iso(day(-14, 16)), updatedAt: iso(day(-14, 16)) }] }], hiddenCount: 0, canUpload: true, canSeeMoney: true })) },
  { path: `/api/jobs/${JOB.id}/daily-logs`, method: "GET", reply: () => ({ logs: [DAILY_LOG], day: { key: "2026-09-14", log: null, photoCount: 0, taskLines: [] } }) },
  { path: `/api/jobs/${JOB.id}/photos`, method: "GET", reply: () => JOB_PHOTOS },
  { path: "/api/tasks", method: "GET", reply: (ctx) => (ctx.search.get("jobId") === JOB.id ? JOB_TASKS : ctx.next()) },
  { path: `/api/invoices/${INV_2069.id}`, method: "GET", reply: () => INVOICE_DETAIL },
  { path: `/api/invoices/${INV_2069.id}/lifecycle`, method: "GET", reply: () => INVOICE_LIFECYCLE },
  { path: `/api/invoices/${INV_2069.id}/document`, method: "GET", reply: () => INVOICE_DOCUMENT },
  { path: `/api/invoices/${INV_2066.id}`, method: "GET", reply: () => INVOICE_2066_DETAIL },
  { path: `/api/invoices/${INV_2066.id}/lifecycle`, method: "GET", reply: () => INVOICE_2066_LIFECYCLE },
  { path: `/api/invoices/${INV_2066.id}/document`, method: "GET", reply: () => INVOICE_2066_DOCUMENT },
  { path: /^\/api\/invoices\/[^/]+\/credit-visit-fee$/, method: "GET", reply: () => ({ eligible: [], applied: [] }) },
  // A stranger on /signup has no company: business-info refuses and there is
  // no session, which is what puts the page on its first step.
  { path: "/api/settings/business-info", method: "GET", reply: (ctx) => (isSignup(ctx) ? new Response(JSON.stringify({ error: "Not signed in" }), { status: 401, headers: { "Content-Type": "application/json" } }) : ctx.next()) },
  { path: "/api/signup/resume", method: "GET", reply: () => ({ resume: false, company: null }) },
  { path: "/api/auth/get-session", method: "GET", reply: () => new Response("null", { status: 200, headers: { "Content-Type": "application/json" } }) },
  { path: `/api/invitations/${INVITE_ID}`, method: "GET", reply: () => INVITATION },
  // /signup: the sellable plans (app/api/marketing/plans) and the trade
  // catalogue (app/api/service-categories/public) — the same rows Settings ›
  // Account & billing and Settings › Services draw.
  { path: "/api/marketing/plans", method: "GET", reply: () => ({ plans: BILLING_PLANS.map(({ isPublic, stripePriceId, stripePriceIdAnnual, ...plan }) => plan), unavailable: false }) },
  { path: "/api/service-categories/public", method: "GET", reply: () => SERVICE_CATEGORIES.filter((c) => c.isSystem).map((c) => ({ id: c.id, key: c.key, label: c.label, icon: c.icon })) },
  // /app/jobs/import asks what an empty batch would default to.
  { path: "/api/jobs/import/preview", method: "POST", reply: () => ({ rows: [], summary: { total: 0, ready: 0, blocked: 0, duplicates: 0, defaultTaxApplied: true } }) },
  // ── One document look (2026-09-23): the invoice builder's own routes ────
  //
  // The document-shaped invoice builder loads the cost panel at the top of
  // its screen (useInvoiceCosting.js) and the review + deep read on an edit.
  // An edit frame answers a SAVED cost panel — two on the crew, materials —
  // so the profit card has labour and expenses to draw; the review frame
  // answers a stored review and one paid deep read, so the panel is
  // photographed with findings rather than with a button.
  { path: "/api/invoices/costing", method: "GET", reply: (ctx) => (/onelook-invoice-(edit|review)/.test(ctx.screen?.slug || "")
    ? { currency: "CAD", workers: [{ id: W.u_ana.id, name: ANA.name, hourlyRate: 40, userId: ANA.userId }, { id: W.u_leo.id, name: LEO.name, hourlyRate: 34, userId: LEO.userId }], overheadPerJob: null, overheadSource: null,
        saved: { crew: [{ id: W.u_ana.id, name: ANA.name, rate: 40, hours: 18 }, { id: W.u_leo.id, name: LEO.name, rate: 34, hours: 12 }], materialCost: 1840, overheadPct: 10, note: "", totals: { labourHours: 30, labourCost: 1128, materialCost: 1840, lineItemCost: 0, overhead: 632, totalCost: 3600 } }, seed: null }
    : /onelook-invoice/.test(ctx.screen?.slug || "")
      ? { currency: "CAD", workers: [{ id: W.u_ana.id, name: ANA.name, hourlyRate: 40, userId: ANA.userId }, { id: W.u_leo.id, name: LEO.name, hourlyRate: 34, userId: LEO.userId }], overheadPerJob: null, overheadSource: null, saved: null, seed: null }
      : ctx.next()) },
  { path: `/api/invoices/${INV_2069.id}/review`, method: "GET", reply: (ctx) => (/onelook-invoice-review/.test(ctx.screen?.slug || "")
    ? { review: { generatedAt: iso(day(0, 9, 12)), invoiceTotal: INV_2069.total, currency: "CAD", readiness: 78,
        checks: [
          { id: "no_due_date", severity: "medium", title: "No due date", detail: "The overdue reminders, the chase task and the \"overdue\" banner all key off the due date. Without one this invoice never becomes late." },
          { id: "vague_items", severity: "medium", title: "1 line the client won't recognise", detail: "\"Installation\" — a client paying a bill wants to see the work they agreed to, in the words they agreed to it in." },
          { id: "no_photos", severity: "low", title: "No photos", detail: "A finished-work photo on the invoice shows what was paid for. Optional, but it settles most \"what did I get for this\" calls before they happen." },
        ],
        rewrites: [{ from: "Installation", to: "Installation of the laundry room cabinets and counter — one day, two installers" }],
        photosAttached: 0 }, reviewedAt: iso(day(0, 9, 12)) }
    : { review: null, reviewedAt: null }) },
  { path: `/api/invoices/${INV_2069.id}/deep-read`, method: "GET", reply: (ctx) => (/onelook-invoice-review/.test(ctx.screen?.slug || "")
    ? { passes: [{ at: iso(day(-1, 15, 40)), photosRead: 2, costCents: 25, notes: ["The counter's back edge looks unsealed at the wall in the second photo — check before the client raises it.", "Looks like the left filler panel sits proud of the door line; may just be the angle."] }], spend: { allowed: true, reason: null, needCents: 25, balanceCents: 1240, shortfallCents: 0 } }
    : { passes: [], spend: { allowed: true, reason: null, needCents: 25, balanceCents: 1240, shortfallCents: 0 } }) },
  { path: "/api/invoices/costing", method: "GET", reply: () => ({ saved: null }) },
  { path: `/api/clients/${CLIENT.id}`, method: "GET", reply: () => CLIENT_DETAIL },
  { path: `/api/clients/${CLIENT.id}/equipment`, method: "GET", reply: () => CLIENT_EQUIPMENT },
  { path: `/api/service-plans/${PLANS[0].id}`, method: "GET", reply: () => PLAN_DETAIL },
  { path: `/api/payroll/runs/${PAY_RUNS[0].id}`, method: "GET", reply: () => PAY_RUN_DETAIL },
  { path: `/api/funnels/${FUNNEL.id}`, method: "GET", reply: () => FUNNEL_DETAIL },
  { path: `/api/funnels/${FUNNEL.id}/analytics`, method: "GET", reply: () => FUNNEL_ANALYTICS },
  { path: `/api/marketing/campaigns/${CAMPAIGNS[0].id}`, method: "GET", reply: () => CAMPAIGN_DETAIL },
  { path: "/api/messaging/review", method: "GET", reply: ({ search }) => ({ connection: { connected: true }, review: monthlyReview(Number(search.get("year")) || 2026, Number(search.get("month")) || 9) }) },
  { path: "/api/messaging/review/ai", method: "GET", reply: () => REVIEW_AI },

  // Client-facing
  // Auto-translation on save (2026-09-24): the client page of a FRENCH quote
  // for a company that writes in English — the payment terms arrive in the
  // document's language, as app/api/public/quotes/[token] now resolves them
  // through lib/i18n/companyText.js localisedCompany (the draft of the
  // company's current sentence), instead of the English column verbatim.
  {
    path: `/api/public/quotes/${QUOTE_TOKEN}`,
    method: "GET",
    reply: (ctx) => {
      if (ctx.screen?.slug !== "translate-client-quote-fr") return ctx.next();
      const terms = "Acompte de 50 % à la réservation, solde à l'installation.";
      const base = publicQuote({ ...ctx, lang: "fr" });
      return { ...base, language: "fr", company: { ...base.company, paymentTerms: terms }, paymentTerms: terms, paymentSchedule: parsePaymentSchedule(terms) };
    },
  },
  { path: `/api/public/quotes/${QUOTE_TOKEN}`, method: "GET", reply: (ctx) => publicQuote(ctx) },
  { path: `/api/public/quotes/${QUOTE_PREVIEW_TOKEN}`, method: "GET", reply: (ctx) => ({ ...publicQuote(ctx), status: "draft", sentAt: null, preview: true }) },
  { path: `/api/quotes/received/${QUOTE_PREVIEW_TOKEN}`, method: "GET", status: 404, reply: () => ({ error: "Not a contractor's quote" }) },
  { path: `/api/quotes/received/${QUOTE_TOKEN}`, method: "GET", status: 404, reply: () => ({ error: "Not a contractor's quote" }) },
  { path: `/api/portal/${PORTAL_TOKEN}`, method: "GET", reply: (ctx) => portal(ctx) },
  { path: `/api/booking/${SLUG}`, method: "GET", reply: () => bookingCompany() },
  { path: `/api/booking/${SLUG}/members`, method: "GET", reply: () => ({ company: { name: COMPANY.name, logoUrl: COMPANY.logoUrl, brandColor: COMPANY.brandColor }, members: [] }) },
  { path: `/api/booking/${SLUG}/availability`, method: "GET", reply: ({ search }) => {
    const et = EVENT_TYPES.find((e) => e.slug === search.get("eventTypeSlug")) || EVENT_TYPES[0];
    const mode = search.get("mode") || "visit";
    return { eventType: { name: et.name, durationMinutes: mode === "call" ? 20 : mode === "video" ? 30 : et.durationMinutes, mode }, slots: slotsBetween(search.get("from") || "2026-09-14", search.get("to") || "2026-09-30"), travel: null };
  } },
  { path: `/api/visit/${VISIT_TOKEN}`, method: "GET", reply: (ctx) => visitView(ctx) },
  { path: `/api/visit/${VISIT_TOKEN}/reschedule`, method: "GET", reply: ({ search }) => ({ slots: slotsBetween(search.get("from") || "2026-09-14", search.get("to") || "2026-09-30") }) },
  { path: `/api/self-quote/${SLUG}`, method: "GET", reply: (ctx) => selfQuote(ctx) },
  { path: `/api/instant-quote/${SLUG}`, method: "GET", reply: (ctx) => instantQuote(ctx) },
  { path: `/api/funnels/public/${SLUG}/${FUNNEL.slug}`, method: "GET", reply: () => publicFunnel() },
  { path: `/api/funnels/public/${SLUG}/${FUNNEL.slug}/event`, method: "POST", reply: () => ({ ok: true }) },
  { path: `/api/kitchen-design/${DESIGN_TOKEN}`, method: "GET", reply: () => kitchenDesign() },
];
