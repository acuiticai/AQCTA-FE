import React from "react";
import { useTranslation } from "react-i18next";
import { X, Plus, AlertCircle } from "lucide-react";
import SearchableDropdown from "@/components/SearchableDropdown";
import ItemPickOrTypeField from "@/components/invoice/ItemPickOrTypeField";
import {
  getLineSubtotal,
  getItemTotal,
  clampDiscountPercent,
  sumLineTaxAmountsFromItems,
} from "@/utils/itemDiscountUtils";
import AddTaxButton from "@/components/taxes/AddTaxButton";
import { formatCurrencyAmount } from "@/components/formatAmount";

/**
 * Width in `ch` for numeric line inputs / amount (Quick add).
 * Inputs use horizontal padding; with border-box, small `ch` values clip large numbers (e.g. 10000) unless pad accounts for that.
 */
function inputWidthCh(value, { min = 10, max = 40, pad = 8 } = {}) {
  const n = String(value ?? "");
  return `${Math.min(max, Math.max(min, n.length + pad))}ch`;
}

function formatLineCustomFieldDisplay(def, raw, t) {
  if (raw === null || raw === undefined || raw === "") return "—";
  if (def.data_type === "checkbox") {
    return raw
      ? t?.("documents.itemTable.yes") || "Yes"
      : t?.("documents.itemTable.no") || "No";
  }
  if (def.data_type === "multi_select" && Array.isArray(raw)) return raw.join(", ");
  return String(raw);
}

function LineItemCustomFieldInput({ def, value, disabled, onChange, error, t }) {
  /* Match quantity / rate / description row inputs: py-2, rounded-md, focus ring-1 */
  const baseInput =
    "w-full min-w-0 px-3 py-2 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]";
  const errClass = error ? "border-red-300" : "";
  const ph = def.input_format != null ? String(def.input_format) : "";

  if (def.data_type === "checkbox") {
    return (
      <input
        type="checkbox"
        checked={!!value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300"
      />
    );
  }

  if (def.data_type === "dropdown") {
    return (
      <select
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${baseInput} ${errClass}`}
      >
        <option value="">{ph.trim() || "—"}</option>
        {(def.options || []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (def.data_type === "multi_line_text" || def.data_type === "formula") {
    return (
      <textarea
        value={value ?? ""}
        disabled={disabled}
        rows={2}
        placeholder={ph}
        onChange={(e) => onChange(e.target.value)}
        className={`${baseInput} resize-y min-h-[2.5rem] ${errClass}`}
      />
    );
  }

  if (def.data_type === "date") {
    const v =
      typeof value === "string" && value.length >= 10 ? value.slice(0, 10) : value || "";
    return (
      <input
        type="date"
        value={v}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${baseInput} ${errClass}`}
      />
    );
  }

  if (def.data_type === "datetime") {
    return (
      <input
        type="datetime-local"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${baseInput} ${errClass}`}
      />
    );
  }

  if (
    def.data_type === "number" ||
    def.data_type === "decimal" ||
    def.data_type === "currency" ||
    def.data_type === "percentage"
  ) {
    return (
      <input
        type="number"
        step={def.data_type === "number" ? "1" : "0.01"}
        value={value === null || value === undefined ? "" : value}
        disabled={disabled}
        placeholder={ph}
        onChange={(e) => {
          const r = e.target.value;
          onChange(r === "" ? "" : Number(r));
        }}
        className={`${baseInput} text-right ${errClass}`}
      />
    );
  }

  if (def.data_type === "multi_select") {
    const strVal = Array.isArray(value) ? value.join(", ") : value ?? "";
    return (
      <input
        type="text"
        value={strVal}
        disabled={disabled}
        placeholder={ph || t("documents.itemTable.commaSeparated")}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
        className={`${baseInput} ${errClass}`}
      />
    );
  }

  const inputType =
    def.data_type === "email"
      ? "email"
      : def.data_type === "url"
        ? "url"
        : def.data_type === "phone"
          ? "tel"
          : "text";

  return (
    <input
      type={inputType}
      value={value ?? ""}
      disabled={disabled}
      placeholder={ph}
      onChange={(e) => onChange(e.target.value)}
      className={`${baseInput} ${errClass}`}
    />
  );
}

const ZohoStyleItemTable = ({
  invoiceData,
  setInvoiceData,
  selectedContract,
  expenseAccounts = [],
  currency = "USD",
  onOpenAddItemModal,
  onRemoveItem,
  onItemChange,
  errors = {},
  businessItems = [],
  taxes = [],
  onBulkAdd,
  stockWarnings = {},
  isEditMode = false,
  businessId,
  headers,
  onTaxCreated,
  /** @type {"sales"|"purchase"} — purchase: PO / cost + purchase tax (default sales: invoices & sales orders) */
  pricingMode = "sales",
  /** Items › Items custom field definitions to show as extra columns (per line). */
  lineItemCustomFieldDefinitions = [],
  /** Widen qty / rate / discount / amount with typed value (e.g. non-maximized Quick add). */
  fitNumericColumns = false,
}) => {
  const { t } = useTranslation();
  const isPurchase = pricingMode === "purchase";
  const items = invoiceData.items || [];
  const lineCfDefs = lineItemCustomFieldDefinitions || [];
  const lineCfCount = lineCfDefs.length;

  const defaultUnitPriceFromItem = (product) => {
    if (!product) return 0;
    if (isPurchase) {
      return (
        product.purchaseInformation?.costPrice ??
        product.salesInformation?.sellingPrice ??
        0
      );
    }
    return (
      product.salesInformation?.sellingPrice ??
      product.purchaseInformation?.costPrice ??
      0
    );
  };
  const defaultTaxOnItemFromProduct = (product) => {
    if (!product) return undefined;
    if (isPurchase) {
      return (
        product.purchaseInformation?.taxOnItem ||
        product.salesInformation?.taxOnItem
      );
    }
    return (
      product.salesInformation?.taxOnItem ||
      product.purchaseInformation?.taxOnItem
    );
  };
  const defaultDescriptionFromProduct = (product) => {
    if (!product) return "";
    if (isPurchase) {
      return (
        product.purchaseInformation?.description ||
        product.salesInformation?.description ||
        ""
      );
    }
    return (
      product.salesInformation?.description ||
      product.purchaseInformation?.description ||
      ""
    );
  };

  // Add empty row (keep existing behavior)
  const handleAddRow = () => {
    const newItem = {
      id: items.length + 1,
      quantity: 1,
      description: "",
      itemName: "", // Item name from product (dropdown); description is separate
      unitPrice: 0,
      discount: 0,
      taxRate: 0, // Initialize tax rate to allow manual entry
      taxId: "",
      taxName: "",
      total: 0,
      lineItemCustomFields: {},
    };
    const nextItems = [...items, newItem];
    const subtotal = nextItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const taxTotal = sumLineTaxAmountsFromItems(nextItems);
    const discountAmount =
      (subtotal * (invoiceData.discountPercentage || 0)) / 100;
    const total = Math.max(
      0,
      subtotal -
        discountAmount +
        (invoiceData.shippingCharges || 0) +
        (invoiceData.adjustment || 0)
    );
    setInvoiceData({
      ...invoiceData,
      items: nextItems,
      subtotal,
      taxTotal,
      discountAmount,
      total,
    });
  };

  const handleRemoveItem = (index) => {
    if (items[index]?.isAdvancePayment) {
      return; // Don't allow removal of advance payment items
    }
    if (onRemoveItem) {
      onRemoveItem(index);
    } else {
      const updatedItems = items.filter((_, i) => i !== index);
      const subtotal = updatedItems.reduce(
        (sum, item) => sum + (item.total || 0),
        0
      );
      const taxTotal = sumLineTaxAmountsFromItems(updatedItems);
      const discountAmount = (subtotal * (invoiceData.discountPercentage || 0)) / 100;
      const total = Math.max(
        0,
        subtotal - discountAmount + (invoiceData.shippingCharges || 0) + (invoiceData.adjustment || 0)
      );
      setInvoiceData({
        ...invoiceData,
        items: updatedItems,
        subtotal,
        taxTotal,
        discountAmount,
        total,
      });
    }
  };

  const handleItemChange = (index, field, value) => {
    if (
      field === "lineItemCustomFields" &&
      value &&
      typeof value === "object" &&
      Object.prototype.hasOwnProperty.call(value, "key")
    ) {
      if (items[index]?.isAdvancePayment) return;
      const cfKey = value.key;
      const cfVal = value.value;
      if (onItemChange) {
        onItemChange(index, field, { key: cfKey, value: cfVal });
      } else {
        setInvoiceData((prev) => {
          const prevItems = prev.items || [];
          const updatedItems = [...prevItems];
          const row = updatedItems[index] || {};
          updatedItems[index] = {
            ...row,
            lineItemCustomFields: {
              ...(row.lineItemCustomFields || {}),
              [cfKey]: cfVal,
            },
          };
          return { ...prev, items: updatedItems };
        });
      }
      return;
    }

    if (items[index]?.isAdvancePayment && field !== "expenseAccount") {
      return; // Don't allow editing of advance payment items
    }

    if (onItemChange) {
      onItemChange(index, field, value);
    } else {
      setInvoiceData((prev) => {
        const prevItems = prev.items || [];
        const updatedItems = [...prevItems];
        let sanitizedValue = value;

        if (field === "quantity" || field === "unitPrice" || field === "taxRate") {
          sanitizedValue = parseFloat(value) || 0;
          if (sanitizedValue < 0) sanitizedValue = 0;
        }
        if (field === "discount") {
          sanitizedValue = clampDiscountPercent(value);
        }

        updatedItems[index] = {
          ...updatedItems[index],
          [field]: sanitizedValue,
        };

        if (field === "quantity" || field === "unitPrice" || field === "discount" || field === "taxRate") {
          const quantity = parseFloat(updatedItems[index].quantity) || 1;
          const unitPrice = parseFloat(updatedItems[index].unitPrice) || 0;
          const discount = parseFloat(updatedItems[index].discount) || 0;
          const taxRate = parseFloat(updatedItems[index].taxRate) || 0;
          updatedItems[index].total = getItemTotal(quantity, unitPrice, discount, taxRate);
        }

        const subtotal = updatedItems.reduce(
          (sum, item) => sum + (item.total || 0),
          0
        );
        const taxTotal = sumLineTaxAmountsFromItems(updatedItems);
        const discountAmount = (subtotal * (prev.discountPercentage || 0)) / 100;
        const total = Math.max(
          0,
          subtotal - discountAmount + (prev.shippingCharges || 0) + (prev.adjustment || 0)
        );

        return {
          ...prev,
          items: updatedItems,
          subtotal,
          taxTotal,
          discountAmount,
          total,
        };
      });
    }
  };

  const handleTaxRateInputChange = (index, rawValue) => {
    let numeric = parseFloat(rawValue);
    if (isNaN(numeric)) numeric = 0;
    if (numeric < 0) numeric = 0;
    if (numeric > 100) numeric = 100;

    if (onItemChange) {
      onItemChange(index, "taxRate", numeric);
    } else {
      handleItemChange(index, "taxRate", numeric);
    }
  };

  /** Pick from catalog (merge duplicates, autofill) or full clear when `selectedItem` is null. */
  const applyBusinessItemToLine = (index, selectedItem) => {
    if (!selectedItem) {
      if (onItemChange) {
        onItemChange(index, "itemId", "");
        onItemChange(index, "itemName", "");
        onItemChange(index, "description", "");
        onItemChange(index, "unitPrice", 0);
        onItemChange(index, "unit", "");
        onItemChange(index, "quantity", 1);
        onItemChange(index, "discount", 0);
        onItemChange(index, "taxId", "");
        onItemChange(index, "taxRate", 0);
        onItemChange(index, "taxName", "");
      } else {
        handleItemChange(index, "itemId", "");
        handleItemChange(index, "itemName", "");
        handleItemChange(index, "description", "");
        handleItemChange(index, "unitPrice", 0);
        handleItemChange(index, "unit", "");
        handleItemChange(index, "quantity", 1);
        handleItemChange(index, "discount", 0);
        handleItemChange(index, "taxId", "");
        handleItemChange(index, "taxRate", 0);
        handleItemChange(index, "taxName", "");
      }
      return;
    }

    const selectedIdStr = String(selectedItem._id);
    const existingIndex = items.findIndex(
      (it, i) =>
        i !== index &&
        !it.isAdvancePayment &&
        (String(it.itemId) === selectedIdStr ||
          (it.itemName &&
            selectedItem.name &&
            String(it.itemName).trim() === String(selectedItem.name).trim()) ||
          (it.description &&
            selectedItem.name &&
            String(it.description).trim() === String(selectedItem.name).trim())),
    );
    if (existingIndex >= 0) {
      const currentQty = parseFloat(items[index].quantity) || 1;
      const existingQty = parseFloat(items[existingIndex].quantity) || 1;
      const newQty = existingQty + currentQty;
      const existing = items[existingIndex];
      const unitPrice = parseFloat(existing.unitPrice) || 0;
      const discount = parseFloat(existing.discount) || 0;
      const taxRate = parseFloat(existing.taxRate) || 0;
      const lineSubtotal = getLineSubtotal(newQty, unitPrice, discount);
      const taxAmount = (lineSubtotal * taxRate) / 100;
      const lineTotal = Math.max(0, lineSubtotal + taxAmount);
      const updatedExisting = {
        ...existing,
        quantity: newQty,
        total: lineTotal,
        lineItemCustomFields: {
          ...(existing.lineItemCustomFields || {}),
          ...(items[index]?.lineItemCustomFields || {}),
        },
      };
      const itemsWithoutCurrent = items
        .map((it, i) => (i === existingIndex ? updatedExisting : it))
        .filter((_, i) => i !== index);
      const subtotal = itemsWithoutCurrent.reduce((sum, row) => sum + (row.total || 0), 0);
      const taxTotal = sumLineTaxAmountsFromItems(itemsWithoutCurrent);
      const discountAmount =
        (subtotal * (invoiceData.discountPercentage || 0)) / 100;
      const total = Math.max(
        0,
        subtotal -
          discountAmount +
          (invoiceData.shippingCharges || 0) +
          (invoiceData.adjustment || 0),
      );
      setInvoiceData({
        ...invoiceData,
        items: itemsWithoutCurrent,
        subtotal,
        taxTotal,
        discountAmount,
        total,
      });
      return;
    }

    const lineUnitPrice = defaultUnitPriceFromItem(selectedItem) || 0;
    const taxOnItem = defaultTaxOnItemFromProduct(selectedItem);
    const taxId = taxOnItem?._id || "";
    const taxRate = taxOnItem?.rate ?? taxOnItem?.percentage ?? 0;
    const taxName = taxOnItem?.name || "";

    if (onItemChange) {
      onItemChange(index, "itemId", selectedItem._id);
      onItemChange(index, "itemName", selectedItem.name || "");
      onItemChange(index, "description", defaultDescriptionFromProduct(selectedItem));
      onItemChange(index, "unitPrice", lineUnitPrice);
      onItemChange(index, "unit", selectedItem.unit || "");
      onItemChange(index, "quantity", 1);
      onItemChange(index, "discount", 0);
      onItemChange(index, "taxId", taxId);
      onItemChange(index, "taxRate", taxRate);
      onItemChange(index, "taxName", taxName);
    } else {
      const updatedItems = [...items];
      const qty = 1;
      const disc = 0;
      const unitPrice = lineUnitPrice || 0;
      const lineSubtotal = getLineSubtotal(qty, unitPrice, disc);
      const taxAmount = (lineSubtotal * taxRate) / 100;
      updatedItems[index] = {
        ...updatedItems[index],
        itemId: selectedItem._id,
        itemName: selectedItem.name || "",
        description: defaultDescriptionFromProduct(selectedItem),
        unitPrice,
        unit: selectedItem.unit || "",
        itemType: selectedItem.type || "",
        quantity: qty,
        discount: disc,
        taxId,
        taxRate,
        taxName,
        total: Math.max(0, lineSubtotal + taxAmount),
      };
      const subtotal = updatedItems.reduce((sum, row) => sum + (row.total || 0), 0);
      const taxTotal = sumLineTaxAmountsFromItems(updatedItems);
      const discountAmount =
        (subtotal * invoiceData.discountPercentage) / 100;
      const total = Math.max(
        0,
        subtotal -
          discountAmount +
          invoiceData.shippingCharges +
          invoiceData.adjustment,
      );
      setInvoiceData({
        ...invoiceData,
        items: updatedItems,
        subtotal,
        taxTotal,
        discountAmount,
        total,
      });
    }
  };

  const handleFreeformItemNameChange = (index, text) => {
    const next = String(text ?? "");
    const nextTrim = next.trim();
    const row = items[index];
    const linked =
      row?.itemId &&
      businessItems.find((bi) => String(bi._id) === String(row.itemId));
    const linkedName = linked ? String(linked.name || "").trim() : "";
    const stillMatchesLinked =
      linked &&
      linkedName.localeCompare(nextTrim, undefined, { sensitivity: "base" }) === 0;

    if (linked && !stillMatchesLinked) {
      if (onItemChange) {
        onItemChange(index, "itemId", "");
        onItemChange(index, "taxId", "");
        onItemChange(index, "taxRate", 0);
        onItemChange(index, "taxName", "");
        onItemChange(index, "itemName", next);
      } else {
        handleItemChange(index, "itemId", "");
        handleItemChange(index, "taxId", "");
        handleItemChange(index, "taxRate", 0);
        handleItemChange(index, "taxName", "");
        handleItemChange(index, "itemName", next);
      }
      return;
    }

    if (onItemChange) {
      onItemChange(index, "itemName", next);
    } else {
      handleItemChange(index, "itemName", next);
    }
  };

  // Show note about advance payment items
  const hasAdvancePayments = items.some((item) => item.isAdvancePayment);

  return (
    <div className="bg-white rounded-lg  shadow-sm">
      {/* Header */}
        <div className="p-4 border-b border-gray-200  flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">
            {t("documents.itemTable.title")}
          </h3>
            {/* Add Row Buttons */}
      {(!selectedContract || isEditMode) && (
        <div className="p-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleAddRow}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("documents.itemTable.addNewRow")}
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={onBulkAdd}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("documents.itemTable.addItemsInBulk")}
          </button>
          {onOpenAddItemModal && (
            <button
              type="button"
              onClick={onOpenAddItemModal}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[var(--p-blue)] rounded-md hover:bg-[#9CBA33] transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t("documents.itemTable.addMoreItem")}
            </button>
          )}
        </div>
      )}

        </div>

      {/* Advance Payment Warning */}
      {hasAdvancePayments && (
        <div className="mx-4 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">
              {t("documents.itemTable.advancePaymentItems")}
            </p>
            <p className="text-xs text-amber-700 mt-1">
              {t("documents.itemTable.advancePaymentHelp")}
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className={`w-full ${fitNumericColumns ? "table-auto" : ""}`}>
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider">
                {t("documents.itemTable.itemDetails")}
              </th>
              {lineCfDefs.map((def) => (
                <th
                  key={def._id || def.field_key}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider min-w-[8rem]"
                >
                  {def.label}
                  {def.is_required ? (
                    <span className="text-red-500 ml-0.5">*</span>
                  ) : null}
                </th>
              ))}
              <th
                className={`px-4 py-3 text-right text-xs font-semibold text-gray-800 uppercase tracking-wider ${
                  fitNumericColumns ? "whitespace-nowrap" : ""
                }`}
              >
                {t("documents.itemTable.quantity")}
              </th>
              <th
                className={`px-4 py-3 text-right text-xs font-semibold text-gray-800 uppercase tracking-wider ${
                  fitNumericColumns ? "whitespace-nowrap" : ""
                }`}
              >
                {t("documents.itemTable.rate")}
              </th>
              <th
                className={`px-4 py-3 text-right text-xs font-semibold text-gray-800 uppercase tracking-wider ${
                  fitNumericColumns ? "whitespace-nowrap" : ""
                }`}
              >
                {t("documents.itemTable.discountPercent")}
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-800 uppercase tracking-wider">
                {t("documents.itemTable.tax")}
              </th>
              <th
                className={`px-4 py-3 text-right text-xs font-semibold text-gray-800 uppercase tracking-wider ${
                  fitNumericColumns ? "whitespace-nowrap" : ""
                }`}
              >
                {t("documents.itemTable.amount")}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6 + lineCfCount} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <p className="text-sm">{t("documents.itemTable.noItemsAdded")}</p>
                    {!selectedContract && (
                      <button
                        type="button"
                        onClick={handleAddRow}
                        className="text-sm text-[var(--p-blue)] hover:text-[var(--p-blue-dark)] font-medium"
                      >
                        {t("documents.itemTable.clickToAddFirstItem")}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item, index) => {
                const isAdvancePayment = item.isAdvancePayment;
                const isReadOnly = (!isEditMode && !!selectedContract) || isAdvancePayment;
                const amountLabel = isAdvancePayment
                  ? `(${formatCurrencyAmount(currency, Math.abs(Number(item.total) || 0))})`
                  : formatCurrencyAmount(currency, Number(item.total) || 0);

                return (
                  <tr
                    key={item.id || index}
                    className={`hover:bg-gray-50 transition-colors ${
                      isAdvancePayment ? "bg-red-50" : ""
                    }`}
                  >
                    {/* Item Name */}
                    <td className="px-4 py-3">
                      {isReadOnly ? (
                        <div className="flex items-start gap-2">
                          {isAdvancePayment && (
                            <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded">
                              AP
                            </span>
                          )}
                          <div className="flex-1">
                            {(item.itemName || item.description) && (
                              <>
                                {item.itemName ? (
                                  <>
                                    <p className="text-sm font-medium text-gray-900">{item.itemName}</p>
                                    {item.description && (
                                      <p className="text-sm text-gray-600 whitespace-pre-wrap mt-0.5">
                                        {item.description}
                                      </p>
                                    )}
                                  </>
                                ) : (
                                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{item.description}</p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <ItemPickOrTypeField
                            itemName={item.itemName ?? ""}
                            disabled={false}
                            businessItems={businessItems}
                            currency={currency}
                            getItemPrice={(bi) => defaultUnitPriceFromItem(bi)}
                            placeholder={t("documents.itemTable.itemNamePlaceholder")}
                            searchPlaceholder={t("documents.itemTable.searchItems")}
                            onTextChange={(text) =>
                              handleFreeformItemNameChange(index, text)
                            }
                            onSelectProduct={(product) =>
                              applyBusinessItemToLine(index, product)
                            }
                          />
                          {errors[`items.${index}.itemName`] && (
                            <p className="mt-1 text-xs text-red-500">
                              {errors[`items.${index}.itemName`]}
                            </p>
                          )}
                          <textarea
                            rows={2}
                            value={item.description ?? ""}
                            onChange={(e) =>
                              handleItemChange(index, "description", e.target.value)
                            }
                            disabled={isReadOnly}
                            autoComplete="off"
                            className={`w-full min-h-[2.5rem] resize-y px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] whitespace-pre-wrap ${
                              errors[`items.${index}.description`]
                                ? "border-red-300"
                                : "border-gray-300"
                            } ${isReadOnly ? "bg-gray-100 cursor-not-allowed" : ""}`}
                            placeholder={t("documents.itemTable.itemDescription")}
                          />
                          {errors[`items.${index}.description`] && (
                            <p className="mt-1 text-xs text-red-500">
                              {errors[`items.${index}.description`]}
                            </p>
                          )}
                        </div>
                      )}
                    </td>

                    {lineCfDefs.map((def) => {
                      const rawVal = item.lineItemCustomFields?.[def.field_key];
                      const errKey = `items.${index}.lineCf.${def.field_key}`;
                      return (
                        <td
                          key={def._id || def.field_key}
                          className="px-4 py-3 align-middle min-w-0"
                        >
                          {isReadOnly ? (
                            <span className="text-sm text-gray-800 break-words block">
                              {formatLineCustomFieldDisplay(def, rawVal, t)}
                            </span>
                          ) : (
                            <LineItemCustomFieldInput
                              def={def}
                              value={rawVal}
                              disabled={isAdvancePayment}
                              error={!!errors[errKey]}
                              t={t}
                              onChange={(v) =>
                                handleItemChange(index, "lineItemCustomFields", {
                                  key: def.field_key,
                                  value: v,
                                })
                              }
                            />
                          )}
                          {errors[errKey] ? (
                            <p className="mt-0.5 text-[10px] text-red-500">
                              {errors[errKey]}
                            </p>
                          ) : null}
                        </td>
                      );
                    })}

                    {/* Quantity */}
                    <td className={`px-4 py-3 ${fitNumericColumns ? "whitespace-nowrap" : ""}`}>
                      {isReadOnly ? (
                        <div className="text-right">
                          <span className="text-sm text-gray-900">
                            {item.quantity || 0}
                          </span>
                          {item.unit && (
                            <div className="text-xs text-gray-500 mt-1">
                              {item.unit}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-right">
                          <div
                            className={`flex items-center gap-2 ${
                              fitNumericColumns ? "justify-end" : ""
                            }`}
                          >
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={item.quantity || ""}
                              onChange={(e) =>
                                handleItemChange(index, "quantity", e.target.value)
                              }
                              className={`${
                                fitNumericColumns
                                  ? "min-w-0 max-w-none w-auto shrink-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  : "w-full"
                              } px-3 py-2 text-sm text-right border rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
                                errors[`items.${index}.quantity`] || stockWarnings[index]?.isOverstock
                                  ? "border-red-300 bg-red-50"
                                  : stockWarnings[index]
                                  ? "border-orange-300 bg-orange-50"
                                  : "border-gray-300"
                              }`}
                              style={
                                fitNumericColumns
                                  ? { minWidth: inputWidthCh(item.quantity) }
                                  : undefined
                              }
                              placeholder="0.00"
                            />
                            {item.unit && (
                              <div className="text-xs text-gray-500">
                                {item.unit}
                              </div>
                            )}
                          </div>
                          {/* Stock Warning/Error Message */}
                          {stockWarnings[index] && (
                            <div className={`mt-1 text-xs ${
                              stockWarnings[index].isOverstock
                                ? "text-red-600 font-medium"
                                : "text-orange-600"
                            }`}>
                              <div className="flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                <span>
                                  {stockWarnings[index].isOverstock
                                    ? t("documents.itemTable.insufficientStock", {
                                        available: stockWarnings[index].available,
                                        requested: stockWarnings[index].requested,
                                      })
                                    : t("documents.itemTable.availableStock", {
                                        available: stockWarnings[index].available,
                                      })}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Rate */}
                    <td className={`px-4 py-3 ${fitNumericColumns ? "whitespace-nowrap" : ""}`}>
                      {isReadOnly ? (
                        <div className="text-right">
                          <span className="text-sm text-gray-900">
                            {isAdvancePayment
                              ? `(${Math.abs(Number(item.unitPrice) || 0).toFixed(2)})`
                              : formatCurrencyAmount(currency, Number(item.unitPrice) || 0)}
                          </span>
                        </div>
                      ) : (
                        <div className={`text-right ${fitNumericColumns ? "flex justify-end" : ""}`}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice || ""}
                            onChange={(e) =>
                              handleItemChange(index, "unitPrice", e.target.value)
                            }
                            className={`${
                              fitNumericColumns
                                ? "min-w-0 max-w-none w-auto shrink-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                : "w-full"
                            } px-3 py-2 text-sm text-right border rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
                              errors[`items.${index}.rate`]
                                ? "border-red-300"
                                : "border-gray-300"
                            }`}
                            style={
                              fitNumericColumns
                                ? { minWidth: inputWidthCh(item.unitPrice) }
                                : undefined
                            }
                            placeholder="0.00"
                          />
                          {errors[`items.${index}.rate`] && (
                            <p className="mt-1 text-xs text-red-500">
                              {errors[`items.${index}.rate`]}
                            </p>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Discount (%) */}
                    <td className={`px-4 py-3 ${fitNumericColumns ? "whitespace-nowrap" : ""}`}>
                      {isReadOnly ? (
                        <div className="text-right">
                          <span className="text-sm text-gray-900">
                            {(Number(item.discount) || 0).toFixed(2)}%
                          </span>
                        </div>
                      ) : (
                        <div className={`text-right ${fitNumericColumns ? "flex justify-end" : ""}`}>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={item.discount ?? ""}
                            onChange={(e) =>
                              handleItemChange(index, "discount", e.target.value)
                            }
                            className={`${
                              fitNumericColumns
                                ? "min-w-0 max-w-none w-auto shrink-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                : "w-full"
                            } px-3 py-2 text-sm text-right border rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
                              errors[`items.${index}.discount`]
                                ? "border-red-300"
                                : "border-gray-300"
                            }`}
                            style={
                              fitNumericColumns
                                ? { minWidth: inputWidthCh(item.discount) }
                                : undefined
                            }
                            placeholder="0–100%"
                            title={t("documents.itemTable.discountHelp")}
                          />
                        </div>
                      )}
                    </td>

                    {/* Tax – dropdown + direct percentage input (max 100%) */}
                    <td className="px-4 py-3">
                      {isAdvancePayment ? (
                        <div className="text-right">
                          <span className="text-sm text-gray-600">
                            {item.taxRate || 0}%
                          </span>
                        </div>
                      ) : (
                        <div className="text-right min-w-[160px] space-y-1">
                          <SearchableDropdown
                            value={item.taxId || ""}
                            disabled={isReadOnly}
                            onChange={(e) => {
                              const taxId = e.target.value || "";
                              const selectedTax = (taxes || []).find(
                                (t) => String(t._id) === String(taxId)
                              );
                              const rawRate = selectedTax ? parseFloat(selectedTax.rate) || 0 : 0;
                              const rate = Math.max(0, Math.min(100, rawRate));
                              const name = selectedTax?.name || "";

                              setInvoiceData((prev) => {
                                const prevItems = prev.items || [];
                                const updatedItems = [...prevItems];
                                updatedItems[index] = {
                                  ...updatedItems[index],
                                  taxId,
                                  taxRate: rate,
                                  taxName: name,
                                };
                                const qty =
                                  parseFloat(updatedItems[index].quantity) || 1;
                                const unitPrice =
                                  parseFloat(updatedItems[index].unitPrice) || 0;
                                const discount =
                                  parseFloat(updatedItems[index].discount) || 0;
                                const lineSubtotal = getLineSubtotal(
                                  qty,
                                  unitPrice,
                                  discount
                                );
                                const taxAmount = (lineSubtotal * rate) / 100;
                                updatedItems[index].total = Math.max(
                                  0,
                                  lineSubtotal + taxAmount
                                );
                                const subtotal = updatedItems.reduce(
                                  (sum, it) => sum + (it.total || 0),
                                  0
                                );
                                const taxTotal =
                                  sumLineTaxAmountsFromItems(updatedItems);
                                const discountAmount =
                                  (subtotal * (prev.discountPercentage || 0)) /
                                  100;
                                const total = Math.max(
                                  0,
                                  subtotal -
                                    discountAmount +
                                    (prev.shippingCharges || 0) +
                                    (prev.adjustment || 0)
                                );
                                return {
                                  ...prev,
                                  items: updatedItems,
                                  subtotal,
                                  taxTotal,
                                  discountAmount,
                                  total,
                                };
                              });
                            }}
                            placeholder={t("documents.itemTable.selectTax")}
                            searchPlaceholder={t("documents.itemTable.searchTaxes")}
                            clearable={true}
                            options={[
                              { value: "", label: t("documents.itemTable.noTax") },
                              ...(taxes || []).map((t) => ({
                                value: t._id,
                                label: `${t.name} (${t.rate}%)`,
                              })),
                            ]}
                            searchKeys={["label"]}
                            className={
                              errors[`items.${index}.taxRate`]
                                ? "border-red-300"
                                : "border-gray-300"
                            }
                            dropdownFooter={
                              businessId ? (
                                <AddTaxButton
                                  businessId={businessId}
                                  headers={headers}
                                  disabled={isReadOnly}
                                  displayMode="dropdown"
                                  onAdded={(newTax) => {
                                    if (onTaxCreated) {
                                      onTaxCreated(newTax);
                                    }
                                    if (!newTax?._id) return;
                                    const rate = Math.max(
                                      0,
                                      Math.min(100, Number(newTax.rate) || 0)
                                    );
                                    setInvoiceData((prev) => {
                                      const prevItems = prev.items || [];
                                      const updatedItems = [...prevItems];
                                      updatedItems[index] = {
                                        ...updatedItems[index],
                                        taxId: newTax._id,
                                        taxRate: rate,
                                        taxName: newTax.name,
                                      };
                                      const qty =
                                        parseFloat(
                                          updatedItems[index].quantity
                                        ) || 1;
                                      const unitPrice =
                                        parseFloat(
                                          updatedItems[index].unitPrice
                                        ) || 0;
                                      const discount =
                                        parseFloat(
                                          updatedItems[index].discount
                                        ) || 0;
                                      const lineSubtotal = getLineSubtotal(
                                        qty,
                                        unitPrice,
                                        discount
                                      );
                                      const taxAmount =
                                        (lineSubtotal * rate) / 100;
                                      updatedItems[index].total = Math.max(
                                        0,
                                        lineSubtotal + taxAmount
                                      );
                                      const subtotal = updatedItems.reduce(
                                        (sum, it) => sum + (it.total || 0),
                                        0
                                      );
                                      const taxTotal =
                                        sumLineTaxAmountsFromItems(
                                          updatedItems
                                        );
                                      const discountAmount =
                                        (subtotal *
                                          (prev.discountPercentage || 0)) /
                                        100;
                                      const total = Math.max(
                                        0,
                                        subtotal -
                                          discountAmount +
                                          (prev.shippingCharges || 0) +
                                          (prev.adjustment || 0)
                                      );
                                      return {
                                        ...prev,
                                        items: updatedItems,
                                        subtotal,
                                        taxTotal,
                                        discountAmount,
                                        total,
                                      };
                                    });
                                  }}
                                />
                              ) : null
                            }
                          />

                          {/* Removed manual tax percentage field below the tax dropdown to simplify UI.
                              Tax rate is now fully controlled by the selected tax. */}
                        </div>
                      )}
                    </td>

                    {/* Amount (Total) */}
                    <td className={`px-4 py-3 ${fitNumericColumns ? "whitespace-nowrap" : ""}`}>
                      <div className="flex items-center justify-end gap-2">
                        <span
                          className={`text-sm font-medium ${
                            isAdvancePayment ? "text-red-600" : "text-gray-900"
                          } ${fitNumericColumns ? "inline-block" : ""}`}
                          style={
                            fitNumericColumns
                              ? {
                                  minWidth: inputWidthCh(amountLabel, {
                                    min: 10,
                                    max: 40,
                                    pad: 2,
                                  }),
                                }
                              : undefined
                          }
                        >
                          {amountLabel}
                        </span>
                        {(!selectedContract || isEditMode) && (
                          <>
                            <button
                              type="button"
                              className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                              title={t("documents.itemTable.moreOptions")}
                            >
                              <svg
                                className="w-4 h-4"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              disabled={isAdvancePayment || items.length === 1}
                              className={`p-1 rounded transition-colors ${
                                isAdvancePayment || items.length === 1
                                  ? "text-gray-300 cursor-not-allowed"
                                  : "text-red-400 hover:text-red-600 hover:bg-red-50"
                              }`}
                              title={
                                isAdvancePayment
                                  ? t("documents.itemTable.cannotRemoveAdvancePayment")
                                  : items.length === 1
                                  ? t("documents.itemTable.atLeastOneItemRequired")
                                  : t("documents.itemTable.removeItem")
                              }
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    
      {errors.items && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200">
          <p className="text-xs text-red-600">{errors.items}</p>
        </div>
      )}
    </div>
  );
};

export { formatLineCustomFieldDisplay, LineItemCustomFieldInput };
export default ZohoStyleItemTable;
