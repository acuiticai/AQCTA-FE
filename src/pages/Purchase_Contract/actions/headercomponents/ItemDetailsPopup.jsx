import React from "react";
import {
  MdClose,
  MdInventory,
  MdAttachMoney,
  MdLocalShipping,
  MdTrendingUp,
  MdSchedule,
  MdInfo,
  MdGrade,
  MdCode,
  MdDescription,
  MdBusiness,
} from "react-icons/md";
import {
  formatAmount,
  formatDate,
  formatQuantity,
} from "@/components/formatAmount";
import moment from "moment";

const ItemDetailsPopup = ({
  isOpen,
  onClose,
  itemData,
  contractData,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  if (!itemData) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center">
          <div className="text-slate-500 mb-4">
            <MdInfo className="w-16 h-16 mx-auto text-slate-300" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            No Item Data
          </h3>
          <p className="text-slate-600 mb-4">
            Item information is not available for this contract.
          </p>
          <button
            onClick={onClose}
            className="bg-slate-600 hover:bg-slate-700 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200"
            aria-label="Close item details"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle escape key and focus trap
  React.useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // Focus the first focusable element
      const firstFocusable = document.querySelector("#item-popup-close");
      if (firstFocusable) {
        firstFocusable.focus();
      }
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 transition-all duration-300"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto transform transition-all duration-300 scale-100 animate-in fade-in-0 zoom-in-95">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                <MdInventory className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Item Details</h2>
                <p className="text-slate-200 text-sm">
                  Contract #{contractData?.contractNo || "N/A"}
                </p>
              </div>
            </div>
            <button
              id="item-popup-close"
              onClick={onClose}
              className="bg-white/10 hover:bg-white/20 hover:scale-110 backdrop-blur-sm rounded-xl p-3 transition-all duration-200"
              aria-label="Close item details"
            >
              <MdClose className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600 text-lg font-medium">
                  Loading item details...
                </p>
              </div>
            </div>
          )}

          {/* Item Details - Only show when not loading */}
          {!isLoading && (
            <>
              {/* Item Basic Info */}
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl p-6 mb-6">
                <div className="flex items-center mb-4">
                  <div className="bg-slate-200 rounded-lg p-2 mr-3">
                    <MdInfo className="w-5 h-5 text-slate-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Basic Information
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <p className="text-sm text-slate-600 font-medium mb-1">
                      Item Name
                    </p>
                    <p className="text-slate-900 font-semibold text-lg">
                      {itemData?.name || itemData?.title || "N/A"}
                    </p>
                  </div>

                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <p className="text-sm text-slate-600 font-medium mb-1">
                      packing
                    </p>
                    <p className="text-slate-900 font-semibold">
                      {itemData?.packing || "N/A"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <p className="text-sm text-slate-600 font-medium mb-1">
                      Grade
                    </p>
                    <p className="text-slate-900 font-semibold">
                      {itemData?.grade || "N/A"}
                    </p>
                  </div>

                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <p className="text-sm text-slate-600 font-medium mb-1">
                      No of Packages
                    </p>
                    <p className="text-slate-900 font-semibold">
                      {itemData?.No_of_Packages || "N/A"}
                    </p>
                  </div>
                </div>

                {itemData?.remarks && (
                  <div className="mt-4">
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <p className="text-sm text-slate-600 font-medium mb-1">
                        Remarks
                      </p>
                      <p className="text-slate-900 font-semibold">
                        {itemData.remarks}
                      </p>
                    </div>
                  </div>
                )}
                {contractData.productInfo?.[0]?.container_type && (
                  <div className="mt-4">
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <p className="text-sm text-purple-600 font-medium mb-1">
                        Container Type
                      </p>
                      <p className="text-purple-900 font-semibold">
                        {contractData.productInfo?.[0]?.container_type}
                      </p>
                    </div>
                  </div>
                )}
                {contractData.productInfo?.[0]?.remarks && (
                  <div className="mt-4">
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <p className="text-sm text-purple-600 font-medium mb-1">
                        Remarks
                      </p>
                      <p className="text-purple-900 font-semibold">
                        {contractData.productInfo?.[0]?.remarks}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Quantity & Pricing */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 mb-6">
                <div className="flex items-center mb-4">
                  <div className="bg-blue-200 rounded-lg p-2 mr-3">
                    <MdTrendingUp className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-blue-900">
                    Quantity & Pricing
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <p className="text-sm text-blue-600 font-medium mb-1">
                      Quantity (FCL)
                    </p>
                    <p className="text-blue-900 font-semibold text-lg">
                      {contractData.productInfo?.[0]?.quantityFCL || "N/A"}
                    </p>
                  </div>

                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <p className="text-sm text-blue-600 font-medium mb-1">
                      Quantity (MTS)
                    </p>
                    <p className="text-blue-900 font-semibold text-lg">
                      {formatQuantity(
                        contractData.productInfo?.[0]?.quantityMTS
                      ) || "N/A"}
                    </p>
                  </div>

                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <p className="text-sm text-blue-600 font-medium mb-1">
                      Total Quantity (MTS)
                    </p>
                    <p className="text-blue-900 font-semibold text-lg">
                      {formatQuantity(
                        contractData.productInfo?.[0]?.quantityMTS *
                          contractData.productInfo?.[0]?.quantityFCL
                      ) || "N/A"}
                    </p>
                  </div>
                </div>

                {/* Additional Quantity Details from Fetched Item */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <p className="text-sm text-blue-600 font-medium mb-1">
                      Price per Unit
                    </p>
                    <p className="text-blue-900 font-semibold text-lg">
                      $
                      {formatAmount(contractData.productInfo?.[0]?.price) ||
                        "N/A"}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <p className="text-sm text-blue-600 font-medium mb-1">
                      Container Weight
                    </p>
                    <p className="text-blue-900 font-semibold text-lg">
                      {Array.isArray(
                        contractData.productInfo?.[0]?.containerWeight
                      )
                        ? contractData.productInfo?.[0]?.containerWeight.join(
                            ", "
                          )
                        : contractData.productInfo?.[0]?.containerWeight ||
                          "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-6 rounded-b-2xl border-t border-slate-200">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="bg-slate-600 hover:bg-slate-700 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200"
              aria-label="Close item details"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemDetailsPopup;
