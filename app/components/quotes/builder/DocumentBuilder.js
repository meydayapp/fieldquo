// app/components/quotes/builder/DocumentBuilder.js
//
// The document-shaped quote builder (mockup b7, approved 2026-09-21: "keep it
// like that"). What the estimator edits is what the client reads.
//
// ── What this file is, and is not ───────────────────────────────────────────
//
// It is an ARRANGEMENT. Every piece of state, every handler, the derivation of
// every figure and the save itself live in QuoteBuilder.js and arrive here as
// one object, `b`. The takeoff for every trade, the unit-pricing fields, the
// intake boxes, the tier picker, the line table, the cost panel, the notes,
// the photos and the AI review are the same closures the classic layout
// calls (`b.renderGroupEditor` and friends) — not copies. Nothing here
// fetches /api/quotes; the only way out is `b.handleSave`, so the request
// the two layouts post is one function (lib/quotes/builderRequest.js) and
// scripts/check-doc-builder.mjs holds the md5 that says so.
//
// ── One arrangement, two documents (`kind`) ─────────────────────────────────
//
// The owner (2026-09-23): "a new invoice should be the same as creating a new
// quote, except that it is an invoice." So this file draws an invoice too —
// `kind="invoice"`, from app/components/invoices/builder/InvoiceBuilder.js,
// which hands over the same `b` shape from its own state and its own save.
// The default is "quote" and every quote caller passes nothing, so a quote is
// drawn exactly as before. What the kind changes is only what an invoice does
// not have: the estimate-type cards, the templates, the service tiles, the
// job address, the e-transfer line, "what happens next", the readiness block,
// the Presentation / Work order / Notes tabs and the quote-only banners. The
// masthead, the parties, the line cards, the totals, the notes, the photos,
// the custom fields, the cost drawer, the review panel and the dock are the
// same components in the same places — which is the point.
//
// ── The page ────────────────────────────────────────────────────────────────
//
//   toolbar   Estimate · Presentation · Work order · Notes   [Save] [Send… ▾]
//   document  masthead (company block, QUOTE, number, dates)
//             prepared for · job address · date · valid until
//             one card per service — rooms with their prices for a painting
//             takeoff, lines for everything else, text blocks, the options
//             the homeowner can tick under the room they belong to
//             subtotal · e-transfer / cheque line · tax · TOTAL
//             notes
//   drawer    Cost & margin — staff only, never in the document
//   dock      the total and the ways out (QuoteActionsDock, shared)
//
// The document itself is app/components/document/QuoteDocument.js — the same
// sections the quote page draws read-only. Passing `edit` callbacks is what
// turns a region into something that opens: click the room → its takeoff
// card; click a text block → the rich text editor; click the client → the
// contact form; click tax → the tax fields. The editors that open are the
// existing ones.
//
// ── What could not be made inline-editable, and why ─────────────────────────
//
//   • The quote number. It is minted by the server on the first save
//     (lib/quotes/quoteNumber) and never taken from the browser — two
//     estimators typing the same number is the race that file exists to
//     prevent. It is drawn, not underlined.
//   • The issue date. sentAt over createdAt (lib/documents/issueDate.js):
//     the day it reached the client, which nobody gets to type.
//   • The estimator's name. Not on any client surface today (the PDF and the
//     email print the company's contacts, not the assignee's), so drawing it
//     in the document would show the estimator something the client never
//     sees. "Assigned to" sits in the strip above the document instead.
//   • A stored group's takeoff. Frozen on purpose — its lines were priced
//     against the rate card of the day it was written and a quote in a
//     client's inbox must not reprice. Its lines open in the line table, as
//     the classic layout does (app.quoteEdit.takeoffFrozen).
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  AlertCircle,
  Save,
  Send,
  Eye,
  Share2,
  LayoutTemplate,
  ClipboardCopy,
  Download,
  TrendingUp,
  X,
  Trash2,
  Pencil,
  ExternalLink,
  Loader2,
  CheckCircle2,
  Plus,
} from "lucide-react";

import {
  DocumentFrame,
  DocumentMasthead,
  DocumentParties,
  DocumentScopeGroup,
  DocumentTotals,
  Editable,
} from "@/app/components/document/QuoteDocument";
import {
  QuoteTermsFields,
  QuoteReadinessBlock,
  QuoteActionsDock,
} from "./QuoteTotalsBar";
import ClientPicker from "./ClientPicker";
import JobAddressField from "./JobAddressField";
import ServiceTiles from "./ServiceTiles";
import TemplatePicker from "./TemplatePicker";
import EstimateTypeFirst from "./EstimateTypeFirst";
import RichTextEditor from "./RichTextEditor";
import QuoteLanguageBar from "@/app/components/quotes/QuoteLanguageBar";
import SendMenu from "@/app/components/quotes/SendMenu";
import ShareWithStaffModal from "@/app/components/quotes/ShareWithStaffModal";
import SaveAsTemplateModal from "@/app/components/quotes/SaveAsTemplateModal";
import SiteVisitPanel from "@/app/components/quotes/SiteVisitPanel";
import PresentationPanel from "@/app/app/quotes/[id]/PresentationPanel";
import StaleWriteBanner from "@/app/components/StaleWriteBanner";
import HelpButton from "@/app/components/HelpButton";
import OnboardingTour from "@/app/components/OnboardingTour";
import { CustomFieldInputs } from "@/app/components/customFields/CustomFieldsBox";
import { useHasLevel } from "@/app/providers/PermissionProvider";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";

import { documentLabels } from "@/lib/i18n/documentLabels";
import { formatAddress } from "@/lib/format/address";
import { formatAppMoney } from "@/lib/format/money";
import { visibleLineItems } from "@/lib/quotes/scopeGroupDisplay";
import { resolveServiceContent } from "@/lib/documents/serviceContent";
import { isTextLine } from "@/lib/quotes/textBlocks";
import { scopeGroupPayload } from "@/lib/quotes/builderPayload";
import { quoteStatusLabel, quoteStatusClasses } from "@/lib/quotes/statusLabels";
import { fetchClientLink, downloadQuotePdf } from "@/lib/quotes/clientActions";
import { workOrderPath, workOrderPdfPath } from "@/lib/workOrder/url";
import { buildWorkOrderModel } from "@/lib/workOrder/build";
import { paintTakeoff } from "@/lib/pricing/paintTakeoff";
import { tradeOptionalExtras } from "@/lib/pricing/tradeScope";
import { getPriceBook } from "@/app/data/tradePriceBooks";
import {
  offlineDiscountOffered,
  offlineDiscountAmount,
  offlineDiscountOfferLabel,
  OFFLINE_PAYMENT_DISCOUNT_PCT,
} from "@/lib/payments/offlineDiscount";
import { jsonBody } from "@/lib/jsonBody";
import { fetchJson } from "@/lib/fetchJson";
import { hasTakeoff } from "@/lib/pricing/takeoffTrades";
import { defaultSiteAddressFor } from "@/lib/quotes/jobAddress";

const TABS = ["estimate", "presentation", "workorder", "notes"];

const isPaintAreas = (g) =>
  g?.takeoff && typeof g.takeoff === "object" && g.takeoff.model === "area_substrate";

/** A bordered panel that opens under the region it edits, with a way to close it. */
function InlinePanel({ title, onClose, children, t, ...rest }) {
  return (
    <div className="mt-2 rounded-lg border border-border bg-background p-3 space-y-3" data-inline-editor {...rest}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-medium text-foreground underline underline-offset-2 inline-flex items-center gap-1"
        >
          <X size={12} /> {t("app.docBuilder.done", "Done")}
        </button>
      </div>
      {children}
    </div>
  );
}

const Field = ({ label, children }) => (
  <label className="block text-sm">
    <span className="block text-xs font-medium text-muted-foreground mb-1">{label}</span>
    {children}
  </label>
);
const inputCls = "w-full border border-border rounded px-3 py-2 text-sm bg-background text-foreground";

/**
 * The company block, edited in place. Writes Settings › Company through the
 * same PATCH the settings page uses (business-info), so the next quote's
 * masthead carries it too — "Save as default" on process notes already
 * writes a company field from here, this is the same move.
 */
function CompanyBlockEditor({ company, onSaved, onClose, t }) {
  const [form, setForm] = useState({
    name: company?.name || "",
    address: company?.address || "",
    phone: company?.phone || "",
    email: company?.email || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  async function save() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/settings/business-info", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: jsonBody(form, "company details"),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || t("app.quoteEdit.saveError"));
        return;
      }
      onSaved(form);
      onClose();
    } catch (err) {
      setError(err?.message || t("app.quoteEdit.saveError"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <InlinePanel title={t("app.docBuilder.companyBlock", "Your company, as the document prints it")} onClose={onClose} t={t} data-company-editor>
      <p className="text-xs text-muted-foreground">
        {t("app.docBuilder.companyBlockHint", "Saved to Settings › Company — every quote and invoice prints it.")}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label={t("app.clientNew.companyName", "Company name")}><input value={form.name} onChange={set("name")} className={inputCls} /></Field>
        <Field label={t("app.field.address", "Address")}><input value={form.address} onChange={set("address")} className={inputCls} /></Field>
        <Field label={t("app.field.phone", "Phone")}><input value={form.phone} onChange={set("phone")} className={inputCls} /></Field>
        <Field label={t("app.field.email", "Email")}><input value={form.email} onChange={set("email")} className={inputCls} /></Field>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <button type="button" onClick={save} disabled={busy} className="bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-1.5">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {t("app.docBuilder.saveCompany", "Save company details")}
      </button>
    </InlinePanel>
  );
}

/**
 * The contact, edited in place — writes the CLIENT (PATCH /api/clients/[id]),
 * which the classic builder locks on an edit. The quote's client stays who
 * it is; what changes is their details, everywhere they are printed.
 */
function ContactEditor({ client, onSaved, onClose, t }) {
  const [form, setForm] = useState({
    name: client?.name || "",
    contactName: client?.contactName || "",
    email: client?.email || "",
    phone: client?.phone || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  async function save() {
    setBusy(true);
    setError("");
    try {
      const saved = await fetchJson(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: jsonBody(form, "contact details"),
      });
      onSaved({ ...client, ...form, ...(saved && typeof saved === "object" ? saved : {}) });
      onClose();
    } catch (err) {
      setError(err?.message || t("app.quoteEdit.saveError"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <InlinePanel title={t("app.docBuilder.contactBlock", "Contact details")} onClose={onClose} t={t} data-contact-editor>
      <p className="text-xs text-muted-foreground">
        {t("app.docBuilder.contactBlockHint", "Saved on the client's record — this quote and everything after it prints them.")}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label={t("app.field.name", "Name")}><input value={form.name} onChange={set("name")} className={inputCls} /></Field>
        <Field label={t("app.clientNew.contactPerson", "Contact person")}><input value={form.contactName} onChange={set("contactName")} className={inputCls} /></Field>
        <Field label={t("app.field.email", "Email")}><input value={form.email} onChange={set("email")} className={inputCls} type="email" /></Field>
        <Field label={t("app.field.phone", "Phone")}><input value={form.phone} onChange={set("phone")} className={inputCls} /></Field>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <button type="button" onClick={save} disabled={busy} className="bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-1.5">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {t("app.docBuilder.saveContact", "Save contact")}
      </button>
    </InlinePanel>
  );
}

/**
 * A text block, edited where it is read: the name, the body in the same
 * five-rule rich text the PDF prints (RichTextEditor), and the "hidden on
 * work order" switch the library set. Edits go through the builder's own
 * updateLineItem, so they save exactly as the line table's would.
 */
function TextLineEditor({ item, onChange, onRemove, onClose, t }) {
  return (
    <InlinePanel title={t("app.docBuilder.textBlock", "Text block")} onClose={onClose} t={t} data-text-line-editor>
      <Field label={t("app.lineItems.description")}>
        <input value={item.description || ""} onChange={(e) => onChange("description", e.target.value)} className={inputCls} />
      </Field>
      <RichTextEditor value={item.detail || ""} onChange={(v) => onChange("detail", v)} />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={item.hiddenOnWorkOrder === true}
            onChange={(e) => onChange("hiddenOnWorkOrder", e.target.checked)}
          />
          {t("app.textBlocks.hiddenOnWorkOrder", "Hidden on work order")}
        </label>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-xs text-red-700 dark:text-red-400 inline-flex items-center gap-1">
            <Trash2 size={12} /> {t("app.action.remove", "Remove")}
          </button>
        )}
      </div>
    </InlinePanel>
  );
}

/**
 * A painting takeoff's rooms, drawn as the client will read them — each
 * room with its priced lines and, under it, the options the homeowner can
 * tick. paintTakeoff() is the one arithmetic (never reimplemented here);
 * the options are exactly the rows syncTakeoffAddOns will write at save.
 */
function PaintRooms({ group, book, money, onOpenArea, t, extras }) {
  const result = useMemo(() => paintTakeoff(group.takeoff, book?.takeoff), [group.takeoff, book]);
  const byArea = (label) => extras.filter((e) => e.areaLabel === label);
  const rooms = [...result.areas, ...result.optionalAreas].sort((a, b) => a.index - b.index);
  return (
    <div className="space-y-2 py-2" data-doc-rooms>
      {rooms.map((area) => {
        const opts = byArea(area.label);
        // The typed dimensions, off the stored row (the priced record carries
        // the derived geometry, not what was typed). Only when all three are
        // there — "15 × 16" with no height is a chip that says less than the
        // card below it.
        const raw = (group.takeoff.areas || [])[area.index] || {};
        const dims =
          area.measurement === "area" && raw.lengthFt > 0 && raw.widthFt > 0 && raw.heightFt > 0
            ? `${raw.lengthFt} × ${raw.widthFt} × ${raw.heightFt}`
            : null;
        return (
          <div key={area.index} className="rounded-lg border border-border overflow-hidden" data-doc-room={area.index}>
            <Editable onClick={() => onOpenArea(area.index)} label={t("app.docBuilder.editRoom", "Edit this room")} block>
              <div className="flex items-center justify-between gap-3 px-3 py-2 bg-muted/60">
                <span className="text-sm font-semibold text-foreground flex items-center gap-2 min-w-0">
                  <span className="truncate">{area.label}</span>
                  {dims ? <span className="text-[10px] font-normal rounded-full border border-border px-1.5 py-0.5 text-muted-foreground shrink-0">{dims}</span> : null}
                  {area.optional ? <span className="text-[10px] font-normal rounded-full border border-border px-1.5 py-0.5 text-muted-foreground shrink-0">{t("app.docBuilder.optionalRoom", "optional")}</span> : null}
                </span>
                <span className="text-sm font-semibold tabular-nums shrink-0">{area.optional ? `+ ${money(area.total)}` : money(area.total)}</span>
              </div>
            </Editable>
            <div className="px-3">
              {area.lines
                .filter((l) => !l.optional && l.amount > 0)
                .map((l, i) => (
                  <div key={i} className="flex justify-between gap-3 text-sm py-1 border-b border-border last:border-0">
                    <span className="min-w-0">
                      {l.label}
                      <span className="text-muted-foreground"> — {l.kind === "prep" ? `${l.displayHours} h` : `${l.quantity} ${l.unit}`}{l.coats ? `, ${l.coats} ${t("app.docBuilder.coats", "coats")}` : ""}</span>
                    </span>
                    <span className="tabular-nums shrink-0">{money(l.amount)}</span>
                  </div>
                ))}
              {opts.map((o, i) => (
                <div key={`o${i}`} className="flex justify-between gap-3 text-sm py-1 text-muted-foreground border-b border-border last:border-0" data-doc-option>
                  <span className="min-w-0 flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded border border-border shrink-0" aria-hidden="true" />
                    {t("app.docBuilder.optionPrefix", "Option:")} {o.description.replace(`${area.label} — `, "")}
                  </span>
                  <span className="tabular-nums shrink-0">+ {money(o.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {rooms.length === 0 && (
        <p className="text-xs text-muted-foreground">{t("app.docBuilder.noRooms", "No areas yet — open the takeoff to add one.")}</p>
      )}
    </div>
  );
}

/**
 * The Work order tab. With a job: the crew's link and PDF (lib/workOrder/
 * url.js). Without one: what the crew WOULD see, from the same
 * buildWorkOrderModel the crew page uses, and the per-block "hidden on work
 * order" switches. No money reaches this tab by construction — the model
 * carries none.
 */
function WorkOrderTab({ b, t }) {
  const jobId = b.start.quote?.jobs?.[0]?.id || null;
  const model = useMemo(() => {
    const scopeGroups = b.scopeGroups.map((g) => ({
      id: g.tempId,
      label: g.label,
      category: { key: g.categoryKey, label: g.label },
      categoryId: g.categoryId,
      takeoff: g.takeoff,
      // The lines as they will be STORED — derived for a group added this
      // session, stored for a persisted one — so the crew preview matches
      // the document the save will write.
      lineItems: scopeGroupPayload(g, b.rateOverridesFor(g.categoryId), b.quoteLanguage || b.companyLanguage).lineItems,
    }));
    const ratesById = new Map(scopeGroups.map((g) => [g.categoryId, b.rateOverridesFor(g.categoryId)]));
    return buildWorkOrderModel({
      job: { id: "preview", title: "", siteAddress: b.siteAddress, workOrderHidden: [], quote: { quoteNumber: b.start.quoteNumber, language: b.quoteLanguage, scopeGroups } },
      client: b.selectedClient ? { name: b.selectedClient.name } : null,
      ratesById,
      forOffice: true,
    });
  }, [b.scopeGroups, b.siteAddress, b.selectedClient, b.quoteLanguage, b.companyLanguage, b.start.quoteNumber, b.rateOverridesFor]);

  const textLines = b.scopeGroups.flatMap((g) =>
    (Array.isArray(g.lineItems) ? g.lineItems : []).map((item, i) => ({ g, i, item })).filter(({ item }) => isTextLine(item)),
  );

  return (
    <div className="space-y-4" data-tab-panel="workorder">
      {jobId ? (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-foreground">{t("app.docBuilder.workOrderReady", "The crew's work order")}</h2>
          <p className="text-sm text-muted-foreground">{t("app.sendMenu.workOrderHint", "The crew's copy — no prices. Opens in the app for signed-in crew.")}</p>
          <div className="flex flex-wrap gap-2">
            <Link href={workOrderPath(jobId)} className="inline-flex items-center gap-1.5 border border-border text-foreground px-4 py-2 rounded-full text-sm font-semibold">
              <ExternalLink size={14} /> {t("app.docBuilder.openWorkOrder", "Open work order")}
            </Link>
            <a href={workOrderPdfPath(jobId)} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 border border-border text-foreground px-4 py-2 rounded-full text-sm font-semibold">
              <Download size={14} /> {t("app.sendMenu.downloadWorkOrderPdf", "Download work order PDF")}
            </a>
          </div>
        </div>
      ) : (
        <div className="bg-muted border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground">
          {t("app.docBuilder.workOrderAfterJob", "The work order is the job's — it exists once the client accepts this quote. Below is what the crew will see.")}
        </div>
      )}

      {textLines.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-2" data-work-order-hidden-toggles>
          <h2 className="font-semibold text-foreground">{t("app.docBuilder.hiddenBlocks", "Text blocks on the crew's copy")}</h2>
          <p className="text-xs text-muted-foreground">{t("app.docBuilder.hiddenBlocksHint", "Deposit terms and exclusions are for the client; the crew reads scope. Untick a block to keep it off the work order.")}</p>
          {textLines.map(({ g, i, item }) => (
            <label key={`${g.tempId}-${i}`} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={item.hiddenOnWorkOrder !== true}
                disabled={!b.canEditScope || g.imported}
                onChange={(e) => b.updateLineItem(g.tempId, i, "hiddenOnWorkOrder", !e.target.checked)}
              />
              <span className="min-w-0 truncate">{item.description || t("app.docBuilder.untitledBlock", "Untitled block")}</span>
            </label>
          ))}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5 space-y-3" data-work-order-preview>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-foreground">{t("app.docBuilder.crewPreview", "Crew preview")}</h2>
          <span className="text-xs text-muted-foreground tabular-nums">{t("app.duration.hours", { value: model.displayHours })}</span>
        </div>
        {model.areas.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("app.docBuilder.crewPreviewEmpty", "Nothing on the work order yet — add a service.")}</p>
        ) : (
          model.areas.filter((a) => !a.hidden).map((a) => (
            <div key={a.key} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-foreground">{a.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{a.hours > 0 ? t("app.duration.hours", { value: a.displayHours }) : ""}</span>
              </div>
              {a.scope ? <p className="text-xs text-muted-foreground mt-1">{a.scope}</p> : null}
              {a.lines.filter((l) => !l.hidden).length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {a.lines.filter((l) => !l.hidden).map((l, i) => (
                    <li key={i} className="text-xs text-foreground">
                      {l.label}
                      {l.quantity ? <span className="text-muted-foreground"> · {l.quantity}{l.unit ? ` ${l.unit}` : ""}</span> : null}
                      {l.coats ? <span className="text-muted-foreground"> · {l.coats} {t("app.docBuilder.coats", "coats")}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
              {a.crewNote ? <p className="mt-1.5 text-xs text-amber-800 dark:text-amber-300">{a.crewNote}</p> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function DocumentBuilder({ b, kind = "quote" }) {
  const { t, isEdit, quoteId, start, boot } = b;
  const isInvoice = kind === "invoice";
  // An invoice is one tab — its lines ARE the document; the proposal, the
  // crew's copy and the internal notes are a quote's.
  const tabs = isInvoice ? ["estimate"] : TABS;
  const { formatDate } = useCompanyPreferences();
  const money = (n) => formatAppMoney(n, b.companyCurrency, "en");
  const labels = documentLabels(b.quoteLanguage || b.companyLanguage);
  const canEditClients = useHasLevel("clientsProperties", "full_edit");
  const canEditCompany = b.settingsAccess?.canChange?.("user:manage") ?? false;

  const [tab, setTab] = useState("estimate");
  // Which region's editor is open. One at a time: the document is the thing
  // being read, and two forms open at once turns it back into the long form.
  const [editing, setEditing] = useState(null);
  // Which service card has its editor unfolded beneath its lines. An
  // invoice opens on its lines: they are the whole document, and a card
  // that had to be clicked open first was the old form with an extra step.
  const [openGroup, setOpenGroup] = useState(() => (isInvoice && b.scopeGroups[0] ? b.scopeGroups[0].tempId : null));
  const [focusArea, setFocusArea] = useState(null);
  // ── Cost & margin is open while you build, from lg up ──────────────────
  //
  // The owner (2026-09-23): "cost & margin visible during creation and
  // editable" — not behind a toggle on the review. So the drawer column
  // opens by itself on a screen wide enough to hold it beside the document,
  // and the toggle still closes it. On a phone the same panel is a sheet
  // over the whole document, so there it waits for the press. Decided in an
  // effect, not in the initial state: the width is the browser's, and a
  // server render (or the check script's) has no browser.
  const [costOpen, setCostOpen] = useState(false);
  useEffect(() => {
    if (!b.mayCost || typeof window === "undefined" || !window.matchMedia) return;
    if (window.matchMedia("(min-width: 1024px)").matches) setCostOpen(true);
    // Once, on mount: reopening on every resize would fight a hand that closed it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [company, setCompany] = useState(boot.company || null);
  const [notice, setNotice] = useState("");
  const [menuBusy, setMenuBusy] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [menuError, setMenuError] = useState("");
  const groupRefs = useRef({});
  // A service added from the cards or the tiles opens unfolded — the next
  // thing the estimator does is add a room or a line, not click "Edit".
  const [openNext, setOpenNext] = useState(false);
  const groupCount = b.scopeGroups.length;
  useEffect(() => {
    if (!openNext || groupCount === 0) return;
    setOpenGroup(b.scopeGroups[groupCount - 1].tempId);
    setOpenNext(false);
  }, [openNext, groupCount, b.scopeGroups]);
  const addAndOpen = (fn) => (...args) => {
    fn(...args);
    setOpenNext(true);
  };

  // "Open room takeoff" under a template line still waiting for its figure
  // (templateLineNotes.js): the builder asks this layout to unfold the group
  // that measures it, then brings it into view. Registered on the ref the
  // builder handed over; an invoice hands none and has no calculators.
  const calculatorOpenerRef = b.calculatorOpenerRef;
  const [calcFocus, setCalcFocus] = useState(null);
  useEffect(() => {
    if (!calculatorOpenerRef) return undefined;
    calculatorOpenerRef.current = (tempId) => {
      setOpenGroup(tempId);
      setCalcFocus(tempId);
    };
    return () => {
      calculatorOpenerRef.current = null;
    };
  }, [calculatorOpenerRef]);
  // After the unfold has rendered: land on the editor (where the takeoff
  // is), not the top of the card, which is the document's lines.
  useEffect(() => {
    if (!calcFocus || openGroup !== calcFocus) return;
    const root = groupRefs.current[calcFocus];
    const el = root?.querySelector?.("[data-doc-group-editor]") || root;
    el?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    setCalcFocus(null);
  }, [calcFocus, openGroup]);

  // "Add line item" on a service card: once its editor has rendered, open
  // that group's line library — the button the line table already draws —
  // or, where the table offers no library (an invoice with no products),
  // add the blank line its "+ Add line" adds. Either way into THIS group.
  const [libraryFocus, setLibraryFocus] = useState(null);
  useEffect(() => {
    if (!libraryFocus || openGroup !== libraryFocus.tempId) return;
    const root = groupRefs.current[libraryFocus.tempId];
    const editor = root?.querySelector?.("[data-doc-group-editor]");
    const target =
      editor?.querySelector?.("[data-open-line-item-library]") ||
      editor?.querySelector?.("[data-add-blank-line]");
    if (target) {
      target.scrollIntoView?.({ behavior: "smooth", block: "center" });
      target.click();
    }
    setLibraryFocus(null);
  }, [libraryFocus, openGroup]);

  // A room click opens the group's takeoff and lands on that room's card.
  useEffect(() => {
    if (focusArea === null || !openGroup) return;
    const root = groupRefs.current[openGroup];
    const el = root?.querySelector?.(`[data-paint-area="${focusArea}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFocusArea(null);
  }, [focusArea, openGroup]);

  // An invoice edit saves; sending a sent invoice again is the invoice
  // page's own "Send again" with its ask (lib/invoices/sendAsk.js), not a
  // builder button. A new invoice offers Save & send as the old form did.
  const sendable = isInvoice ? !isEdit : !isEdit || b.OPEN_STATUSES.includes(start.status);
  // ── The link exists from the first SAVE, not from the first send ────────
  //
  // It used to require a sent quote, because the share token was minted by the
  // send route. It is now minted when the quote is saved (lib/quotes/
  // shareToken.js) and /q/<token> answers a draft with a members-only preview,
  // so both link rows work as soon as there is a quote id. What they still
  // cannot do is work on a quote that has never been saved: there is nothing
  // to link to, which is what `isEdit` covers and what afterSaveHint says.
  const linkable = isEdit;
  const unsentDraft = isEdit && start.status === "draft";
  const workOrderJobId = start.quote?.jobs?.[0]?.id || null;

  async function menuAction(key, fn) {
    setMenuBusy(key);
    setMenuError("");
    setNotice("");
    try {
      await fn();
    } catch (err) {
      setMenuError(err?.message || t("app.sendMenu.linkError", "Couldn't get the client link."));
    } finally {
      setMenuBusy("");
    }
  }

  const savedHint = t("app.docBuilder.savedVersionHint", "Uses the last saved version.");
  const afterSaveHint = t("app.docBuilder.afterSaveHint", "Available once the quote is saved.");
  // The invoice hands in its own rows (the PDF, the invoice page) — every
  // row below is a quote's: the client link, the staff share, the template.
  const menuItems = isInvoice ? (Array.isArray(b.menuItems) ? b.menuItems : []) : [
    {
      key: "preview",
      label: t("app.sendMenu.preview", "Preview as client"),
      // On a draft the point of the row IS that it works before sending, so
      // it says so; on a sent quote the caveat that matters is that the link
      // shows the last SAVED version, not what is on screen unsaved.
      hint: !linkable
        ? afterSaveHint
        : unsentDraft
          ? t("app.sendMenu.previewDraftHint", "See the client's copy before you send it.")
          : savedHint,
      icon: Eye,
      disabled: !linkable,
      busy: menuBusy === "preview",
      onSelect: () =>
        menuAction("preview", async () => {
          const url = await fetchClientLink(quoteId);
          window.open(url, "_blank", "noopener");
        }),
    },
    {
      key: "share",
      label: t("app.sendMenu.shareStaff", "Share with staff"),
      hint: isEdit ? t("app.sendMenu.shareStaffHint", "chat · link") : afterSaveHint,
      icon: Share2,
      disabled: !isEdit,
      onSelect: () => setShareOpen(true),
    },
    {
      key: "template",
      label: t("app.sendMenu.saveTemplate", "Save as template"),
      hint: isEdit ? savedHint : afterSaveHint,
      icon: LayoutTemplate,
      disabled: !isEdit,
      onSelect: () => setTemplateOpen(true),
    },
    {
      key: "link",
      // The draft wording is the owner's: the row works, and the sentence is
      // the one fact that would otherwise surprise somebody who pasted the
      // link into a text message this afternoon.
      label: unsentDraft
        ? t("app.sendMenu.copyLinkDraft", "Copy link — the client can open it once you send.")
        : t("app.sendMenu.copyLink", "Copy quote link"),
      hint: linkable ? null : afterSaveHint,
      icon: ClipboardCopy,
      disabled: !linkable,
      busy: menuBusy === "link",
      onSelect: () =>
        menuAction("link", async () => {
          const url = await fetchClientLink(quoteId);
          await navigator.clipboard.writeText(url);
          setNotice(t("app.sendMenu.linkCopied", "Client link copied."));
        }),
    },
    workOrderJobId && {
      key: "workOrderLink",
      label: t("app.sendMenu.copyWorkOrderLink", "Copy work order link"),
      hint: t("app.sendMenu.workOrderHint", "The crew's copy — no prices. Opens in the app for signed-in crew."),
      icon: ClipboardCopy,
      busy: menuBusy === "workOrderLink",
      onSelect: () =>
        menuAction("workOrderLink", async () => {
          await navigator.clipboard.writeText(`${window.location.origin}${workOrderPath(workOrderJobId)}`);
          setNotice(t("app.sendMenu.workOrderLinkCopied", "Work order link copied."));
        }),
    },
    workOrderJobId && {
      key: "workOrderPdf",
      label: t("app.sendMenu.downloadWorkOrderPdf", "Download work order PDF"),
      icon: Download,
      onSelect: () => window.open(workOrderPdfPath(workOrderJobId), "_blank", "noopener"),
    },
    {
      key: "pdf",
      label: t("app.sendMenu.downloadPdf", "Download quote PDF"),
      hint: isEdit ? savedHint : afterSaveHint,
      icon: Download,
      disabled: !isEdit,
      busy: menuBusy === "pdf",
      onSelect: () =>
        menuAction("pdf", () => downloadQuotePdf(quoteId, start.quoteNumber, t("app.quoteDetail.pdfError", "Couldn't build the PDF."))),
    },
  ];

  // ── The document's data, as the client will read it ──────────────────────
  const clientAddress = formatAddress(b.selectedClient);
  const issueDate = start.quote?.sentAt || start.quote?.createdAt || null;
  const meta = (
    isInvoice
      ? [
          issueDate ? { label: labels.date, value: formatDate(issueDate) } : null,
          // The due date, or the plain fact that none is set — an invoice
          // with no due date is a real state the reminders read (never
          // "due today" invented for the frame).
          { label: labels.dueDate, value: b.dueDate ? formatDate(b.dueDate) : t("app.invoiceBuilder.noDueDate", "not set") },
        ]
      : [
          issueDate ? { label: labels.date, value: formatDate(issueDate) } : null,
          b.validUntil ? { label: labels.validUntil, value: formatDate(b.validUntil) } : null,
        ]
  ).filter(Boolean);

  // The e-transfer / cheque offer: a sent quote keeps the pct it froze; a
  // draft (and a create) follows the company's switch, as the save routes
  // do (lib/payments/offlineDiscount.js).
  const offlinePct = isInvoice
    ? null
    : isEdit && start.status && start.status !== "draft"
      ? Number(start.quote?.offlineDiscountPct) > 0
        ? Number(start.quote.offlineDiscountPct)
        : null
      : offlineDiscountOffered(company)
        ? OFFLINE_PAYMENT_DISCOUNT_PCT
        : null;
  const offlineAmount = offlinePct ? offlineDiscountAmount(b.taxableBase, offlinePct) : 0;

  // Keyed on the RATE being settled, not the amount — an empty quote has $0
  // of tax at any rate (lib/tax/taxLine.js, the owner's 2026-09-21 note).
  const taxUnresolved = b.taxEnabled && !b.taxLine?.resolved;
  const totalRows = [
    { key: "subtotal", label: labels.subtotal, value: money(b.subtotal) },
    b.subtotal - b.taxableBase > 0
      ? { key: "discount", label: labels.discount, value: `-${money(b.subtotal - b.taxableBase)}`, editLabel: t("app.quoteEdit.discount") }
      : { key: "discount", label: labels.discount, value: t("app.docBuilder.none", "none"), editLabel: t("app.quoteEdit.discount") },
    offlinePct
      ? { key: "offline", label: offlineDiscountOfferLabel(offlinePct, b.quoteLanguage || b.companyLanguage), value: `− ${money(offlineAmount)}`, tone: "good", note: t("app.docBuilder.offlineNote", "The client ticks this on their quote; the total they sign changes when they do.") }
      : null,
    {
      key: "tax",
      label: labels.tax,
      value: taxUnresolved ? t("app.tax.line.unresolved") : b.taxEnabled ? money(b.tax) : t("app.tax.line.none"),
      tone: taxUnresolved ? "warn" : undefined,
      editLabel: t("app.quoteEdit.taxRate"),
      // The sentence under the figure: what to add when nothing names a
      // province, else where the settled rate came from ("HST 13% (Ontario)
      // · from the job address").
      note: taxUnresolved
        ? b.taxLine?.hint || null
        : [b.taxLine?.headline, b.taxLine?.source].filter(Boolean).join(" · ") || null,
    },
  ].filter(Boolean);

  const stored = isEdit && start.quote ? start.quote : null;
  const storedAddOns = Array.isArray(stored?.addOns) ? stored.addOns : [];

  const toggleGroup = (tempId) => setOpenGroup((cur) => (cur === tempId ? null : tempId));

  function updateStoredClient(next) {
    b.setSelectedClient(next);
  }

  const termsProps = {
    subtotal: b.subtotal,
    discount: b.discount,
    onDiscountChange: b.setDiscount,
    taxRate: b.taxRate,
    onTaxRateChange: (v) => {
      b.setTaxRate(v);
      // A quote edit keeps the stored rate as the truth; an invoice edit
      // recomputes from the typed rate the moment one is typed (its
      // unrounded-rate rule — see InvoiceBuilder).
      if (!isEdit || isInvoice) b.setTaxRateTouched(true);
    },
    taxNote: b.taxNote,
    taxCaution: b.taxCaution,
    taxSchemeNote: b.taxSchemeNote,
    taxAssumed: b.taxAssumed,
    taxLine: b.taxLine,
    taxVat:
      b.taxDetail?.reducedRate != null
        ? {
            standardRate: b.taxDetail.standardRate,
            reducedRate: b.taxDetail.reducedRate,
            workType: b.vatWorkType,
            conditionText: b.taxDetail.reducedConditionKey ? t(b.taxDetail.reducedConditionKey) : "",
            onChange: (v) => {
              b.setVatWorkType(v);
              b.setTaxRateTouched(false);
            },
          }
        : null,
    taxEnabled: b.taxEnabled,
    onTaxToggle: b.setTaxEnabled,
    validUntil: b.validUntil,
    onValidUntilChange: b.setValidUntil,
    validUntilDefaulted: !isEdit,
    currency: b.companyCurrency,
  };

  const tabLabel = {
    estimate: isInvoice ? t("app.invoiceBuilder.tab.invoice", "Invoice") : t("app.docBuilder.tab.estimate", "Estimate"),
    presentation: t("app.docBuilder.tab.presentation", "Presentation"),
    workorder: t("app.docBuilder.tab.workorder", "Work order"),
    notes: t("app.docBuilder.tab.notes", "Notes"),
  };

  // The words on the buttons, by document. An invoice's are the old form's
  // own keys, so the labels a hand knows are the labels it finds.
  const words = isInvoice
    ? {
        save: isEdit ? (b.isDraft === false ? t("app.invoiceEdit.saveNewVersion") : t("app.invoiceEdit.saveChanges")) : t("app.invoiceNew.saveDraft"),
        saveShort: isEdit ? (b.isDraft === false ? t("app.invoiceEdit.saveNewVersion") : t("app.invoiceEdit.saveChanges")) : t("app.invoiceNew.saveDraft"),
        send: t("app.invoiceNew.saveSend"),
        backTo: t("app.invoiceEdit.backTo"),
      }
    : {
        save: isEdit ? t("app.quoteEdit.saveChanges") : t("app.quoteNew.saveAsDraft"),
        saveShort: isEdit ? t("app.quoteEdit.saveChangesShort") : t("app.quoteNew.saveAsDraftShort"),
        send: t("app.quoteNew.saveAndSend"),
        backTo: t("app.quoteEdit.backTo"),
      };
  const backHref = b.backHref || `/app/quotes/${quoteId}`;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4" data-builder-layout="document" data-document-kind={kind}>
      {isEdit && (
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> {words.backTo} {start.quoteNumber}
        </Link>
      )}

      {/* ── The card: toolbar, then the document beside its drawer ──────
          The mockup's one `.card` (radius 12, padding 16–20) holding the
          tabs strip and the buttons on one row, the paper under it, and —
          from lg up, when open — the Cost & margin drawer as a 220px column
          to its right (`.two`). On a phone the drawer is a bottom sheet. */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-5 space-y-3" data-doc-card>
      {/* ── Toolbar: tabs, status, Save, Send… ─────────────────────────── */}
      {/* The tabs take their natural width and the action cluster wraps to
          its own line when the row runs out — `shrink-0` on both children of
          a wrapping flex row. Without it the tabs were the flexible child and
          got squeezed into their own overflow scroller at desktop widths,
          which is what the owner saw: a scrollbar thumb under four tabs on a
          1440px screen. Below lg the strip may still scroll (four tabs do not
          fit 375px), which is why the overflow rule survives there. */}
      <div className="flex items-start justify-between gap-x-3 gap-y-2 flex-wrap -mt-1" data-doc-toolbar>
        <div role="tablist" className="flex gap-1 border-b border-border -mb-px shrink-0 max-w-full overflow-x-auto lg:overflow-x-visible">
          {tabs.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              // The mockup's tabs strip: 13px, the active tab in the
              // foreground weight 600 with the BRAND orange underline.
              className={`px-3.5 py-2 text-[13px] whitespace-nowrap border-b-2 -mb-px ${
                tab === key ? "border-sidebar-primary text-foreground font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              data-doc-tab={key}
            >
              {tabLabel[key]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isInvoice && b.statusChip ? (
            b.statusChip
          ) : start.status ? (
            <span className={`text-[10px] font-semibold px-1.5 py-px rounded ${quoteStatusClasses(start.status)}`}>{quoteStatusLabel(start.status, t)}</span>
          ) : (
            <span className="text-[10px] font-semibold px-1.5 py-px rounded bg-muted text-muted-foreground">{t("app.docBuilder.unsaved", "Not saved yet")}</span>
          )}
          {b.mayCost && (
            <button
              type="button"
              onClick={() => setCostOpen((v) => !v)}
              aria-pressed={costOpen}
              className="inline-flex items-center gap-1.5 border border-border bg-card text-foreground px-3 py-[5px] rounded-full text-[13px] font-semibold"
              data-cost-drawer-toggle
            >
              <TrendingUp size={14} /> {t("app.cost.title", "Cost & margin")}
              {b.estimate?.marginPct != null && Number.isFinite(Number(b.estimate.marginPct)) ? (
                <span className={`text-xs tabular-nums ${Number(b.estimate.marginPct) < 0 ? "text-red-700 dark:text-red-400" : "text-muted-foreground"}`}>
                  {Math.round(Number(b.estimate.marginPct))}%
                </span>
              ) : null}
            </button>
          )}
          {/* Save and Save & send live here from sm up. On a phone the
              dock at the foot already holds both under the thumb, so the
              toolbar keeps only the menu — two Save buttons on one 375px
              screen is the row the owner asked to have thinned. */}
          <div className="hidden sm:flex items-center gap-2">
            <button
              type="button"
              onClick={() => b.handleSave("draft")}
              disabled={Boolean(b.saving) || (!isEdit && (!b.selectedClient || b.scopeGroups.length === 0))}
              className="inline-flex items-center gap-1.5 border border-border bg-card text-foreground px-3 py-[5px] rounded-full text-[13px] font-semibold disabled:opacity-60"
              data-doc-save
            >
              {b.saving === "draft" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {words.saveShort}
            </button>
            <SendMenu
              primary={
                sendable
                  ? {
                      label: words.send,
                      icon: Send,
                      busy: b.saving === "sent",
                      disabled: Boolean(b.saving) || (!isEdit && (!b.selectedClient || b.scopeGroups.length === 0)),
                      onClick: () => b.handleSave("sent"),
                    }
                  : null
              }
              menuLabel={sendable ? t("app.sendMenu.more", "Send…") : t("app.sendMenu.moreDecided", "More…")}
              items={menuItems}
            />
          </div>
          <div className="sm:hidden">
            <SendMenu menuLabel={sendable ? t("app.sendMenu.more", "Send…") : t("app.sendMenu.moreDecided", "More…")} items={menuItems} />
          </div>
        </div>
      </div>

      {notice && (
        <p className="text-sm text-green-800 dark:text-green-300 flex items-center gap-1.5" data-menu-notice>
          <CheckCircle2 size={14} /> {notice}
        </p>
      )}
      {menuError && <p className="text-sm text-red-700 dark:text-red-300">{menuError}</p>}

      {/* ── The same banners the classic layout scrolls to ──────────────── */}
      {/* The invoice's own: the new-version notice, money already paid, the
          change reason, the clocked-hours offer (InvoiceBuilder). */}
      {isInvoice && b.renderBanners ? b.renderBanners() : null}
      {!isInvoice && isEdit && start.status === "accepted" && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          {t("app.quoteEdit.acceptedWarning")}
        </div>
      )}
      {!isInvoice && isEdit && start.quote?.autoEstimated && start.status === "draft" && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl px-4 py-3 text-sm text-amber-900 dark:text-amber-200 space-y-1" data-auto-estimated-banner>
          <p className="font-semibold">{t("app.quoteEdit.autoEstimatedTitle")}</p>
          <p>{t("app.quoteEdit.autoEstimatedBody")}</p>
          {!start.assignedTo && <p>{t("app.quoteEdit.autoEstimatedUnassigned")}</p>}
        </div>
      )}
      {!isInvoice && isEdit && !b.canEditScope && (
        <div className="bg-muted border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground">{t("app.quoteEdit.linesLocked")}</div>
      )}
      {b.conflict && (
        <div ref={b.conflictRef}>
          <StaleWriteBanner
            conflict={b.conflict}
            href={quoteId ? `/app/quotes/${quoteId}` : undefined}
            busy={Boolean(b.saving)}
            onOverwrite={() => b.runSave(b.conflict.action, { confirmed: true, againstVersion: b.conflict.currentUpdatedAt })}
          />
        </div>
      )}
      {b.error && (
        <div ref={b.errorRef} className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {b.error}
        </div>
      )}

      {/* ── Staff strip: who is working it, which language ──────────────── */}
      {!isInvoice && (
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[13px]" data-doc-staff-strip>
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground whitespace-nowrap">{t("app.quoteNew.assignedToHeading", "Assigned to")}</span>
          <select
            value={b.assignedToId}
            onChange={(e) => {
              b.setAssignedToId(e.target.value);
              b.setAssignedToTouched(true);
            }}
            className="border border-border rounded-md px-2 py-1 text-[13px] bg-background text-foreground max-w-[14rem]"
          >
            <option value="">{isEdit ? t("app.quoteNew.unassignedNeedsReview", "Unassigned — needs review") : t("app.quoteNew.meDefault", "Me (default)")}</option>
            {b.teamRoster
              .concat(
                start.assignedTo && !b.teamRoster.some((m) => m.userId === start.assignedTo.id)
                  ? [{ userId: start.assignedTo.id, user: start.assignedTo }]
                  : [],
              )
              .map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user?.name || m.user?.email || t("app.quoteDetail.unnamed")}
                </option>
              ))}
          </select>
        </label>
        {isEdit && (
          <span className="text-[11px] text-muted-foreground">
            {t("app.quoteEdit.languageFixed", { language: b.languageMeta?.nativeName || b.quoteLanguage || b.companyLanguage })}
          </span>
        )}
      </div>
      )}
      {!isInvoice && !isEdit && b.selectedClient && (
        <QuoteLanguageBar language={b.quoteLanguage} onChange={b.setQuoteLanguage} companyDefault={b.companyLanguage} client={b.selectedClient} />
      )}

      {/* ══ Estimate ═══════════════════════════════════════════════════════ */}
      {/* 260px is the mockup's drawer; from xl the column widens to hold
          the crew grid (name · rate · hours · cost) without squeezing its
          boxes, now that the drawer is open by default. */}
      {tab === "estimate" && (
        <div className={`grid gap-3.5 items-start ${b.mayCost && costOpen ? "lg:grid-cols-[minmax(0,1fr)_260px] xl:grid-cols-[minmax(0,1fr)_340px]" : ""}`} data-tab-panel="estimate">
        <div className="space-y-4 min-w-0">
          {/* A painting company's first question (mockup b1) — ABOVE the
              document, before the client and the rooms, in this layout as
              in the classic one. The pick puts the service in the body. */}
          {b.paintingFirst && (
            <EstimateTypeFirst
              categories={b.categories}
              onPickType={addAndOpen(b.addPaintingEstimate)}
              onAddOther={addAndOpen((category, label) => b.addScopeGroup(category, label))}
              documentLanguage={b.quoteLanguage}
            />
          )}
          <DocumentFrame company={company} data-doc-editor>
            <DocumentMasthead
              company={company}
              word={isInvoice ? labels.invoice : labels.quote}
              number={start.quoteNumber}
              numberPlaceholder={t("app.docBuilder.numberOnSave", "Numbered on first save")}
              // The dates under the number (mockup b7) — click to change the
              // expiry. Absent on a create with no expiry: nothing invented.
              meta={meta.length ? meta : [{ label: labels.validUntil, value: t("app.quoteNew.validUntilCleared") }]}
              edit={{
                company: canEditCompany ? () => setEditing((e) => (e === "company" ? null : "company")) : null,
                companyLabel: t("app.docBuilder.editCompany", "Edit company details"),
                meta: () => setEditing((e) => (e === "validUntil" ? null : "validUntil")),
                metaLabel: isInvoice ? t("app.invoiceEdit.dueDate") : t("app.quoteEdit.validUntil"),
              }}
            />
            {editing === "company" && (
              <div className="px-5 sm:px-7 pb-4">
                <CompanyBlockEditor
                  company={company}
                  t={t}
                  onClose={() => setEditing(null)}
                  onSaved={(form) => setCompany((c) => ({ ...(c || {}), ...form }))}
                />
              </div>
            )}
            {editing === "validUntil" && (
              <div className="px-5 sm:px-7 pb-4">
                <InlinePanel title={isInvoice ? t("app.invoiceEdit.dueDate") : t("app.quoteEdit.validUntil")} onClose={() => setEditing(null)} t={t} data-doc-dates-editor>
                  {isInvoice && b.renderDueDate ? b.renderDueDate() : <QuoteTermsFields {...termsProps} only="validUntil" />}
                </InlinePanel>
              </div>
            )}

            <DocumentParties
              label={labels.preparedFor}
              client={b.selectedClient}
              clientAddress={clientAddress}
              jobAddress={
                !isInvoice && b.selectedClient
                  ? { label: labels.jobAddress, value: b.siteAddress, placeholder: t("app.quoteNew.jobAddressPlaceholder", "Start typing the job address…") }
                  : null
              }
              facts={[]}
              clientSlot={
                !b.selectedClient || (!isEdit && editing === "client") ? (
                  <div className="mt-2" data-tour="client-picker">
                    <ClientPicker
                      locked={isEdit}
                      clients={b.clients}
                      selectedClient={b.selectedClient}
                      onSelect={(c) => {
                        b.setSelectedClient(c);
                        b.setClientSearch("");
                        if (c.language) b.setQuoteLanguage(c.language);
                        // A homeowner's job is at their address; a company's is not.
                        b.setSiteAddress(defaultSiteAddressFor(c));
                        setEditing(null);
                        // An invoice's one card opens on its lines the moment
                        // there is somebody to bill.
                        if (isInvoice && b.scopeGroups[0]) setOpenGroup(b.scopeGroups[0].tempId);
                      }}
                      onClear={() => {
                        b.setSelectedClient(null);
                        b.setSiteAddress("");
                      }}
                      search={b.clientSearch}
                      onSearchChange={b.setClientSearch}
                      showNewClient={b.showNewClient}
                      onOpenNewClient={() => b.setShowNewClient(true)}
                      onCloseNewClient={() => b.setShowNewClient(false)}
                      newClient={b.newClient}
                      onNewClientChange={(patch) => b.setNewClient((prev) => ({ ...prev, ...patch }))}
                      onCreateClient={b.handleCreateClient}
                      creating={b.creatingClient}
                      error={b.error}
                    />
                    {b.selectedClient && (
                      <button type="button" onClick={() => setEditing(null)} className="mt-2 text-xs underline underline-offset-2">
                        {t("app.docBuilder.done", "Done")}
                      </button>
                    )}
                  </div>
                ) : null
              }
              edit={{
                client: () => setEditing((e) => (e === "client" ? null : "client")),
                clientLabel: isEdit ? t("app.docBuilder.editContact", "Edit contact details") : t("app.clientPicker.change"),
                jobAddress: () => setEditing((e) => (e === "jobAddress" ? null : "jobAddress")),
                jobAddressLabel: t("app.quoteNew.jobAddress", "Job address"),
                facts: () => setEditing((e) => (e === "validUntil" ? null : "validUntil")),
                factsLabel: t("app.quoteEdit.validUntil"),
              }}
            />
            {editing === "client" && isEdit && b.selectedClient && (
              <div className="px-5 sm:px-7 pb-4">
                {canEditClients ? (
                  <ContactEditor client={b.selectedClient} t={t} onClose={() => setEditing(null)} onSaved={updateStoredClient} />
                ) : (
                  <p className="text-xs text-muted-foreground">{t("app.docBuilder.contactLocked", "Your access level lets you view clients, not edit them.")}</p>
                )}
              </div>
            )}
            {editing === "client" && !isEdit && b.selectedClient && canEditClients && (
              <div className="px-5 sm:px-7 pb-4">
                <ContactEditor client={b.selectedClient} t={t} onClose={() => setEditing(null)} onSaved={updateStoredClient} />
              </div>
            )}
            {editing === "jobAddress" && b.selectedClient && (
              <div className="px-5 sm:px-7 pb-4">
                <JobAddressField client={b.selectedClient} value={b.siteAddress} onChange={b.setSiteAddress} />
                <button type="button" onClick={() => setEditing(null)} className="mt-2 text-xs underline underline-offset-2">
                  {t("app.docBuilder.done", "Done")}
                </button>
              </div>
            )}

            {/* ── The body: one card per service ─────────────────────────── */}
            <section className="px-5 sm:px-7 py-5 space-y-3" data-doc-body>
              {!isInvoice && !isEdit && b.scopeGroups.length === 0 && (
                <TemplatePicker
                  onApply={(tpl) => {
                    b.setScopeGroups(tpl.groups.map((g) => b.groupFromStored({ ...g, id: null }, [], t("app.quoteEdit.scopeFallback"))));
                    if (tpl.notes && !b.notes) b.setNotes(tpl.notes);
                    if (tpl.processNotes) b.setProcessNotes(tpl.processNotes);
                    if (tpl.language) b.setQuoteLanguage(tpl.language);
                  }}
                />
              )}

              {b.scopeGroups.map((group, groupIndex) => {
                const locked = group.imported || !b.canEditScope;
                const overrides = b.rateOverridesFor(group.categoryId);
                const language = b.quoteLanguage || b.companyLanguage;
                // The lines as they will be STORED — derived now for a group
                // added this session, the stored ones for a persisted group —
                // then through the same visibility rule every reader applies.
                const asStored = group.persisted ? group : { ...group, lineItems: scopeGroupPayload(group, overrides, language).lineItems };
                const paint = !group.persisted && isPaintAreas(group) && hasTakeoff(group.categoryKey);
                const book = paint ? getPriceBook(group.categoryKey, overrides) : null;
                // Which of the stored lines the room cards already drew.
                const roomLines = paint
                  ? new Set(scopeGroupPayload({ ...group, lineItems: [] }, overrides, language).lineItems.map((l) => l.description))
                  : null;
                const lines = visibleLineItems(asStored).filter((l) => !roomLines || !roomLines.has(l.description));
                const extras = paint ? tradeOptionalExtras(group.categoryKey, group.takeoff, overrides) : [];
                const isOpen = openGroup === group.tempId;
                // A persisted quote's stored offers under the room they name
                // (QuoteAddOn.areaLabel) — printed here so the estimator sees
                // the options the client will tick.
                const groupAddOns = group.persisted
                  ? storedAddOns.filter((a) => a.source === "takeoff" && lines.some((l) => a.areaLabel && String(l.description).startsWith(`${a.areaLabel} —`)))
                  : [];
                return (
                  <div
                    key={group.tempId}
                    ref={(el) => (groupRefs.current[group.tempId] = el)}
                    // The new-invoice tour's "List the work" step (tours.js
                    // invoice-new-v1). An invoice is drawn with exactly one
                    // lines group, present from the first render, so the
                    // anchor is never absent on a blank invoice.
                    data-tour={isInvoice && groupIndex === 0 ? "invoice-items" : undefined}
                  >
                    <DocumentScopeGroup
                      label={group.label}
                      index={b.scopeGroups.length > 1 ? groupIndex : null}
                      subtotal={b.groupTotal(group)}
                      lines={lines}
                      money={money}
                      // The trade's colour, as ScopeGroupCard, the approval
                      // page and the PDF resolve it — one resolver.
                      accent={resolveServiceContent(group.categoryKey, b.wordingOverrideFor(group.categoryId), group.takeoff || null).accent || null}
                      data-doc-group-key={group.categoryKey || ""}
                      edit={{
                        group: locked ? null : () => toggleGroup(group.tempId),
                        groupLabel: t("app.docBuilder.editService", "Open this service"),
                        line: locked
                          ? null
                          : (i, item) => {
                              if (isTextLine(item)) {
                                // Position in the group's OWN lines, not in
                                // the filtered view: the derived lines above
                                // it are not in group.lineItems.
                                const own = (group.lineItems || []).indexOf(item);
                                if (own >= 0) setEditing({ line: { group: group.tempId, i: own } });
                                return;
                              }
                              setOpenGroup(group.tempId);
                            },
                        lineLabel: t("app.docBuilder.editLine", "Edit this line"),
                      }}
                      headExtra={
                        !locked && !isInvoice ? (
                          <button
                            type="button"
                            onClick={() => b.removeScopeGroup(group.tempId)}
                            aria-label={t("app.action.remove", "Remove")}
                            className="text-muted-foreground hover:text-red-600 p-1 rounded"
                          >
                            <Trash2 size={13} />
                          </button>
                        ) : null
                      }
                    >
                      {paint && (
                        <PaintRooms
                          group={group}
                          book={book}
                          money={money}
                          extras={extras}
                          t={t}
                          onOpenArea={(index) => {
                            setOpenGroup(group.tempId);
                            setFocusArea(index);
                          }}
                        />
                      )}
                      {groupAddOns.length > 0 && (
                        <div className="py-1" data-doc-stored-options>
                          {groupAddOns.map((a) => (
                            <div key={a.id} className="flex justify-between gap-3 text-sm py-1 text-muted-foreground border-b border-border last:border-0" data-doc-option>
                              <span className="min-w-0 flex items-center gap-2">
                                <span className="h-3.5 w-3.5 rounded border border-border shrink-0" aria-hidden="true" />
                                {t("app.docBuilder.optionPrefix", "Option:")} {a.description}
                              </span>
                              <span className="tabular-nums shrink-0">+ {money(a.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {editing?.line?.group === group.tempId && group.lineItems?.[editing.line.i] && (
                        <TextLineEditor
                          item={group.lineItems[editing.line.i]}
                          t={t}
                          onChange={(field, value) => b.updateLineItem(group.tempId, editing.line.i, field, value)}
                          onRemove={() => {
                            b.removeLineItem(group.tempId, editing.line.i);
                            setEditing(null);
                          }}
                          onClose={() => setEditing(null)}
                        />
                      )}
                      {group.imported && (
                        <p className="text-[11px] text-muted-foreground py-2">{t("app.quoteEdit.importedLocked")}</p>
                      )}
                      {!locked && (
                        <div className="flex items-center gap-3 py-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => toggleGroup(group.tempId)}
                            aria-expanded={isOpen}
                            className="text-xs font-medium text-foreground inline-flex items-center gap-1"
                            data-doc-group-toggle
                          >
                            <Pencil size={12} /> {isOpen ? t("app.docBuilder.closeEditor", "Close") : isInvoice ? t("app.invoiceBuilder.editLines", "Edit lines") : t("app.docBuilder.openEditor", "Edit lines & measurements")}
                          </button>
                          {/* Where a line item is added: inside the service it
                              belongs to, one press from the card. It opens the
                              same line library the editor's own button does —
                              text blocks, the trade's extras, Products &
                              Services with their templates, a custom line —
                              not a second picker. */}
                          <button
                            type="button"
                            onClick={() => {
                              setOpenGroup(group.tempId);
                              setLibraryFocus({ tempId: group.tempId });
                            }}
                            className="text-xs font-medium text-foreground inline-flex items-center gap-1"
                            data-doc-add-line
                          >
                            <Plus size={12} /> {t("app.docBuilder.addLineItem", "Add line item")}
                          </button>
                        </div>
                      )}
                      {isOpen && (
                        <div className="border-t border-border pt-3 pb-2 space-y-4" data-doc-group-editor>
                          {b.renderGroupEditor(group)}
                        </div>
                      )}
                    </DocumentScopeGroup>
                  </div>
                );
              })}

              {/* Stored offers that name no room, or a room this quote no
                  longer has: the foot of the document, as the client's
                  page draws them. */}
              {storedAddOns.filter((a) => a.source !== "takeoff" || !b.scopeGroups.some((g) => (g.lineItems || []).some((l) => a.areaLabel && String(l.description).startsWith(`${a.areaLabel} —`)))).length > 0 && (
                <div className="rounded-xl border border-border px-4 py-2" data-doc-foot-options>
                  <p className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground py-1">{t("app.quoteDetail.optionalExtras", "Optional extras")}</p>
                  {storedAddOns
                    .filter((a) => a.source !== "takeoff" || !b.scopeGroups.some((g) => (g.lineItems || []).some((l) => a.areaLabel && String(l.description).startsWith(`${a.areaLabel} —`))))
                    .map((a) => (
                      <div key={a.id} className="flex justify-between gap-3 text-sm py-1 text-muted-foreground border-b border-border last:border-0" data-doc-option>
                        <span className="min-w-0 flex items-center gap-2">
                          <span className="h-3.5 w-3.5 rounded border border-border shrink-0" aria-hidden="true" />
                          {a.description}
                        </span>
                        <span className="tabular-nums shrink-0">+ {money(a.amount)}</span>
                      </div>
                    ))}
                </div>
              )}

              {/* ── Add another service ─────────────────────────────────────
                  A quote holds as many scope groups as the job has trades —
                  refinishing AND refacing AND the countertop, one document,
                  one total — and the same service may appear twice (a painter
                  quoting interior and exterior: "it's the same job, just a
                  different scoped item"). Nothing here dedupes.

                  This was a disclosure that started closed, so on any quote
                  that already had one service the other trades were behind a
                  click nobody found, and the owner reported he could not put
                  more than one service on a quote. The tiles are a compact
                  row now — visible, after the last group, the way the classic
                  layout's picker is always on the page. The full card is kept
                  for the empty quote, where it is the first thing to do. */}
              {/* Services ONLY, as cards (owner, 2026-09-22): the pill row
                  was headed "Add a service, area or line item" and offered
                  services alone, so the heading promised two things the row
                  could not do. A line item belongs to a service and is added
                  inside it ("Add line item" on each card above). The card
                  shape carries the service's one-line description, its price
                  and, when the company's own service has an estimate
                  template, "Add with its template lines". The template add
                  opens the new service like a tile add does. */}
              {!isInvoice && b.canEditScope && !b.paintingFirst && (
                <div className="pt-1" data-doc-add-service>
                  <ServiceTiles
                    variant="card"
                    categories={b.categories}
                    onAdd={addAndOpen((category, label) => b.addScopeGroup(category, label))}
                    documentLanguage={b.quoteLanguage}
                    details={
                      b.serviceCardDetails
                        ? (cat) => {
                            const d = b.serviceCardDetails(cat);
                            return { ...d, templates: d.templates.map((x) => ({ ...x, onAdd: addAndOpen(x.onAdd) })) };
                          }
                        : null
                    }
                  />
                  {b.scopeGroups.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {t(
                        "app.docBuilder.addAnotherHint",
                        "Each one becomes its own scope on this quote, with its own measurements and options — the same service can be added twice. To add a room or a line to a service already here, open it above.",
                      )}
                    </p>
                  )}
                </div>
              )}
              {!isInvoice && isEdit && b.scopeGroups.length === 0 && !b.canEditScope && (
                <p className="text-sm text-muted-foreground text-center py-6">{t("app.quoteEdit.noScopeGroups")}</p>
              )}
            </section>

            <DocumentTotals
              rows={totalRows}
              total={{ label: b.taxEnabled ? t("app.quoteNew.totalInclTax") : t("app.quoteNew.totalNoTax"), value: money(b.total) }}
              edit={{
                row: (key) => {
                  if (key === "discount" || key === "tax") setEditing((e) => (e === key ? null : key));
                },
              }}
            >
              {(editing === "discount" || editing === "tax") && (
                <InlinePanel title={editing === "discount" ? t("app.quoteEdit.discount") : t("app.quoteEdit.taxRate")} onClose={() => setEditing(null)} t={t}>
                  <QuoteTermsFields {...termsProps} only={editing} startChanging />
                </InlinePanel>
              )}
            </DocumentTotals>

            {/* ── What happens next ───────────────────────────────────────
                Quote.processNotes. It prints on the client's proposal and in
                the covering email (lib/documentSections/ProcessStepsSection,
                which the section registry orders BEFORE the notes) — so it
                belongs here, between the totals and the notes, where the
                client reads it.

                The classic builder has always had this box. The document
                layout only offered it on the Presentation tab, two clicks
                from the document, so the review's most common finding —
                "Nothing about what happens next: timeline, site access,
                payment schedule, warranty, who to call" — had nowhere
                obvious to be answered. The editor is the SAME closure the
                classic layout renders, b.renderProcessNotes, "Save as
                default" and all; not a second copy. b.readiness reads
                processNotes live, so the finding clears as it is typed,
                before any save. */}
            {!isInvoice && (
            <div className="px-5 sm:px-7 pt-5" data-doc-process>
              <Editable onClick={() => setEditing((e) => (e === "process" ? null : "process"))} label={t("app.quoteEdit.whatHappensNext")} block>
                <p className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">{t("app.quoteEdit.whatHappensNext")}</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {b.processNotes || <span className="text-muted-foreground italic">{t("app.quoteEdit.processNotesPlaceholder")}</span>}
                </p>
              </Editable>
              {editing === "process" && (
                <InlinePanel title={t("app.docBuilder.processPanel", "The client reads this under the price")} onClose={() => setEditing(null)} t={t} data-doc-process-editor>
                  {b.renderProcessNotes()}
                </InlinePanel>
              )}
            </div>
            )}

            {/* Notes — the client-facing ones, where the PDF prints them
                (after the totals, lib/documentSections/NotesSection). */}
            <div className="px-5 sm:px-7 pb-5" data-doc-notes>
              <Editable onClick={() => setEditing((e) => (e === "notes" ? null : "notes"))} label={t("app.field.notes")} block>
                <p className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">{labels.notes}</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {b.notes || <span className="text-muted-foreground italic">{t("app.quoteNew.notesPlaceholder")}</span>}
                </p>
              </Editable>
              {editing === "notes" && (
                <InlinePanel title={t("app.field.notes")} onClose={() => setEditing(null)} t={t}>
                  <textarea
                    value={b.notes}
                    onChange={(e) => b.setNotes(e.target.value)}
                    rows={3}
                    placeholder={t("app.quoteNew.notesPlaceholder")}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none bg-background text-foreground"
                  />
                </InlinePanel>
              )}
            </div>
          </DocumentFrame>

          {b.cf.hasFields && (
            <div className="bg-card border border-border rounded-xl p-5">
              <CustomFieldInputs cf={b.cf} columns={2} />
            </div>
          )}

          {/* Photos and videos from the site visit. Beside the document
              rather than in it: they are not printed on the client's copy —
              they travel to the job and the invoice, and the review's "No
              photos" finding reads the same Quote.clientPhotos this writes
              (lib/quotes/completeness.js). Same MediaUploader and same
              /api/upload as the classic layout — b.renderPhotosBox, one
              closure, moved off the Presentation tab where an estimator
              writing an estimate never went. */}
          {b.renderPhotosBox()}

          {!isInvoice && (
          <div className="bg-card border border-border rounded-xl px-5 pb-1">
            <QuoteReadinessBlock readiness={b.readiness} readinessItems={b.readinessItems} showReviewHint={!isEdit} />
          </div>
          )}

          {b.taxAssumed || b.taxCaution ? (
            <div className="space-y-2">
              {b.taxAssumed && (
                <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg px-2.5 py-2">
                  <span className="font-semibold">{t("app.tax.assumed.badge")}</span> {b.taxAssumed}
                </p>
              )}
              {b.taxCaution && (
                <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg px-2.5 py-2">
                  {b.taxCaution}
                </p>
              )}
            </div>
          ) : null}

          {b.renderSuggestAddOns()}
        </div>
        {/* The drawer as a column, from lg up (mockup `.drawer`): beside the
            document, never inside it. Below lg the same panel is the sheet
            further down. */}
        {b.mayCost && costOpen && (
          <aside className="hidden lg:block sticky top-[64px] rounded-[10px] border border-border bg-card p-3 text-xs space-y-2" data-cost-drawer-column>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("app.docBuilder.internalOnly", "Internal — never on the document")}</span>
              <button type="button" onClick={() => setCostOpen(false)} className="p-1 rounded text-muted-foreground hover:text-foreground" aria-label={t("app.docBuilder.closeDrawer", "Close")}>
                <X size={14} />
              </button>
            </div>
            {b.renderCostMarginPanel()}
          </aside>
        )}
        </div>
      )}

      {/* ══ Presentation ═══════════════════════════════════════════════════ */}
      {tab === "presentation" && (
        <div className="space-y-4" data-tab-panel="presentation">
          {isEdit && quoteId ? (
            <div className="bg-card border border-border rounded-xl p-5">
              <PresentationPanel quoteId={quoteId} editable={b.OPEN_STATUSES.includes(start.status)} />
            </div>
          ) : (
            <div className="bg-muted border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground">
              {t("app.docBuilder.presentationAfterSave", "The proposal's sections — your story, before & after photos, documents — are set once the quote is saved.")}
            </div>
          )}
          {/* "What happens next" and the site-visit photos used to live here.
              They moved to the Estimate tab — into the document and beside it
              — because that is where they are written and where the review
              asks for them. Rendering them twice would be two boxes writing
              one field, which is how a builder ends up with a box nobody
              trusts. */}
        </div>
      )}

      {/* ══ Work order ═════════════════════════════════════════════════════ */}
      {tab === "workorder" && <WorkOrderTab b={b} t={t} />}

      {/* ══ Notes (internal) ═══════════════════════════════════════════════ */}
      {tab === "notes" && (
        <div className="space-y-4" data-tab-panel="notes">
          <div ref={b.reviewNotesRef} className="bg-card border border-amber-300 dark:border-amber-800 rounded-xl p-5">
            <h2 className="font-semibold text-foreground mb-1">{t("app.quoteNew.reviewNotes")}</h2>
            <p className="text-xs text-muted-foreground mb-2">{t("app.quoteNew.reviewNotesHint")}</p>
            <textarea
              value={b.reviewNotes}
              onChange={(e) => b.setReviewNotes(e.target.value)}
              rows={4}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none bg-background text-foreground"
            />
          </div>
          {isEdit && start.quote && <SiteVisitPanel quoteId={quoteId} quote={start.quote} />}
        </div>
      )}

      </div>

      {/* ── Cost & margin as a bottom sheet below lg — staff only, never in
          the document. From lg up the column beside the document draws it. */}
      {b.mayCost && costOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" data-cost-drawer>
          <button type="button" aria-label={t("app.docBuilder.closeDrawer", "Close")} onClick={() => setCostOpen(false)} className="absolute inset-0 bg-black/30" />
          {/* A right-hand panel from sm up; a bottom sheet on a phone. */}
          <div className="relative mt-auto w-full max-h-[85vh] overflow-y-auto bg-background border-t border-border rounded-t-2xl p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("app.docBuilder.internalOnly", "Internal — never on the document")}</span>
              <button type="button" onClick={() => setCostOpen(false)} className="p-1 rounded text-muted-foreground hover:text-foreground" aria-label={t("app.docBuilder.closeDrawer", "Close")}>
                <X size={16} />
              </button>
            </div>
            {b.renderCostMarginPanel()}
          </div>
        </div>
      )}

      <QuoteActionsDock
        total={b.total}
        taxEnabled={b.taxEnabled}
        money={money}
        saving={b.saving}
        disabled={isEdit ? false : !b.selectedClient || b.scopeGroups.length === 0}
        primaryLabel={words.save}
        primaryLabelShort={words.saveShort}
        onSaveDraft={() => b.handleSave("draft")}
        onSaveAndSend={sendable ? () => b.handleSave("sent") : null}
        onSaveAndReview={isEdit ? null : () => b.handleSave("review")}
        cancelHref={isEdit ? backHref : null}
      />

      {b.renderSendConfirm()}

      {!isInvoice && isEdit && quoteId && (
        <>
          <ShareWithStaffModal
            isOpen={shareOpen}
            onClose={() => setShareOpen(false)}
            quoteId={quoteId}
            quoteNumber={start.quoteNumber}
            onShared={() => setNotice(t("app.sendMenu.shared", "Shared in your team chat."))}
          />
          <SaveAsTemplateModal
            isOpen={templateOpen}
            onClose={() => setTemplateOpen(false)}
            quoteId={quoteId}
            suggestedName={b.scopeGroups.map((g) => g.label).filter(Boolean).join(" + ")}
            onSaved={(row) => setNotice(t("app.sendMenu.templateSaved", "Saved as template “{name}”. Pick it on the next new quote.", { name: row.name }))}
          />
        </>
      )}

      {!isInvoice && !isEdit && <HelpButton onClick={() => b.setShowTour(true)} />}
      {!isInvoice && !isEdit && b.showTour && <OnboardingTour steps={b.TOUR_STEPS} storageKey="quote-builder" onFinish={() => b.setShowTour(false)} />}
    </div>
  );
}
