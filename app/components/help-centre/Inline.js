// app/components/help-centre/Inline.js
//
// The two inline marks an article string may carry — **bold** and
// [[slug|text]] — turned into elements. Nothing is ever rendered as HTML:
// a translator who types a < gets a <, and a link to a slug the tree does
// not know renders as plain text rather than a dead anchor.
import Link from "next/link";
import { articleMeta } from "@/lib/help/tree";
import { helpPath } from "@/lib/help/urls";

const TOKEN = /(\*\*[^*]+\*\*|\[\[[a-z0-9-]+\|[^\]]+\]\])/g;

export default function Inline({ text, lang }) {
  const parts = String(text ?? "").split(TOKEN);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    const m = /^\[\[([a-z0-9-]+)\|([^\]]+)\]\]$/.exec(part);
    if (m) {
      const meta = articleMeta(m[1]);
      if (!meta) return <span key={i}>{m[2]}</span>;
      return (
        <Link key={i} href={helpPath(lang, meta.category, meta.slug)} className="underline decoration-brand-accent/60 underline-offset-2 hover:decoration-brand-accent">
          {m[2]}
        </Link>
      );
    }
    return part;
  });
}
