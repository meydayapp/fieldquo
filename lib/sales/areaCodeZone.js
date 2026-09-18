// lib/sales/areaCodeZone.js
//
// A time-zone SUGGESTION from a NANP area code, for a rep to confirm.
//
// ══ Why this exists when leadTimeZone.js refuses to do it ═════════════════
//
// A rep who was just told "text me instead" hits the texting panel, and when
// nothing on the record states a zone the panel asks for one. lib/sales/
// leadTimeZone.js deliberately never derives that zone from the area code: a
// ported mobile keeps the code of the city it was bought in, and small
// contractors answer on phones they carried from a previous life. Deciding a
// SEND on the area code would text a Buffalo number at 06:00 because it was
// once a Denver number.
//
// This module is not a decision. It pre-fills the select the rep is looking
// at, so the common case (a local number, a local business) is one press of
// Send instead of a scroll through sixty zones. The rep is the one who writes
// the zone, by accepting the pre-fill; nothing here is written to a record on
// its own, and nothing here may ever be consulted to decide whether a message
// goes out. The refusal in leadTimeZone.js stands.
//
// ══ What goes in the table, written down because it is a judgement ════════
//
// An area code maps to a zone ONLY when the whole of its territory keeps that
// clock. A code whose territory contains a county-, district- or
// census-area-sized part on another clock maps to null with a comment naming
// both zones — the screen then asks, which is more useful than a confident
// wrong pre-fill. A single town that keeps a neighbour's clock by local
// charter (Lloydminster, West Wendover) is named in a comment and does NOT
// flip the code to null. That is the same threshold SUBDIVISION_TIME_ZONES in
// lib/sales/callingRules.js applies to provinces and states, chosen here so a
// prospect's area code and their province can never disagree about what
// counts as "one zone".
//
// Prefer omission to guessing: a code that is not here answers null, and
// null is a real answer the screen handles by asking.
//
// Zone names are the canonical IANA names Intl resolves in every build —
// America/Toronto rather than America/Montreal, America/Puerto_Rico rather
// than the America/St_Thomas link — because the value goes straight into a
// select and a deprecated alias that one ICU build dropped would pre-fill an
// option that does not exist.
//
// Pure. Executed by scripts/check-area-code-zone.mjs.

const TORONTO = "America/Toronto";
const WINNIPEG = "America/Winnipeg";
const REGINA = "America/Regina";
const EDMONTON = "America/Edmonton";
const VANCOUVER = "America/Vancouver";
const MONCTON = "America/Moncton";
const HALIFAX = "America/Halifax";
const NEW_YORK = "America/New_York";
const CHICAGO = "America/Chicago";
const DENVER = "America/Denver";
const PHOENIX = "America/Phoenix";
const LOS_ANGELES = "America/Los_Angeles";
const ANCHORAGE = "America/Anchorage";
const HONOLULU = "Pacific/Honolulu";
const PUERTO_RICO = "America/Puerto_Rico";
const GUAM = "Pacific/Guam";
const PAGO_PAGO = "Pacific/Pago_Pago";

/**
 * Area code → IANA zone, or null when the code straddles two clocks.
 *
 * Geographic codes only. Toll-free (8XX), premium (900), personal (5XX) and
 * Canada's non-geographic 600/622 say nothing about where a phone is and are
 * left out, so they answer null like any unknown code.
 */
export const AREA_CODE_ZONES = Object.freeze({
  // ═══════════════════════════════════════════════════════════════════════
  // Canada
  // ═══════════════════════════════════════════════════════════════════════

  // ── Ontario ── Eastern, except the north-west (807).
  "226": TORONTO, "249": TORONTO, "289": TORONTO, "343": TORONTO, "365": TORONTO,
  "382": TORONTO, "387": TORONTO, "416": TORONTO, "437": TORONTO, "519": TORONTO,
  "548": TORONTO, "613": TORONTO, "647": TORONTO, "683": TORONTO, "705": TORONTO,
  "742": TORONTO, "753": TORONTO, "905": TORONTO,
  // 807: Thunder Bay is Eastern; the Kenora and Rainy River districts are
  // Central (America/Winnipeg), and Atikokan keeps Eastern Standard all year.
  "807": null,

  // ── Quebec ── Eastern, except the far east of 418's territory.
  "263": TORONTO, "354": TORONTO, "438": TORONTO, "450": TORONTO, "468": TORONTO,
  "514": TORONTO, "579": TORONTO, "819": TORONTO, "873": TORONTO,
  // 418 and its overlays 581/367 reach the Îles-de-la-Madeleine (Atlantic,
  // America/Halifax) and the Basse-Côte-Nord east of 63°W (Atlantic Standard
  // all year, America/Blanc-Sablon). The islands are an RCM-sized region, so
  // this is a split, not a town exception — even though Quebec City sits in
  // it. callingRules names only Blanc-Sablon and lists QC as one zone; a QC
  // address still derives to Toronto there, so nothing is lost on a lead that
  // carries its province.
  "367": null, "418": null, "581": null,

  // ── Manitoba ── Central.
  "204": WINNIPEG, "431": WINNIPEG, "584": WINNIPEG,

  // ── Saskatchewan ── Central Standard all year. Lloydminster keeps Alberta
  // time by charter: one town, not listed, as in callingRules.
  "306": REGINA, "474": REGINA, "639": REGINA,

  // ── Alberta ── Mountain.
  "368": EDMONTON, "403": EDMONTON, "587": EDMONTON, "780": EDMONTON, "825": EDMONTON,

  // ── British Columbia ──
  // 604 is the Lower Mainland only: Pacific.
  "604": VANCOUVER,
  // 250 is the rest of the province, which includes the Peace River region
  // (Mountain Standard all year, America/Dawson_Creek) and the East Kootenay
  // (Mountain with DST, America/Edmonton). Both are regional districts.
  "250": null,
  // 236, 672 and 778 are province-WIDE overlays — 778 was Vancouver-only until
  // 2008 and has covered all of BC since — so they carry the same split as
  // 250. Mapping them to Vancouver would be right for most of the province and
  // wrong for Cranbrook and Fort St. John, which is exactly the guess the
  // table refuses to make.
  "236": null, "672": null, "778": null,

  // ── New Brunswick ── Atlantic.
  "428": MONCTON, "506": MONCTON,

  // ── Nova Scotia and Prince Edward Island ── Atlantic.
  "782": HALIFAX, "902": HALIFAX,

  // ── Newfoundland and Labrador ──
  // The island keeps Newfoundland time; Labrador, apart from its south-east
  // coast, keeps Atlantic (America/Goose_Bay). Labrador City and Happy
  // Valley–Goose Bay are on the Atlantic side, so 709 and its overlay 879
  // straddle two clocks and cannot be pre-filled.
  "709": null, "879": null,

  // ── Yukon, Northwest Territories, Nunavut ── one code, three territories,
  // four clocks (Whitehorse, Edmonton, and Nunavut's three).
  "867": null,

  // ═══════════════════════════════════════════════════════════════════════
  // United States
  // ═══════════════════════════════════════════════════════════════════════

  // ── Alabama ── Central. Phenix City keeps Georgia's clock by custom, not
  // by law; one town, not listed.
  "205": CHICAGO, "251": CHICAGO, "256": CHICAGO, "334": CHICAGO, "659": CHICAGO,
  "938": CHICAGO,

  // ── Alaska ── Alaska time. The Aleutians west of 169°30′W (Adak, Atka —
  // two villages, a few hundred people) keep Hawaii–Aleutian time. That is
  // smaller than the district threshold, so 907 maps; callingRules lists
  // America/Adak for AK because it counts the Aleutians West census area,
  // most of which (Unalaska) is in fact on Alaska time.
  "907": ANCHORAGE,

  // ── Arizona ── Mountain Standard all year, no DST.
  "480": PHOENIX, "520": PHOENIX, "602": PHOENIX, "623": PHOENIX,
  // 928: the Navajo Nation observes DST (America/Denver); the rest of
  // northern Arizona does not. Multi-county.
  "928": null,

  // ── Arkansas ── Central.
  "327": CHICAGO, "479": CHICAGO, "501": CHICAGO, "870": CHICAGO,

  // ── California ── Pacific.
  "209": LOS_ANGELES, "213": LOS_ANGELES, "279": LOS_ANGELES, "310": LOS_ANGELES,
  "323": LOS_ANGELES, "341": LOS_ANGELES, "350": LOS_ANGELES, "369": LOS_ANGELES,
  "408": LOS_ANGELES, "415": LOS_ANGELES, "424": LOS_ANGELES, "442": LOS_ANGELES,
  "510": LOS_ANGELES, "530": LOS_ANGELES, "559": LOS_ANGELES, "562": LOS_ANGELES,
  "619": LOS_ANGELES, "626": LOS_ANGELES, "628": LOS_ANGELES, "650": LOS_ANGELES,
  "657": LOS_ANGELES, "661": LOS_ANGELES, "669": LOS_ANGELES, "707": LOS_ANGELES,
  "714": LOS_ANGELES, "747": LOS_ANGELES, "760": LOS_ANGELES, "805": LOS_ANGELES,
  "818": LOS_ANGELES, "820": LOS_ANGELES, "831": LOS_ANGELES, "837": LOS_ANGELES,
  "840": LOS_ANGELES, "858": LOS_ANGELES, "909": LOS_ANGELES, "916": LOS_ANGELES,
  "925": LOS_ANGELES, "949": LOS_ANGELES, "951": LOS_ANGELES,

  // ── Colorado ── Mountain.
  "303": DENVER, "719": DENVER, "720": DENVER, "970": DENVER, "983": DENVER,

  // ── Connecticut ── Eastern.
  "203": NEW_YORK, "475": NEW_YORK, "860": NEW_YORK, "959": NEW_YORK,

  // ── Delaware ── Eastern.
  "302": NEW_YORK,

  // ── District of Columbia ── Eastern.
  "202": NEW_YORK, "771": NEW_YORK,

  // ── Florida ── Eastern, except the western panhandle.
  "239": NEW_YORK, "305": NEW_YORK, "321": NEW_YORK, "324": NEW_YORK, "352": NEW_YORK,
  "386": NEW_YORK, "407": NEW_YORK, "561": NEW_YORK, "645": NEW_YORK, "656": NEW_YORK,
  "689": NEW_YORK, "727": NEW_YORK, "754": NEW_YORK, "772": NEW_YORK, "786": NEW_YORK,
  "813": NEW_YORK, "863": NEW_YORK, "904": NEW_YORK, "941": NEW_YORK, "954": NEW_YORK,
  // 850 and its overlay 448: Tallahassee is Eastern, Pensacola and the
  // panhandle west of the Apalachicola are Central. Multi-county.
  "448": null, "850": null,

  // ── Georgia ── Eastern.
  "229": NEW_YORK, "404": NEW_YORK, "470": NEW_YORK, "478": NEW_YORK, "678": NEW_YORK,
  "706": NEW_YORK, "762": NEW_YORK, "770": NEW_YORK, "912": NEW_YORK, "943": NEW_YORK,

  // ── Hawaii ── Hawaii–Aleutian, no DST.
  "808": HONOLULU,

  // ── Idaho ── one code pair for the whole state: the southern part is
  // Mountain (America/Boise), the northern panhandle Pacific.
  "208": null, "986": null,

  // ── Illinois ── Central.
  "217": CHICAGO, "224": CHICAGO, "309": CHICAGO, "312": CHICAGO, "331": CHICAGO,
  "447": CHICAGO, "464": CHICAGO, "618": CHICAGO, "630": CHICAGO, "708": CHICAGO,
  "773": CHICAGO, "779": CHICAGO, "815": CHICAGO, "847": CHICAGO, "861": CHICAGO,
  "872": CHICAGO,

  // ── Indiana ── mostly Eastern (America/Indiana/Indianapolis keeps the
  // New York clock), with Central corners.
  // 219: Lake, Porter, LaPorte, Newton and Jasper counties — all Central.
  "219": CHICAGO,
  "260": NEW_YORK, "317": NEW_YORK, "463": NEW_YORK, "765": NEW_YORK,
  // 574: South Bend and Elkhart are Eastern, but Starke County (Knox —
  // America/Indiana/Knox) in the same code is Central. County-sized.
  "574": null,
  // 812 and its overlay 930: Bloomington is Eastern; Evansville and the
  // south-west counties are Central. Multi-county.
  "812": null, "930": null,

  // ── Iowa ── Central.
  "319": CHICAGO, "515": CHICAGO, "563": CHICAGO, "641": CHICAGO, "712": CHICAGO,

  // ── Kansas ── Central, except four counties on the Colorado line.
  "316": CHICAGO, "913": CHICAGO,
  // 620: Greeley and Hamilton counties are Mountain. 785: Sherman and Wallace
  // counties (Goodland) are Mountain.
  "620": null, "785": null,

  // ── Kentucky ── split down the middle.
  "502": NEW_YORK, "859": NEW_YORK,
  // 270 and its overlay 364: Bowling Green and Paducah are Central, but
  // Elizabethtown and other counties on the line are Eastern. 606: Eastern
  // Kentucky, but its southern tier (Adair, Clinton, Cumberland, Russell,
  // Wayne, McCreary) is Central.
  "270": null, "364": null, "606": null,

  // ── Louisiana ── Central.
  "225": CHICAGO, "318": CHICAGO, "337": CHICAGO, "457": CHICAGO, "504": CHICAGO,
  "985": CHICAGO,

  // ── Maine ── Eastern.
  "207": NEW_YORK,

  // ── Maryland ── Eastern.
  "240": NEW_YORK, "301": NEW_YORK, "410": NEW_YORK, "443": NEW_YORK, "667": NEW_YORK,

  // ── Massachusetts ── Eastern.
  "339": NEW_YORK, "351": NEW_YORK, "413": NEW_YORK, "508": NEW_YORK, "617": NEW_YORK,
  "774": NEW_YORK, "781": NEW_YORK, "857": NEW_YORK, "978": NEW_YORK,

  // ── Michigan ── Eastern, except four Upper Peninsula counties.
  "231": NEW_YORK, "248": NEW_YORK, "269": NEW_YORK, "313": NEW_YORK, "517": NEW_YORK,
  "586": NEW_YORK, "616": NEW_YORK, "679": NEW_YORK, "734": NEW_YORK, "810": NEW_YORK,
  "947": NEW_YORK, "989": NEW_YORK,
  // 906: the whole Upper Peninsula. Gogebic, Iron, Dickinson and Menominee
  // counties on the Wisconsin line are Central (America/Menominee).
  "906": null,

  // ── Minnesota ── Central.
  "218": CHICAGO, "320": CHICAGO, "507": CHICAGO, "612": CHICAGO, "651": CHICAGO,
  "763": CHICAGO, "924": CHICAGO, "952": CHICAGO,

  // ── Mississippi ── Central.
  "228": CHICAGO, "471": CHICAGO, "601": CHICAGO, "662": CHICAGO, "769": CHICAGO,

  // ── Missouri ── Central.
  "314": CHICAGO, "417": CHICAGO, "557": CHICAGO, "573": CHICAGO, "636": CHICAGO,
  "660": CHICAGO, "816": CHICAGO, "975": CHICAGO,

  // ── Montana ── Mountain.
  "406": DENVER,

  // ── Nebraska ──
  // 402 and its overlay 531 are the eastern part of the state — Omaha,
  // Lincoln, Norfolk — and every county in them is Central.
  "402": CHICAGO, "531": CHICAGO,
  // 308 is the west: North Platte is Central, the panhandle (Scottsbluff,
  // Sidney, Chadron) is Mountain. Multi-county.
  "308": null,

  // ── Nevada ── Pacific. West Wendover keeps Utah's clock by federal
  // approval: one town, not listed, as in callingRules.
  "702": LOS_ANGELES, "725": LOS_ANGELES, "775": LOS_ANGELES,

  // ── New Hampshire ── Eastern.
  "603": NEW_YORK,

  // ── New Jersey ── Eastern.
  "201": NEW_YORK, "551": NEW_YORK, "609": NEW_YORK, "640": NEW_YORK, "732": NEW_YORK,
  "848": NEW_YORK, "856": NEW_YORK, "862": NEW_YORK, "908": NEW_YORK, "973": NEW_YORK,

  // ── New Mexico ── Mountain.
  "505": DENVER, "575": DENVER,

  // ── New York ── Eastern.
  "212": NEW_YORK, "315": NEW_YORK, "332": NEW_YORK, "347": NEW_YORK, "363": NEW_YORK,
  "516": NEW_YORK, "518": NEW_YORK, "585": NEW_YORK, "607": NEW_YORK, "631": NEW_YORK,
  "646": NEW_YORK, "680": NEW_YORK, "716": NEW_YORK, "718": NEW_YORK, "838": NEW_YORK,
  "845": NEW_YORK, "914": NEW_YORK, "917": NEW_YORK, "929": NEW_YORK, "934": NEW_YORK,

  // ── North Carolina ── Eastern.
  "252": NEW_YORK, "336": NEW_YORK, "472": NEW_YORK, "704": NEW_YORK, "743": NEW_YORK,
  "828": NEW_YORK, "910": NEW_YORK, "919": NEW_YORK, "980": NEW_YORK, "984": NEW_YORK,

  // ── North Dakota ── one code: Fargo and Bismarck are Central, the
  // south-western counties are Mountain.
  "701": null,

  // ── Ohio ── Eastern.
  "216": NEW_YORK, "220": NEW_YORK, "234": NEW_YORK, "283": NEW_YORK, "326": NEW_YORK,
  "330": NEW_YORK, "380": NEW_YORK, "419": NEW_YORK, "440": NEW_YORK, "513": NEW_YORK,
  "567": NEW_YORK, "614": NEW_YORK, "740": NEW_YORK, "937": NEW_YORK,

  // ── Oklahoma ── Central. Kenton keeps Mountain by custom; one hamlet.
  "405": CHICAGO, "539": CHICAGO, "572": CHICAGO, "580": CHICAGO, "918": CHICAGO,

  // ── Oregon ── Pacific, except Malheur County.
  "503": LOS_ANGELES, "971": LOS_ANGELES,
  // 541 and its overlay 458 cover the rest of the state, including Malheur
  // County (Ontario, OR), which keeps Mountain (America/Boise).
  "458": null, "541": null,

  // ── Pennsylvania ── Eastern.
  "215": NEW_YORK, "223": NEW_YORK, "267": NEW_YORK, "272": NEW_YORK, "412": NEW_YORK,
  "445": NEW_YORK, "484": NEW_YORK, "570": NEW_YORK, "582": NEW_YORK, "610": NEW_YORK,
  "717": NEW_YORK, "724": NEW_YORK, "814": NEW_YORK, "835": NEW_YORK, "878": NEW_YORK,

  // ── Rhode Island ── Eastern.
  "401": NEW_YORK,

  // ── South Carolina ── Eastern.
  "803": NEW_YORK, "821": NEW_YORK, "839": NEW_YORK, "843": NEW_YORK, "854": NEW_YORK,
  "864": NEW_YORK,

  // ── South Dakota ── one code: Sioux Falls is Central, Rapid City and the
  // west are Mountain.
  "605": null,

  // ── Tennessee ── split, and the line does not follow the area codes.
  // 865 (Knoxville and the surrounding counties) is wholly Eastern.
  "865": NEW_YORK,
  // 423: Chattanooga and the Tri-Cities are Eastern, but Marion, Sequatchie
  // and Bledsoe counties in the same code are Central.
  "423": null,
  // 615/629 (Nashville), 931 (middle Tennessee), 901 (Memphis) and 731 (west
  // Tennessee) are wholly Central.
  "615": CHICAGO, "629": CHICAGO, "731": CHICAGO, "901": CHICAGO, "931": CHICAGO,

  // ── Texas ── Central, except the far west.
  "210": CHICAGO, "214": CHICAGO, "254": CHICAGO, "281": CHICAGO, "325": CHICAGO,
  "346": CHICAGO, "361": CHICAGO, "409": CHICAGO, "430": CHICAGO, "432": CHICAGO,
  "469": CHICAGO, "512": CHICAGO, "621": CHICAGO, "682": CHICAGO, "713": CHICAGO,
  "726": CHICAGO, "737": CHICAGO, "817": CHICAGO, "830": CHICAGO, "832": CHICAGO,
  "903": CHICAGO, "936": CHICAGO, "940": CHICAGO, "945": CHICAGO, "956": CHICAGO,
  "972": CHICAGO, "979": CHICAGO,
  // 806 is the Panhandle — Amarillo, Lubbock — and every county in it is
  // Central; only El Paso and Hudspeth counties are Mountain in Texas.
  "806": CHICAGO,
  // 915 is El Paso and Hudspeth counties, the only Mountain part of Texas.
  "915": DENVER,

  // ── Utah ── Mountain.
  "385": DENVER, "435": DENVER, "801": DENVER,

  // ── Vermont ── Eastern.
  "802": NEW_YORK,

  // ── Virginia ── Eastern.
  "276": NEW_YORK, "434": NEW_YORK, "540": NEW_YORK, "571": NEW_YORK, "686": NEW_YORK,
  "703": NEW_YORK, "757": NEW_YORK, "804": NEW_YORK, "826": NEW_YORK, "948": NEW_YORK,

  // ── Washington ── Pacific.
  "206": LOS_ANGELES, "253": LOS_ANGELES, "360": LOS_ANGELES, "425": LOS_ANGELES,
  "509": LOS_ANGELES, "564": LOS_ANGELES,

  // ── West Virginia ── Eastern.
  "304": NEW_YORK, "681": NEW_YORK,

  // ── Wisconsin ── Central.
  "262": CHICAGO, "274": CHICAGO, "353": CHICAGO, "414": CHICAGO, "534": CHICAGO,
  "608": CHICAGO, "715": CHICAGO, "920": CHICAGO,

  // ── Wyoming ── Mountain.
  "307": DENVER,

  // ── Puerto Rico and the US Virgin Islands ── Atlantic, no DST.
  // America/St_Thomas is a link to America/Puerto_Rico; the canonical name is
  // used for the reason in the header.
  "787": PUERTO_RICO, "939": PUERTO_RICO, "340": PUERTO_RICO,

  // ── Guam and the Northern Mariana Islands ── Chamorro Standard Time.
  // Pacific/Saipan is a link to Pacific/Guam.
  "671": GUAM, "670": GUAM,

  // ── American Samoa ── Samoa Standard Time.
  "684": PAGO_PAGO,
});

/**
 * The zone an area code lies wholly in, or null.
 *
 * Null covers three different things on purpose — a split code, a code not
 * in the table, and a string that is not an area code at all — because the
 * screen does the same thing with all three: it asks. A caller that needs to
 * tell them apart has `AREA_CODE_ZONES` (`in` distinguishes "split" from
 * "unknown").
 */
export function zoneForAreaCode(areaCode) {
  const code = String(areaCode ?? "").replace(/\D/g, "");
  // N-X-X and never N11 — the same shape lib/voice/nanp.js accepts. The
  // table has no N11 key, so this is belt-and-braces today; it is here so
  // that a future "911" typo in the table cannot become a pre-fill.
  if (!/^[2-9]\d\d$/.test(code) || /^\d11$/.test(code)) return null;
  return AREA_CODE_ZONES[code] ?? null;
}

/**
 * A suggestion for a stored E.164 number, or null when the number is not a
 * NANP number at all.
 *
 * Only the strict `+1NXXNXXXXXX` shape is read — that is what the record
 * holds, and a looser parse would let a typed "+1 (819) …" reach a pre-fill
 * through a path nothing else in the texting flow accepts.
 *
 * A NANP number whose code is split or unknown returns `{ areaCode,
 * timeZone: null }` rather than null, so the screen can say "807 spans two
 * zones — which one?" instead of pretending it never read the number.
 */
export function suggestZoneForNumber(e164) {
  if (typeof e164 !== "string") return null;
  const match = /^\+1([2-9]\d\d)[2-9]\d{6}$/.exec(e164.trim());
  if (!match) return null;
  const areaCode = match[1];
  return { areaCode, timeZone: zoneForAreaCode(areaCode) };
}
