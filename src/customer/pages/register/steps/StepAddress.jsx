import React, { useMemo } from "react";

import {
  applyLocationCascade,
  countryHasStates,
  getCityOptions,
  getCountryOptions,
  getStateOptions,
  isCityEnabled,
} from "@/utils/locationCascade";

import Button from "../../../components/ui/Button";
import { FormGrid, TextField } from "../../../components/ui/Field";
import Combobox from "../../../components/ui/Combobox";
import AddressAutocomplete from "../../../components/ui/AddressAutocomplete";
import { useRegistration } from "../../../context/RegistrationContext";
import { ADDRESS_LABEL_OPTIONS } from "../../../data/registrationOptions";
import { isFilled, validate } from "../../../utils/validation";

/**
 * Registration step 2 — company address.
 *
 * Country, state and city cascade through `locationCascade` (country-state-city
 * plus a Malaysia city supplement), the same source and reset rules the admin
 * customer form uses: pick a country before a state, a state before a city.
 * City is creatable so towns still missing from the list can be typed in.
 * GPS comes from Google Places on the street address, not the city centroid.
 */
export default function StepAddress() {
  const { data, errors, setErrors, updateSection, goNext, goBack } =
    useRegistration();
  const values = data.address;

  // The full country list is static; states and cities follow the selection.
  const countryOptions = useMemo(() => getCountryOptions(), []);
  const stateOptions = useMemo(
    () => getStateOptions(values.countryCode),
    [values.countryCode],
  );
  const cityOptions = useMemo(
    () => getCityOptions(values.countryCode, values.stateCode),
    [values.countryCode, values.stateCode],
  );

  const hasStates = countryHasStates(values.countryCode);
  const cityEnabled = isCityEnabled(values.countryCode, values.stateCode);

  const clearError = (...fields) =>
    setErrors((prev) => {
      const next = { ...prev };
      fields.forEach((field) => delete next[field]);
      return next;
    });

  /** Plain field: no dependants to reset. */
  const setField = (field) => (event) => {
    updateSection("address", { [field]: event.target.value });
    clearError(field);
  };

  /** Location field: the cascade decides what else changes. */
  const setLocation =
    (field, alsoClears = []) =>
    (next) => {
      updateSection(
        "address",
        // Coordinates come from the Google Places address below, never from a
        // city centroid — see AddressAutocomplete.
        applyLocationCascade(values, field, next, { fillCityGps: false }),
      );
      clearError(field, ...alsoClears);
    };

  const handleSubmit = (event) => {
    event.preventDefault();

    const nextErrors = validate(values, {
      addressLabel: [[isFilled, "Select an address label"]],
      companyAddress: [[isFilled, "Enter the company address"]],
      countryCode: [[isFilled, "Select a country"]],
      city: [[isFilled, "Select a city"]],
      postCode: [[isFilled, "Enter a post code"]],
      gpsCoordinates: [[isFilled, "Enter GPS coordinates"]],
      // Countries without states (Singapore, for one) must not demand one.
      ...(hasStates
        ? { stateCode: [[isFilled, "Select a state/province"]] }
        : null),
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    goNext();
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormGrid>
        <Combobox
          label="Address Label (HQ) *"
          name="addressLabel"
          placeholder="Select address label"
          options={ADDRESS_LABEL_OPTIONS}
          value={values.addressLabel}
          onChange={(next) => {
            updateSection("address", { addressLabel: next });
            clearError("addressLabel");
          }}
          error={errors.addressLabel}
        />
        <Combobox
          label="Country *"
          name="country"
          placeholder="Select country"
          options={countryOptions}
          value={values.countryCode}
          onChange={setLocation("countryCode", ["stateCode", "city", "gpsCoordinates"])}
          error={errors.countryCode}
        />

        <Combobox
          // Until a country is chosen we cannot know whether it has states, so
          // the field reads as required and only relaxes once we do know.
          label={`State/Province ${
            !values.countryCode || hasStates ? "*" : "(Optional)"
          }`}
          name="stateProvince"
          disabled={!values.countryCode}
          placeholder={
            values.countryCode ? "Select state/province" : "Select country first"
          }
          options={stateOptions}
          value={values.stateCode}
          onChange={setLocation("stateCode", ["city", "gpsCoordinates"])}
          error={errors.stateCode}
        />
        <Combobox
          label="City *"
          name="city"
          disabled={!cityEnabled}
          creatable
          searchPlaceholder="Search or type a city…"
          emptyMessage="No matches — type to add this city"
          placeholder={
            cityEnabled
              ? "Select city"
              : values.countryCode
                ? "Select state first"
                : "Select country first"
          }
          options={cityOptions}
          value={values.city}
          maxRendered={100}
          onChange={setLocation("city", ["gpsCoordinates"])}
          error={errors.city}
        />

        <AddressAutocomplete
          label="Company Address *"
          name="companyAddress"
          placeholder="Start typing your address"
          value={values.companyAddress}
          error={errors.companyAddress}
          onChange={(next) => {
            updateSection("address", { companyAddress: next });
            clearError("companyAddress");
          }}
          onPlaceSelected={({ formattedAddress, gpsCoordinates }) => {
            // The picked building, not the centre of the city.
            updateSection("address", {
              companyAddress: formattedAddress || values.companyAddress,
              ...(gpsCoordinates ? { gpsCoordinates } : null),
            });
            clearError("companyAddress", "gpsCoordinates");
          }}
        />
        <TextField
          label="Post Code *"
          name="postCode"
          inputMode="numeric"
          placeholder="Enter post code"
          value={values.postCode}
          onChange={setField("postCode")}
          error={errors.postCode}
        />

        <TextField
          full
          label="GPS Coordinates *"
          name="gpsCoordinates"
          placeholder="e.g. 3.1390, 101.6869"
          hint="Filled in from the address you pick above — edit for a precise location."
          value={values.gpsCoordinates}
          onChange={setField("gpsCoordinates")}
          error={errors.gpsCoordinates}
        />
      </FormGrid>

      <div className="epc-form-actions">
        <Button
          type="button"
          variant="secondary"
          className="epc-form-actions__back"
          onClick={goBack}
        >
          Back
        </Button>
        <Button type="submit" grow>
          Continue
        </Button>
      </div>
    </form>
  );
}
