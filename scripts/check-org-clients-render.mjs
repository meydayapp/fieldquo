// scripts/check-org-clients-render.mjs
//
//   npm run check:org-clients-render
//
// The owner's rule for the Organization card (2026-10-13): a homeowner's
// client page looks exactly as it does today. Proved by RENDERING every new
// piece of the client, quote, invoice and job screens with react-dom/server:
// for an individual — and for an organisation with the switch off and one
// contact — each renders the empty string, so the page around them is the
// page it was. Then the same components with an organisation, so the empty
// strings are not the components failing to render at all.
//
// Bundled with esbuild (JSX in .js) like check:reuse-takeoffs.

import { renderToStaticMarkup } from "react-dom/server";
import { LanguageProvider } from "../app/providers/LanguageProvider.js";
import OrganizationCard from "../app/components/clients/OrganizationCard.js";
import { AutoMessagesNotice, AutoMessagesPanel } from "../app/components/clients/AutoMessages.js";
import RecipientPicker from "../app/components/clients/RecipientPicker.js";
import OtherContacts from "../app/components/clients/OtherContacts.js";

let pass = 0;
const failures = [];
const ok = (label, cond, got) => {
  if (cond) pass++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}${got !== undefined ? `  got: ${JSON.stringify(got).slice(0, 300)}` : ""}`);
  }
};
const html = (node, lang = "en") => renderToStaticMarkup(<LanguageProvider initialLanguage={lang}>{node}</LanguageProvider>);

const homeowner = { id: "c1", type: "individual", name: "Marie Tremblay", email: "m@x", phone: "1", autoMessagesOffAt: null, autoMessagesOffReason: null };
// What an individual's payload can still carry from a past life as a company:
// organizationShape removes these before they reach the page, but the
// components must not draw them even if a stale payload had them.
const homeownerStale = { ...homeowner, organizationUnit: "old", procurementNotes: "old", contacts: [{ id: "x", name: "Spouse", isPrimary: false }] };
const orgOneContact = { id: "c2", type: "company", name: "Acme", email: "a@x", autoMessagesOffAt: null, contacts: [{ id: null, name: "Al", email: "a@x", isPrimary: true }] };
const orgOff = {
  id: "c3",
  type: "company",
  name: "PSPC",
  email: "lisa@x",
  organizationUnit: "Science and Parliamentary Infrastructure Branch",
  procurementNotes: "Questions only through SAP Ariba",
  requiresPo: true,
  autoMessagesOffAt: "2026-10-10T00:00:00Z",
  autoMessagesOffReason: "Government tender",
  contacts: [
    { id: null, name: "Lisa Hampel", role: "Contracting Authority", email: "lisa@x", isPrimary: true },
    { id: "cc1", name: "Bob", role: "Technical Authority", email: "bob@x", isPrimary: false },
  ],
};

console.log("\nA homeowner's screens: every new piece renders nothing");
for (const [label, client] of [["individual", homeowner], ["individual with a stale company payload", homeownerStale]]) {
  ok(`${label}: Organization card`, html(<OrganizationCard client={client} canEdit onChanged={() => {}} />) === "");
  ok(`${label}: automatic-messages notice`, html(<AutoMessagesNotice client={client} />) === "");
  ok(`${label}: automatic-messages panel`, html(<AutoMessagesPanel client={client} />) === "");
  ok(`${label}: recipient picker`, html(<RecipientPicker client={client} value={null} onChange={() => {}} />) === "");
  ok(`${label}: other contacts`, html(<OtherContacts client={client} />) === "");
}
ok("no client at all: every piece renders nothing", [
  <OrganizationCard client={null} />,
  <AutoMessagesNotice client={null} />,
  <AutoMessagesPanel client={null} />,
  <RecipientPicker client={null} />,
  <OtherContacts client={null} />,
].every((n) => html(n) === ""));
ok("an organisation with the switch off: no notice, no panel", html(<AutoMessagesNotice client={orgOneContact} />) === "" && html(<AutoMessagesPanel client={orgOneContact} />) === "");
ok("an organisation with one contact: no picker (the send screen is unchanged)", html(<RecipientPicker client={orgOneContact} value={null} onChange={() => {}} />) === "");

console.log("\nAn organisation: the pieces do render");
const card = html(<OrganizationCard client={orgOff} canEdit onChanged={() => {}} />);
ok("the card renders for a company", card.includes("data-organization-card"));
ok("…with its department", card.includes("Science and Parliamentary Infrastructure Branch"));
ok("…its procurement notes", card.includes("Questions only through SAP Ariba"));
ok("…the PO rule", card.includes("data-client-requires-po"));
ok("…the primary first, with its role", card.indexOf("Lisa Hampel") > -1 && card.indexOf("Lisa Hampel") < card.indexOf("Bob") && card.includes("Contracting Authority"));
ok("…and Make primary only on the non-primary", (card.match(/Make primary/g) || []).length === 1);
const cardRO = html(<OrganizationCard client={orgOff} canEdit={false} onChanged={() => {}} />);
ok("read-only: no edit controls are drawn (no dead buttons)", !cardRO.includes("Make primary") && !cardRO.includes("Add contact") && !cardRO.includes("Edit department"));
const hidden = html(<OrganizationCard client={{ ...orgOff, contacts: undefined }} canEdit onChanged={() => {}} />);
ok("redacted (no contacts key): says hidden, offers no Add", hidden.includes("Hidden by your access level") && !hidden.includes("data-add-contact"));
ok("the notice renders when the switch is on", html(<AutoMessagesNotice client={orgOff} />).includes("data-auto-messages-notice"));
ok("…with the reason", html(<AutoMessagesNotice client={orgOff} />).includes("Government tender"));
const panel = html(<AutoMessagesPanel client={orgOff} />);
ok("the panel renders when the switch is on, and explains Do not contact", panel.includes("data-auto-messages-panel") && /Do not contact/.test(panel));
const fr = html(<OrganizationCard client={orgOff} canEdit onChanged={() => {}} />, "fr");
ok("French: the card is in French", fr.includes("Organisation") && fr.includes("Ajouter un contact"));
const pa = html(<AutoMessagesPanel client={orgOff} />, "pa");
ok("Punjabi: the panel is in Punjabi", pa.includes("ਕੋਈ ਆਟੋਮੈਟਿਕ ਈਮੇਲ"));
ok("the switch's panel no longer calls Do not contact merely 'different' — it holds these too", panel.includes("holds back these same messages"));

console.log("\nDo not contact (owner, 2026-10-14): the same notice and panel, saying so");
const dnc = { ...homeowner, id: "c9", doNotContactAt: "2026-10-11T00:00:00Z", doNotContactReason: "Asked not to be called (callback list)" };
const dncNotice = html(<AutoMessagesNotice client={dnc} />);
ok("a Do-not-contact homeowner gets the notice beside Send", dncNotice.includes('data-auto-messages-notice="do_not_contact"'));
ok("…a WARNING, not a block: Send still sends, use it for what they need", dncNotice.includes("Send still sends") && dncNotice.includes("an invoice they owe"));
ok("…with the Do-not-contact reason", dncNotice.includes("Asked not to be called (callback list)"));
const dncPanel = html(<AutoMessagesPanel client={dnc} />);
ok("the client page's panel shows for Do not contact", dncPanel.includes('data-auto-messages-panel="do_not_contact"'));
ok("…titled Do not contact, saying what it holds back and what still works", dncPanel.includes(">Do not contact<") && dncPanel.includes("FieldQuo sends them nothing on its own") && dncPanel.includes("still work when you press them"));
ok("…dated from Do not contact", dncPanel.includes("Marked Do not contact on"));
ok("…without the switch's 'turning it off' line when the switch is off", !dncPanel.includes("is also on"));
const bothPanel = html(<AutoMessagesPanel client={{ ...orgOff, doNotContactAt: "2026-10-12T00:00:00Z", doNotContactReason: "Asked twice" }} />);
ok("both set: Do not contact leads, and says turning the switch off changes nothing", bothPanel.includes('data-auto-messages-panel="do_not_contact"') && bothPanel.includes("Turning it off changes nothing while Do not contact stands") && bothPanel.includes("Asked twice"));
const frDnc = html(<AutoMessagesNotice client={dnc} />, "fr");
ok("French: the Do-not-contact warning is in French", frDnc.includes("Ne pas contacter"));
ok("an individual with NEITHER still renders nothing (unchanged)", html(<AutoMessagesNotice client={homeowner} />) === "" && html(<AutoMessagesPanel client={homeowner} />) === "");

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
