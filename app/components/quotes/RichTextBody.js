// app/components/quotes/RichTextBody.js
//
// The React half of lib/quotes/richText.js — the same block tree the PDF
// draws, as elements. Every run is a text node: nothing here sets innerHTML,
// so the "<script>" a hostile body carries is printed as those characters.
// Used by the approval page a homeowner opens, the quote detail page staff
// proofread on, and the builder's own preview, so the three cannot disagree
// about what a block looks like.
"use client";

import { parseRichText } from "@/lib/quotes/richText";

function Runs({ runs }) {
  return runs.map((r, i) => {
    let node = r.text;
    if (r.bold) node = <strong>{node}</strong>;
    if (r.italic) node = <em>{node}</em>;
    if (r.href) {
      node = (
        <a href={r.href} target="_blank" rel="noopener noreferrer" className="underline">
          {node}
        </a>
      );
    }
    return <span key={i}>{node}</span>;
  });
}

export default function RichTextBody({ body, className = "" }) {
  const blocks = parseRichText(body);
  if (!blocks.length) return null;
  return (
    <div className={`space-y-1.5 ${className}`}>
      {blocks.map((b, i) => {
        if (b.kind === "p") {
          return (
            <p key={i} className="whitespace-pre-line">
              <Runs runs={b.runs} />
            </p>
          );
        }
        const Tag = b.kind;
        return (
          <Tag key={i} className={`${b.kind === "ol" ? "list-decimal" : "list-disc"} pl-5 space-y-0.5`}>
            {b.items.map((runs, j) => (
              <li key={j}>
                <Runs runs={runs} />
              </li>
            ))}
          </Tag>
        );
      })}
    </div>
  );
}
