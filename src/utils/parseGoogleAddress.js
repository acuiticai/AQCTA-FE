/**
 * Extract structured location fields from Google Places address_components.
 */
export function parseGoogleAddressComponents(components = []) {
  const find = (type) =>
    components.find((c) => c.types?.includes(type))?.long_name || "";

  const streetNumber = find("street_number");
  const route = find("route");
  const street = [streetNumber, route].filter(Boolean).join(" ").trim();

  const block =
    find("subpremise") ||
    find("premise") ||
    find("neighborhood") ||
    find("sublocality_level_1") ||
    find("sublocality") ||
    "";

  const city =
    find("locality") ||
    find("postal_town") ||
    find("administrative_area_level_2");
  const state = find("administrative_area_level_1");

  return {
    street,
    block,
    city,
    state,
    cityState: [city, state].filter(Boolean).join(", "),
    country: find("country"),
    postCode: find("postal_code"),
  };
}
