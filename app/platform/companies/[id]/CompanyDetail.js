// app/platform/companies/[id]/CompanyDetail.js
//
// The screen support actually lives in: who is this company, what are they
// paying, who's on the account, and what can I do about it.
//
// Shows client and quote COUNTS, not the records. Aggregates give support
// enough to answer "are they actually using it?" without putting every
// homeowner's name and address in front of staff as a matter of routine. When
// someone genuinely needs to see a specific client's data, impersonation is
// the path — it writes an audit row, so the access is attributable.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  AlertCircle,
  Loader2,
  Eye,
  Ban,
  Users,
  Mail,
  Globe,
  Phone,
  MapPin,
  AtSign,
  CreditCard,
  Lock,
  Copy,
  Check,
} from "lucide-react";
import { count, money } from "@/app/components/platform/MetricCard";
import { fetchJson } from "@/lib/fetchJson";
import CompanyHistory from "./CompanyHistory";
import CompanyActivity from "./CompanyActivity";
import CompanyHealth from "./CompanyHealth";
import CompanyActions from "./CompanyActions";

const STATUS_STYLES = {
  active: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  pending: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  churned: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900",
};

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function CompanyDetail({ companyId }) {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/platform/companies/${companyId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't load company.");
      setCompany(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(onboardingStatus) {
    const verb = onboardingStatus === "churned" ? "suspend" : "reactivate";
    if (
      !confirm(
        `Are you sure you want to ${verb} ${company.name}? This affects their access.`,
      )
    )
      return;

    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/platform/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't update.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function impersonate() {
    // Asking for a reason is the point, not friction. It goes into the audit
    // row, so months later "why was this account opened on a Sunday" has an
    // answer written by the person who did it.
    const reason = prompt(
      `View ${company.name}'s account read-only for 30 minutes?\n\n` +
        `You won't be able to change anything. This is logged against your name.\n\n` +
        `What are you looking into?`,
    );
    if (reason === null) return;

    setBusy(true);
    setError("");
    try {
      const json = await fetchJson(
        `/api/platform/companies/${companyId}/impersonate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() || null }),
        },
      );
      if (!json?.success) throw new Error("Couldn't start a support session.");
      window.location.href = "/app";
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-accent rounded w-64" />
        <div className="h-40 bg-accent rounded-xl" />
      </div>
    );
  }

  if (error && !company) {
    return (
      <div className="max-w-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-5">
        <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-semibold">
          <AlertCircle size={18} /> {error}
        </div>
        <Link
          href="/platform/companies"
          className="mt-3 inline-block text-sm text-red-700 dark:text-red-300 underline"
        >
          Back to companies
        </Link>
      </div>
    );
  }

  const sub = company.subscription;
  const isChurned = company.onboardingStatus === "churned";

  return (
    <div className="space-y-6">
      <Link
        href="/platform/companies"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} /> Companies
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{company.name}</h1>
            <span
              className={`text-xs px-2.5 py-1 rounded-full border ${
                STATUS_STYLES[company.onboardingStatus] ||
                "bg-muted text-muted-foreground border-border"
              }`}
            >
              {company.onboardingStatus}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Joined {formatDate(company.createdAt)} · /{company.slug}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={impersonate}
            disabled={busy}
            className="inline-flex items-center gap-2 border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:bg-muted disabled:opacity-60"
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Eye size={14} />
            )}
            View account
          </button>

          <button
            onClick={() => setStatus(isChurned ? "active" : "churned")}
            disabled={busy}
            className={`inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60 ${
              isChurned
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "border border-red-300 text-red-700 dark:text-red-300 hover:bg-red-50 dark:bg-red-950/40"
            }`}
          >
            <Ban size={14} />
            {isChurned ? "Reactivate" : "Suspend"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Billing */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-4">Billing</h2>
        {sub ? (
          <dl className="grid gap-4 sm:grid-cols-4">
            <Field label="Plan" value={sub.plan?.name || "—"} />
            <Field
              label="Monthly"
              value={money(sub.plan?.priceMonthly, { compact: true })}
            />
            <Field label="Status" value={sub.status} />
            <Field
              label={sub.trialEndsAt ? "Trial ends" : "Renews"}
              value={formatDate(sub.trialEndsAt || sub.currentPeriodEnd)}
            />
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            No subscription. This company is on a trial or was created
            manually.
            {company.trialEndsAt &&
              ` Trial ends ${formatDate(company.trialEndsAt)}.`}
          </p>
        )}
      </div>

      {/* Usage */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-1">Usage</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Counts only — individual client records aren&apos;t shown here. If you
          need to see their data, &ldquo;View account&rdquo; opens a 30-minute
          read-only session, logged against your name.
        </p>
        <dl className="grid gap-4 sm:grid-cols-4">
          <Field label="Clients" value={count(company._count?.clients)} />
          <Field label="Quotes" value={count(company._count?.quotes)} />
          <Field label="Invoices" value={count(company._count?.invoices)} />
          <Field label="Jobs" value={count(company._count?.jobs)} />
        </dl>
      </div>

      {/* ── Phone numbers ──────────────────────────────────────────────────
          Every one of these is provisioned on FieldQuo's own Retell account
          and billed to FieldQuo monthly, whether or not the tenant's prepaid
          balance ever covers it. The company's own settings screen lists them
          and even warns "don't buy another one, this one is already being
          charged for" — and the person actually paying could not see them at
          all.

          Renders nothing when a company has none, so the panel appears only
          for the tenants it says something about. */}
      {company.voiceNumbers?.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-1">Phone numbers</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Billed to FieldQuo on our provider account, monthly, from the day
            they are created. Anything not <strong>active</strong> is rent going
            out on a line nothing can answer.
          </p>
          <div className="divide-y divide-border">
            {company.voiceNumbers.map((n) => {
              const live = n.status === "active";
              return (
                <div
                  key={n.id}
                  className="flex items-center justify-between gap-3 py-2.5 flex-wrap"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground tabular-nums">
                      {n.e164}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {n.source} · {String(n.numberType || "").replace("_", "-")}
                      {n.createdAt
                        ? ` · since ${new Date(n.createdAt).toLocaleDateString()}`
                        : ""}
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full shrink-0 ${
                      live
                        ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300"
                        : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {n.status}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Named rather than merely coloured. A stuck number is money
              leaving on something the tenant cannot use — this is the side
              that has to notice.

              This used to end "nothing in the app can repair one", which was
              written before anyone asked the provider and is no longer true:
              lib/voice/diagnose.js reads the real state and the contractor now
              has a Fix button for the faults that are ours. So the count is
              still named, and the verdict is printed beside it — support and
              the contractor should be reading the same sentence.

              Still read-only. There is no repair control here on purpose
              (non-negotiable #3): support talks the customer through pressing
              their own button. */}
          {company.voiceNumbers.some((n) => n.status !== "active") && (
            <div className="text-xs text-amber-700 dark:text-amber-400 mt-3 space-y-1">
              <p>
                {company.voiceNumbers.filter((n) => n.status !== "active").length} of{" "}
                {company.voiceNumbers.length} are not active.
              </p>
              {company.voiceDiagnosis?.verdict ? (
                <>
                  <p>
                    Provider says: <span className="font-semibold">{company.voiceDiagnosis.verdict}</span>
                    {company.voiceDiagnosis.side ? ` · ${company.voiceDiagnosis.side}'s end` : ""}
                    {company.voiceDiagnosis.billing ? " · being billed" : " · not being billed"}
                  </p>
                  <p className="text-muted-foreground">
                    {company.voiceDiagnosis.repairable
                      ? "The company can fix this themselves from Settings → Phone receptionist."
                      : "Not repairable from the app — this one needs a person."}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">
                  No live diagnosis — either the phone provider isn&apos;t
                  configured on this deployment, or it couldn&apos;t be reached.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* The full company record.
          Mirrors /app/settings/company so support and the customer are looking
          at the same fields while on the phone — "what does it say under tax
          number?" should have one answer, not two.

          Read-only by design. Support diagnoses and talks the customer through
          the fix; there is no write path here, so there is nothing to get
          wrong on someone else's live account. */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
          <h2 className="font-semibold text-foreground">Company record</h2>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-full px-2.5 py-1">
            <Lock size={11} /> Read-only
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-5">
          Everything they see under Settings → Company. To change any of it,
          walk them through it on their side.
        </p>

        <Group title="Contact">
          <Field
            label="Business email"
            icon={Mail}
            value={company.email}
            copyable
          />
          <Field label="Phone" icon={Phone} value={company.phone} copyable />
          <Field label="Website" icon={Globe} value={company.website} />
          <Field
            label="Address"
            icon={MapPin}
            value={[
              company.address,
              company.city,
              company.province,
              company.postalCode,
              company.country,
            ]
              .filter(Boolean)
              .join(", ")}
          />
        </Group>

        <Group title="Tax & payment">
          <Field
            label="Tax rate"
            value={
              company.taxRate != null ? `${Number(company.taxRate)}%` : null
            }
          />
          <Field
            label="Tax ID"
            value={
              company.taxIdNumber
                ? `${company.taxIdName || "Tax ID"} ${company.taxIdNumber}`
                : null
            }
          />
          <Field
            label="Auto local tax"
            value={company.autoApplyLocalTax ? "On" : "Off"}
          />
          <Field label="Payment terms" value={company.paymentTerms} />
          <Field
            label="Accepted methods"
            value={(company.paymentMethods || [])
              .map((m) => m.replace(/_/g, " "))
              .join(", ")}
          />
          <Field
            label="Default material markup"
            value={
              company.defaultMaterialMarkupPercent != null
                ? `${Number(company.defaultMaterialMarkupPercent)}%`
                : null
            }
          />
        </Group>

        <Group title="Regional">
          <Field label="Timezone" value={company.timezone} />
          <Field label="Date format" value={company.dateFormat} />
          <Field
            label="Week starts"
            value={company.weekStartsOn === 1 ? "Monday" : "Sunday"}
          />
          <Field
            label="Default language"
            value={String(company.defaultLanguage || "en").toUpperCase()}
          />
          <Field
            label="Sends in"
            value={
              (company.sendLanguages || []).length
                ? company.sendLanguages.map((l) => l.toUpperCase()).join(", ")
                : null
            }
          />
        </Group>

        <Group title="Branding">
          <Field
            label="Logo"
            value={
              company.logoUrl ? (
                <a
                  href={company.logoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-foreground"
                >
                  View
                </a>
              ) : null
            }
          />
          <Field
            label="Brand colour"
            value={
              company.brandColor ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                    style={{ backgroundColor: company.brandColor }}
                  />
                  <span className="font-mono text-xs">
                    {company.brandColor}
                  </span>
                </span>
              ) : null
            }
          />
        </Group>

        <Group title="Integrations & public presence">
          <Field
            label="Sending domain"
            icon={AtSign}
            value={
              company.emailDomain
                ? `${company.emailFromLocal || "quotes"}@${company.emailDomain} (${company.emailDomainStatus})`
                : "Shared FieldQuo domain"
            }
          />
          <Field
            label="Stripe"
            icon={CreditCard}
            value={
              company.stripeChargesEnabled
                ? "Connected, charges enabled"
                : company.stripeAccountId
                  ? "Connected, onboarding not finished"
                  : null
            }
          />
          <Field
            label="Booking page"
            value={company.bookingSlug ? `/book/${company.bookingSlug}` : null}
          />
          {/* Was "Published"/"Not published", read off a flag with no site
              behind it — so this console told FieldQuo staff a company had a
              live website that has never existed. Says what's true instead:
              the address is reserved, the feature isn't built. */}
          <Field label="Public site" value="Not available yet" />
          <Field
            label="In the directory"
            value={company.discoverable ? "Yes" : "No"}
          />
          <Field label="Industries" value={(company.industries || []).join(", ")} />
        </Group>

        <Group title="Account">
          <Field label="Company ID" value={company.id} mono copyable />
          <Field label="Slug" value={company.slug} mono />
          <Field label="Referral code" value={company.referralCode} mono />
          <Field label="Referred by" value={company.referredByCode} mono />
          <Field label="Created" value={formatDate(company.createdAt)} />
          <Field label="Last change" value={formatDate(company.updatedAt)} />
        </Group>
      </div>

      {/* Health first — the read that decides how the whole call goes. */}
      <CompanyHealth companyId={companyId} />

      {/* Financial history — subscription and their own client billing */}
      <CompanyHistory companyId={companyId} />

      {/* Support actions — billing only, each audited with a reason */}
      <CompanyActions
        companyId={companyId}
        companyName={company.name}
        trialEndsAt={company.trialEndsAt}
        onDone={load}
      />

      {/* Action trail — who did what inside the company's own app */}
      <CompanyActivity companyId={companyId} />

      {/* Team */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Users size={16} className="text-muted-foreground" />
          Team ({count(company.members?.length)})
        </h2>
        {company.members?.length ? (
          <div className="divide-y divide-border">
            {company.members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between py-3 gap-4"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {m.user?.name || "Unnamed"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {m.user?.email}
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No members yet — the owner hasn&apos;t completed signup.
          </p>
        )}
      </div>
    </div>
  );
}

function Group({ title, children }) {
  return (
    <div className="py-4 border-t border-border first:border-t-0 first:pt-0">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        {title}
      </h3>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>
    </div>
  );
}

function Field({ label, value, icon: Icon, muted, mono, copyable }) {
  const [copied, setCopied] = useState(false);

  // An empty value is information — it's usually the answer to "why isn't
  // their quote showing a tax number?" So say "Not set" in grey rather than
  // rendering a dash that reads like a layout artefact.
  const empty =
    value == null || value === "" || (typeof value === "string" && !value.trim());

  async function copy() {
    if (typeof value !== "string") return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the text is on screen to select by hand */
    }
  }

  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon size={12} />}
        {label}
      </dt>
      <dd
        className={`mt-1 text-sm flex items-center gap-2 ${
          empty || muted ? "text-muted-foreground" : "text-foreground"
        } ${mono && !empty ? "font-mono text-xs" : ""}`}
      >
        <span className="truncate">{empty ? "Not set" : value}</span>
        {copyable && !empty && typeof value === "string" && (
          <button
            onClick={copy}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label={`Copy ${label}`}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        )}
      </dd>
    </div>
  );
}
