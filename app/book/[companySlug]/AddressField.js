// app/book/[companySlug]/AddressField.js
//
// The visit address on the public booking page.
//
// Google Places autocomplete when Google is available, a plain typed address
// when it isn't — and the plain input is a FIRST-CLASS path, not an error
// screen. The person filling this in is a stranger in a driveway on a bad
// connection; a booking page that won't take a typed address because a
// third-party script didn't load is worse than one that never offered
// autocomplete at all.
//
// Three ways Google can be missing, all of which end up typing plain text:
//
//   1. No NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. AddressAutocomplete still renders
//      its input; `isLoaded` never flips, so the Autocomplete widget is simply
//      never attached and onChange keeps firing.
//   2. The script request fails (offline, blocked, ad-blocker). Same as above.
//   3. The script loads but `google.maps.places` isn't usable — the key exists
//      but the Places API isn't enabled on it. That one THROWS, inside an
//      effect, which without a boundary unmounts the whole booking flow and
//      leaves the visitor on a blank card. Hence the boundary below: a
//      misconfigured key must cost autocomplete, never the booking.
"use client";

import { Component, useEffect, useRef } from "react";
import AddressAutocomplete from "@/app/components/AddressAutocomplete";

class AutocompleteBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    // Logged, not surfaced. The visitor gets a working text field; the company
    // gets nothing useful from being told their estimator's Places key is off.
    console.warn("[booking] address autocomplete unavailable:", error?.message);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function AddressField({
  id,
  value,
  onChange,
  onResolved,
  placeholder,
  className,
}) {
  const wrapRef = useRef(null);

  // AddressAutocomplete doesn't forward `id`, and this field has a real
  // <label htmlFor>. Rather than fork the component (six back-office pages
  // depend on it) or drop the association, stamp the id on after it renders.
  //
  // The fallback below carries the id itself rather than relying on this: when
  // the boundary trips, only the boundary re-renders, so this effect never
  // runs again and the label would silently point at nothing.
  useEffect(() => {
    const el = wrapRef.current?.querySelector("input");
    if (el && el.id !== id) el.id = id;
  });

  const fallback = (
    <input
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="street-address"
      className={className}
    />
  );

  return (
    <div ref={wrapRef}>
      <AutocompleteBoundary fallback={fallback}>
        <AddressAutocomplete
          value={value}
          onChange={onChange}
          // Picking a suggestion is an explicit "this is the address" — the
          // caller uses it to skip the type-ahead debounce and re-query times
          // immediately. The coordinates that come with it are deliberately
          // NOT sent to the server: /api/booking/.../confirm re-geocodes on
          // purpose, because a browser-supplied lat/lng would let anyone drop
          // an appointment anywhere and those coordinates decide which other
          // slots get offered.
          // address-jurisdiction: forwarded — this component chooses nothing.
          // The whole place object (address, city, province, postalCode,
          // country, lat, lng) goes straight to the caller's `onResolved`, and
          // BookingFlow is where the decision about what to keep is made and
          // checked.
          onPlaceSelected={onResolved}
          placeholder={placeholder}
          className={className}
        />
      </AutocompleteBoundary>
    </div>
  );
}
