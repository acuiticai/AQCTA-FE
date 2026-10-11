/** Display labels for fleet “vehicle type” / “vehicle” concepts; stored in fleet schedule settings. */

/** Fired on `window` after custom fleet labels are saved (so Settings UIs can refresh). */
export const FLEET_TERMINOLOGY_CHANGED_EVENT = "flexa-fleet-terminology-updated";

export function broadcastFleetTerminologyChange(businessId) {
  if (typeof window === "undefined" || !businessId) return;
  window.dispatchEvent(
    new CustomEvent(FLEET_TERMINOLOGY_CHANGED_EVENT, { detail: { businessId: String(businessId) } }),
  );
}

export const DEFAULT_FLEET_TERMINOLOGY = {
  vehicleTypeLabelSingular: "Vehicle type",
  vehicleTypeLabelPlural: "Vehicle types",
  vehicleLabelSingular: "Vehicle",
  vehicleLabelPlural: "Vehicles",
};

const MAX_LEN = 64;

export function normalizeFleetTerminology(data) {
  const d = data || {};
  const clip = (v, fallback) => {
    const s = typeof v === "string" ? v.trim() : "";
    if (!s) return fallback;
    return s.slice(0, MAX_LEN);
  };
  return {
    vehicleTypeLabelSingular: clip(
      d.vehicleTypeLabelSingular,
      DEFAULT_FLEET_TERMINOLOGY.vehicleTypeLabelSingular,
    ),
    vehicleTypeLabelPlural: clip(
      d.vehicleTypeLabelPlural,
      DEFAULT_FLEET_TERMINOLOGY.vehicleTypeLabelPlural,
    ),
    vehicleLabelSingular: clip(d.vehicleLabelSingular, DEFAULT_FLEET_TERMINOLOGY.vehicleLabelSingular),
    vehicleLabelPlural: clip(d.vehicleLabelPlural, DEFAULT_FLEET_TERMINOLOGY.vehicleLabelPlural),
  };
}
