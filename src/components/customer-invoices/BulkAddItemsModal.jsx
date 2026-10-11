import React, { useState, useEffect, useMemo } from "react";
import { X, Search, Check, Minus, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatAmount } from "@/components/formatAmount";
import { getLineSubtotal, getItemTotal } from "@/utils/itemDiscountUtils";

/** @param {"sales"|"purchase"} pricingMode — sales: customer AR; purchase: PO / vendor AP (cost + purchase tax first) */
const BulkAddItemsModal = ({
  isOpen,
  onClose,
  items = [],
  onAddItems,
  currency = "USD",
  pricingMode = "sales",
}) => {
  const { t } = useTranslation();
  const isPurchase = pricingMode === "purchase";

  const getDisplayUnitPrice = (item) => {
    if (!item) return 0;
    if (isPurchase) {
      return (
        item.purchaseInformation?.costPrice ||
        item.salesInformation?.sellingPrice ||
        0
      );
    }
    return (
      item.salesInformation?.sellingPrice ||
      item.purchaseInformation?.costPrice ||
      0
    );
  };

  const getUnitPriceAndTaxForAdd = (item) => {
    if (!item) return { unitPrice: 0, taxOnItem: null };
    if (isPurchase) {
      const unitPrice =
        item.purchaseInformation?.costPrice ||
        item.salesInformation?.sellingPrice ||
        0;
      const taxOnItem =
        item.purchaseInformation?.taxOnItem ||
        item.salesInformation?.taxOnItem ||
        null;
      return { unitPrice, taxOnItem };
    }
    const unitPrice =
      item.salesInformation?.sellingPrice ||
      item.purchaseInformation?.costPrice ||
      0;
    const taxOnItem =
      item.salesInformation?.taxOnItem ||
      item.purchaseInformation?.taxOnItem ||
      null;
    return { unitPrice, taxOnItem };
  };
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState({}); // { itemId: { item, quantity } }

  // Filter items based on search term
  // Search only by name and itemCode (visible fields) - NOT description
  // Prevents "chicken" from matching "Burger" just because description says "chicken burger"
  const filteredItems = useMemo(() => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return items;

    const searchLower = trimmed.toLowerCase();
    const isShortSearch = searchLower.length <= 2;

    const fieldMatches = (field) => {
      if (!field) return false;
      if (isShortSearch) {
        // For short searches: require match at start of word or start of string
        const words = field.split(/\s+/);
        return words.some((word) => word.startsWith(searchLower)) || field.startsWith(searchLower);
      }
      return field.includes(searchLower);
    };

    return items.filter((item) => {
      const name = item.name?.toLowerCase() || "";
      const itemCode = item.itemCode?.toLowerCase() || "";
      return fieldMatches(name) || fieldMatches(itemCode);
    });
  }, [items, searchTerm]);

  // Toggle item selection
  const toggleItemSelection = (item) => {
    setSelectedItems((prev) => {
      const itemId = item._id;
      const isSelected = prev[itemId];
      
      if (isSelected) {
        // Remove item from selection
        const newSelection = { ...prev };
        delete newSelection[itemId];
        return newSelection;
      } else {
        // Add item with default quantity of 1
        return {
          ...prev,
          [itemId]: {
            item,
            quantity: 1,
          },
        };
      }
    });
  };

  // Update quantity for a selected item
  const updateQuantity = (itemId, delta) => {
    setSelectedItems((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      
      const newQuantity = Math.max(1, (current.quantity || 1) + delta);
      return {
        ...prev,
        [itemId]: {
          ...current,
          quantity: newQuantity,
        },
      };
    });
  };

  // Set quantity directly
  const setQuantity = (itemId, quantity) => {
    const numQuantity = parseFloat(quantity) || 1;
    if (numQuantity < 1) return;
    
    setSelectedItems((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      
      return {
        ...prev,
        [itemId]: {
          ...current,
          quantity: numQuantity,
        },
      };
    });
  };

  // Calculate total quantity
  const totalQuantity = useMemo(() => {
    return Object.values(selectedItems).reduce(
      (sum, { quantity }) => sum + (quantity || 1),
      0
    );
  }, [selectedItems]);

  // Get selected items array sorted by name
  const selectedItemsArray = useMemo(() => {
    return Object.values(selectedItems)
      .map(({ item, quantity }) => ({ item, quantity }))
      .sort((a, b) => {
        const nameA = a.item.name || "";
        const nameB = b.item.name || "";
        return nameA.localeCompare(nameB);
      });
  }, [selectedItems]);

  // Handle add items
  const handleAddItems = () => {
    if (selectedItemsArray.length === 0) {
      return;
    }

    // Convert selected items to invoice item format
    const newItems = selectedItemsArray.map(({ item, quantity }) => {
      const { unitPrice, taxOnItem } = getUnitPriceAndTaxForAdd(item);
      const discount = 0;
      const quantityNum = parseFloat(quantity) || 1;

      // Extract tax information (support both sales and purchase items)
      const taxId = taxOnItem?._id || "";
      const taxRate = taxOnItem?.rate ?? taxOnItem?.percentage ?? 0;
      const taxName = taxOnItem?.name || "";

      // Calculate line subtotal and tax (discount is %)
      const total = getItemTotal(quantityNum, unitPrice, discount, taxRate);

      return {
        id: Date.now() + Math.random(), // Temporary ID
        itemId: item._id,
        itemName: item.name || "",
        description: isPurchase
          ? item.purchaseInformation?.description ||
            item.salesInformation?.description ||
            ""
          : item.salesInformation?.description ||
            item.purchaseInformation?.description ||
            "",
        quantity: quantityNum,
        unitPrice: unitPrice,
        unit: item.unit || "",
        discount: 0, // Default discount to 0, user can edit in table
        taxId: taxId,
        taxRate: taxRate,
        taxName: taxName,
        total: total,
        itemType: item.type || "",
      };
    });

    onAddItems(newItems);
    handleClose();
  };

  // Handle close
  const handleClose = () => {
    setSearchTerm("");
    setSelectedItems({});
    onClose();
  };

  // Handle barcode scan (simple implementation - can be enhanced)
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Simple barcode scanner detection (usually rapid keypresses ending with Enter)
      // This is a basic implementation
      if (e.key === "Enter" && searchTerm.trim()) {
        // Try to find item by code
        const foundItem = items.find(
          (item) =>
            item.itemCode?.toLowerCase() === searchTerm.toLowerCase().trim()
        );
        if (foundItem) {
          toggleItemSelection(foundItem);
          setSearchTerm("");
        }
      }
    };

    if (isOpen) {
      window.addEventListener("keypress", handleKeyPress);
      return () => window.removeEventListener("keypress", handleKeyPress);
    }
  }, [isOpen, searchTerm, items]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-900">
            {t("accounts.customerInvoices.bulkAddItems.title")}
          </h2>
          <button
            onClick={handleClose}
            aria-label={t("common.close")}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Section - Item Search and Selection */}
          <div className="w-1/2 border-r border-gray-200 flex flex-col overflow-hidden">
            {/* Search Bar */}
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none z-10" size={18} />
                <input
                  type="text"
                  placeholder={t(
                    "accounts.customerInvoices.bulkAddItems.searchPlaceholder",
                  )}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                  autoFocus
                />
              </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredItems.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  {searchTerm
                    ? t("accounts.customerInvoices.bulkAddItems.noItemsFound")
                    : t("accounts.customerInvoices.bulkAddItems.noItemsAvailable")}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredItems.map((item) => {
                    const itemId = item._id;
                    const isSelected = !!selectedItems[itemId];
                    const rate = formatAmount(getDisplayUnitPrice(item));

                    return (
                      <div
                        key={itemId}
                        onClick={() => toggleItemSelection(item)}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-blue-50 border-blue-300"
                            : "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                  isSelected
                                    ? "bg-[var(--p-blue)] border-[var(--p-blue)]"
                                    : "border-gray-300"
                                }`}
                              >
                                {isSelected && (
                                  <Check size={14} className="text-white" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {item.name ||
                                    t(
                                      "accounts.customerInvoices.bulkAddItems.unnamedItem",
                                    )}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {currency} {rate}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Section - Selected Items */}
          <div className="w-1/2 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  {t("accounts.customerInvoices.bulkAddItems.selectedItems")}
                </h3>
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--p-blue)] text-white text-xs font-semibold">
                  {selectedItemsArray.length}
                </span>
              </div>
              <p className="text-xs text-gray-600">
                {t("accounts.customerInvoices.bulkAddItems.totalQuantity", {
                  count: totalQuantity,
                })}
              </p>
            </div>

            {/* Selected Items List */}
            <div className="flex-1 overflow-y-auto p-4">
              {selectedItemsArray.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  {t("accounts.customerInvoices.bulkAddItems.noItemsSelected")}
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedItemsArray.map(({ item, quantity }) => {
                    const itemId = item._id;

                    return (
                      <div
                        key={itemId}
                        className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <p className="text-sm font-medium text-gray-900 mb-2">
                          {item.name ||
                            t(
                              "accounts.customerInvoices.bulkAddItems.unnamedItem",
                            )}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateQuantity(itemId, -1)}
                            className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-200 transition-colors"
                          >
                            <Minus size={14} className="text-gray-600" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={quantity}
                            onChange={(e) => setQuantity(itemId, e.target.value)}
                            className="w-16 px-2 py-1 text-center text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                          />
                          <button
                            type="button"
                            onClick={() => updateQuantity(itemId, 1)}
                            className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-200 transition-colors"
                          >
                            <Plus size={14} className="text-gray-600" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleAddItems}
            disabled={selectedItemsArray.length === 0}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
              selectedItemsArray.length === 0
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-[var(--p-blue)] hover:bg-[var(--p-blue-dark)]"
            }`}
          >
            {t("accounts.customerInvoices.bulkAddItems.addItems")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkAddItemsModal;
