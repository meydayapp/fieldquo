// lib/documentSections/KitchenPlanSection.js
//
// The kitchen drawing on the quote and the invoice.
//
// ── Why this belongs on the document ───────────────────────────────────────
//
// A cabinet quote is a page of line items that mean very little on their own —
// "Base cabinet — 36in" twelve times over. The drawing is what the client
// actually understood and agreed to, and the crew builds from it. Attaching it
// to the PDF means the thing that was approved and the thing that gets built
// are the same artefact, rather than a drawing in an app and a list on paper.
//
// ── It renders from the same shapes as the screen ──────────────────────────
//
// PlanPdf is an adapter over lib/kitchen/planShapes, exactly like the browser's
// PlanSvg. Neither re-derives the geometry, so the drawing a client approved on
// their phone and the one printed here cannot disagree.
//
// ── It renders nothing when there's no kitchen ─────────────────────────────
//
// Which is most documents. A section that prints an empty box on every fence
// quote is worse than one nobody added.
import { View, Text } from "@react-pdf/renderer";
import { PlanPdf, ElevationPdf } from "@/lib/kitchen/PlanPdf";
import { describeFinish } from "@/lib/kitchen/finishes";
import { documentLabels } from "@/lib/i18n/documentLabels";

export const meta = { type: "kitchen_plan", label: "Kitchen drawing" };

/**
 * The design on this document, or null.
 *
 * Exported so it can be tested with plain node. It carries the only real
 * decision here — WHETHER to draw — and that decision matters far more than the
 * drawing: most documents have no kitchen, and a section that prints an empty
 * box on every fence quote is worse than one nobody added.
 *
 * The rendering itself is covered by scripts/check-kitchen-pdf.jsx, which
 * renders a real PDF and reads the text back off the page.
 */
export function designFrom(data) {
  const d = data?.scopeDetails;
  return d?.serviceType === "kitchen" && Array.isArray(d.elements) && d.elements.length
    ? d
    : null;
}

/** Walls with anything on them. Empty ones are skipped, not drawn blank. */
export function wallsWithContent(design) {
  const els = Array.isArray(design?.elements) ? design.elements : [];
  return ["A", "B", "C", "D"].filter((id) => els.some((el) => el?.wall === id));
}

export function renderEmailHtml() {
  // Deliberately nothing. An SVG this complex is unreliable across email
  // clients — Outlook drops it entirely and Gmail strips half the attributes —
  // and a half-rendered technical drawing is worse than a line saying the plan
  // is attached. The PDF carries it.
  return "";
}

export function PdfSection({ data, language }) {
  const design = designFrom(data);
  if (!design) return null;

  const t = documentLabels(language);
  const walls = wallsWithContent(design);
  const room = design.room || {};
  const ft = (inches) => Math.round((Number(inches) || 0) / 12);

  return (
    // `wrap={false}` keeps the plan and its elevations on one page. A drawing
    // split across a page break is unreadable, and a client who has to hold two
    // sheets together to see their kitchen won't.
    <View style={{ marginTop: 18 }} wrap={false}>
      <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 6 }}>
        {t.kitchenPlan}
      </Text>

      <PlanPdf
        design={design}
        width={505}
        title={t.kitchenPlan}
        subtitle={
          room.width && room.depth
            ? `${ft(room.depth)}' × ${ft(room.width)}' room`
            : undefined
        }
      />

      {walls.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 10,
          }}
        >
          {walls.map((id) => (
            <ElevationPdf key={id} design={design} wallId={id} width={160} />
          ))}
        </View>
      )}

      {/* The finish schedule in words. The drawing shows the colours; this is
          what someone orders from, and it's the line a client points at when
          the wrong doors turn up. */}
      <Text style={{ fontSize: 8, color: "#666", marginTop: 8 }}>
        {describeFinish(design.finish)}
      </Text>
    </View>
  );
}
