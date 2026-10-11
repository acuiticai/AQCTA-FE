import { useState } from "react";
import { FiPlus } from "react-icons/fi";
import FooterButtons from "./sub-components/FooterButtons";

import VendorSection from "./sub-components/vendor-section";

export default function ContractPurchases() {
  const [sections, setSections] = useState([{ id: 1, title: "Vendor Name" }]);

  const addSection = () => {
    setSections([...sections, { id: Date.now(), title: "Vendor Name" }]);
  };

  const removeSection = () => {
    setSections(sections.filter((section) => section.id !== id));
  };

  return (
    <div className="mx-auto p-4 space-y-4">
      {sections.map((section) => (
        <VendorSection
          key={section.id}
          title={section.title}
          onRemove={() => removeSection(section.id)}
        />
      ))}

      {/* Add More Button */}
      <button 
        onClick={addSection}
        className="flex items-center text-[#98b93c] gap-1 hover:underline"
      >
        <FiPlus /> Add More
      </button>

      {/* Action Buttons */}
      <FooterButtons />
    </div>
  );
}
