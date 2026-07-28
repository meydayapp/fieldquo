// app/app/jobs/new/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

export default function NewJobPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Support being opened pre-scoped to a client (e.g. from a client page).
  const presetClientId = searchParams.get("clientId");

  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState(presetClientId || "");
  const [title, setTitle] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setClients(Array.isArray(data) ? data : []));
  }, []);

  const filteredClients = clients.filter((c) =>
    c.name?.toLowerCase().includes(clientSearch.toLowerCase()),
  );
  const selectedClient = clients.find((c) => c.id === selectedClientId);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!selectedClientId) {
      setError("Select a client for this job");
      return;
    }
    if (!title.trim()) {
      setError("Job title is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClientId,
          title,
          recurring,
          recurrenceRule: recurring ? recurrenceRule : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // The API gates POST on the job:create permission — surface that
        // clearly rather than a generic failure.
        throw new Error(
          res.status === 403
            ? "You don't have permission to create jobs."
            : data.error || "Could not create job",
        );
      }
      router.push(`/app/jobs/${data.id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/app/jobs"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft size={14} /> Back to Jobs
        </Link>
        <h1 className="text-2xl font-bold text-foreground">New Job</h1>
      </div>

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
            Client <span className="text-red-500">*</span>
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
                Change
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
                  placeholder="Search clients..."
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
                {filteredClients.length === 0 && (
                  <p className="px-3 py-3 text-sm text-muted-foreground">
                    No clients found.{" "}
                    <Link
                      href="/app/clients/new"
                      className="text-foreground underline"
                    >
                      Add one
                    </Link>
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-foreground block mb-1">
            Job title <span className="text-red-500">*</span>
          </label>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Kitchen cabinet refinishing"
          />
        </div>

        <label className="flex items-center gap-2.5 text-sm text-foreground">
          <input
            type="checkbox"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
          />
          This is a recurring job
        </label>

        {recurring && (
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              Recurrence
            </label>
            <select
              className={inputClass}
              value={recurrenceRule}
              onChange={(e) => setRecurrenceRule(e.target.value)}
            >
              <option value="">Select frequency...</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/app/jobs"
            className="text-sm font-medium text-muted-foreground px-4 py-2.5"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="bg-inverted text-inverted-foreground px-6 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Creating..." : "Create Job"}
          </button>
        </div>
      </form>
    </div>
  );
}
