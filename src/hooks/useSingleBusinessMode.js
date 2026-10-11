import { useEffect, useMemo, useState } from "react";
import {
  readAssignedBusinessesFallback,
  syncAssignedBusinessesFromApi,
} from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

function getBusinessId(business) {
  return business?._id || business?.id || null;
}

/**
 * Single-business UI mode for PCI/AQCTA:
 * when only one assigned business exists, hide business pickers and auto-use that id.
 */
export default function useSingleBusinessMode({ autoSync = true } = {}) {
  const [businesses, setBusinesses] = useState(() =>
    readAssignedBusinessesFallback()
  );

  useEffect(() => {
    if (!autoSync) return undefined;
    let cancelled = false;
    (async () => {
      const list = await syncAssignedBusinessesFromApi(Base_URL);
      if (!cancelled) setBusinesses(Array.isArray(list) ? list : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [autoSync]);

  const isSingleBusiness = businesses.length === 1;
  const singleBusinessId = useMemo(
    () => (isSingleBusiness ? getBusinessId(businesses[0]) : null),
    [isSingleBusiness, businesses]
  );

  return {
    businesses,
    isSingleBusiness,
    singleBusinessId,
  };
}
