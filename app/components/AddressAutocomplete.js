// app/components/AddressAutocomplete.js
// repo — app/signup/page.js already imports it that way. Keeping the same
// filename here so this is a drop-in replacement rather than a duplicate.
"use client";

import { useRef, useEffect } from "react";
import { useLoadScript } from "@react-google-maps/api";

const libraries = ["places"];

/**
 * Is a Places suggestion list on screen right now?
 *
 * Google renders it as a `.pac-container` appended to <body>, not as a child of
 * this component, so there is no ref to consult and no class of our own to add.
 * Only one is ever visible at a time — the one belonging to the focused input —
 * and a hidden container has `display: none`, hence the offsetParent test.
 */
function placesSuggestionsOpen() {
  if (typeof document === "undefined") return false;
  return Array.from(document.querySelectorAll(".pac-container")).some(
    (el) => el.offsetParent !== null && el.children.length > 0,
  );
}


/**
 * Pull a postal code out of a Google-formatted address.
 *
 * Canadian codes are matched anywhere in the string: "A1A 1A1" is distinctive
 * enough that no street name or city collides with it.
 *
 * US ZIPs are NOT, because "12345 Main St" is a house number. So they are only
 * read from the comma-segment that also carries a two-letter state — Google's
 * format puts them together ("Buffalo, NY 14201") — which is the one place a
 * bare five-digit number is unambiguous.
 *
 * Returns "" rather than a guess when neither pattern fits. An absent postal
 * code is a fact about the address; a wrong one is a fact about nothing.
 */
function postalCodeFromFormatted(formatted) {
  const s = String(formatted || "");

  const ca = s.match(/\b([A-Za-z]\d[A-Za-z])[ -]?(\d[A-Za-z]\d)\b/);
  if (ca) return `${ca[1].toUpperCase()} ${ca[2].toUpperCase()}`;

  for (const part of s.split(",")) {
    const us = part.trim().match(/^[A-Z]{2}\s+(\d{5}(?:-\d{4})?)$/);
    if (us) return us[1];
  }
  return "";
}

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

  /**
   * Enter that PICKS a suggestion must not also submit the form.
   *
   * On /signup, choosing an address with the keyboard submitted the whole
   * signup form: the account step's validator ran against the first name, last
   * name, email and password nobody had reached yet and lit them all red
   * mid-address.
   *
   * A CAPTURE-phase listener on the document, not an `onKeyDown` prop, and that
   * is the entire reason this is eleven lines instead of one. Google binds its
   * own keydown handler directly to this input, so it runs before anything React
   * attaches at the root — and it hides the suggestion list synchronously. A
   * React onKeyDown therefore looks for a dropdown that has already gone and
   * quietly does nothing, which is a fix that appears to work and doesn't.
   * Measured rather than assumed: at capture the list is on screen, by the
   * bubble phase it is not.
   *
   * Scoped to "a list is actually open" and to THIS input, so Enter still
   * submits normally everywhere else — the other ten callers keep the behaviour
   * they have when someone is typing free text rather than choosing.
   *
   * preventDefault only, never stopPropagation: Google's listener is what turns
   * the highlighted row into a place_changed event, and stopping propagation
   * would break selection while fixing submission.
   */
  useEffect(() => {
    function onKeyDownCapture(e) {
      if (e.key !== "Enter") return;
      if (e.target !== inputRef.current) return;
      if (!placesSuggestionsOpen()) return;
      e.preventDefault();
    }

    document.addEventListener("keydown", onKeyDownCapture, true);
    return () =>
      document.removeEventListener("keydown", onKeyDownCapture, true);
  }, []);

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

        // ── Google often omits the postal code from a street-level result ──
        //
        // `address_components` is requested and city and province arrive
        // reliably, but Places Autocomplete frequently stops at
        // administrative_area_level_1 and leaves postal_code out — while the
        // formatted_address it hands back in the same response CONTAINS it:
        //
        //     "1039 Bank St, Ottawa, ON K1X 1H4, Canada"
        //
        // So the field sat empty on every company that used the picker, which
        // is what the owner reported. This reads the code out of the string
        // Google already returned; it invents nothing and never overrides a
        // component when there is one.
        if (!postalCode && formatted) {
          postalCode = postalCodeFromFormatted(formatted);
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
