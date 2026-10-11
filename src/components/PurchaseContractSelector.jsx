import React, { useEffect, useState } from "react";
import { FiEye } from "react-icons/fi";
import { useHistory } from "react-router-dom";
import { formatAmount, formatDate } from "@/components/formatAmount";
import request from "@/services/httpService";
import { notifySuccess } from "@/utils/toast";
import { notifyError } from "@/utils/toast";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const PurchaseContractSelector = ({
  isOpen,
  onClose,
  salesContractData,
  alreadyAssignedContracts = [],
}) => {
  const [purchaseContracts, setPurchaseContracts] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const history = useHistory();

  useEffect(() => {
    if (isOpen) fetchContracts();
  }, [isOpen]);

  const fetchContracts = async () => {
    try {
      const response = await request.get(
        `${Base_URL}/purchase-contracts/MatchingWithSales/${salesContractData._id}`
      );
      setPurchaseContracts(response.contracts || []);
    } catch (error) {
      console.error("❌ Failed to fetch purchase contracts", error);
    }
  };

  const toggleSelect = (id) => {
    // If already selected, unselect freely
    if (selectedIds.includes(id)) {
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      return;
    }

    // When selecting, enforce FCL limit (cannot exceed contractFCL)
    const contract = purchaseContracts.find((p) => p._id === id);
    const thisFCL = Number(contract?.productInfo?.[0]?.quantityFCL) || 0;

    const currentSelectedFCL = purchaseContracts.reduce((sum, p) => {
      if (!selectedIds.includes(p._id)) return sum;
      const fcl = Number(p?.productInfo?.[0]?.quantityFCL) || 0;
      return sum + fcl;
    }, 0);

    // Total FCL already committed = existing links + current selections
    const totalCommittedFCL = alreadyAssignedFCL + currentSelectedFCL;

    if (totalCommittedFCL + thisFCL > contractFCL) {
      const remaining = Math.max(contractFCL - totalCommittedFCL, 0);
      notifyError(
        `You can select up to ${remaining} FCL more. This contract would exceed the Sales Contract limit (${contractFCL} FCL).`
      );
      return;
    }

    setSelectedIds((prev) => [...prev, id]);
  };

  const handleCreateNew = () => {
    history.push({
      pathname: "/add-purchase-contract",
      state: {
        salesContractData,
        creating_For_Sales: true,
      },
    });
  };

  const handleSelect = async () => {
    console.log("selectedIds", selectedIds);

    // Validate that at least one contract is selected
    if (!selectedIds || selectedIds.length === 0) {
      notifyError("Please select at least one contract before proceeding.");
      return;
    }

    try {
      const response = await request.post(
        `${Base_URL}/purchase-contracts/assign_purchase_to_sales/${salesContractData._id}`,
        { purchase_ids: selectedIds }
      );
      console.log("Sales Contract response ", response);
      if (response.status) {
        notifySuccess(response.message);
        onClose();
      } else {
        notifyError(response.message);
        onClose();
      }
    } catch (error) {
      console.error("❌ Failed to fetch purchase contracts", error);
      notifyError("Failed to assign contracts. Please try again.");
    }
  };

  if (!isOpen) return null;

  const contractFCL =
    Number(salesContractData?.productInfo?.[0]?.quantityFCL) || 0;

  // FCL already linked to this sales contract (shown in Purchase Contracts table)
  const alreadyAssignedFCL = (alreadyAssignedContracts || []).reduce(
    (sum, p) => sum + (Number(p?.productInfo?.[0]?.quantityFCL) || 0),
    0
  );

  const selectedFCL = purchaseContracts.reduce((sum, p) => {
    if (!selectedIds.includes(p._id)) return sum;
    const purchaseFCL = Number(p?.productInfo?.[0]?.quantityFCL) || 0;
    return sum + purchaseFCL;
  }, 0);

  // Effective remaining capacity after accounting for already assigned + newly selected
  const remainingFCL = Math.max(
    contractFCL - alreadyAssignedFCL - selectedFCL,
    0
  );

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex justify-center items-center">
      <div className="bg-white p-6 rounded-xl w-full max-w-6xl shadow-lg">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Purchases Info</h2>
          <button className="text-gray-600 text-xl" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 mb-2">
          Review the purchase contracts below related to the sales contract or
          create a new one.
        </p>
        {typeof salesContractData?.productInfo?.[0]?.quantityFCL !==
          "undefined" && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-gray-700 mb-4 bg-gray-50 px-4 py-2 rounded">
            <div>
              <span className="font-medium mr-1">
                Sales Contract Quantity FCL:
              </span>
              <span className="text-green-700 font-semibold">
                {contractFCL}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
              <span>
                Selected:&nbsp;
                <span className="font-semibold text-blue-700">
                  {selectedFCL}
                </span>{" "}
                FCL
              </span>
              <span>
                Remaining:&nbsp;
                <span
                  className={`font-semibold ${
                    remainingFCL > 0 ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {contractFCL} - ({alreadyAssignedFCL} + {selectedFCL}) ={" "}
                  {remainingFCL}
                </span>{" "}
                FCL
              </span>
            </div>
          </div>
        )}
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto border rounded-lg shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-[#F7FAF7] sticky top-0 z-10">
              <tr>
                <th className="p-3 text-left font-semibold">Select</th>
                <th className="p-3 text-left font-semibold">
                  Supplier Contract #
                </th>
                <th className="p-3 text-left font-semibold">Supplier</th>
                <th className="p-3 text-left font-semibold">Item</th>
                <th className="p-3 text-left font-semibold">Grade</th>
                <th className="p-3 text-left font-semibold">QTY (MTS)</th>
                <th className="p-3 text-left font-semibold">Price USD/MT</th>
                <th className="p-3 text-left font-semibold">Status</th>
                <th className="p-3 text-left font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {purchaseContracts.map((p, i) => (
                <tr key={i} className="border-t hover:bg-[#F4F8F4] transition">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      className="accent-[var(--p-blue)] w-4 h-4"
                      checked={selectedIds.includes(p._id)}
                      onChange={() => toggleSelect(p._id)}
                    />
                  </td>
                  <td className="p-3">
                    {p?.basicInfo?.supplierContractNo || p.contractNo}
                  </td>
                  <td className="p-3">
                    {p?.basicInfo?.selectedVendorId?.basicInformation
                      ?.vendorDisplayName || "-"}
                  </td>
                  <td className="p-3">
                    {`${p?.productInfo?.[0]?.title || ""} ${
                      p?.productInfo?.[0]?.packing || ""
                    } : ${p?.productInfo?.[0]?.remarks || ""}`}
                  </td>
                  <td className="p-3">
                    {p?.productInfo?.[0]?.item?.grade ||
                      p?.productInfo?.[0]?.grade ||
                      "N/A"}
                  </td>
                  <td className="p-3">
                    {(() => {
                      const quantityMTS = p?.productInfo?.[0]?.quantityMTS || 0;
                      const quantityFCL = p?.productInfo?.[0]?.quantityFCL || 0;
                      const totalQTY = quantityMTS * quantityFCL;
                      return formatAmount(totalQTY);
                    })()}
                  </td>
                  <td className="p-3">
                    {formatAmount(p?.productInfo?.[0]?.price) ?? "-"}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium
                      ${
                        p.status === "Active"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <button
                      className="text-gray-600 hover:text-[var(--p-blue)] transition"
                      title="View"
                      onClick={() =>
                        history.push({
                          pathname: "/view-purchase-contract",
                          state: { contractId: p._id },
                        })
                      }
                    >
                      <FiEye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {purchaseContracts.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-gray-500">
                    No purchase contracts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-4 mt-6">
          <button
            onClick={handleSelect}
            className="px-6 py-2 rounded bg-[var(--p-blue)] text-white hover:bg-[#92b726]"
          >
            Select Contract
          </button>
          <button
            onClick={handleCreateNew}
            className="px-6 py-2 rounded border border-[var(--p-blue)] text-[var(--p-blue)] hover:bg-[#f3fbe0]"
          >
            Create New
          </button>
        </div>
      </div>
    </div>
  );
};

export default PurchaseContractSelector;
