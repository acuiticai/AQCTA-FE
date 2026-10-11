import React, { useEffect, useState } from "react";
import { FiEye } from "react-icons/fi";
import { useHistory } from "react-router-dom";
import { formatAmount } from "@/components/formatAmount";
import { formatDate } from "@/components/formatAmount";
import request from "@/services/httpService";
import { useTranslation } from "react-i18next";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const PurchaseContractSelector = ({
  isOpen,
  onClose,
  onSelect,
  salesContractData,
}) => {
  const { t } = useTranslation();
  const [purchaseContracts, setPurchaseContracts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const history = useHistory();

  useEffect(() => {
    if (isOpen) fetchContracts();
  }, [isOpen]);

  const fetchContracts = async () => {
    try {
      const response = await request.get(
        `/purchase-contracts?page=1&limit=100`
      );
      setPurchaseContracts(response.contracts || []);
    } catch (error) {
      console.error("❌ Failed to fetch purchase contracts", error);
    }
  };

  const handleCreateNew = () => {
    history.push({
      pathname: "/add-purchase-contract",
      state: {
        salesContractData,
      },
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex justify-center items-center">
      <div className="bg-white p-6 rounded-xl w-full max-w-5xl shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {t("salesContract.purchases.info", { defaultValue: "Purchases Info" })}
          </h2>
          <button className="text-gray-600 text-xl" onClick={onClose}>
            ×
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          {t("salesContract.purchases.selectorDescription", {
            defaultValue:
              "Review the purchases info below related to the sales contract or create a new one.",
          })}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full border rounded text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">{t("common.select", { defaultValue: "Select" })}</th>
                <th className="p-3 text-left">{t("salesContract.purchases.contractNo", { defaultValue: "Purchase Contract No" })}</th>
                <th className="p-3 text-left">{t("salesContract.purchases.buyerName", { defaultValue: "Buyer Name" })}</th>
                <th className="p-3 text-left">{t("common.quantity", { defaultValue: "Quantity" })}</th>
                <th className="p-3 text-left">{t("common.price", { defaultValue: "Price" })}</th>
                <th className="p-3 text-left">{t("salesContract.purchases.perMetricTon", { defaultValue: "Per Metric Ton" })}</th>
                <th className="p-3 text-left">{t("common.status", { defaultValue: "Status" })}</th>
                <th className="p-3 text-left">{t("common.action", { defaultValue: "Action" })}</th>
              </tr>
            </thead>
            <tbody>
              {purchaseContracts.map((p, i) => (
                <tr key={i} className="border-t hover:bg-gray-50">
                  <td className="p-3">
                    <input
                      type="radio"
                      checked={selectedId === p._id}
                      onChange={() => setSelectedId(p._id)}
                    />
                  </td>
                  <td className="p-3">{p.contractNo}</td>
                  <td className="p-3">
                    {
                      p?.basicInfo?.selectedVendorId?.basicInformation
                        ?.vendorDisplayName
                    }
                  </td>
                  <td className="p-3">{p?.productInfo?.[0]?.quantityMTS}</td>
                  <td className="p-3">
                    {formatAmount(p?.productInfo?.[0]?.price)}
                  </td>
                  <td className="p-3">
                    {formatAmount(p?.productInfo?.[0]?.price)}
                  </td>
                  <td className="p-3 text-yellow-500 font-medium">
                    {p.status}
                  </td>
                  <td className="p-3">
                    <button
                      className="text-gray-600 hover:text-gray-900"
                      onClick={() =>
                        history.push({
                          pathname: "/view-purchase-contract",
                          state: { contractId: p._id },
                        })
                      }
                    >
                      <FiEye />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-4 mt-6">
          <button
            className="px-6 py-2 rounded bg-gray-100 hover:bg-gray-200"
            onClick={onClose}
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </button>
          <button
            className="px-6 py-2 rounded bg-[var(--p-blue)] text-white hover:bg-[#92b726]"
            onClick={handleCreateNew}
          >
            {t("common.createNew", { defaultValue: "Create New" })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PurchaseContractSelector;
