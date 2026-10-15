// app/(marketing)/about/page.js
//
// Server half: metadata only. The page body — the intro and the founder
// block (site audit D3.3, 2026-10-15) — is AboutContent, a client component
// because translation lives in React context. It was one hard-coded English
// paragraph with no person behind it; the audit scored founder-led trust 1/4
// for exactly that.
import { marketingMetadata } from "@/lib/marketing/metadata";
import AboutContent from "./AboutContent";

export const metadata = marketingMetadata({
  path: "/about",
  title: "About FieldQuo — built inside a real contracting company",
  description:
    "FieldQuo was built by Emilio Boves inside TrueFinish Cabinets, his cabinet refinishing company in Ottawa, and runs his business today.",
});

export default function AboutPage() {
  return <AboutContent />;
}
