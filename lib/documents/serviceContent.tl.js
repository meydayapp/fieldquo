// lib/documents/serviceContent.tl.js
//
// What a quote SAYS about each trade — in Tagalog (Filipino).
//
// ── Why a parallel file, and not translation at send time ───────────────────
//
// A document keeps the language it was created in (AGENTS.md non-negotiable
// #6). The prose here is not stored on the quote; resolveServiceContent picks
// it at render time from a STATIC catalogue keyed by the quote's own fixed
// `language`, so a Tagalog quote renders the same sentences on the day it is
// signed and on every day after. Nothing is machine-translated at send time,
// and a viewer's browser language changes nothing.
//
// ── Register ────────────────────────────────────────────────────────────────
//
// Written the way a Filipino contractor in Canada or the US writes to a
// homeowner: polite (ninyo / inyo / po), with the English trade nouns Filipino
// tradespeople actually say kept as loanwords (primer, drywall, cabinet,
// gutter, fascia, shingle, topcoat). The sentences are Tagalog; only single
// trade nouns are borrowed. Every string still differs from the English, even
// a glossary term, because the resolver check treats an identical string as
// untranslated — so a borrowed term carries a Tagalog gloss in parentheses.
//
// Same rules as the English: nothing states a warranty term, a price, a cure
// time, a brand or a number of days that the English does not. Anything
// specific stays a [placeholder] — in Tagalog, and still in square brackets,
// because the resolver withholds a line with a bracket left in it whatever
// language the bracket is in.

const PREP_APPLY_FINISH = [
  {
    title: "Pagsusuri sa lugar at kumpirmasyon",
    body: "Kinukumpirma namin sa mismong lugar ang saklaw ng trabaho, pinagkakasunduan ang finish at mga kulay, at sinasagot ang anumang tanong ninyo bago magsimula ang trabaho.",
  },
  {
    title: "Proteksyon at paghahanda",
    body: "Inililipat o tinatakpan ang mga muwebles, tinatakpan ang mga katabing surface, at nililinis at inihahanda ang lahat ng surface para sa pangmatagalang resulta.",
  },
  {
    title: "Pag-aayos at pag-primer",
    body: "Tinatapalan at nililiha ang mga depekto, at nilalagyan ng primer kung saan ito kailangan para sa kapit at pantay na pagtakip.",
  },
  {
    title: "Paglalagay ng finish",
    body: "Inilalagay ang finish nang buong patong, na may sapat na oras ng pagpapatuyo sa pagitan ng bawat isa ayon sa talagang hinihingi ng produkto.",
  },
  {
    title: "Paglilinis at huling walkthrough",
    body: "Tinatanggal ang masking, iniiwang malinis ang lugar, at iniikot namin ito kasama kayo bago namin ituring na tapos ang trabaho.",
  },
];

const CABINET_REFINISH_WORKFLOW = [
  {
    title: "Paghahanda at proteksyon ng kusina",
    body: "Unang inilalagay ang masking at containment — sahig, countertop, mga appliance at ang mga daanan papunta sa ibang bahagi ng bahay — para manatili ang alikabok at overspray sa kuwartong ginagawa.",
  },
  {
    title: "Pagtanggal at paglalagay ng label",
    body: "Tinatanggal ang mga pinto, drawer front at hardware, at nilalagyan ng label ang bawat piraso para maibalik ito sa mismong opening na pinanggalingan nito.",
  },
  {
    title: "Paglilinis at pagliliha",
    body: "Tinatanggalan ng grasa ang bawat surface at saka nililiha. Ang finish na ini-spray sa ibabaw ng mantika mula sa pagluluto o sa makintab na factory coat ay finish na magbabakbak — kaya hindi ito ang hakbang na dapat madaliin.",
  },
  {
    title: "Primer at pinong pagliliha",
    body: "Inilalagay ang primer para harangin ang mantsa at bigyan ng makakapitan ang topcoat, na may pinong pagliliha sa pagitan ng mga patong para pantayin ang grain na itinaas ng naunang patong.",
  },
  {
    title: "Topcoat, inspeksyon at retoke",
    body: "Ini-spray ang topcoat nang buong patong, saka sinusuri sa maliwanag na ilaw at nireretoke bago ibalik ang anumang piraso.",
  },
  {
    title: "Pagkabit muli, paglilinis at walkthrough",
    body: "Ibinabalik ang mga pinto at front sa kani-kanilang opening, ikinakabit muli ang hardware at inaayos ang pagkakahanay ng mga pinto, nililinis ang kuwarto, at iniikot namin ito kasama kayo.",
  },
];

const CABINET_REFACE_WORKFLOW = [
  {
    title: "Pagsukat at pagtukoy ng detalye",
    body: "Sinusukat sa mismong lugar ang bawat opening, at kinukumpirma sa inyo ang estilo, kulay at finish ng pinto bago umorder ng anuman. Ginagawa ang mga pinto ayon sa mga sukat na iyon at hindi na mababago ang laki pagkatapos.",
  },
  {
    title: "Pag-order at paggawa",
    body: "Ginagawa ang mga pinto, drawer front at ang katugmang materyal para sa mukha ng mga kahon ayon sa kinumpirmang sukat at finish.",
  },
  {
    title: "Pagtanggal",
    body: "Tinatanggal at inaalis sa lugar ang kasalukuyang mga pinto, drawer front at hardware.",
  },
  {
    title: "Paghahanda at pag-finish sa mukha ng mga kahon",
    body: "Nililinis, inihahanda at tinatapos ang nakikitang panlabas na mukha ng mga cabinet box para tumugma sa mga bagong front, para ang mga bahaging itinatabi ninyo at ang mga pinapalitan ay magmukhang iisang kusina.",
  },
  {
    title: "Pagkabit at pag-adjust",
    body: "Ikinakabit ang mga bisagra, binubutas ang puwesto ng hawakan ayon sa napili ninyong pagkakalagay, at inihahanay ang bawat pinto at drawer para pantay ang mga puwang.",
  },
  {
    title: "Paglilinis at walkthrough",
    body: "Nililinis ang kuwarto at iniikot namin ito kasama kayo bago ito pirmahan bilang tapos.",
  },
];

// Timelines are translated, never changed: they are Konstruction Group's
// published figures in the English, and a different number here would be a
// different commitment depending on the language the quote was written in.
const SHELL_SEQUENCE = [
  {
    title: "Pagsusuri ng mga drawing",
    body: "Kayo po ang magbibigay ng architectural at structural drawings. Sinusuri namin ang mga kailangan sa framing, tinutukoy kung may kailangang steel beam o column, at itinatala ang mga problema sa pagpasok sa site bago pa ito maging sanhi ng pagkaantala.",
    timeline: "1–2 araw",
  },
  {
    title: "Pagbisita sa site",
    body: "Iniikot namin ang property para suriin ang mga daanan, ang mga lugar na paglalagyan ng materyales at anumang partikular sa site — kasama kung paano maihahatid ang materyales sa masikip na lote.",
    timeline: "1–2 oras",
  },
  {
    title: "Detalyadong quotation",
    body: "Presyong naka-itemize, nakasulat ang saklaw ng trabaho at ang timeline. Walang biglang darating na sorpresa pagkatapos.",
    timeline: "3–5 araw ng trabaho",
  },
  {
    title: "Pag-frame",
    body: "Kapag handa na ang pundasyon at pumasa na ito sa inspeksyon, fina-frame ang sahig, dingding at bubong, at ikinakabit ang blocking para sa electrical, plumbing at fixtures. Iniiwang handa ang istruktura para sa mechanical rough-in.",
    timeline: "2–4 linggo",
  },
  {
    title: "Paglalagay ng insulation",
    body: "Pagkatapos ma-inspeksyon ang mechanical at electrical rough-in, inilalagay ang itinakdang insulation — spray foam, batt o kombinasyon ng dalawa, ayon sa mga drawing at sa mga kinakailangan sa enerhiya.",
    timeline: "3–7 araw",
  },
  {
    title: "Pagkabit ng drywall",
    body: "Ikinakabit, tina-tape at tinatapos ang board hanggang Level 4, o Level 5 kung iyon ang nakatakda. Iniiwang handa ang mga dingding para sa primer at pintura, at nililinis ang mga lugar na aming pinagtrabahuhan.",
    timeline: "1–2 linggo",
  },
];

const MEASURE_SUPPLY_INSTALL = [
  {
    title: "Konsultasyon at pagpili",
    body: "Kinukumpirma namin sa inyo ang saklaw ng trabaho, mga materyales at finish, at sinasagot ang anumang tanong bago umorder.",
  },
  {
    title: "Pagsukat",
    body: "Kinukuha sa mismong lugar ang eksaktong sukat para ang materyal ay maputol ayon sa inyong espasyo at hindi ayon sa tantiya.",
  },
  {
    title: "Pag-order at paggawa",
    body: "Inoorder at inihahanda ang mga materyales ayon sa kinumpirmang sukat.",
  },
  {
    title: "Pagtanggal at paghahanda",
    body: "Tinatanggal at itinatapon ang kasalukuyang materyal kung bahagi ito ng saklaw ng trabaho, at inihahanda ang lugar para sa pagkabit.",
  },
  {
    title: "Pagkabit at walkthrough",
    body: "Ikinakabit, pinapantay, sine-seal at nililinis, at pagkatapos ay iniikot namin ito kasama kayo.",
  },
];

const ASSESS_REPAIR_TEST = [
  {
    title: "Pagsusuri",
    body: "Inaalam namin sa mismong lugar ang problema at kinukumpirma kung ano ang kailangan bago mangako sa anumang trabaho o piyesa.",
  },
  {
    title: "Kumpirmasyon",
    body: "Kung lumabas na iba ang trabaho sa nakasaad sa quotation, malalaman ninyo ito bago kami magpatuloy — hindi pagkatapos, sa invoice na.",
  },
  {
    title: "Ang trabaho",
    body: "Ginagawa ayon sa code, gamit ang mga piyesa at pamamaraang nakasaad sa quotation na ito.",
  },
  {
    title: "Pagsubok",
    body: "Sinusubok ang lahat sa normal na kondisyon ng paggamit bago kami magligpit.",
  },
  {
    title: "Paglilinis at turnover",
    body: "Iniiwan namin ang lugar gaya ng aming dinatnan, at ipinapaliwanag namin sa inyo kung ano ang ginawa at anumang dapat bantayan.",
  },
];

const VISIT_SERVICE_VERIFY = [
  {
    title: "Kumpirmasyon",
    body: "Kinukumpirma namin ang pagpasok sa lugar, ang oras, at anumang partikular na nais ninyong bigyang-pansin.",
  },
  {
    title: "Paghahanda",
    body: "Inihahanda ang lugar at tinatakpan ang anumang kailangang protektahan bago kami magsimula.",
  },
  {
    title: "Ang trabaho",
    body: "Ginagawa ayon sa saklaw na nakasaad sa quotation na ito, gamit ang sarili naming kagamitan at materyales maliban kung iba ang nakasaad.",
  },
  {
    title: "Inspeksyon",
    body: "Sinusuri namin ang trabaho bago umalis at inaayos ang anumang hindi umaabot sa pamantayan.",
  },
];

const INSPECT_REPORT_REVIEW = [
  {
    title: "Pag-book at pagpasok sa property",
    body: "Kinukumpirma namin ang property, ang oras, at kung paano kami makakapasok. Malugod po kayong makakasama — mas marami ang nakukuha ng karamihan sa mga kliyente sa inspeksyon kapag naroon sila.",
  },
  {
    title: "Inspeksyon sa mismong lugar",
    body: "Biswal na inspeksyon ng madaling maabot na mga bahagi at sistemang nakasaad sa itaas. Hindi ito invasive: walang binabaklas, walang binubuksang tapos na surface, at hindi inililipat ang mga nakatabing gamit.",
  },
  {
    title: "Mga natuklasan sa mismong lugar",
    body: "Tinatalakay namin sa inyo ang aming natuklasan bago kami umalis, para personal ninyong marinig ang mahahalagang punto at makapagtanong kayo agad.",
  },
  {
    title: "Nakasulat na ulat",
    body: "Isang nakasulat na ulat na may litrato ng bawat mahalagang natuklasan, kung ano ang ibig sabihin nito, at kung ano ang aming mungkahing gawin.",
  },
  {
    title: "Mga tanong pagkatapos",
    body: "Magkakaroon kayo ng mga tanong kapag binasa na ninyo nang maigi ang ulat. Nananatili kaming handang pag-usapan ito kasama kayo.",
  },
];

const PLAN_BUILD_HANDOVER = [
  {
    title: "Saklaw at iskedyul",
    body: "Kinukumpirma namin ang buong saklaw ng trabaho, inaayos ang pagkakasunod-sunod ng mga trade, at pinagkakasunduan namin ang petsa ng pagsisimula at ang inaasahang tagal ng proyekto.",
  },
  {
    title: "Mga permit at paghahanda",
    body: "Inaasikaso ang anumang kinakailangang permit at inspeksyon, at inihahanda at pinoprotektahan ang site.",
  },
  {
    title: "Demolisyon at rough-in",
    body: "Tinatanggal ang kasalukuyang materyal at dinadala ang structural, electrical at plumbing na trabaho sa puntong handa na para sa inspeksyon.",
  },
  {
    title: "Mga finish",
    body: "Ikinakabit ang mga surface, fixture at finish ayon sa detalyeng napagkasunduan sa itaas.",
  },
  {
    title: "Inspeksyon at turnover",
    body: "Huling inspeksyon, naayos ang lahat ng nasa listahan ng kakulangan, nilinis ang site, at walkthrough kasama kayo.",
  },
];

// The closing sentence each door variant repeats, as the English does: a
// client reading only their own variant still has to be told what happens to
// the boxes and the old doors.
const REFACE_TAIL =
  " Tinatapos ang nakikitang panlabas na mukha ng mga cabinet box para tumugma, ang mga bisagra ay ibinibigay, ikinakabit at ina-adjust, binubutas ang puwesto ng hawakan ayon sa pagkakalagay na pipiliin ninyo, at inaalis ang mga lumang pinto at front.";

const REFACE_DESCRIPTION =
  "Pinapalitan namin ang mga pinto at drawer front at tinatapos ang nakikitang panlabas na mukha ng mga cabinet box para tumugma, kaya mananatili ang kasalukuyang layout at mga kahon ng inyong kusina. Ang estilo ng pinto na may presyo sa itaas ang siyang gagawin; ang mga bisagra ay ibinibigay, ikinakabit at ina-adjust, binubutas ang puwesto ng hawakan ayon sa pagkakalagay na pipiliin ninyo, at inaalis ang mga lumang pinto at front. Hindi nire-refinish ang loob ng mga cabinet maliban kung may linya sa itaas na nagsasabi nito.";

const REFACE_DOOR_VARIANTS = {
  thermofoil:
    "Ang mga pinto at drawer front sa quotation na ito ay thermofoil: MDF na core na binalot ng vinyl na hinubog sa init at tinapos sa pabrika sa kulay na pinili ninyo. Dumarating ang mga ito nang buo na — walang nililiha, pini-primer o ini-spray sa lugar, at hindi na mababago ang kulay sa hinaharap nang hindi pinapalitan ang pinto." +
    REFACE_TAIL,
  painted_mdf:
    "Ang mga pinto at drawer front sa quotation na ito ay pinturadong MDF: pintong MDF na hinubog sa makina at ini-spray sa kulay na pinili ninyo. Walang grain ang MDF na lilitaw sa pintura, kaya posible ang pantay na pinturadong finish na walang nakikitang dugtungan, at maaari itong pinturahan muli sa hinaharap." +
    REFACE_TAIL,
  red_oak:
    "Ang mga pinto at drawer front sa quotation na ito ay solid red oak: pintong gawa sa natural na kahoy na may bukas at litaw na grain na nakikita sa ilalim ng finish, kaya walang dalawang pintong magkamukha. Gumagalaw ang kahoy ayon sa panahon, at normal — hindi depekto — ang maninipis na linyang bumubuka at sumasara sa mga dugtungan ng rail at stile." +
    REFACE_TAIL,
  white_oak:
    "Ang mga pinto at drawer front sa quotation na ito ay solid white oak: pintong gawa sa natural na kahoy na may mas masikip at mas tuwid na grain kaysa sa red oak, na nakikita sa ilalim ng finish, kaya walang dalawang pintong magkamukha. Gumagalaw ang kahoy ayon sa panahon, at normal — hindi depekto — ang maninipis na linyang bumubuka at sumasara sa mga dugtungan ng rail at stile." +
    REFACE_TAIL,
};

// Keyed on the same values as GUTTER_WORK_VARIANTS in the English. Each still
// ends by naming what is NOT in it — the commonest gutter dispute.
const GUTTER_WORK_VARIANTS = {
  cleaning:
    "Nililinis namin ang kasalukuyang gutter at downspout ninyo, binobombahan ng tubig para mapatunayang umaagos, at sinusuri ang mga run habang walang laman — hanger, seam, dugtungan at ang fascia sa likod ng mga ito — at sine-seal ang maliliit na sirang makikita namin habang ginagawa. Ang may presyo rito ay ang trabahong nakalista sa itaas: ang pagpapalit ng isang run, ang pag-aayos ng hilig nito, o ang pagkukumpuni ng bulok na fascia ay hiwalay na trabaho at makikita lamang kung saan ninyo ito nakikitang may presyo.",
  install:
    "Nagbibigay at nagkakabit kami ng bagong eavestrough sa mga run na may presyo sa itaas, hinuhubog sa mismong lugar ayon sa haba ng inyong fascia at ikinakabit nang may hilig na nagdadala ng tubig sa mga outlet, at ang mga downspout na nakalista sa itaas ay idinudugtong hanggang sa gusto ninyong puntahan ng tubig. Tanging ang mga run at downspout na may presyo sa itaas ang ikakabit — ang guard, heated cable, soffit, fascia at anumang trabaho sa bubong ay hiwalay na mga linya at kasama lamang kung makikita ninyo itong may presyo.",
  replacement:
    "Ibinababa namin ang kasalukuyang eavestrough ninyo, inaalis ito, at ikinakabit ang bagong run kapalit nito sa mga run na may presyo sa itaas, hinuhubog sa mismong lugar at inilalagay nang may hilig na nagdadala ng tubig sa mga outlet, kasama ang mga downspout na nakalista sa itaas. Bahagi ng binabayaran ninyo rito ang pagtanggal at pagtatapon ng mga lumang gutter — makikita ninyo ito sa loob ng presyo kada talampakan o sa sarili nitong linya. Ang fascia na matuklasang bulok kapag natanggal na ang lumang run ay iuulat sa inyo nang may mga litrato at bibigyan ng presyo bago ayusin ang anumang bahagi nito. Tanging ang mga run at downspout na may presyo sa itaas ang papalitan.",
  repair:
    "Inaayos namin ang mga sirang nakalista sa itaas — muling sine-seal ang mga seam at dugtungan, muling ikinakabit ang mga hanger, at inaayos ang hilig ng maiikling bahagi para umagos ang tubig sa halip na maipon — at pinadadaanan ng tubig ang mga inayos na bahagi bago kami umalis, para makita ninyo mismo ang pag-agos. Ang pagkukumpuni ay may presyo kada seksyon sa quotation na ito. Ang pagpapalit ng buong run, ang pag-aayos ng hilig ng buong sistema o ang pagkukumpuni ng bulok na fascia ay hiwalay na trabaho at makikita lamang kung saan ninyo ito nakikitang may presyo.",
  guard_only:
    "Ikinakabit namin ang gutter guard na may presyo sa itaas sa mga run na nakalista sa itaas. Kailangang ilagay ang guard sa malinis na gutter, kung hindi ay makukulong lamang nito ang kalat sa ilalim, kaya nililinis muna ang anumang run na hindi malinis — ang paglilinis na iyon ay hiwalay na trabaho at kasama lamang kung makikita ninyo itong may presyo. Tanging ang mga run na may presyo sa itaas ang lalagyan ng guard, at ang mga downspout, ang bubong at anumang nasa itaas ng linya ng gutter ay hiwalay na mga linya sa parehong kondisyon.",
};

export const GENERIC_TL = {
  included: [
    "Lahat ng trabaho at kagamitang kailangan para matapos ang gawaing inilarawan sa itaas",
    "Proteksyon ng mga katabing surface at finish habang nasa lugar kami",
    "Paglilinis at pag-aalis ng sarili naming kalat pagkatapos ng trabaho",
    "Isang walkthrough kasama kayo bago pirmahan ang trabaho bilang tapos",
  ],
  steps: VISIT_SERVICE_VERIFY,
};

export const CONTENT_TL = {
  // ── Coatings and finishes ────────────────────────────────────────────────
  interior_painting: {
    description:
      "Pinipinturahan namin ang mga kuwarto at surface na may presyo sa itaas. Inililipat o tinatakpan ang mga muwebles at pinoprotektahan ang sahig, tinatapalan ang mga butas ng pako at bitak, kina-caulk ang mga puwang, at nililiha at pini-primer ang mga surface kung saan kailangan bago ilagay ang mga finish coat. Tanging ang mga surface na nakalista sa itaas ang pipinturahan — ang kisame, trim, pinto at loob ng aparador ay hiwalay na mga linya at kasama lamang kung makikita ninyo itong may presyo.",
    included: [
      "Inililipat o tinatakpan ang mga muwebles at pinoprotektahan ang buong sahig",
      "Tinatapalan ang mga butas ng pako at bitak, nililiha ang magagaspang na bahagi, kina-caulk ang mga puwang",
      "Primer kung kailangan para sa pagpapalit ng kulay, mga inayos na bahagi o hubad na surface",
      "Buong patong ng de-kalidad na pintura sa bawat surface na nakalista sa itaas",
      "Cut-in gamit ang brotsa sa trim, gilid at detalye sa halip na linyang gawa sa tape",
      "Tinatanggal at ibinabalik ang mga takip ng saksakan at hardware",
    ],
    steps: PREP_APPLY_FINISH,
  },
  exterior_painting: {
    description:
      "Hinuhugasan namin ang mga panlabas na surface na may presyo sa itaas at hinahayaang matuyo, kinakayod ang maluwag at nagbabakbak na materyal, nililiha ang magagaspang na bahagi, kina-caulk ang mga bukas na dugtungan at tahi, pini-primer ang mga hubad at inayos na bahagi, at saka inilalagay ang mga finish coat. Tanging ang mga surface na nakalista sa itaas ang papahiran — ang trim, soffit, fascia, pinto at shutter ay hiwalay na mga linya at kasama lamang kung makikita ninyo itong may presyo.",
    included: [
      "Hinuhugasan ang mga surface at hinahayaang matuyo nang maayos bago lagyan ng anumang coating",
      "Kinakayod ang maluwag at nagbabakbak na materyal, nililiha ang magagaspang na bahagi",
      "Kina-caulk ang mga dugtungan, tahi at puwang; inaayos ang maliliit na sira sa surface",
      "Primer na pang-exterior sa mga hubad at inayos na bahagi",
      "Buong patong ng pinturang pang-exterior sa bawat surface na nakalista sa itaas",
      "Iniiwang malinis ang lugar mula sa masking, drop sheet at kalat",
    ],
    steps: PREP_APPLY_FINISH,
  },
  cabinet_refinishing: {
    description:
      "Nire-refinish namin ang mga cabinet na mayroon na kayo. Ang mga pinto, drawer front at ang nakikitang panlabas na mukha ng mga kahon ay tinatanggalan ng grasa, nililiha, pini-primer at ini-spray ng bagong finish sa kulay at kintab na pipiliin ninyo. Walang pinapalitan: ang mga kahon, ang layout at ang estilo ng pinto ay mananatiling gaya ng dati, at hindi nire-refinish ang loob ng mga cabinet maliban kung may linya sa itaas na nagsasabi nito.",
    included: [
      "Kulay at kintab na napagkasunduan ninyo bago umorder ng anuman",
      "Tinatakpan at kinukulong ang kusina para manatili ang alikabok at overspray sa kuwarto",
      "Tinatanggal, nilalagyan ng label at ibinabalik ang mga pinto, drawer front at hardware",
      "Tinatanggalan ng grasa, nililiha at inihahanda ang lahat ng surface para kumapit ang finish",
      "Primer para harangin ang mantsa at bigyan ng makakapitan ang topcoat",
      "Ini-spray na topcoat sa magkabilang mukha ng bawat pinto at drawer front",
      "Tinatapos ang labas ng mga cabinet box para tumugma",
      "Ibinabalik ang hardware, inaayos ang pagkakahanay ng mga pinto, at walkthrough kasama kayo",
      // Brackets are capped at 80 characters by unfilledPlaceholders(); a
      // longer one would print WITH its brackets on a client's quote.
      "Primer: [ilang patong, at anong primer ang ginagamit ninyo]",
      "Topcoat: [ilang patong, anong produkto, at catalyst ratio kung mayroon]",
      "Warranty laban sa pagbabakbak: [inyong termino, at kung ano ang saklaw nito]",
      "Karaniwang tagal sa lugar: [ilang araw, mula simula hanggang walkthrough]",
    ],
    steps: CABINET_REFINISH_WORKFLOW,
  },
  cabinet_refacing: {
    description: REFACE_DESCRIPTION,
    variantLabel: "ang materyal ng pinto",
    variants: REFACE_DOOR_VARIANTS,
    included: [
      "Estilo, kulay at finish ng pinto na kinumpirma sa inyo bago umorder",
      "Sinusukat sa mismong lugar ang bawat opening, para ang mga pinto ay gawa para sa inyong kusina",
      "Mga bagong pinto at drawer front na ginawa ayon sa mga sukat na iyon",
      "Tinatapos ang labas ng mga cabinet box para tumugma sa mga bagong front",
      "Mga bisagra na ibinibigay, ikinakabit at ina-adjust para pantay ang upo ng mga pinto",
      "Binubutas ang puwesto ng hawakan ayon sa napili ninyong pagkakalagay",
      "Tinatanggal at inaalis ang kasalukuyang mga pinto, front at hardware",
      "Ina-adjust ang mga pinto at drawer sa turnover, kasama ang walkthrough",
      "Pagkakagawa at finish ng pinto: [inyong supplier, at ang finish na itinatakda ninyo]",
      "Warranty sa mga pinto at finish: [inyong termino, at kung ano ang saklaw nito]",
      "Karaniwang tagal mula order hanggang pagkabit: [inyong lead time]",
    ],
    steps: CABINET_REFACE_WORKFLOW,
  },
  stairs: {
    description:
      "Nire-refinish namin ang hagdan sa kasalukuyang anyo nito. Tinatakpan ang mga dingding, spindle at katabing sahig, nililiha hanggang hubad na kahoy ang mga bahaging may presyo sa itaas, tinatapalan ang mga yupi at puwang, inilalagay ang stain kung may napiling kulay, at sinusundan ng mga protective coat na may bahagyang pagliliha sa pagitan ng bawat isa. Tanging ang mga bahaging nakalista sa itaas ang nire-refinish — ang tread, riser, baluster, newel post, handrail at landing ay hiwalay na mga linya. Ang pagpapalit ng isang bahagi, sa halip na i-refinish ito, ay hiwalay na trabaho.",
    included: [
      "Tinatakpan at pinoprotektahan ang mga katabing dingding, spindle at sahig",
      "Nililiha ang mga tread at bahagi para maging handa sa finish",
      "Tinatapalan ang mga puwang, yupi at depekto",
      "Pantay na inilalagay ang stain sa lahat ng inihandang surface",
      "Mga protective finish coat na may bahagyang pagliliha sa pagitan ng bawat isa",
      "Gabay sa pag-aalaga at pagpapatuyo sa turnover",
    ],
    steps: PREP_APPLY_FINISH,
  },
  flooring: {
    description:
      "Nire-refinish namin ang mga sahig na kahoy na mayroon na kayo sa mga bahaging may presyo sa itaas. Pinipirmi ang mga maluwag na tabla, saka nililiha ang sahig gamit ang papino nang papinong grit para tanggalin ang lumang finish at pantayin ang surface, tinatapalan ang mga butas at puwang, inilalagay ang stain kung may napiling kulay, at sinusundan ng mga protective coat na may screening sa pagitan ng bawat isa. Ang mga tablang sira na lampas sa kayang ayusin ng pagliliha ay trabahong pagpapalit at may hiwalay na presyo.",
    included: [
      "Inililipat ang mga muwebles kung kailangan at pinoprotektahan ang mga katabing lugar",
      "Pinipirmi ang mga maluwag na tabla at sinusuri ang sahig bago liha",
      "Unti-unting pagliliha para tanggalin ang lumang finish at pantayin ang surface",
      "Tinatapalan ang mga butas ng pako at puwang bago ang huling pasada",
      "Pantay na inilalagay ang stain kung may napiling kulay",
      "Mga protective finish coat na may screening sa pagitan ng bawat isa",
    ],
    steps: PREP_APPLY_FINISH,
  },
  flooring_install: { steps: MEASURE_SUPPLY_INSTALL },
  countertop: {
    description:
      "Kumukuha kami ng template ng inyong mga cabinet sa mismong lugar, ginagawa ang countertop mula sa materyal na may presyo sa itaas ayon sa mga sukat na iyon, tinatanggal at itinatapon ang kasalukuyang countertop, at ikinakabit, pinapantay at dinudugtong ang bago. Ang mga cutout at edge profile na nakalista sa itaas ang siyang gagawin — anumang hindi nakalista ay hindi puputulin. Ang pagtanggal at muling pagkabit ng tubo, kuryente at gas ay hiwalay na trabaho at makikita lamang sa itaas kung hiniling ninyo ito.",
    included: [
      "Materyal na ibinibigay ayon sa detalyeng nakasaad sa itaas",
      "Template sa mismong lugar para sukat ito sa totoong cabinet ninyo",
      "Tinatanggal at itinatapon ang kasalukuyang countertop",
      "Paggawa kasama ang edge profile at anumang cutout na nakalista",
      "Pagkabit, pagpapantay at pagdudugtong ng seam",
      "Sine-seal ang mga dugtungan, seam at paligid",
    ],
    steps: MEASURE_SUPPLY_INSTALL,
  },
  tiling: { steps: MEASURE_SUPPLY_INSTALL },
  drywall: { steps: SHELL_SEQUENCE },
  drywall_install: { steps: SHELL_SEQUENCE },

  // ── Mechanical and electrical ────────────────────────────────────────────
  plumbing: { steps: ASSESS_REPAIR_TEST },
  electrical: { steps: ASSESS_REPAIR_TEST },
  hvac_install: { steps: MEASURE_SUPPLY_INSTALL },
  hvac_repair: { steps: ASSESS_REPAIR_TEST },
  appliance_repair: { steps: ASSESS_REPAIR_TEST },
  garage_door: {
    description:
      "Ibinibigay at ikinakabit namin ang pinto o mga pintong may presyo sa itaas, kasama ang track, spring, cable at hardware na dinadaanan nito, at binabalanse ang pinto at pinapaandar nang ilang ulit gamit ang kuryente bago kami umalis. Ang capping at trim ay hiwalay na mga linya at kasama lamang kung makikita ninyo itong may presyo. Ang electrical na trabaho, bagong opener, at anumang pagbabago sa laki o framing ng opening ay hiwalay na trabaho at hindi kasama maliban kung may linya sa itaas na nagsasabi nito.",
    steps: ASSESS_REPAIR_TEST,
  },
  locksmith: { steps: ASSESS_REPAIR_TEST },
  well_water: { steps: ASSESS_REPAIR_TEST },
  elevator_services: { steps: ASSESS_REPAIR_TEST },
  mechanical_contracting: { steps: ASSESS_REPAIR_TEST },
  installation_services: { steps: MEASURE_SUPPLY_INSTALL },

  // ── Structure and envelope ───────────────────────────────────────────────
  roofing_service: {
    description:
      "Tinatanggal namin ang kasalukuyang pantakip ng bubong hanggang sa deck, sinusuri ang mga tabla sa ilalim, at gumagawa ng bagong bubong sa ibabaw nito: underlayment, flashing sa bawat dingding, tsimenea, valley at vent, ang pantakip na may presyo sa itaas, at ang ridge at intake ventilation na kailangan ng bubong para matuyo ito. Inaalis sa site ang mga tinanggal na materyal at winawalis ang bakuran para sa mga pako bago kami umalis. Ang may presyo rito ay ang surface ng bubong na nakalista sa itaas — ang soffit, fascia, eavestrough, insulation at pagkukumpuni ng istruktura ay hiwalay na trabaho at makikita lamang kung saan ninyo ito nakikitang may presyo.",
    included: [
      "Tinatanggal at inaalis sa site ang kasalukuyang materyal",
      "Sinusuri ang decking at iniuulat ang anumang sirang bahagi bago palitan",
      "Underlayment, flashing at bentilasyon ayon sa kinakailangan",
      "Bagong bubong na ikinakabit ayon sa espesipikasyon ng manufacturer",
      "Nililinis at winawalis ang bakuran mula sa pako at kalat",
    ],
    steps: MEASURE_SUPPLY_INSTALL,
    mayChange: [
      {
        title: "Mas maraming patong kaysa inaasahan",
        body: "Ang presyo ng quotation na ito ay batay sa mga patong na nakita o nasuri namin. Ang ikalawa o ikatlong patong sa ilalim ay dagdag na oras sa pagtanggal at dagdag na itatapon, at sasabihin namin sa inyo bago kami magpatuloy.",
      },
      {
        title: "Kondisyon ng decking",
        body: "Hindi masusuri ang mga tabla sa ilalim ng lumang bubong hangga't hindi ito natatanggal. Ang matibay na decking ay bubungan ayon sa quotation; ang mga bulok na bahagi ay papalitan sa presyo kada sheet na nasa quotation na ito, bibilangin at ipapakita sa inyo.",
      },
      {
        title: "Panahon",
        body: "Hindi iniiwang bukas nang magdamag ang bubong. Ang maulang linggo ay nagpapaurong lamang ng petsa ng pagtatapos — hindi nagbabago ang presyo dahil umulan.",
      },
    ],
    glossary: [
      {
        term: "Square (parisukat)",
        body: "100 square feet ng surface ng bubong. Ito ang yunit na ginagamit ng buong industriya sa pag-order at pagpepresyo — ang bubong na 2,400 sq ft ay 24 square.",
      },
      {
        term: "Pitch (tarik)",
        body: "Ang tarik ng bubong, isinusulat bilang taas sa bawat 12 pulgadang pahalang. Ang bubong na tumataas nang 6 pulgada sa bawat 12 pahalang ay \"6/12\". Mas malaki ang surface ng bubong na may tarik kaysa sa lupang tinatakpan nito, at mas matagal gawin ang mas matarik.",
      },
      {
        term: "Decking o sheathing",
        body: "Ang mga structural panel sa ibabaw ng rafters na pinagkakabitan ng lahat ng iba pa. Hindi malalaman ang kondisyon nito hangga't hindi natatanggal ang lumang pantakip.",
      },
      {
        term: "Tear-off (pagtanggal ng lumang bubong)",
        body: "Ang pagtanggal ng kasalukuyang pantakip. Nakasaad sa quotation ang mga patong na may presyo rito; anumang lampas doon ay dagdag na trabaho at dagdag na itatapon.",
      },
      {
        term: "Underlayment (sapin)",
        body: "Ang membrane na inilalatag sa ibabaw ng decking bago ilagay ang pantakip. Ito ang patong na pumipigil sa tubig kapag itinutulak ito ng hangin sa ilalim ng shingle.",
      },
    ],
  },
  gutter_services: {
    description: GUTTER_WORK_VARIANTS.cleaning,
    variantLabel: "ang uri ng trabaho sa gutter",
    variants: GUTTER_WORK_VARIANTS,
    included: [
      "Nililinis ang gutter gamit ang kamay at inaalis ang kalat, hindi hinihipan papunta sa bakuran",
      "Binobombahan ng tubig ang bawat downspout at kinukumpirmang umaagos",
      "Sinusuri ang mga run, hanger at seam habang walang laman",
      "Maliit na pag-seal kung kailangan ito ng isang seam o dugtungan",
      "Anumang matuklasang nangangailangan ng higit sa pag-seal ay iniuulat nang may mga litrato bago gawin",
    ],
    steps: [
      {
        title: "Paglilinis ng gutter",
        body: "Nililinis gamit ang kamay ang bawat run mula sa dahon, grit at naipong kalat, at inaalis ang kalat sa halip na itulak sa mga downspout o iwan sa bakuran.",
      },
      {
        title: "Pagbomba ng tubig sa downspout",
        body: "Binobombahan at binabantayan ang bawat downspout, para makumpirmang umaabot sa lupa ang lumalabas sa gutter. Umaapaw pa rin ang malinis na gutter kung barado ang downspout.",
      },
      {
        title: "Pagsusuri at pag-seal",
        body: "Habang walang laman ang mga run, sinusuri namin ang mga hanger, seam, dugtungan at ang fascia sa likod ng mga ito kung may maluwag, sira o tagas, at sine-seal ang maliliit na sirang makikita namin. Anumang mas malaki ay iniuulat bago gawin, hindi basta idinaragdag sa singil.",
      },
      {
        title: "Gutter guard — opsyonal",
        body: "Kung kasama ito sa quotation na ito, ikinakabit ang Smart Screen na aluminum gutter guard sa ibabaw ng mga nilinis na run. Lumalabas lamang ito sa itaas kung talagang binili; ang guard na ikinabit sa maruming gutter ay nagkukulong ng kalat sa ilalim nito.",
      },
      {
        title: "Turnover",
        body: "Ang pagkakabit ng guard ay may [tagal ng warranty] na warranty na sumasaklaw sa [kung ano ang saklaw nito]. Iniiwang umaagos ang mga gutter at malinis ang lugar ng trabaho.",
      },
    ],
    mayChange: [
      {
        title: "Ang itsura ng mga run kapag wala nang laman",
        body: "Hindi makikita ang maluwag na hanger, putok na seam o bulok na fascia sa likod ng gutter habang puno ang trough. Kasama sa presyo sa itaas ang maliit na pag-seal; anumang pang-istruktura ay iniuulat nang may mga litrato at binibigyan ng hiwalay na presyo bago gawin ang anuman dito.",
      },
      {
        title: "Paano naaabot ang bubong",
        body: "Mas matagal ang run na nangangailangan ng staging, ladder standoff sa ibabaw ng conservatory, o ikalawang tao para sa kaligtasan kaysa sa run na naaabot mula sa hagdan sa patag na lupa.",
      },
      {
        title: "Ilang downspout talaga ang kailangan ng run",
        body: "Ang mga downspout sa quotation na ito ay ang mga mayroon ngayon ang bahay. Ang run na kulang ang labasan ng tubig dati ay kulang pa rin kahit bago na ang metal, kaya kung sa tingin namin ay kailangan ng dagdag na outlet, sasabihin namin ito at bibigyan ng hiwalay na presyo sa halip na ipagpalagay na gusto ninyo ito.",
      },
    ],
    glossary: [
      {
        term: "Downspout (alulod pababa)",
        body: "Ang patayong tubo na nagdadala ng tubig mula sa gutter pababa sa lupa. Kalahati lamang ng problema ang naaayos kapag nilinis ang gutter nang hindi pinapatunayang umaagos ang downspout.",
      },
      {
        term: "Hanger (kapit ng gutter)",
        body: "Ang bracket na humahawak sa gutter sa fascia. Kapag maluwag ito, lumalaylay ang run, at ang lumalaylay na run ay nag-iipon ng tubig sa halip na padaluyin ito.",
      },
      {
        term: "Fascia (tabla sa gilid ng bubong)",
        body: "Ang tabla sa likod ng gutter na pinagtotornilyuhan ng mga hanger. Humihinto ang trabaho sa gutter kung saan nagsisimula ang bulok na fascia, dahil walang kumakapit sa malambot na kahoy — kaya sa quotation na pagpapalit, masisiguro lamang ang kondisyon ng fascia kapag natanggal na ang lumang run.",
      },
      {
        term: "Seamless eavestrough (walang dugtong)",
        body: "Trough na hinuhubog sa mismong lugar mula sa iisang tuloy-tuloy na coil ayon sa eksaktong haba ng inyong run, kaya ang tanging dugtungan ay nasa mga kanto at outlet. Ang sectional gutter ay may dugtong bawat ilang talampakan, at ang bawat dugtong ay posibleng tumagas balang araw.",
      },
      {
        term: "Limang pulgada at anim na pulgada",
        body: "Ang lapad ng trough. Mas maraming tubig ang nadadala ng anim na pulgadang trough na may mas malaking outlet kaysa sa lima, at iyon ang kailangan ng malaking bubong, matarik na bubong, o valley na bumubuhos sa iisang kanto.",
      },
      {
        term: "Micro-mesh guard (pinong screen)",
        body: "Pinong screen na humaharang sa grit ng shingle, buto at dahon ng pine, pati na sa mga dahon. Ang simpleng screen ay humaharang sa dahon pero pinalulusot ang maliliit na kalat, at iyon ang pagkakaibang inilalarawan ng dalawang presyo.",
      },
      {
        term: "Gutter guard (pantakip sa gutter)",
        body: "Screen sa ibabaw ng gutter na humaharang sa dahon pero pinadadaan ang tubig. Binabawasan nito ang paglilinis; hindi nito tuluyang inaalis ang pangangailangan, at kailangan itong ilagay sa malinis na gutter.",
      },
      {
        term: "Minimum na singil sa serbisyo",
        body: "Halos kasing-mahal abutin ang maikling run gaya ng mahaba — parehong trak, parehong hagdan, parehong biyahe. Kaya ang maliliit na pagbisita ay sinisingil sa minimum sa halip na kada talampakan, at kung naaangkop ito, ipinapakita ng quotation ang dagdag sa sarili nitong linya sa halip na tahimik na itaas ang rate.",
      },
    ],
  },

  siding: {
    description:
      "Tinatanggal namin ang kasalukuyang cladding sa mga dingding na may presyo sa itaas, sinusuri ang sheathing sa likod nito at inaayos ang mga bahaging saklaw ng quotation na ito, at saka naglalagay ng weather barrier at ng bagong cladding na nakalista sa itaas, na may trim sa mga kanto, bintana at pinto. Tanging ang mga dingding na may presyo sa itaas ang papalitan ng cladding. Ang soffit, fascia, eavestrough, bintana at insulation ay hiwalay na mga linya at kasama lamang kung makikita ninyo itong may presyo.",
    steps: MEASURE_SUPPLY_INSTALL,
  },

  insulation: {
    description:
      "Nilalagyan namin ng insulation ang mga bahaging may presyo sa itaas hanggang sa R-value na nakasaad sa quotation na ito. Inuuna ang mga tagas ng hangin — top plate, mga butas na dinadaanan ng tubo o wire, at ang hatch — dahil pinababagal ng insulation ang init pero hindi nito pinipigilan ang hangin, at saka inilalagay ang materyal sa lalim na kailangan ng R-value na iyon, habang pinananatiling bukas ang daanan ng bentilasyon kung mayroon nito ang assembly. Nananatili ang kasalukuyang materyal maliban kung may linya sa itaas na nagsasabing tatanggalin ito, at itinatala at minamarkahan ang lalim na talagang inilagay para masuri ito sa hinaharap.",
    included: [
      "Itinatala ang kasalukuyang kondisyon at lalim bago matakpan ang anuman",
      "Sine-seal ang mga tagas ng hangin sa top plate, mga butas at hatch",
      "Pinananatiling bukas ang daanan ng bentilasyon kung kailangan ito ng assembly",
      "Inilalagay ang materyal sa lalim na kailangan ng nakasaad na R-value",
      "Iniiwan ang mga depth marker at nililinis ang lugar ng trabaho",
    ],
    steps: [
      {
        title: "Pagsusuri ng proyekto",
        body: "Sinusuri namin ang mga drawing o iniikot ang espasyo at pinagkakasunduan kung aling mga bahagi ang lalagyan ng insulation — basement, rim joist, kisame ng garahe, attic.",
        timeline: "1–2 araw",
      },
      {
        title: "Quotation",
        body: "Ang presyo ay batay sa mga bahaging tatakpan, sa materyal, at sa kapal na kailangan ng bawat assembly para maabot ang R-value nito.",
        timeline: "2–4 araw",
      },
      {
        title: "Pag-iiskedyul",
        body: "Itinatakdang magsimula pagkatapos makumpleto at ma-inspeksyon ang framing at ang mechanical at electrical rough-in. Kapag nag-insulate bago ang inspeksyong iyon, kailangan itong buksan ulit.",
        timeline: "Kung kailangan",
      },
      {
        title: "Paghahanda ng site",
        body: "Nililinis ang mga lugar, at tinatakpan at pinoprotektahan ang mga bintana, fixture at tapos na surface.",
        timeline: "1–2 oras",
      },
      {
        title: "Paglalagay",
        body: "Inilalagay ang materyal sa itinakdang lalim, nang ilang pasada kung kailangan ito ng kapal.",
        timeline: "1–3 araw",
      },
      {
        title: "Pag-trim at paglilinis",
        body: "Pinuputol ang sobra nang kapantay ng framing, nililinis ang overspray, itinatala ang lalim, at ibinibigay ang lugar na handa na para sa susunod na trade.",
        timeline: "Sa parehong araw",
      },
    ],
    mayChange: [
      {
        title: "Ang matutuklasan kapag nabuksan na ang espasyo",
        body: "Kailangang tanggalin muna ang basa, siksik o kontaminadong materyal bago maglagay ng anuman, at kailangang asikasuhin muna ang lumang knob-tube na wiring o ang bathroom fan na naglalabas ng hangin sa attic. Wala sa mga ito ang nakikita mula sa hatch.",
      },
      {
        title: "Ang lalim na talagang kaya ng cavity",
        body: "May hangganan ang kayang laman ng saradong cavity. Kung hindi maaabot ng espasyo ang target na R-value gamit ang materyal na nasa quotation, sasabihin namin ito at ibibigay ang mga opsyon ninyo sa halip na tahimik na maglagay ng mas kaunti.",
      },
    ],
    glossary: [
      {
        term: "R-value (halaga ng R)",
        body: "Kung gaano kahusay pinipigilan ng assembly ang pagdaloy ng init — mas mataas, mas mabuti. Ito ang hinihingi ng rebate program at ng building inspector, at ito ang dahilan kung bakit ganoon ang lalim sa quotation na ito.",
      },
      {
        term: "R kada pulgada",
        body: "Kung gaano karaming R ang naibibigay ng bawat pulgada ng isang materyal. Ito ang dahilan kung bakit magkaiba ang lalim ng dalawang materyal na umaabot sa parehong R-value, at kung bakit maaaring hindi magkasya ang isa sa mga ito.",
      },
      {
        term: "Air sealing (pagsara ng tagas ng hangin)",
        body: "Pagsasara sa mga puwang na talagang dinadaanan ng hangin bago takpan ang mga ito. Pinababagal ng insulation ang init; hindi nito pinipigilan ang hangin, at ang pag-blow ng insulation sa attic na hindi na-seal ang pinakakaraniwang dahilan kung bakit kulang ang resulta ng isang trabaho.",
      },
      {
        term: "Baffle (daluyan ng hangin)",
        body: "Daluyang nagpapanatiling bukas sa daan mula sa soffit vent papunta sa attic kapag nailagay na ang insulation. Kung wala ito, nababara ang mga vent at hindi na natutuyo ang roof deck.",
      },
    ],
  },
  masonry: { steps: MEASURE_SUPPLY_INSTALL },
  concrete: { steps: MEASURE_SUPPLY_INSTALL },
  paving: {
    description:
      "Hinuhukay namin ang lugar na may presyo sa itaas, naglalatag ng separation fabric, at gumagawa ng granular base na sinisiksik nang patong-patong, at saka inilalatag ang mga unit na nakalista sa itaas ayon sa napagkasunduang pattern, nakaayon nang parisukat sa bahay at tinatapos ng border course. Pinipigilan ang paggalaw ng mga gilid, pinupuno at sinisiksik ang mga dugtungan, at inilalagay ang surface nang may hilig palayo sa gusali. Pinapantay at inaayos ang lupang nagalaw sa paligid ng trabaho. Ang paglilipat ng utilities, ang drainage sa labas ng lugar ng trabaho at ang mga permit ay hiwalay.",
    steps: MEASURE_SUPPLY_INSTALL,
  },
  driveway_sealing: {
    description:
      "Winawalis at hinihipan namin ang surface hanggang malinis, ginagamot ang mga mantsa ng langis at grasa para kumapit ang sealer, tinatakpan ang mga gilid, at naglalagay ng sealer sa bahagi ng driveway na may presyo sa itaas ayon sa bilang ng patong na nakasaad sa quotation na ito. Ang sealing ay maintenance sa matibay pang surface: pinababagal nito ang pinsala mula sa tubig at araw. Hindi nito inaayos ang aspaltong sira-sira na, at hindi nito itinatago ang kasalukuyang mga bitak o tapal — ang pagpuno ng bitak ay hiwalay na linya at kasama lamang kung makikita ninyo itong may presyo.",
    steps: PREP_APPLY_FINISH,
  },
  fence_services: { steps: MEASURE_SUPPLY_INSTALL },
  chimney_sweep: { steps: VISIT_SERVICE_VERIFY },
  restoration: { steps: ASSESS_REPAIR_TEST },
  excavation: { steps: PLAN_BUILD_HANDOVER },
  demolition: { steps: PLAN_BUILD_HANDOVER },
  demolition_contractor: { steps: PLAN_BUILD_HANDOVER },

  home_inspection: {
    description:
      "Iniinspeksyon namin ang madaling maabot na mga bahagi at sistema ng property at binibigyan kayo ng nakasulat na ulat, na may mga litrato, ng aming natuklasan at kung ano ang ibig sabihin nito. Biswal at hindi invasive ang inspeksyon: walang binabaklas, walang binubuksang tapos na surface, at hindi inililipat ang mga nakatabing gamit — kaya ang depektong nakatago sa likod ng mga ito ay depektong hindi namin maiuulat. Ang pagsusuri para sa radon, kalidad ng hangin, kalang de-kahoy, well at septic ay hiwalay na mga serbisyo at ginagawa lamang kung makikita ninyo itong may presyo sa itaas.",
    included: [
      "Biswal na inspeksyon ng madaling maabot na mga bahagi ng property",
      "Bubong, panlabas na cladding, grading at drainage hangga't ligtas na maaabot",
      "Istruktura, pundasyon, at ang basement o crawlspace kung mapapasok",
      "Mga sistema ng heating, cooling, plumbing at electrical na pinapaandar gamit ang karaniwang kontrol nito",
      "Mga interior finish, bintana, pinto, insulation at bentilasyon ng attic",
      "Nakasulat na ulat na may mga litrato ng mahahalagang natuklasan",
      "Oras sa lugar sa dulo para ipaliwanag sa inyo ang aming natuklasan",
    ],
    steps: INSPECT_REPORT_REVIEW,
  },

  // ── Whole-project ────────────────────────────────────────────────────────
  general_contracting: { steps: SHELL_SEQUENCE },
  general_contracting_reno: { steps: PLAN_BUILD_HANDOVER },
  construction: { steps: SHELL_SEQUENCE },
  remodeling: { steps: PLAN_BUILD_HANDOVER },
  carpentry: { steps: MEASURE_SUPPLY_INSTALL },
  handyman: { steps: VISIT_SERVICE_VERIFY },
  property_maintenance: { steps: VISIT_SERVICE_VERIFY },

  // ── Cleaning ─────────────────────────────────────────────────────────────
  residential_cleaning: {
    included: [
      "Lahat ng panlinis at kagamitan ay galing sa amin",
      "Bawat kuwarto at surface na nakalista sa itaas",
      "Pinupunasan ang mga fixture, kabit at madalas hawakang bahagi",
      "Inaalis ang basura at pinapalitan ang supot ng basurahan",
    ],
    steps: VISIT_SERVICE_VERIFY,
  },
  deep_cleaning: { steps: VISIT_SERVICE_VERIFY },
  commercial_cleaning: { steps: VISIT_SERVICE_VERIFY },
  janitorial: { steps: VISIT_SERVICE_VERIFY },
  carpet_cleaning: { steps: VISIT_SERVICE_VERIFY },
  window_cleaning: { steps: VISIT_SERVICE_VERIFY },
  pressure_washing_house: { steps: VISIT_SERVICE_VERIFY },
  pressure_washing_driveway: { steps: VISIT_SERVICE_VERIFY },
  auto_detailing: { steps: VISIT_SERVICE_VERIFY },
  junk_removal: { steps: VISIT_SERVICE_VERIFY },

  // ── Grounds ──────────────────────────────────────────────────────────────
  landscaping_design: { steps: PLAN_BUILD_HANDOVER },
  lawn_care: { steps: VISIT_SERVICE_VERIFY },
  lawn_mowing: { steps: VISIT_SERVICE_VERIFY },
  irrigation: { steps: MEASURE_SUPPLY_INSTALL },
  tree_care_service: { steps: VISIT_SERVICE_VERIFY },
  snow_removal: {
    description:
      "Nililinis namin ang mga lugar na may presyo sa itaas ayon sa planong nakasaad sa quotation na ito, para sa season na saklaw nito. Naglalagay kami ng mga marker bago umulan ng niyebe para makita at maiwasan ang gilid ng damuhan at mga taniman. Ang mga daanan, hagdan at pag-aasin ay hiwalay na mga linya at nililinis o ginagamot lamang kung makikita ninyo itong may presyo. Hindi kasama ang bubong, balkonahe at anumang naiwan sa lugar na lilinisin at natabunan nang hindi nakikita.",
    steps: VISIT_SERVICE_VERIFY,
  },
  pest_control: { steps: VISIT_SERVICE_VERIFY },
  pool_spa: { steps: VISIT_SERVICE_VERIFY },
  dog_walking: { steps: VISIT_SERVICE_VERIFY },
  pooper_scooper: { steps: VISIT_SERVICE_VERIFY },
};
