import React, { useEffect, useId, useRef } from "react";
import { useJsApiLoader } from "@react-google-maps/api";

import {
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_SCRIPT_ID,
} from "@/components/GooglePlacesAddressInput";
import useGoogleMapsApiKey from "@/hooks/useGoogleMapsApiKey";

import { Field } from "./Field";

/**
 * Street-address input backed by Google Places.
 *
 * The text input always renders (never swapped out for an empty loader), then
 * Places Autocomplete is attached once the shared Maps script is ready — same
 * pattern as the admin GooglePlacesAddressInput.
 *
 * When `requirePlaceSelection` is true, free typing is still allowed but the
 * parent should clear GPS / structured fields until a suggestion is picked —
 * Continue is blocked without coordinates from Google.
 *
 * Degrades to a plain text input when no key is configured or Places is unavailable.
 */
export default function AddressAutocomplete(props) {
  const { googleMapsApiKey } = useGoogleMapsApiKey();

  if (!googleMapsApiKey || props.readOnly) {
    return <AddressFieldShell {...props} />;
  }

  return <PlacesAddressField apiKey={googleMapsApiKey} {...props} />;
}

function PlacesAddressField({
  apiKey,
  label,
  error,
  hint,
  full = false,
  id,
  name,
  value = "",
  placeholder = "Start typing your address",
  requirePlaceSelection = false,
  onChange,
  onPlaceSelected,
  readOnly = false,
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const listenerRef = useRef(null);
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  onPlaceSelectedRef.current = onPlaceSelected;

  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
    preventGoogleFontsLoading: true,
  });

  const placesReady =
    !readOnly && (isLoaded || Boolean(window.google?.maps?.places));

  useEffect(() => {
    if (!placesReady) return undefined;
    const input = inputRef.current;
    if (!input || !window.google?.maps?.places) return undefined;

    if (!autocompleteRef.current) {
      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        input,
        {
          fields: [
            "formatted_address",
            "geometry.location",
            "name",
            "address_components",
          ],
        },
      );
    }

    if (listenerRef.current) {
      window.google.maps.event.removeListener(listenerRef.current);
      listenerRef.current = null;
    }

    listenerRef.current = autocompleteRef.current.addListener(
      "place_changed",
      () => {
        const place = autocompleteRef.current?.getPlace?.();
        if (!place) return;

        const lat =
          typeof place.geometry?.location?.lat === "function"
            ? place.geometry.location.lat()
            : undefined;
        const lng =
          typeof place.geometry?.location?.lng === "function"
            ? place.geometry.location.lng()
            : undefined;

        onPlaceSelectedRef.current?.({
          formattedAddress: place.formatted_address || place.name || "",
          gpsCoordinates:
            lat !== undefined && lng !== undefined
              ? `${lat.toFixed(6)}, ${lng.toFixed(6)}`
              : "",
          components: place.address_components || [],
        });
      },
    );

    return () => {
      if (listenerRef.current && window.google?.maps?.event) {
        window.google.maps.event.removeListener(listenerRef.current);
        listenerRef.current = null;
      }
    };
  }, [placesReady]);

  useEffect(() => {
    return () => {
      if (listenerRef.current && window.google?.maps?.event) {
        window.google.maps.event.removeListener(listenerRef.current);
      }
      autocompleteRef.current = null;
    };
  }, []);

  return (
    <AddressFieldShell
      label={label}
      error={error}
      hint={hint}
      full={full}
      id={inputId}
      name={name}
      value={value}
      placeholder={placeholder}
      requirePlaceSelection={requirePlaceSelection}
      onChange={onChange}
      readOnly={readOnly}
      inputRef={inputRef}
    />
  );
}

function AddressFieldShell({
  label,
  error,
  hint,
  full = false,
  id,
  name,
  value = "",
  placeholder = "Start typing your address",
  requirePlaceSelection = false,
  onChange,
  readOnly = false,
  inputRef,
}) {
  const generatedId = useId();
  const inputId = id || generatedId;

  const resolvedHint =
    hint ||
    (requirePlaceSelection
      ? "Select an address from the Google suggestions — typed-only addresses cannot proceed."
      : undefined);

  return (
    <Field
      label={label}
      htmlFor={inputId}
      error={error}
      hint={resolvedHint}
      full={full}
    >
      <span className="epc-field__control">
        <input
          ref={inputRef}
          id={inputId}
          name={name}
          className="epc-input"
          type="text"
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          readOnly={readOnly}
          aria-invalid={error ? "true" : undefined}
          onChange={(event) => onChange?.(event.target.value)}
          onKeyDown={(event) => {
            // Enter would otherwise submit the step while choosing a suggestion.
            if (event.key === "Enter") event.preventDefault();
          }}
        />
      </span>
    </Field>
  );
}
