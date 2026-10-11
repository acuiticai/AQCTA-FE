import { FiPlus } from "react-icons/fi";
import CollapsibleSection from "./sub-componnets/collapse-section";
import FormField from "./sub-componnets/form-fields";
import PriceInput from "./sub-componnets/price-input";

const ProductForm = () => {
  return (
    <div className="bg-white rounded-lg shadow-md border p-4 mt-4">
      <CollapsibleSection title="Requested By">
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Item" type="select" options={["Item"]} />
            <FormField
              label="Quantity (FCL)"
              type="text"
              placeholder="Quantity (FCL)"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Quantity (MT/FCL)"
              type="text"
              placeholder="Quantity (MT/FCL)"
            />
            <FormField label="To Issue" type="select" options={["To Issue"]} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <PriceInput label="Price" />
            <PriceInput label="Additional Price (If Any)" />
          </div>

          <PriceInput label="Total Value" disabled placeholder="Total Value" />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Type of Product"
              type="select"
              options={["Type of Product"]}
            />
            <FormField
              label="Delivery Terms"
              type="select"
              options={["Delivery Terms"]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Packing" type="select" options={["Packing"]} />
            <FormField
              label="Payment Terms"
              type="select"
              options={["Payment Terms"]}
            />
          </div>

          <FormField
            label="Breakeven Value"
            type="text"
            placeholder="Breakeven Value"
          />
        </div>
      </CollapsibleSection>

      {/* Add More Section */}
      <div className="mt-4 flex items-center text-green-500 cursor-pointer hover:underline">
        <FiPlus className="mr-1" /> Add More
      </div>
    </div>
  );
};

export default ProductForm;
