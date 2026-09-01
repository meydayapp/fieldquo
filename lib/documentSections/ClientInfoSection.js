// lib/documentSections/ClientInfoSection.js
//
// Who it's for, and the facts about the document itself.
//
// Two panels side by side rather than one block of contact details. The left
// answers "is this mine"; the right answers "which quote is this, and until
// when" — the two questions a client asks when a PDF they half-expected lands
// in their inbox. Reference numbers and expiry dates were previously only in
// the masthead, which is fine on screen and useless once the page has been
// printed and put on a pile.
//
// It also crashed on any document without a client. `data.client.name` with no
// client is a TypeError inside react-pdf, which surfaces as a 500 on the
// download endpoint rather than as anything a person could act on. Everything
// here is optional now.

import { View, Text } from "@react-pdf/renderer";
import { documentTheme } from "@/lib/documents/theme";
import { documentLabels, documentFormatters } from "@/lib/i18n/documentLabels";
import { preparedForBlock } from "@/lib/email/documentEmailLayout";
import { documentIssueDate } from "@/lib/documents/issueDate";

export const meta = { type: "client_info", label: "Client details" };

// The email panel moved to documentEmailLayout.js, which is JSX-free and so
// reachable from routes that must not pull @react-pdf in behind it — see the
// comment on preparedForBlock. This stays as the section's entry point because
// the registry looks the function up by name.
//
// `language` was in the signature templateRenderer already passes and was
// being dropped on the floor: the heading rendered "PREPARED FOR" in English
// on a French quote whose PDF twin said "PRÉPARÉ POUR".
export function renderEmailHtml({ data = {}, company = {}, language }) {
  return preparedForBlock({
    theme: documentTheme(company),
    label: documentLabels(language).preparedFor,
    client: data.client || {},
  });
}

export function PdfSection({ data = {}, company = {}, language }) {
  const c = data.client || {};
  const t = documentTheme(company);
  const labels = documentLabels(language);
  const { date } = documentFormatters(language);

  // sentAt over createdAt — see lib/documents/issueDate.js. A document that
  // sat in draft for weeks is dated by when it reached the client, not by when
  // the row was first saved.
  const issueDate = documentIssueDate(data);

  const facts = [
    data.quoteNumber && ["Reference", data.quoteNumber],
    data.invoiceNumber && ["Reference", data.invoiceNumber],
    issueDate && [labels.date, date(issueDate)],
    data.validUntil && ["Valid until", date(data.validUntil)],
    data.dueDate && [labels.dueDate, date(data.dueDate)],
  ].filter(Boolean);

  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
      <Panel theme={t} title="Prepared for" flex={1.3}>
        {c.name ? (
          <Text
            style={{
              fontSize: 11,
              fontFamily: "Helvetica-Bold",
              color: t.ink,
              marginBottom: 2,
            }}
          >
            {c.name}
          </Text>
        ) : null}
        {c.address ? (
          <Text style={{ fontSize: 8, color: t.inkMuted, lineHeight: 1.4 }}>
            {c.address}
          </Text>
        ) : null}
        {c.email ? (
          <Text style={{ fontSize: 8, color: t.inkMuted }}>{c.email}</Text>
        ) : null}
        {c.phone ? (
          <Text style={{ fontSize: 8, color: t.inkMuted }}>{c.phone}</Text>
        ) : null}
      </Panel>

      {facts.length > 0 && (
        <Panel theme={t} title="Details" flex={1}>
          {facts.map(([label, value]) => (
            <View
              key={label + value}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 1.5,
              }}
            >
              <Text style={{ fontSize: 8, color: t.inkMuted }}>{label}</Text>
              <Text
                style={{
                  fontSize: 8,
                  fontFamily: "Helvetica-Bold",
                  color: t.ink,
                }}
              >
                {value}
              </Text>
            </View>
          ))}
        </Panel>
      )}
    </View>
  );
}

function Panel({ theme, title, children, flex }) {
  return (
    <View
      style={{
        flex,
        backgroundColor: theme.accentWash,
        borderRadius: 4,
        paddingVertical: 8,
        paddingHorizontal: 10,
      }}
    >
      <Text
        style={{
          fontSize: 6.5,
          fontFamily: "Helvetica-Bold",
          color: theme.inkFaint,
          letterSpacing: 0.8,
          marginBottom: 4,
        }}
      >
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}
