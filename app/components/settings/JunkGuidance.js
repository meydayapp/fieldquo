"use client";

// app/components/settings/JunkGuidance.js
//
// The starter content for a company new to junk removal, shown under the junk
// rate card: how to price, how a job runs, and a customer FAQ they can lift onto
// their website. Collapsed by default — an experienced hauler doesn't need it,
// a first-timer very much does. This is where lib/junk/guidance.js is READ, so
// the module isn't written-and-never-read.

import { useState } from "react";
import { ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import {
  JUNK_PRICING_GUIDE,
  JUNK_PROCESS_GUIDE,
  JUNK_FAQ,
} from "@/lib/junk/guidance";

export default function JunkGuidance() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <BookOpen size={15} className="text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
          New to junk pricing? Start here
        </span>
      </button>

      {open && (
        <div className="space-y-5 px-4 pb-4 pt-1">
          <Section title={JUNK_PRICING_GUIDE.title} intro={JUNK_PRICING_GUIDE.intro}>
            {JUNK_PRICING_GUIDE.points.map((p) => (
              <Item key={p.heading} heading={p.heading} body={p.body} />
            ))}
          </Section>

          <Section title={JUNK_PROCESS_GUIDE.title}>
            {JUNK_PROCESS_GUIDE.steps.map((s) => (
              <Item key={s.heading} heading={s.heading} body={s.body} />
            ))}
          </Section>

          <Section
            title="Starter customer FAQ"
            intro="Answers homeowners ask before booking. Copy any of these into your website's FAQ section, then edit to your market."
          >
            {JUNK_FAQ.map((f) => (
              <Item key={f.q} heading={f.q} body={f.a} />
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, intro, children }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      {intro && <p className="mt-0.5 text-xs text-muted-foreground">{intro}</p>}
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

function Item({ heading, body }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <p className="text-xs font-semibold text-foreground">{heading}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
