"use client"

import { FiPlus, FiRefreshCw } from "react-icons/fi"
import ProductSection from "./sub-components/product-section"
import FooterButtons from "./sub-components/FooterButtons"
import usePurchaseProductInfo from "../hooks/useProductInfo"
import { useEffect } from "react"
import { usePurchaseContext } from "../context/PurchaseContractContext"

export default function ProductInfo({ selectedBusiness }) {
  const {
    sections,
    items,
    errors,
    addSection,
    removeSection,
    updateSection,
    handleSave,
    handleCancel,
    clearAutoFill,
    creatingForSales,
    salesContractData,
  } = usePurchaseProductInfo()

  // Ensure commissionPerMTS is set in each section from context if not already set
  const { commissionPerMTS } = usePurchaseContext();
  useEffect(() => {
    if (commissionPerMTS) {
      sections.forEach((section) => {
        if (!section.commissionPerMTS) {
          updateSection(section.id, "commissionPerMTS", commissionPerMTS);
        }
      });
    }
    // eslint-disable-next-line
  }, [commissionPerMTS, sections]);

  // Filter out items with status "Inactive"
  const activeItems = items.filter((item) => item.status !== "Inactive")

  console.log("ProductInfo active items", activeItems)

  return (
    <div className="mx-auto p-4 space-y-4">
      {creatingForSales && salesContractData && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-green-800 font-medium">
                Product information auto-filled from Sales Contract: {salesContractData.contractNo}
              </p>
              <p className="text-green-600 text-sm mt-1">
                Pricing and forecast fields are left empty for you to fill in purchase-specific details.
              </p>
            </div>
            <button
              onClick={clearAutoFill}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-white border border-green-300 rounded hover:bg-green-50 transition-colors"
              title="Clear auto-filled data and start fresh"
            >
              <FiRefreshCw size={14} />
              Clear Auto-fill
            </button>
          </div>
        </div>
      )}

      {sections.map((section) => (
        <ProductSection
          key={section.id}
          section={section}
          items={activeItems}
          errors={errors[section.id] || {}}
          onUpdate={(field, value) => updateSection(section.id, field, value)}
          onRemove={() => removeSection(section.id)}
        />
      ))}

      {/* <button onClick={addSection} className="flex items-center text-[#98b93c] gap-1 hover:underline">
        <FiPlus /> Add More
      </button> */}

      <FooterButtons onSave={handleSave} onCancel={handleCancel} />
    </div>
  )
}
