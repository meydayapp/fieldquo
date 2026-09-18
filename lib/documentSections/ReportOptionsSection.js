// lib/documentSections/ReportOptionsSection.js
//
// "Your options": the cheapest and the premium option for this property,
// each with a "STARTING AT $X*" figure the loader re-priced from the saved
// measurement (lib/estimate/report/model.js — nothing here is a number the
// browser sent or the stored breakdown remembered).
//
// The image on each card is a neutral brand-wash tile carrying the option's
// name. The repo holds no photograph per material and the rate card has no
// image field, so an <Image> here would be a hotlink or a fabrication — both
// forbidden. When the company's material rows gain a photo, `card.imageUrl`
// is where the model will put it and this is where it will render.

import { View, Text, Image } from "@react-pdf/renderer";
import { PDF_FONT_BOLD } from "@/lib/documents/pdfFont";
import { reportPalette, reportFrom, ReportHeading } from "./reportShared";

export const meta = { type: "report_options", label: "Estimate report options" };

export function renderEmailHtml() {
  return "";
}

function Card({ card, options, palette, last }) {
  const { theme, wash, fill } = palette;
  return (
    <View
      style={{
        flex: 1,
        marginRight: last ? 0 : 10,
        borderRadius: 8,
        border: `1 solid ${theme.border}`,
        overflow: "hidden",
      }}
      wrap={false}
    >
      {card.imageUrl ? (
        <Image src={card.imageUrl} style={{ width: "100%", height: 90, objectFit: "cover" }} />
      ) : (
        <View style={{ height: 70, backgroundColor: wash.bg, alignItems: "center", justifyContent: "center", padding: 8 }}>
          <Text style={{ fontSize: 10, fontFamily: PDF_FONT_BOLD, color: wash.ink, textAlign: "center" }}>
            {card.label || options.startingAtLabel}
          </Text>
        </View>
      )}
      <View style={{ padding: 10 }}>
        {card.tier && (
          <Text style={{ fontSize: 7, letterSpacing: 1, fontFamily: PDF_FONT_BOLD, color: theme.accentText }}>
            {String(card.tier).toUpperCase()}
            {card.chosen ? `  ·  ${String(options.yourPickLabel).toUpperCase()}` : ""}
          </Text>
        )}
        {card.label && (
          <Text style={{ fontSize: 10, fontFamily: PDF_FONT_BOLD, color: theme.ink, marginTop: 3 }}>{card.label}</Text>
        )}
        {card.startingAt && (
          <View style={{ marginTop: 8, backgroundColor: fill.bg, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 8 }}>
            <Text style={{ fontSize: 7, letterSpacing: 1, color: fill.fg }}>{String(options.startingAtLabel).toUpperCase()}</Text>
            <Text style={{ fontSize: 15, fontFamily: PDF_FONT_BOLD, color: fill.fg }}>
              {card.startingAt}
              <Text style={{ fontSize: 9 }}>*</Text>
            </Text>
            {card.unit && <Text style={{ fontSize: 7, color: fill.fg }}>{card.unit}</Text>}
          </View>
        )}
      </View>
    </View>
  );
}

export function PdfSection({ company = {}, data = {} }) {
  const report = reportFrom(data);
  if (!report || !report.options.cards.length) return null;
  const palette = reportPalette(company);
  const o = report.options;
  return (
    <View>
      <ReportHeading palette={palette}>{o.title}</ReportHeading>
      <Text style={{ fontSize: 9, color: palette.theme.inkMuted, marginBottom: 8, lineHeight: 1.4 }}>{o.intro}</Text>
      <View style={{ flexDirection: "row" }}>
        {o.cards.map((c, i) => (
          <Card key={c.key || i} card={c} options={o} palette={palette} last={i === o.cards.length - 1} />
        ))}
      </View>
    </View>
  );
}
