// app/components/marketing/LegalDocument.js
//
// Shared shell for the three long-form legal/policy pages (Privacy, Terms,
// Security). Pulled out rather than repeated three times because the styling
// IS the copy-paste-rot risk AGENTS.md warns about: no @tailwindcss/typography
// plugin is installed in this project (checked — app/globals.css has no
// `prose` styles behind it), so the original placeholder's `className="prose
// prose-gray"` did nothing at all. Rather than add a dependency for three
// pages, this wrapper styles plain semantic HTML (h2/h3/p/ul/table) with
// Tailwind's `[&_selector]` arbitrary-variant syntax, once, here — so a
// heading added to any of the three pages six months from now inherits the
// same look instead of someone re-guessing the classes.
export default function LegalDocument({ title, dek, updatedLabel, children }) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-foreground mb-2">{title}</h1>
      {updatedLabel ? (
        <p className="text-sm text-muted-foreground mb-6">{updatedLabel}</p>
      ) : null}
      {dek ? (
        <p className="text-muted-foreground leading-relaxed mb-10">{dek}</p>
      ) : null}
      <div
        className="
          text-foreground
          [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-12 [&_h2]:mb-3 [&_h2]:pb-2 [&_h2]:border-b [&_h2]:border-border
          [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-6 [&_h3]:mb-2
          [&_p]:text-muted-foreground [&_p]:leading-relaxed [&_p]:mb-4
          [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:space-y-1.5 [&_ul]:text-muted-foreground
          [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_ol]:space-y-1.5 [&_ol]:text-muted-foreground
          [&_li]:leading-relaxed
          [&_strong]:text-foreground [&_strong]:font-semibold
          [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-muted-foreground/50 hover:[&_a]:decoration-foreground
          [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_table]:text-sm
          [&_th]:text-left [&_th]:font-semibold [&_th]:text-foreground [&_th]:border-b [&_th]:border-border [&_th]:py-2 [&_th]:pr-4 [&_th]:align-top
          [&_td]:text-muted-foreground [&_td]:border-b [&_td]:border-border/60 [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top
          [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:my-4
        "
      >
        {children}
      </div>
    </div>
  );
}
