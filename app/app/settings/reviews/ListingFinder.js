"use client";

// app/app/settings/reviews/ListingFinder.js
//
// "Find your Google listing": the company types its own name into the same
// Places box the address fields use, picks itself from the suggestions, and
// the server turns the place_id into the review link. Nothing new leaves
// the building — this is the ONE sanctioned client-side Google call the
// product already makes (app/components/AddressAutocomplete.js), with
// `types: ["establishment"]` in place of `["address"]` and three fields
// asked for instead of the address components.
//
// The browser sends the place_id, the name and the address Google returned;
// it never sends a review URL. The server derives that
// (lib/reviews/googlePlace.js) — a browser that composed the link could
// compose any link.

import { useEffect, useRef } from "react";
import { useLoadScript } from "@react-google-maps/api";
import { MAPS_LIBRARIES as libraries } from "@/lib/maps/libraries";

/** Is a Places suggestion list on screen? Same test as AddressAutocomplete. */
function placesSuggestionsOpen() {
  if (typeof document === "undefined") return false;
  return Array.from(document.querySelectorAll(".pac-container")).some(
    (el) => el.offsetParent !== null && el.children.length > 0,
  );
}

export default function ListingFinder({ onPick, placeholder = "", unavailableText = "", className = "", disabled = false }) {
  const inputRef = useRef(null);
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  // Enter that picks a suggestion must not submit the enclosing form — see
  // AddressAutocomplete for why this is a capture-phase document listener.
  useEffect(() => {
    function onKeyDownCapture(e) {
      if (e.key !== "Enter" || e.target !== inputRef.current || !placesSuggestionsOpen()) return;
      e.preventDefault();
    }
    document.addEventListener("keydown", onKeyDownCapture, true);
    return () => document.removeEventListener("keydown", onKeyDownCapture, true);
  }, []);

  useEffect(() => {
    if (!isLoaded || !inputRef.current || !window.google?.maps?.places) return;
    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      fields: ["place_id", "name", "formatted_address"],
      types: ["establishment"],
    });
    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place?.place_id) return;
      onPickRef.current?.({
        placeId: place.place_id,
        name: place.name || "",
        address: place.formatted_address || "",
      });
      if (inputRef.current) inputRef.current.value = "";
    });
    return () => {
      if (listener) window.google.maps.event.removeListener(listener);
    };
  }, [isLoaded]);

  // No key, or the script refused to load: say so rather than render a box
  // that accepts typing and suggests nothing.
  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || loadError) {
    return (
      <p data-listing-finder-unavailable className="text-xs text-muted-foreground">
        {unavailableText}
      </p>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder={placeholder}
      className={className}
      autoComplete="off"
      disabled={disabled || !isLoaded}
      aria-label={placeholder}
    />
  );
}
