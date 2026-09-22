// lib/documentSections/richTextPdf.js
//
// The PDF half of lib/quotes/richText.js: the block tree drawn as @react-pdf
// nodes. Paragraphs are one <Text> with nested runs; a list is a View per
// item with a bullet or number in the margin. No italic face is registered
// (lib/documents/pdfFont.js ships regular and bold only), so italic runs
// print in the regular face — the words are what matter on a quote, and a
// missing slant is not a missing sentence. Bold uses the bold face.
//
// Links print as underlined text; @react-pdf's <Link> would make them live in
// a viewer, but the URL is also what a homeowner reads on paper, so the text
// carries the words and the href is not printed twice.

import { View, Text } from "@react-pdf/renderer";
import { parseRichText } from "@/lib/quotes/richText";
import { PDF_FONT_BOLD } from "@/lib/documents/pdfFont";

function Runs({ runs, color }) {
  return runs.map((r, i) => (
    <Text
      key={i}
      style={{
        ...(r.bold ? { fontFamily: PDF_FONT_BOLD } : {}),
        ...(r.href ? { textDecoration: "underline" } : {}),
        color,
      }}
    >
      {r.text}
    </Text>
  ));
}

/**
 * @param body   the rich-text string
 * @param style  the <Text> style of a plain paragraph — size, colour,
 *               lineHeight, padding — applied to every block so the result
 *               sits exactly where a plain `detail` used to.
 */
export function RichTextPdf({ body, style = {} }) {
  const blocks = parseRichText(body);
  if (!blocks.length) return null;
  const { paddingLeft = 0, paddingRight = 0, marginTop = 0, marginBottom = 0, ...textStyle } = style;
  const color = textStyle.color;
  return (
    <View style={{ paddingLeft, paddingRight, marginTop, marginBottom }}>
      {blocks.map((b, i) => {
        const gap = i < blocks.length - 1 ? 3 : 0;
        if (b.kind === "p") {
          return (
            <Text key={i} style={{ ...textStyle, marginBottom: gap }}>
              <Runs runs={b.runs} color={color} />
            </Text>
          );
        }
        return (
          <View key={i} style={{ marginBottom: gap }}>
            {b.items.map((runs, j) => (
              <View key={j} style={{ flexDirection: "row", marginBottom: 1 }}>
                <Text style={{ ...textStyle, width: b.kind === "ol" ? 14 : 8 }}>
                  {b.kind === "ol" ? `${j + 1}.` : "•"}
                </Text>
                <Text style={{ ...textStyle, flex: 1 }}>
                  <Runs runs={runs} color={color} />
                </Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}
