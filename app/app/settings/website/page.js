// app/app/settings/website/page.js
//
// Thin shell. Loads the data once and hands it to Builder.
//
// ── Why this page shrank from ~1,060 lines to this ─────────────────────────
//
// It used to BE the whole builder: an interview accordion, a style picker, a
// layout picker, a per-section block editor, an image uploader, a subdomain
// field, an SEO panel and a device-framed preview — all on screen at once.
//
// Most of it existed to collect information FieldQuo already holds. The company's
// name, trades, phone, email, address, logo, brand colour, opening hours,
// services and booking availability are all on the company record, and the site
// reads them live. A form asking for them again is work for no gain, and it
// buried the one control that matters.
//
// The interface is now a prompt and a conversation (Builder.js), and it asks only
// for what is genuinely missing (lib/site/gaps.js). The section-level editing a
// company occasionally needs moved to SectionEditor.js, behind one disclosure,
// rather than being the first thing they see.
//
// ── The preview is still the real renderer ─────────────────────────────────
//
// SiteBlocks is a server component, so it can't be dropped into a client page.
// Rather than reimplement it — which guarantees the preview and the live page
// drift — the preview is an iframe pointing at the real route. What the company
// sees is literally what a visitor gets.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import Builder from "./Builder";

export default function WebsiteSettingsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await fetchJson("/api/settings/website"));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-10 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
        <AlertCircle size={15} className="mt-0.5 shrink-0" />
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-24">
        <Loader2 size={16} className="animate-spin" /> Loading your website…
      </div>
    );
  }

  return <Builder data={data} onReload={load} />;
}
