import React, { useEffect } from "react";
import { ChevronDown, Calendar, X, Upload, Plus } from "lucide-react";
import SearchableDropdown from "@/components/SearchableDropdown";
import { getLineSubtotal, clampDiscountPercent } from "@/utils/itemDiscountUtils";

// ItemTable component to be integrated into CreateCustomerInvoice
const ItemTable = ({
  invoiceData,
  setInvoiceData,
  selectedContract,
  type = "",
  expenseAccounts = [],
}) => {
  console.log("invoice items table", invoiceData);
  console.log("selected contract items table", selectedContract);
  // Function to add an item to the invoice items array
  const handleAddItem = () => {
    const newItem = {
      id: invoiceData.items.length + 1,
      quantity: 0,
      description: "",
      unitPrice: 0,
      discount: 0,
      total: 0,
    };

    setInvoiceData({
      ...invoiceData,
      items: [...invoiceData.items, newItem],
    });
  };

  // Function to remove an item from the invoice items array
  const handleRemoveItem = (index) => {
    // Don't allow removal of advance payment items
    if (invoiceData.items[index].isAdvancePayment) {
      return;
    }

    const updatedItems = invoiceData.items.filter((_, i) => i !== index);
    setInvoiceData({
      ...invoiceData,
      items: updatedItems,
    });
    calculateTotals(updatedItems);
  };

  // Function to handle changes to an item's fields
  const handleItemChange = (index, field, value) => {
    // Don't allow editing of advance payment items
    if (invoiceData.items[index].isAdvancePayment) {
      return;
    }

    // Only allow editing of expenseAccount field, all other fields are read-only
    if (field !== "expenseAccount") {
      return;
    }

    let sanitizedValue = value;
    if (field === "expenseAccount") {
      // Handle expenseAccount - can be string ID or null
      sanitizedValue = value || null;
    } else if (field === "description") {
      // Allow any text for description
      sanitizedValue = value;
    } else if (field === "discount") {
      // Clamp discount between 0 and 100 (percentage)
      sanitizedValue = clampDiscountPercent(value);
    } else {
      // Treat empty or invalid as 0, and prevent negative values
      if (
        sanitizedValue === "" ||
        isNaN(Number(sanitizedValue)) ||
        Number(sanitizedValue) < 0
      ) {
        sanitizedValue = 0;
      }
      sanitizedValue = Number(sanitizedValue);
    }
    const updatedItems = [...invoiceData.items];
    updatedItems[index][field] = sanitizedValue;

    // Recalculate total if quantity, unit price, or discount changes (discount is %)
    if (field === "quantity" || field === "unitPrice" || field === "discount") {
      const quantity = Number(updatedItems[index].quantity) || 0;
      const unitPrice = Number(updatedItems[index].unitPrice) || 0;
      const discount = Number(updatedItems[index].discount) || 0;
      const rowTotal = getLineSubtotal(quantity, unitPrice, discount);
      updatedItems[index].total = rowTotal;
      updatedItems[index].discountError =
        discount > 100 ? "Discount cannot exceed 100%." : "";
    }

    setInvoiceData({
      ...invoiceData,
      items: updatedItems,
    });

    // Recalculate subtotal and total
    calculateTotals(updatedItems);
  };

  // Function to calculate subtotal, discount amount, and total
  const calculateTotals = (items) => {
    // Calculate subtotal including negative advance payment items
    const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);

    // For commercial invoices, subtotal can be negative (due to advance payments)
    // For proforma invoices, subtotal should be positive
    const isCommercialInvoice = invoiceData.invoiceType === "Commercial";
    const baseSubtotal = isCommercialInvoice ? subtotal : Math.abs(subtotal);

    // Ensure subtotal doesn't go below 0
    const finalSubtotal = Math.max(0, baseSubtotal);

    const discountAmount =
      (finalSubtotal * invoiceData.discountPercentage) / 100;

    setInvoiceData((prev) => {
      const calculatedTotal = Math.max(
        0,
        finalSubtotal - discountAmount + prev.shippingCharges + prev.adjustment
      );

      return {
        ...prev,
        subtotal: finalSubtotal,
        discountAmount,
        total: calculatedTotal,
      };
    });

    // After calculating subtotal, also recalculate depositAmount and update invoiceData.depositAmount = (subtotal * invoiceData.deposit / 100)
    if (invoiceData.deposit) {
      const depositAmount = (finalSubtotal * invoiceData.deposit) / 100;
      setInvoiceData((prev) => ({
        ...prev,
        depositAmount,
      }));
    }
  };
  console.log("item table", invoiceData);
  // Function to populate items from the selected contract
  useEffect(() => {
    if (
      selectedContract &&
      selectedContract.productInfo &&
      selectedContract.productInfo.length > 0 &&
      invoiceData.items.length === 0 && // Only populate if no items exist
      !invoiceData.items.some((item) => item.isAdvancePayment) // Don't override if advance payment items exist
    ) {
      const contractItems =
            type === "edit"
          ? invoiceData.items.map((product, index) => {
              const quantity = product.quantity || 0;
              const unitPrice = product.unitPrice || 0;
              const discount = product.discount || 0;
              // Calculate total: quantity * unitPrice * (1 - discount/100)
              const total =
                product.totalValue ||
                product.total ||
                getLineSubtotal(quantity, unitPrice, discount);
              return {
                id: index + 1,
                quantity,
                description: product?.description,
                unitPrice,
                discount,
                total: Math.max(0, total), // Ensure total is not negative
                expenseAccount: product.expenseAccount || null, // Preserve expenseAccount
                isAdvancePayment: product.isAdvancePayment || false, // Preserve isAdvancePayment
              };
            })
          : selectedContract.productInfo.map((product, index) => {
              const quantity = product.quantityMTS || 0;
              const unitPrice = product.price || 0;
              const total = quantity * unitPrice;
              return {
                id: index + 1,
                quantity,
                description: `${product.title}\n${
                  product.shippingTerms?.replace(/<[^>]*>/g, "") || ""
                }`,
                unitPrice,
                discount: 0,
                total, // Calculate total properly
                expenseAccount: null, // Initialize as null, will be set at item level
                isAdvancePayment: false,
              };
            });

      setInvoiceData((prev) => {
        // Calculate new subtotal
        const subtotal = contractItems.reduce(
          (sum, item) => sum + (item.total || 0),
          0
        );
        const discountAmount = (subtotal * prev.discountPercentage) / 100;

        return {
          ...prev,
          items: contractItems,
          subtotal,
          discountAmount,
          total:
            subtotal - discountAmount + prev.shippingCharges + prev.adjustment,
          currency:
            typeof selectedContract.productInfo[0]?.selectedCurrency ===
            "object"
              ? selectedContract.productInfo[0]?.selectedCurrency?.symbol ||
                selectedContract.productInfo[0]?.selectedCurrency?.prefix ||
                prev.currency
              : selectedContract.productInfo[0]?.selectedCurrency ||
                prev.currency,
        };
      });
    }
  }, [selectedContract, setInvoiceData]);

  return (
    <div className="mb-6">
      <h2 className="text-xl font-medium mb-4">Item Table</h2>

      {/* Show note about advance payment items if they exist */}
      {invoiceData.items.some((item) => item.isAdvancePayment) && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">
            <strong>Note:</strong> Items marked with "AP" are advance payments
            from existing Proforma Invoices. These amounts are automatically
            deducted from the total invoice amount.
          </p>
        </div>
      )}

      <div
        className="overflow-x-auto bg-white rounded-lg shadow"
        style={{ overflowY: "visible" }}
      >
        <table className="w-full">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 text-left font-medium text-gray-600">Item</th>
              <th className="p-3 text-left font-medium text-gray-600">
                QTY(MT)
              </th>
              <th className="p-3 text-left font-medium text-gray-600">
                Description of Goods
              </th>
              <th className="p-3 text-left font-medium text-gray-600">
                Unit Price ({invoiceData.currency}/MT)
              </th>
              <th className="p-3 text-left font-medium text-gray-600">
                Discount (%)
              </th>
              <th className="p-3 text-left font-medium text-gray-600">
                Total ({invoiceData.currency})
              </th>
              <th className="p-3 text-left font-medium text-gray-600">
                Account
              </th>
              <th className="p-3 text-left font-medium text-gray-600">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {invoiceData.items.map((item, index) => (
              <tr
                key={item.id}
                className={`border-b ${
                  item.isAdvancePayment
                    ? "bg-red-50 border-red-200"
                    : index % 2 === 0
                    ? "bg-white"
                    : "bg-gray-50"
                }`}
              >
                <td className="p-3">
                  {item.isAdvancePayment ? (
                    <span
                      className="text-red-600 font-medium"
                      title="Advance Payment Item"
                    >
                      AP{index + 1}
                    </span>
                  ) : (
                    index + 1
                  )}
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    min="0"
                    value={item.quantity || 0}
                    onChange={(e) =>
                      handleItemChange(index, "quantity", e.target.value)
                    }
                    className={`w-full p-2 border border-gray-300 rounded ${
                      item.isAdvancePayment
                        ? "bg-gray-100 cursor-not-allowed"
                        : "bg-gray-100 cursor-not-allowed"
                    }`}
                    step="0.01"
                    disabled={true}
                    readOnly
                  />
                </td>
                <td className="p-3">
                  <textarea
                    value={item.description}
                    onChange={(e) =>
                      handleItemChange(index, "description", e.target.value)
                    }
                    className={`w-full p-2 border border-gray-300 rounded ${
                      item.isAdvancePayment
                        ? "bg-gray-100 cursor-not-allowed"
                        : "bg-gray-100 cursor-not-allowed"
                    }`}
                    rows="3"
                    disabled={true}
                    readOnly
                  />
                </td>
                <td className="p-3">
                  {item.isAdvancePayment ? (
                    <span className="w-full p-2 text-right block">
                      ({Math.abs(Number(item.unitPrice)).toFixed(2)})
                    </span>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      value={Number(item.unitPrice).toFixed(2)}
                      onChange={(e) =>
                        handleItemChange(index, "unitPrice", e.target.value)
                      }
                      className="w-full p-2 border border-gray-300 rounded bg-gray-100 cursor-not-allowed"
                      step="0.01"
                      disabled={true}
                      readOnly
                    />
                  )}
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={item.discount ?? 0}
                    placeholder="0–100%"
                    onChange={(e) =>
                      handleItemChange(index, "discount", e.target.value)
                    }
                    className={`w-full p-2 border border-gray-300 rounded ${
                      item.isAdvancePayment
                        ? "bg-gray-100 cursor-not-allowed"
                        : "bg-gray-100 cursor-not-allowed"
                    }`}
                    disabled={true}
                    readOnly
                  />
                  {item.discountError && (
                    <div className="text-red-500 text-xs mt-1">
                      {item.discountError}
                    </div>
                  )}
                </td>
                <td className="p-3">
                  {item.isAdvancePayment
                    ? `(${Math.abs(Number(item.total) || 0).toFixed(2)})`
                    : (Number(item.total) || 0).toFixed(2)}
                </td>
                <td className="p-3">
                  {item.isAdvancePayment ? (
                    <span className="text-gray-400 text-sm">N/A</span>
                  ) : (
                    <div>
                      <SearchableDropdown
                        value={
                          typeof item.expenseAccount === "object" &&
                          item.expenseAccount?._id
                            ? item.expenseAccount._id
                            : item.expenseAccount || ""
                        }
                        onChange={(e) =>
                          handleItemChange(
                            index,
                            "expenseAccount",
                            e.target.value
                          )
                        }
                        placeholder="Select Expense Account"
                        searchPlaceholder="Search expense accounts..."
                        options={
                          expenseAccounts?.map((account) => ({
                            value: account._id,
                            label: `${account.code || "N/A"} - ${
                              account.accountName
                            } (${
                              account.accountType?.name ||
                              account.accountType?.accountHeader
                            })`,
                            name: account.accountName,
                            code: account.code,
                          })) || []
                        }
                        searchKeys={["name", "code"]}
                        renderOption={(option) => (
                          <div>
                            <div className="font-medium">{option.name}</div>
                            <div className="text-xs text-gray-500">
                              {option.code} - {option.name}
                            </div>
                          </div>
                        )}
                      />
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="text-gray-400 cursor-not-allowed"
                    disabled={true}
                  >
                    <X size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {/* Deposit/Advance summary row */}
            {invoiceData.deposit && invoiceData.depositAmount ? (
              <tr className="bg-yellow-50 font-semibold">
                <td colSpan={6} className="text-right p-3">
                  {invoiceData.invoiceType === "Proforma"
                    ? `Advance Deposit (${invoiceData.deposit}%):`
                    : `Advance Deposit (${invoiceData.deposit}%):`}
                </td>
                <td className="p-3 text-right">
                  {invoiceData.invoiceType === "Proforma"
                    ? `(${invoiceData.depositAmount.toFixed(2)})`
                    : `(${invoiceData.depositAmount.toFixed(2)})`}
                </td>
                <td></td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <div className="p-3">
          {/*  <button
            type="button"
            onClick={handleAddItem}
            className="flex items-center text-[var(--p-blue)] hover:text-[#8CA82B]"
          >
            <Plus size={16} className="mr-1" />
            Add More 
          </button> */}
        </div>
      </div>
    </div>
  );
};

export default ItemTable;
