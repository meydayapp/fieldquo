// lib/hr/renderTaxFormPdf.js
//
// A submitted TD1 / W-4 as one printed sheet: the answers under the
// government form's own headings, the typed signature, and a footer that
// says what this is not. Same engine and fonts as the payslip
// (lib/payroll/renderPayslipPdf.js). English or French headings — the two
// languages the paper forms exist in; a company in Spanish gets English,
// because there is no Spanish TD1 to mirror.
//
// The SIN / SSN box is printed EMPTY with "write by hand" — see
// lib/hr/taxForms.js for why it is never collected.
import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { registerPdfFonts, PDF_FONT, PDF_FONT_BOLD } from "@/lib/documents/pdfFont";
import { TAX_FORM_FIELDS, td1TotalClaim } from "@/lib/hr/taxForms";

const COPY = {
  en: {
    td1_federal: "TD1 — Personal Tax Credits Return (federal)",
    td1_provincial: "TD1 — Personal Tax Credits Return (provincial or territorial)",
    w4: "Form W-4 — Employee's Withholding Certificate",
    groups: { identity: "Identification", claims: "Claims", situations: "Situations", adjustments: "Adjustments" },
    fields: {
      lastName: "Last name", firstName: "First name", dateOfBirth: "Date of birth", address: "Address", postalCode: "Postal code",
      province: "Province or territory", basicPersonalAmount: "Basic personal amount", additionalClaims: "Other claims (lines 2–12, total)",
      moreThanOneEmployer: "More than one employer or payer at the same time", incomeBelowClaim: "Total income less than total claim amount",
      additionalTaxPerPeriod: "Additional tax to be deducted per period", cityStateZip: "City, state and ZIP", filingStatus: "Filing status",
      multipleJobs: "Multiple jobs or spouse works", dependentsAmount: "Claim for dependents", otherIncome: "Other income (not from jobs)",
      deductions: "Deductions", extraWithholding: "Extra withholding per pay period",
    },
    filing: { single: "Single or married filing separately", married_jointly: "Married filing jointly", head_of_household: "Head of household" },
    total: "Total claim amount",
    yes: "Yes", no: "No",
    sin: "Social insurance number: ______________________ (write by hand — not collected in FieldQuo)",
    ssn: "Social security number: ______________________ (write by hand — not collected in FieldQuo)",
    signed: "Signed",
    by: "by",
    taxYear: "Tax year",
    employer: "Employer",
    employee: "Employee",
    footer:
      "Answers recorded in FieldQuo for the employer's payroll file. FieldQuo files nothing with the CRA, Revenu Québec or the IRS and calculates no withholding. The employer keeps this sheet the way they keep the paper form.",
  },
  fr: {
    td1_federal: "TD1 — Déclaration des crédits d'impôt personnels (fédéral)",
    td1_provincial: "TD1 — Déclaration des crédits d'impôt personnels (provincial ou territorial)",
    w4: "Formulaire W-4 — Employee's Withholding Certificate",
    groups: { identity: "Identification", claims: "Montants demandés", situations: "Situations", adjustments: "Ajustements" },
    fields: {
      lastName: "Nom de famille", firstName: "Prénom", dateOfBirth: "Date de naissance", address: "Adresse", postalCode: "Code postal",
      province: "Province ou territoire", basicPersonalAmount: "Montant personnel de base", additionalClaims: "Autres montants (lignes 2 à 12, total)",
      moreThanOneEmployer: "Plus d'un employeur ou payeur en même temps", incomeBelowClaim: "Revenu total inférieur au montant total demandé",
      additionalTaxPerPeriod: "Impôt additionnel à retenir par période", cityStateZip: "Ville, État et ZIP", filingStatus: "Statut de déclaration",
      multipleJobs: "Plusieurs emplois ou conjoint qui travaille", dependentsAmount: "Montant pour personnes à charge", otherIncome: "Autres revenus (hors emploi)",
      deductions: "Déductions", extraWithholding: "Retenue supplémentaire par période de paie",
    },
    filing: { single: "Célibataire ou marié déclarant séparément", married_jointly: "Marié déclarant conjointement", head_of_household: "Chef de famille" },
    total: "Montant total demandé",
    yes: "Oui", no: "Non",
    sin: "Numéro d'assurance sociale : ______________________ (à écrire à la main — non recueilli dans FieldQuo)",
    ssn: "Numéro de sécurité sociale : ______________________ (à écrire à la main — non recueilli dans FieldQuo)",
    signed: "Signé",
    by: "par",
    taxYear: "Année d'imposition",
    employer: "Employeur",
    employee: "Employé",
    footer:
      "Réponses enregistrées dans FieldQuo pour le dossier de paie de l'employeur. FieldQuo ne transmet rien à l'ARC, à Revenu Québec ni à l'IRS et ne calcule aucune retenue. L'employeur conserve cette feuille comme il conserverait le formulaire papier.",
  },
};

function money(n) {
  if (n === null || n === undefined || n === "") return "—";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function valueText(field, value, c) {
  if (value === null || value === undefined || value === "") return "—";
  switch (field.type) {
    case "money":
      return money(value);
    case "bool":
      return value ? c.yes : c.no;
    case "select":
      return field.key === "filingStatus" ? c.filing[value] || String(value) : String(value);
    default:
      return String(value);
  }
}

function Row({ label, value, bold }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: "#d4d4d8" }}>
      <Text style={{ fontSize: 10, fontFamily: bold ? PDF_FONT_BOLD : PDF_FONT, flex: 1, paddingRight: 8 }}>{label}</Text>
      <Text style={{ fontSize: 10, fontFamily: bold ? PDF_FONT_BOLD : PDF_FONT, textAlign: "right" }}>{value}</Text>
    </View>
  );
}

export async function renderTaxFormPdfBuffer({ submission, workerName, companyName, language = "en" }) {
  registerPdfFonts();
  const c = COPY[language === "fr" ? "fr" : "en"];
  const fields = TAX_FORM_FIELDS[submission.formKind] || [];
  const groups = [];
  for (const f of fields) {
    let g = groups.find((x) => x.key === f.group);
    if (!g) groups.push((g = { key: f.group, fields: [] }));
    g.fields.push(f);
  }
  const isTd1 = submission.formKind.startsWith("td1");
  const total = isTd1 ? td1TotalClaim(submission.fields) : null;
  const signedAt = new Date(submission.submittedAt).toLocaleDateString(language === "fr" ? "fr-CA" : "en-CA", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

  const doc = (
    <Document title={c[submission.formKind]}>
      <Page size="LETTER" style={{ padding: 40, fontFamily: PDF_FONT, color: "#111827" }}>
        <Text style={{ fontSize: 15, fontFamily: PDF_FONT_BOLD, marginBottom: 4 }}>{c[submission.formKind]}</Text>
        <Text style={{ fontSize: 10, color: "#52525b", marginBottom: 14 }}>
          {c.taxYear} {submission.taxYear} · {c.employer}: {companyName} · {c.employee}: {workerName}
        </Text>

        {groups.map((g) => (
          <View key={g.key} style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontFamily: PDF_FONT_BOLD, marginBottom: 4 }}>{c.groups[g.key] || g.key}</Text>
            {g.fields.map((f) => (
              <Row key={f.key} label={c.fields[f.key] || f.key} value={valueText(f, submission.fields?.[f.key], c)} />
            ))}
            {g.key === "claims" && isTd1 ? <Row label={c.total} value={money(total)} bold /> : null}
            {g.key === "identity" ? (
              <Text style={{ fontSize: 9, color: "#52525b", marginTop: 6 }}>{isTd1 ? c.sin : c.ssn}</Text>
            ) : null}
          </View>
        ))}

        <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#111827" }}>
          <Text style={{ fontSize: 10 }}>
            {c.signed} {signedAt} {c.by} {submission.signatureName}
          </Text>
        </View>

        <Text style={{ position: "absolute", bottom: 28, left: 40, right: 40, fontSize: 8, color: "#52525b" }}>{c.footer}</Text>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
