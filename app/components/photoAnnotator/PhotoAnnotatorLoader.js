"use client";

// app/components/photoAnnotator/PhotoAnnotatorLoader.js
//
// The intended import point for the photo annotator: JobPhotoCurator.js
// imports THIS module, never PhotoAnnotatorEditor.js directly — the same
// rule DesignerLoader.js's own header states for the marketing designer,
// and for the identical reason. fabric@5.3.0-browser touches
// `window`/`document` at import time; Next's SSR pass evaluates component
// modules on the server, where neither exists, so importing
// PhotoAnnotatorEditor.js (or anything in its tree) from a server-rendered
// path crashes the render — a dynamic import("fabric") inside an ordinary
// SSR'd page fails the real `next build` with "Can't resolve 'jsdom'" (the
// designer's own DesignerLoader.js documents the same failure). This is a
// SEPARATE, independent ssr:false boundary from the designer's — not the
// designer's loader repointed at a different component — because
// JobPhotoCurator.js is itself a plain client component with no reason to
// know the marketing designer exists, and chaining through an unrelated
// module would make this feature's reachability depend on the designer's
// file staying in place.
import dynamic from "next/dynamic";

const PhotoAnnotatorEditor = dynamic(
  () => import("@/app/components/photoAnnotator/PhotoAnnotatorEditor"),
  { ssr: false },
);

export default PhotoAnnotatorEditor;
