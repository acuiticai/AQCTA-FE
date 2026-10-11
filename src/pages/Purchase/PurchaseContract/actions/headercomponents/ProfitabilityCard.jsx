import React from "react";

const ProfitabilityCard = () => {
  return (
    <div className="p-4  shadow-md rounded-md border w-72">
      <h3 className="font-semibold">Profitability</h3>
      <p><strong>Contract Value:</strong> <span className="text-black">$121209.00</span></p>
      <p><strong>Purchases:</strong> <span className="text-red-500">- $2323.00</span></p>
      <p><strong>Other Expenses:</strong> <span className="text-red-500">- $2323.00</span></p>
      <p><strong>Profitability:</strong> <span className="text-green-500">$123872.00</span></p>
    </div>
  );
};

export default ProfitabilityCard;
