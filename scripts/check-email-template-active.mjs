// scripts/check-email-template-active.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-email-template-active.mjs
//
// ── What this is guarding ───────────────────────────────────────────────────
//
// Settings → Email Templates starred one template per type as "Active" and
// said the starred one "is the one that's actually sent". A messages writer
// read the send paths and found no reader: a follow-up rule and a campaign
// each pick a template BY ID, and the quote, receipt and instructions emails
// never open a DocumentTemplate at all (lib/email/quoteEmail.js builds the
// quote email from the document, in the client's language). Written, never
// read — the class of bug AGENTS.md's "rule that matters most" is about.
//
// The star is gone from the email screens, the two activate routes refuse
// email types, the seeder stops writing starters nothing can send, and this
// file asserts per TYPE that `sentBy` in TEMPLATE_TYPE_META is the truth:
//
//   sentBy set   → a send path renders templates of that type, by id
//   sentBy null  → no send path queries that type, and the screen offers no
//                  "New Template" for it
//   the PDF types → the only place isDefault is still read, so the routes
//                  that set it keep working there
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  TEMPLATE_TYPE_META,
  templateTypeIsSent,
  ACTIVE_FLAG_TYPES,
} from "@/app/data/emailTemplateBlocks";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/[^\n]*/g, "$1");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  — ${detail}` : ""}`);
}
function section(title) {
  console.log(`\n${title}\n`);
}

// Every file that could send an email built from a template, comments off so
// a sentence about the old behaviour cannot satisfy a regex about the new.
const SEND_PATHS = {
  cron: stripComments(read("app/api/cron/follow-ups/route.js")),
  campaign: stripComments(read("app/api/marketing/campaigns/[id]/send/route.js")),
  quoteSend: stripComments(read("app/api/quotes/[id]/send/route.js")),
  quoteEmail: stripComments(read("lib/email/quoteEmail.js")),
};
// Everything under app/api and lib that mentions documentTemplate — the set a
// new reader of an unsent type would have to land in.
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel, out);
    else if (/\.(js|mjs)$/.test(entry.name)) out.push(rel);
  }
  return out;
}
const TEMPLATE_READERS = [...walk("app/api"), ...walk("lib")]
  .map((rel) => ({ rel, src: stripComments(read(rel)) }))
  .filter(({ src }) => /documentTemplate\.find/.test(src));

section("Each type says truthfully whether anything sends it");

for (const [type, meta] of Object.entries(TEMPLATE_TYPE_META)) {
  const sent = templateTypeIsSent(type);
  ok(`${type}: sentBy is declared (${JSON.stringify(meta.sentBy)})`, "sentBy" in meta);
  if (!sent) {
    // No send path may select templates of this type — by isDefault or at all.
    const readers = TEMPLATE_READERS.filter(({ src }) => new RegExp(`type:\\s*"${type}"`).test(src));
    ok(`${type}: no route or lib queries DocumentTemplate rows of this type`, readers.length === 0, readers.map((r) => r.rel).join(", "));
  }
}

ok("follow_up_email is sent by the follow-up cron, which picks the RULE's template by id",
  /include: \{ template: true \}/.test(SEND_PATHS.cron) && /rule\.template\.sections/.test(SEND_PATHS.cron) && !/isDefault/.test(SEND_PATHS.cron));
ok("marketing/custom are sent by the campaign route, which picks the CAMPAIGN's template by id",
  /template: true/.test(SEND_PATHS.campaign) && /campaign\.template\.sections/.test(SEND_PATHS.campaign) && !/isDefault/.test(SEND_PATHS.campaign));
ok("the quote email is built from the document, never from a DocumentTemplate",
  !/documentTemplate/.test(SEND_PATHS.quoteEmail) && !/renderTemplateSections/.test(SEND_PATHS.quoteEmail));
ok("the quote SEND route reads a template only for the PDF attachment (quote_pdf), never an email type",
  /type: "quote_pdf", isDefault: true/.test(SEND_PATHS.quoteSend) && !/quote_email|receipt_email|instructions_email/.test(SEND_PATHS.quoteSend));
ok("no email send path anywhere reads isDefault",
  !Object.values(SEND_PATHS).some((src) => /isDefault/.test(src.replace(/type: "quote_pdf", isDefault: true/g, ""))));

section("isDefault is read only for the PDF types, and only those may be activated");

ok("ACTIVE_FLAG_TYPES is exactly the two PDF types", JSON.stringify([...ACTIVE_FLAG_TYPES].sort()) === JSON.stringify(["invoice_pdf", "quote_pdf"]));
ok("the quote PDF route picks the active quote_pdf", /type: "quote_pdf", isDefault: true/.test(stripComments(read("app/api/quotes/[id]/pdf/route.js"))));
ok("the invoice PDF route picks the active invoice_pdf", /type: "invoice_pdf",\s*isDefault: true/.test(stripComments(read("app/api/invoices/[id]/pdf/route.js"))));
ok("no email type is in ACTIVE_FLAG_TYPES", Object.keys(TEMPLATE_TYPE_META).every((t) => !ACTIVE_FLAG_TYPES.includes(t)));

for (const rel of ["app/api/settings/document-templates/[id]/activate/route.js", "app/api/templates/[id]/set-default/route.js"]) {
  const src = stripComments(read(rel));
  ok(`${rel.split("/").slice(2, 4).join("/")}: refuses to star a type nothing reads`,
    /if \(!ACTIVE_FLAG_TYPES\.includes\(template\.type\)\)/.test(src) && /status: 409/.test(src) && /no_active_for_type/.test(src));
}
ok("deleting an email template is not blocked by a star nothing reads",
  /existing\.isDefault && ACTIVE_FLAG_TYPES\.includes\(existing\.type\)/.test(stripComments(read("app/api/templates/[id]/route.js"))));

section("The screens no longer show a control nothing reads");

const list = stripComments(read("app/app/settings/email-templates/page.js"));
ok("the list page has no Active badge and no Set Active button", !/Set Active/.test(list) && !/app\.status\.active/.test(list) && !/isDefault/.test(list));
ok("the list page no longer calls the activate route", !/\/activate/.test(list));
ok("the subtitle says what decides — a rule or campaign picking by name — not a star", /app\.emailTemplates\.whatSends/.test(list) && !/descPart1|descPart2/.test(list));
ok("a type nothing sends gets no New Template button, and is hidden when empty",
  /if \(!sent && typeTemplates\.length === 0\) return null;/.test(list) && /\{sent && \(/.test(list) && /app\.emailTemplates\.notSent/.test(list));
const editor = stripComments(read("app/app/settings/email-templates/[id]/page.js"));
ok("the editor has no Set active button and never reads isDefault", !/handleActivate|isActive|setIsActive|isDefault/.test(editor) && !/\/activate/.test(editor));

section("The seeder writes only what can be sent");
const seeder = stripComments(read("lib/email/seedDefaultTemplates.js"));
ok("starter templates are seeded only for automated types with a sender",
  /meta\.group === "Automated" && meta\.sentBy/.test(seeder));

console.log(`\n${checks} checks, ${failures} failure(s).${failures ? "" : " No template claims to be sent by something that never reads it."}\n`);
if (failures) process.exitCode = 1;
