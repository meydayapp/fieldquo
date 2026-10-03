// app/co/[token]/not-found.js
//
// A wrong or replaced change-order link. No app shell, no FieldQuo branding,
// and no explanation of why — see app/q/[token]/not-found.js. No FieldQuo
// favicon, description or manifest in the head either.
import { neutralClientMetadata } from "@/lib/whiteLabel/pageMetadata";

export const metadata = neutralClientMetadata({
  title: "Change order",
  robots: { index: false, follow: false },
});

export default function ChangeOrderNotFound() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-6 py-16 bg-[#f5f2ec]">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-[#2d2520]">This link isn&apos;t valid</h1>
        <p className="text-sm text-[#2d2520]/60 mt-2">
          Get in touch with the company you&apos;re working with and they can send a fresh one.
        </p>
      </div>
    </main>
  );
}
