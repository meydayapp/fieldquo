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
  LogIn,
  Ban,
  Users,
  Mail,
  Globe,
} from "lucide-react";
import { count, money } from "@/app/components/platform/MetricCard";

const STATUS_STYLES = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  churned: "bg-red-50 text-red-700 border-red-200",
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
    if (
      !confirm(
        `Sign in as ${company.name}? This is recorded in the audit log with your name against it.`,
      )
    )
      return;

    setBusy(true);
    try {
      const res = await fetch(
        `/api/platform/companies/${companyId}/impersonate`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't impersonate.");
      window.location.href = "/app";
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-64" />
        <div className="h-40 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  if (error && !company) {
    return (
      <div className="max-w-lg bg-red-50 border border-red-200 rounded-xl p-5">
        <div className="flex items-center gap-2 text-red-700 font-semibold">
          <AlertCircle size={18} /> {error}
        </div>
        <Link
          href="/platform/companies"
          className="mt-3 inline-block text-sm text-red-700 underline"
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
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={14} /> Companies
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
            <span
              className={`text-xs px-2.5 py-1 rounded-full border ${
                STATUS_STYLES[company.onboardingStatus] ||
                "bg-gray-50 text-gray-600 border-gray-200"
              }`}
            >
              {company.onboardingStatus}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Joined {formatDate(company.createdAt)} · /{company.slug}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={impersonate}
            disabled={busy}
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <LogIn size={14} />
            )}
            Sign in as
          </button>

          <button
            onClick={() => setStatus(isChurned ? "active" : "churned")}
            disabled={busy}
            className={`inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60 ${
              isChurned
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "border border-red-300 text-red-700 hover:bg-red-50"
            }`}
          >
            <Ban size={14} />
            {isChurned ? "Reactivate" : "Suspend"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Billing */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Billing</h2>
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
          <p className="text-sm text-gray-500">
            No subscription. This company is on a trial or was created
            manually.
            {company.trialEndsAt &&
              ` Trial ends ${formatDate(company.trialEndsAt)}.`}
          </p>
        )}
      </div>

      {/* Usage */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-1">Usage</h2>
        <p className="text-xs text-gray-500 mb-4">
          Counts only — individual client records aren&apos;t shown here. Use
          &ldquo;Sign in as&rdquo; if you need to see their data, which records
          an audit entry.
        </p>
        <dl className="grid gap-4 sm:grid-cols-4">
          <Field label="Clients" value={count(company._count?.clients)} />
          <Field label="Quotes" value={count(company._count?.quotes)} />
          <Field label="Invoices" value={count(company._count?.invoices)} />
          <Field label="Jobs" value={count(company._count?.jobs)} />
        </dl>
      </div>

      {/* Contact & config */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Details</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Email"
            icon={Mail}
            value={company.email || "Not set"}
            muted={!company.email}
          />
          <Field label="Phone" value={company.phone || "Not set"} muted={!company.phone} />
          <Field
            label="Sending domain"
            icon={Globe}
            value={
              company.emailDomain
                ? `${company.emailDomain} (${company.emailDomainStatus})`
                : "Shared FieldQuo domain"
            }
          />
          <Field
            label="Stripe"
            value={
              company.stripeChargesEnabled
                ? "Connected, charges enabled"
                : company.stripeAccountId
                  ? "Connected, not yet enabled"
                  : "Not connected"
            }
            muted={!company.stripeAccountId}
          />
        </dl>
      </div>

      {/* Team */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users size={16} className="text-gray-400" />
          Team ({count(company.members?.length)})
        </h2>
        {company.members?.length ? (
          <div className="divide-y divide-gray-100">
            {company.members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between py-3 gap-4"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {m.user?.name || "Unnamed"}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {m.user?.email}
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 shrink-0">
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            No members yet — the owner hasn&apos;t completed signup.
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, icon: Icon, muted }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
        {Icon && <Icon size={12} />}
        {label}
      </dt>
      <dd
        className={`mt-1 text-sm ${muted ? "text-gray-400" : "text-gray-900"}`}
      >
        {value}
      </dd>
    </div>
  );
}
