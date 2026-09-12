// app/components/help-centre/HelpSearch.js
//
// Client-side search over a generated index — one JSON per language, built
// by scripts/build-help-content.mjs from every article's title, headings
// and first paragraph. No external service, no API: the index is a static
// file the browser fetches once, on the first keystroke, and searches in
// memory. Three hundred articles is a few hundred kilobytes; a driveway
// connection copes.
//
// Scoring is deliberately simple and visible: a title hit outranks a heading
// hit outranks a body hit, and every query word must appear somewhere. No
// stemming — a French reader typing "facture" should not be handed
// "facturation" ahead of the article actually called Factures.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { helpPath, searchIndexSrc } from "@/lib/help/urls";

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

function score(entry, words) {
  let total = 0;
  for (const w of words) {
    if (entry._title.includes(w)) total += 10;
    else if (entry._headings.includes(w)) total += 4;
    else if (entry._body.includes(w)) total += 1;
    else return 0; // every word must hit
  }
  return total;
}

export default function HelpSearch({ lang, placeholder, label, noneLabel, countLabel, categoryLabels, autoFocus = false, compact = false }) {
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!q.trim() || index || failed) return;
    let cancelled = false;
    fetch(searchIndexSrc(lang))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((rows) => {
        if (cancelled) return;
        setIndex(
          rows.map((e) => ({
            ...e,
            _title: norm(e.title),
            _headings: norm((e.headings || []).join(" ")),
            _body: norm(e.body),
          })),
        );
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [q, lang, index, failed]);

  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const results = useMemo(() => {
    const words = norm(q).split(/\s+/).filter((w) => w.length > 1);
    if (!index || !words.length) return [];
    return index
      .map((e) => ({ e, s: score(e, words) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 12)
      .map((r) => r.e);
  }, [index, q]);

  const showPanel = open && q.trim().length > 1;

  return (
    <div ref={boxRef} className="relative w-full">
      <label className="sr-only" htmlFor={`help-search-${compact ? "c" : "h"}`}>{label}</label>
      <div className="relative">
        <Search size={compact ? 16 : 18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          id={`help-search-${compact ? "c" : "h"}`}
          type="search"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full rounded-full border border-border bg-card text-foreground placeholder:text-muted-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/40 ${
            compact ? "min-h-[40px] pl-10 pr-9 text-sm" : "min-h-[52px] pl-11 pr-10 text-base"
          }`}
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setOpen(false);
            }}
            aria-label="Clear"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {showPanel && (
        <div className="absolute left-0 right-0 z-30 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-card p-2 text-left shadow-xl">
          {!index && !failed && <p className="px-3 py-2 text-sm text-muted-foreground">…</p>}
          {failed && <p className="px-3 py-2 text-sm text-muted-foreground">{noneLabel.replace("{q}", q)}</p>}
          {index && results.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">{noneLabel.replace("{q}", q)}</p>
          )}
          {results.length > 0 && (
            <>
              <p className="px-3 pb-1 pt-1 text-xs uppercase tracking-wide text-muted-foreground">
                {countLabel.replace("{n}", String(results.length)).replace("{q}", q)}
              </p>
              <ul>
                {results.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={helpPath(lang, r.category, r.slug)}
                      onClick={() => setOpen(false)}
                      className="block rounded-xl px-3 py-2.5 hover:bg-muted"
                    >
                      <span className="block text-sm font-medium text-foreground">{r.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {categoryLabels?.[r.category] || r.category}
                        {r.summary ? ` — ${r.summary}` : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
