// app/(marketing)/glossary/GlossaryBits.js
//
// The four fragments the index and the term pages BOTH render.
//
// They live here rather than being written twice because AGENTS.md names
// copy-paste duplication as a recurring failure class, and this is the exact
// shape of it: two pages showing the same entry, one of them updated. The
// jurisdiction warning is the one that matters — a term page that carries the
// "check your own province" note while the index quietly drops it is a page
// that reads as settled law.
//
// Server components on purpose. Nothing here is interactive and nothing reads
// translation context, so there is no reason to ship it to the browser.

import { tradeLabels } from "@/app/data/tradeGlossary";
import { matrixEntry } from "@/lib/marketing/featureMatrix";

/** "Also called: Holdback, Retention" — omitted entirely when there are none. */
export function Synonyms({ entry, className = "" }) {
  if (entry.synonyms.length === 0) return null;
  return (
    <p className={`text-sm text-muted-foreground ${className}`}>
      <span className="font-medium text-foreground">Also called: </span>
      {entry.synonyms.join(", ")}
    </p>
  );
}

/** The trades that use the word most. Nothing renders when it belongs to all. */
export function Trades({ entry }) {
  const labels = tradeLabels(entry);
  if (labels.length === 0) return null;
  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground">Heard most in: </span>
      {labels.join(", ")}
    </p>
  );
}

/**
 * The warning on anything whose answer is set by statute.
 *
 * Deliberately not a subtle italic footnote. A contractor who takes a deposit
 * percentage or a lien deadline off a marketing page and is wrong has lost
 * real money, and the honest thing a national page can do is refuse to name
 * the number and say why. The definitions themselves already say it in prose;
 * this repeats it where it cannot be skimmed past.
 */
export function JurisdictionNote({ entry }) {
  if (!entry.varies) return null;
  return (
    <div className="mt-4 rounded-xl border border-border bg-muted p-4">
      <p className="text-sm font-semibold text-foreground">
        This one depends on where you work
      </p>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
        The rule behind {entry.term.toLowerCase()} is set by the province or
        state the work is in, and the versions do not agree with one another.
        We have described the shape of it and deliberately not named a
        deadline, a cap or a percentage — check the rule where you work, or ask
        someone who practises there.
      </p>
    </div>
  );
}

/**
 * The FieldQuo sentence, when there honestly is one.
 *
 * `entry.product.key` is resolved against lib/marketing/featureMatrix.js at
 * render time rather than trusted. That file is the one place a claim about
 * this product is allowed to originate, and it carries the proof paths that
 * make the claim checkable; a glossary that restated a feature in its own
 * words would be a second, unchecked list of promises. If the key stops
 * resolving — the feature was pulled — this renders nothing at all rather
 * than a dangling name, and check-glossary fails the build separately so the
 * silence is not the only signal.
 */
export function ProductNote({ entry }) {
  if (!entry.product) return null;
  const feature = matrixEntry(entry.product.key);
  if (!feature) return null;

  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        In FieldQuo — {feature.name}
      </p>
      <p className="mt-1 text-sm text-foreground leading-relaxed">
        {entry.product.note}
      </p>
    </div>
  );
}
