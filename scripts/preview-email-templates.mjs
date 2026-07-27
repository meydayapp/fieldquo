// scripts/preview-email-templates.mjs
//
// Renders every default email template to a standalone HTML file so you can
// eyeball the new theme without clicking through the app or sending mail.
//
//   npx tsx scripts/preview-email-templates.mjs
//   open .preview-emails/index.html
//
// Use `tsx`, not bare `node`. package.json has no `"type": "module"`, so Node
// treats the imported `.js` sources as CommonJS and dies on their `import`
// statements. tsx transpiles them regardless of the package type.
//
// No database and no network — it feeds defaultSectionsFor() through the same
// renderer the send paths use, with a fake company and realistic sample data.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  defaultSectionsFor,
  defaultSubjectFor,
  STAGE_INDEX,
  TEMPLATE_TYPE_META,
} from "../app/data/emailTemplateBlocks.js";
import {
  renderTemplateSections,
  renderSubject,
} from "../lib/email/renderTemplateSections.js";

const OUT = path.join(process.cwd(), ".preview-emails");

// Stands in for a Company row. Swap brandColor to sanity-check that the
// accent, button colours and contrast-derived button text all follow.
const COMPANY = {
  name: "Northline Refinishing",
  email: "hello@northline.example",
  phone: "(416) 555-0142",
  website: "northline.example",
  address: "88 Industrial Rd",
  city: "Toronto",
  province: "ON",
  logoUrl: "", // empty → header falls back to the wordmark treatment
  brandColor: "#bd9d60",
};

const MERGE = {
  clientName: "Jane Doe",
  clientAddress: "123 Maple Street, Toronto, ON",
  clientPhone: "(416) 555-0142",
  companyName: COMPANY.name,
  companyPhone: COMPANY.phone,
  companyEmail: COMPANY.email,
  quoteNumber: "Q-1042",
  quoteTotal: "$4,250.00",
  quoteUrl: "https://example.com/quote/preview",
  invoiceNumber: "INV-1042",
  invoiceTotal: "$4,250.00",
  invoiceUrl: "https://example.com/invoice/preview",
  dueDate: "Aug 1, 2026",
  balanceDue: "$1,250.00",
  amountPaid: "$3,000.00",
  depositAmount: "$1,275.00",
  subtotal: "$3,900.00",
  discount: "$150.00",
  tax: "$500.00",
  projectStartDate: "Jul 28, 2026",
  projectEndDate: "Jul 30, 2026",
  jobTitle: "Kitchen Cabinet Refinishing",
  // progressStage is set per-template in the loop below, from STAGE_INDEX.
  lineItems: [
    {
      name: "Cabinet doors & drawer fronts — spray refinish",
      quantity: 24,
      unitPrice: 125,
      total: 3000,
    },
    { name: "Cabinet boxes — on-site refinish", quantity: 1, unitPrice: 750, total: 750 },
    { name: "Premium hardware replacement", quantity: 24, unitPrice: 6.25, total: 150 },
  ],
};

// Cheap smoke tests. These catch the failure modes that are easy to introduce
// and hard to spot by eye.
function audit(type, html) {
  const problems = [];

  if (/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/.test(html)) {
    problems.push("unsubstituted {{token}} left in the output");
  }
  if (html.includes("[object Object]")) {
    problems.push("an object was interpolated into text");
  }
  if (/(href|src)="\s*(javascript|data|vbscript):/i.test(html)) {
    problems.push("unsafe URL scheme survived sanitisation");
  }
  // An empty href means a CTA was left unconfigured. That's expected on the
  // marketing and custom starters, where the company supplies its own link.
  if (html.includes('href=""') && !["marketing_email", "custom_email"].includes(type)) {
    problems.push("a link has an empty href (unconfigured CTA?)");
  }
  if (html.includes("display:flex") || html.includes("display:grid")) {
    problems.push("flex/grid used — will collapse in Outlook");
  }
  if (!html.includes("<!DOCTYPE html>")) {
    problems.push("missing doctype");
  }
  return problems;
}

const results = [];

await mkdir(OUT, { recursive: true });

for (const [type, meta] of Object.entries(TEMPLATE_TYPE_META)) {
  const sections = defaultSectionsFor(type);
  const merge = { ...MERGE, progressStage: STAGE_INDEX[type] ?? 0 };
  const html = renderTemplateSections(sections, merge, { company: COMPANY });
  const subject = renderSubject(defaultSubjectFor(type), merge, "(no subject)");

  const file = `${type}.html`;
  await writeFile(path.join(OUT, file), html, "utf8");

  const problems = audit(type, html);
  results.push({ type, label: meta.label, subject, file, problems, blocks: sections.length });
}

// Contact sheet linking all of them.
const index = `<!DOCTYPE html><html><head><meta charset="utf-8" />
<title>Email template previews</title>
<style>body{font-family:system-ui,sans-serif;margin:40px;background:#faf8f5;color:#2d2520}
h1{font-size:20px}table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #eadfd4;border-radius:8px;overflow:hidden}
td,th{padding:10px 14px;text-align:left;border-bottom:1px solid #f0e8de;font-size:14px}
th{background:#f8f4ef;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#6b5d52}
.ok{color:#2ea043}.bad{color:#c0392b}</style></head><body>
<h1>Email template previews</h1>
<table><tr><th>Template</th><th>Subject</th><th>Blocks</th><th>Checks</th></tr>
${results
  .map(
    (r) => `<tr>
  <td><a href="${r.file}">${r.label}</a></td>
  <td>${r.subject}</td>
  <td>${r.blocks}</td>
  <td class="${r.problems.length ? "bad" : "ok"}">${
    r.problems.length ? r.problems.join("; ") : "passed"
  }</td>
</tr>`,
  )
  .join("\n")}
</table></body></html>`;

await writeFile(path.join(OUT, "index.html"), index, "utf8");

const failed = results.filter((r) => r.problems.length);
for (const r of results) {
  const status = r.problems.length ? `FAIL — ${r.problems.join("; ")}` : "ok";
  console.log(`${r.type.padEnd(20)} ${String(r.blocks).padStart(2)} blocks  ${status}`);
}
console.log(`\nWrote ${results.length} previews to ${OUT}`);
console.log(`Open ${path.join(OUT, "index.html")}`);

if (failed.length) process.exitCode = 1;
