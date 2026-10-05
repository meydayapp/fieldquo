// app/developers/marketing-api/page.js
//
// The public reference for the marketing-agency API — what an agency reads
// before it connects a client's FieldQuo account to its own dashboard or Zap.
// Every table here is rendered from the code that answers the requests
// (lib/agency/openapi.js and the modules it reads), so the page cannot
// describe a field the API stopped sending. English only, like the API's
// own field names; it is a developer reference, not a client surface.
import Link from "next/link";
import { buildOpenApi, LEAD_FIELD_DOCS } from "@/lib/agency/openapi";
import { EVENTS, EVENT_DESCRIPTIONS } from "@/lib/agency/events";
import { DEFINITIONS, METRIC_KEYS } from "@/lib/agency/metrics";
import { LEAD_ROW_KEYS, CONTACT_KEYS, MONEY_KEYS } from "@/lib/agency/leadRow";
import { PERIOD_KEYS } from "@/lib/agency/periods";
import { SOURCE_FILTERS } from "@/lib/agency/channels";
import { RATE_LIMIT } from "@/lib/agency/apiAuth";
import { SUPPORT_EMAIL } from "@/lib/supportContact";

export const metadata = {
  title: "Marketing API — FieldQuo developers",
  description:
    "Read a FieldQuo company's marketing results — leads, appointments, closes and revenue against ad spend — with the agency key the company created. Privacy-safe by default.",
};

const BASE = "https://app.fieldquo.com/api/v1";

function Code({ children }) {
  return <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs text-foreground whitespace-pre">{children}</pre>;
}

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-6 space-y-3">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default function MarketingApiDocs() {
  const spec = buildOpenApi({ baseUrl: "https://app.fieldquo.com" });
  const ops = [];
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(methods)) ops.push({ method: method.toUpperCase(), path, summary: op.summary });
  }
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-10">
        <header className="space-y-3">
          <div className="text-sm text-muted-foreground">
            <Link href="/" className="underline">FieldQuo</Link> · Developers
          </div>
          <h1 className="text-3xl font-bold">Marketing API</h1>
          <p className="text-base text-muted-foreground">
            For a marketing agency working with a contractor on FieldQuo: read the company&apos;s marketing results —
            every lead your ads brought, how far it got, and what the job was worth — so you can optimise toward what
            actually closes. The company creates your key in <strong>Settings → Marketing agency access</strong>; the key
            alone decides whose data you read.
          </p>
          <p className="text-sm">
            <a href="/developers/marketing-api/openapi.json" className="underline font-medium">OpenAPI 3.1 (JSON)</a>
            {" · "}
            <a href="#zapier" className="underline font-medium">Zapier</a>
            {" · "}
            <a href="#privacy" className="underline font-medium">What is private</a>
          </p>
        </header>

        <Section id="auth" title="Authentication">
          <p className="text-sm">
            Send the key as a bearer token. Keys start with <code>fqa_</code>; the company sees each key&apos;s calls and can revoke it at any time.
          </p>
          <Code>{`curl ${BASE}/me \\\n  -H "Authorization: Bearer fqa_…"`}</Code>
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li><code>marketing:read</code> — every key: metrics, funnel, leads, hooks.</li>
            <li><code>marketing:write_leads</code> — only when the company ticks it: add a lead from your funnel, move a lead along the pipeline, set a requested visit window, find a lead by email or phone.</li>
            <li>No key can send a text, email or message to the company&apos;s clients. There is no endpoint for it.</li>
            <li>At most {RATE_LIMIT} requests a minute per key. Refusals are JSON <code>{"{ error, code }"}</code> with 400, 401, 403, 404, 409 or 429.</li>
          </ul>
        </Section>

        <Section id="privacy" title="What is private">
          <p className="text-sm">
            Every lead — in the API, in a webhook and in a Zapier sample — is the same row. By default it carries a random
            reference (<code>L-7F3A</code>), the first name, a partial postal code (US ZIP5, Canadian FSA) and no contact
            details. Fields the company does not share are present and <code>null</code>, so a mapped Zap keeps working.
          </p>
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>Contact details ({CONTACT_KEYS.join(", ")}, full postal code): only when the company switches on <em>Share contact details with my marketing agency</em> (off by default).</li>
            <li>Money ({MONEY_KEYS.join(", ")}): only while <em>Share job values</em> is on (on by default).</li>
            <li>The street address is never shared.</li>
          </ul>
        </Section>

        <Section id="endpoints" title="Endpoints">
          <p className="text-sm">Base URL: <code>{BASE}</code></p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {ops.map((o) => (
                  <tr key={`${o.method} ${o.path}`}>
                    <td className="py-2 pr-3 font-mono text-xs whitespace-nowrap align-top">{o.method}</td>
                    <td className="py-2 pr-3 font-mono text-xs align-top break-all">{o.path}</td>
                    <td className="py-2 text-muted-foreground align-top">{o.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Code>{`curl "${BASE}/marketing/metrics?period=lastMonth&source=meta" \\\n  -H "Authorization: Bearer fqa_…"`}</Code>
          <p className="text-sm">
            Periods: {PERIOD_KEYS.join(", ")} (UTC days; <code>custom</code> takes <code>from</code> and <code>to</code>). Each
            figure comes with the previous period of the same length. Sources: {Object.keys(SOURCE_FILTERS).join(", ")}.
          </p>
          <p className="text-sm">
            A period selects <strong>leads that arrived in it</strong>; every later stage is what became of those leads,
            whenever it happened — so the funnel reconciles and an appointment is counted once per lead.
          </p>
        </Section>

        <Section id="metrics" title="Metrics">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {METRIC_KEYS.map((k) => (
                  <tr key={k}>
                    <td className="py-2 pr-3 font-mono text-xs align-top whitespace-nowrap">{k}</td>
                    <td className="py-2 text-muted-foreground align-top">{DEFINITIONS[k].en}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="leads" title="The lead row">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {LEAD_ROW_KEYS.map((k) => (
                  <tr key={k}>
                    <td className="py-2 pr-3 font-mono text-xs align-top whitespace-nowrap">{k}</td>
                    <td className="py-2 text-muted-foreground align-top">{LEAD_FIELD_DOCS[k]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Code>{`curl "${BASE}/marketing/leads?updatedSince=2026-10-01T00:00:00Z&limit=100" \\\n  -H "Authorization: Bearer fqa_…"\n# → { "leads": [ … ], "nextCursor": "…" }  — pass cursor=… for the next page`}</Code>
        </Section>

        <Section id="events" title="Events (REST hooks)">
          <p className="text-sm">
            Subscribe a public https URL to an event; FieldQuo POSTs each occurrence as
            <code> {"{ id, event, occurredAt, data, lead }"}</code>. Only what happens after you subscribe is sent. A non-2xx
            answer is retried with backoff (1, 5, 30, 120, 360, 720 minutes); a <strong>410</strong> ends the subscription.
          </p>
          <Code>{`curl -X POST ${BASE}/hooks/subscribe \\\n  -H "Authorization: Bearer fqa_…" -H "Content-Type: application/json" \\\n  -d '{"event":"quote.accepted","targetUrl":"https://hooks.zapier.com/…"}'\n# → { "id": "…" }   ·   DELETE ${BASE}/hooks/{id} to stop`}</Code>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {EVENTS.map((e) => (
                  <tr key={e}>
                    <td className="py-2 pr-3 font-mono text-xs align-top whitespace-nowrap">{e}</td>
                    <td className="py-2 text-muted-foreground align-top">{EVENT_DESCRIPTIONS[e]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm">
            <code>GET {BASE}/hooks/samples/{"{event}"}</code> returns recent real payloads of an event, built the same way.
          </p>
        </Section>

        <Section id="zapier" title="Zapier">
          <p className="text-sm">
            FieldQuo&apos;s Zapier app connects with the same key (Zapier asks for it once). Triggers: one per event above.
            Actions: <em>Create lead</em>, <em>Move lead to stage</em> and <em>Update appointment request</em> (keys with
            <code> marketing:write_leads</code>). Searches: <em>Find lead by reference</em> and <em>Find lead by email or
            phone</em>. There is no action that messages a client. Until the app is listed in Zapier&apos;s directory, any
            tool that makes web requests — including Zapier&apos;s own Webhooks — can call the endpoints above.
          </p>
        </Section>

        <footer className="text-sm text-muted-foreground border-t border-border pt-6">
          Questions: <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>
        </footer>
      </div>
    </main>
  );
}
