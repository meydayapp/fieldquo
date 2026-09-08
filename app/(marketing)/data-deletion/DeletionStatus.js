// app/(marketing)/data-deletion/DeletionStatus.js
//
// "Where is my request?" — the status line behind ?code=FQ-DEL-XXXXXX.
//
// Meta hands the person this URL as the `url` in the callback response, and
// the acknowledgement email tells them to keep the reference, so this is the
// one thing a stranger with a reference can look up. It shows a status and
// two dates and nothing else; /api/data-deletion/status is built to be
// unable to return more (see lib/dataDeletion/constants.js's publicStatus).
//
// Rendered only when the page was opened with a code, so the page without
// one carries no empty "check status" box to wonder about. The code field
// below lets a person correct a mistyped one without editing the URL.
"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetchJson";
import { DELETION_BUSINESS_DAYS } from "@/lib/dataDeletion/constants";

function fmt(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export default function DeletionStatus({ initialCode }) {
  const [code, setCode] = useState(initialCode || "");
  const [lookup, setLookup] = useState(initialCode || "");
  const [state, setState] = useState({ status: "loading", data: null, error: "" });

  useEffect(() => {
    if (!lookup) return;
    let cancelled = false;
    setState({ status: "loading", data: null, error: "" });
    fetchJson(`/api/data-deletion/status?code=${encodeURIComponent(lookup)}`)
      .then((data) => !cancelled && setState({ status: "ready", data, error: "" }))
      .catch((err) => !cancelled && setState({ status: "failed", data: null, error: err?.message || "Couldn't check that reference." }));
    return () => {
      cancelled = true;
    };
  }, [lookup]);

  const { status, data, error } = state;

  return (
    <div className="bg-muted border border-border rounded-xl p-5 text-sm space-y-3 not-prose" role="status">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setLookup(code.trim());
        }}
        className="flex flex-col sm:flex-row gap-2"
      >
        <label htmlFor="dd-code" className="sr-only">
          Reference
        </label>
        <input
          id="dd-code"
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="FQ-DEL-XXXXXX"
          autoComplete="off"
          className="flex-1 border border-border rounded-lg px-4 py-3 text-base font-mono bg-background text-foreground"
        />
        <button
          type="submit"
          className="min-h-[44px] px-5 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
        >
          Check status
        </button>
      </form>

      {status === "loading" && lookup ? <p className="text-muted-foreground">Checking…</p> : null}
      {status === "failed" ? <p className="text-red-700">{error}</p> : null}
      {status === "ready" && data ? (
        data.status === "completed" ? (
          <p className="text-foreground">
            <span className="font-semibold">Completed.</span> Request{" "}
            <span className="font-mono">{data.confirmationCode}</span> was received on{" "}
            {fmt(data.receivedAt)} and the data was deleted on {fmt(data.completedAt)}.
          </p>
        ) : (
          <p className="text-foreground">
            <span className="font-semibold">Received, not yet completed.</span> Request{" "}
            <span className="font-mono">{data.confirmationCode}</span> was received on{" "}
            {fmt(data.receivedAt)}. FieldQuo&apos;s owner deletes the data manually within{" "}
            {DELETION_BUSINESS_DAYS} business days of that date and confirms by email when it is
            done.
          </p>
        )
      ) : null}
    </div>
  );
}
