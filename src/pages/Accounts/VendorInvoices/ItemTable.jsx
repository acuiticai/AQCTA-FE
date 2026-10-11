import React, { useEffect } from "react";
import { ChevronDown, Calendar, X, Upload, Plus } from "lucide-react";
import { getLineSubtotal, getItemTotal, clampDiscountPercent } from "@/utils/itemDiscountUtils";

// ItemTable component to be integrated into CreateCustomerInvoice
const ItemTable = ({
  invoiceData,
  setInvoiceData,
  selectedContract,
  type = "",
}) => {
  console.log("invoice data items table", invoiceData);
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
    const updatedItems = invoiceData.items.filter((_, i) => i !== index);
    setInvoiceData({
      ...invoiceData,
      items: updatedItems,
    });
    calculateTotals(updatedItems);
  };

  // Function to handle changes to an item's fields
  const handleItemChange = (index, field, value) => {
    let sanitizedValue = value;
    if (field === "description") {
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
    const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
    const discountAmount = (subtotal * invoiceData.discountPercentage) / 100;

    setInvoiceData((prev) => ({
      ...prev,
      subtotal,
      discountAmount,
      total: subtotal - discountAmount + prev.shippingCharges + prev.adjustment,
    }));
  };
  console.log("item table", invoiceData);
  // Function to populate items from the selected contract
  useEffect(() => {
    if (
      selectedContract &&
      selectedContract.productInfo &&
      selectedContract.productInfo.length > 0
    ) {
      const contractItems =
        type === "edit"
          ? invoiceData.items.map((product, index) => {
              return {
                id: index + 1,
                quantity: product.quantity || 0,
                description: product?.description,
                unitPrice: product.unitPrice || 0, // ✅ fixed typo
                discount: product.discount || 0,
                total:
                  product.totalValue ||
                  (product.quantity || 0) * (product.unitPrice || 0), // ✅ use totalValue if present, else calculate
              };
            })
          : selectedContract.productInfo.map((product, index) => {
              return {
                id: index + 1,
                quantity: product.quantityMTS || 0,
                description: `${product.title}\n${
                  product.shippingTerms?.replace(/<[^>]*>/g, "") || ""
                }`,
                unitPrice: product.price || 0,
                discount: 0,
                total: (product.quantityMTS || 0) * (product.price || 0),
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
            selectedContract.productInfo[0]?.selectedCurrency || prev.currency,
        };
      });
    }
  }, [selectedContract, setInvoiceData]);

  return (
    <div className="mb-6">
      <h2 className="text-xl font-medium mb-4">Item Table</h2>
      <div className="overflow-x-auto bg-white rounded-lg shadow">
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
                Unit Price (USD/MT)
              </th>
              <th className="p-3 text-left font-medium text-gray-600">
                Discount (%)
              </th>
              <th className="p-3 text-left font-medium text-gray-600">
                Total (USD)
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
                  index % 2 === 0 ? "bg-white" : "bg-gray-50"
                }`}
              >
                <td className="p-3">{index + 1}</td>
                <td className="p-3">
                  <input
                    type="number"
                    min="0"
                    value={item.quantity}
                    onChange={(e) =>
                      handleItemChange(index, "quantity", e.target.value)
                    }
                    className="w-full p-2 border border-gray-300 rounded"
                    step="0.01"
                  />
                </td>
                <td className="p-3">
                  <textarea
                    value={item.description}
                    onChange={(e) =>
                      handleItemChange(index, "description", e.target.value)
                    }
                    className="w-full p-2 border border-gray-300 rounded"
                    rows="3"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    min="0"
                    value={item.unitPrice}
                    onChange={(e) =>
                      handleItemChange(index, "unitPrice", e.target.value)
                    }
                    className="w-full p-2 border border-gray-300 rounded"
                    step="0.01"
                  />
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
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                  {item.discountError && (
                    <div className="text-red-500 text-xs mt-1">
                      {item.discountError}
                    </div>
                  )}
                </td>
                <td className="p-3">{(Number(item.total) || 0).toFixed(2)}</td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-3">
          <button
            type="button"
            onClick={handleAddItem}
            className="flex items-center text-[var(--p-blue)] hover:text-[#8CA82B]"
          >
            <Plus size={16} className="mr-1" />
            Add More
          </button>
        </div>
      </div>
    </div>
  );
};

export default ItemTable;
