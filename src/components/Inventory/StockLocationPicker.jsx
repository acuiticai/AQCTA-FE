import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { DropdownBasic } from "@/page-layouts/index";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/**
 * Warehouse + Location pickers for receive/delivery stock moves.
 */
const StockLocationPicker = ({
  businessId,
  headers,
  warehouseId,
  locationId,
  onWarehouseChange,
  onLocationChange,
  receiveMode = true,
  title,
  description,
  hideLocation = false,
  disabled = false,
}) => {
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loadingWh, setLoadingWh] = useState(false);
  const [loadingLoc, setLoadingLoc] = useState(false);

  useEffect(() => {
    if (!businessId) {
      setWarehouses([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingWh(true);
      try {
        const res = await axios.get(`${Base_URL}/warehouses`, {
          headers,
          params: { businessId, status: "Active", limit: 100 },
        });
        if (!cancelled) {
          const list = res.data?.data || [];
          setWarehouses(list);
          if (!warehouseId && list.length === 1) {
            onWarehouseChange?.(list[0]._id);
          } else if (!warehouseId) {
            const def = list.find((w) => w.isDefault) || list[0];
            if (def) onWarehouseChange?.(def._id);
          }
        }
      } catch (_) {
        if (!cancelled) setWarehouses([]);
      } finally {
        if (!cancelled) setLoadingWh(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, headers]);

  useEffect(() => {
    if (!warehouseId) {
      setLocations([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingLoc(true);
      try {
        const res = await axios.get(`${Base_URL}/locations`, {
          headers,
          params: { warehouseId, storeableOnly: "true" },
        });
        if (!cancelled) {
          const list = res.data?.data || [];
          setLocations(list);
          if (!locationId && list.length === 1) {
            onLocationChange?.(list[0]._id);
          } else if (!locationId && list.length > 0) {
            onLocationChange?.(list[0]._id);
          }
        }
      } catch (_) {
        if (!cancelled) setLocations([]);
      } finally {
        if (!cancelled) setLoadingLoc(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId, headers]);

  const warehouseOptions = useMemo(
    () =>
      warehouses.map((w) => ({
        value: w._id,
        label: `${w.name} (${w.code})`,
      })),
    [warehouses],
  );

  const locationOptions = useMemo(
    () =>
      locations.map((l) => ({
        value: l._id,
        label: `${l.code} — ${l.name}${l.storageKind ? ` (${l.storageKind})` : ""}`,
      })),
    [locations],
  );

  return (
    <div className="mb-4 p-4 bg-orange-50 border border-orange-100 rounded-lg space-y-3">
      <p className="text-sm font-medium text-gray-800">
        {title ||
          (receiveMode
            ? "Receive stock into location"
            : "Deliver stock from location")}
      </p>
      <p className="text-xs text-gray-600">
        {description ||
          (receiveMode
            ? "Stock will increase at the location you pick (and on the item total)."
            : "Stock will decrease from the location you pick (and on the item total).")}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Warehouse *
          </label>
          <DropdownBasic
            options={warehouseOptions}
            value={warehouseId || ""}
            onChange={(v) => {
              onWarehouseChange?.(v || "");
              onLocationChange?.("");
            }}
            isClearable={false}
            placeholder={
              loadingWh
                ? "Loading…"
                : businessId
                  ? warehouseOptions.length
                    ? "Select warehouse"
                    : "No warehouse — create one first"
                  : "No business on order"
            }
            isDisabled={!businessId || loadingWh || disabled}
          />
        </div>
        {!hideLocation && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Location *
          </label>
          <DropdownBasic
            options={locationOptions}
            value={locationId || ""}
            onChange={(v) => onLocationChange?.(v || "")}
            isClearable={false}
            placeholder={
              loadingLoc
                ? "Loading…"
                : warehouseId
                  ? locationOptions.length
                    ? "Select rack / shelf / bin"
                    : "No location — add under Locations"
                  : "Select warehouse first"
            }
            isDisabled={!warehouseId || loadingLoc || disabled}
          />
        </div>
        )}
      </div>
    </div>
  );
};

export default StockLocationPicker;
