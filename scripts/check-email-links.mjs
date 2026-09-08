// scripts/check-email-links.mjs
//
//   npm run check:email-links
//
// A button in an email is the one control nobody can fix after it is sent.
//
// The reminder's button said "Pay online" and linked to the portal HOME — a
// list of documents with no payment on it. The owner pressed it and reported
// that nothing happened, which is exactly what a link to the wrong page feels
// like. Sending an invoice had already been fixed to deep-link
// (portalInvoiceUrl's own comment records it); the chase was left behind, and
// nothing failed, because a working link to the wrong page is indistinguishable
// from a working link.
//
// So this file EXECUTES the builders and reads the hrefs back out of the HTML
// they produce. Every one has to be absolute, on this deployment's origin, and
// pointing at a page that can do what its label promises.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildInvoiceEmail } from "../lib/email/invoiceEmail.js";
import { portalUrl, portalInvoiceUrl } from "../lib/clientPortal.js";

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${name}`, extra === undefined ? "" : String(JSON.stringify(extra)).slice(0, 220));
  }
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const code = (p) => read(p).split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");

const ORIGIN = "https://www.fieldquo.com";
process.env.NEXT_PUBLIC_APP_URL = ORIGIN;

// Every href in a rendered email, in document order.
const hrefs = (html) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);

const COMPANY = { name: "Northline Painting", brandColor: "#1d4ed8", email: "hello@northline.example" };
const CLIENT = { name: "Marie Tremblay", email: "marie@example.com", language: "en" };
const INVOICE = {
  id: "inv_123",
  invoiceNumber: "INV-2026-0007",
  total: 3200,
  amountPaid: 0,
  dueDate: new Date("2026-09-30T00:00:00Z"),
  status: "sent",
  language: "en",
};

const TOKEN = "tok_abcdefghijklmnop";
const DEEP = portalInvoiceUrl(TOKEN, INVOICE.id);
const HOME = portalUrl(TOKEN);

ok("the two portal helpers really do differ", DEEP !== HOME && DEEP.startsWith(HOME));
ok("both are absolute on this deployment", DEEP.startsWith(`${ORIGIN}/`) && HOME.startsWith(`${ORIGIN}/`), { DEEP, HOME });

// ── Every kind of invoice email, executed ──────────────────────────────────
for (const kind of ["invoice", "reminder", "paid"]) {
  for (const canTakeCard of [true, false]) {
    const label = `${kind}/${canTakeCard ? "card" : "no card"}`;
    const { html, text, subject } = buildInvoiceEmail({
      invoice: kind === "paid" ? { ...INVOICE, amountPaid: 3200, status: "paid" } : INVOICE,
      client: CLIENT,
      company: COMPANY,
      url: DEEP,
      canTakeCard,
      kind,
      language: "en",
    });
    const links = hrefs(html);
    ok(`${label}: the email has a button at all`, links.length > 0);
    ok(`${label}: every href is absolute`, links.every((h) => /^https?:\/\//.test(h) || h.startsWith("mailto:")), links);
    ok(`${label}: no href is empty, "undefined" or "null"`,
      links.every((h) => h && !/(^|\/)(undefined|null)(\/|$)/.test(h)), links);
    ok(`${label}: the document link is the one the caller passed`, links.includes(DEEP), links);
    ok(`${label}: the plain-text part carries the same URL`, text.includes(DEEP));
    ok(`${label}: the subject is not empty`, Boolean(subject && subject.trim()));
    // The URL is printed under the button for the client whose mail app eats
    // buttons. It has to be the same URL, or the fallback is a second bug.
    ok(`${label}: the printed fallback URL matches the button`,
      (html.match(new RegExp(DEEP.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length >= 2);
  }
}

// ── The promise the label makes ────────────────────────────────────────────
// "Pay online" must land on the page that takes a payment. The portal home is
// a list; it cannot honour that label.
{
  const { html } = buildInvoiceEmail({
    invoice: INVOICE, client: CLIENT, company: COMPANY,
    url: DEEP, canTakeCard: true, kind: "reminder", language: "en",
  });
  ok("a reminder that can take a card says Pay online", /Pay online/i.test(html));
  ok("...and links to the invoice, not the portal home",
    hrefs(html).includes(DEEP) && !hrefs(html).includes(HOME));

  const { html: noCard } = buildInvoiceEmail({
    invoice: INVOICE, client: CLIENT, company: COMPANY,
    url: DEEP, canTakeCard: false, kind: "reminder", language: "en",
  });
  // A company with no online payments must not be made to promise one.
  ok("with no card set up the button does not say Pay online", !/Pay online/i.test(noCard));
}

// ── Every caller passes the deep link ──────────────────────────────────────
// This is the pin that would have caught the bug: the chase route built its
// URL with portalUrl while every other sender used portalInvoiceUrl.
const SENDERS = [
  ["app/api/invoices/[id]/send/route.js", "sending an invoice"],
  ["app/api/invoices/[id]/request-payment/route.js", "chasing an invoice"],
  ["lib/paymentSchedule/run.js", "a payment-schedule stage"],
  ["lib/servicePlans/run.js", "a service-plan invoice"],
];
for (const [file, label] of SENDERS) {
  const src = code(file);
  ok(`${label} deep-links to the invoice`, /portalInvoiceUrl\(/.test(src), file);
  // portalUrl may still be imported for a "share the portal" action, but it
  // must not be what an invoice email's button is built from.
  const buildsFromHome = /url\s*=\s*portalUrl\(/.test(src);
  ok(`${label} does not build its email URL from the portal home`, !buildsFromHome, file);
}

// ── Absolute, always ───────────────────────────────────────────────────────
// A relative href in an email goes nowhere: there is no page it is relative
// to. Every builder must reach an origin helper rather than writing a path.
{
  const builders = fs
    .readdirSync(path.join(ROOT, "lib/email"))
    .filter((f) => f.endsWith(".js"));
  for (const f of builders) {
    const src = code(`lib/email/${f}`);
    const bad = [...src.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]);
    ok(`lib/email/${f} writes no relative href`, bad.length === 0, bad);
  }
}

console.log(`\ncheck-email-links: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
