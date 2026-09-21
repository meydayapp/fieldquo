// lib/reviews/cardCopy.js
//
// The few words on the digital business card (app/c/[slug]) that the
// bio-link labels (lib/links/labels.js) do not already carry: the save-contact
// button, the directions row, and the two captions under the two QRs on the
// print sheet. Eight document languages, written out; no imports; nothing
// names FieldQuo.

const COPY = {
  en: {
    saveContact: "Save our contact",
    directions: "Get directions",
    scanCard: "Scan for our contact card",
    scanSave: "Scan to save our contact",
    addressLabel: "Address",
  },
  fr: {
    saveContact: "Enregistrer nos coordonnées",
    directions: "Itinéraire",
    scanCard: "Scannez pour notre carte de contact",
    scanSave: "Scannez pour enregistrer nos coordonnées",
    addressLabel: "Adresse",
  },
  es: {
    saveContact: "Guardar nuestro contacto",
    directions: "Cómo llegar",
    scanCard: "Escanea para ver nuestra tarjeta",
    scanSave: "Escanea para guardar nuestro contacto",
    addressLabel: "Dirección",
  },
  uk: {
    saveContact: "Зберегти наш контакт",
    directions: "Прокласти маршрут",
    scanCard: "Скануйте, щоб відкрити нашу візитку",
    scanSave: "Скануйте, щоб зберегти наш контакт",
    addressLabel: "Адреса",
  },
  pa: {
    saveContact: "ਸਾਡਾ ਸੰਪਰਕ ਸੇਵ ਕਰੋ",
    directions: "ਰਸਤਾ ਵੇਖੋ",
    scanCard: "ਸਾਡੇ ਸੰਪਰਕ ਕਾਰਡ ਲਈ ਸਕੈਨ ਕਰੋ",
    scanSave: "ਸਾਡਾ ਸੰਪਰਕ ਸੇਵ ਕਰਨ ਲਈ ਸਕੈਨ ਕਰੋ",
    addressLabel: "ਪਤਾ",
  },
  tl: {
    saveContact: "I-save ang contact namin",
    directions: "Kunin ang direksyon",
    scanCard: "I-scan para sa contact card namin",
    scanSave: "I-scan para i-save ang contact namin",
    addressLabel: "Address",
  },
  de: {
    saveContact: "Kontakt speichern",
    directions: "Route anzeigen",
    scanCard: "Scannen für unsere Kontaktkarte",
    scanSave: "Scannen und Kontakt speichern",
    addressLabel: "Adresse",
  },
  it: {
    saveContact: "Salva il nostro contatto",
    directions: "Indicazioni stradali",
    scanCard: "Scansiona per il nostro biglietto",
    scanSave: "Scansiona per salvare il nostro contatto",
    addressLabel: "Indirizzo",
  },
};

export const CARD_COPY = COPY;
export const CARD_LANGUAGES = Object.keys(COPY);

export function cardCopy(language) {
  return COPY[language] || COPY.en;
}
