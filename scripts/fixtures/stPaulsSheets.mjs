// scripts/fixtures/stPaulsSheets.mjs
//
// The first REAL set read in production (St Paul's, Egham Hythe — Nye Saunders,
// planning application, 13 A3 sheets) as lib/planRead/ingest.js pdfSheets() reads
// it today: sheet numbers, titles, scales, paper size in points, and the few
// dimension strings the set prints. Copied from pdf.js's reading of the
// architect's file (~/Downloads/231129-planning-application-drawing-set.pdf on
// the owner's Mac), not the file itself — it is theirs; the text sample is cut
// to its first lines. Read by scripts/check-plan-read-first-pass.mjs.
//
// Imports nothing.

export const ST_PAULS_SHEETS = Object.freeze([
 {
  "key": "p1",
  "page": 1,
  "docPage": 1,
  "sheetNumber": "P-43",
  "discipline": null,
  "title": "Scheme C4 - Extension Floor Plan — Part church floor plan showing proposed extensions",
  "titles": [
   "Scheme C4 - Extension Floor Plan — Part church floor plan showing proposed extensions"
  ],
  "scale": {
   "text": "1:100",
   "ratio": 100,
   "nts": false,
   "system": "metric"
  },
  "pointsWidth": 1191,
  "pointsHeight": 842,
  "vector": true,
  "dims": [
   {
    "id": "p1.d1",
    "raw": "0.7",
    "feet": 2.2966,
    "metres": 0.7,
    "system": "metric",
    "unitAssumed": true,
    "assumedUnit": "m",
    "kind": "length",
    "x": 0.356,
    "y": 0.132,
    "line": "0.7 Kitchen"
   },
   {
    "id": "p1.d2",
    "raw": "5.2",
    "feet": 17.0604,
    "metres": 5.2,
    "system": "metric",
    "unitAssumed": true,
    "assumedUnit": "m",
    "kind": "length",
    "x": 0.544,
    "y": 0.139,
    "line": "5.2 store"
   },
   {
    "id": "p1.d3",
    "raw": "4.7",
    "feet": 15.4199,
    "metres": 4.7,
    "system": "metric",
    "unitAssumed": true,
    "assumedUnit": "m",
    "kind": "length",
    "x": 0.506,
    "y": 0.154,
    "line": "4.7"
   },
   {
    "id": "p1.d4",
    "raw": "6.75 metres",
    "feet": 22.1457,
    "metres": 6.75,
    "system": "metric",
    "unitAssumed": false,
    "kind": "length",
    "x": 0.737,
    "y": 0.178,
    "line": "6.75 metres"
   },
   {
    "id": "p1.d5",
    "raw": "3.1",
    "feet": 10.1706,
    "metres": 3.1,
    "system": "metric",
    "unitAssumed": true,
    "assumedUnit": "m",
    "kind": "length",
    "x": 0.662,
    "y": 0.34,
    "line": "3.1"
   },
   {
    "id": "p1.d6",
    "raw": "6.8",
    "feet": 22.3097,
    "metres": 6.8,
    "system": "metric",
    "unitAssumed": true,
    "assumedUnit": "m",
    "kind": "length",
    "x": 0.603,
    "y": 0.362,
    "line": "6.8 North"
   },
   {
    "id": "p1.d7",
    "raw": "2.1 metres",
    "feet": 6.8898,
    "metres": 2.1,
    "system": "metric",
    "unitAssumed": false,
    "kind": "length",
    "x": 0.232,
    "y": 0.493,
    "line": "2.1 metres"
   },
   {
    "id": "p1.d8",
    "raw": "4 metres",
    "feet": 13.1234,
    "metres": 4,
    "system": "metric",
    "unitAssumed": false,
    "kind": "length",
    "x": 0.213,
    "y": 0.628,
    "line": "4 metres west door"
   },
   {
    "id": "p1.d9",
    "raw": "2.1 metres",
    "feet": 6.8898,
    "metres": 2.1,
    "system": "metric",
    "unitAssumed": false,
    "kind": "length",
    "x": 0.254,
    "y": 0.836,
    "line": "2.1 metres"
   },
   {
    "id": "p1.d10",
    "raw": "4 metres",
    "feet": 13.1234,
    "metres": 4,
    "system": "metric",
    "unitAssumed": false,
    "kind": "length",
    "x": 0.315,
    "y": 0.847,
    "line": "4 metres"
   }
  ],
  "pairs": [],
  "labels": [],
  "schedule": [],
  "schedules": [],
  "finishCodes": [],
  "notes": [],
  "textSample": "135.22 sq.m. / 1,454\nsq.ft. nett floor area\n0.7 Kitchen\n5.2 store\n4.7\n6.75 metres"
 },
 {
  "key": "p2",
  "page": 2,
  "docPage": 2,
  "sheetNumber": "P-44",
  "discipline": null,
  "title": "Scheme C4 - Roof Plan — Part church roof plan showing proposed extensions",
  "titles": [
   "Scheme C4 - Roof Plan — Part church roof plan showing proposed extensions"
  ],
  "scale": {
   "text": "1:100",
   "ratio": 100,
   "nts": false,
   "system": "metric"
  },
  "pointsWidth": 1191,
  "pointsHeight": 842,
  "vector": true,
  "dims": [
   {
    "id": "p2.d1",
    "raw": "2.1 metres",
    "feet": 6.8898,
    "metres": 2.1,
    "system": "metric",
    "unitAssumed": false,
    "kind": "length",
    "x": 0.254,
    "y": 0.836,
    "line": "2.1 metres"
   },
   {
    "id": "p2.d2",
    "raw": "4 metres",
    "feet": 13.1234,
    "metres": 4,
    "system": "metric",
    "unitAssumed": false,
    "kind": "length",
    "x": 0.315,
    "y": 0.847,
    "line": "4 metres"
   }
  ],
  "pairs": [],
  "labels": [],
  "schedule": [],
  "schedules": [],
  "finishCodes": [],
  "notes": [],
  "textSample": "Annexe\nAnnexe\nRooflight Rooflight\nGlazed lobby to\nchurch west door\nRooflights installed to"
 },
 {
  "key": "p3",
  "page": 3,
  "docPage": 3,
  "sheetNumber": "P-45",
  "discipline": null,
  "title": "Scheme C4 - Whole Church Plan",
  "titles": [
   "Scheme C4 - Whole Church Plan"
  ],
  "scale": {
   "text": "1:200",
   "ratio": 200,
   "nts": false,
   "system": "metric"
  },
  "pointsWidth": 1191,
  "pointsHeight": 842,
  "vector": true,
  "dims": [],
  "pairs": [],
  "labels": [],
  "schedule": [],
  "schedules": [],
  "finishCodes": [],
  "notes": [],
  "textSample": "St. Paul's Road\n0m 2m 4m 6m 8m 10m 20m\nScale 1:200\nNew Cycle parking Storage rooms constructed\n(5 rails / 6 bikes) under organ casing and\nnorth window. Altar and"
 },
 {
  "key": "p4",
  "page": 4,
  "docPage": 4,
  "sheetNumber": "P-46",
  "discipline": null,
  "title": "Scheme C4 - 3D views",
  "titles": [
   "Scheme C4 - 3D views"
  ],
  "scale": {
   "text": "1:100",
   "ratio": 100,
   "nts": false,
   "system": "metric"
  },
  "pointsWidth": 1191,
  "pointsHeight": 842,
  "vector": true,
  "dims": [],
  "pairs": [],
  "labels": [],
  "schedule": [],
  "schedules": [],
  "finishCodes": [],
  "notes": [],
  "textSample": "New glazed New glazed\nlobby lobby\nExtension Extension\nView from North West Aerial view from North West\nExtension New glazed\nlobby Extension"
 },
 {
  "key": "p5",
  "page": 5,
  "docPage": 5,
  "sheetNumber": "P-47",
  "discipline": null,
  "title": "Scheme C4 - Elevations Sheet 1",
  "titles": [
   "Scheme C4 - Elevations Sheet 1",
   "West Elevation facing Thorpe Road"
  ],
  "scale": {
   "text": "1:100",
   "ratio": 100,
   "nts": false,
   "system": "metric"
  },
  "pointsWidth": 1191,
  "pointsHeight": 842,
  "vector": true,
  "dims": [
   {
    "id": "p5.d1",
    "raw": "6.8 metres",
    "feet": 22.3097,
    "metres": 6.8,
    "system": "metric",
    "unitAssumed": false,
    "kind": "length",
    "x": 0.099,
    "y": 0.65,
    "line": "6.8 metres masonry panel"
   }
  ],
  "pairs": [],
  "labels": [],
  "schedule": [],
  "schedules": [],
  "finishCodes": [],
  "notes": [],
  "textSample": "0m 1m 2m 3m 4m 5m 10m\nScale 1:100\nheight of lobby\nextensions determined\nby being to suit\n6.8 metres masonry panel"
 },
 {
  "key": "p6",
  "page": 6,
  "docPage": 6,
  "sheetNumber": "P-48",
  "discipline": null,
  "title": "Scheme C4 - Elevations Sheet 2",
  "titles": [
   "Scheme C4 - Elevations Sheet 2",
   "North Elevation facing St. Paul's Road"
  ],
  "scale": {
   "text": "1:100",
   "ratio": 100,
   "nts": false,
   "system": "metric"
  },
  "pointsWidth": 1191,
  "pointsHeight": 842,
  "vector": true,
  "dims": [
   {
    "id": "p6.d1",
    "raw": "6.8 metres",
    "feet": 22.3097,
    "metres": 6.8,
    "system": "metric",
    "unitAssumed": false,
    "kind": "length",
    "x": 0.226,
    "y": 0.655,
    "line": "6.8 metres"
   }
  ],
  "pairs": [],
  "labels": [],
  "schedule": [],
  "schedules": [],
  "finishCodes": [],
  "notes": [],
  "textSample": "0m 1m 2m 3m 4m 5m 10m\nScale 1:100\nNew rooflights to nave\nnorth slope\n6.8 metres\nExtension New glazed"
 },
 {
  "key": "p7",
  "page": 7,
  "docPage": 7,
  "sheetNumber": "P-49",
  "discipline": null,
  "title": "Scheme C4 - Elevations Sheet 3",
  "titles": [
   "Scheme C4 - Elevations Sheet 3",
   "South Elevation to church car park",
   "Extension Rear /East Elevation"
  ],
  "scale": {
   "text": "1:100",
   "ratio": 100,
   "nts": false,
   "system": "metric"
  },
  "pointsWidth": 1191,
  "pointsHeight": 842,
  "vector": true,
  "dims": [],
  "pairs": [],
  "labels": [],
  "schedule": [],
  "schedules": [],
  "finishCodes": [],
  "notes": [],
  "textSample": "0m 1m 2m 3m 4m 5m 10m\nScale 1:100\nNew glazed New glazed Extension rear\nwest porch south porch elevation\nSouth Elevation to church car park Extension Rear /East Elevation\n© Nye Saunders Ltd - Chartered Architects"
 },
 {
  "key": "p8",
  "page": 8,
  "docPage": 8,
  "sheetNumber": "P-50",
  "discipline": null,
  "title": "Nave rooflights addition",
  "titles": [
   "Nave rooflights addition"
  ],
  "scale": {
   "text": "1:100",
   "ratio": 100,
   "nts": false,
   "system": "metric"
  },
  "pointsWidth": 1191,
  "pointsHeight": 842,
  "vector": true,
  "dims": [],
  "pairs": [],
  "labels": [],
  "schedule": [],
  "schedules": [],
  "finishCodes": [],
  "notes": [],
  "textSample": "Cross bracing to\none bay may restrict\nrooflight position\noptions\nView looking north west (incl. new rooflights) View looking east (existing)\nView looking east (incl. new rooflights) View looking west (incl. new rooflights)"
 },
 {
  "key": "p9",
  "page": 9,
  "docPage": 9,
  "sheetNumber": "P-51",
  "discipline": null,
  "title": "Scheme C4 - Cross Section Looking South",
  "titles": [
   "Scheme C4 - Cross Section Looking South",
   "Cross Section - looking south to show nave roof connection"
  ],
  "scale": {
   "text": "1:100",
   "ratio": 100,
   "nts": false,
   "system": "metric"
  },
  "pointsWidth": 1191,
  "pointsHeight": 842,
  "vector": true,
  "dims": [],
  "pairs": [],
  "labels": [],
  "schedule": [],
  "schedules": [],
  "finishCodes": [],
  "notes": [],
  "textSample": "0m 1m 2m 3m 4m 5m 10m\nScale 1:100\nNew rooflights to nave\nnorth slope\nExtension\nNew glazed"
 },
 {
  "key": "p10",
  "page": 10,
  "docPage": 10,
  "sheetNumber": "P-52",
  "discipline": null,
  "title": "Location and Block Plan - as proposed",
  "titles": [
   "Location and Block Plan - as proposed",
   "Location Plan",
   "Block Plan"
  ],
  "scale": {
   "text": "1:500",
   "ratio": 500,
   "nts": false,
   "system": "metric"
  },
  "pointsWidth": 1191,
  "pointsHeight": 842,
  "vector": true,
  "dims": [],
  "pairs": [],
  "labels": [],
  "schedule": [],
  "schedules": [],
  "finishCodes": [],
  "notes": [],
  "textSample": "Reproduced from the Ordnance Survey 1998 Superplan Map\nwith the permission of The Controller of HMSO.\n© Crown Copyright.\n1 Nye Saunders Ltd., Chartered Architects, 3 Church Street,\nGodalming GU7 1EQ\nLicense no. AR 100006170"
 },
 {
  "key": "p11",
  "page": 11,
  "docPage": 11,
  "sheetNumber": "E-01",
  "discipline": null,
  "title": "Plan - as existing",
  "titles": [
   "Plan - as existing"
  ],
  "scale": {
   "text": "1:100",
   "ratio": 100,
   "nts": false,
   "system": "metric"
  },
  "pointsWidth": 1191,
  "pointsHeight": 842,
  "vector": true,
  "dims": [],
  "pairs": [],
  "labels": [],
  "schedule": [],
  "schedules": [],
  "finishCodes": [],
  "notes": [],
  "textSample": "Boiler Vestry\nNorth\nTransept\nNave Crossing\nSouth\nTransept"
 },
 {
  "key": "p12",
  "page": 12,
  "docPage": 12,
  "sheetNumber": "E-02",
  "discipline": null,
  "title": "Site Plan - as existing",
  "titles": [
   "Site Plan - as existing"
  ],
  "scale": {
   "text": "1:200",
   "ratio": 200,
   "nts": false,
   "system": "metric"
  },
  "pointsWidth": 1191,
  "pointsHeight": 842,
  "vector": true,
  "dims": [],
  "pairs": [],
  "labels": [],
  "schedule": [],
  "schedules": [],
  "finishCodes": [],
  "notes": [],
  "textSample": "St. Paul's Road\nHall\nChurch car park\n0m 2m 4m 6m 8m 10m 20m\nScale 1:200\n© Nye Saunders Ltd - Chartered Architects"
 },
 {
  "key": "p13",
  "page": 13,
  "docPage": 13,
  "sheetNumber": "E-03",
  "discipline": null,
  "title": "Location and Block Plan - as existing",
  "titles": [
   "Location and Block Plan - as existing",
   "Location Plan",
   "Block Plan"
  ],
  "scale": {
   "text": "1:500",
   "ratio": 500,
   "nts": false,
   "system": "metric"
  },
  "pointsWidth": 1191,
  "pointsHeight": 842,
  "vector": true,
  "dims": [],
  "pairs": [],
  "labels": [],
  "schedule": [],
  "schedules": [],
  "finishCodes": [],
  "notes": [],
  "textSample": "Reproduced from the Ordnance Survey 1998 Superplan Map\nwith the permission of The Controller of HMSO.\n© Crown Copyright.\n1 Nye Saunders Ltd., Chartered Architects, 3 Church Street,\nGodalming GU7 1EQ\nLicense no. AR 100006170"
 }
]);
