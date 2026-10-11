import { FiPlus } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import ProductSection from "./sub-components/product-section";
import { FooterButtons } from "@/page-layouts";
import useProductInfo from "../hooks/useProductInfo";
import { useSalesContext } from "../context/SalesContractContext";
import { useEffect, useState } from "react";
import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

export default function ProductInfo({selectedBusiness }) {
  const { t } = useTranslation();
  const {
    sections,
    items,
    errors,
    addSection,
    removeSection,
    updateSection,
    handleSave,
    handleCancel,
  } = useProductInfo();

  const { contractId } = useSalesContext();
  const [contractType, setContractType] = useState("");

  // Fetch contract type from basic info
  useEffect(() => {
    const fetchContractType = async () => {
      if (!contractId) return;
      
      try {
        const response = await axios.get(`${Base_URL}/sales-contracts/${contractId}`);
        const contract = response.data;
        setContractType(contract.basicInfo?.typeOfSaleContract || "");
      } catch (error) {
        console.error("Error fetching contract type:", error);
      }
    };

    fetchContractType();
  }, [contractId]);

  // Filter out items with status "Inactive"
  const activeItems = items.filter((item) => item.status !== "Inactive");

  console.log("ProductInfo active items", activeItems);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleSave();
      }}
      className="mx-auto space-y-4"
    >
      {sections.map((section) => (
        <ProductSection
          key={section.id}
          section={{ ...section, contractType }}
          items={activeItems}
          errors={errors[section.id] || {}}
          onUpdate={(field, value) => updateSection(section.id, field, value)}
          onRemove={() => removeSection(section.id)}
        />
      ))}

      <FooterButtons 
        onSave={handleSave} 
        onCancel={handleCancel}
        cancelButtonText={t("Cancel")}
        saveButtonText={t("Save")}
      />
    </form>
  );
}
