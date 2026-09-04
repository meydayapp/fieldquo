// app/app/jobs/new/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import { fetchArray } from "@/lib/loadState";
import { useHasLevel } from "@/app/providers/PermissionProvider";
import { CALLBACK_REASONS, CALLBACK_REASON_LABEL_KEYS } from "@/lib/jobs/callbackReasons";
// The picker's options and their words both come from the module that does the
// scheduling. Two hand-written lists beside one Set was the bug waiting to
// happen: a fourth rule added to RECURRENCE_RULES and not offered here is
// invisible, and one offered here that the scheduler doesn't know is a job that
// repeats on paper and never on the calendar.
import { RECURRENCE_RULES, RECURRENCE_LABEL_KEYS } from "@/lib/jobs/recurrence";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

export default function NewJobPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Support being opened pre-scoped to a client (e.g. from a client page).
  const presetClientId = searchParams.get("clientId");
  // Opened from a job's own page as "log a callback job" — see
  // Job.originalJobId's own comment for why a big-enough return gets its own
  // job rather than one more visit on the original.
  const originalJobId = searchParams.get("originalJobId");

  // null until /api/clients answers. `[]` here is a CLAIM that this company has
  // no clients, and the picker below turns that claim into "No clients found.
  // Add one" — an invitation to re-key a client book that is sitting right
  // there behind a 403. See lib/loadState.js.
  const [clients, setClients] = useState(null);
  const [clientsErrorKey, setClientsErrorKey] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState(presetClientId || "");
  const [title, setTitle] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState("");
  const [originalJob, setOriginalJob] = useState(null);
  const [callbackReason, setCallbackReason] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!originalJobId) return;
    (async () => {
      try {
        const res = await fetch(`/api/jobs/${originalJobId}`);
        if (!res.ok) return;
        const data = await res.json();
        setOriginalJob(data);
        if (!title) setTitle(t("app.jobNew.callbackTitle", "Callback: {title}", { title: data.title }));
      } catch {
        /* the banner below just won't have a title — the form still works */
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, [originalJobId]);

  // The same rule POST /api/jobs enforces. It refused correctly and this screen
  // did not: QA reached the full form by direct URL, filled it in, and the save
  // came back 403. The list page no longer offers the link; this is the door it
  // used to point at, and a URL somebody has bookmarked still opens it.
  const canCreate = useHasLevel("jobs", "view_create_edit");

  useEffect(() => {
    // An empty client list blocks job creation, so a failed load must not be
    // silent — and it must not be redrawn as an empty client book either. The
    // toast this used to raise scrolled away; the panel underneath kept saying
    // "No clients found", which is the sentence people believe.
    (async () => {
      const result = await fetchArray("/api/clients");
      if (result.aborted) return;
      if (result.ok) {
        setClients(result.data);
        setClientsErrorKey("");
      } else {
        setClientsErrorKey(result.errorKey);
      }
    })();
  }, []);

  const filteredClients = (clients ?? []).filter((c) =>
    c.name?.toLowerCase().includes(clientSearch.toLowerCase()),
  );
  const selectedClient = (clients ?? []).find((c) => c.id === selectedClientId);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!selectedClientId) {
      setError(t("app.jobNew.selectClient"));
      return;
    }
    if (!title.trim()) {
      setError(t("app.jobNew.titleRequired"));
      return;
    }
    if (originalJobId && !callbackReason) {
      setError(t("app.jobNew.callbackReasonRequired", "Say why this is a callback."));
      return;
    }
    // "This is a recurring job" with no frequency picked was a dead control.
    // createJob stores `recurring: true, recurrenceRule: null`, and
    // lib/jobs/recurrence.js only schedules a second visit when the rule is one
    // of RECURRENCE_RULES — so the job read as repeating on its own page and
    // nothing ever came round. The tick has to carry a rule or it means nothing.
    if (recurring && !RECURRENCE_RULES.has(recurrenceRule)) {
      setError(t("app.jobNew.selectFrequency"));
      return;
    }
    setSaving(true);
    try {
      // fetchJson, not fetch + res.json(): a 500 from this route returns Next's
      // HTML error page, and parsing that threw the browser's own JSON
      // complaint at the contractor instead of the API's sentence.
      const data = await fetchJson("/api/jobs", {
        method: "POST",
        body: {
          clientId: selectedClientId,
          title,
          recurring,
          recurrenceRule: recurring ? recurrenceRule : null,
          ...(originalJobId && { originalJobId, callbackReason }),
        },
      });
      router.push(`/app/jobs/${data.id}`);
    } catch (err) {
      // The API gates POST on the job:create permission — name that rather
      // than letting the generic 403 sentence stand.
      setError(err.status === 403 ? t("app.jobNew.noPermission") : err.message);
      setSaving(false);
    }
  }

  const header = (
    <div>
      <Link
        href="/app/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2"
      >
        <ArrowLeft size={14} /> {t("app.job.backToJobs")}
      </Link>
      <h1 className="text-2xl font-bold text-foreground">{t("app.jobs.new")}</h1>
    </div>
  );

  if (!canCreate) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
        {header}
        <div className="bg-muted border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground">
          {t(
            "app.access.cannotCreateJob",
            "Your access level lets you view jobs, not create them. Ask an owner or admin if you need to start one.",
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      {header}

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-card border border-border rounded-xl p-5 space-y-4"
      >
        <div>
          <label className="text-sm font-medium text-foreground block mb-1">
            {t("app.job.client")} <span className="text-red-500">*</span>
          </label>
          {selectedClient ? (
            <div className="flex items-center justify-between border border-border rounded-lg px-3 py-2.5">
              <span className="text-sm font-medium text-foreground">
                {selectedClient.name}
              </span>
              <button
                type="button"
                onClick={() => setSelectedClientId("")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {t("app.jobNew.change")}
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder={t("app.clients.search")}
                  className={`${inputClass} pl-9`}
                />
              </div>
              <div className="border border-border rounded-lg divide-y divide-border mt-2 max-h-48 overflow-y-auto">
                {filteredClients.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => setSelectedClientId(c.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                  >
                    {c.name}
                  </button>
                ))}
                {/* Four states, four answers. "No clients found. Add one" is
                    only true once the server has said so — on a refused or
                    failed read it is an invitation to re-key a client book
                    that already exists. */}
                {clientsErrorKey ? (
                  <p className="px-3 py-3 text-sm text-red-700 dark:text-red-300">
                    {t(clientsErrorKey)}
                  </p>
                ) : clients === null ? (
                  <p className="px-3 py-3 text-sm text-muted-foreground">
                    {t("app.state.loading")}
                  </p>
                ) : (
                  filteredClients.length === 0 && (
                    <p className="px-3 py-3 text-sm text-muted-foreground">
                      {t("app.jobNew.noClients")}{" "}
                      <Link
                        href="/app/clients/new"
                        className="text-foreground underline"
                      >
                        {t("app.jobNew.addOne")}
                      </Link>
                    </p>
                  )
                )}
              </div>
            </>
          )}
        </div>

        {originalJobId && (
          <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 space-y-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {t(
                "app.jobNew.callbackBanner",
                "This job is a callback for {title} — it will show on that job's page, and count toward the rework/callback rate on the KPI dashboard.",
                { title: originalJob?.title || originalJobId },
              )}
            </p>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">
                {t("app.jobNew.callbackReason", "Why are you going back?")} <span className="text-red-500">*</span>
              </label>
              <select
                className={inputClass}
                value={callbackReason}
                onChange={(e) => setCallbackReason(e.target.value)}
              >
                <option value="">{t("app.jobNew.selectReason", "Select a reason")}</option>
                {CALLBACK_REASONS.map((reason) => {
                  const [key, fallback] = CALLBACK_REASON_LABEL_KEYS[reason];
                  return (
                    <option key={reason} value={reason}>
                      {t(key, fallback)}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-foreground block mb-1">
            {t("app.jobNew.jobTitle")} <span className="text-red-500">*</span>
          </label>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("app.jobNew.titlePlaceholder")}
          />
        </div>

        <label className="flex items-center gap-2.5 text-sm text-foreground">
          <input
            type="checkbox"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
          />
          {t("app.jobNew.recurringJob")}
        </label>

        {recurring && (
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              {t("app.jobNew.recurrence")}
            </label>
            <select
              className={inputClass}
              value={recurrenceRule}
              // Native validation as well as the guard in handleSubmit: the
              // browser's own message is already in the reader's language, and
              // it points at the field rather than at a banner above the fold.
              required
              onChange={(e) => setRecurrenceRule(e.target.value)}
            >
              <option value="">{t("app.jobNew.selectFrequency")}</option>
              {[...RECURRENCE_RULES].map((rule) => (
                <option key={rule} value={rule}>
                  {t(RECURRENCE_LABEL_KEYS[rule] || "", rule)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/app/jobs"
            className="text-sm font-medium text-muted-foreground px-4 py-2.5"
          >
            {t("app.action.cancel")}
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="bg-inverted text-inverted-foreground px-6 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
          >
            {saving ? t("app.jobNew.creating") : t("app.jobNew.createJob")}
          </button>
        </div>
      </form>
    </div>
  );
}
