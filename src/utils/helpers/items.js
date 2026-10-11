// Get Item Name
function getItemName(item = {}) {
  const { name, grade, packing, remarks } = item;
  return `${name || ""}${grade ? ` (${grade})` : ""}${
    packing ? ` - ${packing}` : ""
  }${remarks ? ` - ${remarks}` : ""}`;
}

// Prepare quantity options from selected item
const getQuantityOptions = (selectedItemDetails) => {
  if (
    selectedItemDetails &&
    selectedItemDetails.quantity_MTS &&
    Array.isArray(selectedItemDetails.quantity_MTS)
  ) {
    return selectedItemDetails.quantity_MTS.map((qty) => {
      // Extract numeric value from string like "20.16MTS"
      const numericValue = Number.parseFloat(qty.replace(/[^0-9.]/g, ""));
      return {
        value: numericValue.toString(),
        label: qty,
      };
    });
  }
  return [];
};
// Prepare packages options from selected item
const getPackagesOptions = (selectedItemDetails) => {
  if (
    selectedItemDetails &&
    selectedItemDetails.No_of_Packages &&
    Array.isArray(selectedItemDetails.No_of_Packages)
  ) {
    return selectedItemDetails.No_of_Packages.map((pkg) => ({
      value: pkg,
      label: pkg,
    }));
  }
  return [];
};

// Update unit of container directly based on FCL and container type
const updateUnitOfContainer = (
  fcl = section.quantityFCL,
  containerType = section.containerType,
  onUpdate = () => {},
  currentFormData = formData
) => {
  console.log("fcl", fcl);
  console.log("containerType", containerType);
  if (!containerType) return;

  const fclValue = fcl || "1";
  const unitOfContainer = `${fclValue}X${containerType}`;

  onUpdate("unitOfContainer", unitOfContainer, currentFormData);
};

const getUnitOfContainer = (fcl, containerType) => {
  if (!containerType) return;

  const fclValue = fcl || "1";
  const unitOfContainer = `${fclValue}X${containerType}`;
  return unitOfContainer;
};

export {
  getItemName,
  getQuantityOptions,
  getPackagesOptions,
  updateUnitOfContainer,
  getUnitOfContainer,
};
