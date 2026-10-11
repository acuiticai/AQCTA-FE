import { Country, State, City } from "country-state-city";

import { getMalaysiaCitiesForState } from "./malaysiaCitiesByState";

export const getCountryOptions = () =>
  Country.getAllCountries()
    .map((c) => ({
      value: c.isoCode,
      label: c.name,
      name: c.name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

export const findCountry = (value) => {
  if (!value) return null;
  const all = Country.getAllCountries();
  const needle = String(value).trim().toLowerCase();
  return (
    all.find((c) => c.isoCode.toLowerCase() === needle) ||
    all.find((c) => c.name.toLowerCase() === needle) ||
    null
  );
};

export const getStateOptions = (countryCode) => {
  if (!countryCode) return [];
  return State.getStatesOfCountry(countryCode)
    .map((s) => ({
      value: s.isoCode,
      label: s.name,
      name: s.name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

export const findState = (countryCode, value) => {
  if (!countryCode || !value) return null;
  const all = State.getStatesOfCountry(countryCode);
  const needle = String(value).trim().toLowerCase();
  return (
    all.find((s) => s.isoCode.toLowerCase() === needle) ||
    all.find((s) => s.name.toLowerCase() === needle) ||
    null
  );
};

export const getCityOptions = (countryCode, stateCode) => {
  if (!countryCode) return [];
  const fromCsc = stateCode
    ? City.getCitiesOfState(countryCode, stateCode)
    : City.getCitiesOfCountry(countryCode);

  const seen = new Set();
  const options = [];

  const pushName = (name, latitude, longitude) => {
    const key = String(name || "")
      .trim()
      .toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    options.push({
      value: name,
      label: name,
      latitude: latitude || undefined,
      longitude: longitude || undefined,
    });
  };

  (fromCsc || []).forEach((c) => pushName(c.name, c.latitude, c.longitude));

  // Malaysia: CSC is incomplete for common towns — merge postcode-derived list.
  if (String(countryCode).toUpperCase() === "MY") {
    if (stateCode) {
      getMalaysiaCitiesForState(stateCode).forEach((name) => pushName(name));
    } else {
      State.getStatesOfCountry("MY").forEach((s) => {
        getMalaysiaCitiesForState(s.isoCode).forEach((name) => pushName(name));
      });
    }
  }

  return options.sort((a, b) => a.label.localeCompare(b.label));
};

export const getCityGps = (countryCode, stateCode, cityName) => {
  if (!countryCode || !cityName) return "";
  const cities = stateCode
    ? City.getCitiesOfState(countryCode, stateCode)
    : City.getCitiesOfCountry(countryCode);
  const needle = String(cityName).trim().toLowerCase();
  const city = (cities || []).find(
    (c) => String(c.name || "").toLowerCase() === needle,
  );
  if (!city?.latitude || !city?.longitude) return "";
  return `${city.latitude}, ${city.longitude}`;
};

/**
 * True when country-state-city knows any states/provinces for this country.
 * Countries without them (e.g. Singapore) must not demand a state.
 */
export const countryHasStates = (countryCode) =>
  Boolean(countryCode) && getStateOptions(countryCode).length > 0;

/**
 * City can only be chosen once the location above it is settled: a country is
 * picked, and either that country has no states or a state has been chosen.
 */
export const isCityEnabled = (countryCode, stateCode) =>
  Boolean(countryCode) && (!countryHasStates(countryCode) || Boolean(stateCode));

/**
 * Applies one country/state/city edit and the resets it implies, returning the
 * next address object.
 *
 * Choosing a country invalidates the state, city and coordinates below it;
 * choosing a state invalidates the city and coordinates; choosing a city fills
 * the coordinates in from that city's centroid. Callers keep both the ISO code
 * (`countryCode`/`stateCode`, what the pickers bind to) and the display name
 * (`country`/`stateProvince`, what gets submitted).
 *
 * These are the same rules `pages/Customer/components/BasicInformation.jsx`
 * applies inline for the admin form; this is the shared implementation so the
 * customer portal cannot drift from it.
 *
 * `fillCityGps` defaults to true (the admin behaviour). The customer portal
 * passes false because it geocodes the street address through Google Places,
 * and a city centroid would silently overwrite that far more precise value.
 */
export const applyLocationCascade = (prev, field, value, options = {}) => {
  const { fillCityGps = true } = options;
  const next = { ...prev, [field]: value };

  if (field === "country" || field === "countryCode") {
    const country = findCountry(value);
    next.country = country?.name || value || "";
    next.countryCode = country?.isoCode || "";
    next.stateProvince = "";
    next.stateCode = "";
    next.city = "";
    next.gpsCoordinates = "";
    return next;
  }

  if (field === "stateProvince" || field === "stateCode") {
    const state = findState(prev.countryCode, value);
    next.stateProvince = state?.name || value || "";
    next.stateCode = state?.isoCode || "";
    next.city = "";
    next.gpsCoordinates = "";
    return next;
  }

  if (field === "city") {
    next.city = value || "";
    if (fillCityGps) {
      const gps = getCityGps(prev.countryCode, prev.stateCode, value);
      if (gps) next.gpsCoordinates = gps;
    }
    return next;
  }

  return next;
};
