// lib/documentSections/ReportPropertySection.js
//
// "Your property": the address and contact the estimate was prepared for, and
// the property map — the satellite still the figure was measured from, with
// the traced outline projected over it when the draft carries one
// (lib/estimate/report/mapOverlay.js). The still is the Cloudinary capture
// (lib/measure/satelliteCapture.js), so this page prints the photograph the
// price was worked out from, not next year's imagery.

import { View, Text, Image, Svg, Polygon } from "@react-pdf/renderer";
import { PDF_FONT_BOLD } from "@/lib/documents/pdfFont";
import { reportPalette, reportFrom, ReportHeading, KeyValueRow } from "./reportShared";
import { outlinePointsAttr } from "@/lib/estimate/report/mapOverlay";

export const meta = { type: "report_property", label: "Estimate report property" };

export function renderEmailHtml() {
  return "";
}

// The page is 612pt wide with 40pt padding; the map takes the full column and
// keeps the still's aspect ratio.
const MAP_WIDTH = 532;

export function PdfSection({ company = {}, data = {} }) {
  const report = reportFrom(data);
  if (!report) return null;
  const palette = reportPalette(company);
  const { theme } = palette;
  const p = report.property;
  const outline = p.map?.outline || null;
  const aspect = outline ? outline.height / outline.width : 400 / 640;
  const mapHeight = Math.round(MAP_WIDTH * aspect);

  return (
    <View>
      <ReportHeading palette={palette}>{p.title}</ReportHeading>
      {p.rows.map((r, i) => (
        <KeyValueRow key={r.label} label={r.label} value={r.value} palette={palette} last={i === p.rows.length - 1} />
      ))}

      <View style={{ marginTop: 12 }} wrap={false}>
        <Text style={{ fontSize: 8, fontFamily: PDF_FONT_BOLD, letterSpacing: 1, color: theme.accentText, marginBottom: 6 }}>
          {String(p.map.title).toUpperCase()}
        </Text>
        {p.map.imageUrl ? (
          <View style={{ width: MAP_WIDTH, height: mapHeight, position: "relative", borderRadius: 6, overflow: "hidden" }}>
            <Image src={p.map.imageUrl} style={{ width: MAP_WIDTH, height: mapHeight, objectFit: "cover" }} />
            {outline && (
              <Svg
                viewBox={`0 0 ${outline.width} ${outline.height}`}
                style={{ position: "absolute", top: 0, left: 0, width: MAP_WIDTH, height: mapHeight }}
              >
                {/* A white halo under the brand stroke: aerial imagery is
                    dark roofs and dark asphalt, and a navy line alone
                    vanishes on it. Contrast against a photograph cannot be
                    measured, so both a light and a dark edge are drawn. */}
                <Polygon
                  points={outlinePointsAttr(outline)}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={Math.max(6, outline.width / 100)}
                />
                <Polygon
                  points={outlinePointsAttr(outline)}
                  fill={palette.rule}
                  fillOpacity={0.25}
                  stroke={palette.rule}
                  strokeWidth={Math.max(3, outline.width / 200)}
                />
              </Svg>
            )}
          </View>
        ) : null}
        <Text style={{ fontSize: 8, color: theme.inkMuted, marginTop: 5 }}>{p.map.caption}</Text>
      </View>
    </View>
  );
}
