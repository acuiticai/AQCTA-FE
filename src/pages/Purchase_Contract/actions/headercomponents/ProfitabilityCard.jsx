import React from "react";
import { formatAmount } from "@/components/formatAmount";

const ProfitabilityCard = ({ Data }) => {
  const contractValue = Data?.productInfo?.[0]?.totalValue || 0;
  const purchases = 0//Data?.productInfo?.[0]?.price || 0;
  const otherExpenses = 0// Data?.productInfo?.[0]?.deposit || 0;
  const profitability = contractValue - (purchases + otherExpenses);

  return (
    <div className="p-4 shadow-md rounded-md border w-72 bg-white">
      <h3 className="font-semibold">Profitability</h3>
      <p><strong>Contract Value:</strong> <span className="text-black">${formatAmount(contractValue)}</span></p>
      <p><strong>Purchases:</strong> <span className="text-red-500">- ${formatAmount(purchases)}</span></p>
      <p><strong>Other Expenses:</strong> <span className="text-red-500">- ${formatAmount(otherExpenses)}</span></p>
      <p><strong>Profitability:</strong> <span className="text-green-500">${formatAmount(profitability)}</span></p>
    </div>
  );
};

export default ProfitabilityCard;
