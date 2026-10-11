/**
 * Geocode a free-text address to lat/lng via OpenStreetMap Nominatim.
 * Tries a few query variants so noisy industrial addresses still resolve.
 * Returns { lat, lng, displayName } or null when nothing matches.
 */

const NOMINATIM_GAP_MS = 1100;

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
      },
      { once: true },
    );
  });

const searchNominatim = async (q, signal) => {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "1");

  const headers = { Accept: "application/json" };
  // Node / non-browser only — browsers forbid setting User-Agent.
  if (typeof window === "undefined") {
    headers["User-Agent"] = "AQCTA-CustomerForm/1.0";
  }

  const res = await fetch(url.toString(), { signal, headers });
  if (!res.ok) return null;

  const data = await res.json();
  const hit = Array.isArray(data) ? data[0] : null;
  if (!hit) return null;

  const lat = parseFloat(hit.lat);
  const lng = parseFloat(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    lat,
    lng,
    displayName: hit.display_name || q,
  };
};

/** Build progressively simpler queries from a full company address. */
export const buildGeocodeCandidates = (address) => {
  const q = String(address || "").trim();
  if (q.length < 3) return [];

  const candidates = [q];
  const parts = q
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const withoutUnit = q
    .replace(/^(unit|suite|lot|floor|level|no\.?)\s*[\w/-]+,?\s*/i, "")
    .trim();
  if (withoutUnit && withoutUnit !== q) candidates.push(withoutUnit);

  // Street-like token + locality tail (e.g. "Jalan SS 8/4, Petaling Jaya, Selangor")
  const streetIdx = parts.findIndex((p) =>
    /\b(jalan|jln|street|st\.?|road|rd\.?|avenue|ave\.?|lorong|lebuh)\b/i.test(
      p,
    ),
  );
  if (streetIdx >= 0 && parts.length - streetIdx >= 2) {
    const street = parts[streetIdx];
    const tail = parts.slice(-2).join(", ");
    candidates.push(`${street}, ${tail}`);
    if (parts.length >= 3) {
      candidates.push(`${street}, ${parts.slice(-3).join(", ")}`);
    }
  }

  if (parts.length > 2) {
    candidates.push(parts.slice(1).join(", "));
    candidates.push(parts.slice(-3).join(", "));
    candidates.push(parts.slice(-2).join(", "));
  }

  return [...new Set(candidates.filter((c) => c.length >= 3))];
};

export async function geocodeAddress(address, { signal } = {}) {
  const candidates = buildGeocodeCandidates(address);

  for (let i = 0; i < candidates.length; i += 1) {
    if (signal?.aborted) return null;
    if (i > 0) await sleep(NOMINATIM_GAP_MS, signal);
    try {
      const result = await searchNominatim(candidates[i], signal);
      if (result) return result;
    } catch (err) {
      if (err?.name === "AbortError") throw err;
    }
  }

  return null;
}

/** Format lat/lng the same way the customer form stores GPS. */
export const formatGpsCoordinates = (lat, lng) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  return `${lat}, ${lng}`;
};
