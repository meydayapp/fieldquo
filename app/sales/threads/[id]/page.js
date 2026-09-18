// app/sales/threads/[id]/page.js
//
// One conversation used to render here. The inbox at /sales/threads now
// draws every conversation in its middle pane, so this address — which the
// lead screen, the Texts contact bar and every push notification sent
// before 2026-09-18 still link to — sends the reader there with the thread
// open. A redirect rather than a second rendering of the same thread: the
// copy nobody looks at is the one that rots.
//
// `params` is a Promise in Next 16.
import { redirect } from "next/navigation";

export default async function SalesThreadPage({ params }) {
  const { id } = await params;
  redirect(`/sales/threads?open=${encodeURIComponent(id)}`);
}
