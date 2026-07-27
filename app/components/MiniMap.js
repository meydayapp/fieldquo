// app/components/MiniMap.js
//
// Was previously calling useLoadScript() itself, which loads the full Google
// Maps JS SDK. Company Settings also renders AddressAutocompete, which loads
// the same SDK with different options (`libraries: ["places"]` vs. none) —
// two different configs means the library injects two separate <script>
// tags, which is exactly the "included the Google Maps JavaScript API
// multiple times" warning and the cascade of "Element already defined"
// errors you're seeing. The library's own guidance is to only ever call
// useLoadScript/useJsApiLoader once per page with matching options.
//
// Rather than thread a shared loader/context through every place that uses
// AddressAutocompete just so this one small preview map can share it, this
// now uses the Static Maps API instead — a plain <img>, no JS SDK, no
// loader to coordinate, no conflict. Static Maps needs to be enabled on the
// same Google Cloud project as your existing Maps JavaScript API key (it
// usually is, but check the Cloud Console under "APIs & Services" if the
// image comes back broken).
"use client";

export default function MiniMap({ lat, lng, zoom = 15 }) {
  if (typeof lat !== "number" || typeof lng !== "number") {
    return (
      <div className="w-full h-40 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-xs text-gray-400">
        Enter an address to preview it on the map
      </div>
    );
  }

  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: String(zoom),
    size: "640x240",
    scale: "2",
    markers: `color:0x111827|${lat},${lng}`,
    key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  });

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`}
        alt="Business location preview"
        width={640}
        height={240}
        className="w-full h-[160px] object-cover"
      />
    </div>
  );
}
