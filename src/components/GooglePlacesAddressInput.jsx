import React, { forwardRef, useEffect, useRef } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import useGoogleMapsApiKey from "@/hooks/useGoogleMapsApiKey";

/** Shared across admin address fields so the Maps script loads once. */
export const GOOGLE_MAPS_SCRIPT_ID = "epics-google-maps-places";
export const GOOGLE_MAPS_LIBRARIES = ["places"];

const inputClassName =
  "w-full border border-transparent focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300 rounded-[12px] shadow-sm px-[16px] py-[8px] bg-gray-100";

const PlainAddressInput = forwardRef(function PlainAddressInput(
  {
    name,
    value = "",
    placeholder = "",
    onChange,
    onBlur,
    disabled = false,
    className = "",
    onFocus,
  },
  ref,
) {
  return (
    <input
      ref={ref}
      type="text"
      name={name}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      autoComplete="off"
      data-epics-places-input="true"
      onChange={(e) => onChange?.(e.target.value)}
      onBlur={onBlur}
      onFocus={onFocus}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
      className={`${inputClassName} ${className}`.trim()}
    />
  );
});

/**
 * Bind Places Autocomplete to ONE concrete <input> via ref.
 * Avoids @react-google-maps/api <Autocomplete> querySelector('input'),
 * which can latch onto nearby react-select inputs and break DropdownBasic.
 */
function PlacesAddressInput({
  apiKey,
  name,
  value = "",
  placeholder = "",
  onChange,
  onBlur,
  onPlaceSelected,
  disabled = false,
  className = "",
}) {
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

  useEffect(() => {
    if (!isLoaded || disabled) return undefined;
    const input = inputRef.current;
    if (!input || !window.google?.maps?.places) return undefined;

    // Only this node — never querySelector across the form
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
          lat: lat ?? null,
          lng: lng ?? null,
          components: place.address_components || [],
          place,
        });
      },
    );

    return () => {
      if (listenerRef.current) {
        window.google.maps.event.removeListener(listenerRef.current);
        listenerRef.current = null;
      }
    };
  }, [isLoaded, disabled]);

  useEffect(() => {
    return () => {
      if (listenerRef.current && window.google?.maps?.event) {
        window.google.maps.event.removeListener(listenerRef.current);
      }
      autocompleteRef.current = null;
    };
  }, []);

  return (
    <div className="w-full min-w-0" data-epics-places-root="true">
      <PlainAddressInput
        ref={inputRef}
        name={name}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        className={className}
      />
    </div>
  );
}

/**
 * Admin-styled street address input backed by Google Places Autocomplete.
 * Falls back to a plain text input when no API key is configured.
 */
export default function GooglePlacesAddressInput(props) {
  const { googleMapsApiKey } = useGoogleMapsApiKey();

  if (!googleMapsApiKey) {
    return <PlainAddressInput {...props} />;
  }

  return <PlacesAddressInput apiKey={googleMapsApiKey} {...props} />;
}
