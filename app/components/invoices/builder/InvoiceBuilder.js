// app/components/invoices/builder/InvoiceBuilder.js
//
// The invoice screen — ONE of them, used by /app/invoices/new and by
// /app/invoices/[id]/edit — drawn by the same document-shaped builder a
// quote is drawn by.
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// The owner (2026-09-23): "creating a new invoice should be the same as
// creating a new quote, except that it is an invoice… and it should also
// have the same features, AI review and AI deep read." The two invoice forms
// were standalone pages — a long form each, one for new and one for edit —
// with their own line table, their own totals card, their own tax block and
// no review at all. They are kept, verbatim, behind ?layout=classic on the
// same two routes until this is proven; this is the document they become.
//
// ── What this file is ───────────────────────────────────────────────────────
//
// QuoteBuilder.js's shape, for an invoice: a loader (`InvoiceBuilder`) that
// fetches, and a form (`InvoiceBuilderForm`) that takes it all as props and
// hands DocumentBuilder the one object `b` it draws from, with
// kind="invoice". The state is the two old forms' state, unified: the
// client, the lines, the due date, the discount (the edit form's), the tax
// switch and rate (both), the clocked-hours offer (the new form's, from a
// job), the change reason (the edit form's, once sent), the photos, the
// custom fields, the cost panel. The bodies it posts are the two forms'
// literals, as pure functions in lib/invoices/builderRequest.js, and
// scripts/check-invoice-builder.mjs holds the md5 that says so.
//
// ── What the two forms did that is kept exactly ─────────────────────────────
//
//   • the offline path: no signal, or a photo picked offline, and the whole
//     save goes into the phone's queue (lib/offline/queue.js) with no money
//   • the labour line: ids and a rate key, priced by the server; the line on
//     screen is a preview and is not posted
//   • the edit form's unrounded-rate rule: the tax recomputes from the rate
//     the invoice was WRITTEN with until somebody types a rate
//   • a non-draft edit mints a new version and needs a change reason
//   • the cost panel's seed rule (useInvoiceCosting.js), and a save that
//     posts no `costing` key at all for someone without the toggle
//
// ── What is new ─────────────────────────────────────────────────────────────
//
//   • the document itself, with the client and the tax opened in place
//   • "Save & send" confirms the recipient first, as the quote's does — the
//     old button emailed on the press with no dialog
//   • a discount box on a new invoice (the route always stored the field)
//   • lines from the products catalogue, with Product.costPrice as the unit
//     cost, and the cost / markup popover on every line
//   • the Cost & margin drawer, open beside the document from lg up
//   • AI review (free) and the deep photo read (paid), on a saved invoice
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, WifiOff, X, History, Download, Loader2 } from "lucide-react";

import MediaUploader from "@/app/components/MediaUploader";
import SendConfirmModal from "@/app/components/SendConfirmModal";
import CostMarginPanel from "@/app/components/quotes/builder/CostMarginPanel";
import LineItemsTable from "@/app/components/quotes/builder/LineItemsTable";
import DocumentBuilder from "@/app/components/quotes/builder/DocumentBuilder";
import InvoiceReviewPanel from "@/app/components/invoices/InvoiceReviewPanel";
import { useInvoiceCosting } from "@/app/components/invoices/useInvoiceCosting";
import { useCustomFields } from "@/app/components/customFields/CustomFieldsBox";
import { useOffline } from "@/app/components/offline/OfflineShell";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { usePermissions, useHasLevel, useHasToggle } from "@/app/providers/PermissionProvider";
import { useTranslation } from "@/app/hooks/useTranslation";
import { hasToggle } from "@/lib/permissions/enforce";
import { fetchJson } from "@/lib/fetchJson";
import { jsonBody } from "@/lib/jsonBody";
import { showToast } from "@/lib/toast";
import { isNetworkFailure } from "@/lib/offline/queue";
import { planRequiredFrom } from "@/lib/signup/planRequired";
import { formatAppMoney } from "@/lib/format/money";
import { explainTaxSource, renderTaxNote } from "@/lib/tax/resolveTaxRate";
import { resolveDocumentTax } from "@/lib/tax/documentTax";
import { taxLineHeadline, taxLineSource, taxLineResolved, taxLineUnresolvedHint } from "@/lib/tax/taxLine";
import { readTaxResolution } from "@/lib/tax/taxResolution";
import { taxPlaceOf } from "@/lib/quotes/taxPlace";
import { quoteTotals, round2 } from "@/lib/quotes/totals";
import { applyLineItemEdit } from "@/lib/quotes/builderPayload";
import { lineFromProduct } from "@/lib/quotes/lineDetail";
import { invoiceCostSummary } from "@/lib/costing/actualJobCost";
import { lineItemCostOf } from "@/lib/costing/lineItemCost";
import { invoiceCreateBody, invoicePatchBody, invoiceOfflinePayload } from "@/lib/invoices/builderRequest";
import { invoiceStatusPresentation, invoiceStatusClasses } from "@/lib/invoices/statusPresentation";
import { downloadInvoicePdf } from "@/lib/invoices/clientActions";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
// Same target the classic cost card scored against. A job is not scored
// against a different bar because it reached the invoice stage.
const MARGIN_TARGET = 30;
const blankLine = () => ({ description: "", quantity: 1, unit: "flat", rate: 0, amount: 0 });
/** The one card an invoice is — its lines are the document. */
const LINES_GROUP_ID = "invoice-lines";

/**
 * Stored invoice lines → the rows the table edits.
 *
 * Two shapes exist in the column. Everything written since the builder's
 * line table has `description / quantity / rate / amount`; a demo seed and
 * the oldest imports carry `name / unitPrice / total`. The edit form spread
 * the row and overwrote quantity, rate and amount, which read a legacy row
 * as $0 — this reads the legacy keys as the fallback and keeps every key,
 * so nothing a row carried is dropped by opening it.
 */
export function invoiceLinesFromStored(stored) {
  return (Array.isArray(stored) ? stored : [])
    .filter((li) => li && typeof li === "object")
    .map((li) => {
      const quantity = num(li.quantity) || 1;
      const amount = li.amount != null ? num(li.amount) : num(li.total);
      const rate =
        li.rate != null && li.rate !== ""
          ? num(li.rate)
          : li.unitPrice != null
            ? num(li.unitPrice)
            : round2(amount / Math.max(quantity, 1));
      return {
        ...li,
        description: li.description ?? li.name ?? "",
        quantity,
        rate,
        amount,
      };
    });
}

/**
 * Everything the form starts from, in one shape, whichever mode.
 *
 * Absent stays absent: a create has no client, no number and no status.
 */
export function initialStateFromInvoice(invoice) {
  if (!invoice) {
    return {
      id: null,
      invoiceNumber: null,
      status: null,
      isDraft: true,
      client: null,
      lineItems: [blankLine()],
      notes: "",
      clientPhotos: [],
      dueDate: "",
      discount: "",
      taxEnabled: true,
      exactTaxRate: null,
      taxResolution: null,
      version: 1,
      amountPaid: 0,
      language: null,
      invoice: null,
    };
  }
  const subtotal = num(invoice.subtotal);
  const discount = num(invoice.discount);
  const base = subtotal - discount;
  // The rate the invoice was WRITTEN with, unrounded — see exactTaxRate in
  // the form. Recomputing the tax from a rate rounded for display moved two
  // cents on an invoice nobody edited the tax on.
  const exact = base > 0 ? (num(invoice.tax) / base) * 100 : 0;
  const lines = invoiceLinesFromStored(invoice.lineItems);
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber || null,
    status: invoice.status || null,
    isDraft: invoice.status === "draft",
    client: invoice.client || null,
    lineItems: lines.length ? lines : [blankLine()],
    notes: invoice.notes || "",
    clientPhotos: Array.isArray(invoice.clientPhotos) ? invoice.clientPhotos : [],
    dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().slice(0, 10) : "",
    discount: discount ? String(discount) : "",
    // The stored flag, `!== false` so a row from before the column reads as on.
    taxEnabled: invoice.taxEnabled !== false,
    exactTaxRate: exact,
    taxResolution: readTaxResolution(invoice.taxResolution),
    version: invoice.version || 1,
    amountPaid: num(invoice.amountPaid),
    language: invoice.language || null,
    invoice,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// The loader
// ───────────────────────────────────────────────────────────────────────────

export default function InvoiceBuilder({ mode = "create", invoiceId = null, clientId = null, jobId: jobIdProp = null }) {
  const { t } = useTranslation();
  // The same grid question POST /api/invoices and PATCH /api/invoices/[id]
  // ask (invoices: view_create_edit, showPricing) — refused before the work,
  // not after it, for the reason QuoteBuilder gives.
  const canWrite = useHasLevel("invoices", "view_create_edit");
  const canSeePrices = useHasToggle("showPricing");
  const [bootstrap, setBootstrap] = useState(null);
  const [initial, setInitial] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // What the URL asked for — the client and the job — arrive as props
        // from the new-invoice page, which reads them with useSearchParams as
        // the old form did. Not read here: one component serves two routes,
        // and the edit route has never called that hook.
        const preselectedClientId = mode === "create" ? clientId : null;
        const jobId = mode === "create" ? jobIdProp : null;

        const [clientsData, businessInfo, productsData, invoiceData] = await Promise.all([
          fetchJson("/api/clients"),
          fetchJson("/api/settings/business-info"),
          // Optional: the builder works without the catalogue.
          fetch("/api/products").then((r) => (r.ok ? r.json() : [])).catch(() => []),
          mode === "edit" && invoiceId ? fetchJson(`/api/invoices/${invoiceId}`) : Promise.resolve(null),
        ]);
        if (cancelled) return;

        const clients = Array.isArray(clientsData) ? clientsData : [];
        const base = initialStateFromInvoice(invoiceData);

        // The clocked-hours offer, when the builder was opened from a job.
        // Best effort, as before: a job with no clock-ins leaves the offer
        // out rather than the page.
        let labourOffer = null;
        if (jobId) {
          try {
            labourOffer = await fetchJson(`/api/invoices/labour-line?jobId=${encodeURIComponent(jobId)}`);
          } catch {
            labourOffer = null;
          }
        }
        if (cancelled) return;

        let client = base.client;
        if (mode === "create") {
          const wanted = preselectedClientId || labourOffer?.job?.clientId || null;
          client = wanted ? clients.find((c) => c.id === wanted) || null : null;
        }

        setBootstrap({
          clients,
          products: Array.isArray(productsData) ? productsData : [],
          company: businessInfo && typeof businessInfo === "object" ? businessInfo : null,
          companyCurrency: businessInfo?.currency || null,
          companyLanguage: businessInfo?.defaultLanguage || "en",
          // The same shape the quote builder hands the resolver, so an
          // invoice and the quote it bills cannot disagree about the rate.
          taxConfig: {
            taxRate: num(businessInfo?.taxRate),
            autoApplyLocalTax: Boolean(businessInfo?.autoApplyLocalTax),
            taxMode: businessInfo?.taxMode || null,
            taxRates: Array.isArray(businessInfo?.taxRates) ? businessInfo.taxRates : [],
            country: businessInfo?.country || null,
            province: businessInfo?.province || null,
            vatRegistered: businessInfo?.vatRegistered ?? null,
            usTaxOverrides: businessInfo?.usTaxOverrides || null,
          },
          jobId: jobId || null,
          labourOffer,
        });
        setInitial({ ...base, client });
      } catch (err) {
        if (!cancelled) setLoadError(err?.message || t(mode === "edit" ? "app.invoiceEdit.loadError" : "app.invoiceNew.createError"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, invoiceId, clientId, jobIdProp]);

  if (!canWrite || !canSeePrices) {
    return (
      <div className="p-4 sm:p-6 max-w-lg mx-auto">
        <div className="bg-muted border border-border rounded-xl p-5 text-sm text-muted-foreground">
          {canWrite
            ? t("app.access.pricingHidden", "Pricing is hidden by your access level. Ask an owner or admin if you need to see it.")
            : t("app.access.cannotCreateInvoice", "Your access level lets you view invoices, not create them. Ask an owner or admin if you need to write one.")}
        </div>
      </div>
    );
  }

  if (loadError && !initial) {
    return (
      <div className="p-4 sm:p-6 max-w-lg mx-auto">
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-5 text-sm text-red-700 dark:text-red-300">
          {loadError}
        </div>
      </div>
    );
  }

  if (!bootstrap || !initial) {
    return <div className="p-4 sm:p-6 max-w-4xl mx-auto animate-pulse h-96 bg-accent rounded-xl" />;
  }

  return <InvoiceBuilderForm mode={mode} invoiceId={invoiceId} bootstrap={bootstrap} initial={initial} />;
}

// ───────────────────────────────────────────────────────────────────────────
// The screen
// ───────────────────────────────────────────────────────────────────────────

export function InvoiceBuilderForm({ mode = "create", invoiceId = null, bootstrap, initial }) {
  const { t, language } = useTranslation();
  const router = useRouter();
  const caller = usePermissions();
  const settingsAccess = useSettingsAccess();
  const offline = useOffline();
  const online = typeof navigator === "undefined" ? true : navigator.onLine !== false;
  const isEdit = mode === "edit";

  const boot = bootstrap || {};
  const start = initial || initialStateFromInvoice(null);
  const products = Array.isArray(boot.products) ? boot.products : [];
  const companyCurrency = boot.companyCurrency ?? null;
  const companyLanguage = boot.companyLanguage || "en";
  // A saved invoice's own language (fixed at creation, non-negotiable #6);
  // a new one is written in the language of the person raising it, which
  // is what the old form posted.
  const documentLanguage = start.language || language || companyLanguage;
  const money = (n) => formatAppMoney(n, companyCurrency, language);

  // The company's own extra boxes for an invoice — saved against the id the
  // POST mints, before any send, so a PO number reaches the PDF.
  const cf = useCustomFields("invoice", invoiceId);

  // ── Client ───────────────────────────────────────────────────────────────
  const [clients, setClients] = useState(() => (Array.isArray(boot.clients) ? boot.clients : []));
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState(start.client || null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [newClient, setNewClient] = useState({
    type: "individual",
    name: "",
    language: null,
    contactName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
    county: "",
    province: "",
    country: "",
  });

  // ── Lines, notes, photos, dates ──────────────────────────────────────────
  const [lineItems, setLineItems] = useState(start.lineItems);
  const [notes, setNotes] = useState(start.notes || "");
  const [clientPhotos, setClientPhotos] = useState(start.clientPhotos || []);
  const [dueDate, setDueDate] = useState(start.dueDate || "");
  const [discount, setDiscount] = useState(start.discount ?? "");
  const [changeReason, setChangeReason] = useState("");

  // ── Tax ──────────────────────────────────────────────────────────────────
  const [taxEnabled, setTaxEnabled] = useState(start.taxEnabled !== false);
  // The box: rounded to four decimals on an edit so a reader sees "13" and
  // not "12.999812"; the arithmetic below reads exactTaxRate until typed.
  const [taxRate, setTaxRate] = useState(isEdit ? +num(start.exactTaxRate).toFixed(4) : 0);
  const [taxRateTouched, setTaxRateTouched] = useState(false);
  const [taxResult, setTaxResult] = useState(null);
  const [taxAssumed, setTaxAssumed] = useState("");
  const [taxNote, setTaxNote] = useState("");
  const [taxCaution, setTaxCaution] = useState("");

  // ── The clocked-hours line (create, from a job) ──────────────────────────
  const labourOffer = boot.labourOffer || null;
  const [labourRateKey, setLabourRateKey] = useState(() => labourOffer?.rates?.[0]?.key || "");
  const [labour, setLabour] = useState(null);
  const [labourDismissed, setLabourDismissed] = useState(false);

  // ── Cost & margin (internal, never client-facing) ────────────────────────
  //
  // Loaded at the top of the screen, not when the drawer opens: the seed
  // from a job's timesheets has to be on the invoice whether or not anybody
  // looks at the drawer (useInvoiceCosting.js).
  const [costing, setCosting] = useState(null);
  const { boot: costBoot, state: costState } = useInvoiceCosting(isEdit ? invoiceId : null, setCosting);
  const mayCost = (caller ? hasToggle(caller, "jobCosting") : true) && costState !== "denied";

  // ── Page state ───────────────────────────────────────────────────────────
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const errorRef = useRef(null);
  const [pendingSend, setPendingSend] = useState(null);
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);

  // Arrived from "Save & review": run the review once, on arrival, and strip
  // the flag so a refresh does not spend tokens on a second review.
  const [autoReview, setAutoReview] = useState(false);
  useEffect(() => {
    if (!isEdit || typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("review")) return;
    setAutoReview(true);
    window.history.replaceState(null, "", window.location.pathname);
  }, [isEdit]);

  // ── Tax: resolved live on a create, recorded on an edit ──────────────────
  useEffect(() => {
    if (isEdit) return;
    const config = boot.taxConfig;
    if (!config) return;
    const result = resolveDocumentTax({
      company: config,
      taxRates: config.taxRates,
      client: selectedClient,
      lang: language,
    });
    if (!taxRateTouched) setTaxRate(result.rate);
    setTaxResult(result);
    setTaxAssumed(
      result.assumed
        ? t(selectedClient ? "app.tax.assumed.note" : "app.tax.assumed.noClient", {
            region: result.assumedRegion || "",
            client: selectedClient?.name || "",
          })
        : "",
    );
    const note = selectedClient && !result.assumed ? explainTaxSource(result, selectedClient, language) : null;
    setTaxNote(renderTaxNote(note, t));
    setTaxCaution(result.cautionKey ? t(result.cautionKey) : "");
  }, [isEdit, boot.taxConfig, selectedClient, taxRateTouched, language, t]);

  // The tax line, in words. Create: the live resolution unless typed over.
  // Edit: the record the invoice was written with, else the rate recovered
  // from its money — the quote editor's rule, and the invoice mirrors it.
  const taxLine = (() => {
    const rate = num(taxRate);
    const typed = { source: "manual", rate };
    let basis;
    let recovered = false;
    if (isEdit) {
      const stored = start.taxResolution;
      if (stored && Math.abs(num(stored.rate) - rate) < 0.005) basis = stored;
      else {
        basis = typed;
        recovered = !taxRateTouched;
      }
    } else {
      basis = taxRateTouched ? typed : taxResult;
    }
    const resolved = taxLineResolved(basis);
    const headline = resolved ? taxLineHeadline(basis, language) : null;
    const source = resolved && !recovered ? taxLineSource(basis) : null;
    const hint = resolved ? null : taxLineUnresolvedHint(basis, { place: taxPlaceOf(selectedClient) });
    return {
      resolved,
      headline: headline ? t(headline.key, headline.params) : "",
      source: source ? t(source.key, source.params) : "",
      hint: hint ? t(hint.key, hint.params) : "",
    };
  })();

  // ── Lines ────────────────────────────────────────────────────────────────
  const editLineAt = (i, field, value) =>
    setLineItems((prev) => prev.map((item, j) => (j === i ? applyLineItemEdit(item, field, value) : item)));
  const addLine = () => setLineItems((prev) => [...prev, blankLine()]);
  const removeLineAt = (i) => setLineItems((prev) => prev.filter((_, j) => j !== i));
  const addProductLine = (product) =>
    setLineItems((prev) => [...prev, lineFromProduct(product, { language: documentLanguage, defaultLanguage: companyLanguage })]);

  const labourRate = labourOffer?.rates?.find((r) => r.key === labourRateKey) || null;
  // The preview line for the clocked hours: the server's hours × the
  // server's rate, shown so the total on screen is the total that will be
  // saved; NOT posted — the route rebuilds it from the ids and the key.
  const labourPreview = useMemo(
    () =>
      labour && labourOffer && labourRate
        ? {
            description: `${t("app.invoiceNew.labourWord")} — ${labourOffer.hours} h × ${labourRate.rate}`,
            quantity: labourOffer.hours,
            rate: labourRate.rate,
            amount: round2(labourOffer.hours * labourRate.rate),
            fromClock: true,
          }
        : null,
    [labour, labourOffer, labourRate, t],
  );

  // ── Money ────────────────────────────────────────────────────────────────
  const subtotal = round2(lineItems.reduce((sum, item) => sum + num(item.amount), 0) + (labourPreview ? labourPreview.amount : 0));
  // The typed rate once typed; the invoice's own unrounded rate until then.
  const effectiveRate = isEdit && !taxRateTouched ? num(start.exactTaxRate) : num(taxRate);
  const { discount: appliedDiscount, taxableBase, tax, total } = quoteTotals({
    subtotal,
    discount,
    taxRate: effectiveRate,
    taxEnabled,
  });

  const lineItemCost = lineItemCostOf(lineItems);
  const estimate = useMemo(() => {
    const v = costing || { crew: [], materialCost: "", overheadPct: 0 };
    return invoiceCostSummary({
      crew: v.crew,
      materialCost: num(v.materialCost),
      overheadPct: num(v.overheadPct),
      overheadPerJob: costBoot?.overheadPerJob ?? null,
      price: taxableBase,
      marginTargetPct: MARGIN_TARGET,
      lineItemCost,
    });
  }, [costing, costBoot, taxableBase, lineItemCost]);

  // ── The document's one card ──────────────────────────────────────────────
  //
  // Blank rows stay in the editor and out of the document: an empty line
  // with "$0.00" beside it is not something the client will read. The
  // clocked-hours preview prints last, after the typed lines, so the typed
  // lines keep their own indices.
  const displayLines = useMemo(
    () => [...lineItems.filter((li) => String(li.description || "").trim()), ...(labourPreview ? [labourPreview] : [])],
    [lineItems, labourPreview],
  );
  const linesGroup = useMemo(
    () => ({
      tempId: LINES_GROUP_ID,
      id: null,
      persisted: true,
      imported: false,
      categoryId: null,
      categoryKey: null,
      label: t("app.invoiceNew.lineItems"),
      lineItems: displayLines,
      takeoff: null,
      intakeValues: {},
    }),
    [displayLines, t],
  );
  // DocumentBuilder hands back a DISPLAY index (a text block clicked in the
  // document); the same object sits in the state list, so its identity finds
  // the row to edit.
  const stateIndexOf = (displayIndex) => lineItems.indexOf(displayLines[displayIndex]);

  // ── Client creation from the picker (the quote builder's, verbatim) ─────
  async function handleCreateClient(e) {
    e.preventDefault();
    setError("");
    if (!newClient.name.trim()) {
      setError(newClient.type === "company" ? t("app.quoteNew.enterCompanyName") : t("app.quoteNew.enterClientName"));
      return;
    }
    setCreatingClient(true);
    try {
      const created = await fetchJson("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newClient),
      });
      setClients((prev) => [created, ...prev]);
      setSelectedClient(created);
      setShowNewClient(false);
      setNewClient({ type: "individual", name: "", language: null, contactName: "", email: "", phone: "", address: "", city: "", postalCode: "", county: "", province: "", country: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingClient(false);
    }
  }

  // ── Saving ───────────────────────────────────────────────────────────────

  // No signal: the queue owns the whole save (lib/offline/queue.js).
  async function queueOffline(status) {
    const photoKeys = clientPhotos.filter((p) => p.offlineKey).map((p) => p.offlineKey);
    await offline.enqueue(
      "invoice",
      invoiceOfflinePayload({
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        jobId: boot.jobId,
        lineItems,
        labour,
        taxEnabled,
        notes,
        dueDate,
        language,
        send: status === "sent",
        clientPhotos: clientPhotos.filter((p) => !p.offlineKey),
        photoKeys,
      }),
    );
    showToast({ message: t(status === "sent" ? "app.invoiceNew.queuedToSend" : "app.invoiceNew.savedOnPhone"), tone: "success" });
    router.push("/app/invoices");
  }

  async function handleSave(action, opts) {
    try {
      await runSave(action, opts);
    } catch (err) {
      setSaving("");
      setError(err?.message || t(isEdit ? "app.invoiceEdit.saveError" : "app.invoiceNew.createError"));
    }
  }

  /** @param {string} action "draft" | "sent" | "review" */
  async function runSave(action, { confirmed = false } = {}) {
    setError("");
    if (!isEdit) {
      if (!selectedClient) {
        setError(t("app.invoiceNew.selectClientFirst"));
        return;
      }
      if (lineItems.every((item) => !String(item.description || "").trim()) && !labour) {
        setError(t("app.invoiceNew.addLineItem"));
        return;
      }
    } else if (start.isDraft === false && !changeReason.trim()) {
      setError(t("app.invoiceEdit.reasonRequired"));
      return;
    }
    if (!cf.validate()) {
      setError(t("app.customFields.fixFirst"));
      return;
    }

    // "Save & send" emails the client the moment it is pressed, and there
    // is no unsend — so the recipient is confirmed first, as the quote's is.
    if (action === "sent" && !confirmed) {
      const to = selectedClient?.email;
      if (!to) {
        setError(t("app.invoiceBuilder.noClientEmail", "This client has no email address, so there's nowhere to send it. Save it as a draft and add one first."));
        return;
      }
      setPendingSend({ to });
      return;
    }

    setSaving(action);

    if (isEdit) {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          invoicePatchBody({
            lineItems,
            subtotal,
            discount,
            tax,
            taxEnabled,
            total,
            dueDate,
            notes,
            clientPhotos,
            costing,
            isDraft: start.isDraft !== false,
            changeReason,
          }),
        ),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSaving("");
        setError(data?.error || t("app.invoiceEdit.saveError"));
        return;
      }
      try {
        await cf.save(invoiceId);
      } catch (err) {
        setSaving("");
        setError(`${t("app.customFields.saveError")} ${err.message || ""}`.trim());
        return;
      }
      // A non-draft edit returns a NEW row; follow the id it hands back.
      router.push(`/app/invoices/${data?.id || invoiceId}`);
      return;
    }

    // Offline, or holding a photo picked offline: the queue owns the save.
    if (offline && (!online || clientPhotos.some((p) => p.offlineKey))) {
      await queueOffline(action === "sent" ? "sent" : "draft");
      return;
    }

    let res;
    try {
      res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          invoiceCreateBody({
            clientId: selectedClient.id,
            jobId: boot.jobId,
            labour,
            taxRate,
            lineItems,
            subtotal,
            tax,
            taxEnabled,
            total,
            notes,
            clientPhotos,
            dueDate,
            status: action === "sent" ? "sent" : "draft",
            costing,
            discount: appliedDiscount,
          }),
        ),
      });
    } catch (err) {
      if (offline && isNetworkFailure(err)) {
        await queueOffline(action === "sent" ? "sent" : "draft");
        return;
      }
      throw err;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSaving("");
      setError(data?.error || t("app.invoiceNew.createError"));
      return;
    }
    const invoice = await res.json();

    try {
      await cf.save(invoice.id);
    } catch (err) {
      setSaving("");
      setError(`${t("app.customFields.saveError")} ${err.message || ""}`.trim());
      return;
    }

    if (action === "sent") {
      const sendRes = await fetch(`/api/invoices/${invoice.id}/send`, { method: "POST" });
      if (!sendRes.ok) {
        const data = await sendRes.json().catch(() => null);
        if (planRequiredFrom(sendRes.status, data)) {
          router.push(`/app/invoices/${invoice.id}`);
          return;
        }
        router.push(
          `/app/invoices/${invoice.id}?sendError=${encodeURIComponent(
            data?.error || t("app.invoiceNew.sendFailedSaved", "Saved as a draft, but the email couldn't be sent. Open it and try Send again."),
          )}`,
        );
        return;
      }
    }

    // "Save & review" lands on the edit route with the flag that runs the
    // review on arrival — the review reads the SAVED invoice.
    if (action === "review") {
      router.push(`/app/invoices/${invoice.id}/edit?review=1`);
      return;
    }
    router.push(`/app/invoices/${invoice.id}`);
  }

  // ── Pieces the document draws ────────────────────────────────────────────

  const showPricing = caller ? hasToggle(caller, "showPricing") : true;

  /** The line table under the one card, with the clocked-hours line above it. */
  const renderGroupEditor = () => (
    <>
      {labourPreview && (
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/20 px-3 py-2 flex items-center justify-between gap-3 text-sm" data-labour-preview>
          <div className="min-w-0">
            <div className="font-medium text-foreground truncate">{labourPreview.description}</div>
            <div className="text-xs text-muted-foreground">{t("app.invoiceNew.labourFromClock")}</div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-medium tabular-nums">{money(labourPreview.amount)}</span>
            <button type="button" onClick={() => setLabour(null)} aria-label={t("app.invoiceNew.removeLine")} className="text-muted-foreground">
              <X size={14} />
            </button>
          </div>
        </div>
      )}
      <LineItemsTable
        currency={companyCurrency}
        items={lineItems}
        products={products}
        categoryKey={null}
        onChange={editLineAt}
        onAdd={addLine}
        onRemove={removeLineAt}
        onAddProduct={products.length ? addProductLine : undefined}
        documentLanguage={documentLanguage}
        showPricing={showPricing}
      />
    </>
  );

  /** Internal cost & margin — the same panel, wired for hours that were worked. */
  const renderCostMarginPanel = () => {
    if (!mayCost) return null;
    if (costState === "loading") return <div className="h-40 animate-pulse rounded-xl bg-accent" />;
    if (costState === "error") {
      return (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {t("app.invoiceBuilder.costLoadFailed", "Couldn't load the cost panel, so it isn't editable here. Saving this invoice will leave any costing already on it untouched.")}
        </div>
      );
    }
    const v = costing || { crew: [], materialCost: "", overheadPct: 0, note: "" };
    const patch = (p) => setCosting({ ...v, ...p });
    const seed = costBoot?.seed;
    const usingSeed = Boolean(seed && !costBoot?.saved);
    return (
      <CostMarginPanel
        hoursAreActual
        priceLabel={t("app.invoiceBuilder.pricePreTax", "Invoice total (pre-tax)")}
        currency={companyCurrency ?? costBoot?.currency ?? null}
        estimate={estimate}
        workers={costBoot?.workers || []}
        crew={v.crew || []}
        onCrewChange={(crew) => patch({ crew })}
        overheadPct={v.overheadPct}
        onOverheadChange={(overheadPct) => patch({ overheadPct })}
        overheadSource={costBoot?.overheadSource || null}
        manualLabourHours=""
        onManualLabourHoursChange={() => {}}
        manualMaterialCost={v.materialCost}
        onManualMaterialCostChange={(materialCost) => patch({ materialCost })}
        subtotal={taxableBase}
        marginTarget={MARGIN_TARGET}
        crewNotice={
          usingSeed
            ? t("app.invoiceBuilder.seededHours", "Filled in from {hours} approved hours logged against this job. Change anything that's wrong — once you save, these hours are the invoice's and the timesheets stop overwriting them.", { hours: seed.approvedHours })
            : null
        }
      />
    );
  };

  const renderPhotosBox = () => (
    <div className="bg-card border border-border rounded-xl p-5" data-photos-box>
      <h2 className="font-semibold text-foreground mb-2">{t("app.quoteDetail.clientMedia")}</h2>
      <MediaUploader
        uploadUrl="/api/upload"
        value={clientPhotos}
        onChange={setClientPhotos}
        label={t("app.quoteNew.addPhotos")}
        hint={t("app.invoiceNew.addPhotosHint")}
        offlineCapture={
          offline && !isEdit
            ? async (file) => {
                if (!file.type?.startsWith("image/")) return null;
                const item = await offline.enqueue("photo", { blob: file, name: file.name, type: file.type });
                return { url: URL.createObjectURL(file), kind: "photo", offlineKey: item.key };
              }
            : null
        }
      />
    </div>
  );

  /** The review and the paid deep read — the invoice's own panel. */
  const renderSuggestAddOns = () => (
    <InvoiceReviewPanel invoiceId={isEdit ? invoiceId : null} readOnly={false} autoReview={autoReview} />
  );

  const renderSendConfirm = () => (
    <SendConfirmModal
      isOpen={Boolean(pendingSend)}
      busy={saving === "sent"}
      onClose={() => setPendingSend(null)}
      onConfirm={() => {
        setPendingSend(null);
        handleSave("sent", { confirmed: true });
      }}
      recipient={pendingSend?.to}
      title={t("app.invoiceBuilder.confirmSendTitle", "Send this invoice?")}
      detail={t("app.quoteNew.confirmSendDetail")}
      confirmLabel={t("app.invoiceNew.saveSend")}
    />
  );

  /** The invoice's own notices, above the document. */
  const renderBanners = () => (
    <>
      {isEdit && start.isDraft === false && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl px-4 py-3 text-sm text-blue-900 dark:text-blue-200 flex items-start gap-2" data-invoice-version-banner>
          <History size={16} className="shrink-0 mt-0.5" />
          <div>
            {t("app.invoiceEdit.sentWarnBefore")} <strong>{t("app.invoiceEdit.versionN", { n: (start.version || 1) + 1 })}</strong> {t("app.invoiceEdit.sentWarnAfter")}
          </div>
        </div>
      )}
      {isEdit && start.amountPaid > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          {money(start.amountPaid)} {t("app.invoiceEdit.amountPaidWarn")}
        </div>
      )}
      {isEdit && start.isDraft === false && (
        <div className="bg-card border border-border rounded-xl px-4 py-3" data-change-reason>
          <label className="block text-sm font-medium text-foreground mb-1">
            {t("app.invoiceEdit.changeReasonLabel")} <span className="text-red-600 dark:text-red-400">*</span>
          </label>
          <input
            value={changeReason}
            onChange={(e) => setChangeReason(e.target.value)}
            placeholder={t("app.invoiceEdit.changeReasonPlaceholder")}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground"
          />
          <p className="text-xs text-muted-foreground mt-1">{t("app.invoiceEdit.changeReasonHelp")}</p>
        </div>
      )}
      {!isEdit && labourOffer?.job?.title && (
        <p className="text-sm text-muted-foreground">
          {t("app.invoiceNew.forJob", { job: labourOffer.job.title })}
          {offline && !online ? ` ${t("app.invoiceNew.offlineSubtitle")}` : ""}
        </p>
      )}
      {/* The clocked-hours offer — only with a job, and only while it still
          has something to say. Never a $0 line; "Not now" hides it. */}
      {!isEdit && labourOffer && !labourDismissed && !labour && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100 space-y-2" data-labour-offer>
          <div className="flex items-center gap-2 font-medium">
            <Clock size={15} className="shrink-0" />
            {labourOffer.entries?.length
              ? t("app.invoiceNew.labourOffer", { who: (labourOffer.byWorker || []).map((w) => `${w.name} ${w.hours} h`).join(" · ") })
              : t("app.invoiceNew.labourNone")}
          </div>
          {labourOffer.skipped?.open > 0 && <p className="text-xs opacity-80">{t("app.invoiceNew.labourStillOpen", { count: labourOffer.skipped.open })}</p>}
          {labourOffer.skipped?.billed > 0 && <p className="text-xs opacity-80">{t("app.invoiceNew.labourAlreadyBilled", { count: labourOffer.skipped.billed })}</p>}
          {labourOffer.entries?.length > 0 && labourOffer.rates?.length === 0 && (
            <p className="text-xs">
              {t("app.invoiceNew.labourNoRate")}{" "}
              <a href="/app/settings/field-work" className="underline font-semibold">{t("app.invoiceNew.labourSetRate")}</a>
            </p>
          )}
          {labourOffer.entries?.length > 0 && labourOffer.rates?.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {labourOffer.rates.length > 1 && (
                <select value={labourRateKey} onChange={(e) => setLabourRateKey(e.target.value)} className="border border-border rounded-lg px-2 py-1.5 text-sm bg-background text-foreground">
                  {labourOffer.rates.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.source === "company" ? t("app.invoiceNew.rateCompany") : r.label} · {money(r.rate)}/h
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!labourOffer?.entries?.length || !labourRateKey) return;
                  setLabour({ timeEntryIds: labourOffer.entries.map((e) => e.id), rateKey: labourRateKey });
                }}
                className="bg-inverted text-inverted-foreground px-3 py-1.5 rounded-full text-sm font-semibold"
              >
                {t("app.invoiceNew.labourAdd", {
                  line: `${t("app.invoiceNew.labourWord")} — ${labourOffer.hours} h × ${labourRate ? money(labourRate.rate) : ""}`,
                })}
              </button>
              <button type="button" onClick={() => setLabourDismissed(true)} className="text-sm underline opacity-80">
                {t("app.invoiceNew.labourNotNow")}
              </button>
            </div>
          )}
        </div>
      )}
      {offline && !online && (
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <WifiOff size={12} /> {t("app.invoiceNew.offlineHelper")}
        </p>
      )}
    </>
  );

  const renderDueDate = () => (
    <div>
      <label htmlFor="invoice-due-date" className="block text-sm font-medium text-foreground mb-1">
        {t("app.invoiceEdit.dueDate")}
      </label>
      <input
        id="invoice-due-date"
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="w-full sm:w-auto border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground"
        data-invoice-due-date
      />
    </div>
  );

  const [menuBusy, setMenuBusy] = useState("");
  const menuItems = [
    {
      key: "pdf",
      label: t("app.invoiceDetail.downloadPdf"),
      hint: isEdit ? t("app.docBuilder.savedVersionHint", "Uses the last saved version.") : t("app.invoiceBuilder.afterSaveHint", "Available once the invoice is saved."),
      icon: Download,
      disabled: !isEdit,
      busy: menuBusy === "pdf",
      onSelect: async () => {
        setMenuBusy("pdf");
        setError("");
        try {
          await downloadInvoicePdf(invoiceId, start.invoiceNumber, t("app.quoteDetail.pdfError", "Couldn't build the PDF."));
        } catch (err) {
          setError(err?.message || t("app.quoteDetail.pdfError", "Couldn't build the PDF."));
        } finally {
          setMenuBusy("");
        }
      },
    },
  ];

  const presentation = start.status ? invoiceStatusPresentation(start.status) : null;
  const statusChip = start.status ? (
    <span className={`text-[10px] font-semibold px-1.5 py-px rounded ${invoiceStatusClasses(start.status)}`} data-invoice-status-chip>
      {presentation?.labelKey ? t(presentation.labelKey, start.status) : start.status}
    </span>
  ) : null;

  const filteredClients = clients.filter((c) => c.name?.toLowerCase().includes(clientSearch.toLowerCase()));
  const noop = () => {};

  return (
    <DocumentBuilder
      kind="invoice"
      b={{
        t,
        lang: language,
        isEdit,
        quoteId: invoiceId,
        // DocumentBuilder reads the number, the status and the row off
        // `start` the way it reads a quote's; the invoice sits in the same
        // seats so the masthead, the chip and the issue date need no
        // second reader.
        start: {
          quoteNumber: start.invoiceNumber,
          status: start.status,
          quote: start.invoice,
          assignedTo: null,
          taxResolution: start.taxResolution,
        },
        boot: { company: boot.company, defaultProcessNotes: "" },
        caller,
        mayCost,
        canEditScope: true,
        companyCurrency,
        companyLanguage,
        quoteLanguage: documentLanguage,
        setQuoteLanguage: noop,
        languageMeta: null,
        clients: filteredClients,
        clientSearch,
        setClientSearch,
        selectedClient,
        setSelectedClient,
        showNewClient,
        setShowNewClient,
        newClient,
        setNewClient,
        handleCreateClient,
        creatingClient,
        siteAddress: "",
        setSiteAddress: noop,
        categories: [],
        products,
        teamRoster: [],
        settingsAccess,
        scopeGroups: [linesGroup],
        setScopeGroups: noop,
        addScopeGroup: noop,
        addPaintingEstimate: noop,
        paintingFirst: false,
        removeScopeGroup: noop,
        updateLineItem: (_tempId, displayIndex, field, value) => {
          const i = stateIndexOf(displayIndex);
          if (i >= 0) editLineAt(i, field, value);
        },
        removeLineItem: (_tempId, displayIndex) => {
          const i = stateIndexOf(displayIndex);
          if (i >= 0) removeLineAt(i);
        },
        groupFromStored: (g) => g,
        groupTotal: () => subtotal,
        rateOverridesFor: () => null,
        wordingOverrideFor: () => null,
        getProductsForCategory: () => products,
        notes,
        setNotes,
        reviewNotes: "",
        setReviewNotes: noop,
        reviewNotesRef: null,
        processNotes: "",
        setProcessNotes: noop,
        assignedToId: "",
        setAssignedToId: noop,
        setAssignedToTouched: noop,
        discount,
        setDiscount,
        appliedDiscount,
        taxableBase,
        taxEnabled,
        setTaxEnabled,
        taxRate,
        setTaxRate,
        setTaxRateTouched,
        taxNote,
        taxCaution,
        taxAssumed,
        taxSchemeNote: "",
        taxDetail: null,
        vatWorkType: null,
        setVatWorkType: noop,
        validUntil: "",
        setValidUntil: noop,
        subtotal,
        tax,
        total,
        estimate,
        taxLine,
        saving,
        error,
        errorRef,
        conflict: null,
        conflictRef: null,
        runSave,
        handleSave,
        pendingSend,
        setPendingSend,
        cf,
        readiness: null,
        readinessItems: [],
        OPEN_STATUSES: ["draft"],
        TOUR_STEPS: [],
        showTour: false,
        setShowTour: noop,
        renderGroupEditor,
        renderCostMarginPanel,
        renderNotesBox: () => null,
        renderReviewNotesBox: () => null,
        renderPhotosBox,
        renderProcessNotes: () => null,
        renderSuggestAddOns,
        renderSendConfirm,
        // The invoice's own
        dueDate,
        renderDueDate,
        isDraft: start.isDraft,
        statusChip,
        menuItems,
        backHref: isEdit ? `/app/invoices/${invoiceId}` : "/app/invoices",
        renderBanners,
      }}
    />
  );
}
