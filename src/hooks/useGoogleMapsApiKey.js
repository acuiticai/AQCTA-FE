import { useEffect, useState } from "react";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

/**
 * Loads the Google Maps API key from system configuration (same source as Branches settings).
 */
export default function useGoogleMapsApiKey() {
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchGoogleApiKey = async () => {
      try {
        const response = await fetch(`${BASE_URL}/configuration`);
        if (!response.ok) {
          if (!cancelled) setGoogleMapsApiKey("");
          return;
        }
        const configurations = await response.json();
        const config =
          Array.isArray(configurations) && configurations.length > 0
            ? configurations[0]
            : null;
        if (!cancelled) {
          setGoogleMapsApiKey(config?.google_api_key || "");
        }
      } catch {
        if (!cancelled) setGoogleMapsApiKey("");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchGoogleApiKey();
    return () => {
      cancelled = true;
    };
  }, []);

  return { googleMapsApiKey, loading };
}
