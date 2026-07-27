// app/components/settings/ReplyToPromptModal.js
//
// Prompts a company to set its contact email if it hasn't already.
//
// This exists because of a failure mode that is invisible to everyone
// involved: emails to clients set Reply-To from Company.email. When that's
// blank, a client hitting "reply" on their quote sends to the From address —
// an unmonitored sending address — and the mail vanishes. The client believes
// they answered. The company believes the client ghosted them.
//
// There's a server-side safety net (resolveSender falls back to the account
// owner's login email), but that's a backstop, not a good answer: the owner's
// personal signup address usually isn't where a business wants client
// correspondence. So we ask, once, in the places where email actually matters.
"use client";

import { useEffect, useState } from "react";
import { Mail, X } from "lucide-react";

export default function ReplyToPromptModal({
  // Where the prompt is being shown, purely for the explanatory copy.
  context = "emails",
  onSaved,
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/business-info")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        // Only nag when it's actually missing.
        if (!data?.email) setOpen(true);
      })
      .catch(() => {})
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    const value = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      setError("Enter a valid email address.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings/business-info", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      if (!res.ok) throw new Error();
      onSaved?.(value);
      setOpen(false);
    } catch {
      setError("Couldn't save that. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (checking || !open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
              <Mail size={16} className="text-amber-600" />
            </span>
            <h2 className="text-lg font-semibold text-gray-900">
              Where should client replies go?
            </h2>
          </div>
          {/* Dismissible: this is important, but blocking someone out of their
              own settings over it would be worse. */}
          <button
            onClick={() => setOpen(false)}
            aria-label="Dismiss"
            className="text-gray-400 hover:text-gray-600 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-gray-500 mt-2 mb-4">
          You haven&apos;t set a company email yet. When a client replies to
          one of your {context}, that&apos;s the inbox it lands in — use an
          address you actually read. Nothing new gets created; this is just
          telling us where to point replies.
        </p>

        <input
          type="email"
          autoFocus
          placeholder="you@yourcompany.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
        />
        {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button
            onClick={() => setOpen(false)}
            className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50"
          >
            Later
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
