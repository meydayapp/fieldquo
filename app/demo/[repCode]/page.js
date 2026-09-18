// app/demo/[repCode]/page.js
//
// A rep's public demo page — reached from the "Book a 15-minute demo"
// button in the intro email (with a sealed token in ?t=) or from the bare
// link the rep hands out. No login, usually on a phone. The GET behind it
// reads only; the confirm is a POST — app/api/demo/rep/[repCode]/route.js
// says why.
export const dynamic = "force-dynamic";

import RepDemoForm from "./RepDemoForm";

export const metadata = {
  title: "FieldQuo",
  // A token in a search index would let anybody who found a real URL book
  // in somebody else's name.
  robots: { index: false, follow: false },
};

export default async function RepDemoPage({ params, searchParams }) {
  // Next 16: params and searchParams are Promises.
  const { repCode } = await params;
  const q = await searchParams;
  const token = typeof q?.t === "string" ? q.t : null;
  const lang = typeof q?.lang === "string" ? q.lang : null;
  return <RepDemoForm repCode={repCode} token={token} lang={lang} />;
}
