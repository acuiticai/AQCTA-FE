"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function LabelEditor({ labels, onLabelsChange }) {
  const [expanded, setExpanded] = useState(true);

  const handleLabelChange = (section, field, value) => {
    const newLabels = { ...labels };

    if (!newLabels[section]) {
      newLabels[section] = {};
    }

    newLabels[section][field] = value;
    onLabelsChange(newLabels);
  };

  // Define sections and their fields
  const sections = [
    {
      id: "headerData",
      title: "Header Labels",
      fields: [
        { id: "tagline", label: "Tagline", placeholder: "Rubber Contract No:" },
        {
          id: "invoiceNumber",
          label: "Contract Number",
          placeholder: "S2410-N1107",
        },
        { id: "buyerInfo", label: "Buyer", placeholder: "Company Name" },
        { id: "contractNo", label: "Reference", placeholder: "REF" },
        { id: "date", label: "Date", placeholder: "DD-MM-YYYY" },
      ],
    },
    {
      id: "gradeQuantity",
      title: "Grade & Quantity Labels",
      fields: [
        { id: "grade", label: "Grade Label", placeholder: "Grade:" },
        { id: "quantity", label: "Quantity Label", placeholder: "Quantity:" },
        { id: "price", label: "Price Label", placeholder: "Price:" },
      ],
    },
    {
      id: "payment",
      title: "Payment Labels",
      fields: [
        { id: "payment", label: "Payment Method", placeholder: "Payment:" },
        { id: "beneficiary", label: "Beneficiary", placeholder: "Beneficiary" },
        {
          id: "accountHolder",
          label: "Account Holder",
          placeholder: "Account Holder",
        },
        {
          id: "accountNumber",
          label: "Account Number",
          placeholder: "Account Number",
        },
        { id: "bankName", label: "Bank Name", placeholder: "Bank Name" },
      ],
    },
    {
      id: "shipping",
      title: "Shipping Labels",
      fields: [
        { id: "totalValue", label: "Total Value", placeholder: "Total Value:" },
        {
          id: "shippingTerms",
          label: "Shipping Terms",
          placeholder: "Shipping Terms:",
        },
        { id: "packing", label: "Packing", placeholder: "Packing:" },
        {
          id: "etdPortLoading",
          label: "ETD Port",
          placeholder: "ETD Port of Loading:",
        },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Field Labels</h3>
        <button onClick={() => setExpanded(!expanded)}>
          <ChevronDown
            className={`w-5 h-5 transition-transform ${
              expanded ? "transform rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {expanded && (
        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.id} className="space-y-3">
              <h4 className="text-sm font-medium text-gray-600 border-b border-gray-200 pb-1">
                {section.title}
              </h4>

              <div className="space-y-2">
                {section.fields.map((field) => (
                  <div
                    key={field.id}
                    className="grid grid-cols-2 gap-2 items-center"
                  >
                    <label className="text-xs text-gray-500">
                      {field.label}
                    </label>
                    <input
                      type="text"
                      value={labels[section.id]?.[field.id] || ""}
                      onChange={(e) =>
                        handleLabelChange(section.id, field.id, e.target.value)
                      }
                      placeholder={field.placeholder}
                      className="w-full p-1.5 text-sm border border-gray-300 rounded-md"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
            <p className="text-xs text-blue-700">
              <strong>Note:</strong> These are only the labels for your
              template. The actual data will be populated from the backend when
              creating a document using this template.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
