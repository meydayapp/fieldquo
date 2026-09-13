// docs/screens/app-guide/harness/fixtures/company.js
//
// One fixture company for every screen: a cabinet maker in Laval, Quebec,
// with the people, the client, the quote, the job, the invoice and the week
// every page in the guide is photographed around. Kept in one module so the
// same name appears on the invoice that appeared on the quote.
//
// Dates are anchored to a fixed "today" so a capture run in March and one in
// September show the same week, and so "3 days ago" is a fact and not a
// function of the clock on the machine that ran it.
export const TODAY = new Date("2026-09-14T13:00:00-04:00"); // Monday 14 Sept 2026, 1:00 PM Montreal
export const iso = (d) => new Date(d).toISOString();
export const day = (offset, hour = 9, minute = 0) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + offset);
  d.setHours(hour, minute, 0, 0);
  return d;
};

import { PERMISSION_PRESETS } from "@/lib/permissions";

export const OWNER = { userId: "u_marc", id: "m_marc", name: "Marc Tremblay", email: "marc@erabledesign.ca", role: "owner" };
// `role` is the stored tier (owner / admin / supervisor / employee — see
// lib/permissions/roleManagement.js ROLE_LABELS) and `permissions` is the
// grid a preset writes, so Manage Team names each person by the preset the
// grid matches: Manager, Estimator, Dispatcher, Crew (lib/permissions/
// accessPresets.js describeAccess).
const grid = (preset) => ({ ...PERMISSION_PRESETS[preset].values });
export const PEOPLE = [
  { id: "m_marc", userId: "u_marc", name: "Marc Tremblay", email: "marc@erabledesign.ca", role: "owner", permissions: null, phone: "+1 450 555 0181", active: true, createdAt: iso(day(-400)) },
  { id: "m_julie", userId: "u_julie", name: "Julie Gagnon", email: "julie@erabledesign.ca", role: "supervisor", permissions: grid("manager"), phone: "+1 450 555 0182", active: true, createdAt: iso(day(-300)) },
  { id: "m_sam", userId: "u_sam", name: "Samuel Roy", email: "sam@erabledesign.ca", role: "employee", permissions: grid("estimator"), phone: "+1 450 555 0183", active: true, createdAt: iso(day(-220)) },
  { id: "m_dan", userId: "u_dan", name: "Daniel Côté", email: "dan@erabledesign.ca", role: "supervisor", permissions: grid("dispatcher"), phone: "+1 450 555 0184", active: true, createdAt: iso(day(-150)) },
  { id: "m_leo", userId: "u_leo", name: "Léo Bouchard", email: "leo@erabledesign.ca", role: "employee", permissions: grid("worker"), phone: "+1 450 555 0185", active: true, createdAt: iso(day(-90)) },
  { id: "m_ana", userId: "u_ana", name: "Ana Pereira", email: "ana@erabledesign.ca", role: "employee", permissions: grid("worker"), phone: "+1 450 555 0186", active: true, createdAt: iso(day(-60)) },
];

export const MEMBER = { id: OWNER.id, userId: OWNER.userId, role: "owner", permissions: null, companyId: "c_erable" };
// The crew scenes are Léo's phone: an employee on the Crew preset, booked on
// J-318 this week (routes-work.js), clocked in this morning.
export const CREW = PEOPLE[4];
export const CREW_MEMBER = { id: CREW.id, userId: CREW.userId, role: CREW.role, permissions: CREW.permissions, companyId: "c_erable" };
// Daniel runs the schedule: the Dispatcher preset, for the figure that
// shows what that level's sidebar holds.
export const DISPATCHER = PEOPLE[3];
export const DISPATCHER_MEMBER = { id: DISPATCHER.id, userId: DISPATCHER.userId, role: DISPATCHER.role, permissions: DISPATCHER.permissions, companyId: "c_erable" };

// null keeps the menu exactly as the sidebar declares it (lib/features/nav.js).
export const FEATURE_FLAGS = null;

export const COMPANY = {
  id: "c_erable",
  name: "Érable Design Cabinetry",
  email: "hello@erabledesign.ca",
  phone: "+1 450 555 0180",
  address: "1420 boul. Curé-Labelle",
  city: "Laval",
  province: "QC",
  // Slugs from app/data/industries.js — the catalogue has no cabinetry
  // preset; the cabinet trades live under painting (refinishing) and
  // general contracting (millwork).
  industries: ["construction-contracting", "painting"],
  postalCode: "H7V 2W3",
  country: "CA",
  servesAbroad: false,
  latitude: 45.5732,
  longitude: -73.7466,
  website: "https://erabledesign.ca",
  logoUrl: null,
  logoPublicId: null,
  brandColor: "#1f4e3d",
  brandColors: null,
  paymentTerms: "50% deposit to book, balance on installation.",
  defaultProcessNotes:
    "We measure on site, then build every box and door in our Laval shop. Doors are sprayed in the booth, never on site. Installation takes two days for a typical kitchen: day one we remove the old cabinets and set the boxes level and plumb; day two we hang doors, fit drawers, adjust hinges and install hardware. Countertops, plumbing and electrical reconnection are not included unless a line above says so.",
  taxRate: 14.975,
  paymentMethods: ["card", "etransfer", "cheque"],
  shareAnonymizedPricing: true,
  bookingSlug: "erable-design",
  slug: "erable-design",
  discoverable: true,
  taxIdName: "GST/QST",
  taxIdNumber: "123456789 RT0001",
  taxRegistrationDismissedAt: null,
  autoApplyLocalTax: true,
  worksAloneAt: null,
  vatRegistered: false,
  taxRates: [
    { id: "tx_gst", name: "GST", rate: 5, isDefault: false },
    { id: "tx_qst", name: "QST", rate: 9.975, isDefault: false },
    { id: "tx_qc", name: "GST + QST", rate: 14.975, isDefault: true },
  ],
  timezone: "America/Toronto",
  dateFormat: "YYYY-MM-DD",
  weekStartsOn: 1,
  currency: "CAD",
  // One row per weekday, 0 = Sunday — the shape lib/company/businessHours.js
  // normaliseHours reads. A mon/tue map renders as seven closed days.
  businessHours: [
    { day: 0, closed: true, open: "09:00", close: "17:00" },
    { day: 1, closed: false, open: "08:00", close: "17:00" },
    { day: 2, closed: false, open: "08:00", close: "17:00" },
    { day: 3, closed: false, open: "08:00", close: "17:00" },
    { day: 4, closed: false, open: "08:00", close: "17:00" },
    { day: 5, closed: false, open: "08:00", close: "16:00" },
    { day: 6, closed: true, open: "09:00", close: "13:00" },
  ],
  defaultVisitMinutes: 60,
  bookingModes: ["visit", "call"], // app/app/settings/booking-page/page.js MODES
  travelCheckEnabled: true,
  travelBufferMinutes: 20,
  arrivalWindowMinutes: 60,
  bookingChangeNoticeHours: 24,
  refundVisitFeeOnCancel: true,
  refundCutoffHours: 24,
  sitePublished: true,
  stripeAccountId: "acct_1Erable",
  stripeOnboarded: true,
  stripeChargesEnabled: true,
  offerFinancing: false,
  // Which trade-specific settings rows the company sees (lib/settings/tradeGate.js).
  tradeGate: { cabinetRates: true, materialCosts: true },
};

export const CLIENT = {
  id: "cl_dubois",
  name: "Sophie Dubois",
  firstName: "Sophie",
  lastName: "Dubois",
  email: "sophie.dubois@example.com",
  phone: "+1 514 555 0147",
  address: "88 rue des Érables",
  city: "Laval",
  province: "QC",
  postalCode: "H7N 4K2",
  country: "CA",
  language: "fr",
  notes: "Kitchen refit — wants shaker doors, white oak island.",
  tags: ["kitchen", "referral"],
  createdAt: iso(day(-21)),
  updatedAt: iso(day(-2)),
  _count: { quotes: 1, jobs: 1, invoices: 1 },
};

export const QUOTE = {
  id: "q_1042",
  number: "Q-1042",
  quoteNumber: "Q-1042",
  title: "Kitchen cabinets — shaker, white oak island",
  status: "accepted",
  clientId: CLIENT.id,
  client: CLIENT,
  clientName: CLIENT.name,
  subtotal: 18450,
  taxTotal: 2762.89,
  total: 21212.89,
  currency: "CAD",
  language: "fr",
  createdAt: iso(day(-18, 10)),
  updatedAt: iso(day(-6, 15)),
  sentAt: iso(day(-15, 11)),
  approvedAt: iso(day(-6, 15)),
  validUntil: iso(day(12)),
  items: [
    { id: "qi1", name: "Upper cabinets — shaker, painted", description: "12 lin. ft, soft-close hinges", quantity: 12, unit: "lin. ft", unitPrice: 425, total: 5100 },
    { id: "qi2", name: "Base cabinets — shaker, painted", description: "16 lin. ft, dovetail drawers", quantity: 16, unit: "lin. ft", unitPrice: 520, total: 8320 },
    { id: "qi3", name: "Island — white oak, rift sawn", description: "7 ft × 3 ft, waterfall end", quantity: 1, unit: "ea", unitPrice: 4200, total: 4200 },
    { id: "qi4", name: "Installation", description: "2 installers, 2 days", quantity: 2, unit: "day", unitPrice: 415, total: 830 },
  ],
};

export const JOB = {
  id: "j_318",
  number: "J-318",
  jobNumber: "J-318",
  title: "Dubois kitchen — build & install",
  status: "in_progress",
  clientId: CLIENT.id,
  client: CLIENT,
  clientName: CLIENT.name,
  quoteId: QUOTE.id,
  address: CLIENT.address,
  city: CLIENT.city,
  scheduledStart: iso(day(1, 8)),
  scheduledEnd: iso(day(2, 17)),
  startDate: iso(day(1, 8)),
  endDate: iso(day(2, 17)),
  total: QUOTE.total,
  assignedTo: [PEOPLE[4], PEOPLE[5]],
  assignees: [PEOPLE[4], PEOPLE[5]],
  createdAt: iso(day(-6, 15)),
  updatedAt: iso(day(-1, 16)),
};

export const INVOICE = {
  id: "inv_2071",
  number: "INV-2071",
  invoiceNumber: "INV-2071",
  status: "sent",
  clientId: CLIENT.id,
  client: CLIENT,
  clientName: CLIENT.name,
  jobId: JOB.id,
  quoteId: QUOTE.id,
  subtotal: 9225,
  taxTotal: 1381.44,
  total: 10606.44,
  amountPaid: 0,
  amountDue: 10606.44,
  balanceDue: 10606.44,
  currency: "CAD",
  language: "fr",
  issuedAt: iso(day(-5, 9)),
  sentAt: iso(day(-5, 9)),
  dueAt: iso(day(9)),
  dueDate: iso(day(9)),
  createdAt: iso(day(-5, 9)),
  updatedAt: iso(day(-5, 9)),
  items: [{ id: "ii1", name: "Deposit — 50% of Q-1042", quantity: 1, unitPrice: 9225, total: 9225 }],
};
