// app/components/AddressAutocomplete.js
// repo — app/signup/page.js already imports it that way. Keeping the same
// filename here so this is a drop-in replacement rather than a duplicate.
"use client";

import { useRef, useEffect } from "react";
import { useLoadScript } from "@react-google-maps/api";

const libraries = ["places"];

export default function AddressAutocomplete({
  value,
  onChange, // (address: string) => void
  onPlaceSelected, // ({ address, city, province, postalCode, country, lat, lng }) => void
  placeholder = "Start typing address...",
  required = false,
  className = "",
  disabled = false,
}) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onPlaceSelectedRef.current = onPlaceSelected;
    onChangeRef.current = onChange;
  }, [onPlaceSelected, onChange]);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== (value || "")) {
      inputRef.current.value = value || "";
    }
  }, [value]);

  useEffect(() => {
    if (!isLoaded || !inputRef.current) return;

    autocompleteRef.current = new window.google.maps.places.Autocomplete(
      inputRef.current,
      {
        // ── No country restriction ──────────────────────────────────────
        //
        // This was pinned to `{ country: "ca" }`, inherited from the original
        // component. FieldQuo bills in eleven countries (lib/currency.js
        // COUNTRIES), so that pin meant a contractor anywhere else could not
        // find their own address: the box offered nothing, and nothing on
        // screen explained why. It also fed the country field that DERIVES
        // billing currency, so the one address they could pick was always
        // Canadian.
        //
        // Not re-pinned to the eleven either — Google caps componentRestrictions
        // at five countries, so any list we passed would exclude six of the
        // markets we sell to. Unrestricted, Places already ranks by the user's
        // own location, which is the behaviour we actually want.
        fields: ["address_components", "formatted_address", "geometry"],
        types: ["address"],
      },
    );

    const listener = autocompleteRef.current.addListener(
      "place_changed",
      () => {
        const place = autocompleteRef.current.getPlace();
        const formatted = place?.formatted_address || "";
        if (!formatted) return;

        if (inputRef.current) inputRef.current.value = formatted;

        // Pull the structured components out instead of just the flat string —
        // existing callers only used city/province, so those two keep the same
        // shape; postalCode/country/lat/lng are additive and safe to ignore.
        let city = "";
        let province = "";
        let postalCode = "";
        let country = "";
        for (const component of place.address_components || []) {
          if (component.types.includes("locality")) city = component.long_name;
          if (component.types.includes("administrative_area_level_1"))
            province = component.short_name;
          if (component.types.includes("postal_code"))
            postalCode = component.long_name;
          if (component.types.includes("country"))
            country = component.short_name;
        }

        const lat = place.geometry?.location?.lat?.();
        const lng = place.geometry?.location?.lng?.();

        onPlaceSelectedRef.current?.({
          address: formatted,
          city,
          province,
          postalCode,
          country,
          lat: typeof lat === "number" ? lat : null,
          lng: typeof lng === "number" ? lng : null,
        });
      },
    );

    return () => {
      if (listener) window.google.maps.event.removeListener(listener);
    };
  }, [isLoaded]);

  return (
    <input
      ref={inputRef}
      type="text"
      name="address"
      defaultValue={value || ""}
      onChange={(e) => onChangeRef.current?.(e.target.value)}
      required={required}
      placeholder={placeholder}
      className={className}
      autoComplete="off"
      disabled={disabled}
    />
  );
}
