// app/components/auth/samples/index.js
//
// The signup side panel's samples, loaded on demand. Each sample renders a
// real product screen — the client quote page, the scheduler, the dashboard,
// the inbox, the AI team — with the app-guide harness's data, and together
// they weigh far more than the signup form. /signup is a public page opened
// on phones on bad connections, so none of that is in its first load: each
// sample is its own chunk, fetched when its step is on screen (and on a
// phone, only when "Show preview" is opened — the strip renders no picture
// until then). `ssr: false` for the same reason: the server has nothing to
// gain from rendering an iframe's contents it cannot size.
//
// While a chunk loads, the panel shows a quiet box of roughly the sample's
// height — never a spinner that could outlive a failed load. If a chunk
// fails, next/dynamic renders nothing and the panel's words still stand.
"use client";

import dynamic from "next/dynamic";

function Placeholder() {
  return <div className="h-64 w-full rounded-lg bg-muted/60 motion-safe:animate-pulse" aria-hidden="true" data-sample-loading />;
}

const EmailSample = dynamic(() => import("./EmailSample"), { ssr: false, loading: Placeholder });
const BookingSample = dynamic(() => import("./BookingSample"), { ssr: false, loading: Placeholder });
const ScheduleSample = dynamic(() => import("./ScheduleSample"), { ssr: false, loading: Placeholder });
const QuoteSample = dynamic(() => import("./QuoteSample"), { ssr: false, loading: Placeholder });
const DashboardSample = dynamic(() => import("./DashboardSample"), { ssr: false, loading: Placeholder });
const InboxSample = dynamic(() => import("./InboxSample"), { ssr: false, loading: Placeholder });
const ExploreCollage = dynamic(() => import("./ExploreCollage"), { ssr: false, loading: Placeholder });

const SAMPLES = {
  email: EmailSample,
  booking: BookingSample,
  schedule: ScheduleSample,
  quote: QuoteSample,
  dashboard: DashboardSample,
  inbox: InboxSample,
  collage: ExploreCollage,
};

/** The sample kinds the panel can show — the check asserts each step picks one. */
export const SAMPLE_KINDS = Object.freeze(Object.keys(SAMPLES));

/**
 * One sample, by kind. The wrapper carries the kind so the page (and the
 * check, which renders the panel on the server where nothing lazy loads)
 * can tell which real screen a step shows.
 */
export function Sample({ kind, ...props }) {
  const Component = SAMPLES[kind];
  if (!Component) return null;
  return (
    <div data-sample-kind={kind}>
      <Component {...props} />
    </div>
  );
}
