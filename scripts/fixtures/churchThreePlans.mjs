// scripts/fixtures/churchThreePlans.mjs
//
// The St Paul's church read (cmuun5kc00000vst66kp7qc81, run 5, 2026-10-06)
// as production stored it, cut to what the interior quote rests on: the
// three plans that draw the same rooms — "Part church floor plan showing
// proposed extensions" (p1, 1:100), "Scheme C4 - Whole Church Plan" (p3,
// 1:200), "Plan - as existing" (p11, 1:100) — the interior photos' heights
// (p8), the section's heights (p9), and the synthesis's four interior
// surfaces, which cite only the 1:200 scheme. Face names, boxes, scales,
// paper, titles and heights are the stored ones (faces' notes and
// materials, surfaces' notes, each pass's `at`/`reason`, and the section's
// six outside wall faces — p9 is here for its heights — dropped).
// Generated from a read-only dump; never edited by hand. Re-compared with
// production key by key on 2026-10-07: identical apart from those cuts.

export const CHURCH_REQUEST = "Two separate quotes for the church. 1) Exterior: paint the exterior facade walls only — no trims, no doors, no windows. The building is tall, so allow for scaffolding or a lift. 2) Interior: paint the interior walls only (nave, transepts, crossing, chancel and the annexe rooms) — no ceilings, no trims, no doors, no windows. The nave has very high open-truss ceilings, so allow for interior scaffolding or a lift for the upper walls.";

export const CHURCH_PLAN_SHEETS = [
 {
  "key": "p1",
  "page": 1,
  "docId": "dchurch",
  "sheetNumber": "A-3",
  "title": null,
  "titles": [],
  "vector": true,
  "pointsWidth": 1191,
  "pointsHeight": 842,
  "scale": {
   "nts": false,
   "text": "1:100",
   "ratio": 100,
   "system": "metric"
  },
  "dims": [],
  "scanDims": [],
  "measure": {
   "version": 2,
   "sheetType": "plan",
   "reason": "",
   "views": [
    {
     "id": "v1",
     "title": "Part church floor plan showing proposed extensions",
     "viewType": "plan",
     "side": "interior",
     "scaleText": "1:100",
     "box": [
      0.185,
      0.029,
      0.836,
      0.723
     ],
     "groundY": 0
    },
    {
     "id": "v2",
     "title": "Glazed lobby to south door",
     "viewType": "plan",
     "side": "interior",
     "scaleText": "1:100",
     "box": [
      0.225,
      0.74,
      0.462,
      0.895
     ],
     "groundY": 0
    }
   ],
   "faces": [
    {
     "id": "f1",
     "viewId": "v1",
     "name": "Cafe",
     "kind": "room",
     "side": "interior",
     "box": [
      0.361,
      0.036,
      0.531,
      0.407
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f2",
     "viewId": "v1",
     "name": "Kitchen",
     "kind": "room",
     "side": "interior",
     "box": [
      0.476,
      0.065,
      0.567,
      0.238
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": "4.7",
     "heightText": "5.2",
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f3",
     "viewId": "v1",
     "name": "Store beside kitchen",
     "kind": "room",
     "side": "interior",
     "box": [
      0.582,
      0.061,
      0.612,
      0.242
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f4",
     "viewId": "v1",
     "name": "WC / toilet suite",
     "kind": "room",
     "side": "interior",
     "box": [
      0.622,
      0.04,
      0.716,
      0.242
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f5",
     "viewId": "v1",
     "name": "Meeting room",
     "kind": "room",
     "side": "interior",
     "box": [
      0.538,
      0.284,
      0.7,
      0.4
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": "6.8",
     "heightText": "3.1",
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f6",
     "viewId": "v1",
     "name": "Glazed lobby to Nave",
     "kind": "room",
     "side": "interior",
     "box": [
      0.408,
      0.263,
      0.523,
      0.407
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f7",
     "viewId": "v1",
     "name": "North transept",
     "kind": "room",
     "side": "interior",
     "box": [
      0.7,
      0.268,
      0.827,
      0.478
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f8",
     "viewId": "v1",
     "name": "Store",
     "kind": "room",
     "side": "interior",
     "box": [
      0.295,
      0.326,
      0.373,
      0.506
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f9",
     "viewId": "v1",
     "name": "Nave",
     "kind": "room",
     "side": "interior",
     "box": [
      0.288,
      0.455,
      0.702,
      0.722
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": [
      {
       "box": [
        0.318,
        0.44,
        0.367,
        0.461
       ],
       "kind": "arch",
       "text": null,
       "dimRef": null
      },
      {
       "box": [
        0.383,
        0.44,
        0.448,
        0.461
       ],
       "kind": "arch",
       "text": null,
       "dimRef": null
      },
      {
       "box": [
        0.462,
        0.44,
        0.532,
        0.461
       ],
       "kind": "arch",
       "text": null,
       "dimRef": null
      },
      {
       "box": [
        0.546,
        0.44,
        0.615,
        0.461
       ],
       "kind": "arch",
       "text": null,
       "dimRef": null
      }
     ]
    },
    {
     "id": "f10",
     "viewId": "v1",
     "name": "Glazed lobby to west door",
     "kind": "room",
     "side": "interior",
     "box": [
      0.232,
      0.553,
      0.294,
      0.711
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": "2.1 metres",
     "heightText": "4 metres",
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f11",
     "viewId": "v2",
     "name": "Glazed lobby to south door",
     "kind": "room",
     "side": "interior",
     "box": [
      0.288,
      0.789,
      0.391,
      0.882
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": "4 metres",
     "heightText": "2.1 metres",
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    }
   ],
   "heights": []
  }
 },
 {
  "key": "p3",
  "page": 3,
  "docId": "dchurch",
  "sheetNumber": "A-3",
  "title": null,
  "titles": [],
  "vector": true,
  "pointsWidth": 1191,
  "pointsHeight": 842,
  "scale": {
   "nts": false,
   "text": "1:200",
   "ratio": 200,
   "system": "metric"
  },
  "dims": [],
  "scanDims": [],
  "measure": {
   "version": 2,
   "sheetType": "plan",
   "reason": "",
   "views": [
    {
     "id": "v1",
     "title": "Scheme C4 - Whole Church Plan",
     "viewType": "plan",
     "side": "interior",
     "scaleText": "1:200",
     "box": [
      0.045,
      0.064,
      0.975,
      0.902
     ],
     "groundY": 0
    }
   ],
   "faces": [
    {
     "id": "f1",
     "viewId": "v1",
     "name": "Nave",
     "kind": "room",
     "side": "interior",
     "box": [
      0.26,
      0.31,
      0.486,
      0.56
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f2",
     "viewId": "v1",
     "name": "Crossing",
     "kind": "room",
     "side": "interior",
     "box": [
      0.486,
      0.315,
      0.596,
      0.565
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": [
      {
       "box": [
        0.478,
        0.365,
        0.499,
        0.524
       ],
       "kind": "arch",
       "text": null,
       "dimRef": null
      },
      {
       "box": [
        0.51,
        0.3,
        0.572,
        0.322
       ],
       "kind": "arch",
       "text": null,
       "dimRef": null
      },
      {
       "box": [
        0.586,
        0.365,
        0.606,
        0.525
       ],
       "kind": "arch",
       "text": null,
       "dimRef": null
      },
      {
       "box": [
        0.51,
        0.548,
        0.592,
        0.57
       ],
       "kind": "arch",
       "text": null,
       "dimRef": null
      }
     ]
    },
    {
     "id": "f3",
     "viewId": "v1",
     "name": "North transept",
     "kind": "room",
     "side": "interior",
     "box": [
      0.48,
      0.245,
      0.594,
      0.43
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f4",
     "viewId": "v1",
     "name": "South transept",
     "kind": "room",
     "side": "interior",
     "box": [
      0.477,
      0.493,
      0.611,
      0.626
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f5",
     "viewId": "v1",
     "name": "Chancel",
     "kind": "room",
     "side": "interior",
     "box": [
      0.594,
      0.32,
      0.69,
      0.625
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f6",
     "viewId": "v1",
     "name": "Cafe",
     "kind": "room",
     "side": "interior",
     "box": [
      0.306,
      0.169,
      0.392,
      0.35
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f7",
     "viewId": "v1",
     "name": "Kitchen",
     "kind": "room",
     "side": "interior",
     "box": [
      0.356,
      0.174,
      0.43,
      0.264
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f8",
     "viewId": "v1",
     "name": "Meeting Room",
     "kind": "room",
     "side": "interior",
     "box": [
      0.408,
      0.264,
      0.48,
      0.351
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f9",
     "viewId": "v1",
     "name": "Store",
     "kind": "room",
     "side": "interior",
     "box": [
      0.259,
      0.3,
      0.313,
      0.376
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f10",
     "viewId": "v1",
     "name": "Annexe WC and service rooms",
     "kind": "room",
     "side": "interior",
     "box": [
      0.427,
      0.174,
      0.48,
      0.27
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f11",
     "viewId": "v1",
     "name": "Boiler",
     "kind": "room",
     "side": "interior",
     "box": [
      0.603,
      0.27,
      0.636,
      0.339
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f12",
     "viewId": "v1",
     "name": "Vestry",
     "kind": "room",
     "side": "interior",
     "box": [
      0.654,
      0.267,
      0.729,
      0.365
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f13",
     "viewId": "v1",
     "name": "Office",
     "kind": "room",
     "side": "interior",
     "box": [
      0.728,
      0.267,
      0.78,
      0.363
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f14",
     "viewId": "v1",
     "name": "West glazed lobby",
     "kind": "room",
     "side": "interior",
     "box": [
      0.24,
      0.402,
      0.312,
      0.465
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f15",
     "viewId": "v1",
     "name": "South glazed lobby",
     "kind": "room",
     "side": "interior",
     "box": [
      0.264,
      0.558,
      0.316,
      0.641
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f16",
     "viewId": "v1",
     "name": "Church Hall",
     "kind": "room",
     "side": "interior",
     "box": [
      0.876,
      0.278,
      0.97,
      0.611
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    }
   ],
   "heights": []
  }
 },
 {
  "key": "p8",
  "page": 8,
  "docId": "dchurch",
  "sheetNumber": "A-3",
  "title": null,
  "titles": [],
  "vector": true,
  "pointsWidth": 1191,
  "pointsHeight": 842,
  "scale": {
   "nts": false,
   "text": "1:100",
   "ratio": 100,
   "system": "metric"
  },
  "dims": [],
  "scanDims": [],
  "measure": {
   "version": 2,
   "sheetType": "photo",
   "reason": "",
   "views": [],
   "faces": [],
   "heights": [
    {
     "id": "h1",
     "viewId": null,
     "label": "View looking north west - nave side wall/truss foot line",
     "kind": "wall_plate",
     "side": "interior",
     "box": null,
     "dimRef": null,
     "text": null,
     "photoHeightM": 5.5,
     "photoBasis": "View looking north west: truss feet/wall plate line appears about 2.7 times a 2.0 m door height, checked against chairs at floor level."
    },
    {
     "id": "h2",
     "viewId": null,
     "label": "View looking east existing - nave wall plate/truss foot line",
     "kind": "wall_plate",
     "side": "interior",
     "box": null,
     "dimRef": null,
     "text": null,
     "photoHeightM": 5.8,
     "photoBasis": "View looking east (existing): lower ends of main trusses at side walls estimated from matching nave views; about 2.8 to 3.0 door heights above floor."
    },
    {
     "id": "h3",
     "viewId": null,
     "label": "View looking east - nave side wall/truss foot line",
     "kind": "wall_plate",
     "side": "interior",
     "box": null,
     "dimRef": null,
     "text": null,
     "photoHeightM": 5.8,
     "photoBasis": "View looking east: side wall tops at truss feet sit well above the aisle arches; estimated against visible people/pews and a typical 2.0 m doorway."
    },
    {
     "id": "h4",
     "viewId": null,
     "label": "View looking west - west nave wall/truss foot line",
     "kind": "wall_plate",
     "side": "interior",
     "box": null,
     "dimRef": null,
     "text": null,
     "photoHeightM": 5.6,
     "photoBasis": "View looking west: main truss feet and wall plate line estimated at roughly 2.8 times the west door height, with chairs about 0.8 to 0.9 m as secondary check."
    }
   ]
  }
 },
 {
  "key": "p9",
  "page": 9,
  "docId": "dchurch",
  "sheetNumber": "A-3",
  "title": null,
  "titles": [],
  "vector": true,
  "pointsWidth": 1191,
  "pointsHeight": 842,
  "scale": {
   "nts": false,
   "text": "1:100",
   "ratio": 100,
   "system": "metric"
  },
  "dims": [],
  "scanDims": [],
  "measure": {
   "version": 2,
   "sheetType": "elevation",
   "reason": "",
   "views": [
    {
     "id": "v1",
     "title": "Cross Section - looking south to show nave roof connection",
     "viewType": "elevation",
     "side": "exterior",
     "scaleText": "Scale 1:100",
     "box": [
      0.167,
      0.207,
      0.805,
      0.819
     ],
     "groundY": 0.72
    }
   ],
   "faces": [],
   "heights": [
    {
     "id": "h1",
     "viewId": "v1",
     "label": "Left existing wall top / eaves height",
     "kind": "eaves",
     "side": "exterior",
     "box": [
      0.171,
      0.298,
      0.185,
      0.72
     ],
     "dimRef": null,
     "text": null,
     "photoHeightM": null,
     "photoBasis": null
    },
    {
     "id": "h2",
     "viewId": "v1",
     "label": "Extension wall plate / eaves height",
     "kind": "wall_plate",
     "side": "exterior",
     "box": [
      0.326,
      0.612,
      0.339,
      0.72
     ],
     "dimRef": null,
     "text": null,
     "photoHeightM": null,
     "photoBasis": null
    },
    {
     "id": "h3",
     "viewId": "v1",
     "label": "Main nave roof eaves line",
     "kind": "eaves",
     "side": "exterior",
     "box": [
      0.366,
      0.612,
      0.38,
      0.72
     ],
     "dimRef": null,
     "text": null,
     "photoHeightM": null,
     "photoBasis": null
    },
    {
     "id": "h4",
     "viewId": "v1",
     "label": "Main nave roof ridge/top line",
     "kind": "ridge",
     "side": "exterior",
     "box": [
      0.441,
      0.346,
      0.455,
      0.72
     ],
     "dimRef": null,
     "text": null,
     "photoHeightM": null,
     "photoBasis": null
    },
    {
     "id": "h5",
     "viewId": "v1",
     "label": "West gable apex height",
     "kind": "ridge",
     "side": "exterior",
     "box": [
      0.66,
      0.456,
      0.674,
      0.72
     ],
     "dimRef": null,
     "text": null,
     "photoHeightM": null,
     "photoBasis": null
    },
    {
     "id": "h6",
     "viewId": "v1",
     "label": "New glazed west porch height",
     "kind": "other",
     "side": "exterior",
     "box": [
      0.77,
      0.608,
      0.784,
      0.72
     ],
     "dimRef": null,
     "text": null,
     "photoHeightM": null,
     "photoBasis": null
    }
   ]
  }
 },
 {
  "key": "p11",
  "page": 11,
  "docId": "dchurch",
  "sheetNumber": "A-3",
  "title": null,
  "titles": [],
  "vector": true,
  "pointsWidth": 1191,
  "pointsHeight": 842,
  "scale": {
   "nts": false,
   "text": "1:100",
   "ratio": 100,
   "system": "metric"
  },
  "dims": [],
  "scanDims": [],
  "measure": {
   "version": 2,
   "sheetType": "plan",
   "reason": "",
   "views": [
    {
     "id": "v1",
     "title": "Plan - as existing",
     "viewType": "plan",
     "side": "interior",
     "scaleText": "1:100",
     "box": [
      0.01,
      0.053,
      0.993,
      0.821
     ],
     "groundY": 0
    }
   ],
   "faces": [
    {
     "id": "f1",
     "viewId": "v1",
     "name": "Nave",
     "kind": "room",
     "side": "interior",
     "box": [
      0.043,
      0.246,
      0.439,
      0.661
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f2",
     "viewId": "v1",
     "name": "North Transept",
     "kind": "room",
     "side": "interior",
     "box": [
      0.455,
      0.116,
      0.666,
      0.305
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f3",
     "viewId": "v1",
     "name": "South Transept",
     "kind": "room",
     "side": "interior",
     "box": [
      0.455,
      0.668,
      0.666,
      0.835
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f4",
     "viewId": "v1",
     "name": "Crossing",
     "kind": "room",
     "side": "interior",
     "box": [
      0.462,
      0.315,
      0.664,
      0.655
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": [
      {
       "box": [
        0.431,
        0.32,
        0.449,
        0.65
       ],
       "kind": "arch",
       "text": null,
       "dimRef": null
      },
      {
       "box": [
        0.491,
        0.302,
        0.646,
        0.322
       ],
       "kind": "arch",
       "text": null,
       "dimRef": null
      },
      {
       "box": [
        0.491,
        0.648,
        0.646,
        0.668
       ],
       "kind": "arch",
       "text": null,
       "dimRef": null
      },
      {
       "box": [
        0.662,
        0.322,
        0.681,
        0.65
       ],
       "kind": "arch",
       "text": null,
       "dimRef": null
      }
     ]
    },
    {
     "id": "f5",
     "viewId": "v1",
     "name": "Chancel / sanctuary",
     "kind": "room",
     "side": "interior",
     "box": [
      0.67,
      0.306,
      0.93,
      0.675
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f6",
     "viewId": "v1",
     "name": "Boiler",
     "kind": "room",
     "side": "interior",
     "box": [
      0.681,
      0.127,
      0.759,
      0.248
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f7",
     "viewId": "v1",
     "name": "Vestry",
     "kind": "room",
     "side": "interior",
     "box": [
      0.812,
      0.102,
      0.971,
      0.337
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    },
    {
     "id": "f8",
     "viewId": "v1",
     "name": "Annexe lobby / link",
     "kind": "room",
     "side": "interior",
     "box": [
      0.759,
      0.117,
      0.815,
      0.319
     ],
     "shape": "rectangle",
     "lengthDimRef": null,
     "heightDimRef": null,
     "lengthText": null,
     "heightText": null,
     "printedAreaText": null,
     "openingsShare": 0,
     "openingsBasis": null,
     "material": null,
     "note": null,
     "openings": []
    }
   ],
   "heights": []
  }
 }
];

export const CHURCH_INTERIOR_MODEL = {
 "version": 1,
 "summary": "",
 "buildingType": "Church with annexe / extension",
 "commercial": false,
 "areas": [
  {
   "id": "a2",
   "name": "Nave interior walls",
   "side": "interior",
   "level": null,
   "included": true
  },
  {
   "id": "a3",
   "name": "Transepts, crossing and chancel interior walls",
   "side": "interior",
   "level": null,
   "included": true
  },
  {
   "id": "a4",
   "name": "Annexe and extension room interior walls",
   "side": "interior",
   "level": null,
   "included": true
  }
 ],
 "surfaces": [
  {
   "id": "s3",
   "note": null,
   "coats": null,
   "count": null,
   "label": "Nave high interior walls only",
   "sheet": "A-3",
   "areaId": "a2",
   "itemKey": "wall_two_storey",
   "estimate": null,
   "excelCol": null,
   "excelRow": null,
   "faceRefs": [
    "p3.f1"
   ],
   "included": true,
   "override": null,
   "heightRef": "p8.h3",
   "widthRefs": [],
   "excelSheet": null,
   "lengthRefs": [],
   "multiplier": 1,
   "productKey": "wall_interior",
   "faceMeasure": "walls",
   "estimateBasis": null,
   "photoSurfaceId": null
  },
  {
   "id": "s4",
   "note": null,
   "coats": null,
   "count": null,
   "label": "Transept, crossing and chancel high interior walls only",
   "sheet": "A-3",
   "areaId": "a3",
   "itemKey": "wall_two_storey",
   "estimate": null,
   "excelCol": null,
   "excelRow": null,
   "faceRefs": [
    "p3.f2",
    "p3.f3",
    "p3.f4",
    "p3.f5"
   ],
   "included": true,
   "override": null,
   "heightRef": "p8.h2",
   "widthRefs": [],
   "excelSheet": null,
   "lengthRefs": [],
   "multiplier": 1,
   "productKey": "wall_interior",
   "faceMeasure": "walls",
   "estimateBasis": null,
   "photoSurfaceId": null
  },
  {
   "id": "s5",
   "note": null,
   "coats": null,
   "count": null,
   "label": "New annexe / extension room interior walls only",
   "sheet": "A-3",
   "areaId": "a4",
   "itemKey": "walls",
   "estimate": null,
   "excelCol": null,
   "excelRow": null,
   "faceRefs": [
    "p3.f6",
    "p3.f7",
    "p3.f8",
    "p3.f9",
    "p3.f10"
   ],
   "included": true,
   "override": null,
   "heightRef": "p9.h2",
   "widthRefs": [],
   "excelSheet": null,
   "lengthRefs": [],
   "multiplier": 1,
   "productKey": "wall_interior",
   "faceMeasure": "walls",
   "estimateBasis": null,
   "photoSurfaceId": null
  },
  {
   "id": "s6",
   "note": null,
   "coats": null,
   "count": null,
   "label": "Existing annexe / service room interior walls only",
   "sheet": "A-3",
   "areaId": "a4",
   "itemKey": "walls",
   "estimate": null,
   "excelCol": null,
   "excelRow": null,
   "faceRefs": [
    "p3.f11",
    "p3.f12",
    "p3.f13"
   ],
   "included": true,
   "override": null,
   "heightRef": "p9.h2",
   "widthRefs": [],
   "excelSheet": null,
   "lengthRefs": [],
   "multiplier": 1,
   "productKey": "wall_interior",
   "faceMeasure": "walls",
   "estimateBasis": null,
   "photoSurfaceId": null
  }
 ],
 "access": [],
 "questions": [],
 "assumptions": [],
 "exclusions": []
};
