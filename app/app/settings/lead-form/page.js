// app/app/settings/lead-form/page.js
"use client";

import { useState, useEffect } from "react";
import { Copy, Check } from "lucide-react";

export default function LeadFormPage() {
  const [slug, setSlug] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/settings/business-info")
      .then((r) => r.json())
      .then((data) => setSlug(data.bookingSlug || data.slug || ""));
  }, []);

  const embedCode = `<iframe src="${typeof window !== "undefined" ? window.location.origin : ""}/book/${slug}" width="100%" height="600" style="border:none;"></iframe>`;

  function handleCopy() {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Lead Capture Form</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Embed this on your own website so visitors can request a quote
          directly.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-foreground text-sm">Embed code</h2>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-muted-foreground"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="bg-muted border border-border rounded-lg p-3 text-xs overflow-x-auto">
          {embedCode}
        </pre>
      </div>

      <p className="text-xs text-muted-foreground">
        Requests submitted through this form show up in your Leads pipeline
        automatically.
      </p>
    </div>
  );
}
