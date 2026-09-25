// app/components/platform/MailboxHealthCard.js
//
// /platform overview: connected work mailboxes (Settings › Work email) by
// provider, the sync errors, and — always, because it is the constraint the
// owner has to act on — Google's restricted-scope limit on Gmail.
//
// Counts and error sentences only; /api/platform/mailbox-health returns no
// address, subject or body.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox } from "lucide-react";

const PROVIDER_LABEL = { google: "Google", microsoft: "Microsoft 365", imap: "IMAP (other hosts)" };

export default function MailboxHealthCard() {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/platform/mailbox-health")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 text-sm text-muted-foreground">
        Connected mailboxes: the health check could not be loaded.
      </div>
    );
  }
  if (!data) return null;

  const providers = ["google", "microsoft", "imap"];
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Inbox size={18} className="text-muted-foreground" />
        <h2 className="font-semibold text-foreground">Connected work mailboxes</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {providers.map((p) => {
          const c = data.counts?.[p] || { connected: 0, error: 0, disconnected: 0 };
          const avail = data.providers?.[p];
          return (
            <div key={p} className="border border-border rounded-lg p-3">
              <div className="text-sm font-medium text-foreground">{PROVIDER_LABEL[p]}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {c.connected || 0} connected · {c.error || 0} failing · {c.disconnected || 0} disconnected
              </div>
              {avail && !avail.available && (
                <div className="text-xs text-amber-800 dark:text-amber-300 mt-1">Not set up: {avail.missing.join(", ")}</div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {data.sending} company mailbox{data.sending === 1 ? "" : "es"} sending client email.
      </p>
      <p className="text-xs text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900 rounded-lg p-2">
        Gmail uses gmail.readonly (and gmail.send to send), which Google classes as RESTRICTED. Until the app passes Google&apos;s
        verification and the annual security assessment (CASA), only the Google accounts listed as test users on the OAuth consent
        screen can connect — 100 at most — and each sees an &quot;unverified app&quot; warning. Steps: docs/GMAIL-MAILBOX.md.
      </p>
      {data.errors?.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-foreground mb-1">Sync errors</div>
          <ul className="space-y-1">
            {data.errors.map((e) => (
              <li key={e.id} className="text-xs text-muted-foreground">
                {e.company ? (
                  <Link href={`/platform/companies/${e.company.id}`} className="underline underline-offset-2">
                    {e.company.name}
                  </Link>
                ) : (
                  "—"
                )}{" "}
                · {PROVIDER_LABEL[e.provider] || e.provider} · {e.error}
                {e.at ? ` · ${new Date(e.at).toLocaleString()}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
