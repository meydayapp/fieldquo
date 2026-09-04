// app/app/quotes/[id]/page.js
//
// The back-office view of a quote.
//
// ── Why this looks like the document and not like a form ────────────────────
//
// The PDF and the client-facing approval page at /q/[token] are the two things
// a homeowner ever sees, and both are laid out as a document: brand rule,
// masthead, "prepared for", scope groups as sections, one filled band carrying
// the total. This screen showed the same data as an unstyled list of rows, so
// the person selling the job was looking at something that bore no resemblance
// to what their client was reading — which makes "check the quote before you
// send it" a much weaker check than it should be.
//
// So the structure below deliberately mirrors lib/documentSections/* and
// QuoteApproval.js. What it does NOT mirror is their colour handling: those
// render for a stranger with no session and compute literal hex values from
// Company.brandColor, while the <article> here is wrapped in data-brand +
// BrandTheme, which puts the same brand colour into the semantic tokens.
// `bg-inverted` inside the document IS the company's colour, with a foreground
// picked by the same measured contrast, and it stays legible in dark mode —
// which a hardcoded hex would not.
//
// The wrapper is around the DOCUMENT only, not the page. /app itself is
// FieldQuo's palette (see app/app/layout.js): the brand colour is what the
// client sees, and the command strip above — Send, Convert, Delete — is not
// something the client ever sees. The seam is the point. What's inside the
// frame is the quote; what's outside it is the office.
//
// ── i18n PENDING ───────────────────────────────────────────────────────────
//
// Five strings in the internal cost panel are still English literals, on a
// page that is otherwise fully translated. Not wired here, because a t() call
// on a key that does not exist yet turns check:translations red for every
// other agent in the tree (commit 080999e). Reported:
//
//   app.quoteDetail.notCostedAtSave
//     en "Nothing was costed when this quote was saved, so these figures are
//         worked out from today's rates — not what it was priced at. Nobody
//         recorded who was doing the work either, so the hours carry no money."
//     fr "Rien n'a été chiffré au moment d'enregistrer cette soumission, alors
//         ces chiffres sont calculés aux taux d'aujourd'hui — pas à ce qui a
//         été facturé. Personne n'a noté qui faisait le travail non plus, donc
//         les heures ne portent aucun montant."
//   app.quoteDetail.costIncomplete
//     en "Some of the work has no cost against it, so the real margin is lower
//         than this."
//     fr "Une partie du travail n'a aucun coût associé, alors la marge réelle
//         est plus basse que celle-ci."
//   app.quoteDetail.blendedRate
//     en "{rate}/hr blended"      fr "{rate}/h moyen pondéré"
//   app.quoteDetail.noReasonsForLevel
//     en "No reasons were recorded for this level."
//     fr "Aucune raison n'a été consignée pour ce niveau."
//
// And one COUNT, which must be a countedNoun() rather than the
// `=== 1 ? " has" : "s have"` sitting there now — an English plural rule AND an
// English verb agreement inside a template literal, which no other language
// forms the same way:
//
//   app.quoteDetail.unpricedMaterialCount
//     countedNoun en {one:"material", other:"materials"}
//     countedNoun fr {one:"matériau", many:"matériaux", other:"matériaux"}
//   app.quoteDetail.unpricedMaterials
//     en "{count} with no price set."   fr "{count} sans prix défini."
"use client";

import { useState, useEffect } from "react";
import { moneyFormatter } from "@/lib/format/money";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import SendConfirmModal from "@/app/components/SendConfirmModal";
import {
  ArrowLeft,
  Trash2,
  Send,
  RefreshCw,
  Pencil,
  Ruler,
  Link2,
  Mail,
  Loader2,
  CheckCircle2,
  Building2,
  PhoneCall,
  PhoneOff,
} from "lucide-react";
import DeleteConfirmModal from "@/app/components/admin/DeleteConfirmModal";
import BrandTheme from "@/app/components/BrandTheme";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { useFeatureFlags } from "@/app/providers/FeatureProvider";
import { hasLevel } from "@/lib/permissions/enforce";
// The SAME gate POST /api/quotes/[id]/call runs, not a description of it.
// quoteCallScope.js has no imports precisely so a browser bundle can execute
// it — see its header — which is what keeps the button and the endpoint from
// disagreeing about which quotes are callable.
import {
  manualQuoteCallGate,
  callbackReasonKey,
  CALLBACK_REASON_TEXT,
  CALLBACK_REFUSED,
} from "@/lib/voice/quoteCallScope";
import { reportResponseError } from "@/lib/clientErrors";
import { fetchJson } from "@/lib/fetchJson";
import { jsonBody } from "@/lib/jsonBody";
import { taxStatement } from "@/lib/tax/documentTax";
import TaxUnresolvedModal from "@/app/components/tax/TaxUnresolvedModal";
import { useTranslation } from "@/app/hooks/useTranslation";
import ClientMediaTile from "@/app/components/ClientMediaTile";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { documentLabels } from "@/lib/i18n/documentLabels";
import ImportedByPanel from "./ImportedByPanel";
import QuoteCostEditor from "@/app/components/quotes/QuoteCostEditor";
import EmailSectionsPanel from "./EmailSectionsPanel";
import EmailSectionsBlockedModal from "./EmailSectionsBlockedModal";
import ImportedCostsPanel from "./ImportedCostsPanel";
import { visibleLineItems } from "@/lib/quotes/scopeGroupDisplay";
import { quoteStatusLabel, quoteStatusClasses } from "@/lib/quotes/statusLabels";
import { formatAddress } from "@/lib/format/address";
import {
  COMPLEXITY_LEVELS,
  COMPLEXITY_REASONS,
} from "@/app/data/cabinetPricing";

// The status chip's words and colour both come from lib/quotes/statusLabels.js
// now. This file carried a fourth private copy of the class map and rendered
// `{quote.status}` beside it — the raw column value, lowercase and in English,
// on the one screen a contractor opens to check whether a client has signed. A
// French office read "accepted" in the middle of an otherwise French document.
//
// That module's own header names the quotes LIST as where this bug was found
// and says the detail page "already renders exactly that key". It didn't; it
// was the copy nobody had looked at. Both halves are shared now, so a fifth
// status added to QuoteStatus cannot reach a human as a database word.

// Formatted exactly as it was before this page was restyled, and exactly as the
// invoice detail page still does it. Prettier grouping is tempting, but quotes
// and invoices sitting side by side with different money formatting reads as a
// bug — that's a change to make in both places or neither.
// Was a private `toFixed(2)` copy, which does not group — this page printed
// $2100.00 while the list view beside it printed $2,100.00. See
// lib/format/money.js; the formatter is bound to the quote's own currency
// inside the component, below.

export default function QuoteDetailPage() {
  const { t, language } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  // The document's own furniture — "Quote", "Prepared for" — from the same
  // catalogue the PDF and the approval page use, in the STAFF's language here.
  // Minting app-catalogue keys for words that are already translated six ways
  // would be a second copy to keep in step, and English literals would put an
  // English word in the middle of an otherwise French screen.
  const labels = documentLabels(language);
  const router = useRouter();
  const { id } = useParams();

  const [quote, setQuote] = useState(null);
  // What the quote SAYS — per-trade prose, resolved the same way the client's
  // copy resolves it, so the two documents cannot drift.
  const [docContent, setDocContent] = useState(null);
  // What it COSTS — internal, permission-gated, never on a client surface.
  const [costing, setCosting] = useState(null);
  // Whether the inline cost editor is open.
  const [costEditorOpen, setCostEditorOpen] = useState(false);
  // The company's billing currency, the reader's language. All eight money
  // renders below go through this — they used to go through a private
  // toFixed(2) helper that printed $2100.00 on the page a client opens.
  //
  // MUST stay below the useState above. It read `quote` eleven lines before
  // that line declared it, which is a temporal dead zone: the whole page threw
  // "Cannot access 'A' before initialization" and rendered nothing at all. The
  // `?.` reads as a guard and is not one — optional chaining protects against
  // null, not against touching a `const` binding that does not exist yet.
  const money = moneyFormatter(quote?.company?.currency, language);
  // Letterhead: logo, name, phone. GET /api/quotes/[id] doesn't return the
  // company, and widening a shared API response for one screen's decoration is
  // the wrong trade — this is the same endpoint the layout already reads for
  // date preferences, so it's warm, and the masthead degrades to the brand mark
  // alone if it fails.
  const [company, setCompany] = useState(null);

  // What this document's tax line is allowed to say. `company` is the business
  // -info payload, which already carries province, country, taxRate,
  // autoApplyLocalTax, vatRegistered and the company's own TaxRate rows — so
  // the office copy resolves it exactly as the PDF and the client's copy do,
  // rather than reaching a different conclusion about the same row.
  //
  // Reads only. Nothing here re-prices anything: `quote.tax` is untouched.
  const taxLine = taxStatement({
    taxEnabled: quote?.taxEnabled,
    tax: quote?.tax,
    company,
    taxRates: company?.taxRates,
    client: quote?.client,
    asOf: quote?.createdAt ? new Date(quote.createdAt) : undefined,
    lang: language,
  });
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  // The same question DELETE /api/quotes/[id] asks, asked of the same grid —
  // requireLevel(full, "quotes", "view_create_edit_delete"). This screen used
  // to offer the trash icon to everyone: a Dispatcher capped at
  // view_create_edit got the full "permanently removed" dialog, pressed
  // Delete, and the 403 closed the dialog with nothing on screen, so the quote
  // looked deleted. usePermissions() returns null until the layout resolves it
  // and hasLevel(null, …) is false, so the button arrives a beat late rather
  // than flashing and vanishing.
  const caller = usePermissions();
  const canDeleteQuote = hasLevel(caller, "quotes", "view_create_edit_delete");
  // Ringing a client about their quote is acting on the quote, so the route
  // takes the level that EDITS one. Rendered away rather than disabled for
  // anyone below it: a 403 arriving behind a visible control is the bug the
  // dashboard note in app/app/page.js is about — the refusal reads as an
  // answer ("nothing happened") instead of as a refusal.
  const canCallClient = hasLevel(caller, "quotes", "view_create_edit");
  // And gone entirely for a tenant with no phone receptionist. `null` flags
  // mean "show everything", the same rule lib/features/nav.js applies — a
  // provider that hasn't resolved must not blank working controls.
  const voiceFlag = useFeatureFlags()?.voice_receptionist;
  const voiceAvailable = !voiceFlag || voiceFlag.usable;
  // The request is in flight. The button is disabled while it is true, so a
  // second press can't queue a second call.
  const [calling, setCalling] = useState(false);
  // What the endpoint said, once. { kind: "queued" | "already" | "refused" |
  // "error", reason?, message? } — held rather than flattened into `error`,
  // because a queued call and a refusal are not errors and must not paint the
  // red banner that means "the quote didn't send".
  const [callResult, setCallResult] = useState(null);
  const [sending, setSending] = useState(""); // "" | "quote" | "follow_up"
  const [justSent, setJustSent] = useState("");
  // Whether the last send was intercepted because this is a demo company. Kept
  // beside justSent rather than folded into it: the banner still names the
  // address, and only the claim about delivery changes.
  const [justSentSimulated, setJustSentSimulated] = useState(false);
  // The send refused because an optional email section is switched on with
  // nothing in it. Held as state rather than flattened into `error`, because
  // the 409 carries the two ways out and a red banner cannot offer a button.
  // See lib/quotes/emailSections.js for why the server refuses rather than
  // dropping the section.
  const [blockedSections, setBlockedSections] = useState(null);
  // The send refused because this quote says tax applies and charges none.
  // Held as state for the same reason as blockedSections: the 409 carries the
  // two ways out and a red banner cannot offer a form.
  const [taxBlocked, setTaxBlocked] = useState(null);
  // Arrived from the builder with ?taxBlocked=quote. Held until the quote and
  // the company are both loaded, because the dialog needs the client's name
  // and the refusal needs `taxLine` to still be true.
  const [taxBlockedPending, setTaxBlockedPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/business-info")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setCompany(d);
      })
      // Swallowed on purpose: a missing letterhead costs a logo, and showing an
      // error banner about it above a perfectly good quote would be noise.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Guard res.ok: on a 404/401 the route returns { error }, and setting that
    // as the quote made `if (!quote)` pass, rendering the detail body with a
    // $NaN total instead of the not-found screen. Leave quote null on failure so
    // the existing not-found branch shows.
    fetch(`/api/quotes/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setQuote)
      .catch(() => setQuote(null))
      .finally(() => setLoading(false));

    // ── The two things this page used to be missing ────────────────────────
    //
    // The client's copy of a quote carries what's included, what could change
    // the price, the process with its timelines and the payment schedule. This
    // page carried none of it — so the person who WROTE the quote saw a bare
    // list of amounts while the homeowner read a document. They are the one
    // who has to defend every sentence on it.
    //
    // Both are separate endpoints rather than a wider GET: this response is
    // already spread into the PDF route and the editor, and neither needs
    // several kilobytes of trade prose or a costing block.
    fetch(`/api/quotes/${id}/document`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setDocContent)
      // Silent: the document reads correctly without the prose, and an error
      // banner about missing boilerplate above a perfectly good quote is noise.
      .catch(() => setDocContent(null));

    fetch(`/api/quotes/${id}/costing`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setCosting)
      // A 403 here is NORMAL — job costing is a permission, and somebody
      // without it should see the quote and not the margin.
      .catch(() => setCosting(null));
  }, [id]);

  // Carried over from the builder when "Save & Send" saved the quote but the
  // email failed. Without this the user lands on a draft with no explanation
  // of why it isn't sent — which is how you get someone pressing Send four
  // more times.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sendError = params.get("sendError");
    const sendBlocked = params.get("sendBlocked");
    const taxBlockedFlag = params.get("taxBlocked");
    if (!sendError && !sendBlocked && !taxBlockedFlag) return;
    if (sendError) setError(sendError);
    // The builder's "Save & Send" hit the empty-section gate. Re-read the
    // sections rather than smuggling the 409 payload through the URL: it is
    // one request, and it means the dialog opens on the CURRENT state — if
    // somebody filled the list in another tab while this navigated, there is
    // nothing left to block and the dialog says so instead of arguing with a
    // stale copy.
    if (sendBlocked) {
      fetchJson(`/api/quotes/${id}/email-sections`)
        .then((data) =>
          setBlockedSections({
            kind: sendBlocked === "follow_up" ? "follow_up" : "quote",
            blocked: data.blockedDetail || [],
          }),
        )
        .catch((err) => setError(err.message));
    }
    // The builder's "Save & Send" hit the tax gate. Recorded, not acted on
    // yet: the effect below opens the dialog once the quote and the company
    // have both landed.
    //
    // NOT by re-POSTing to /send to see whether it still refuses. That route
    // EMAILS on success, so a "just checking" request that happened to pass
    // the gate would put the quote in front of the client on a page load
    // nobody treated as a send. The state this page already resolves for its
    // own totals (`taxLine`) answers the same question and cannot send
    // anything.
    if (taxBlockedFlag) setTaxBlockedPending(true);

    window.history.replaceState({}, "", window.location.pathname);
  }, [id]);

  // Opens the dialog the builder redirected here for — but only if the quote
  // STILL cannot say what tax is owed. If somebody fixed the client in another
  // tab while this navigated, there is nothing to block and no dialog, rather
  // than a modal arguing with a stale copy.
  useEffect(() => {
    if (!taxBlockedPending || !quote || !company) return;
    setTaxBlockedPending(false);
    if (taxLine.kind !== "unresolved") return;
    setTaxBlocked({
      kind: "quote",
      clientId: quote.client?.id || null,
      clientName: quote.client?.name || null,
      missing: [
        ...(quote.client?.country ? [] : ["country"]),
        ...(quote.client?.province ? [] : ["province"]),
      ],
    });
  }, [taxBlockedPending, quote, company, taxLine.kind]);

  /**
   * Actually emails the client.
   *
   * This button used to call updateStatus("sent"), which changed a word on
   * screen and then hid itself because the status was no longer draft. Every
   * signal said the quote had gone out; nothing had been sent. It now calls a
   * route that emails, and only reports success once Resend has accepted the
   * message.
   */
  const [pendingSend, setPendingSend] = useState(null);

  async function sendQuote(kind) {
    // ── One click used to email the client ────────────────────────────────
    //
    // No confirmation, no chance to check the address. Sending a quote is
    // outbound, irreversible, and lands in a stranger's inbox under the
    // contractor's name — a misfire is a client reading a price that wasn't
    // meant for them yet, and there is no unsend.
    //
    // The recipient is named IN the prompt because that is the thing worth
    // checking. QA created a client through the quick-add and sent to whatever
    // address happened to be on it; "Send to whom?" is the question this
    // answers.
    const to = quote?.client?.email;
    if (!to) {
      setError(
        t(
          "app.quoteDetail.noEmail",
          "This client has no email address, so there's nowhere to send it. Add one on the client first.",
        ),
      );
      return;
    }
    // A rendered modal, not window.confirm — see SendConfirmModal for why.
    // The actual send happens in doSend once they confirm.
    setPendingSend({ kind, to });
  }

  async function doSend(kindOverride) {
    // ── Why this is not `kindOverride || pendingSend?.kind` ─────────────────
    //
    // Because SendConfirmModal wires its button as `onClick={onConfirm}`, and
    // this function was handed to it as `onConfirm={doSend}` — so React passed
    // the CLICK EVENT as kindOverride. An event is truthy, so it won the `||`,
    // and `JSON.stringify({ kind })` two lines down then tried to serialise a
    // React synthetic event: "JSON.stringify cannot serialize cyclic
    // structures", which is what the owner saw every time he pressed Send.
    //
    // The call site is fixed too. This guard stays because the next person to
    // wire a handler straight to onConfirm will make exactly the same mistake,
    // and the failure it produces names nothing about where it came from.
    const kind =
      typeof kindOverride === "string" ? kindOverride : pendingSend?.kind;
    if (!kind) return;
    setPendingSend(null);

    setSending(kind);
    setError("");
    try {
      const res = await fetch(`/api/quotes/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ kind }, "quote send"),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 409 && data?.code === "tax_unresolved") {
        // Not an error state. The quote isn't wrong, it just can't say what
        // tax is owed — and both fixes are in the dialog. The kind rides along
        // so Retry sends the same thing a follow-up must not come back as a
        // fresh quote.
        setTaxBlocked({ kind, ...data });
        return;
      }
      if (res.status === 409 && data?.code === "email_sections_empty") {
        // Not an error state: nothing is wrong with the request, the quote
        // just isn't ready. The kind is kept alongside so Retry sends the same
        // thing — a follow-up must not come back as a fresh quote.
        setBlockedSections({ kind, blocked: data.blocked || [] });
        return;
      }
      if (!res.ok)
        throw new Error(data?.error || t("app.quoteDetail.sendError"));

      // Merge rather than refetch: the response carries exactly the fields
      // that changed, and a refetch would blank the page for a moment on the
      // one action the user most wants confirmation of.
      setQuote((q) => ({ ...q, ...data }));
      setJustSent(data.to);
      setJustSentSimulated(data.simulated === true);
      setTimeout(() => setJustSent(""), 6000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending("");
    }
  }

  async function updateStatus(status) {
    setActionLoading(true);
    const res = await fetch(`/api/quotes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: jsonBody({ status }, "status change"),
    });
    if (res.ok) {
      setQuote(await res.json());
    } else {
      // Marking a quote sent or accepted is a status change the whole
      // pipeline depends on. Failing at it silently means the board is wrong
      // and nobody knows why.
      setError(
        (await res.json().catch(() => null))?.error ||
          t("app.quoteDetail.statusError"),
      );
    }
    setActionLoading(false);
  }

  /**
   * Queues a call to this client about this quote.
   *
   * Nothing dials here. /api/cron/voice-outbound places the task within about
   * fifteen minutes, re-checking consent and calling hours at dial time — so
   * every sentence this writes says "queued" or "shortly", never "calling".
   * Claiming a call is happening when a task is merely written is the same
   * lie the old Send button told about email.
   */
  async function callClient() {
    setCalling(true);
    setCallResult(null);
    try {
      const res = await fetch(`/api/quotes/${id}/call`, { method: "POST" });
      const data = await res.json().catch(() => null);

      // A refusal, with the code that says which one. Kept apart from the
      // error branch: the quote isn't broken and the request wasn't wrong,
      // there is just something to fix first — and a generic "couldn't do
      // that" is exactly what makes somebody press the button again.
      if (res.status === 409 && data?.reason) {
        setCallResult({ kind: "refused", reason: data.reason });
        return;
      }
      // Never a bare `if (res.ok)` with nothing on the other side. A 500, a
      // 403 that arrived because someone's access changed since this page
      // loaded, a dropped connection — all of them have to say so, or the
      // press reads as having worked.
      if (!res.ok) {
        setCallResult({
          kind: "error",
          message: data?.error || t("app.quoteDetail.callError"),
        });
        return;
      }
      // { queued: false, reason: "already_queued" } is a 200 and not an error:
      // the call they want is already coming.
      setCallResult({ kind: data?.queued ? "queued" : "already" });
    } catch {
      setCallResult({ kind: "error", message: t("app.quoteDetail.callError") });
    } finally {
      setCalling(false);
    }
  }

  async function handleConvert() {
    setError("");
    setActionLoading(true);
    const res = await fetch(`/api/quotes/${id}/convert`, { method: "POST" });
    const data = await res.json();
    setActionLoading(false);
    if (!res.ok) {
      setError(data.error || t("app.quoteDetail.convertError"));
      return;
    }
    router.push(`/app/invoices/${data.id}`);
  }

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/quotes/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/app/quotes");
        return;
      }
      // The modal no longer closes itself on confirm (it used to, before the
      // request had even finished), so close it here — otherwise the error
      // lands behind an open dialog.
      setShowDelete(false);
      // setError as well as the toast. It was toast-only, and QA read the
      // outcome as "the dialog closed and nothing happened" — which is what a
      // missed toast looks like, and the page has had an inline banner all
      // along. The server's own sentence is used verbatim: it distinguishes
      // the 403 from the 409 about an invoice already raised.
      await reportResponseError(res, setError, t("app.quoteDetail.deleteError"));
    } finally {
      setDeleting(false);
    }
  }

  if (loading)
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto animate-pulse h-96 bg-accent rounded-xl" />
    );
  if (!quote)
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto text-sm text-muted-foreground">
        {t("app.quoteDetail.notFound")}
      </div>
    );

  // ── Can this quote open the Kitchen Designer? ───────────────────────────
  //
  // Computed server-side by GET /api/quotes/[id] (lib/kitchen/access.js), not
  // re-derived here from this quote's own scope groups. It used to be: any
  // scope group whose category key matched /cabinet|kitchen|countertop|
  // remodel/ — which meant a company selling only countertops got the
  // designer on every countertop quote, and a general contractor who
  // genuinely installs new kitchens had no way to turn it on at all (see the
  // owner's report, 2026-08-30). The real gate is now the company's own
  // "Kitchen Design & New Installs" toggle in Settings > Services, with an
  // exception for a quote that already has a design saved on it — a company
  // that turns the service off later does not lose what it already drew.
  //
  // Placed after the !quote guard because it reads `quote`.
  const isKitchen = Boolean(quote.canOpenKitchenDesigner);

  // ── Can this quote be rung about? ───────────────────────────────────────
  //
  // Run through the real gate rather than a second reading of it. Two
  // substitutions, because this page can see less than the endpoint can:
  //
  //   client.phone          — see below. It is the only substitution left.
  //
  // The outbound master switch used to be substituted here too, assumed ON,
  // because the quote payload did not carry it — so a company that had
  // deliberately turned outbound calling off got a button that refused every
  // time. The endpoint now returns `company.outboundCallsEnabled`, so the gate
  // reads the real value and the button is simply absent, with a sentence
  // naming the switch. One field, and the last foreseeable dead control on this
  // screen is gone.
  //
  //   client.phone          redactClient DELETES it for a member capped at
  //                         name_address_only. "No phone number on the
  //                         client" would then be a claim about data this
  //                         member simply isn't shown — absence and
  //                         restriction are different statements — so the
  //                         number is treated as present and the server's 409
  //                         gets to answer.
  const callGate = manualQuoteCallGate({
    ...quote,
    client: quote.client?.restricted
      ? { ...quote.client, phone: "restricted" }
      : quote.client,
  });

  // The stored address is Google's FORMATTED string and already contains the
  // city and province — appending them printed "…, Canada, Toronto, ON" on the
  // document a client opens. See lib/format/address.js.
  const clientAddress = formatAddress(quote.client);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5 pb-10">
      {/* The command strip. Deliberately above the document rather than inside
          it: these are things the staff member does TO the quote, and a Delete
          button sitting on the letterhead reads as part of what the client
          receives. */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <Link
          href="/app/quotes"
          className="flex items-center gap-1 text-sm text-muted-foreground py-2"
        >
          <ArrowLeft size={14} /> {t("app.quoteDetail.backToQuotes")}
        </Link>

        <div className="flex flex-wrap gap-2">
          {/* Shown while the quote is still live, not only while it's a draft.
              Re-sending a quote a client says they never received is one of
              the most common things anyone needs to do, and the old button
              vanished the moment the status changed. */}
          {["draft", "sent"].includes(quote.status) && (
            <button
              onClick={() => sendQuote("quote")}
              disabled={Boolean(sending)}
              className="flex items-center gap-1.5 bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
            >
              {sending === "quote" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              {quote.sentAt
                ? t("app.quoteDetail.sendAgain")
                : t("app.action.send")}
            </button>
          )}
          {quote.status === "sent" && quote.sentAt && (
            <button
              onClick={() => sendQuote("follow_up")}
              disabled={Boolean(sending)}
              className="flex items-center gap-1.5 border border-border text-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
            >
              {sending === "follow_up" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Mail size={14} />
              )}
              {t("app.quoteDetail.followUp")}
            </button>
          )}
          {/* Only when it could actually work. The refusals this page CAN
              foresee — unreviewed, never emailed, no number — render as a
              sentence under the strip instead, because a visible control that
              answers "no" is the dead button this codebase keeps being swept
              for. See callGate above for the two things it can't foresee. */}
          {canCallClient && voiceAvailable && callGate.allowed && (
            <button
              onClick={callClient}
              disabled={calling}
              className="flex items-center gap-1.5 border border-border text-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
            >
              {calling ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <PhoneCall size={14} />
              )}
              {t("app.quoteDetail.callClient", "Call about this quote")}
            </button>
          )}
          {["sent", "draft"].includes(quote.status) && (
            <Link
              href={`/app/quote-approval/${id}`}
              className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-full text-sm font-semibold"
            >
              <Link2 size={14} /> {t("app.quoteDetail.getApproved")}
            </Link>
          )}
          {quote.status === "accepted" && !quote.invoices?.length && (
            <button
              onClick={handleConvert}
              disabled={actionLoading}
              className="flex items-center gap-1.5 bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
            >
              <RefreshCw size={14} /> {t("app.quoteDetail.convertToInvoice")}
            </button>
          )}
          {/* Only offered when this quote actually IS a kitchen. Showing it on
              a fence quote would be a button that opens an empty room and a
              pricing panel for cabinetry nobody is buying. */}
          {isKitchen && (
            <Link
              href={`/app/quotes/${id}/kitchen`}
              className="flex items-center gap-1.5 border border-border text-foreground px-4 py-2 rounded-full text-sm font-semibold"
            >
              <Ruler size={14} /> {t("app.quoteDetail.kitchenDesigner")}
            </Link>
          )}
          <Link
            href={`/app/quotes/${id}/edit`}
            className="flex items-center gap-1.5 border border-border text-foreground px-4 py-2 rounded-full text-sm font-semibold"
          >
            <Pencil size={14} /> {t("app.action.edit")}
          </Link>
          {/* Hidden, not disabled — same as Jobs. A greyed trash icon still
              says "somebody could delete this quote here", which is a question
              the owner asks their team about, not a fact about this screen. */}
          {canDeleteQuote && (
            <button
              onClick={() => setShowDelete(true)}
              aria-label={t("app.quoteDetail.deleteTitle")}
              className="border border-border text-muted-foreground p-2 rounded-full"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Why this quote can't be rung about, or what happened when it was.
          Under the strip rather than in it: the pill row is controls, and a
          sentence sitting between two buttons reads as a broken one. Rendered
          under exactly the same two conditions as the button, so a member who
          never sees the control is never told why it isn't there. */}
      {canCallClient && voiceAvailable && (
        <CallNotice
          gate={callGate}
          result={callResult}
          clientId={quote.client?.id}
          clientName={quote.client?.name}
        />
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* The email trail. Every banner here is written only after Resend
          accepted the message, so "Emailed 3 July" is a fact rather than an
          intention — which is what the old sentAt recorded, since the Send
          button never sent anything. */}
      <SendConfirmModal
        isOpen={Boolean(pendingSend)}
        busy={Boolean(sending)}
        onClose={() => setPendingSend(null)}
        // Wrapped, not passed. `onConfirm={doSend}` handed doSend the click
        // event as its first argument — see the note in doSend.
        onConfirm={() => doSend()}
        recipient={pendingSend?.to}
        title={
          pendingSend?.kind === "follow_up"
            ? t("app.quoteDetail.confirmFollowUpTitle", "Send a follow-up?")
            : t("app.quoteDetail.confirmSendTitle", "Send this quote?")
        }
        detail={t(
          "app.quoteDetail.confirmSendDetail",
          "They'll get it by email straight away. You can't unsend it.",
        )}
        confirmLabel={t("app.quoteDetail.send", "Send")}
      />

      {justSent && (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-lg px-4 py-3 flex items-center gap-2.5 text-sm text-green-800 dark:text-green-300">
          <CheckCircle2 size={16} className="shrink-0" />
          {/* The sentence is ONE flex item. It used to be three — the label,
              the address span, and a bare "." — and the container's gap-2.5
              spaced them all, rendering "Sent to someone@example.com ." with a
              float before the full stop. Raw text in a flex row becomes an
              anonymous flex item, which is easy to forget. */}
          <span>
            {t("app.quoteDetail.sentTo")}{" "}
            <span className="font-medium">{justSent}</span>.
            {/* Said in the same breath as the address, not in a separate
                banner elsewhere on the page: the sentence the rep reads is
                "Sent to <address>", and the correction has to reach them
                before they look away. */}
            {justSentSimulated && (
              <> {t("app.demo.notEmailed")}</>
            )}
          </span>
        </div>
      )}

      {(quote.sentAt || quote.followUpSentAt) && (
        <div className="bg-card border border-border rounded-lg px-4 py-3 space-y-1.5">
          {quote.sentAt && (
            <TrailRow
              label={t("app.quoteDetail.emailed")}
              at={quote.sentAt}
              detail={quote.sentToEmail}
            />
          )}
          {quote.followUpSentAt && (
            <TrailRow
              label={
                quote.followUpCount > 1
                  ? t("app.quoteDetail.followedUpN", {
                      count: quote.followUpCount,
                    })
                  : t("app.quoteDetail.followedUp")
              }
              at={quote.followUpSentAt}
            />
          )}
          {/* clientDesignAt is reused by the public approval endpoint to
              record when the client decided — see the comment there. */}
          {["accepted", "declined"].includes(quote.status) &&
            quote.clientDesignAt && (
              <TrailRow
                label={
                  quote.status === "accepted"
                    ? t("app.status.approved")
                    : t("app.status.declined")
                }
                at={quote.clientDesignAt}
                tone={quote.status === "accepted" ? "positive" : "muted"}
              />
            )}
        </div>
      )}

      {quote.invoices?.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-lg px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
          {t("app.quoteDetail.alreadyConverted")}{" "}
          <Link
            href={`/app/invoices/${quote.invoices[0].id}`}
            className="underline font-medium"
          >
            {quote.invoices[0].invoiceNumber}
          </Link>
        </div>
      )}

      <TaxUnresolvedModal
        isOpen={Boolean(taxBlocked)}
        blocked={taxBlocked}
        docPath="quotes"
        docId={id}
        sending={Boolean(sending)}
        onClose={() => setTaxBlocked(null)}
        onRetry={() => {
          const kind = taxBlocked?.kind;
          setTaxBlocked(null);
          // Re-read the quote first: "send with no tax" flipped taxEnabled and
          // the page is still showing the old row. Without this the totals
          // block would keep claiming an unresolved tax on a quote that has
          // just declared it charges none.
          fetch(`/api/quotes/${id}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((fresh) => fresh && setQuote(fresh))
            .catch(() => {})
            .finally(() => doSend(kind));
        }}
      />

      <EmailSectionsBlockedModal
        isOpen={Boolean(blockedSections)}
        quoteId={id}
        blocked={blockedSections?.blocked || []}
        sending={Boolean(sending)}
        onClose={() => setBlockedSections(null)}
        onCleared={(stillBlocked) =>
          setBlockedSections((b) => (b ? { ...b, blocked: stillBlocked } : b))
        }
        onRetry={() => {
          const kind = blockedSections?.kind;
          setBlockedSections(null);
          doSend(kind);
        }}
      />

      {/* What this quote's email will carry beyond the quote itself. Editable
          while the client can still act on it; frozen once they have decided,
          because the email has already been read by then. */}
      <EmailSectionsPanel
        quoteId={id}
        editable={["draft", "sent"].includes(quote.status)}
      />

      {/* Sub-side of a cross-company import: shows if another company pulled
          this quote into their project, with an honest pending/confirmed state.
          Self-hides when it hasn't been imported. */}
      <ImportedByPanel quoteId={id} />

      {/* Importer side: subcontractor costs pulled INTO this quote, removable
          while it's still open. Self-hides when there are none. */}
      <ImportedCostsPanel
        quoteId={id}
        currency={quote.company?.currency}
        editable={["draft", "sent"].includes(quote.status)}
        onTotalChange={(total) => setQuote((q) => ({ ...q, total }))}
      />

      {/* ── The document ──────────────────────────────────────────────────
          Everything below is a mirror of what the client sees: the PDF built
          from lib/documentSections/* and the approval page at /q/[token]. Same
          order, same blocks, same shape.

          data-brand on the <article> scopes BrandTheme's variables to the
          document, so the brand rule, the letterhead mark and the total band
          are the company's colour while the rest of the screen stays
          FieldQuo's. The company is the same object the masthead already
          needed, so this costs no extra request.

          One honest caveat: company arrives by fetch, so the band can paint
          FieldQuo navy for the frame before it lands. Gating the whole document
          on a decoration would be worse — the masthead already degrades to the
          brand mark alone when that request fails, and a document you can read
          beats a document you're waiting for. */}
      <article
        data-brand
        className="bg-card border border-border rounded-2xl overflow-hidden"
      >
        {/* The attribute above and this <style> are deliberately on the same
            element rather than a wrapper: a wrapper is one refactor away from
            being flattened, and the attribute would survive it while the theme
            quietly stopped applying. A custom property set on an element
            resolves for that element's own declarations too, so the article's
            bg-card is themed as well as its children. */}
        <BrandTheme
          brandColor={company?.brandColor}
          brandColors={company?.brandColors}
        />
        {/* The brand rule, before anything else. Two weights of the company's
            own colour, as in HeaderSection's PDF band — it reads as the quote
            being ON their letterhead rather than in a generic frame. */}
        <div className="flex h-1.5" aria-hidden="true">
          <div className="flex-[2] bg-inverted" />
          <div className="flex-1 bg-inverted opacity-50" />
        </div>

        <header className="px-5 sm:px-7 pt-5 pb-4 border-b border-border">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              {company?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={company.logoUrl}
                  alt={company.name || ""}
                  className="h-10 w-auto max-w-[160px] object-contain"
                />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-inverted text-inverted-foreground flex items-center justify-center shrink-0">
                  <Building2 size={18} />
                </div>
              )}
              {/* Only what came back. A placeholder company name here would be
                  inventing the one thing on the page that has to be theirs. */}
              {company?.name && (
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">
                    {company.name}
                  </div>
                  {company.phone && (
                    <div className="text-xs text-muted-foreground truncate">
                      {company.phone}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="sm:text-right shrink-0">
              <div className="text-[11px] font-bold tracking-[0.18em] uppercase text-muted-foreground">
                {labels.quote}
              </div>
              <h1 className="text-xl font-bold text-foreground tabular-nums">
                {quote.quoteNumber}
              </h1>
              <span
                className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${quoteStatusClasses(quote.status)}`}
              >
                {quoteStatusLabel(quote.status, t)}
              </span>
            </div>
          </div>
        </header>

        <div className="px-5 sm:px-7 py-5 border-b border-border grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
              {labels.preparedFor}
            </p>
            <p className="text-base font-semibold text-foreground mt-0.5 break-words">
              {quote.client?.name}
            </p>
            {quote.client?.contactName && (
              <p className="text-sm text-muted-foreground">
                {quote.client.contactName}
              </p>
            )}
            {quote.client?.email && (
              <p className="text-sm text-muted-foreground break-all">
                {quote.client.email}
              </p>
            )}
            {quote.client?.phone && (
              <p className="text-sm text-muted-foreground">
                {quote.client.phone}
              </p>
            )}
            {clientAddress && (
              <p className="text-sm text-muted-foreground">{clientAddress}</p>
            )}
          </div>

          {/* Dates in the company's chosen format, not a hardcoded locale —
              this is staff reading their own data, which is the internal side
              of the split described at the top of lib/format/companyDate.js. */}
          <dl className="text-sm space-y-1 sm:text-right">
            <Fact label={labels.date} value={formatDate(quote.createdAt)} />
            {quote.validUntil && (
              // Borrowed from the quote EDITOR's catalogue rather than adding a
              // seventh translation of "Valid until" — same field, same words,
              // one string to keep right.
              <Fact
                label={t("app.quoteEdit.validUntil")}
                value={formatDate(quote.validUntil)}
              />
            )}
          </dl>
        </div>

        {quote.scopeGroups?.length > 0 && (
          <section className="px-5 sm:px-7 py-5 space-y-3">
            {/* One card per service, as on the approval page. A flat list of
                lines gives a three-trade quote no seams at all, which is how a
                client ends up asking "so what's the painting costing me?" */}
            {quote.scopeGroups.map((group) => (
              <div
                key={group.id}
                className="rounded-xl border border-border overflow-hidden"
              >
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-muted">
                  <h2 className="font-semibold text-foreground text-sm truncate">
                    {group.label || group.category?.label}
                  </h2>
                  {Number(group.subtotal) > 0 && (
                    <span className="text-sm font-semibold text-foreground tabular-nums shrink-0">
                      {money(group.subtotal)}
                    </span>
                  )}
                </div>
                <div className="px-4 py-1">
                  {/* Not group.lineItems directly — a blended subcontractor
                      import's one line repeats the card head above (same
                      label, same amount) word for word, which is what made
                      "Subcontracted work $9,871.68" read as two lines on
                      Q-2026-0014. See lib/quotes/scopeGroupDisplay.js. */}
                  {visibleLineItems(group).map((item, i) => (
                    <div
                      key={i}
                      className="flex justify-between gap-4 text-sm text-foreground py-1.5 border-b border-border last:border-0"
                    >
                      <span className="min-w-0">
                        {item.description}
                        {/* The scope the client will read, shown to staff on
                            the same row. This page is where somebody checks a
                            quote before it goes out, and a paragraph that only
                            appears on the version the homeowner receives is a
                            paragraph nobody proofreads. */}
                        {item.detail ? (
                          <span className="block mt-0.5 text-xs leading-relaxed text-muted-foreground whitespace-pre-line">
                            {item.detail}
                          </span>
                        ) : null}
                        {item.quantity > 1 && (
                          <span className="text-muted-foreground">
                            {" "}
                            × {item.quantity}
                          </span>
                        )}
                      </span>
                      {/* `pricingHidden` means the API removed `amount` from
                          every line. money() coerces a missing amount to zero
                          deliberately — on a client-facing document a visible
                          zero beats "$NaN" — so rendering it here printed
                          "$0.00" beside real work, which is a stronger false
                          claim than saying nothing. The totals block below
                          already replaces itself with the reason; these lines
                          simply drop the column. */}
                      {!quote.pricingHidden && (
                        <span className="tabular-nums shrink-0">
                          {money(item.amount)}
                        </span>
                      )}
                    </div>
                  ))}
                  {/* ── Why this line costs what it costs ──────────────────
                      The takeoff already stores it. `meta` carries the base
                      unit price, the complexity level the estimator chose and
                      the reasons they ticked — and until now this page threw
                      all of it away and printed a bare "Cabinet Refinishing ×
                      37". Somebody looking at a quote three weeks later, or
                      defending it to a client on the phone, had no way to see
                      that $170 was $150 plus a moderate uplift, let alone
                      why.

                      Staff-only, like the rest of this page. The client's copy
                      states the price; this states the reasoning behind it. */}
                  {(group.lineItems || []).map((item, i) =>
                    item?.meta?.complexityLevel ? (
                      <PriceReasoning
                        key={`why${i}`}
                        item={item}
                        money={money}
                      />
                    ) : null,
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ── What the client is actually reading ────────────────────────
            Everything below mirrors the document at /q/<token>, resolved
            through the same helpers so the two cannot drift. It used to live
            only on the client's copy, which meant the estimator defending a
            quote on the phone could not see the sentences they were being
            asked about. */}
        {docContent?.groups?.some(
          (g) => g.included?.length || g.mayChange?.length,
        ) && (
          <Block
            title={t(
              "app.quoteDetail.whatTheClientReads",
              "What this quote says",
            )}
          >
            <div className="space-y-4">
              {docContent.groups
                .filter((g) => g.included?.length || g.mayChange?.length)
                .map((g) => (
                  <div
                    key={g.id}
                    className="border-l-2 pl-3"
                    style={{ borderColor: g.accent }}
                  >
                    <p className="text-sm font-medium text-foreground">
                      {g.label}
                    </p>
                    {g.included?.length > 0 && (
                      <>
                        <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {t(
                            "app.quoteDetail.whatsIncluded",
                            "What's included",
                          )}
                        </p>
                        <ul className="mt-0.5 space-y-0.5">
                          {g.included.map((line) => (
                            <li
                              key={line}
                              className="flex gap-1.5 text-sm text-muted-foreground"
                            >
                              <span aria-hidden="true">·</span>
                              {line}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {g.mayChange?.length > 0 && (
                      <>
                        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {t(
                            "app.quoteDetail.whatCouldChange",
                            "What could change this price",
                          )}
                        </p>
                        <dl className="mt-0.5 space-y-1">
                          {g.mayChange.map((e) => (
                            <div key={e.title}>
                              <dt className="text-sm font-medium text-foreground">
                                {e.title}
                              </dt>
                              <dd className="text-sm text-muted-foreground">
                                {e.body}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </>
                    )}
                  </div>
                ))}
            </div>
          </Block>
        )}

        {docContent?.processSteps?.length > 0 && (
          <Block
            title={t("app.quoteDetail.howTheWorkRuns", "How the work runs")}
          >
            <ol className="space-y-2.5">
              {docContent.processSteps.map((step) => (
                <li key={step.num} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-foreground">
                    {step.num}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {step.title}
                      {/* The duration the client was quoted. Absent for a
                          trade whose content states none — printing a guess
                          here would be printing a commitment. */}
                      {step.timeline && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {step.timeline}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            {docContent.processNotes && (
              <div className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {docContent.processNotes}
                </p>
                {/* Whose words these are. A company default silently printing
                    as if it were written for this job is how a contractor
                    discovers boilerplate on a signed document. */}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {docContent.processNotesSource === "quote"
                    ? t(
                        "app.quoteDetail.notesOnThisQuote",
                        "Written on this quote",
                      )
                    : t(
                        "app.quoteDetail.notesFromCompany",
                        "Your company default — edit the quote to change it for this job only",
                      )}
                </p>
              </div>
            )}
          </Block>
        )}

        {docContent?.paymentTerms && (
          <Block title={t("app.quoteDetail.paymentTerms", "Payment terms")}>
            {docContent.paymentSchedule?.length > 0 ? (
              <ol className="space-y-1">
                {docContent.paymentSchedule.map((stage, i) => (
                  <li
                    key={i}
                    className="flex justify-between gap-3 text-sm text-foreground"
                  >
                    <span>{stage.label}</span>
                    {/* `pct` is already a formatted string ("50%") — see
                        parsePaymentSchedule. This read `stage.percent` and
                        `stage.amount`, neither of which that function has ever
                        returned, so the column rendered empty on every quote
                        with a parseable schedule. Caught by the invoice page
                        landing beside it with the right field name. */}
                    <span className="tabular-nums text-muted-foreground">
                      {stage.pct}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {docContent.paymentTerms}
              </p>
            )}
          </Block>
        )}

        {/* ── What it costs YOU ──────────────────────────────────────────
            Internal. Never on the PDF, never in the email, never on /q/.
            Permission-gated server-side too — /api/quotes/[id]/costing
            answers 403 without job-costing access rather than a body of
            zeroes, because zeroes read as a job that cost nothing. */}
        {costing && (
          <Block title={t("app.quoteDetail.costAndMargin", "Cost & margin")}>
            {/* Nothing left to work the cost out from. Shown INSTEAD of the
                figures, not above them — four boxes reading $0.00 beside a
                margin is the claim we are refusing to make. */}
            {costing.costBasisMissing ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                <p className="font-medium">
                  {t(
                    "app.quoteDetail.noCostBasis",
                    "This quote's cost can't be worked out",
                  )}
                </p>
                <p className="mt-1 text-xs">{costing.costBasisReason}</p>
                {/* This used to link to the editor. The editor has never had
                    a cost panel — the panel lives in the BUILDER and there is
                    no way back to it once a quote is saved. So the remedy sent
                    people to a page that could not perform it: a dead end
                    dressed as a fix, which is worse than no button. */}
                <button
                  type="button"
                  onClick={() => setCostEditorOpen(true)}
                  className="mt-2 inline-flex items-center min-h-[44px] text-xs font-medium underline"
                >
                  {t("app.quoteDetail.costItNow", "Cost it now")}
                </button>
              </div>
            ) : (
              <>
                {!costing.saved && (
                  // The difference between "what we quoted at" and "what it would
                  // cost today" is the whole reason QuoteCosting exists. A page
                  // that showed the second while implying the first would be
                  // quietly rewriting history every time the rate card moved.
                  <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    Nothing was costed when this quote was saved, so these
                    figures are worked out from today&apos;s rates — not what it
                    was priced at. Nobody recorded who was doing the work
                    either, so the hours carry no money.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    [
                      t("app.quoteDetail.labour", "Labour"),
                      t("app.duration.hours", { value: costing.labourHours }),
                      money(costing.labourCost),
                    ],
                    [
                      t("app.quoteDetail.materials", "Materials"),
                      null,
                      money(costing.materialTotal),
                    ],
                    [
                      t("app.quoteDetail.overhead", "Overhead"),
                      costing.overheadBasis === "per_job"
                        ? t("app.quoteDetail.thisJobsShare", "this job's share")
                        : t("app.quoteDetail.estimated", "estimated"),
                      money(costing.overhead),
                    ],
                    [
                      t("app.quoteDetail.totalCost", "Total cost"),
                      null,
                      money(costing.estimatedCost),
                    ],
                  ].map(([label, sub, value]) => (
                    <div
                      key={label}
                      className="rounded-lg border border-border px-3 py-2"
                    >
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {label}
                      </div>
                      <div className="text-sm font-bold tabular-nums text-foreground">
                        {value}
                      </div>
                      {sub && (
                        <div className="text-[11px] text-muted-foreground">
                          {sub}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border pt-3">
                  <span className="text-sm text-muted-foreground">
                    {money(costing.price)} − {money(costing.estimatedCost)} ={" "}
                    <strong className="text-foreground">
                      {money(costing.profit)}
                    </strong>
                  </span>
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      costing.signal === "red"
                        ? "text-red-600 dark:text-red-400"
                        : costing.signal === "amber"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {costing.marginPct == null
                      ? "—"
                      : `${costing.marginPct}% margin`}
                    <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                      {t("app.quoteDetail.target", "target")}{" "}
                      {costing.marginTargetPct}%
                    </span>
                  </span>
                </div>

                {/* Amber on a healthy-looking margin needs explaining, or it reads
                as a broken badge. */}
                {costing.costIncomplete && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                    Some of the work has no cost against it, so the real margin
                    is lower than this.
                  </p>
                )}
                {costing.unpricedMaterials > 0 && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                    {costing.unpricedMaterials} material
                    {costing.unpricedMaterials === 1 ? " has" : "s have"} no
                    price set.
                  </p>
                )}

                {costing.crew?.length > 0 && (
                  <div className="mt-3 border-t border-border pt-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("app.quoteDetail.crew", "Crew")}
                      {costing.blendedRate != null && (
                        <span className="ml-2 font-normal normal-case">
                          {money(costing.blendedRate)}/hr blended
                        </span>
                      )}
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {costing.crew.map((m, i) => (
                        <li
                          key={`${m.name}${i}`}
                          className="flex justify-between gap-3 text-sm"
                        >
                          <span className="text-muted-foreground">
                            {m.name || t("app.quoteDetail.unnamed", "Unnamed")}
                            <span className="ml-2 text-xs">
                              {t("app.duration.hours", { value: m.hours })}
                              {m.hourlyRate != null
                                ? ` × ${money(m.hourlyRate)}`
                                : ""}
                            </span>
                          </span>
                          <span className="tabular-nums text-foreground">
                            {money(m.cost)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {costing.groups?.some((g) => g.materials?.length) && (
                  <div className="mt-3 border-t border-border pt-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t(
                        "app.quoteDetail.billOfMaterials",
                        "Materials this job needs",
                      )}
                    </p>
                    {costing.groups
                      .filter((g) => g.materials?.length)
                      .map((g, gi) => (
                        <div key={gi} className="mt-1.5">
                          <p className="text-xs font-medium text-foreground">
                            {g.label}
                          </p>
                          <ul className="mt-0.5 space-y-0.5">
                            {g.materials.map((m, i) => (
                              <li
                                key={`${m.name}${i}`}
                                className="flex justify-between gap-3 text-xs"
                              >
                                <span className="text-muted-foreground">
                                  {m.name} — {m.qty} {m.unit}
                                </span>
                                {/* Not $0.00. Nobody has priced it, and a zero
                                would read as free. */}
                                {m.unpriced ? (
                                  <span className="shrink-0 text-amber-700 dark:text-amber-400">
                                    {t(
                                      "app.quoteDetail.noPriceSet",
                                      "no price set",
                                    )}
                                  </span>
                                ) : (
                                  <span className="shrink-0 tabular-nums text-foreground">
                                    {money(m.cost)}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}

            {costEditorOpen && (
              <div className="mt-3">
                <QuoteCostEditor
                  quoteId={id}
                  existing={costing.saved ? costing : null}
                  t={t}
                  onSaved={async () => {
                    setCostEditorOpen(false);
                    // Re-read rather than patching state from the response:
                    // the server re-derives every figure, so its answer is the
                    // only one worth showing.
                    const r = await fetch(`/api/quotes/${id}/costing`);
                    if (r.ok) setCosting(await r.json());
                  }}
                />
              </div>
            )}

            {/* Offered on a costed quote too — a rate changes, somebody joins
                the crew, and re-costing should not mean rebuilding the quote. */}
            {!costEditorOpen && !costing.costBasisMissing && (
              <button
                type="button"
                onClick={() => setCostEditorOpen(true)}
                className="mt-3 inline-flex items-center min-h-[44px] text-xs font-medium text-muted-foreground underline hover:text-foreground"
              >
                {costing.saved
                  ? t("app.quoteDetail.editCosting", "Change the costing")
                  : t("app.quoteDetail.costItNow", "Cost it now")}
              </button>
            )}
          </Block>
        )}

        {quote.addOns?.length > 0 && (
          <Block title={t("app.quoteDetail.optionalExtras")}>
            <div className="space-y-1.5">
              {quote.addOns.map((a) => (
                <div key={a.id} className="flex justify-between text-sm gap-3">
                  <span
                    className={
                      a.selected
                        ? "text-foreground font-medium"
                        : "text-muted-foreground"
                    }
                  >
                    {a.description}
                    {a.selected && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300">
                        {t("app.quoteDetail.addedByClient")}
                      </span>
                    )}
                  </span>
                  <span
                    className={`tabular-nums shrink-0 ${
                      a.selected ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {money(a.amount)}
                  </span>
                </div>
              ))}
            </div>
          </Block>
        )}

        {quote.processNotes && (
          <Block title={t("app.quoteEdit.whatHappensNext")}>
            {/* The wash-and-rule callout the approval page gives this text.
                It's the block that answers "what am I agreeing to", so it
                shouldn't read like a footnote here either. */}
            <div className="rounded-lg bg-muted border-l-[3px] border-inverted px-4 py-3">
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {quote.processNotes}
              </p>
            </div>
          </Block>
        )}

        {quote.notes && (
          <Block title={t("app.field.notes")}>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {quote.notes}
            </p>
          </Block>
        )}

        {Array.isArray(quote.clientPhotos) && quote.clientPhotos.length > 0 && (
          <Block title={t("app.quoteDetail.clientMedia")}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {quote.clientPhotos.map((m, i) => (
                <ClientMediaTile
                  key={(typeof m === "string" ? m : m?.url) + i}
                  media={m}
                />
              ))}
            </div>
          </Block>
        )}

        {/* ── The totals, or a sentence saying they are withheld ───────────
            `pricingHidden` is set by the API for a member without the
            showPricing toggle: subtotal, tax and total are ABSENT from the
            payload. Rendering the block anyway prints "$0.00" three times over
            — money() coerces a missing amount to zero deliberately, because on
            a client-facing document a visible zero beats "$NaN" — and a quote
            reading $0.00 is a stronger false claim than one that says nothing.
            So the block is replaced by the reason, not blanked. */}
        {quote.pricingHidden ? (
          <div className="px-5 sm:px-7 py-5 border-t border-border">
            <p className="sm:w-3/5 sm:ml-auto text-sm text-muted-foreground">
              {t(
                "app.access.pricingHidden",
                "Pricing is hidden by your access level. Ask an owner or admin if you need to see it.",
              )}
            </p>
          </div>
        ) : (
        <div className="px-5 sm:px-7 py-5 border-t border-border">
          {/* Right-aligned and narrow above sm, exactly as TotalsSection lays
              the PDF out: a totals block spanning the full width reads as
              another table, kept to a column it reads as a summary. */}
          <div className="sm:w-3/5 sm:ml-auto space-y-1 text-sm">
            <Row
              label={t("app.quoteDetail.subtotal")}
              value={money(quote.subtotal)}
            />
            {/* Only when there is one — a "Discount $0.00" line invites the
                question of why nothing was discounted. */}
            {Number(quote.discount) > 0 && (
              <Row
                label={t("app.quoteEdit.discount")}
                value={`-${money(quote.discount)}`}
              />
            )}
            {/* Not always a figure. See lib/tax/documentTax.js — "$0.00" on a
                tax row is a claim ("worked out, came to nothing") that a
                document with no jurisdiction behind it cannot make. This is
                the office's own copy of what the client will read. */}
            <Row
              label={t("app.quoteDetail.tax")}
              value={
                taxLine.kind === "charged"
                  ? money(quote.tax)
                  : taxLine.kind === "unresolved"
                    ? t("app.tax.line.unresolved")
                    : t("app.tax.line.none")
              }
            />

            {/* The headline figure in a filled band in their colour, matching
                the PDF and the approval page. Everything above it is quiet, so
                the eye lands on the one number that matters instead of reading
                three of similar weight to find it. */}
            <div className="flex items-center justify-between gap-3 rounded-xl bg-inverted text-inverted-foreground px-4 py-3 mt-2">
              <span className="text-xs font-bold uppercase tracking-wide">
                {t("app.quoteDetail.quotedTotal")}
              </span>
              <span className="text-xl font-bold tabular-nums">
                {money(quote.total)}
              </span>
            </div>

            {/* Shown only when it differs, so it reads as news rather than as
                a second total to reconcile. This is the figure the invoice is
                built from. */}
            {quote.acceptedTotal !== null &&
              quote.acceptedTotal !== undefined &&
              Number(quote.acceptedTotal) !== Number(quote.total) && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40 px-4 py-2.5 mt-1.5 text-green-800 dark:text-green-300">
                  <span className="text-xs font-bold uppercase tracking-wide">
                    {t("app.quoteDetail.approvedWithExtras")}
                  </span>
                  <span className="text-base font-bold tabular-nums">
                    {money(quote.acceptedTotal)}
                  </span>
                </div>
              )}
          </div>
        </div>
        )}
      </article>

      <DeleteConfirmModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title={t("app.quoteDetail.deleteTitle")}
        message={t("app.quoteDetail.deleteMessage")}
        itemName={quote.quoteNumber}
        busy={deleting}
      />
    </div>
  );
}

/**
 * One quiet line about the quote callback: why it can't happen, or what
 * happened when somebody asked for it.
 *
 * ── Why every refusal gets its own sentence ────────────────────────────────
 *
 * Because the codes are not interchangeable and neither are the remedies. "No
 * phone number on the client" is fixed on the client; "still waiting for
 * someone to approve the estimate" is fixed in the review queue; the master
 * switch is fixed in settings by somebody who may not be the person reading
 * this. A single "couldn't do that" collapses three different jobs into one
 * shrug — and a shrug is what makes people press the button again.
 *
 * ── Why it borrows the settings card's strings ─────────────────────────────
 *
 * app.setVoice.callback.* already carries a sentence per refusal code in all
 * six languages, written for the same vocabulary the gate decides in. A second
 * translation of "No phone number on the client" is the copy that rots,
 * because it's the one nobody looks at. The one exception is `outbound_off`:
 * that string reads "Automatic calls are switched off", which is an answer
 * about a different feature to somebody who just pressed a manual button, so
 * this surface says which switch and where.
 */
function CallNotice({ gate, result, clientId, clientName }) {
  const { t } = useTranslation();

  if (result?.kind === "queued") {
    return (
      <NoticeLine tone="positive" icon={CheckCircle2}>
        {/* "Shortly", not "calling now". enqueueOutbound writes a task; the
            cron places it within about fifteen minutes. */}
        {t(
          "app.quoteDetail.callQueued",
          "Queued — we'll ring {name} within about 15 minutes.",
          { name: clientName },
        )}
      </NoticeLine>
    );
  }
  if (result?.kind === "already") {
    return (
      <NoticeLine tone="muted" icon={PhoneCall}>
        {t(
          "app.quoteDetail.callAlreadyQueued",
          "A call about this quote is already queued. It'll go out within about 15 minutes.",
        )}
      </NoticeLine>
    );
  }
  if (result?.kind === "error") {
    return (
      <NoticeLine tone="negative" icon={PhoneOff}>
        {result.message}
      </NoticeLine>
    );
  }

  // The server's refusal beats the page's, because it read the row a moment
  // ago and this copy of the quote may be several minutes old.
  const reason =
    result?.kind === "refused"
      ? result.reason
      : gate.allowed
        ? null
        : gate.reason;
  if (!reason) return null;

  const key = callbackReasonKey(reason);
  const text =
    reason === CALLBACK_REFUSED.OFF
      ? t(
          "app.quoteDetail.callOutboundOff",
          "Outbound calling is switched off for your company. An owner can turn it back on in Settings → Phone receptionist.",
        )
      : // A code from a future release that this build has no sentence for
        // falls back to the generic failure. t() renders the KEY when nothing
        // resolves, and a dotted catalogue key on screen is worse than an
        // honest "try again".
        t(key, CALLBACK_REASON_TEXT[key] || t("app.quoteDetail.callError"));

  return (
    <NoticeLine tone="muted" icon={PhoneOff}>
      {text}
      {/* The commonest reason by a distance — the voice settings screen leads
          with it — and the only one with a fix one click away. */}
      {reason === CALLBACK_REFUSED.NO_PHONE && clientId && (
        <>
          {" "}
          <Link
            href={`/app/clients/${clientId}`}
            className="underline font-medium"
          >
            {t("app.quoteDetail.callAddPhone", "Add a phone number")}
          </Link>
        </>
      )}
    </NoticeLine>
  );
}

/** The line itself — right-aligned under the strip, so it reads as belonging
 *  to the buttons above it rather than to the document below. */
function NoticeLine({ tone, icon: Icon, children }) {
  const colour =
    tone === "positive"
      ? "text-green-700 dark:text-green-400"
      : tone === "negative"
        ? "text-red-700 dark:text-red-400"
        : "text-muted-foreground";
  return (
    <div
      className={`-mt-2 flex items-start justify-end gap-1.5 text-sm sm:text-right ${colour}`}
    >
      <Icon size={14} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/**
 * A titled block inside the document.
 *
 * Every section on the PDF and the approval page is introduced by a small
 * heading over a hairline; this keeps that rhythm rather than leaving each
 * block to invent its own spacing.
 */
function Block({ title, children }) {
  return (
    <section className="px-5 sm:px-7 py-5 border-t border-border">
      <h3 className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground mb-2">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** A label/value pair in the document's fact column. */
/**
 * The estimator's reasoning, read back off the stored takeoff.
 *
 * Nothing here is computed: `meta.baseUnitPrice`, `meta.complexityLevel` and
 * `meta.complexityReasons` are what the builder wrote when the quote was
 * priced. Re-deriving them from today's rate card would show what the job
 * WOULD cost now, which is a different and much less useful number than what
 * was actually quoted.
 *
 * Renders nothing when the line carries no complexity — most trades don't.
 */
function PriceReasoning({ item, money }) {
  const meta = item?.meta || {};
  const level = COMPLEXITY_LEVELS.find((l) => l.value === meta.complexityLevel);
  if (!level) return null;

  const base = Number(meta.baseUnitPrice) || 0;
  const rate = Number(item.rate) || 0;
  const uplift = rate - base;

  // Ids are stored; the labels live in one catalogue. An id nobody recognises
  // is dropped rather than printed raw — "deep_damage" on screen is a leak of
  // the database into the office.
  const labels = [];
  for (const list of Object.values(COMPLEXITY_REASONS)) {
    for (const r of list) {
      if ((meta.complexityReasons || []).includes(r.id)) labels.push(r.label);
    }
  }

  return (
    <div className="border-t border-border py-2 text-xs">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium" style={{ color: level.color }}>
          {level.label} complexity
        </span>
        {base > 0 && uplift > 0 && (
          <span className="text-muted-foreground tabular-nums">
            {money(base)} + {money(uplift)} uplift = {money(rate)} per{" "}
            {item.unit || "unit"}
          </span>
        )}
      </div>
      {labels.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-muted-foreground">
          {labels.map((l) => (
            <li key={l} className="flex gap-1.5">
              <span aria-hidden="true">·</span>
              {l}
            </li>
          ))}
        </ul>
      ) : (
        // A level with no reasons ticked is a judgement nobody wrote down.
        // Saying so is more useful than an empty space, because the person
        // reading this is usually about to be asked to justify it.
        <p className="mt-1 text-muted-foreground">
          No reasons were recorded for this level.
        </p>
      )}
    </div>
  );
}

function Fact({ label, value }) {
  return (
    <div>
      <dt className="inline text-muted-foreground">{label} </dt>
      <dd className="inline text-foreground font-medium tabular-nums">
        {value}
      </dd>
    </div>
  );
}

/** A quiet totals line. The loud one is the band, and there is only one. */
function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3 text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/**
 * One line of the email trail.
 *
 * Absolute date AND relative age, because they answer different questions:
 * "when exactly" matters when a client disputes it, "how long ago" is what
 * tells you whether it's time to chase.
 */
function TrailRow({ label, at, detail, tone }) {
  const { t } = useTranslation();
  // The company's chosen ordering, not a hardcoded en-CA. This is staff reading
  // their own audit trail, which is precisely the case Company.dateFormat
  // exists for — and a page that respects the setting in one place and ignores
  // it two inches lower is how a preference stops being believed.
  const { formatDateTime } = useCompanyPreferences();
  const when = new Date(at);
  const days = Math.floor((Date.now() - when.getTime()) / 86400000);
  const ago =
    days === 0
      ? t("app.quoteDetail.today")
      : days === 1
        ? t("app.quoteDetail.yesterday")
        : t("app.quoteDetail.daysAgo", { days });

  return (
    <div className="flex items-baseline justify-between gap-3 flex-wrap text-sm">
      <span
        className={
          tone === "positive"
            ? "font-medium text-green-700 dark:text-green-400"
            : "font-medium text-foreground"
        }
      >
        {label}
        {detail && (
          <span className="font-normal text-muted-foreground"> → {detail}</span>
        )}
      </span>
      <span className="text-muted-foreground tabular-nums">
        {formatDateTime(when)}
        <span className="text-muted-foreground/60"> · {ago}</span>
      </span>
    </div>
  );
}
