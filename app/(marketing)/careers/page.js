// app/(marketing)/careers/page.js
//
// Server half: metadata only. The copy is in CareersContent, which renders it
// in the visitor's language — see that file for why the page lists no roles.
import { marketingMetadata } from "@/lib/marketing/metadata";
import CareersContent from "./CareersContent";

export const metadata = marketingMetadata({
  path: "/careers",
  title: "Careers at FieldQuo",
  description:
    "We have no roles posted right now. If you've worked in the trades or you build software for people who do, get in touch anyway.",
});

export default function CareersPage() {
  return <CareersContent />;
}
