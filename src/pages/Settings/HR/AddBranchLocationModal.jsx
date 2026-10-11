import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { LoadScript, Autocomplete } from "@react-google-maps/api";
import ModalPortal from "@/components/ModalPortal";
import {
  DEFAULT_ATTENDANCE_RADIUS_METERS,
  metersToKmInputString,
  kmInputStringToMeters,
  getGoogleLocationCoordinateErrors,
} from "@/utils/branchLocationModalHelpers";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

export default function AddBranchLocationModal({
  isOpen,
  onClose,
  type = "Branches",
  item,
  onSubmit,
  showPrivateToggle = false,
  canSubmit = true,
  overlayClassName = "z-50",
}) {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  const [googleMapsApiKey, setGoogleMapsApiKey] = useState("");
  const locationAutocompleteRef = useRef(null);
  const coordinateEditSnapshotRef = useRef({ lat: "", lng: "" });
  const [editingCustomCoordinates, setEditingCustomCoordinates] =
    useState(false);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    _id: "",
    name: "",
    areaName: "",
    attendanceRadiusKm: metersToKmInputString(DEFAULT_ATTENDANCE_RADIUS_METERS),
    googleLocation: {
      lat: "",
      lng: "",
      placeId: "",
      formattedAddress: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
    },
    status: "Active",
    isPrivate: false,
  });

  useEffect(() => {
    const fetchGoogleApiKey = async () => {
      try {
        const response = await fetch(`${BASE_URL}/configuration`);
        if (!response.ok) {
          setGoogleMapsApiKey("");
          return;
        }
        const configurations = await response.json();
        const config =
          Array.isArray(configurations) && configurations.length > 0
            ? configurations[0]
            : null;
        setGoogleMapsApiKey(config?.google_api_key || "");
      } catch {
        setGoogleMapsApiKey("");
      }
    };
    fetchGoogleApiKey();
  }, []);

  useEffect(() => {
    if (item) {
      setFormData({
        _id: item._id || "",
        name: item.name || "",
        areaName: item.areaName || "",
        attendanceRadiusKm: metersToKmInputString(
          item.attendanceRadiusMeters != null
            ? item.attendanceRadiusMeters
            : DEFAULT_ATTENDANCE_RADIUS_METERS
        ),
        googleLocation: {
          lat:
            item.googleLocation?.lat === null || item.googleLocation?.lat === undefined
              ? ""
              : String(item.googleLocation.lat),
          lng:
            item.googleLocation?.lng === null || item.googleLocation?.lng === undefined
              ? ""
              : String(item.googleLocation.lng),
          placeId: item.googleLocation?.placeId || "",
          formattedAddress: item.googleLocation?.formattedAddress || "",
          city: item.googleLocation?.city || "",
          state: item.googleLocation?.state || "",
          country: item.googleLocation?.country || "",
          postalCode: item.googleLocation?.postalCode || "",
        },
        status: item.status || "Active",
        isPrivate: Boolean(item.isPrivate),
      });
    } else {
      setFormData({
        _id: "",
        name: "",
        areaName: "",
        attendanceRadiusKm: metersToKmInputString(
          DEFAULT_ATTENDANCE_RADIUS_METERS
        ),
        googleLocation: {
          lat: "",
          lng: "",
          placeId: "",
          formattedAddress: "",
          city: "",
          state: "",
          country: "",
          postalCode: "",
        },
        status: "Active",
        isPrivate: false,
      });
    }
    setErrors({});
    setEditingCustomCoordinates(false);
  }, [item, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleLocationChange = (e) => {
    const { name, value } = e.target;
    if (name === "formattedAddress" && errors.formattedAddress) {
      setErrors((prev) => ({ ...prev, formattedAddress: "" }));
    }
    if (
      (name === "lat" || name === "lng") &&
      (errors.coordLat || errors.coordLng)
    ) {
      setErrors((prev) => ({ ...prev, coordLat: "", coordLng: "" }));
    }
    setFormData((prevData) => ({
      ...prevData,
      googleLocation: {
        ...prevData.googleLocation,
        [name]: value,
      },
    }));
  };

  const handleGoogleLocationPlaceChanged = () => {
    const place = locationAutocompleteRef.current?.getPlace?.();
    if (!place) return;

    let detectedAreaName = "";
    const nextGoogle = {
      lat:
        typeof place.geometry?.location?.lat === "function"
          ? place.geometry.location.lat()
          : null,
      lng:
        typeof place.geometry?.location?.lng === "function"
          ? place.geometry.location.lng()
          : null,
      placeId: place.place_id || "",
      formattedAddress: place.formatted_address || "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
    };

    (place.address_components || []).forEach((component) => {
      const types = component.types || [];
      if (
        !detectedAreaName &&
        (types.includes("sublocality_level_1") ||
          types.includes("sublocality") ||
          types.includes("neighborhood") ||
          types.includes("administrative_area_level_3"))
      ) {
        detectedAreaName = component.long_name;
      }
      if (
        types.includes("locality") ||
        types.includes("postal_town") ||
        types.includes("administrative_area_level_2")
      ) {
        if (!nextGoogle.city) nextGoogle.city = component.long_name;
      } else if (types.includes("administrative_area_level_1")) {
        nextGoogle.state = component.long_name;
      } else if (types.includes("country")) {
        nextGoogle.country = component.long_name;
      } else if (types.includes("postal_code")) {
        nextGoogle.postalCode = component.long_name;
      }
    });

    setFormData((prevData) => ({
      ...prevData,
      areaName:
        prevData.areaName ||
        detectedAreaName ||
        nextGoogle.city ||
        prevData.areaName,
      googleLocation: nextGoogle,
    }));
    setErrors((prev) => ({
      ...prev,
      formattedAddress: "",
      areaName: "",
    }));
    setEditingCustomCoordinates(false);
  };

  const openCoordinateEdit = () => {
    coordinateEditSnapshotRef.current = {
      lat: String(formData.googleLocation?.lat ?? ""),
      lng: String(formData.googleLocation?.lng ?? ""),
    };
    setEditingCustomCoordinates(true);
  };

  const cancelCoordinateEdit = () => {
    const snap = coordinateEditSnapshotRef.current;
    setFormData((prev) => ({
      ...prev,
      googleLocation: {
        ...prev.googleLocation,
        lat: snap.lat,
        lng: snap.lng,
      },
    }));
    setEditingCustomCoordinates(false);
    setErrors((prev) => ({ ...prev, coordLat: "", coordLng: "" }));
  };

  const doneCoordinateEdit = () => {
    const coordErrs = getGoogleLocationCoordinateErrors(
      formData.googleLocation,
      thr
    );
    if (Object.keys(coordErrs).length > 0) {
      setErrors((prev) => ({ ...prev, ...coordErrs }));
      return;
    }
    setEditingCustomCoordinates(false);
    setErrors((prev) => ({ ...prev, coordLat: "", coordLng: "" }));
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!String(formData.name || "").trim()) {
      nextErrors.name = thr(
        "branches.branchNameRequired",
        "Branch name is required"
      );
    }
    if (!String(formData.googleLocation?.formattedAddress || "").trim()) {
      nextErrors.formattedAddress = thr(
        "branches.pleaseSearchSelectBranchLocation",
        "Please search and select branch location"
      );
    } else {
      Object.assign(
        nextErrors,
        getGoogleLocationCoordinateErrors(formData.googleLocation, thr)
      );
    }
    if (!String(formData.areaName || "").trim()) {
      nextErrors.areaName = thr(
        "branches.areaNameRequired",
        "Area name is required"
      );
    }
    const radiusKm = Number(String(formData.attendanceRadiusKm).trim());
    if (
      formData.attendanceRadiusKm === "" ||
      !Number.isFinite(radiusKm) ||
      radiusKm < 0
    ) {
      nextErrors.attendanceRadiusKm = thr(
        "branches.attendanceRadiusNonNegative",
        "Attendance radius must be a non-negative number (km)"
      );
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!validateForm()) {
      return;
    }
    const attendanceRadiusMeters = kmInputStringToMeters(
      formData.attendanceRadiusKm
    );
    onSubmit({
      ...formData,
      attendanceRadiusMeters: Number.isFinite(attendanceRadiusMeters)
        ? attendanceRadiusMeters
        : DEFAULT_ATTENDANCE_RADIUS_METERS,
    });
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <style>
        {`
          /* Google Places suggestion dropdown should stay above modal/backdrop */
          .pac-container {
            z-index: 30000 !important;
          }
        `}
      </style>
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center ${overlayClassName}`}
      >
        <div className="bg-white rounded-lg p-6 w-[400px] max-w-[90%]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">
              {item
                ? thr("branches.editBranch", "Edit Branch")
                : thr("branches.addNewBranch", "Add New Branch")}{" "}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
          <div>
            {showPrivateToggle && !item ? (
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 mb-3">
                <input
                  type="checkbox"
                  checked={Boolean(formData.isPrivate)}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      isPrivate: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-gray-300 text-[var(--p-blue)] focus:ring-[var(--p-blue)]"
                />
                {thr(
                  "branches.privateLocationToggle",
                  "Private location (only linked staff can use this)"
                )}
              </label>
            ) : null}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {thr("branches.branchName", "Branch Name")}
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-transparent ${
                errors.name ? "border-red-400 bg-red-50" : "border-gray-300"
              }`}
              required
            />
            {errors.name ? (
              <p className="mt-1 text-xs text-red-600">{errors.name}</p>
            ) : null}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {thr("branches.searchBranchLocation", "Search Branch Location")}
            </label>
            <LoadScript
              key={googleMapsApiKey || "empty-google-maps-key"}
              googleMapsApiKey={googleMapsApiKey || ""}
              libraries={["places"]}
            >
              <Autocomplete
                onLoad={(autocomplete) => {
                  locationAutocompleteRef.current = autocomplete;
                }}
                onPlaceChanged={handleGoogleLocationPlaceChanged}
              >
                <input
                  type="text"
                  value={formData.googleLocation.formattedAddress || ""}
                  onChange={(e) =>
                    handleLocationChange({
                      target: {
                        name: "formattedAddress",
                        value: e.target.value,
                      },
                    })
                  }
                  placeholder={thr(
                    "branches.searchBranchLocationPlaceholder",
                    "Search branch location"
                  )}
                  className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-transparent ${
                    errors.formattedAddress
                      ? "border-red-400 bg-red-50"
                      : "border-gray-300"
                  }`}
                />
              </Autocomplete>
            </LoadScript>
            {errors.formattedAddress ? (
              <p className="mt-1 text-xs text-red-600">
                {errors.formattedAddress}
              </p>
            ) : null}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {thr("branches.areaName", "Area Name")}
            </label>
            <input
              type="text"
              name="areaName"
              value={formData.areaName}
              onChange={handleChange}
              placeholder={thr(
                "branches.areaNamePlaceholder",
                "Auto-filled from selected location, editable"
              )}
              className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-transparent ${
                errors.areaName ? "border-red-400 bg-red-50" : "border-gray-300"
              }`}
            />
            {errors.areaName ? (
              <p className="mt-1 text-xs text-red-600">{errors.areaName}</p>
            ) : null}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {thr(
                "branches.allowedAttendanceRadiusKm",
                "Allowed Attendance Radius (km)"
              )}
            </label>
            <input
              type="number"
              min="0"
              step="any"
              name="attendanceRadiusKm"
              value={formData.attendanceRadiusKm}
              onChange={handleChange}
              placeholder={thr(
                "branches.attendanceRadiusPlaceholder",
                "e.g. 0.2"
              )}
              className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-transparent ${
                errors.attendanceRadiusKm
                  ? "border-red-400 bg-red-50"
                  : "border-gray-300"
              }`}
            />
            {errors.attendanceRadiusKm ? (
              <p className="mt-1 text-xs text-red-600">
                {errors.attendanceRadiusKm}
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-xs text-gray-500">
              {formData.googleLocation.city || formData.googleLocation.state || formData.googleLocation.country
                ? `${[
                    formData.googleLocation.city,
                    formData.googleLocation.state,
                    formData.googleLocation.country,
                  ]
                    .filter(Boolean)
                    .join(", ")}`
                : thr(
                    "branches.selectPlaceToAutoFill",
                    "Select a place to auto-fill location details."
                  )}
            </p>
            {editingCustomCoordinates ? (
              <div className="mt-2 space-y-2 rounded-lg border border-gray-200 bg-gray-50/80 p-3">
                <p className="text-xs font-medium text-gray-700">
                  {thr("branches.customCoordinates", "Custom coordinates")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="branch-lat"
                      className="block text-xs text-gray-600 mb-1"
                    >
                      {thr("branches.latitude", "Latitude")}
                    </label>
                    <input
                      id="branch-lat"
                      type="number"
                      step="any"
                      name="lat"
                      value={formData.googleLocation.lat}
                      onChange={handleLocationChange}
                      placeholder={thr("branches.latPlaceholder", "-90 to 90")}
                      className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-transparent ${
                        errors.coordLat
                          ? "border-red-400 bg-red-50"
                          : "border-gray-300"
                      }`}
                    />
                    {errors.coordLat ? (
                      <p className="mt-1 text-xs text-red-600">{errors.coordLat}</p>
                    ) : null}
                  </div>
                  <div>
                    <label
                      htmlFor="branch-lng"
                      className="block text-xs text-gray-600 mb-1"
                    >
                      {thr("branches.longitude", "Longitude")}
                    </label>
                    <input
                      id="branch-lng"
                      type="number"
                      step="any"
                      name="lng"
                      value={formData.googleLocation.lng}
                      onChange={handleLocationChange}
                      placeholder={thr(
                        "branches.lngPlaceholder",
                        "-180 to 180"
                      )}
                      className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-transparent ${
                        errors.coordLng
                          ? "border-red-400 bg-red-50"
                          : "border-gray-300"
                      }`}
                    />
                    {errors.coordLng ? (
                      <p className="mt-1 text-xs text-red-600">{errors.coordLng}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={cancelCoordinateEdit}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    {thr("cancel", "Cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={doneCoordinateEdit}
                    className="text-xs px-3 py-1.5 rounded-lg text-white hover:opacity-90"
                    style={{ backgroundColor: "var(--p-blue)" }}
                  >
                    {thr("done", "Done")}
                  </button>
                </div>
              </div>
            ) : formData.googleLocation.lat !== "" &&
              formData.googleLocation.lng !== "" &&
              formData.googleLocation.lat != null &&
              formData.googleLocation.lng != null &&
              Number.isFinite(Number(formData.googleLocation.lat)) &&
              Number.isFinite(Number(formData.googleLocation.lng)) ? (
              <p className="text-[11px] text-gray-400 mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span>
                  {thr("branches.coordinatesLabel", "Coordinates: {{latitude}}, {{longitude}}", {
                    latitude: formData.googleLocation.lat,
                    longitude: formData.googleLocation.lng,
                  })}
                </span>
                <button
                  type="button"
                  onClick={openCoordinateEdit}
                  className="text-[11px] font-medium bg-transparent border-0 p-0 cursor-pointer hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:ring-offset-1 rounded"
                  style={{ color: "var(--p-blue)" }}
                >
                  {thr("editQuestion", "Edit?")}
                </button>
              </p>
            ) : null}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--p-blue)" }}
              disabled={!canSubmit}
            >
              {item
                ? thr("branches.updateBranches", "Update Branches")
                : thr("branches.addBranches", "Add Branches")}
            </button>
          </div>
        </div>
        </div>
      </div>
    </ModalPortal>
  );
}
