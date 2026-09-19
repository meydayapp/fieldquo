// lib/maps/libraries.js
//
// The ONE `libraries` list every useLoadScript call in the app passes.
//
// @react-google-maps/api injects one <script> per distinct URL, and the URL
// carries the libraries. Two components on one page asking for different
// lists — ["places"] for the address field, ["places","drawing"] for a map —
// get two script tags, the "included the Google Maps JavaScript API multiple
// times" error and a cascade of "Element already defined" failures (see the
// header of app/components/MiniMap.js, which went to Static Maps to escape
// exactly this). So there is one list, here. The day map needs nothing
// beyond it: zone drawing is an editable google.maps.Polygon, not the
// drawing library — Google removed DrawingManager at API version 3.65.
//
// A const, not a literal at each call site: the library also warns when the
// array IDENTITY changes between renders, so every caller shares this one.
export const MAPS_LIBRARIES = ["places"];
