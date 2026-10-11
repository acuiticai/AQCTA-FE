import React, { useState, useEffect, useMemo, useContext } from "react";
import axios from "axios";
import { useHistory } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import { hasPathPermission, PERMISSION_ACTION } from "@/utils/permissionUtils";
import { DataTable, Button, BackButton } from "@/page-layouts";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import { syncAssignedBusinessesFromApi } from "@/utils/sessionAssignedBusinesses";
import { useTranslation } from "react-i18next";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const vendorLabel = (vendor, unnamedVendor) =>
  vendor?.basicInformation?.vendorDisplayName ||
  vendor?.basicInformation?.companyName ||
  unnamedVendor;

const PurchasePlanningScreen = () => {
  const { t } = useTranslation();
  const checkTokenExpired = useCheckTokenExpired();
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const canAddPurchaseOrder = hasPathPermission(
    adminInfo?.role?.modules,
    "/purchase-orders/create",
    PERMISSION_ACTION.ADD,
  ) || adminInfo?.role?.isSuperAdmin === true;

  const [businesses, setBusinesses] = useState([]);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [selectedBusinesses, setSelectedBusinesses] = useState([]); // multi-select

  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [needsReorderOnly, setNeedsReorderOnly] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const tWithFallback = (key, fallback) => {
    const translated = t(key, { defaultValue: fallback });
    return translated && translated !== key ? translated : fallback;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await syncAssignedBusinessesFromApi(Base_URL);
      if (cancelled) return;
      setBusinesses(list);
      setBusinessesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchReport = async () => {
    const params = {
      needsReorderOnly: needsReorderOnly ? "true" : "false",
    };

    if (selectedBusinesses.length > 0) {
      params.businessIds = selectedBusinesses.join(",");
    } else {
      const assignedIds = businesses.map((b) => b._id).filter(Boolean);
      if (assignedIds.length === 0) {
        setReport([]);
        return;
      }
      if (assignedIds.length === 1) {
        params.businessId = assignedIds[0];
      } else {
        params.businessIds = assignedIds.join(",");
      }
    }

    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${Base_URL}/purchase-planning`, {
        headers,
        params,
      });
      if (checkTokenExpired(response)) return;
      setReport(response.data?.data || []);
    } catch (err) {
      console.error("Error fetching purchase planning report:", err);
      setError(
        tWithFallback(
          "purchasePlanning.messages.fetchFailed",
          "Failed to fetch purchase planning data.",
        ),
      );
      setReport([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessesLoading) return;
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessesLoading, businesses, selectedBusinesses, needsReorderOnly]);

  const filteredReport = useMemo(() => {
    if (!searchTerm.trim()) return report;
    const re = new RegExp(searchTerm.trim(), "i");
    return report.filter((row) => re.test(row.name || ""));
  }, [report, searchTerm]);

  // Group items needing reorder by their preferred vendor (per business), for "Create PO"
  const vendorGroups = useMemo(() => {
    const groups = new Map();
    for (const row of report) {
      if (!row.needsReorder || !row.preferredVendor?._id || !row.business?._id)
        continue;
      const key = `${row.business._id}_${row.preferredVendor._id}`;
      if (!groups.has(key)) {
        groups.set(key, {
          vendor: row.preferredVendor,
          business: row.business,
          rows: [],
        });
      }
      groups.get(key).rows.push(row);
    }
    return Array.from(groups.values());
  }, [report]);

  const itemsNeedingVendor = useMemo(
    () => report.filter((row) => row.needsReorder && !row.preferredVendor?._id),
    [report],
  );

  const handleCreatePO = (group) => {
    history.push("/purchase-orders/create", {
      business: group.business._id,
      customer: group.vendor._id,
      items: group.rows.map((row) => ({
        itemId: row._id,
        itemName: row.name,
        description: row.name,
        quantity: row.suggestedOrderQty || 1,
        rate: row.costPrice || 0,
      })),
    });
  };

  const tableHeaders = [
    tWithFallback("purchasePlanning.item", "Item"),
    t("Business"),
    tWithFallback("purchasePlanning.unit", "Unit"),
    tWithFallback("purchasePlanning.currentStock", "Current Stock"),
    tWithFallback("purchasePlanning.reorderLevel", "Min"),
    tWithFallback("purchasePlanning.maxStock", "Max"),
    tWithFallback("purchasePlanning.reorderQty", "Fixed Qty"),
    tWithFallback("purchasePlanning.suggestedOrderQty", "Suggested Order Qty"),
    tWithFallback("purchasePlanning.preferredVendor", "Preferred Vendor"),
    t("Status"),
  ];

  const handleSearch = (value) => {
    setSearchTerm(value ? value.trim() : "");
  };

  const handleBusinessChange = (ids) => {
    setSelectedBusinesses(Array.isArray(ids) ? ids : []);
  };

  const clearAllFilters = () => {
    setSelectedBusinesses([]);
    setNeedsReorderOnly(true);
    setSearchTerm("");
  };

  const filters = [
    {
      isClearButton: true,
      buttonProps: {
        onClick: clearAllFilters,
      },
    },
    {
      isBusinessDropdown: true,
      businessDropdownProps: {
        selectionMode: "multiple",
        selectedBusinesses,
        onChange: handleBusinessChange,
        placeholder: t("item.selectBusinesses"),
      },
    },
    {
      isCheckbox: true,
      checked: needsReorderOnly,
      onChange: (value) => setNeedsReorderOnly(Boolean(value)),
      label: tWithFallback(
        "purchasePlanning.needsReorderOnly",
        "Needs reorder only",
      ),
    },
  ];

  return (
    <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0 overflow-x-hidden">
        <div className="mb-8">
          <BackButton
            onClick={() => history.push("/items")}
            fallbackPath="/items"
            className="mb-4 !mt-0"
          />
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {t("item.purchasePlanning")}
              </h1>
              <p className="text-gray-600 mt-2">
                {tWithFallback(
                  "purchasePlanning.description",
                  "Raw material stock levels and reorder suggestions based on consumption tracked through recipes.",
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:gap-4 shrink-0">
              <button
                type="button"
                onClick={() => history.push("/reordering-rules")}
                className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Reordering Rules
              </button>
              <button
                type="button"
                onClick={() => history.push("/recipes")}
                className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {t("item.recipes")}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-w-0 max-w-full overflow-hidden mb-6">
          <DataTable
            onSearch={handleSearch}
            searchValue={searchTerm}
            searchPlaceholder={tWithFallback(
              "purchasePlanning.searchPlaceholder",
              "Search by item name",
            )}
            filters={filters}
            loading={loading || businessesLoading}
            headers={tableHeaders}
            data={filteredReport}
            noPagination
            tableError={error}
            emptyMessage={tWithFallback(
              "purchasePlanning.emptyMessage",
              "No raw materials need reordering right now.",
            )}
            renderRow={(row) => (
              <tr
                key={row.ruleId || `${row._id}-${row.warehouse?._id || "co"}`}
                className="border-b"
                style={{ fontSize: "12px", fontWeight: "400" }}
              >
                <td className="py-2 px-4" style={{ fontSize: "14px", fontWeight: "400" }}>
                  {row.name}
                  {row.warehouse?.name || row.location?.name ? (
                    <div className="text-xs text-gray-500">
                      {[row.warehouse?.name, row.location?.name]
                        .filter(Boolean)
                        .join(" / ")}
                    </div>
                  ) : null}
                </td>
                <td className="py-2 px-4" style={{ fontSize: "14px", fontWeight: "400" }}>
                  {row.business?.name || "-"}
                </td>
                <td className="py-2 px-4" style={{ fontSize: "14px", fontWeight: "400" }}>
                  {row.unit || "-"}
                </td>
                <td className="py-2 px-4" style={{ fontSize: "14px", fontWeight: "400" }}>
                  {row.currentStock}
                </td>
                <td className="py-2 px-4" style={{ fontSize: "14px", fontWeight: "400" }}>
                  {row.reorderLevel}
                </td>
                <td className="py-2 px-4" style={{ fontSize: "14px", fontWeight: "400" }}>
                  {row.maxStock ?? 0}
                </td>
                <td className="py-2 px-4" style={{ fontSize: "14px", fontWeight: "400" }}>
                  {row.reorderQty}
                </td>
                <td className="py-2 px-4" style={{ fontSize: "14px", fontWeight: "400" }}>
                  {row.suggestedOrderQty}
                </td>
                <td className="py-2 px-4" style={{ fontSize: "14px", fontWeight: "400" }}>
                  {!row.preferredVendor
                    ? "-"
                    : vendorLabel(
                        row.preferredVendor,
                        tWithFallback(
                          "purchasePlanning.unnamedVendor",
                          "Unnamed Vendor",
                        ),
                      )}
                </td>
                <td className="py-2 px-4">
                  <span
                    className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      row.needsReorder
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {row.needsReorder
                      ? tWithFallback(
                          "purchasePlanning.needsReorder",
                          "Needs Reorder",
                        )
                      : tWithFallback("purchasePlanning.ok", "OK")}
                  </span>
                </td>
              </tr>
            )}
          />
        </div>

        {(vendorGroups.length > 0 || itemsNeedingVendor.length > 0) && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {tWithFallback(
                "purchasePlanning.createPurchaseOrders",
                "Create Purchase Orders",
              )}
            </h2>
            <div className="space-y-3">
              {vendorGroups.map((group) => (
                <div
                  key={`${group.business._id}_${group.vendor._id}`}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-gray-200 rounded-lg p-4"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {vendorLabel(
                        group.vendor,
                        tWithFallback(
                          "purchasePlanning.unnamedVendor",
                          "Unnamed Vendor",
                        ),
                      )}{" "}
                      <span className="text-sm font-normal text-gray-500">
                        ({group.business?.name})
                      </span>
                    </p>
                    <p className="text-sm text-gray-600">
                      {group.rows.map((r) => r.name).join(", ")}
                    </p>
                  </div>
                  {canAddPurchaseOrder && (
                    <Button onClick={() => handleCreatePO(group)}>
                      {tWithFallback("purchasePlanning.createPO", "Create PO")}
                    </Button>
                  )}
                </div>
              ))}

              {itemsNeedingVendor.length > 0 && (
                <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
                  <p className="font-medium text-amber-800">
                    {tWithFallback(
                      "purchasePlanning.noPreferredVendor",
                      "No preferred vendor set",
                    )}
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    {tWithFallback(
                      "purchasePlanning.setPreferredVendorHint",
                      "{{items}} — set a preferred vendor on these items to include them in a \"Create PO\" suggestion.",
                    ).replace(
                      "{{items}}",
                      itemsNeedingVendor.map((r) => r.name).join(", "),
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PurchasePlanningScreen;
