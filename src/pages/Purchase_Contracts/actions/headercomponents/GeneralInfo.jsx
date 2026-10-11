import React from "react";
import { formatAmount } from "@/components/formatAmount";

const InvoiceItem = ({ item, description, quantity, unitPrice, total }) => (
  <tr className="border-b border-gray-200">
    <td className="py-4 pr-4">{item}</td>
    <td className="py-4 pr-4 text-gray-600">{description}</td>
    <td className="py-4 pr-4 text-right">{quantity}</td>
    <td className="py-4 pr-4 text-right">${formatAmount(unitPrice)}</td>
    <td className="py-4 text-right">${formatAmount(total)}</td>
  </tr>
);

const GeneralInfo = ({ Data }) => {
  const invoiceData = {
    items: Data?.productInfo?.map((prod) => ({
      item: prod.title || "N/A",
      description: prod.productType || "N/A",
      quantity: prod.quantityMTS || 0,
      unitPrice: prod.price || 0,
      total: prod.totalValue || 0,
    })) || [],
    totalAmount: Data?.productInfo?.reduce((sum, prod) => sum + (prod.totalValue || 0), 0),
  };

  return (
    <div className="mx-auto px-6 text-sm bg-white">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 pr-4">Item</th>
            <th className="text-left py-2 pr-4">Description</th>
            <th className="text-right py-2 pr-4">Qty.</th>
            <th className="text-right py-2 pr-4">Unit Price (USD/MT)</th>
            <th className="text-right py-2">Total (USD)</th>
          </tr>
        </thead>
        <tbody>
          {invoiceData.items.map((item, index) => (
            <InvoiceItem
              key={index}
              item={item.item}
              description={item.description}
              quantity={item.quantity}
              unitPrice={item.unitPrice}
              total={item.total}
            />
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-gray-600 mb-2">
          <strong>Total:</strong> ${formatAmount(invoiceData?.totalAmount)}
        </div>
      </div>
    </div>
  );
};

export default GeneralInfo;
