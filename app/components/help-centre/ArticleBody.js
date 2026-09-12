// app/components/help-centre/ArticleBody.js
//
// Renders an article's sections and blocks (the shape documented in
// lib/help/content.js). Server component: the whole body is static HTML.
//
// Every h2 carries the section's id, which is what the "In this article"
// outline links to and what a support reply can deep-link ("see #fees").
import { Info, Lightbulb, AlertTriangle } from "lucide-react";
import Inline from "./Inline";
import { parseFigureRef } from "@/lib/help/figures";
import { figureSrc } from "@/lib/help/urls";

function Callout({ kind, children }) {
  const style = {
    note: { Icon: Info, cls: "border-border bg-muted/50 text-foreground" },
    tip: { Icon: Lightbulb, cls: "border-emerald-500/30 bg-emerald-500/10 text-foreground" },
    warning: { Icon: AlertTriangle, cls: "border-amber-500/40 bg-amber-500/10 text-foreground" },
  }[kind];
  const { Icon, cls } = style;
  return (
    <div className={`my-4 flex gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed ${cls}`} role="note">
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p className="m-0">{children}</p>
    </div>
  );
}

export function Block({ block, lang, bodyLang, figureSources, fallbackLabel }) {
  if (!block || typeof block !== "object") return null;
  if (typeof block.p === "string") {
    return <p className="my-3 text-[15px] leading-7 text-foreground/90"><Inline text={block.p} lang={lang} /></p>;
  }
  if (Array.isArray(block.steps)) {
    return (
      <ol className="my-4 space-y-2 pl-6 text-[15px] leading-7 text-foreground/90 list-decimal marker:font-semibold marker:text-brand-accent-text">
        {block.steps.map((s, i) => <li key={i}><Inline text={s} lang={lang} /></li>)}
      </ol>
    );
  }
  if (Array.isArray(block.bullets)) {
    return (
      <ul className="my-4 space-y-1.5 pl-6 text-[15px] leading-7 text-foreground/90 list-disc marker:text-muted-foreground">
        {block.bullets.map((s, i) => <li key={i}><Inline text={s} lang={lang} /></li>)}
      </ul>
    );
  }
  for (const kind of ["note", "tip", "warning"]) {
    if (typeof block[kind] === "string") return <Callout kind={kind}><Inline text={block[kind]} lang={lang} /></Callout>;
  }
  if (typeof block.figure === "string") {
    const ref = parseFigureRef(block.figure);
    if (!ref) return null;
    // Figures are copied per BODY language (content/help/figures.generated.json
    // says which capture answered); a French body with an English capture is
    // said so under the figure rather than left for the reader to notice.
    const src = figureSrc(bodyLang, ref.publicName);
    const took = figureSources?.[ref.publicName] || bodyLang;
    const fallback = took !== bodyLang;
    return (
      <figure className="my-6">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {/* Plain <img>, not next/image: these are quantised PNGs copied into
              public/ at build time with no known dimensions, and an optimiser
              pass over a 1280-wide screenshot on a Vercel function per view
              is cost for no benefit — the file is already small. */}
          <img src={src} alt={block.caption || ""} loading="lazy" decoding="async" className="block w-full h-auto" />
        </div>
        {(block.caption || fallback) && (
          <figcaption className="mt-2 text-sm text-muted-foreground">
            {block.caption ? <Inline text={block.caption} lang={lang} /> : null}
            {fallback && fallbackLabel ? <span className="ml-1 italic">— {fallbackLabel}</span> : null}
          </figcaption>
        )}
      </figure>
    );
  }
  if (block.table && Array.isArray(block.table.rows)) {
    const { head = [], rows } = block.table;
    return (
      <div className="my-5 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[480px] text-sm">
          {head.length > 0 && (
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>{head.map((h, i) => <th key={i} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
            </thead>
          )}
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => (
              <tr key={i} className="align-top">
                {r.map((c, j) => <td key={j} className="px-3 py-2 text-foreground/90"><Inline text={c} lang={lang} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return null;
}

export default function ArticleBody({ article, lang, bodyLang, figureSources, fallbackLabel, faqHeading }) {
  const sections = Array.isArray(article.sections) ? article.sections : [];
  return (
    <div className="help-article">
      {sections.map((s) => (
        <section key={s.id} id={s.id} className="scroll-mt-24">
          <h2 className="mt-10 mb-3 text-xl font-bold tracking-tight text-foreground first:mt-6">
            <a href={`#${s.id}`} className="no-underline hover:underline decoration-border">{s.heading}</a>
          </h2>
          {(s.blocks || []).map((b, i) => (
            <Block key={i} block={b} lang={lang} bodyLang={bodyLang} figureSources={figureSources} fallbackLabel={fallbackLabel} />
          ))}
        </section>
      ))}
      {Array.isArray(article.faq) && article.faq.length > 0 && (
        <section id="faq" className="scroll-mt-24">
          <h2 className="mt-10 mb-3 text-xl font-bold tracking-tight text-foreground">
            <a href="#faq" className="no-underline hover:underline decoration-border">{faqHeading}</a>
          </h2>
          <div className="divide-y divide-border rounded-xl border border-border">
            {article.faq.map((f, i) => (
              <details key={i} className="group px-4 py-3">
                <summary className="cursor-pointer list-none font-medium text-foreground flex items-center justify-between gap-3">
                  <span><Inline text={f.q} lang={lang} /></span>
                  <span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-[15px] leading-7 text-foreground/90"><Inline text={f.a} lang={lang} /></p>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
