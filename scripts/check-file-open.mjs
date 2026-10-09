// scripts/check-file-open.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-file-open.mjs
//
// Opening a stored file — lib/media/signedFile.js, lib/media/fileOpen.js,
// lib/media/fileHrefs.js — executed against hostile input.
//
// ══ Why this exists ════════════════════════════════════════════════════════
//
// The production Cloudinary account refuses to deliver a PDF from its plain
// URL (401), and a raw file stored with no extension arrives as
// octet-stream named after its random id. Every place that linked a stored
// URL — drawings on a quote, a homeowner's PDF in the inbox, a signed waiver
// in the portal, the documents beside a proposal, a prep guide in an email —
// showed a link that looked like it worked and didn't. The fix signs a
// five-minute download link on the server and streams the bytes.
//
// Signing is power: a signed link opens ANY asset in the account. So the
// part that matters most here is what is NOT signed — another cloud, another
// host, another company's folder, a path that climbs out of its folder, a
// token that is wrong, a reader the link was not minted for. Each is driven
// through the real functions with a signer and a fetch that RECORD being
// called, so "refused" means "refused before anything was signed or
// fetched", not merely "returned an error afterwards".
//
// The last section reads the screens' and routes' source for the wiring that
// can't be executed here (JSX, route handlers behind the session): every
// surface that used to link a stored URL now links the route, and every new
// route has a caller.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import * as signed from "@/lib/media/signedFile";
import * as hrFile from "@/lib/hr/documentFile";
import {
  staffFileLink,
  verifyStaffFileLink,
  withOpenUrls,
  withIndexedOpenUrls,
  messageOpenUrl,
  resolveStaffFile,
  resolveClientFile,
  resolvePlatformFile,
  openFileResponse,
  fetchTenantFile,
  STAFF_FILE_KINDS,
  STAFF_FILE_LINK_TTL_SECONDS,
} from "@/lib/media/fileOpen";
import { clientFileHref, platformFileHref, STAFF_FILE_PATH } from "@/lib/media/fileHrefs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
const ok = (label, condition, detail) => {
  if (condition) {
    pass += 1;
    if (!process.argv.includes("--quiet")) console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}${detail === undefined ? "" : `  — ${typeof detail === "string" ? detail : JSON.stringify(detail)}`}`);
  }
};
const section = (t) => console.log(`\n${t}`);

const CLOUD = "fqcloud";
const CO = "cmcompany1aaaa";
const OTHER = "cmcompany2bbbb";
const url = (tail, { rt = "raw", type = "upload", cloud = CLOUD, v = "v1712345678" } = {}) => `https://res.cloudinary.com/${cloud}/${rt}/${type}/${v}/${tail}`;

// ═══════════════════════════════════════════════════════════════════════════
section("1. Parsing a stored URL — only exactly what Cloudinary returns");
// ═══════════════════════════════════════════════════════════════════════════
{
  const p = signed.parseCloudinaryFileUrl(url(`fieldquo/companies/${CO}/plans/abc.pdf`), { cloudName: CLOUD });
  ok("our raw PDF parses, id keeps its extension", p && p.resourceType === "raw" && p.publicId === `fieldquo/companies/${CO}/plans/abc.pdf` && p.format === "");
  const img = signed.parseCloudinaryFileUrl(url(`messaging/${CO}/xyz.pdf`, { rt: "image" }), { cloudName: CLOUD });
  ok("an image-type PDF splits id and format", img && img.publicId === `messaging/${CO}/xyz` && img.format === "pdf");
  for (const [label, u] of [
    ["a foreign cloud name", url(`fieldquo/companies/${CO}/a.pdf`, { cloud: "evilcloud" })],
    ["a non-Cloudinary host", `https://evil.example.com/${CLOUD}/raw/upload/v1/fieldquo/companies/${CO}/a.pdf`],
    ["a look-alike host", `https://res.cloudinary.com.evil.io/${CLOUD}/raw/upload/v1/fieldquo/companies/${CO}/a.pdf`],
    ["plain http", url(`fieldquo/companies/${CO}/a.pdf`).replace("https:", "http:")],
    ["a query string", url(`fieldquo/companies/${CO}/a.pdf`) + "?x=1"],
    ["a fragment", url(`fieldquo/companies/${CO}/a.pdf`) + "#p"],
    ["userinfo", url(`fieldquo/companies/${CO}/a.pdf`).replace("https://", "https://me@")],
    ["a port", url(`fieldquo/companies/${CO}/a.pdf`).replace("cloudinary.com", "cloudinary.com:8443")],
    ["../ path traversal", url(`fieldquo/companies/${CO}/../${OTHER}/a.pdf`)],
    ["../ that climbs to another root", url(`fieldquo/companies/${CO}/../../../messaging/${OTHER}/a.pdf`)],
    ["%2e%2e escapes", url(`fieldquo/companies/${CO}/%2e%2e/${OTHER}/a.pdf`)],
    ["%2f escapes", url(`fieldquo/companies/${CO}%2f..%2f${OTHER}/a.pdf`)],
    ["a backslash", url(`fieldquo/companies/${CO}\\..\\${OTHER}/a.pdf`)],
    ["a transformation instead of a version", url(`fieldquo/companies/${CO}/a.pdf`, { v: "w_100,c_fill" })],
    ["a private delivery type", url(`fieldquo/companies/${CO}/a.pdf`, { type: "private" })],
    ["no file at all", `https://res.cloudinary.com/${CLOUD}/raw/upload/v1/`],
    ["not a string", 42],
    ["a javascript: URL", "javascript:alert(1)"],
  ]) {
    ok(`refuses ${label}`, signed.parseCloudinaryFileUrl(u, { cloudName: CLOUD }) === null);
  }
  ok("no cloud name configured → nothing parses", signed.parseCloudinaryFileUrl(url(`fieldquo/companies/${CO}/a.pdf`), { cloudName: "" }) === null);
  ok("lib/hr/documentFile re-exports the SAME parser and signer (no copy)", hrFile.parseCloudinaryFileUrl === signed.parseCloudinaryFileUrl && hrFile.signedOpenLink === signed.signedOpenLink && hrFile.OPEN_LINK_TTL_SECONDS === signed.OPEN_LINK_TTL_SECONDS);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The tenant fence — a URL is only signed inside the asker's folders");
// ═══════════════════════════════════════════════════════════════════════════
{
  const at = (tail, companyId = CO, opts) => signed.tenantFileLocation(url(tail, opts), { cloudName: CLOUD, companyId });
  for (const tail of [
    `fieldquo/companies/${CO}/plans/a.pdf`,
    `fieldquo/companies/${CO}/abc`,
    `fieldquo/${CO}/quotes/Q-1001-v1`,
    `fieldquo/satellite/${CO}/roof.png`,
    `messaging/${CO}/1b2c.pdf`,
    `mailbox/${CO}/x.pdf`,
    `crew/${CO}/y.pdf`,
  ]) ok(`opens its own ${tail.split("/").slice(0, 2).join("/")}… file`, at(tail).ok === true);
  ok("another company's folder is refused", at(`fieldquo/companies/${OTHER}/plans/a.pdf`).code === "other_company");
  ok("another company's filed quote PDF is refused", at(`fieldquo/${OTHER}/quotes/Q-1`).code === "other_company");
  ok("another company's inbox file is refused", at(`messaging/${OTHER}/a.pdf`).code === "other_company");
  ok("a company id that is a PREFIX of another is not a match", at(`fieldquo/companies/${CO}x/a.pdf`).code === "other_company");
  ok("FieldQuo's own sales inbox is never a tenant's", at(`sales-inbound/thread1/a.pdf`).code === "other_company");
  ok("FieldQuo's own payout receipts are never a tenant's", at(`fieldquo/platform/payouts/batch123456/a.pdf`).code === "other_company");
  ok("marketing images are never a tenant's", at(`marketing-generated/a.png`, CO, { rt: "image" }).code === "other_company");
  ok("a file at the bare root is refused", at(`a.pdf`).code === "other_company");
  ok("the reserved id 'companies' opens nothing (would be every company's folder)", at(`fieldquo/companies/${OTHER}/a.pdf`, "companies").ok === false && signed.tenantFolderPrefixes("companies").length === 0);
  ok("the reserved id 'satellite' opens nothing", signed.tenantFolderPrefixes("satellite").length === 0);
  ok("a company id with a slash opens nothing", signed.tenantFolderPrefixes(`${CO}/../${OTHER}`).length === 0 && at(`fieldquo/companies/${CO}/a.pdf`, `${CO}/x`).ok === false);
  ok("an empty or missing company id opens nothing", at(`fieldquo/companies/${CO}/a.pdf`, "").ok === false && signed.tenantFileLocation(url(`fieldquo/companies/${CO}/a.pdf`), { cloudName: CLOUD }).ok === false);
  ok("a foreign cloud is unreadable, not merely another company", signed.tenantFileLocation(url(`fieldquo/companies/${CO}/a.pdf`, { cloud: "evil" }), { cloudName: CLOUD, companyId: CO }).code === "unreadable");

  const plat = (tail, prefix) => signed.platformFileLocation(url(tail), { cloudName: CLOUD, prefix });
  ok("a payout receipt opens inside its own batch's folder", plat("fieldquo/platform/payouts/batch123456/r.pdf", "fieldquo/platform/payouts/batch123456/").ok);
  ok("…not another batch's", plat("fieldquo/platform/payouts/batch999999/r.pdf", "fieldquo/platform/payouts/batch123456/").ok === false);
  ok("…and a platform prefix can't be widened to a tenant folder", plat(`fieldquo/companies/${CO}/a.pdf`, `fieldquo/companies/${CO}/`).ok === false);
  ok("…or to the platform root", plat("fieldquo/platform/payouts/batch1/r.pdf", "fieldquo/platform/").ok === false);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. What the bytes are, and the name they go out under");
// ═══════════════════════════════════════════════════════════════════════════
{
  const b = (s) => new Uint8Array(Buffer.from(s, "latin1"));
  ok("%PDF- is a PDF", signed.sniffContentType(b("%PDF-1.7\n...")) === "application/pdf");
  ok("PNG", signed.sniffContentType(b("\x89PNG\r\n\x1a\n")) === "image/png");
  ok("JPEG", signed.sniffContentType(b("\xff\xd8\xff\xe0")) === "image/jpeg");
  ok("GIF", signed.sniffContentType(b("GIF89a")) === "image/gif");
  ok("WEBP", signed.sniffContentType(b("RIFF\x00\x00\x00\x00WEBPVP8 ")) === "image/webp");
  ok("a zip container", signed.sniffContentType(b("PK\x03\x04....")) === "application/zip");
  ok("SVG after a UTF-8 BOM and whitespace is markup", signed.sniffContentType(b("\xef\xbb\xbf  \n<svg onload=alert(1)>")) === "markup");
  ok("HTML in UTF-16 behind its BOM is markup", signed.sniffContentType(new Uint8Array(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("<html>", "utf16le")]))) === "markup");
  ok("<html> is markup", signed.sniffContentType(b("  <html><script>alert(1)</script>")) === "markup");
  ok("<?xml is markup", signed.sniffContentType(b("<?xml version='1.0'?><svg/>")) === "markup");
  ok("nothing is null", signed.sniffContentType(new Uint8Array()) === null && signed.sniffContentType(b("hello")) === null);

  const served = signed.servedContentType;
  ok("an extension-less PDF is served as a PDF (the auto-filed quote case)", served({ sniffed: "application/pdf", extension: "" }) === "application/pdf");
  ok("markup named .pdf is NOT served as itself", served({ sniffed: "markup", extension: "pdf", storedType: "application/pdf" }) === signed.OCTET_STREAM);
  ok("an .svg is never served as image/svg+xml", served({ sniffed: null, extension: "svg" }) !== "image/svg+xml" && served({ sniffed: null, extension: "", storedType: "image/svg+xml" }) !== "image/svg+xml");
  ok("a .docx (zip) keeps its name's type", served({ sniffed: "application/zip", extension: "docx" }) === "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  ok("an unknown file is octet-stream", served({ sniffed: null, extension: "exe" }) === signed.OCTET_STREAM);
  ok("a stored text/html type is not trusted", served({ sniffed: null, extension: "", storedType: "text/html" }) === signed.OCTET_STREAM);
  ok("PDF and photos open in the tab", ["application/pdf", "image/jpeg", "image/png"].every(signed.isInlineType));
  ok("SVG, octet-stream, HTML and Office files download", ["image/svg+xml", signed.OCTET_STREAM, "text/html", "application/zip"].every((t) => !signed.isInlineType(t)));

  const name = signed.downloadName;
  ok("'Quote Q-1001 — as sent' + PDF → 'Quote Q-1001 — as sent.pdf'", name("Quote Q-1001 — as sent", "application/pdf") === "Quote Q-1001 — as sent.pdf");
  ok("a name that already ends .PDF keeps it", name("plan.PDF", "application/pdf") === "plan.PDF");
  ok("a .jpeg named photo stays .jpeg", name("site.jpeg", "image/jpeg") === "site.jpeg");
  ok("quotes, slashes, CR/LF and ../ are stripped from the name", !/["\\/\r\n]/.test(name('a"b\\c/../d\r\nSet-Cookie: x', "application/pdf")) && name('a"b\\c/../d\r\nSet-Cookie: x', "application/pdf").endsWith(".pdf"));
  ok("no name → 'document.pdf', never the storage id or our name", name("", "application/pdf") === "document.pdf" && name("...", "application/pdf") === "document.pdf");
  ok("an octet-stream file gets no invented extension", name("mystery", "") === "mystery");
  const cd = signed.contentDisposition("Devis été 2026.pdf", { inline: true });
  ok("Content-Disposition carries an ASCII fallback and the UTF-8 name", cd.startsWith('inline; filename="Devis ') && cd.includes("filename*=UTF-8''Devis%20%C3%A9t%C3%A9%202026.pdf") && !/[^\x20-\x7e]/.test(cd));
  ok("attachment when asked", signed.contentDisposition("x.svg", { inline: false }).startsWith("attachment;"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Staff links — bound to the reader, the row and the clock");
// ═══════════════════════════════════════════════════════════════════════════
const SECRET = "s".repeat(32);
const T = Date.UTC(2026, 9, 4, 12, 0, 0);
const alice = { id: "m_alice", companyId: CO };
const bob = { id: "m_bob", companyId: CO };
const support = { id: null, impersonation: true, platformAdminId: "pa_1", companyId: CO };
const params = (href) => {
  const q = new URL(href, "https://x").searchParams;
  return { kind: q.get("k"), id: q.get("id"), index: q.get("i"), exp: q.get("exp"), sig: q.get("sig") };
};
{
  const href = staffFileLink(alice, { kind: "quote-document", id: "qd1" }, { now: T, secret: SECRET });
  ok("a link is minted on the staff path", typeof href === "string" && href.startsWith(`${STAFF_FILE_PATH}?k=quote-document&id=qd1&exp=`));
  const v = verifyStaffFileLink(alice, params(href), { now: T + 1000, secret: SECRET });
  ok("…and opens for the reader it was minted for", v.ok && v.kind === "quote-document" && v.id === "qd1" && v.index === null);
  ok("…not for anybody else in the same company", verifyStaffFileLink(bob, params(href), { now: T, secret: SECRET }).code === "bad_link");
  ok("…not for a read-only support session", verifyStaffFileLink(support, params(href), { now: T, secret: SECRET }).code === "bad_link");
  ok("…not once the id is swapped for another row", verifyStaffFileLink(alice, { ...params(href), id: "qd2" }, { now: T, secret: SECRET }).code === "bad_link");
  ok("…not once the kind is swapped", verifyStaffFileLink(alice, { ...params(href), kind: "job-document" }, { now: T, secret: SECRET }).code === "bad_link");
  ok("…not with an index smuggled onto a row kind", verifyStaffFileLink(alice, { ...params(href), index: "0" }, { now: T, secret: SECRET }).code === "bad_link");
  ok("…not under another secret", verifyStaffFileLink(alice, params(href), { now: T, secret: "x".repeat(32) }).code === "bad_link");
  ok(`…and says "expired" after ${STAFF_FILE_LINK_TTL_SECONDS / 3600} hours`, verifyStaffFileLink(alice, params(href), { now: T + (STAFF_FILE_LINK_TTL_SECONDS + 5) * 1000, secret: SECRET }).code === "expired");
  ok("an expired link for SOMEBODY ELSE is 'bad', never 'expired'", verifyStaffFileLink(bob, params(href), { now: T + (STAFF_FILE_LINK_TTL_SECONDS + 5) * 1000, secret: SECRET }).code === "bad_link");
  ok("a stretched expiry breaks the signature", verifyStaffFileLink(alice, { ...params(href), exp: String(Number(params(href).exp) + 86400) }, { now: T, secret: SECRET }).code === "bad_link");
  ok("a malformed signature is bad", verifyStaffFileLink(alice, { ...params(href), sig: "zz" }, { now: T, secret: SECRET }).code === "bad_link");
  ok("no secret → no link, and 'unavailable' rather than a guess", staffFileLink(alice, { kind: "quote-document", id: "qd1" }, { secret: "short" }) === null && verifyStaffFileLink(alice, params(href), { secret: "" }).code === "unavailable");
  ok("an unknown kind mints nothing", staffFileLink(alice, { kind: "worker-document", id: "x" }, { secret: SECRET }) === null);
  ok("an id with a path in it mints nothing", staffFileLink(alice, { kind: "job-document", id: "../x" }, { secret: SECRET }) === null);
  ok("no reader mints nothing", staffFileLink({}, { kind: "job-document", id: "x" }, { secret: SECRET }) === null);
  const msg = staffFileLink(alice, { kind: "message-attachment", id: "msg1", index: 2 }, { now: T, secret: SECRET });
  ok("an attachment link names its index", /[?&]i=2&/.test(msg) && verifyStaffFileLink(alice, params(msg), { now: T, secret: SECRET }).index === 2);
  ok("…and another index of the same message is refused", verifyStaffFileLink(alice, { ...params(msg), index: "3" }, { now: T, secret: SECRET }).code === "bad_link");
  ok("an indexed kind with no index mints nothing", staffFileLink(alice, { kind: "message-attachment", id: "msg1" }, { secret: SECRET }) === null);
  ok("…and a link with its index stripped is refused, not read as file 0", verifyStaffFileLink(alice, { ...params(staffFileLink(alice, { kind: "message-attachment", id: "msg1", index: 0 }, { now: T, secret: SECRET })), index: null }, { now: T, secret: SECRET }).code === "bad_link");
  const sup = staffFileLink(support, { kind: "job-document", id: "jd1" }, { now: T, secret: SECRET });
  ok("a support session (no member row) gets its own reader-bound link", sup && verifyStaffFileLink(support, params(sup), { now: T, secret: SECRET }).ok && verifyStaffFileLink(alice, params(sup), { now: T, secret: SECRET }).code === "bad_link");
  const rows = withOpenUrls(alice, "job-document", [{ id: "a" }, { id: "b" }], { now: T, secret: SECRET });
  ok("withOpenUrls gives every row its own link", rows.every((r) => verifyStaffFileLink(alice, params(r.openUrl), { now: T, secret: SECRET }).id === r.id));
  const files = withIndexedOpenUrls(alice, "receipt-file", "rc1", [{ url: "u0" }, { url: "u1" }], { now: T, secret: SECRET });
  ok("withIndexedOpenUrls names each page by position", files.map((f) => verifyStaffFileLink(alice, params(f.openUrl), { now: T, secret: SECRET }).index).join() === "0,1");
  ok("messageOpenUrl is a per-index link maker", verifyStaffFileLink(alice, params(messageOpenUrl(alice, "msg9", { now: T, secret: SECRET })(4)), { now: T, secret: SECRET }).index === 4);
  ok("every staff kind is one this check knows", STAFF_FILE_KINDS.join() === "quote-document,job-document,service-document,company-document,subcontractor-document,asset-document,price-reply-file,receipt-file,message-attachment");
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Rows are read inside ONE company");
// ═══════════════════════════════════════════════════════════════════════════
// A fake Prisma that answers only rows matching every `where` field — so a
// query that forgot companyId would find the other company's row and fail.
function fakeDb(tables) {
  const calls = [];
  const match = (row, where = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (k === "thread") return row.thread && match(row.thread, v);
      if (k === "document") return row.document && match(row.document, v);
      if (v && typeof v === "object" && "not" in v) return row[k] !== v.not;
      return row[k] === v;
    });
  const project = (row, select) => {
    if (!row || !select) return row;
    const out = {};
    for (const [k, v] of Object.entries(select)) out[k] = v && typeof v === "object" && v.select ? project(row[k], v.select) : row[k];
    return out;
  };
  const model = (name) => ({
    findFirst: async ({ where, select }) => (calls.push(name), project((tables[name] || []).find((r) => match(r, where)) || null, select)),
    findUnique: async ({ where, select }) => (calls.push(name), project((tables[name] || []).find((r) => match(r, where)) || null, select)),
  });
  return new Proxy({ calls }, { get: (t, p) => (p === "calls" ? calls : model(p)) });
}
const own = url(`fieldquo/companies/${CO}/plans/plan.pdf`);
const theirs = url(`fieldquo/companies/${OTHER}/plans/plan.pdf`);
const db = fakeDb({
  quoteDocument: [{ id: "qd1", companyId: CO, url: own, name: "Plan A", mimeType: "application/pdf" }, { id: "qd2", companyId: OTHER, url: theirs, name: "Their plan" }],
  jobDocument: [
    { id: "jd1", companyId: CO, url: url(`fieldquo/${CO}/quotes/Q-1001-v1`), name: "Quote Q-1001 — as sent", mimeType: "application/pdf" },
    { id: "jw1", companyId: CO, url: url(`fieldquo/companies/${CO}/jobs/j1/waiver-1.pdf`), name: "Release — signed" },
    { id: "jw2", companyId: CO, url: url(`fieldquo/companies/${CO}/jobs/j2/waiver-2.pdf`), name: "Other household's release" },
  ],
  serviceDocument: [{ id: "sd1", companyId: CO, url: url(`fieldquo/companies/${CO}/documents/care.pdf`), title: "Care card" }, { id: "sd2", companyId: OTHER, url: theirs, title: "Theirs" }],
  companyDocument: [
    { id: "cd1", companyId: CO, type: "insurance", title: "COI", fileUrl: url(`fieldquo/companies/${CO}/documents/coi.pdf`), showOnQuotes: true, archivedAt: null, expiresAt: null },
    { id: "cd2", companyId: CO, type: "other", title: "Hidden", fileUrl: url(`fieldquo/companies/${CO}/documents/h.pdf`), showOnQuotes: false, archivedAt: null, expiresAt: null },
    { id: "cd3", companyId: CO, type: "licence", title: "Lapsed", fileUrl: url(`fieldquo/companies/${CO}/documents/l.pdf`), showOnQuotes: true, archivedAt: null, expiresAt: new Date("2020-01-01T00:00:00Z") },
    { id: "cd4", companyId: CO, type: "warranty", title: "Archived", fileUrl: url(`fieldquo/companies/${CO}/documents/w.pdf`), showOnQuotes: true, archivedAt: new Date(T), expiresAt: null },
    { id: "cd5", companyId: CO, type: "waiver", title: "A waiver", fileUrl: url(`fieldquo/companies/${CO}/documents/x.pdf`), showOnQuotes: true, archivedAt: null, expiresAt: null },
    { id: "cd6", companyId: CO, type: "warranty", title: "Warranty", fileUrl: url(`fieldquo/companies/${CO}/documents/wa.pdf`), showOnQuotes: true, archivedAt: null, expiresAt: null },
    { id: "cdX", companyId: OTHER, type: "insurance", title: "Their COI", fileUrl: theirs, showOnQuotes: true, archivedAt: null, expiresAt: null },
  ],
  subcontractorDocument: [{ id: "sub1", companyId: OTHER, url: theirs, name: "Their sub's WCB" }],
  assetDocument: [{ id: "as1", companyId: CO, url: url(`fieldquo/companies/${CO}/documents/reg.pdf`), name: "Registration" }],
  receipt: [{ id: "rc1", companyId: CO, files: [{ url: url(`fieldquo/companies/${CO}/receipts/r.pdf`), kind: "document", filename: "home-depot.pdf" }] }],
  message: [
    { id: "msg1", thread: { companyId: CO }, attachments: [{ type: "image", url: url(`messaging/${CO}/a.jpg`, { rt: "image" }) }, { type: "document", url: url(`messaging/${CO}/b.pdf`), filename: "kitchen-plan.pdf", mimeType: "application/pdf" }, { type: "document", sourceUrl: "https://lookaside.fbsbx.com/x" }] },
    { id: "msg2", thread: { companyId: OTHER }, attachments: [{ type: "document", url: url(`messaging/${OTHER}/b.pdf`) }] },
  ],
  client: [{ id: "cl1", companyId: CO, portalToken: "P".repeat(43) }, { id: "cl2", companyId: CO, portalToken: "Q".repeat(43) }, { id: "clX", companyId: OTHER, portalToken: "X".repeat(43) }],
  documentSignature: [
    { clientId: "cl1", companyId: CO, status: "signed", jobDocumentId: "jw1", document: { archivedAt: null } },
    { clientId: "cl2", companyId: CO, status: "signed", jobDocumentId: "jw2", document: { archivedAt: null } },
    { clientId: "cl1", companyId: CO, status: "pending", jobDocumentId: "jw2", document: { archivedAt: null } },
  ],
  quote: [
    { id: "q1", companyId: CO, shareToken: "S".repeat(43), presentation: null },
    { id: "q2", companyId: CO, shareToken: "R".repeat(43), presentation: { documentIds: ["cd6"] } },
  ],
  migrationDocument: [{ id: "md1", url: url(`fieldquo/companies/${OTHER}/migrations/m1/abc`), filename: "old-quotes.pdf", migrationRequest: { companyId: OTHER } }],
  salesPayoutBatch: [{ id: "batch123456", proofUrl: url("fieldquo/platform/payouts/batch123456/r.pdf"), proofFilename: "wise.pdf" }],
  subPriceRequestRecipient: [
    { id: "pr1", companyId: CO, repliedAt: new Date(T), replyFile: { url: url(`fieldquo/companies/${CO}/price-replies/volt.pdf`), filename: "volt-quote.pdf" } },
    { id: "pr2", companyId: OTHER, repliedAt: new Date(T), replyFile: { url: theirs, filename: "theirs.pdf" } },
    { id: "pr3", companyId: CO, repliedAt: null, replyFile: { url: url(`fieldquo/companies/${CO}/price-replies/x.pdf`) } },
    { id: "pr4", companyId: CO, repliedAt: new Date(T), replyFile: "junk" },
  ],
});
{
  ok("a quote document of the reader's company resolves", (await resolveStaffFile(db, { companyId: CO, kind: "quote-document", id: "qd1" }))?.name === "Plan A");
  ok("another company's quote document does not, whatever id is named", (await resolveStaffFile(db, { companyId: CO, kind: "quote-document", id: "qd2" })) === null);
  ok("another company's service document does not", (await resolveStaffFile(db, { companyId: CO, kind: "service-document", id: "sd2" })) === null);
  ok("another company's subcontractor document does not", (await resolveStaffFile(db, { companyId: CO, kind: "subcontractor-document", id: "sub1" })) === null);
  ok("a company document resolves with its title as the name", (await resolveStaffFile(db, { companyId: CO, kind: "company-document", id: "cd1" }))?.name === "COI");
  ok("a vehicle document resolves", (await resolveStaffFile(db, { companyId: CO, kind: "asset-document", id: "as1" }))?.name === "Registration");
  ok("a receipt's PDF page resolves by position, under its own filename", (await resolveStaffFile(db, { companyId: CO, kind: "receipt-file", id: "rc1", index: 0 }))?.name === "home-depot.pdf");
  ok("…a page that isn't there does not", (await resolveStaffFile(db, { companyId: CO, kind: "receipt-file", id: "rc1", index: 5 })) === null);
  ok("an inbox PDF resolves through its thread's company, with the customer's filename", (await resolveStaffFile(db, { companyId: CO, kind: "message-attachment", id: "msg1", index: 1 }))?.name === "kitchen-plan.pdf");
  ok("…another company's thread does not", (await resolveStaffFile(db, { companyId: CO, kind: "message-attachment", id: "msg2", index: 0 })) === null);
  ok("…an attachment still pending (a Meta CDN link) is never opened", (await resolveStaffFile(db, { companyId: CO, kind: "message-attachment", id: "msg1", index: 2 })) === null);
  ok("…nor one past the end", (await resolveStaffFile(db, { companyId: CO, kind: "message-attachment", id: "msg1", index: 9 })) === null);
  ok("a sub's price-reply file resolves on the GC's own recipient row, under the sub's filename", (await resolveStaffFile(db, { companyId: CO, kind: "price-reply-file", id: "pr1" }))?.name === "volt-quote.pdf");
  ok("…another company's recipient row does not", (await resolveStaffFile(db, { companyId: CO, kind: "price-reply-file", id: "pr2" })) === null);
  ok("…nor a file on a row that never replied, nor a junk replyFile", (await resolveStaffFile(db, { companyId: CO, kind: "price-reply-file", id: "pr3" })) === null && (await resolveStaffFile(db, { companyId: CO, kind: "price-reply-file", id: "pr4" })) === null);
  ok("an unknown kind reads nothing",(await resolveStaffFile(db, { companyId: CO, kind: "worker-document", id: "x" })) === null);
  ok("no company reads nothing", (await resolveStaffFile(db, { companyId: "", kind: "quote-document", id: "qd1" })) === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The client door — the page's own token, and that document's files only");
// ═══════════════════════════════════════════════════════════════════════════
{
  const P = "P".repeat(43);
  const Q = "Q".repeat(43);
  const S = "S".repeat(43);
  const R = "R".repeat(43);
  const X = "X".repeat(43);
  const got = (a) => resolveClientFile(db, a);
  ok("the portal opens a waiver THIS client signed", (await got({ scope: "portal", token: P, kind: "waiver", id: "jw1" }))?.name === "Release — signed");
  ok("…not one another household signed, by id", (await got({ scope: "portal", token: P, kind: "waiver", id: "jw2" })) === null);
  ok("…which its own signer can open", (await got({ scope: "portal", token: Q, kind: "waiver", id: "jw2" }))?.companyId === CO);
  ok("…not an unsigned one", (await got({ scope: "portal", token: P, kind: "waiver", id: "jw2" })) === null);
  ok("…not an ordinary job document named as a waiver", (await got({ scope: "portal", token: P, kind: "waiver", id: "jd1" })) === null);
  ok("a prep-guide document of the client's own contractor opens", (await got({ scope: "portal", token: P, kind: "guide", id: "sd1" }))?.name === "Care card");
  ok("…another company's does not", (await got({ scope: "portal", token: P, kind: "guide", id: "sd2" })) === null);
  ok("…nor does it open with that other company's client's token", (await got({ scope: "portal", token: X, kind: "guide", id: "sd1" })) === null);
  ok("a wrong token opens nothing", (await got({ scope: "portal", token: "Z".repeat(43), kind: "guide", id: "sd1" })) === null);
  const before = db.calls.length;
  ok("a malformed or missing token opens nothing — before any query", (await got({ scope: "portal", token: "short", kind: "guide", id: "sd1" })) === null && (await got({ scope: "portal", token: undefined, kind: "guide", id: "sd1" })) === null && (await got({ scope: "portal", token: "../../x".padEnd(20, "a"), kind: "guide", id: "sd1" })) === null && db.calls.length === before);
  ok("a kind the scope doesn't offer opens nothing", (await got({ scope: "portal", token: P, kind: "document", id: "cd1" })) === null && (await got({ scope: "quote", token: S, kind: "guide", id: "sd1" })) === null);
  ok("a quote's proposal document opens with its share token", (await got({ scope: "quote", token: S, kind: "document", id: "cd1" }))?.name === "COI");
  ok("…a hidden one does not", (await got({ scope: "quote", token: S, kind: "document", id: "cd2" })) === null);
  ok("…an expired one does not", (await got({ scope: "quote", token: S, kind: "document", id: "cd3" })) === null);
  ok("…an archived one does not", (await got({ scope: "quote", token: S, kind: "document", id: "cd4" })) === null);
  ok("…a waiver (text, not a file) does not", (await got({ scope: "quote", token: S, kind: "document", id: "cd5" })) === null);
  ok("…another company's does not", (await got({ scope: "quote", token: S, kind: "document", id: "cdX" })) === null);
  ok("a quote that picked its documents opens only those", (await got({ scope: "quote", token: R, kind: "document", id: "cd6" }))?.name === "Warranty" && (await got({ scope: "quote", token: R, kind: "document", id: "cd1" })) === null);
  ok("clientFileHref builds the two token paths", clientFileHref({ scope: "portal", token: P, kind: "waiver", id: "jw1" }) === `/api/portal/${P}/files/waiver/jw1` && clientFileHref({ scope: "quote", token: S, kind: "document", id: "cd1" }) === `/api/public/quotes/${S}/files/document/cd1`);
  ok("…and nothing for a malformed token, id or kind", [
    { scope: "portal", token: "short", kind: "waiver", id: "x" },
    { scope: "portal", token: P, kind: "waiver", id: "../x" },
    { scope: "portal", token: P, kind: "hr", id: "x" },
    { scope: "admin", token: P, kind: "waiver", id: "x" },
  ].every((a) => clientFileHref(a) === null));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The platform door — each kind keeps its own fence");
// ═══════════════════════════════════════════════════════════════════════════
{
  const md = await resolvePlatformFile(db, { kind: "migration-document", id: "md1" });
  ok("a migration upload resolves inside ITS company", md?.companyId === OTHER && !md.prefix);
  const pb = await resolvePlatformFile(db, { kind: "payout-proof", id: "batch123456" });
  ok("a payout receipt resolves inside its batch's folder only", pb?.prefix === "fieldquo/platform/payouts/batch123456/" && !pb.companyId);
  ok("an unknown platform kind reads nothing", (await resolvePlatformFile(db, { kind: "worker-document", id: "x" })) === null);
  ok("platformFileHref builds the console path, and nothing for junk", platformFileHref("payout-proof", "b1") === "/api/platform/files/open?k=payout-proof&id=b1" && platformFileHref("payout-proof", "a&k=x") === null && platformFileHref("hr", "x") === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. Streaming — signed only inside the fence, fetched only from Cloudinary");
// ═══════════════════════════════════════════════════════════════════════════
const PDF = Buffer.from("%PDF-1.7\n" + "x".repeat(500));
function recorder({ host = `https://api.cloudinary.com/v1_1/${CLOUD}/raw/download?x=1`, status = 200, body = PDF, finalUrl = null, length = true } = {}) {
  const signs = [];
  const fetches = [];
  return {
    signs,
    fetches,
    sign: (publicId, format, options) => (signs.push({ publicId, format, options }), host),
    fetchImpl: async (u) => {
      fetches.push(u);
      return new Response(status === 200 ? new Uint8Array(body) : null, {
        status,
        headers: length ? { "content-length": String(body.length) } : {},
      });
    },
    finalUrl,
  };
}
async function open(file, rec, extra = {}) {
  const fetchImpl = rec.finalUrl
    ? async (u) => {
        const r = await rec.fetchImpl(u);
        Object.defineProperty(r, "url", { value: rec.finalUrl });
        return r;
      }
    : rec.fetchImpl;
  return openFileResponse({ file, companyId: CO, cloudName: CLOUD, sign: rec.sign, fetchImpl, ...extra });
}
{
  const rec = recorder();
  const res = await open({ url: url(`fieldquo/${CO}/quotes/Q-1001-v1`), name: "Quote Q-1001 — as sent" }, rec);
  const bytes = Buffer.from(await res.arrayBuffer());
  ok("an extension-less filed PDF streams 200", res.status === 200 && bytes.equals(PDF));
  ok("…as application/pdf, from its bytes", res.headers.get("content-type") === "application/pdf");
  ok("…inline, under the row's name with .pdf", /^inline; filename="Quote Q-1001 - as sent\.pdf"/.test(res.headers.get("content-disposition")));
  ok("…never cached, never sniffed, no referrer", res.headers.get("cache-control") === "private, no-store" && res.headers.get("x-content-type-options") === "nosniff" && res.headers.get("referrer-policy") === "no-referrer");
  ok("…with no FieldQuo in any header", ![...res.headers.values()].some((v) => /fieldquo/i.test(v)));
  ok("…signed for exactly the stored file, five minutes, inline", rec.signs.length === 1 && rec.signs[0].publicId === `fieldquo/${CO}/quotes/Q-1001-v1` && rec.signs[0].options.resource_type === "raw" && rec.signs[0].options.type === "upload" && rec.signs[0].options.attachment === false);

  for (const [label, file] of [
    ["a foreign cloud", { url: url(`fieldquo/companies/${CO}/a.pdf`, { cloud: "evil" }) }],
    ["another company's folder", { url: theirs }],
    ["a path that climbs out", { url: url(`fieldquo/companies/${CO}/../../companies/${OTHER}/a.pdf`) }],
    ["a non-Cloudinary host", { url: "https://evil.example.com/a.pdf" }],
    ["no URL at all", { url: null }],
  ]) {
    const r = recorder();
    const out = await open(file, r);
    ok(`${label}: 404 — and nothing was signed or fetched`, out.status === 404 && r.signs.length === 0 && r.fetches.length === 0);
  }
  {
    const r = recorder({ host: "https://evil.example.com/steal" });
    const out = await open({ url: own, name: "x" }, r);
    ok("a signer that answers another host is never fetched", out.status === 404 && r.fetches.length === 0);
  }
  {
    const r = recorder({ finalUrl: "https://evil.example.com/redirected" });
    const out = await open({ url: own, name: "x" }, r);
    ok("a redirect off Cloudinary is not passed on", out.status === 502);
  }
  {
    const r = recorder({ status: 401 });
    const out = await open({ url: own, name: "x" }, r);
    ok("Cloudinary refusing is a 502 with a sentence, not a broken file", out.status === 502 && typeof (await out.json()).error === "string");
  }
  {
    const r = recorder();
    const out = await openFileResponse({ file: { url: own, name: "x" }, companyId: CO, cloudName: CLOUD, sign: null, fetchImpl: r.fetchImpl });
    ok("no signer configured → 503, nothing fetched", out.status === 503 && r.fetches.length === 0);
  }
  {
    const r = recorder({ body: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'/>") });
    const out = await open({ url: url(`fieldquo/companies/${CO}/branding/logo.pdf`), name: "logo.pdf" }, r);
    ok("markup dressed as a PDF downloads as octet-stream, sandboxed", out.headers.get("content-type") === signed.OCTET_STREAM && out.headers.get("content-disposition").startsWith("attachment;") && /sandbox/.test(out.headers.get("content-security-policy") || ""));
  }
  {
    const r = recorder({ body: Buffer.from("\x89PNG\r\n\x1a\n" + "x".repeat(40), "latin1") });
    const out = await open({ url: url(`messaging/${CO}/photo`, { rt: "image" }), name: "" }, r);
    ok("a photo opens inline under a sane default name", out.headers.get("content-type") === "image/png" && /filename="document\.png"/.test(out.headers.get("content-disposition")));
  }
  {
    const r = recorder({ body: Buffer.from("%P") });
    const out = await open({ url: own, name: "tiny" }, r);
    ok("a file shorter than the sniff window still streams whole", out.status === 200 && Buffer.from(await out.arrayBuffer()).toString() === "%P");
  }
  {
    const r = recorder();
    const out = await openFileResponse({ file: { url: url("fieldquo/platform/payouts/batch123456/r.pdf"), name: "wise.pdf" }, prefix: "fieldquo/platform/payouts/batch123456/", cloudName: CLOUD, sign: r.sign, fetchImpl: r.fetchImpl });
    ok("a payout receipt streams inside its batch's folder", out.status === 200);
    const r2 = recorder();
    const out2 = await openFileResponse({ file: { url: url("fieldquo/platform/payouts/batch999999/r.pdf") }, prefix: "fieldquo/platform/payouts/batch123456/", cloudName: CLOUD, sign: r2.sign, fetchImpl: r2.fetchImpl });
    ok("…another batch's is 404, unsigned", out2.status === 404 && r2.signs.length === 0);
  }

  const r = recorder();
  const t = await fetchTenantFile(own, { companyId: CO, cloudName: CLOUD, sign: r.sign, fetchImpl: r.fetchImpl });
  ok("fetchTenantFile reads our own file through the signed link", t.ok && t.buffer.equals(PDF) && r.fetches[0].startsWith(`https://api.cloudinary.com/v1_1/${CLOUD}/`));
  const r2 = recorder();
  ok("…refuses another company's file before signing", (await fetchTenantFile(theirs, { companyId: CO, cloudName: CLOUD, sign: r2.sign, fetchImpl: r2.fetchImpl })).reason === "not_ours" && r2.signs.length === 0);
  ok("…refuses without a signer", (await fetchTenantFile(own, { companyId: CO, cloudName: CLOUD, fetchImpl: r2.fetchImpl })).reason === "unsigned");
  ok("…and refuses an oversize file", (await fetchTenantFile(own, { companyId: CO, cloudName: CLOUD, sign: recorder().sign, fetchImpl: recorder().fetchImpl, maxBytes: 10 })).reason === "too_large");
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. Wiring — every surface links the route, every route has a caller");
// ═══════════════════════════════════════════════════════════════════════════
{
  const code = (p) =>
    read(p)
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l))
      .join("\n");
  const surfaces = [
    ["app/components/planRead/QuoteFilesCard.js", /href=\{(?:doc|h)\.url\}/, /OpenFileLink href=\{doc\.openUrl\}/],
    ["app/components/jobs/JobDocuments.js", /href=\{(?:doc|old)\.url\}/, /href=\{doc\.openUrl\}/],
    ["app/components/jobs/LinkedJobDocuments.js", /href=\{doc\.url\}/, /href=\{doc\.openUrl\}/],
    // The document row: the old anchor opened attachment.url directly. (The
    // video player's own "open" link keeps the clip's URL — Cloudinary
    // delivers video, and streaming 100 MB through a function buys nothing.)
    ["app/app/messages/ConversationBits.js", /href=\{attachment\.url\}\s+target="_blank"\s+rel="noreferrer"\s+className="flex min-h-\[44px\]/, /href=\{attachment\.openUrl\}[\s\S]*if \(!attachment\.openUrl\)|if \(!attachment\.openUrl\)[\s\S]*href=\{attachment\.openUrl\}/],
    ["app/app/settings/services/ServiceDocuments.js", /href=\{d\.url\}/, /href=\{d\.openUrl\}/],
    ["app/components/settings/CompanyDocumentsEditor.js", /href=\{doc\.fileUrl\}/, /href=\{doc\.openUrl\}/],
    ["app/components/subcontractors/SubcontractorDocuments.js", /href=\{doc\.url\}/, /href=\{doc\.openUrl\}/],
    ["app/components/fleet/VehicleDocuments.js", /href=\{doc\.url\}/, /href=\{doc\.openUrl\}/],
    ["app/components/receipts/ReceiptReview.js", /href=\{f\.url\}/, /href=\{f\.openUrl\}/],
    ["app/components/mailbox/FiledEmails.js", /href=\{a\.url\}/, /href=\{a\.openUrl\}/],
    ["app/components/jobs/PrepGuideCard.js", /href=\{data\.document\.url\}/, /href=\{data\.document\.openUrl\}/],
    ["app/components/platform/payouts/BatchCard.js", /href=\{batch\.proofUrl\}/, /platformFileHref\("payout-proof", batch\.id\)/],
    ["app/platform/migrations/[id]/MigrationDetail.js", /href=\{d\.url\}/, /platformFileHref\("migration-document", d\.id\)/],
    // A sub's price reply (2026-10-07) shipped linking replyFile.url — the
    // plain raw/upload PDF URL this account answers 401.
    ["app/components/subRequests/PriceRequestsPanel.js", /href=\{r\.reply\.file\.url\}/, /href=\{r\.reply\.file\.openUrl\}/],
  ];
  for (const [file, stale, fresh] of surfaces) {
    const src = code(file);
    ok(`${file}: links the route, not the stored URL`, !stale.test(src) && fresh.test(src));
  }
  const minters = [
    ["app/api/quotes/[id]/documents/route.js", /withOpenUrls\(member, "quote-document"/],
    ["app/api/plan-reads/[id]/route.js", /withOpenUrls\(member, "quote-document"/],
    ["app/api/jobs/[id]/documents/route.js", /withOpenUrls\(member, "job-document"/],
    ["app/api/jobs/[id]/prep-guide/route.js", /staffFileLink\(member, \{ kind: "job-document"/],
    ["app/api/settings/service-documents/route.js", /staffFileLink\(member, \{ kind: "service-document"/],
    ["lib/company/documentLibrary.js", /staffFileLink\(member, \{ kind: "company-document"/],
    ["app/api/settings/company-documents/route.js", /listDocuments\(member\.companyId, \{ member \}\)/],
    ["app/api/subcontractors/[id]/documents/route.js", /withOpenUrls\(member, "subcontractor-document"/],
    ["app/api/fleet/[id]/documents/route.js", /withOpenUrls\(member, "asset-document"/],
    ["lib/receipts/view.js", /withIndexedOpenUrls\(member, "receipt-file"/],
    ["app/api/receipts/[id]/route.js", /receiptDetail\(\{[^}]*member \}\)/],
    ["app/api/messaging/threads/[id]/route.js", /publicAttachments\(m\.attachments, \{ openUrl: messageOpenUrl\(member, m\.id\) \}\)/],
    ["app/api/messaging/threads/[id]/reply/route.js", /messageOpenUrl\(member, message\.id\)/],
    ["app/api/messaging/threads/[id]/attachments/route.js", /messageOpenUrl\(member, message\.id\)/],
    ["app/api/mailbox/filed/route.js", /messageOpenUrl\(member, m\.id\)/],
    ["app/api/portal/[token]/route.js", /clientFileHref\(\{ scope: "portal", token: _params\.token, kind: "waiver"/],
    ["app/api/public/quotes/[token]/route.js", /fileHref: \(d\) => clientFileHref\(\{ scope: "quote", token, kind: "document"/],
    ["lib/estimate/report/presentation.js", /clientFileHref\(\{ scope: "quote", token, kind: "document"/],
    ["lib/prepGuide/send.js", /clientFileHref\(\{ scope: "portal", token, kind: "guide"/],
    ["app/api/price-requests/route.js", /staffFileLink\(member, \{ kind: "price-reply-file", id: x\.id \}\)/],
  ];
  ok("the price-request list never sends a reply's stored URL", !/file: x\.reply\.file\b|\.\.\.x\.reply\.file/.test(code("app/api/price-requests/route.js")));
  for (const [file, re] of minters) ok(`${file}: mints the open link`, re.test(code(file)));
  const proposal = code("lib/proposal/load.js");
  ok("the proposal no longer hands the stored fileUrl to a client", /url: \(typeof fileHref === "function" && fileHref\(d\)\) \|\| null/.test(proposal));
  const send = code("lib/prepGuide/send.js");
  ok("the prep-guide email links the token route and attaches through the signed read", /sourceUrl: doc\.url, url: linkFor\(doc\)/.test(send) && /d\.fetchDocument\(doc\.sourceUrl, \{ companyId \}\)/.test(send) && /fetchTenantFile\(url, \{ companyId, sign/.test(send));

  // Reachability: each new route's path appears in a caller outside app/api.
  const hrefs = code("lib/media/fileHrefs.js");
  ok("GET /api/files/open — minted by fileOpen.js from STAFF_FILE_PATH", /STAFF_FILE_PATH = "\/api\/files\/open"/.test(hrefs) && /\$\{STAFF_FILE_PATH\}\?/.test(code("lib/media/fileOpen.js")));
  ok("GET /api/portal/[token]/files/… — built by clientFileHref", /`\/api\/portal\/\$\{token\}\/files\/\$\{kind\}\/\$\{id\}`/.test(hrefs));
  ok("GET /api/public/quotes/[token]/files/… — built by clientFileHref", /`\/api\/public\/quotes\/\$\{token\}\/files\/\$\{kind\}\/\$\{id\}`/.test(hrefs));
  ok("GET /api/platform/files/open — built by platformFileHref", /`\/api\/platform\/files\/open\?k=\$\{kind\}&id=\$\{id\}`/.test(hrefs));
  for (const route of ["app/api/files/open/route.js", "app/api/portal/[token]/files/[kind]/[id]/route.js", "app/api/public/quotes/[token]/files/[kind]/[id]/route.js", "app/api/platform/files/open/route.js"]) {
    const src = code(route);
    ok(`${route}: awaits params/searchParams correctly and streams through openFileResponse`, /openFileResponse\(\{/.test(src) && (!/\{ params \}/.test(src) || /await params/.test(src)));
  }
  ok("the staff route is session-gated before anything else", /const \{ member, response \} = await memberOrRefusal\(request\);\s*if \(response\) return response;/.test(code("app/api/files/open/route.js")));
  ok("the staff route verifies the link before reading a row", code("app/api/files/open/route.js").indexOf("verifyStaffFileLink(") < code("app/api/files/open/route.js").indexOf("resolveStaffFile("));
  ok("the staff route reads rows in the SESSION's company, not the link's", /resolveStaffFile\(db, \{ companyId: member\.companyId/.test(code("app/api/files/open/route.js")));
  ok("the platform route gates payouts with the payout gate", /payoutViewerOrRefusal\(request\)/.test(code("app/api/platform/files/open/route.js")) && /getCurrentPlatformAdmin\(request\)/.test(code("app/api/platform/files/open/route.js")));
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFailed:\n" + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
