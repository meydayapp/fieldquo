// lib/i18n/documentLabels.js
//
// The fixed furniture of a quote or invoice — "Subtotal", "Balance Due",
// "Prepared for" — in every language FieldQuo sends in.
//
// Separate from app/i18n/messages.js on purpose. That catalogue is the app's
// own UI, read by staff, and it can change freely. These strings appear on a
// document a client signs, so they're small, closed, and hand-written rather
// than model-drafted. There are twenty of them; getting "Balance Due" wrong in
// Punjabi on an invoice is not the place to save effort.
//
// The other half of a translated document is the company's own service names,
// which live on Product.translations and go through the review screen at
// Settings → Translations. These labels never need reviewing because nobody
// edits them.

const LABELS = {
  en: {
    // ── A ticked custom box on the document ───────────────────────────────
    //
    // A company can flag one of its own custom fields to print on the quote
    // or invoice (CustomField.showOnDocuments). A checkbox one prints as a
    // word, and the word has to be the document's, not the reader's UI's.
    customYes: "Yes",
    customNo: "No",
    // ── The three things a tax line can say ────────────────────────────────
    //
    // `tax` above labels a MONEY row. These label the cases where there is no
    // money to show, and they exist because "$0.00" is a statement — "tax was
    // considered and came to nothing" — that Q-2026-0011 made on $5,250 of
    // Ontario work while asserting tax applied. taxUnresolved is the honest
    // version of that; taxNone is for a document that genuinely carries none.
    // See lib/tax/documentTax.js.
    quote: "Quote",
    invoice: "Invoice",
    preparedFor: "Prepared for",
    date: "Date",
    validUntil: "Valid until",
    dueDate: "Due date",
    jobAddress: "Job address",
    offlineDiscountIncluded: "Includes the e-transfer / cheque discount",
    description: "Description",
    qty: "Qty",
    amount: "Amount",
    subtotal: "Subtotal",
    discount: "Discount",
    tax: "Tax",
    total: "Total",
    amountPaid: "Amount paid",
    balanceDue: "Balance due",
    paymentHistory: "Payment history",
    paymentSummary: "Payment summary",
    notes: "Notes",
    kitchenPlan: "Kitchen plan",
    clientInfo: "Client",
    method: "Method",
    thankYou: "Thank you for your business",
    scopeOfWork: "Scope of work",
    whatsIncluded: "What's included",
    whatCouldChange: "What could change this price",
    howTheWorkRuns: "How the work runs",
    references: "Speak to past clients",
    beforeAfter: "Before & after",
    before: "Before",
    after: "After",
    taxUnresolved: "To be confirmed",
    taxNone: "None",
    taxAssumedNote: "Tax is shown at the {region} rate. We don't have your address on file, so this is based on ours — tell us if that's not right.",
    usTaxApplied: "{state} sales tax at {rate}% (ZIP {zip}){scope}. Rates as of {month}.",
    usTaxAppliedState: "{state} sales tax at {rate}%{scope}.",
    usScopeShare: " on {share}% of the amount",
    usScopeFixed: " — contractor's tax on gross receipts",
    usTaxUpTo: " Addresses in this ZIP may pay up to {maxRate}%.",
    usTaxNone: "No {state} sales tax is charged on this work: the contractor pays tax on materials when buying them, and labour on real property is not taxed.",
    usTaxNoneCapital: "No {state} sales tax is charged on this work: it is a capital improvement to the property.",
    usTaxNoneCompany: "No {state} sales tax is charged on this work.",
    photoReport: "Photo report",
    noPhotosNote: "No photos have been filed for this job yet.",
    signatureApproval: "Approval",
    signatureAcceptWithTotal: "Signing below accepts this quote at {total} and the scope of work set out above.",
    signatureAcceptNoTotal: "Signing below accepts this quote and the scope of work set out above.",
    signaturePaymentTermsNote: " Payment terms as stated.",
    signatureFieldLabel: "Signature",
    signatureNameFieldLabel: "Name",
    signatureDateFieldLabel: "Date",
    signatureDateSignedLabel: "Date signed",
    signatureElectronicallySigned: "Electronically signed",
    signatureFromIp: "from {ip}",
    signatureDocumentRef: "document {hash}…",
  },
  fr: {
    customYes: "Oui",
    customNo: "Non",
    quote: "Devis",
    invoice: "Facture",
    preparedFor: "Préparé pour",
    date: "Date",
    validUntil: "Valide jusqu'au",
    dueDate: "Date d'échéance",
    jobAddress: "Adresse des travaux",
    offlineDiscountIncluded: "Comprend le rabais virement / chèque",
    description: "Description",
    qty: "Qté",
    amount: "Montant",
    subtotal: "Sous-total",
    discount: "Rabais",
    tax: "Taxes",
    total: "Total",
    amountPaid: "Montant payé",
    balanceDue: "Solde dû",
    paymentHistory: "Historique des paiements",
    paymentSummary: "Résumé des paiements",
    notes: "Notes",
    kitchenPlan: "Plan de cuisine",
    clientInfo: "Client",
    method: "Mode de paiement",
    thankYou: "Merci de votre confiance",
    scopeOfWork: "Étendue des travaux",
    whatsIncluded: "Ce qui est compris",
    whatCouldChange: "Ce qui pourrait modifier ce prix",
    howTheWorkRuns: "Comment se déroulent les travaux",
    references: "Parlez à d'anciens clients",
    beforeAfter: "Avant et après",
    before: "Avant",
    after: "Après",
    taxUnresolved: "À confirmer",
    taxNone: "Aucune",
    taxAssumedNote: "La taxe est indiquée au taux de {region}. Nous n'avons pas votre adresse, elle est donc basée sur la nôtre — dites-le-nous si ce n'est pas exact.",
    usTaxApplied: "Taxe de vente de l'État de {state} à {rate} % (ZIP {zip}){scope}. Taux en vigueur : {month}.",
    usTaxAppliedState: "Taxe de vente de l'État de {state} à {rate} %{scope}.",
    usScopeShare: " sur {share} % du montant",
    usScopeFixed: " — taxe d'entrepreneur sur les recettes brutes",
    usTaxUpTo: " Certaines adresses de ce ZIP peuvent payer jusqu'à {maxRate} %.",
    usTaxNone: "Aucune taxe de vente de l'État de {state} n'est facturée sur ces travaux : l'entrepreneur paie la taxe sur les matériaux à l'achat, et la main-d'œuvre sur un bien immobilier n'est pas taxée.",
    usTaxNoneCapital: "Aucune taxe de vente de l'État de {state} n'est facturée sur ces travaux : il s'agit d'une amélioration permanente de la propriété.",
    usTaxNoneCompany: "Aucune taxe de vente de l'État de {state} n'est facturée sur ces travaux.",
    photoReport: "Rapport photo",
    noPhotosNote: "Aucune photo n'a encore été déposée pour ce chantier.",
    signatureApproval: "Approbation",
    signatureAcceptWithTotal: "En signant ci-dessous, vous acceptez ce devis au montant de {total} ainsi que l'étendue des travaux décrite ci-dessus.",
    signatureAcceptNoTotal: "En signant ci-dessous, vous acceptez ce devis ainsi que l'étendue des travaux décrite ci-dessus.",
    signaturePaymentTermsNote: " Modalités de paiement telles qu'indiquées.",
    signatureFieldLabel: "Signature",
    signatureNameFieldLabel: "Nom",
    signatureDateFieldLabel: "Date",
    signatureDateSignedLabel: "Date de signature",
    signatureElectronicallySigned: "Signé électroniquement",
    signatureFromIp: "depuis {ip}",
    signatureDocumentRef: "document {hash}…",
  },
  es: {
    customYes: "Sí",
    customNo: "No",
    quote: "Presupuesto",
    invoice: "Factura",
    preparedFor: "Preparado para",
    date: "Fecha",
    validUntil: "Válido hasta",
    dueDate: "Fecha de vencimiento",
    jobAddress: "Dirección de la obra",
    offlineDiscountIncluded: "Incluye el descuento por transferencia / cheque",
    description: "Descripción",
    qty: "Cant.",
    amount: "Importe",
    subtotal: "Subtotal",
    discount: "Descuento",
    tax: "Impuestos",
    total: "Total",
    amountPaid: "Importe pagado",
    balanceDue: "Saldo pendiente",
    paymentHistory: "Historial de pagos",
    paymentSummary: "Resumen de pagos",
    notes: "Notas",
    kitchenPlan: "Plano de cocina",
    clientInfo: "Cliente",
    method: "Método de pago",
    thankYou: "Gracias por su confianza",
    scopeOfWork: "Alcance del trabajo",
    whatsIncluded: "Qué incluye",
    whatCouldChange: "Qué podría cambiar este precio",
    howTheWorkRuns: "Cómo se realiza el trabajo",
    references: "Hable con clientes anteriores",
    beforeAfter: "Antes y después",
    before: "Antes",
    after: "Después",
    taxUnresolved: "Por confirmar",
    taxNone: "Ninguno",
    taxAssumedNote: "El impuesto se muestra a la tasa de {region}. No tenemos su dirección, así que se basa en la nuestra: avísenos si no es correcto.",
    usTaxApplied: "Impuesto sobre las ventas de {state} al {rate}% (ZIP {zip}){scope}. Tasas vigentes: {month}.",
    usTaxAppliedState: "Impuesto sobre las ventas de {state} al {rate}%{scope}.",
    usScopeShare: " sobre el {share}% del importe",
    usScopeFixed: " — impuesto del contratista sobre los ingresos brutos",
    usTaxUpTo: " Algunas direcciones de este ZIP pueden pagar hasta {maxRate}%.",
    usTaxNone: "No se cobra impuesto sobre las ventas de {state} en este trabajo: el contratista paga el impuesto sobre los materiales al comprarlos, y la mano de obra en bienes inmuebles no está gravada.",
    usTaxNoneCapital: "No se cobra impuesto sobre las ventas de {state} en este trabajo: es una mejora permanente de la propiedad.",
    usTaxNoneCompany: "No se cobra impuesto sobre las ventas de {state} en este trabajo.",
    photoReport: "Informe fotográfico",
    noPhotosNote: "Todavía no se ha registrado ninguna foto para este trabajo.",
    signatureApproval: "Aprobación",
    signatureAcceptWithTotal: "Al firmar a continuación, acepta este presupuesto por {total} y el alcance del trabajo indicado arriba.",
    signatureAcceptNoTotal: "Al firmar a continuación, acepta este presupuesto y el alcance del trabajo indicado arriba.",
    signaturePaymentTermsNote: " Condiciones de pago según lo indicado.",
    signatureFieldLabel: "Firma",
    signatureNameFieldLabel: "Nombre",
    signatureDateFieldLabel: "Fecha",
    signatureDateSignedLabel: "Fecha de firma",
    signatureElectronicallySigned: "Firmado electrónicamente",
    signatureFromIp: "desde {ip}",
    signatureDocumentRef: "documento {hash}…",
  },
  uk: {
    customYes: "Так",
    customNo: "Ні",
    quote: "Кошторис",
    invoice: "Рахунок",
    preparedFor: "Підготовлено для",
    date: "Дата",
    validUntil: "Дійсний до",
    dueDate: "Термін оплати",
    jobAddress: "Адреса робіт",
    offlineDiscountIncluded: "Включає знижку за e-Transfer / чек",
    description: "Опис",
    qty: "К-сть",
    amount: "Сума",
    subtotal: "Проміжний підсумок",
    discount: "Знижка",
    tax: "Податок",
    total: "Разом",
    amountPaid: "Сплачено",
    balanceDue: "До сплати",
    paymentHistory: "Історія платежів",
    paymentSummary: "Підсумок платежів",
    notes: "Примітки",
    kitchenPlan: "План кухні",
    clientInfo: "Клієнт",
    method: "Спосіб оплати",
    thankYou: "Дякуємо за співпрацю",
    scopeOfWork: "Обсяг робіт",
    whatsIncluded: "Що входить",
    whatCouldChange: "Що може змінити цю ціну",
    howTheWorkRuns: "Як проходить робота",
    references: "Поговоріть із попередніми клієнтами",
    beforeAfter: "До і після",
    before: "До",
    after: "Після",
    taxUnresolved: "Потребує підтвердження",
    taxNone: "Немає",
    taxAssumedNote: "Податок показано за ставкою {region}. У нас немає вашої адреси, тому він базується на нашій — повідомте, якщо це не так.",
    usTaxApplied: "Податок з продажу штату {state} {rate}% (ZIP {zip}){scope}. Ставки станом на {month}.",
    usTaxAppliedState: "Податок з продажу штату {state} {rate}%{scope}.",
    usScopeShare: " на {share}% суми",
    usScopeFixed: " — податок підрядника з валового доходу",
    usTaxUpTo: " Деякі адреси в цьому ZIP можуть сплачувати до {maxRate}%.",
    usTaxNone: "Податок з продажу штату {state} на ці роботи не нараховується: підрядник сплачує податок на матеріали під час купівлі, а роботи з нерухомістю не оподатковуються.",
    usTaxNoneCapital: "Податок з продажу штату {state} на ці роботи не нараховується: це капітальне поліпшення нерухомості.",
    usTaxNoneCompany: "Податок з продажу штату {state} на ці роботи не нараховується.",
    photoReport: "Фотозвіт",
    noPhotosNote: "Для цього завдання ще не подано жодного фото.",
    signatureApproval: "Підтвердження",
    signatureAcceptWithTotal: "Підписавши нижче, ви погоджуєтесь із цим кошторисом на суму {total} та обсягом робіт, зазначеним вище.",
    signatureAcceptNoTotal: "Підписавши нижче, ви погоджуєтесь із цим кошторисом та обсягом робіт, зазначеним вище.",
    signaturePaymentTermsNote: " Умови оплати згідно із зазначеним.",
    signatureFieldLabel: "Підпис",
    signatureNameFieldLabel: "Ім'я",
    signatureDateFieldLabel: "Дата",
    signatureDateSignedLabel: "Дата підписання",
    signatureElectronicallySigned: "Підписано електронно",
    signatureFromIp: "з {ip}",
    signatureDocumentRef: "документ {hash}…",
  },
  pa: {
    customYes: "ਹਾਂ",
    customNo: "ਨਹੀਂ",
    quote: "ਹਵਾਲਾ",
    invoice: "ਬਿੱਲ",
    preparedFor: "ਲਈ ਤਿਆਰ ਕੀਤਾ",
    date: "ਮਿਤੀ",
    validUntil: "ਤੱਕ ਵੈਧ",
    dueDate: "ਭੁਗਤਾਨ ਦੀ ਮਿਤੀ",
    jobAddress: "ਕੰਮ ਦਾ ਪਤਾ",
    offlineDiscountIncluded: "ਈ-ਟ੍ਰਾਂਸਫਰ / ਚੈੱਕ ਛੋਟ ਸ਼ਾਮਲ ਹੈ",
    description: "ਵੇਰਵਾ",
    qty: "ਗਿਣਤੀ",
    amount: "ਰਕਮ",
    subtotal: "ਉਪ-ਜੋੜ",
    discount: "ਛੂਟ",
    tax: "ਟੈਕਸ",
    total: "ਕੁੱਲ",
    amountPaid: "ਅਦਾ ਕੀਤੀ ਰਕਮ",
    balanceDue: "ਬਕਾਇਆ ਰਕਮ",
    paymentHistory: "ਭੁਗਤਾਨ ਦਾ ਇਤਿਹਾਸ",
    paymentSummary: "ਭੁਗਤਾਨ ਸਾਰ",
    notes: "ਨੋਟਸ",
    kitchenPlan: "ਰਸੋਈ ਦੀ ਯੋਜਨਾ",
    clientInfo: "ਗਾਹਕ",
    method: "ਭੁਗਤਾਨ ਦਾ ਤਰੀਕਾ",
    thankYou: "ਤੁਹਾਡੇ ਕਾਰੋਬਾਰ ਲਈ ਧੰਨਵਾਦ",
    scopeOfWork: "ਕੰਮ ਦਾ ਘੇਰਾ",
    whatsIncluded: "ਕੀ ਸ਼ਾਮਲ ਹੈ",
    whatCouldChange: "ਇਹ ਕੀਮਤ ਕੀ ਬਦਲ ਸਕਦਾ ਹੈ",
    howTheWorkRuns: "ਕੰਮ ਕਿਵੇਂ ਚੱਲਦਾ ਹੈ",
    references: "ਪਿਛਲੇ ਗਾਹਕਾਂ ਨਾਲ ਗੱਲ ਕਰੋ",
    beforeAfter: "ਪਹਿਲਾਂ ਅਤੇ ਬਾਅਦ",
    before: "ਪਹਿਲਾਂ",
    after: "ਬਾਅਦ",
    taxUnresolved: "ਪੁਸ਼ਟੀ ਬਾਕੀ",
    taxNone: "ਕੋਈ ਨਹੀਂ",
    taxAssumedNote: "ਟੈਕਸ {region} ਦੀ ਦਰ 'ਤੇ ਦਿਖਾਈ ਗਈ ਹੈ। ਸਾਡੇ ਕੋਲ ਤੁਹਾਡਾ ਪਤਾ ਨਹੀਂ, ਇਸ ਲਈ ਇਹ ਸਾਡੇ ਪਤੇ 'ਤੇ ਅਧਾਰਤ ਹੈ — ਜੇ ਇਹ ਗਲਤ ਹੈ ਤਾਂ ਸਾਨੂੰ ਦੱਸੋ।",
    usTaxApplied: "{state} ਵਿਕਰੀ ਟੈਕਸ {rate}% (ZIP {zip}){scope}। ਦਰਾਂ {month} ਅਨੁਸਾਰ।",
    usTaxAppliedState: "{state} ਵਿਕਰੀ ਟੈਕਸ {rate}%{scope}।",
    usScopeShare: " ਰਕਮ ਦੇ {share}% 'ਤੇ",
    usScopeFixed: " — ਕੁੱਲ ਆਮਦਨ 'ਤੇ ਠੇਕੇਦਾਰ ਟੈਕਸ",
    usTaxUpTo: " ਇਸ ZIP ਦੇ ਕੁਝ ਪਤੇ {maxRate}% ਤੱਕ ਦੇ ਸਕਦੇ ਹਨ।",
    usTaxNone: "ਇਸ ਕੰਮ 'ਤੇ {state} ਵਿਕਰੀ ਟੈਕਸ ਨਹੀਂ ਲਿਆ ਜਾਂਦਾ: ਠੇਕੇਦਾਰ ਸਮੱਗਰੀ ਖਰੀਦਣ ਵੇਲੇ ਟੈਕਸ ਦਿੰਦਾ ਹੈ, ਅਤੇ ਅਚੱਲ ਜਾਇਦਾਦ 'ਤੇ ਮਜ਼ਦੂਰੀ 'ਤੇ ਟੈਕਸ ਨਹੀਂ ਲੱਗਦਾ।",
    usTaxNoneCapital: "ਇਸ ਕੰਮ 'ਤੇ {state} ਵਿਕਰੀ ਟੈਕਸ ਨਹੀਂ ਲਿਆ ਜਾਂਦਾ: ਇਹ ਜਾਇਦਾਦ ਵਿੱਚ ਸਥਾਈ ਸੁਧਾਰ ਹੈ।",
    usTaxNoneCompany: "ਇਸ ਕੰਮ 'ਤੇ {state} ਵਿਕਰੀ ਟੈਕਸ ਨਹੀਂ ਲਿਆ ਜਾਂਦਾ।",
    photoReport: "ਫੋਟੋ ਰਿਪੋਰਟ",
    noPhotosNote: "ਇਸ ਕੰਮ ਲਈ ਹਾਲੇ ਤੱਕ ਕੋਈ ਫੋਟੋ ਦਾਖਲ ਨਹੀਂ ਕੀਤੀ ਗਈ।",
    signatureApproval: "ਮਨਜ਼ੂਰੀ",
    signatureAcceptWithTotal: "ਹੇਠਾਂ ਦਸਤਖਤ ਕਰਨ ਨਾਲ ਤੁਸੀਂ ਇਸ ਹਵਾਲੇ ਨੂੰ {total} 'ਤੇ ਅਤੇ ਉੱਪਰ ਦੱਸੇ ਕੰਮ ਦੇ ਘੇਰੇ ਨੂੰ ਸਵੀਕਾਰ ਕਰਦੇ ਹੋ।",
    signatureAcceptNoTotal: "ਹੇਠਾਂ ਦਸਤਖਤ ਕਰਨ ਨਾਲ ਤੁਸੀਂ ਇਸ ਹਵਾਲੇ ਨੂੰ ਅਤੇ ਉੱਪਰ ਦੱਸੇ ਕੰਮ ਦੇ ਘੇਰੇ ਨੂੰ ਸਵੀਕਾਰ ਕਰਦੇ ਹੋ।",
    signaturePaymentTermsNote: " ਭੁਗਤਾਨ ਦੀਆਂ ਸ਼ਰਤਾਂ ਦੱਸੇ ਅਨੁਸਾਰ।",
    signatureFieldLabel: "ਦਸਤਖਤ",
    signatureNameFieldLabel: "ਨਾਮ",
    signatureDateFieldLabel: "ਮਿਤੀ",
    signatureDateSignedLabel: "ਦਸਤਖਤ ਦੀ ਮਿਤੀ",
    signatureElectronicallySigned: "ਇਲੈਕਟ੍ਰਾਨਿਕ ਤਰੀਕੇ ਨਾਲ ਦਸਤਖਤ ਕੀਤੇ",
    signatureFromIp: "{ip} ਤੋਂ",
    signatureDocumentRef: "ਦਸਤਾਵੇਜ਼ {hash}…",
  },
  tl: {
    customYes: "Oo",
    customNo: "Hindi",
    quote: "Quote",
    invoice: "Invoice",
    preparedFor: "Inihanda para kay",
    date: "Petsa",
    validUntil: "Balido hanggang",
    dueDate: "Takdang petsa ng bayad",
    jobAddress: "Address ng trabaho",
    offlineDiscountIncluded: "Kasama ang diskwento sa e-transfer / tseke",
    description: "Deskripsyon",
    qty: "Dami",
    amount: "Halaga",
    subtotal: "Subtotal",
    discount: "Diskwento",
    tax: "Buwis",
    total: "Kabuuan",
    amountPaid: "Nabayarang halaga",
    balanceDue: "Natitirang balanse",
    paymentHistory: "Kasaysayan ng bayad",
    paymentSummary: "Buod ng bayad",
    notes: "Mga tala",
    kitchenPlan: "Plano ng kusina",
    clientInfo: "Kliyente",
    method: "Paraan ng bayad",
    thankYou: "Salamat sa iyong tiwala",
    scopeOfWork: "Saklaw ng trabaho",
    whatsIncluded: "Ano ang kasama",
    whatCouldChange: "Ano ang maaaring magbago sa presyong ito",
    howTheWorkRuns: "Paano isinasagawa ang trabaho",
    references: "Kausapin ang mga dating kliyente",
    beforeAfter: "Bago at pagkatapos",
    before: "Bago",
    after: "Pagkatapos",
    taxUnresolved: "Kumpirmahin pa",
    taxNone: "Wala",
    taxAssumedNote: "Ang buwis ay ipinapakita sa rate ng {region}. Wala kaming address ninyo, kaya nakabase ito sa amin — sabihin ninyo kung mali.",
    usTaxApplied: "Sales tax ng {state} na {rate}% (ZIP {zip}){scope}. Mga rate noong {month}.",
    usTaxAppliedState: "Sales tax ng {state} na {rate}%{scope}.",
    usScopeShare: " sa {share}% ng halaga",
    usScopeFixed: " — buwis ng kontratista sa kabuuang kita",
    usTaxUpTo: " Ang ilang address sa ZIP na ito ay maaaring magbayad ng hanggang {maxRate}%.",
    usTaxNone: "Walang sinisingil na sales tax ng {state} sa gawaing ito: nagbabayad ang kontratista ng buwis sa mga materyales kapag binibili, at hindi binubuwisan ang paggawa sa real property.",
    usTaxNoneCapital: "Walang sinisingil na sales tax ng {state} sa gawaing ito: isa itong permanenteng pagpapabuti sa ari-arian.",
    usTaxNoneCompany: "Walang sinisingil na sales tax ng {state} sa gawaing ito.",
    photoReport: "Ulat ng larawan",
    noPhotosNote: "Wala pang larawang naisumite para sa trabahong ito.",
    signatureApproval: "Pag-apruba",
    signatureAcceptWithTotal: "Ang paglagda sa ibaba ay tumatanggap sa quote na ito sa halagang {total} at sa saklaw ng trabahong nakasaad sa itaas.",
    signatureAcceptNoTotal: "Ang paglagda sa ibaba ay tumatanggap sa quote na ito at sa saklaw ng trabahong nakasaad sa itaas.",
    signaturePaymentTermsNote: " Mga tuntunin sa pagbabayad gaya ng nakasaad.",
    signatureFieldLabel: "Lagda",
    signatureNameFieldLabel: "Pangalan",
    signatureDateFieldLabel: "Petsa",
    signatureDateSignedLabel: "Petsa ng paglagda",
    signatureElectronicallySigned: "Elektronikong nilagdaan",
    signatureFromIp: "mula sa {ip}",
    signatureDocumentRef: "dokumento {hash}…",
  },
  // ── German, formal ───────────────────────────────────────────────────────
  //
  // `Sie` throughout, matching the decision already committed to in the German
  // app catalogue and marketing copy. The money words are taken from that
  // catalogue rather than chosen afresh — Zwischensumme, Steuer, Rabatt,
  // Gesamtsumme, "Offener Saldo" for the balance — so the invoice a homeowner
  // reads uses the same word as the screen the contractor read it off.
  de: {
    customYes: "Ja",
    customNo: "Nein",
    quote: "Angebot",
    invoice: "Rechnung",
    preparedFor: "Erstellt für",
    date: "Datum",
    validUntil: "Gültig bis",
    dueDate: "Fälligkeitsdatum",
    jobAddress: "Adresse der Baustelle",
    offlineDiscountIncluded: "Enthält den Rabatt E-Transfer / Scheck",
    description: "Beschreibung",
    qty: "Menge",
    amount: "Betrag",
    subtotal: "Zwischensumme",
    discount: "Rabatt",
    tax: "Steuer",
    total: "Gesamtsumme",
    amountPaid: "Gezahlter Betrag",
    // "Offener Saldo", not "Restbetrag": the app catalogue already settled on
    // it for app.invoiceDetail.balanceDue, and this is the one line a client
    // acts on. Two words for the same figure in two places is how a client and
    // a contractor end up talking past each other on the phone.
    balanceDue: "Offener Saldo",
    paymentHistory: "Zahlungsverlauf",
    paymentSummary: "Zahlungsübersicht",
    notes: "Notizen",
    kitchenPlan: "Küchenplan",
    clientInfo: "Kunde",
    method: "Zahlungsmethode",
    thankYou: "Vielen Dank für Ihren Auftrag",
    scopeOfWork: "Leistungsumfang",
    whatsIncluded: "Was enthalten ist",
    whatCouldChange: "Was diesen Preis ändern könnte",
    howTheWorkRuns: "Wie die Arbeiten ablaufen",
    references: "Sprechen Sie mit früheren Kunden",
    beforeAfter: "Vorher und nachher",
    before: "Vorher",
    after: "Nachher",
    taxUnresolved: "Wird noch bestätigt",
    taxNone: "Keine",
    taxAssumedNote: "Die Steuer ist zum Satz für {region} ausgewiesen. Uns liegt Ihre Adresse nicht vor, sie beruht daher auf unserer — sagen Sie uns Bescheid, wenn das nicht stimmt.",
    usTaxApplied: "Verkaufssteuer {state} von {rate} % (ZIP {zip}){scope}. Sätze Stand {month}.",
    usTaxAppliedState: "Verkaufssteuer {state} von {rate} %{scope}.",
    usScopeShare: " auf {share} % des Betrags",
    usScopeFixed: " — Unternehmersteuer auf die Bruttoeinnahmen",
    usTaxUpTo: " Manche Adressen in diesem ZIP zahlen bis zu {maxRate} %.",
    usTaxNone: "Auf diese Arbeiten wird keine Verkaufssteuer {state} berechnet: Der Unternehmer zahlt die Steuer beim Materialeinkauf, und Arbeitsleistung an Immobilien wird nicht besteuert.",
    usTaxNoneCapital: "Auf diese Arbeiten wird keine Verkaufssteuer {state} berechnet: Es handelt sich um eine dauerhafte Verbesserung der Immobilie.",
    usTaxNoneCompany: "Auf diese Arbeiten wird keine Verkaufssteuer {state} berechnet.",
    photoReport: "Fotobericht",
    noPhotosNote: "Für diesen Auftrag wurden noch keine Fotos hinterlegt.",
    // "Annahme", not "Freigabe": the app catalogue uses "Freigabe" for the
    // INTERNAL step where a colleague releases a price, and "angenommen" for
    // what the client does. This heading sits over the client's signature.
    signatureApproval: "Annahme",
    signatureAcceptWithTotal: "Mit Ihrer Unterschrift unten nehmen Sie dieses Angebot über {total} sowie den oben beschriebenen Leistungsumfang an.",
    signatureAcceptNoTotal: "Mit Ihrer Unterschrift unten nehmen Sie dieses Angebot sowie den oben beschriebenen Leistungsumfang an.",
    signaturePaymentTermsNote: " Zahlungsbedingungen wie angegeben.",
    signatureFieldLabel: "Unterschrift",
    signatureNameFieldLabel: "Name",
    signatureDateFieldLabel: "Datum",
    signatureDateSignedLabel: "Datum der Unterschrift",
    signatureElectronicallySigned: "Elektronisch unterschrieben",
    signatureFromIp: "von {ip}",
    signatureDocumentRef: "Dokument {hash}…",
  },
  // ── Italian, formal ──────────────────────────────────────────────────────
  //
  // `Lei` throughout, matching the Italian app catalogue. Money words taken
  // from it for the same reason as German above: Subtotale, Imposta, Sconto,
  // Totale, "Saldo da pagare".
  it: {
    customYes: "Sì",
    customNo: "No",
    quote: "Preventivo",
    invoice: "Fattura",
    preparedFor: "Preparato per",
    date: "Data",
    validUntil: "Valido fino al",
    dueDate: "Data di scadenza",
    jobAddress: "Indirizzo del lavoro",
    offlineDiscountIncluded: "Include lo sconto e-transfer / assegno",
    description: "Descrizione",
    qty: "Q.tà",
    amount: "Importo",
    subtotal: "Subtotale",
    discount: "Sconto",
    // "Imposta", singular, not "Tasse": the app catalogue uses it, and on an
    // Italian invoice the line is one charge at one rate, not a category.
    tax: "Imposta",
    total: "Totale",
    amountPaid: "Importo pagato",
    balanceDue: "Saldo da pagare",
    paymentHistory: "Storico dei pagamenti",
    paymentSummary: "Riepilogo dei pagamenti",
    notes: "Note",
    kitchenPlan: "Progetto della cucina",
    clientInfo: "Cliente",
    method: "Metodo di pagamento",
    thankYou: "Grazie per la fiducia",
    scopeOfWork: "Ambito dei lavori",
    whatsIncluded: "Che cosa è compreso",
    whatCouldChange: "Che cosa potrebbe cambiare questo prezzo",
    howTheWorkRuns: "Come si svolgono i lavori",
    references: "Parli con clienti precedenti",
    beforeAfter: "Prima e dopo",
    before: "Prima",
    after: "Dopo",
    taxUnresolved: "Da confermare",
    taxNone: "Nessuna",
    taxAssumedNote: "L'imposta è indicata all'aliquota di {region}. Non abbiamo il suo indirizzo, quindi si basa sul nostro — ci dica se non è corretto.",
    usTaxApplied: "Imposta sulle vendite {state} al {rate}% (ZIP {zip}){scope}. Aliquote aggiornate a {month}.",
    usTaxAppliedState: "Imposta sulle vendite {state} al {rate}%{scope}.",
    usScopeShare: " sul {share}% dell'importo",
    usScopeFixed: " — imposta dell'appaltatore sui ricavi lordi",
    usTaxUpTo: " Alcuni indirizzi in questo ZIP possono pagare fino al {maxRate}%.",
    usTaxNone: "Su questi lavori non viene addebitata l'imposta sulle vendite {state}: l'appaltatore paga l'imposta sui materiali all'acquisto e la manodopera su beni immobili non è tassata.",
    usTaxNoneCapital: "Su questi lavori non viene addebitata l'imposta sulle vendite {state}: si tratta di un miglioramento permanente della proprietà.",
    usTaxNoneCompany: "Su questi lavori non viene addebitata l'imposta sulle vendite {state}.",
    photoReport: "Rapporto fotografico",
    noPhotosNote: "Per questo lavoro non è ancora stata registrata alcuna foto.",
    signatureApproval: "Approvazione",
    signatureAcceptWithTotal: "Firmando qui sotto accetta questo preventivo per {total} e l'ambito dei lavori descritto sopra.",
    signatureAcceptNoTotal: "Firmando qui sotto accetta questo preventivo e l'ambito dei lavori descritto sopra.",
    signaturePaymentTermsNote: " Condizioni di pagamento come indicato.",
    signatureFieldLabel: "Firma",
    signatureNameFieldLabel: "Nome",
    signatureDateFieldLabel: "Data",
    signatureDateSignedLabel: "Data della firma",
    signatureElectronicallySigned: "Firmato elettronicamente",
    signatureFromIp: "da {ip}",
    signatureDocumentRef: "documento {hash}…",
  },
};

/**
 * Label lookup for one language.
 *
 * Falls back per-key to English rather than per-language, so adding a new
 * label doesn't blank it out in five languages until someone translates it.
 */
export function documentLabels(language = "en") {
  const chosen = LABELS[language] || {};
  return new Proxy(
    {},
    {
      get(_t, key) {
        return chosen[key] ?? LABELS.en[key] ?? String(key);
      },
    },
  );
}

/**
 * Currency and date formatted for the reader's locale.
 *
 * A Ukrainian-speaking homeowner in Toronto is still being billed in Canadian
 * dollars — so the currency stays CAD and only the formatting shifts.
 */
export function documentFormatters(language = "en", currency = "CAD") {
  // ── Why this coalesce is not redundant with the default parameter ────────
  //
  // A default parameter only fires for `undefined`. Company.currency is
  // `String?`, so a company that has never touched the setting stores NULL —
  // and `documentFormatters(lang, null)` kept the null, which made
  // toLocaleString throw RangeError, which fell into the catch below, which
  // returned "$2100.00".
  //
  // That is exactly what a homeowner saw on the quote and the invoice: no
  // thousands separator on the line items, the subtotal and the total, while
  // every internal screen showed "$2,100.00". Two formats for the same number,
  // one of them on the document the client keeps.
  //
  // Empty string is caught for the same reason — it is equally invalid to Intl
  // and equally likely to arrive from a form.
  const code = currency || "CAD";

  const locale =
    {
      en: "en-CA",
      fr: "fr-CA",
      es: "es-419",
      uk: "uk-UA",
      pa: "pa-IN",
      tl: "fil-PH",
      // There is no de-CA or it-CA, and inventing one is not a thing Intl
      // would honour anyway. The country here decides digit grouping and date
      // order, not the currency — that stays whatever the company bills in,
      // per the note above — so the home locale is the right answer for a
      // reader of the language wherever they live.
      //
      // it-IT prints 2100 as "2100,00" and 12100 as "12.100,00", which looks
      // like the missing-separator bug above and is not: CLDR gives Italian
      // min2 grouping, so four-digit numbers are deliberately ungrouped. It is
      // ONE formatter for the whole document, so the line items, the subtotal
      // and the total all agree — which is the property that actually mattered.
      // Do not force useGrouping here; that would make an Italian invoice wrong
      // in a way an Italian reader would notice.
      de: "de-DE",
      it: "it-IT",
    }[language] || "en-CA";

  return {
    // Exposed so a caller that needs an Intl format this file doesn't provide
    // — a month header, a time of day in the company's timezone — builds it
    // against the SAME locale rather than copying the map above. The copy is
    // the one that rots when a seventh language is added.
    locale,
    money(n) {
      // `Number(n ?? 0)` only catches null and undefined. A non-numeric string
      // is neither, so "abc" — or a Decimal that arrived unserialised — became
      // NaN and rendered "$NaN" on a quote a homeowner is being asked to sign.
      // Zero is the honest fallback: it is visibly wrong to whoever sends the
      // document, where NaN just looks broken to whoever receives it.
      const amount = Number(n);
      const value = Number.isFinite(amount) ? amount : 0;
      try {
        return value.toLocaleString(locale, {
          style: "currency",
          currency: code,
        });
      } catch {
        // Last resort, for an exotic runtime with no Intl currency data. It
        // still GROUPS — the old fallback dropped the separators, so the
        // degraded path was visually distinct from the good one on the same
        // page. A fallback should look like the thing it replaces.
        try {
          return `$${value.toLocaleString(locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;
        } catch {
          return `$${value.toFixed(2)}`;
        }
      }
    },
    /**
     * A date on a client-facing document.
     *
     * ── Read as UTC, always, and that is a fix not a detail ─────────────────
     *
     * `validUntil` and `dueDate` are CALENDAR DATES. They are stored as UTC
     * midnight — the 30th of September is `2026-09-30T00:00:00Z`, an instant
     * only because the column is a DateTime. Formatted in any timezone west of
     * UTC that instant is still the 29th, so a quote valid until the 30th told
     * the client it expired on the 29th. A day off, on the one line of a quote
     * whose whole job is to state a deadline.
     *
     * This used to pass no timeZone at all, which means it rendered in
     * whatever timezone the process happened to be in — UTC on Vercel, the
     * developer's own zone locally, and a different answer if the platform ever
     * changed. A client-facing date that depends on where the server is running
     * is not a formatting choice, it is a bug waiting for a deployment.
     *
     * Instants (`createdAt`, a payment date) render in UTC too. That is what
     * they already did in production, so nothing moves; it is simply explicit
     * now. Showing those in the COMPANY's timezone would be better still and is
     * a larger change — lib/format/companyDate.js is where that belongs, and it
     * already does it for the staff-facing side.
     */
    date(d) {
      if (!d) return "";
      try {
        return new Date(d).toLocaleDateString(locale, {
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "UTC",
        });
      } catch {
        return new Date(d).toISOString().slice(0, 10);
      }
    },
  };
}

export const DOCUMENT_LABELS = LABELS;
