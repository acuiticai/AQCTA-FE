export const DEFAULT_ATTENDANCE_RADIUS_METERS = 200;

/** Display stored meters as km in the branch form (6 dp max to limit float noise). */
export function metersToKmInputString(meters) {
  const m = Number(meters);
  if (!Number.isFinite(m) || m < 0) {
    return String(DEFAULT_ATTENDANCE_RADIUS_METERS / 1000);
  }
  return String(Math.round((m / 1000) * 1e6) / 1e6);
}

export function kmInputStringToMeters(kmStr) {
  const n = Number(String(kmStr).trim());
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 1000);
}

/**
 * @param {object} googleLocation
 * @param {(key: string, fallback: string) => string} [thr] Optional translator for
 *   settingsPage.hr.branches.* keys (latitudeRequired, longitudeRequired, etc.)
 */
export function getGoogleLocationCoordinateErrors(googleLocation, thr) {
  const translate = (key, fallback) =>
    typeof thr === "function" ? thr(key, fallback) : fallback;
  const next = {};
  if (!googleLocation) return next;
  const latStr = String(googleLocation.lat ?? "").trim();
  const lngStr = String(googleLocation.lng ?? "").trim();
  if (latStr === "") {
    next.coordLat = translate(
      "branches.latitudeRequired",
      "Latitude is required."
    );
  }
  if (lngStr === "") {
    next.coordLng = translate(
      "branches.longitudeRequired",
      "Longitude is required."
    );
  }
  if (latStr === "" || lngStr === "") {
    return next;
  }
  const latN = Number(latStr);
  const lngN = Number(lngStr);
  if (!Number.isFinite(latN) || latN < -90 || latN > 90) {
    next.coordLat = translate(
      "branches.latitudeRange",
      "Latitude must be a number between -90 and 90."
    );
  }
  if (!Number.isFinite(lngN) || lngN < -180 || lngN > 180) {
    next.coordLng = translate(
      "branches.longitudeRange",
      "Longitude must be a number between -180 and 180."
    );
  }
  return next;
}
