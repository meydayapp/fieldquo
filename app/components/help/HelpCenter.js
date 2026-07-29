// app/components/help/HelpCenter.js
//
// Renders the knowledge base for one audience (company or platform). Pure
// client component over static content in app/data/helpArticles.js — no API,
// no secrets. Blocks are rendered as plain elements (never HTML), so there's
// no injection surface.
"use client";

import { useMemo, useState } from "react";
import { Search, ChevronLeft, BookOpen } from "lucide-react";
import { HELP_CATEGORIES, articlesFor } from "@/app/data/helpArticles";

function Block({ block }) {
  if (block.h) return <h3 className="text-base font-semibold text-foreground mt-5 mb-2">{block.h}</h3>;
  if (block.p) return <p className="text-sm text-muted-foreground leading-relaxed mb-3">{block.p}</p>;
  if (block.note)
    return (
      <p className="text-sm rounded-lg bg-muted/60 border border-border px-3 py-2 my-3 text-foreground">
        {block.note}
      </p>
    );
  if (Array.isArray(block.steps))
    return (
      <ol className="list-decimal pl-5 space-y-1.5 mb-3 text-sm text-muted-foreground">
        {block.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    );
  return null;
}

export default function HelpCenter({ audience, title, intro }) {
  const all = useMemo(() => articlesFor(audience), [audience]);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(null); // active article slug

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.body.some((b) =>
          [b.p, b.h, b.note, ...(b.steps || [])].filter(Boolean).join(" ").toLowerCase().includes(q),
        ),
    );
  }, [all, query]);

  const article = active ? all.find((a) => a.slug === active) : null;

  if (article) {
    return (
      <div className="max-w-2xl px-6 py-8">
        <button
          onClick={() => setActive(null)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft size={15} /> All articles
        </button>
        <h1 className="text-2xl font-bold text-foreground mb-1">{article.title}</h1>
        <p className="text-sm text-muted-foreground mb-4">{article.summary}</p>
        <div className="border-t border-border pt-4">
          {article.body.map((b, i) => (
            <Block key={i} block={b} />
          ))}
        </div>
      </div>
    );
  }

  const cats = HELP_CATEGORIES.filter((c) => filtered.some((a) => a.category === c.key));

  return (
    <div className="max-w-2xl px-6 py-8">
      <div className="flex items-center gap-2 mb-1">
        <BookOpen size={20} className="text-foreground" />
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      </div>
      {intro && <p className="text-sm text-muted-foreground mb-5 max-w-xl">{intro}</p>}

      <div className="relative mb-6">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help…"
          className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm"
        />
      </div>

      {cats.length === 0 && (
        <p className="text-sm text-muted-foreground">No articles match “{query}”.</p>
      )}

      <div className="space-y-6">
        {cats.map((cat) => (
          <section key={cat.key}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {cat.label}
            </h2>
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {filtered
                .filter((a) => a.category === cat.key)
                .map((a) => (
                  <button
                    key={a.slug}
                    onClick={() => setActive(a.slug)}
                    className="w-full text-left px-4 py-3 hover:bg-muted/50"
                  >
                    <p className="text-sm font-medium text-foreground">{a.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.summary}</p>
                  </button>
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
