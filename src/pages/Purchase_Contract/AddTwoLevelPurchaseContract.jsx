"use client";

import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useHistory } from "react-router-dom";
import { notifySuccess, notifyError } from "@/utils/toast";
import { FiUploadCloud, FiCalendar } from "react-icons/fi";
import { countries } from "countries-list";
import worldPorts from "@/data/world-ports";
import { DropdownBasic } from "@/page-layouts";
import DropdownWithAddNewFormSaleC from "@/components/DropdownWithAddNewFormSaleC";
import DocumentUpload from "@/components/DocumentUpload";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

// Helper function to get current month in YYYY-MM format for min attribute
const getCurrentMonthMin = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const initialPurchase = {
  business: "",
  selectedVendorId: "",
  SupplierName: "",
  agentName: "",
  selectedAgentId: "",
  commissionPerMTS: "",
  ETD_Port: "",
  supplierContractNo: "",
  supplierContractDate: "",
  contractDate: new Date().toISOString().split("T")[0], // Auto-fill with current date
  item: "",
  itemId: "",
  grade: "",
  containerType: "",
  fclSize: "",
  quantityFCL: "",
  quantityMTS: "",
  unitOfContainer: "",
  No_of_Packages: "",
  price: "",
  additionalCharges: "",
  totalValue: "",
  shippingTerms: "",
  paymentTerms: "",
  packing: "",
  remarks: "",
  portOfDestination: "",
  portOfLanding: "",
  origin_country: "",
  estimatedDeparture: "",
  deposit: "",
  breakEvenValue: "",
  totalQuantity: "",
  totalAgentCommission: "",
  supportingDocument: null,
  supplierType: "External",
  customerType: "External",
};

const initialSale = {
  typeOfSaleContract: "",
  salesPerson: "",
  buyerCompanyName: "",
  customerId: "",
  selectedCustomerId: "",
  agentName: "",
  selectedAgentId: "",
  commissionPerMTS: "",
  bankAccount: "",
  selectedBankId: "",
  remarks: "",
  supplierType: "External",
  customerType: "Internal",
  item: "",
  itemId: "",
  grade: "",
  containerType: "",
  fclSize: "",
  quantityFCL: "",
  quantityMTS: "",
  unitOfContainer: "",
  No_of_Packages: "",
  price: "",
  deposit: "",
  totalValue: "",
  selectedCurrency: null,
  conversionRate: "",
  amountInSelectedCurrency: "",
  packing: "",
  shippingTerms: "",
  paymentTerms: "",
  forecasted_shipment_cost: "",
  // Common fields for both Sale Contract 1 and 2
  ref: "",
  contractCreationDate: new Date().toISOString().split("T")[0], // Auto-fill with current date
  contractDate: "",
  ETD_Port: new Date().toISOString().slice(0, 7), // Auto-fill with current month/year
  port_of_loading: "",
  port_of_discharge: "",
  origin_country: "",
  totalQuantity: "",
  totalAgentCommission: "",
  forecastCostDescription: "",
  forecastCost: "",
  forecastTotalCost: "",
  // Profit Sharing specific fields
  finalCustomerName: "",
  selectedFinalCustomerId: "",
  salesContractNumberByFirstCustomer: "",
  priceForFinalCustomer: "",
};

const SECTION_KEYS = ["basePurchase", "sale1", "purchase2", "sale2"];

const requiredFields = {
  basePurchase: [
    "business",
    "selectedVendorId",
    "itemId",
    "quantityFCL",
    "quantityMTS",
    "price",
    "origin_country",
    "portOfLanding",
    "portOfDestination",
    "estimatedDeparture",
    "paymentTerms",
    "shippingTerms",
  ],
  sale1: [
    "typeOfSaleContract",
    "salesPerson",
    "buyerCompanyName",
    "contractDate",
    "price",
    "paymentTerms",
    "shippingTerms",
  ],
  purchase2: [
    "business",
    "selectedVendorId",
    "price",
    "paymentTerms",
    "shippingTerms",
  ],
  sale2: [
    "business",
    "salesPerson",
    "buyerCompanyName",
    "contractDate",
    "price",
    "paymentTerms",
    "shippingTerms",
  ],
};

const sectionLabels = {
  basePurchase: "Base Purchase Contract",
  sale1: "Sale Contract 1",
  purchase2: "Purchase Contract 2",
  sale2: "Sale Contract 2",
};

const stepToSectionMap = {
  1: "basePurchase",
  2: "sale1",
  3: "purchase2",
  4: "sale2",
};

const sectionToStepMap = {
  basePurchase: 1,
  sale1: 2,
  purchase2: 3,
  sale2: 4,
};

const hasValue = (value) => {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
};

export default function AddTwoLevelPurchaseContract() {
  const history = useHistory();
  const fileInputRef = useRef();

  // Get base purchase data from location state
  const location = history.location;
  const basePurchaseData = location.state?.basePurchaseData;
  const isFromExistingContract = location.state?.isFromExistingContract;

  // State for each contract section
  const [basePurchase, setBasePurchase] = useState({ ...initialPurchase });
  const [sale1, setSale1] = useState({ ...initialSale });
  const [purchase2, setPurchase2] = useState({ ...initialPurchase });
  const [sale2, setSale2] = useState({ ...initialSale });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Track auto-managed price state and previous base price
  const [sale1PriceIsAuto, setSale1PriceIsAuto] = useState(true);
  const [purchase2PriceIsAuto, setPurchase2PriceIsAuto] = useState(true);
  const prevBasePriceRef = useRef("");

  // Track if user wants to submit to management
  const [submitToManagement, setSubmitToManagement] = useState(false);

  // Step navigation state
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [showDisabledFields, setShowDisabledFields] = useState(false);

  // State for dropdown data
  const [businesses, setBusinesses] = useState([]);
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [agents, setAgents] = useState([]);
  const [banks, setBanks] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [loadingPaymentTerms, setLoadingPaymentTerms] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [selectedItemDetails, setSelectedItemDetails] = useState(null);
  const [itemLoading, setItemLoading] = useState(false);
  const [forecastCostDescriptions, setForecastCostDescriptions] = useState([]);
  const [loadingForecastCostDesc, setLoadingForecastCostDesc] = useState(false);
  const [basePurchaseDocuments, setBasePurchaseDocuments] = useState([]);

  const sectionStateMap = {
    basePurchase,
    sale1,
    purchase2,
    sale2,
  };

  const isFieldRequired = (sectionKey, field) =>
    requiredFields[sectionKey]?.includes(field);

  const isSectionValid = (sectionKey) => {
    if (!sectionKey) return false;
    const sectionState = sectionStateMap[sectionKey];
    if (!sectionState) return true;
    const fields = requiredFields[sectionKey] || [];
    return fields.every((field) => hasValue(sectionState[field]));
  };

  const getFirstInvalidSection = () =>
    SECTION_KEYS.find((sectionKey) => !isSectionValid(sectionKey));

  // Add state for items for internal business
  const [internalBusinessItems, setInternalBusinessItems] = useState([]);
  const [internalBusinessSuppliers, setInternalBusinessSuppliers] = useState(
    []
  );
  const [internalBusinessCustomers, setInternalBusinessCustomers] = useState(
    []
  );
  const [internalBusinessSalespersons, setInternalBusinessSalespersons] =
    useState([]);
  const [internalBusinessBanks, setInternalBusinessBanks] = useState([]);

  // Autosave draft state
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const draftKey = "twoLevelContractDraft";
  const saveTimerRef = useRef(null);

  // Function to map existing contract data to base purchase form
  const mapContractToBasePurchase = (contract) => {
    if (!contract) return initialPurchase;

    console.log("🔍 Mapping contract to base purchase:", contract);
    console.log("🔍 Contract basicInfo:", contract.basicInfo);
    console.log("🔍 Contract basicInformation:", contract.basicInformation);

    // Extract supplier information with better fallbacks
    let supplierId = "";
    let supplierName = "";

    if (contract.basicInfo?.selectedVendorId) {
      if (typeof contract.basicInfo.selectedVendorId === "object") {
        supplierId =
          contract.basicInfo.selectedVendorId._id ||
          contract.basicInfo.selectedVendorId;
        supplierName =
          contract.basicInfo.selectedVendorId.basicInformation
            ?.vendorDisplayName ||
          contract.basicInfo.selectedVendorId.basicInformation?.companyName ||
          contract.basicInfo.selectedVendorId.name ||
          "";
      } else {
        supplierId = contract.basicInfo.selectedVendorId;
        supplierName = contract.basicInfo.selectedVendorId; // fallback to ID if no name found
      }
    } else if (contract.basicInformation?.vendorDisplayName) {
      supplierName =
        contract.basicInformation.vendorDisplayName ||
        contract.basicInformation.companyName ||
        "";
    }

    const mappedData = {
      business: contract.business?._id || contract.business || "",
      selectedVendorId: supplierId,
      SupplierName: supplierName,
      agentName: contract.basicInfo?.agentName || contract.agentName || "",
      selectedAgentId: contract.basicInfo?.selectedAgentId || "",
      commissionPerMTS: contract.basicInfo?.commissionPerMTS || "",
      ETD_Port: contract.basicInfo?.ETD_Port || "",
      contractDate:
        contract.basicInfo?.contractDate || contract.contractDate || "",
      item: contract.productInfo?.[0]?.item?.name || contract.item || "",
      itemId: contract.productInfo?.[0]?.item?._id || contract.itemId || "",
      grade: contract.productInfo?.[0]?.grade || contract.grade || "",
      containerType:
        contract.productInfo?.[0]?.containerType ||
        contract.containerType ||
        "",
      fclSize: contract.productInfo?.[0]?.fclSize || contract.fclSize || "",
      quantityFCL:
        contract.productInfo?.[0]?.quantityFCL || contract.quantityFCL || "",
      quantityMTS:
        contract.productInfo?.[0]?.quantityMTS || contract.quantityMTS || "",
      unitOfContainer:
        contract.productInfo?.[0]?.unitOfContainer ||
        contract.unitOfContainer ||
        "",
      No_of_Packages:
        contract.productInfo?.[0]?.No_of_Packages ||
        contract.No_of_Packages ||
        "",
      price: contract.productInfo?.[0]?.price || contract.price || "",
      additionalCharges:
        contract.productInfo?.[0]?.additionalCharges ||
        contract.additionalCharges ||
        "",
      totalValue:
        contract.productInfo?.[0]?.totalValue || contract.totalValue || "",
      shippingTerms:
        contract.productInfo?.[0]?.shippingTerms ||
        contract.shippingTerms ||
        "",
      paymentTerms:
        contract.productInfo?.[0]?.paymentTerms || contract.paymentTerms || "",
      packing: contract.productInfo?.[0]?.packing || contract.packing || "",
      remarks: contract.productInfo?.[0]?.remarks || contract.remarks || "",
      portOfDestination:
        contract.productInfo?.[0]?.portOfDestination ||
        contract.portOfDestination ||
        "",
      portOfLanding:
        contract.productInfo?.[0]?.portOfLanding ||
        contract.portOfLanding ||
        "",
      origin_country:
        contract.productInfo?.[0]?.origin_country ||
        contract.origin_country ||
        "",
      estimatedDeparture:
        contract.productInfo?.[0]?.estimatedDeparture ||
        contract.estimatedDeparture ||
        "",
      deposit: contract.productInfo?.[0]?.deposit || contract.deposit || "",
      breakEvenValue:
        contract.productInfo?.[0]?.breakEvenValue ||
        contract.breakEvenValue ||
        "",
      supportingDocument: contract.supportingDocument || null,
      supplierType: contract.supplierType || "External",
      customerType: contract.customerType || "External",
    };

    console.log("🔍 Mapped supplier data:", { supplierId, supplierName });
    console.log("🔍 Final mapped data:", mappedData);

    return mappedData;
  };

  // List of fields to sync from basePurchase to other contracts
  const sharedFields = [
    "itemId",
    "item",
    "grade",
    "containerType",
    "fclSize",
    "quantityFCL",
    "quantityMTS",
    "unitOfContainer",
    "No_of_Packages",
    "packing",
    "origin_country",
    "portOfLanding",
    "portOfDestination",
    "estimatedDeparture",
  ];

  // List of common fields that should auto-sync across all contracts
  const commonFields = [
    "shippingTerms",
    "paymentTerms",
    "origin_country",
    "portOfLanding",
    "portOfDestination",
    "estimatedDeparture",
    "deposit",
    "breakEvenValue",
    "additionalCharges",
    "selectedCurrency",
    "conversionRate",
    "amountInSelectedCurrency",
    "totalValue",
    "quantityMTS",
    "quantityFCL",
    "unitOfContainer",
    "containerType",
    "fclSize",
    "No_of_Packages",
    "packing",
    "grade",
    "remarks",
  ];

  // Fields that should only sync from base purchase (not allow manual changes in other contracts)
  const baseOnlyFields = [
    "itemId",
    "item",
    "grade",
    "containerType",
    "fclSize",
    "unitOfContainer",
    "No_of_Packages",
    "packing",
    "remarks",
  ];

  // List of fields that are dropdowns in the regular sales contract
  const dropdownFields = [
    "itemId",
    "selectedCurrency",
    "packing",
    "shippingTerms",
    "paymentTerms",
    "origin_country",
    "port_of_loading",
    "port_of_discharge",
    "portOfLanding",
    "portOfDestination",
    "salesPerson",
  ];

  // List of fields to disable after item selection (matching standard contracts)
  const disableAfterItemSelectionFields = [
    "grade",
    "containerType",
    "fclSize",
    "unitOfContainer",
    "No_of_Packages",
    "packing",
    "remarks",
    "itemId",
    "item",
    "quantityMTS",
    "quantityFCL",
  ];

  // Auto-fill basePurchase when itemId changes
  useEffect(() => {
    if (basePurchase.itemId && items.length > 0) {
      const selectedItem = items.find(
        (item) =>
          item._id.toString() === basePurchase.itemId.toString() ||
          item._id === basePurchase.itemId
      );
      if (
        selectedItem &&
        (!basePurchase.grade ||
          !basePurchase.containerType ||
          !basePurchase.packing)
      ) {
        console.log(
          "🔍 Auto-filling basePurchase from useEffect with item:",
          selectedItem
        );
        autoFillItemFields(selectedItem, "basePurchase");
      }
    }
  }, [basePurchase.itemId, items]);

  // Auto-sync common fields from basePurchase to other contracts
  useEffect(() => {
    console.log("🔍 Auto-syncing common fields from basePurchase");

    // Create updates object with all common fields that have values in basePurchase
    const updates = {};
    commonFields.forEach((field) => {
      if (
        basePurchase[field] !== undefined &&
        basePurchase[field] !== null &&
        basePurchase[field] !== ""
      ) {
        updates[field] = basePurchase[field];
      }
    });

    // Only proceed if there are updates to make
    if (Object.keys(updates).length > 0) {
      console.log("🔍 Updates to sync:", updates);

      // Update other contracts with the common fields
      setSale1((prev) => ({ ...prev, ...updates }));
      setPurchase2((prev) => ({ ...prev, ...updates }));
      setSale2((prev) => ({ ...prev, ...updates }));

      console.log("🔍 Common fields synced across all contracts");
    }
  }, [
    basePurchase.shippingTerms,
    basePurchase.paymentTerms,
    basePurchase.origin_country,
    basePurchase.portOfLanding,
    basePurchase.portOfDestination,
    basePurchase.estimatedDeparture,
    basePurchase.deposit,
    basePurchase.breakEvenValue,
    basePurchase.additionalCharges,
    basePurchase.selectedCurrency,
    basePurchase.conversionRate,
    basePurchase.amountInSelectedCurrency,
    basePurchase.totalValue,
    basePurchase.quantityMTS,
    basePurchase.quantityFCL,
    basePurchase.unitOfContainer,
    basePurchase.containerType,
    basePurchase.fclSize,
    basePurchase.No_of_Packages,
    basePurchase.packing,
    basePurchase.grade,
    basePurchase.remarks,
  ]);

  // Sync shared fields from basePurchase to sale1, purchase2, sale2 (for item-specific fields)
  useEffect(() => {
    // Only sync if basePurchase.itemId is set
    if (!basePurchase.itemId) return;

    console.log(
      "🔍 Syncing item-specific fields from basePurchase to other contracts"
    );
    console.log("🔍 Base purchase itemId:", basePurchase.itemId);
    console.log("🔍 Available items:", items.length);
    console.log(
      "🔍 Available internal business items:",
      internalBusinessItems.length
    );

    const update = {};
    sharedFields.forEach((field) => {
      if (basePurchase[field]) {
        update[field] = basePurchase[field];
      }
    });

    // Only update if there are actual changes
    if (Object.keys(update).length > 0) {
      // Helper to auto-fill item fields if itemId changed
      const syncAndAutofill = (section, setSection, sectionKey) => {
        setSection((prev) => {
          const updated = { ...prev, ...update };
          // Only auto-fill if itemId changed and we have items data
          if (prev.itemId !== basePurchase.itemId) {
            // For purchase2 and sale2, use internalBusinessItems instead of items
            let itemsToUse = items;
            if (sectionKey === "purchase2" || sectionKey === "sale2") {
              itemsToUse = internalBusinessItems;
            }

            if (itemsToUse.length > 0) {
              const selectedItem = itemsToUse.find(
                (item) =>
                  item._id === basePurchase.itemId ||
                  item.name === basePurchase.itemId
              );
              if (selectedItem) {
                // Call autoFillItemFields with the section key
                setTimeout(
                  () => autoFillItemFields(selectedItem, sectionKey),
                  0
                );
              } else if (sectionKey === "purchase2" || sectionKey === "sale2") {
                // For internal business contracts, try to find same item
                const baseItem = items.find(
                  (item) =>
                    item._id === basePurchase.itemId ||
                    item.name === basePurchase.itemId
                );
                if (baseItem) {
                  const sameItem = findSameItemInInternalBusiness(baseItem);
                  if (sameItem) {
                    console.log(
                      "🔍 Found same item in internal business:",
                      sameItem
                    );
                    updated.itemId = sameItem._id;
                    updated.item = sameItem.name;
                    setTimeout(
                      () => autoFillItemFields(sameItem, sectionKey),
                      0
                    );
                  } else {
                    console.log(
                      "🔍 No same item found in internal business, clearing itemId for",
                      sectionKey
                    );
                    // If no same item found, clear the itemId but keep other fields
                    updated.itemId = "";
                    updated.item = "";
                  }
                } else {
                  console.log(
                    "🔍 Base item not found, clearing itemId for",
                    sectionKey
                  );
                  updated.itemId = "";
                  updated.item = "";
                }
              } else {
                console.log(
                  "🔍 Item not found, clearing itemId for",
                  sectionKey
                );
                updated.itemId = "";
                updated.item = "";
              }
            }
          }
          return updated;
        });
      };

      syncAndAutofill(sale1, setSale1, "sale1");
      syncAndAutofill(purchase2, setPurchase2, "purchase2");
      syncAndAutofill(sale2, setSale2, "sale2");
    }
  }, [
    basePurchase.itemId,
    basePurchase.item,
    basePurchase.grade,
    basePurchase.containerType,
    basePurchase.fclSize,
    basePurchase.quantityFCL,
    basePurchase.quantityMTS,
    basePurchase.unitOfContainer,
    basePurchase.No_of_Packages,
    basePurchase.packing,
    basePurchase.origin_country,
    basePurchase.portOfLanding,
    basePurchase.portOfDestination,
    basePurchase.estimatedDeparture,
    items, // add items as dependency for lookup
    internalBusinessItems, // add internalBusinessItems as dependency
  ]);

  // Pre-fill base purchase form if coming from existing contract
  useEffect(() => {
    if (isFromExistingContract && basePurchaseData) {
      console.log(
        "🔍 Pre-filling base purchase form with existing contract data:",
        basePurchaseData
      );
      const mappedData = mapContractToBasePurchase(basePurchaseData);
      setBasePurchase(mappedData);

      // Set selected business from the contract
      if (mappedData.business) {
        setSelectedBusiness(mappedData.business);
      }
    }
  }, [isFromExistingContract, basePurchaseData]);

  // Fetch businesses on mount
  useEffect(() => {
    const stored = localStorage.getItem("businesses");
    if (stored) {
      const parsed = JSON.parse(stored);
      setBusinesses(parsed);
      if (parsed.length > 0 && !isFromExistingContract) {
        setSelectedBusiness(parsed[0]._id);
        setBasePurchase((prev) => ({ ...prev, business: parsed[0]._id }));
        setPurchase2((prev) => ({ ...prev, business: parsed[0]._id }));
      }
    } else {
      axios.get(`${Base_URL}/businesses`).then((res) => {
        setBusinesses(res.data?.data || []);
        if (res.data?.data?.length > 0 && !isFromExistingContract) {
          setSelectedBusiness(res.data.data[0]._id);
          setBasePurchase((prev) => ({
            ...prev,
            business: res.data.data[0]._id,
          }));
          setPurchase2((prev) => ({ ...prev, business: res.data.data[0]._id }));
        }
      });
    }
  }, [isFromExistingContract]);

  // Fetch all data when business changes
  useEffect(() => {
    if (!selectedBusiness) return;

    // Items
    axios
      .get(`${Base_URL}/items?businessId=${selectedBusiness}&active=true`)
      .then((res) => setItems(res.data?.items || res.data || []))
      .catch(() => setItems([]));

    // Suppliers - only external suppliers for base purchase
    axios
      .get(`${Base_URL}/vendors/Supplier/${selectedBusiness}`)
      .then((res) => {
        const allSuppliers = res.data?.data || [];
        // Filter to only external suppliers for base purchase
        const externalSuppliers = allSuppliers.filter(
          (s) => s.basicInformation?.vendorCategory === "External"
        );
        setSuppliers(externalSuppliers);
      })
      .catch(() => setSuppliers([]));

    // Customers
    axios
      .get(`${Base_URL}/customers_by_business/${selectedBusiness}`)
      .then((res) => {
        console.log("Fetched customers_by_business - full response:", res);
        console.log("Fetched customers_by_business - data:", res.data);
        console.log(
          "Fetched customers_by_business - staffList:",
          res.data?.staffList
        );
        setCustomers(res.data || []);
      })
      .catch((error) => {
        console.error("Error fetching customers:", error);
        setCustomers([]);
      });

    // Salespersons
    axios
      .get(`${Base_URL}/staff-management/sales_staff/${selectedBusiness}`)
      .then((res) => {
        setSalespersons(res.data?.staffList || []);
      })
      .catch(() => setSalespersons([]));

    // Agents (fix: use plural 'Agents')
    axios
      .get(`${Base_URL}/vendors/Agents/${selectedBusiness}`)
      .then((res) => {
        setAgents(res.data?.data || []);
        console.log("Fetched agents:", res.data?.data || []);
      })
      .catch(() => setAgents([]));

    // Banks
    axios
      .get(
        `${Base_URL}/bank-management/account/Bank Account/${selectedBusiness}`
      )
      .then((res) => {
        console.log("Fetched banks - full response:", res);
        console.log("Fetched banks - data:", res.data);
        setBanks(res.data || []);
      })
      .catch((error) => {
        console.error("Error fetching banks:", error);
        setBanks([]);
      });

    // Currencies
    setLoadingCurrencies(true);
    axios
      .get(`${Base_URL}/finance/currencies?business_id=${selectedBusiness}`)
      .then((response) => {
        if (response.status === 200) {
          setCurrencies(response.data.data || []);
        } else {
          setCurrencies([]);
        }
      })
      .catch((error) => {
        console.error("❌ Error fetching currencies:", error);
        setCurrencies([]);
      })
      .finally(() => setLoadingCurrencies(false));

    // Payment Terms
    setLoadingPaymentTerms(true);
    axios
      .post(`${Base_URL}/items/Payment Terms/get_all`, {
        business_id: selectedBusiness,
        FilterStatus: "active",
      })
      .then((response) => {
        console.log("✅ Payment Terms API Response:", response);
        console.log("✅ Payment Terms Data:", response.data);
        if (response.data.success) {
          setPaymentTerms(response.data.data || []);
          console.log("✅ Payment Terms Set:", response.data.data);
        } else {
          setPaymentTerms([]);
          console.log("⚠️ Payment Terms - No data or failed");
        }
      })
      .catch((error) => {
        console.error("❌ Error fetching payment terms:", error);
        setPaymentTerms([]);
      })
      .finally(() => setLoadingPaymentTerms(false));

    // Forecast Cost Descriptions (for sale1)
    setLoadingForecastCostDesc(true);
    axios
      .post(`${Base_URL}/items/Forecast Cost Desc/get_all`, {
        business_id: selectedBusiness,
        FilterStatus: "active",
      })
      .then((response) => {
        if (response.data.success) {
          setForecastCostDescriptions(response.data.data || []);
        } else {
          setForecastCostDescriptions([]);
        }
      })
      .catch((error) => {
        console.error("❌ Error fetching forecast cost descriptions:", error);
        setForecastCostDescriptions([]);
      })
      .finally(() => setLoadingForecastCostDesc(false));
  }, [selectedBusiness]);

  // Update business in both purchase sections when changed
  const handleBusinessChange = (value) => {
    // Clear draft from localStorage without page reload
    try {
      localStorage.removeItem(draftKey);
      setSaveStatus("idle");
    } catch (e) {
      // ignore
    }

    // Reset all form states to initial values
    setBasePurchase({ ...initialPurchase, business: value });
    setSale1({ ...initialSale });
    setPurchase2({ ...initialPurchase, business: value });
    setSale2({ ...initialSale });

    // Reset step to 1
    setCurrentStep(1);
    setCompletedSteps(new Set());

    // Update selected business
    setSelectedBusiness(value);

    // Reset price auto-management
    setSale1PriceIsAuto(true);
    setPurchase2PriceIsAuto(true);
    prevBasePriceRef.current = "";
  };

  // Fetch detailed item information when an item is selected
  const fetchItemDetails = async (itemId, section) => {
    console.log("🔍 fetchItemDetails called with:", { itemId, section });
    if (!itemId) return;

    setItemLoading(true);
    try {
      // Try to find matching item by different criteria (matching standard logic)
      let selectedItem = null;
      // First try to match by itemId
      if (itemId) {
        selectedItem = items.find(
          (item) =>
            item._id.toString() === itemId.toString() || item._id === itemId
        );
      }

      // If not found, try to match by item name
      if (!selectedItem && itemId) {
        selectedItem = items.find(
          (item) =>
            item.name === itemId ||
            item.name.toLowerCase() === itemId.toLowerCase()
        );
      }

      // If still not found, try partial matching
      if (!selectedItem && itemId) {
        const itemName = itemId.toLowerCase();
        selectedItem = items.find(
          (item) =>
            item.name.toLowerCase().includes(itemName) ||
            itemName.includes(item.name.toLowerCase())
        );
      }

      console.log("🔍 Selected item:", selectedItem);

      if (selectedItem) {
        setSelectedItemDetails(selectedItem);
        autoFillItemFields(selectedItem, section);
      }
    } catch (error) {
      console.error("❌ Error processing item details:", error);
    } finally {
      setItemLoading(false);
    }
  };

  // Update getGradeOptions and renderProductField for grade fallback
  const getGradeOptions = () => {
    const item = getSelectedItem();
    if (!item) return [];
    if (Array.isArray(item.grades) && item.grades.length > 0)
      return item.grades.map((g) => ({ value: g, label: g }));
    if (item.grade) return [{ value: item.grade, label: item.grade }];
    return [];
  };

  // Update autoFillItemFields for Grade
  const autoFillItemFields = (item, sectionKey) => {
    console.log("🔍 autoFillItemFields called with:", { item, sectionKey });
    console.log("🔍 Item data:", {
      _id: item._id,
      name: item.name,
      grade: item.grade,
      grades: item.grades,
      container_type: item.container_type,
      containerTypes: item.containerTypes,
      fclSizes: item.fclSizes,
      packing: item.packing,
      packingOptions: item.packingOptions,
      quantity_MTS: item.quantity_MTS,
      No_of_Packages: item.No_of_Packages,
      remarks: item.remarks,
    });

    const updates = {};

    if (item._id) updates.itemId = item._id.toString();
    if (item.name) updates.item = item.name;

    // Grade
    if (Array.isArray(item.grades) && item.grades.length > 0) {
      updates.grade = item.grades[0];
    } else if (item.grade) {
      updates.grade = item.grade;
    }

    if (item.remarks) updates.remarks = item.remarks;

    // Container Type
    if (
      item.containerTypes &&
      Array.isArray(item.containerTypes) &&
      item.containerTypes.length > 0
    ) {
      updates.containerType = item.containerTypes[0];
    } else if (item.container_type) {
      updates.containerType = item.container_type;
      // Set FCL Size based on container type (matching standard logic)
      if (item.container_type === "20'GP") updates.fclSize = "20ft";
      else if (item.container_type === "40'HC") updates.fclSize = "40ft HC";
      else if (item.container_type.includes("40")) updates.fclSize = "40ft";
    }

    // FCL Size
    if (
      item.fclSizes &&
      Array.isArray(item.fclSizes) &&
      item.fclSizes.length > 0
    ) {
      updates.fclSize = item.fclSizes[0];
    }

    // Packing
    if (
      item.packingOptions &&
      Array.isArray(item.packingOptions) &&
      item.packingOptions.length > 0
    ) {
      updates.packing = item.packingOptions[0];
    } else if (item.packing) {
      updates.packing = item.packing;
    }

    // Quantity (MTS) - match standard logic
    if (
      item.quantity_MTS &&
      Array.isArray(item.quantity_MTS) &&
      item.quantity_MTS.length === 1
    ) {
      const numericValue = Number.parseFloat(
        item.quantity_MTS[0].replace(/[^0-9.]/g, "")
      );
      updates.quantityMTS = numericValue.toString();
    } else if (
      item.quantity_MTS &&
      Array.isArray(item.quantity_MTS) &&
      item.quantity_MTS.length > 0
    ) {
      updates.quantityMTS = item.quantity_MTS[0];
    }

    // No. of Packages - match standard logic
    if (
      item.No_of_Packages &&
      Array.isArray(item.No_of_Packages) &&
      item.No_of_Packages.length === 1
    ) {
      updates.No_of_Packages = item.No_of_Packages[0];
    } else if (
      item.No_of_Packages &&
      Array.isArray(item.No_of_Packages) &&
      item.No_of_Packages.length > 0
    ) {
      updates.No_of_Packages = item.No_of_Packages[0];
    }

    // Price (do not change price for sale1 and purchase2)
    if (sectionKey !== "sale1" && sectionKey !== "purchase2") {
      if (item.prices && Array.isArray(item.prices) && item.prices.length > 0) {
        updates.price = item.prices[0];
      }
    }

    // Set default quantityFCL if empty
    const currentSection = eval(sectionKey);
    if (!currentSection.quantityFCL) {
      updates.quantityFCL = "1";
    }

    // Set default currency
    if (!currentSection.selectedCurrency) {
      updates.selectedCurrency = "USD";
    }

    console.log("🔍 Updates to apply:", updates);

    // Update section with all collected updates
    Object.entries(updates).forEach(([key, value]) => {
      handleChange(sectionKey, key, value);
    });

    // Calculate unit of container
    updateUnitOfContainer(
      updates.quantityFCL || currentSection.quantityFCL || "1",
      updates.containerType || currentSection.containerType,
      sectionKey
    );
  };

  // Calculate unit of container
  const updateUnitOfContainer = (fcl, containerType, section) => {
    if (fcl && containerType) {
      const unitOfContainer = `${fcl}x${containerType}`;
      handleChange(section, "unitOfContainer", unitOfContainer);
    }
  };

  // Update unit of container when quantityFCL or containerType changes for all contracts
  useEffect(() => {
    // Base Purchase
    if (basePurchase.quantityFCL && basePurchase.containerType) {
      updateUnitOfContainer(
        basePurchase.quantityFCL,
        basePurchase.containerType,
        "basePurchase"
      );
    }
    // Purchase 2
    if (purchase2.quantityFCL && purchase2.containerType) {
      updateUnitOfContainer(
        purchase2.quantityFCL,
        purchase2.containerType,
        "purchase2"
      );
    }
    // Sale 1
    if (sale1.quantityFCL && sale1.containerType) {
      updateUnitOfContainer(sale1.quantityFCL, sale1.containerType, "sale1");
    }
    // Sale 2
    if (sale2.quantityFCL && sale2.containerType) {
      updateUnitOfContainer(sale2.quantityFCL, sale2.containerType, "sale2");
    }
  }, [
    basePurchase.quantityFCL,
    basePurchase.containerType,
    purchase2.quantityFCL,
    purchase2.containerType,
    sale1.quantityFCL,
    sale1.containerType,
    sale2.quantityFCL,
    sale2.containerType,
  ]);

  // Calculate total quantity for all contracts
  useEffect(() => {
    // Base Purchase
    if (basePurchase.quantityFCL && basePurchase.quantityMTS) {
      const fcl = Number(basePurchase.quantityFCL);
      const mts = Number(basePurchase.quantityMTS);
      if (!isNaN(fcl) && !isNaN(mts)) {
        const totalQuantity = fcl * mts;
        setBasePurchase((prev) => ({
          ...prev,
          totalQuantity: totalQuantity.toFixed(2),
        }));
      }
    }
    // Purchase 2
    if (purchase2.quantityFCL && purchase2.quantityMTS) {
      const fcl = Number(purchase2.quantityFCL);
      const mts = Number(purchase2.quantityMTS);
      if (!isNaN(fcl) && !isNaN(mts)) {
        const totalQuantity = fcl * mts;
        setPurchase2((prev) => ({
          ...prev,
          totalQuantity: totalQuantity.toFixed(2),
        }));
      }
    }
    // Sale 1
    if (sale1.quantityFCL && sale1.quantityMTS) {
      const fcl = Number(sale1.quantityFCL);
      const mts = Number(sale1.quantityMTS);
      if (!isNaN(fcl) && !isNaN(mts)) {
        const totalQuantity = fcl * mts;
        setSale1((prev) => ({
          ...prev,
          totalQuantity: totalQuantity.toFixed(2),
        }));
      }
    }
    // Sale 2
    if (sale2.quantityFCL && sale2.quantityMTS) {
      const fcl = Number(sale2.quantityFCL);
      const mts = Number(sale2.quantityMTS);
      if (!isNaN(fcl) && !isNaN(mts)) {
        const totalQuantity = fcl * mts;
        setSale2((prev) => ({
          ...prev,
          totalQuantity: totalQuantity.toFixed(2),
        }));
      }
    }
  }, [
    basePurchase.quantityFCL,
    basePurchase.quantityMTS,
    purchase2.quantityFCL,
    purchase2.quantityMTS,
    sale1.quantityFCL,
    sale1.quantityMTS,
    sale2.quantityFCL,
    sale2.quantityMTS,
  ]);

  // Calculate total agent commission for all contracts
  useEffect(() => {
    // Base Purchase
    if (
      basePurchase.commissionPerMTS &&
      basePurchase.quantityMTS &&
      basePurchase.quantityFCL
    ) {
      const commission = Number(basePurchase.commissionPerMTS);
      const qty = Number(basePurchase.quantityMTS);
      const fcl = Number(basePurchase.quantityFCL);
      if (!isNaN(commission) && !isNaN(qty) && !isNaN(fcl)) {
        const totalAgentCommission = commission * qty * fcl;
        setBasePurchase((prev) => ({
          ...prev,
          totalAgentCommission: totalAgentCommission.toFixed(2),
        }));
      }
    }
    // Purchase 2
    if (
      purchase2.commissionPerMTS &&
      purchase2.quantityMTS &&
      purchase2.quantityFCL
    ) {
      const commission = Number(purchase2.commissionPerMTS);
      const qty = Number(purchase2.quantityMTS);
      const fcl = Number(purchase2.quantityFCL);
      if (!isNaN(commission) && !isNaN(qty) && !isNaN(fcl)) {
        const totalAgentCommission = commission * qty * fcl;
        setPurchase2((prev) => ({
          ...prev,
          totalAgentCommission: totalAgentCommission.toFixed(2),
        }));
      }
    }
    // Sale 1
    if (sale1.commissionPerMTS && sale1.quantityMTS && sale1.quantityFCL) {
      const commission = Number(sale1.commissionPerMTS);
      const qty = Number(sale1.quantityMTS);
      const fcl = Number(sale1.quantityFCL);
      if (!isNaN(commission) && !isNaN(qty) && !isNaN(fcl)) {
        const totalAgentCommission = commission * qty * fcl;
        setSale1((prev) => ({
          ...prev,
          totalAgentCommission: totalAgentCommission.toFixed(2),
        }));
      }
    }
    // Sale 2
    if (sale2.commissionPerMTS && sale2.quantityMTS && sale2.quantityFCL) {
      const commission = Number(sale2.commissionPerMTS);
      const qty = Number(sale2.quantityMTS);
      const fcl = Number(sale2.quantityFCL);
      if (!isNaN(commission) && !isNaN(qty) && !isNaN(fcl)) {
        const totalAgentCommission = commission * qty * fcl;
        setSale2((prev) => ({
          ...prev,
          totalAgentCommission: totalAgentCommission.toFixed(2),
        }));
      }
    }
  }, [
    basePurchase.commissionPerMTS,
    basePurchase.quantityMTS,
    basePurchase.quantityFCL,
    purchase2.commissionPerMTS,
    purchase2.quantityMTS,
    purchase2.quantityFCL,
    sale1.commissionPerMTS,
    sale1.quantityMTS,
    sale1.quantityFCL,
    sale2.commissionPerMTS,
    sale2.quantityMTS,
    sale2.quantityFCL,
  ]);

  // Calculate forecast total cost for sale1 and sale2
  useEffect(() => {
    // Sale 1
    if (sale1.forecastCost && sale1.totalQuantity) {
      const forecastCost = Number(sale1.forecastCost);
      const totalQty = Number(sale1.totalQuantity);
      if (!isNaN(forecastCost) && !isNaN(totalQty)) {
        const forecastTotalCost = forecastCost * totalQty;
        setSale1((prev) => ({
          ...prev,
          forecastTotalCost: forecastTotalCost.toFixed(2),
        }));
      } else {
        setSale1((prev) => ({
          ...prev,
          forecastTotalCost: "",
        }));
      }
    } else {
      setSale1((prev) => ({
        ...prev,
        forecastTotalCost: "",
      }));
    }
    // Sale 2
    if (sale2.forecastCost && sale2.totalQuantity) {
      const forecastCost = Number(sale2.forecastCost);
      const totalQty = Number(sale2.totalQuantity);
      if (!isNaN(forecastCost) && !isNaN(totalQty)) {
        const forecastTotalCost = forecastCost * totalQty;
        setSale2((prev) => ({
          ...prev,
          forecastTotalCost: forecastTotalCost.toFixed(2),
        }));
      } else {
        setSale2((prev) => ({
          ...prev,
          forecastTotalCost: "",
        }));
      }
    } else {
      setSale2((prev) => ({
        ...prev,
        forecastTotalCost: "",
      }));
    }
  }, [
    sale1.forecastCost,
    sale1.totalQuantity,
    sale2.forecastCost,
    sale2.totalQuantity,
  ]);

  // Add calculation for amountInSelectedCurrency
  useEffect(() => {
    const contracts = [
      { state: basePurchase, setState: setBasePurchase },
      { state: sale1, setState: setSale1 },
      { state: purchase2, setState: setPurchase2 },
      { state: sale2, setState: setSale2 },
    ];

    contracts.forEach(({ state, setState }) => {
      const price = Number(state.price);
      const qty = Number(state.quantityMTS);
      const fcl = Number(state.quantityFCL);
      const conversionRate = Number(state.conversionRate) || 1;

      let totalValue = 0;
      if (!isNaN(price) && !isNaN(qty) && !isNaN(fcl)) {
        totalValue = price * qty * fcl;
      }

      let amountInSelectedCurrency = totalValue;
      if (
        state.selectedCurrency &&
        state.selectedCurrency !== "USD" &&
        !isNaN(conversionRate)
      ) {
        amountInSelectedCurrency = totalValue * conversionRate;
      }

      setState((prev) => ({
        ...prev,
        totalValue: totalValue ? totalValue.toFixed(2) : "",
        amountInSelectedCurrency: amountInSelectedCurrency
          ? amountInSelectedCurrency.toFixed(2)
          : "",
      }));
    });
  }, [
    basePurchase.price,
    basePurchase.quantityMTS,
    basePurchase.quantityFCL,
    basePurchase.selectedCurrency,
    basePurchase.conversionRate,
    sale1.price,
    sale1.quantityMTS,
    sale1.quantityFCL,
    sale1.selectedCurrency,
    sale1.conversionRate,
    purchase2.price,
    purchase2.quantityMTS,
    purchase2.quantityFCL,
    purchase2.selectedCurrency,
    purchase2.conversionRate,
    sale2.price,
    sale2.quantityMTS,
    sale2.quantityFCL,
    sale2.selectedCurrency,
    sale2.conversionRate,
  ]);

  // Auto-manage S1 and Purchase2 prices as Base + 5 unless manually overridden
  useEffect(() => {
    const basePrice = Number(basePurchase.price);
    const prevBasePrice = Number(prevBasePriceRef.current);

    // Only proceed if base price is valid and has changed
    if (!isNaN(basePrice) && basePrice > 0) {
      const newAutoPrice = (basePrice + 5).toString();

      // Update Sale 1 price if it's in auto mode
      if (sale1PriceIsAuto) {
        setSale1((prev) => ({
          ...prev,
          price: newAutoPrice,
        }));
      } else {
        // Check if sale1 price was at the old auto value, if so update it
        if (prevBasePrice > 0 && Number(sale1.price) === prevBasePrice + 5) {
          setSale1((prev) => ({
            ...prev,
            price: newAutoPrice,
          }));
          setSale1PriceIsAuto(true);
        }
      }

      // Update Purchase 2 price if it's in auto mode
      if (purchase2PriceIsAuto) {
        setPurchase2((prev) => ({
          ...prev,
          price: newAutoPrice,
        }));
      } else {
        // Check if purchase2 price was at the old auto value, if so update it
        if (
          prevBasePrice > 0 &&
          Number(purchase2.price) === prevBasePrice + 5
        ) {
          setPurchase2((prev) => ({
            ...prev,
            price: newAutoPrice,
          }));
          setPurchase2PriceIsAuto(true);
        }
      }

      // Update the previous base price reference
      prevBasePriceRef.current = basePrice.toString();
    }
  }, [
    basePurchase.price,
    sale1PriceIsAuto,
    purchase2PriceIsAuto,
    sale1.price,
    purchase2.price,
  ]);

  // Step navigation functions
  const nextStep = () => {
    if (currentStep < 4) {
      setCompletedSteps((prev) => new Set([...prev, currentStep]));
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (step) => {
    setCurrentStep(step);
  };

  // Check if current step is valid
  const isStepValid = (step) => {
    const sectionKey = stepToSectionMap[step];
    return isSectionValid(sectionKey);
  };

  // Generic change handler
  const handleChange = (section, field, value) => {
    if (section === "basePurchase")
      setBasePurchase((prev) => ({ ...prev, [field]: value }));
    if (section === "sale1") {
      if (field === "price") setSale1PriceIsAuto(false);
      setSale1((prev) => ({ ...prev, [field]: value }));
    }
    if (section === "purchase2") {
      if (field === "price") setPurchase2PriceIsAuto(false);
      setPurchase2((prev) => ({ ...prev, [field]: value }));
    }
    if (section === "sale2") setSale2((prev) => ({ ...prev, [field]: value }));
  };

  // Handle item selection
  const handleItemSelect = (itemId, section) => {
    console.log("🔍 handleItemSelect called with:", { itemId, section });
    handleChange(section, "itemId", itemId);

    // If this is basePurchase, auto-fill immediately
    if (section === "basePurchase") {
      const selectedItem = items.find(
        (item) =>
          item._id.toString() === itemId.toString() || item._id === itemId
      );
      if (selectedItem) {
        console.log("🔍 Auto-filling basePurchase with item:", selectedItem);
        autoFillItemFields(selectedItem, section);
      }
    } else if (section === "purchase2" || section === "sale2") {
      // For purchase2 and sale2, use internalBusinessItems
      const selectedItem = internalBusinessItems.find(
        (item) =>
          item._id.toString() === itemId.toString() || item._id === itemId
      );
      if (selectedItem) {
        console.log("🔍 Auto-filling", section, "with item:", selectedItem);
        autoFillItemFields(selectedItem, section);
      } else {
        console.log("🔍 Item not found in internal business for", section);
      }
    } else {
      // For other sections, use the existing fetchItemDetails logic
      fetchItemDetails(itemId, section);
    }
  };

  // Handle supplier selection for purchase contracts
  const handleSupplierSelect = (value, section) => {
    // Determine which suppliers array to use based on section
    let suppliersToUse = suppliers;
    if (section === "purchase2") {
      suppliersToUse = internalBusinessSuppliers;
    }

    const selectedSupplier = suppliersToUse.find((s) => s._id === value);
    if (selectedSupplier) {
      handleChange(section, "selectedVendorId", selectedSupplier._id);
      handleChange(
        section,
        "SupplierName",
        selectedSupplier.basicInformation?.vendorDisplayName ||
          selectedSupplier.basicInformation?.companyName ||
          selectedSupplier.name ||
          ""
      );
    } else {
      handleChange(section, "selectedVendorId", "");
      handleChange(section, "SupplierName", "");
    }
  };

  // Handle customer selection for sales contracts
  const handleCustomerSelect = (value, section, isFinalCustomer = false) => {
    // Determine which customers array to use based on section
    let customersToUse = customers;
    if (section === "sale2") {
      customersToUse = internalBusinessCustomers;
    }

    const selectedCustomer = customersToUse.find(
      (customer) =>
        customer.basicInformation?.companyName === value ||
        customer.basicInformation?.customerDisplayName === value
    );
    if (selectedCustomer) {
      if (isFinalCustomer) {
        // Handle final customer selection for Profit Sharing
        handleChange(
          section,
          "finalCustomerName",
          selectedCustomer.basicInformation?.companyName ||
            selectedCustomer.basicInformation?.customerDisplayName ||
            ""
        );
        handleChange(section, "selectedFinalCustomerId", selectedCustomer._id);
      } else {
        // Handle buyer company name selection
        handleChange(section, "selectedCustomerId", selectedCustomer._id);
        handleChange(
          section,
          "buyerCompanyName",
          selectedCustomer.basicInformation?.companyName || ""
        );
      }
      // Business for purchase2/sale2 is now handled by useEffect above
    } else {
      if (isFinalCustomer) {
        handleChange(section, "finalCustomerName", "");
        handleChange(section, "selectedFinalCustomerId", "");
      } else {
        handleChange(section, "selectedCustomerId", "");
        handleChange(section, "buyerCompanyName", "");
      }
    }
  };

  const handleSalesSelect = (value, section) => {
    console.log("handleSalesSelect called with:", { value, section });

    // Determine which salespersons array to use based on section
    let salespersonsToUse = salespersons;
    if (section === "sale2") {
      salespersonsToUse = internalBusinessSalespersons;
    }

    console.log("Available salespersons:", salespersonsToUse);

    const selectedSales_person = salespersonsToUse.find(
      (sales_person) => sales_person._id === value
    );
    console.log("Selected sales person found:", selectedSales_person);

    if (selectedSales_person) {
      handleChange(section, "selectedSalesId", selectedSales_person._id);
      handleChange(section, "salesPerson", selectedSales_person.displayName);
      console.log("Selected sales Person:", selectedSales_person);
    } else {
      console.log("No sales person found for value:", value);
    }
  };

  // Handle agent selection
  const handleAgentSelect = (value, section) => {
    console.log("handleAgentSelect called with value:", value);
    const selectedAgent = agents.find(
      (a) => a.basicInformation?.vendorDisplayName === value
    );
    console.log("Selected agent object:", selectedAgent);

    if (selectedAgent) {
      handleChange(section, "selectedAgentId", selectedAgent._id);
      handleChange(
        section,
        "agentName",
        selectedAgent.basicInformation?.vendorDisplayName || ""
      );
    } else {
      handleChange(section, "selectedAgentId", "");
      handleChange(section, "agentName", "");
    }

    // Clear commission percentage if no agent selected
    if (!value) {
      handleChange(section, "commissionPerMTS", "");
    }
  };

  // Handle bank selection
  const handleBankSelect = (value, section) => {
    console.log("handleBankSelect called with:", { value, section });

    // Determine which banks array to use based on section
    let banksToUse = banks;
    if (section === "sale2") {
      banksToUse = internalBusinessBanks;
    }

    console.log("Available banks:", banksToUse);
    const selectedBank = banksToUse.find((bank) => bank.accountName === value);
    console.log("selectedBank", selectedBank);

    if (selectedBank) {
      handleChange(section, "selectedBankId", selectedBank._id);
      handleChange(section, "bankAccount", selectedBank.accountName || "");
    } else {
      handleChange(section, "selectedBankId", "");
      handleChange(section, "bankAccount", "");
    }
  };

  // File upload handler
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setBasePurchase((prev) => ({ ...prev, supportingDocument: file }));
    }
  };

  // API call to save
  const handleSubmit = async (status = "final") => {
    setError("");
    setSuccess("");

    const invalidSectionKey = getFirstInvalidSection();
    if (invalidSectionKey) {
      const stepNumber = sectionToStepMap[invalidSectionKey] || 1;
      setCurrentStep(stepNumber);
      setError(
        `Please complete all required fields in ${sectionLabels[invalidSectionKey]}.`
      );
      return;
    }

    // Validate supplierContractNo uniqueness for base purchase if provided
    if (
      basePurchase.supplierContractNo &&
      basePurchase.supplierContractNo.trim() !== ""
    ) {
      try {
        const checkBaseResponse = await axios.get(
          `${Base_URL}/purchase-contracts?businessId=${basePurchase.business}`
        );
        const existingContracts =
          checkBaseResponse?.data?.contracts ||
          checkBaseResponse?.data?.data ||
          [];
        const contractWithSameSupplierNo = existingContracts.find(
          (contract) =>
            contract.basicInfo?.supplierContractNo?.trim() ===
            basePurchase.supplierContractNo.trim()
        );
        if (contractWithSameSupplierNo) {
          setError(
            "A contract with this Supplier Contract No. already exists for Base Purchase business."
          );
          notifyError(
            "A contract with this Supplier Contract No. already exists for Base Purchase business."
          );
          setLoading(false);
          return;
        }
      } catch (checkError) {
        console.error(
          "Error checking supplierContractNo uniqueness:",
          checkError
        );
        // Continue with submission if check fails (backend will validate)
      }
    }

    // Validate supplierContractNo uniqueness for purchase2 if provided
    if (
      purchase2.supplierContractNo &&
      purchase2.supplierContractNo.trim() !== ""
    ) {
      try {
        const checkPurchase2Response = await axios.get(
          `${Base_URL}/purchase-contracts?businessId=${purchase2.business}`
        );
        const existingContracts =
          checkPurchase2Response?.data?.contracts ||
          checkPurchase2Response?.data?.data ||
          [];
        const contractWithSameSupplierNo = existingContracts.find(
          (contract) =>
            contract.basicInfo?.supplierContractNo?.trim() ===
            purchase2.supplierContractNo.trim()
        );
        if (contractWithSameSupplierNo) {
          setError(
            "A contract with this Supplier Contract No. already exists for Purchase 2 business."
          );
          notifyError(
            "A contract with this Supplier Contract No. already exists for Purchase 2 business."
          );
          setLoading(false);
          return;
        }
      } catch (checkError) {
        console.error(
          "Error checking supplierContractNo uniqueness:",
          checkError
        );
        // Continue with submission if check fails (backend will validate)
      }
    }

    // Validate ref uniqueness for sale1 if provided
    if (sale1.ref && sale1.ref.trim() !== "") {
      try {
        const checkSale1Response = await axios.get(
          `${Base_URL}/sales-contracts?businessId=${
            sale1.business
          }&ref=${encodeURIComponent(sale1.ref.trim())}`
        );
        const existingContracts =
          checkSale1Response?.data?.contracts ||
          checkSale1Response?.data?.data ||
          [];
        const contractWithSameRef = existingContracts.find(
          (contract) => contract.basicInfo?.ref?.trim() === sale1.ref.trim()
        );
        if (contractWithSameRef) {
          setError(
            "A contract with this REF already exists for Sale 1 business."
          );
          notifyError(
            "A contract with this REF already exists for Sale 1 business."
          );
          setLoading(false);
          return;
        }
      } catch (checkError) {
        console.error("Error checking ref uniqueness:", checkError);
        // Continue with submission if check fails (backend will validate)
      }
    }

    // Validate ref uniqueness for sale2 if provided
    if (sale2.ref && sale2.ref.trim() !== "") {
      try {
        const checkSale2Response = await axios.get(
          `${Base_URL}/sales-contracts?businessId=${
            sale2.business
          }&ref=${encodeURIComponent(sale2.ref.trim())}`
        );
        const existingContracts =
          checkSale2Response?.data?.contracts ||
          checkSale2Response?.data?.data ||
          [];
        const contractWithSameRef = existingContracts.find(
          (contract) => contract.basicInfo?.ref?.trim() === sale2.ref.trim()
        );
        if (contractWithSameRef) {
          setError(
            "A contract with this REF already exists for Sale 2 business."
          );
          notifyError(
            "A contract with this REF already exists for Sale 2 business."
          );
          setLoading(false);
          return;
        }
      } catch (checkError) {
        console.error("Error checking ref uniqueness:", checkError);
        // Continue with submission if check fails (backend will validate)
      }
    }

    setLoading(true);

    try {
      const payload = {
        basePurchase: {
          ...basePurchase,
          supplierType: basePurchase.supplierType,
          customerType: basePurchase.customerType,
          is_two_level: true,
          contract_level: "base_purchase",
          // Include all fields
          supplierContractNo: basePurchase.supplierContractNo,
          supplierContractDate: basePurchase.supplierContractDate,
          contractDate: basePurchase.contractDate,
          totalQuantity: basePurchase.totalQuantity,
          totalAgentCommission: basePurchase.totalAgentCommission,
        },
        sale1: {
          ...sale1,
          supplierType: sale1.supplierType,
          customerType: sale1.customerType,
          is_two_level: true,
          contract_level: "sale_1",
          // Include all fields
          ref: sale1.ref,
          contractCreationDate: sale1.contractCreationDate,
          contractDate: sale1.contractDate,
          ETD_Port: sale1.ETD_Port,
          port_of_loading: sale1.port_of_loading,
          port_of_discharge: sale1.port_of_discharge,
          origin_country: sale1.origin_country,
          commissionPerMTS: sale1.commissionPerMTS,
          totalAgentCommission: sale1.totalAgentCommission,
          forecastCostDescription: sale1.forecastCostDescription,
          forecastCost: sale1.forecastCost,
          forecastTotalCost: sale1.forecastTotalCost,
          totalQuantity: sale1.totalQuantity,
          remarks: sale1.remarks,
          // Profit Sharing fields
          finalCustomerName: sale1.finalCustomerName,
          selectedFinalCustomerId: sale1.selectedFinalCustomerId,
          salesContractNumberByFirstCustomer:
            sale1.salesContractNumberByFirstCustomer,
          priceForFinalCustomer: sale1.priceForFinalCustomer,
        },
        purchase2: {
          ...purchase2,
          supplierType: purchase2.supplierType,
          customerType: purchase2.customerType,
          is_two_level: true,
          contract_level: "purchase_2",
          // Include all fields
          totalQuantity: purchase2.totalQuantity,
          totalAgentCommission: purchase2.totalAgentCommission,
        },
        sale2: {
          ...sale2,
          supplierType: sale2.supplierType,
          customerType: sale2.customerType,
          is_two_level: true,
          contract_level: "sale_2",
          // Include all new fields
          ref: sale2.ref,
          contractCreationDate: sale2.contractCreationDate,
          contractDate: sale2.contractDate,
          ETD_Port: sale2.ETD_Port,
          port_of_loading: sale2.port_of_loading,
          port_of_discharge: sale2.port_of_discharge,
          origin_country: sale2.origin_country,
          commissionPerMTS: sale2.commissionPerMTS,
          totalAgentCommission: sale2.totalAgentCommission,
          forecastCostDescription: sale2.forecastCostDescription,
          forecastCost: sale2.forecastCost,
          forecastTotalCost: sale2.forecastTotalCost,
          totalQuantity: sale2.totalQuantity,
          remarks: sale2.remarks,
          // Profit Sharing fields
          finalCustomerName: sale2.finalCustomerName,
          selectedFinalCustomerId: sale2.selectedFinalCustomerId,
          salesContractNumberByFirstCustomer:
            sale2.salesContractNumberByFirstCustomer,
          priceForFinalCustomer: sale2.priceForFinalCustomer,
        },
        status,
        submitToManagement,
      };

      console.log("🔍 Submitting two-level contract payload:", payload);

      // Replace with your actual API endpoint
      const res = await axios.post(
        `${Base_URL}/purchase-contracts/two-level-contracts`,
        payload
      );

      if (res.data.success) {
        console.log("✅ Two-level contract created successfully:", res.data);

        // Extract the IDs of the created contracts from the response (for logging)
        const { basePurchaseId, sale1Id, purchase2Id, sale2Id } =
          res.data.data || {};

        console.log("🔍 Created contract IDs:", {
          basePurchaseId,
          sale1Id,
          purchase2Id,
          sale2Id,
        });

        // Backend has already linked all contracts with related_contracts
        console.log("✅ All contracts have been linked by the backend");

        setSuccess("Two-level contract created successfully!");
        notifySuccess("Two-level contract created successfully!");

        // Clear autosaved draft after successful creation
        try {
          localStorage.removeItem(draftKey);
          setSaveStatus("idle");
        } catch (e) {
          // ignore
        }

        history.push("/purchase_contracts");
      } else {
        setError(res.data.message || "Failed to create contract");
        notifyError(res.data.message || "Failed to create contract");
      }
    } catch (err) {
      console.error("❌ Error creating two-level contract:", err);

      // Extract the actual error message from the backend
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Failed to create contract";

      // Handle uniqueness validation errors
      if (errorMessage.includes("Supplier Contract No. already exists")) {
        if (errorMessage.includes("Purchase 2")) {
          setError(
            "A contract with this Supplier Contract No. already exists for Purchase 2 business."
          );
          notifyError(
            "A contract with this Supplier Contract No. already exists for Purchase 2 business."
          );
        } else {
          setError(
            "A contract with this Supplier Contract No. already exists for this business."
          );
          notifyError(
            "A contract with this Supplier Contract No. already exists for this business."
          );
        }
      } else if (errorMessage.includes("REF already exists")) {
        setError("A contract with this REF already exists for this business.");
        notifyError(
          "A contract with this REF already exists for this business."
        );
      } else {
        setError(errorMessage);
        notifyError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // Update isEditable to use this list for Sale Contract 1 and others
  const isEditable = (sectionKey, field) => {
    // If coming from existing contract, make base purchase read-only
    if (sectionKey === "basePurchase" && isFromExistingContract) return false;

    if (sectionKey === "basePurchase") return true;

    // Disable item selection in all contracts except basePurchase
    if (field === "itemId" && sectionKey !== "basePurchase") return false;

    // If item is selected in basePurchase, disable base-only fields in other contracts
    if (basePurchase.itemId && baseOnlyFields.includes(field)) return false;
    return true;
  };

  // Helper functions to get dropdown options from selected item
  const getSelectedItem = () => {
    if (!basePurchase.itemId) return null;
    return (
      items.find(
        (item) =>
          item._id === basePurchase.itemId || item.name === basePurchase.itemId
      ) || null
    );
  };

  // Helper function to find same item in internal business (matching isDuplicateItem criteria)
  const findSameItemInInternalBusiness = (baseItem) => {
    if (!baseItem || !internalBusinessItems.length) return null;

    // Match based on the same criteria as isDuplicateItem function
    const sameItem = internalBusinessItems.find(
      (item) =>
        item.name === baseItem.name &&
        item.grade === baseItem.grade &&
        item.packing === baseItem.packing &&
        item.remarks === baseItem.remarks &&
        item.No_of_Packages === baseItem.No_of_Packages &&
        item.quantity_MTS === baseItem.quantity_MTS
    );

    if (sameItem) {
      console.log("🔍 Found exact same item in internal business:", sameItem);
      return sameItem;
    }

    // If no exact match, try partial matches with priority
    // Priority 1: name + grade + packing
    let similarItem = internalBusinessItems.find(
      (item) =>
        item.name === baseItem.name &&
        item.grade === baseItem.grade &&
        item.packing === baseItem.packing
    );

    if (similarItem) {
      console.log(
        "🔍 Found similar item (name+grade+packing) in internal business:",
        similarItem
      );
      return similarItem;
    }

    // Priority 2: name + grade
    similarItem = internalBusinessItems.find(
      (item) => item.name === baseItem.name && item.grade === baseItem.grade
    );

    if (similarItem) {
      console.log(
        "🔍 Found similar item (name+grade) in internal business:",
        similarItem
      );
      return similarItem;
    }

    // Priority 3: name only
    similarItem = internalBusinessItems.find(
      (item) => item.name === baseItem.name
    );

    if (similarItem) {
      console.log(
        "🔍 Found similar item (name only) in internal business:",
        similarItem
      );
      return similarItem;
    }

    console.log("🔍 No matching item found in internal business");
    return null;
  };

  const getQuantityMTS_Options = () => {
    const item = getSelectedItem();
    if (!item || !item.quantity_MTS) return [];
    return item.quantity_MTS.map((qty) => ({ value: qty, label: qty }));
  };

  const getFCLSizeOptions = () => {
    const item = getSelectedItem();
    if (!item || !item.fclSizes) return [];
    return item.fclSizes.map((size) => ({ value: size, label: size }));
  };

  const getNoOfPackagesOptions = () => {
    const item = getSelectedItem();
    if (!item || !item.No_of_Packages) return [];
    return item.No_of_Packages.map((pkg) => ({ value: pkg, label: pkg }));
  };

  const getPriceOptions = () => {
    const item = getSelectedItem();
    if (!item || !item.prices) return [];
    return item.prices.map((p) => ({ value: p, label: p }));
  };

  const currencyOptions = currencies.map((currency) => ({
    value: currency.symbol,
    label: `${currency.name} (${currency.symbol})`,
    conversionRate: currency.conversion_rate_to_base,
  }));

  // Add helpers for packing and container type
  const getPackingOptions = () => {
    const item = getSelectedItem();
    if (!item) return [];
    if (Array.isArray(item.packingOptions))
      return item.packingOptions.map((p) => ({ value: p, label: p }));
    if (item.packing) return [{ value: item.packing, label: item.packing }];
    return [];
  };

  const getContainerTypeOptions = () => {
    const item = getSelectedItem();
    if (!item) return [];
    if (Array.isArray(item.containerTypes))
      return item.containerTypes.map((c) => ({ value: c, label: c }));
    if (item.container_type)
      return [{ value: item.container_type, label: item.container_type }];
    return [];
  };

  // Update renderProductField for all relevant fields in base purchase
  const renderProductField = (
    section,
    field,
    label,
    type,
    options,
    disabled = false
  ) => {
    const isBasePurchase = section === "basePurchase";
    const item = getSelectedItem();
    const isRequiredField = isFieldRequired(section, field);
    const labelText = isRequiredField ? `${label} *` : label;

    // Check if this field should be hidden (disabled and not showing disabled fields)
    const isAutoSynced =
      section !== "basePurchase" &&
      commonFields.includes(field) &&
      basePurchase[field] === eval(section)[field];
    const isBaseOnly =
      section !== "basePurchase" && baseOnlyFields.includes(field);
    const shouldHide = disabled && !showDisabledFields;

    if (shouldHide) {
      return null;
    }

    // Handle Shipping Terms with HTML editor
    if (field === "shippingTerms") {
      const fetchUrl = `${Base_URL}/items/Shipping Terms/get_all`;
      const addUrl = `${Base_URL}/items/Shipping Terms/add`;

      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginBottom: "8px",
            width: "100%",
          }}
        >
          <DropdownWithAddNewFormSaleC
            label={labelText}
            name={field}
            fieldType="html"
            selectedValue={eval(section)[field] || ""}
            onChange={(value) => handleChange(section, field, value)}
            fetchUrl={fetchUrl}
            addUrl={addUrl}
            businessId={selectedBusiness}
            placeholder={`Select ${label}`}
            disabled={disabled}
            required={isRequiredField && !disabled}
          />
        </div>
      );
    }

    // Handle Payment Terms as regular dropdown (not HTML editor)
    if (field === "paymentTerms") {
      console.log("🔍 Payment Terms Data:", paymentTerms);
      console.log("🔍 Payment Terms Length:", paymentTerms.length);

      const paymentTermsOptions = paymentTerms.map((term) => ({
        value: term.name,
        label:
          term.depositPercentage !== undefined &&
          term.depositPercentage !== null
            ? `${term.name} (${term.depositPercentage}% deposit)`
            : term.name,
      }));

      console.log("🔍 Payment Terms Options:", paymentTermsOptions);

      return renderDropdown(
        section,
        field,
        label,
        paymentTermsOptions,
        false,
        false,
        false,
        false,
        false,
        false,
        disabled,
        false,
        true // isPaymentTerms flag
      );
    }

    // Grade as dropdown if multiple, disabled if only one, fallback to placeholder
    if (field === "grade") {
      const opts = getGradeOptions();
      if (isBasePurchase && opts.length > 1) {
        return renderDropdown(
          section,
          field,
          label,
          opts,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          disabled
        );
      }
      if (opts.length === 1) {
        return renderInput(section, field, label, "text", "", null, disabled);
      }
      if (item && item.grade) {
        return renderInput(section, field, label, "text", "", null, disabled);
      }
      return renderInput(
        section,
        field,
        label,
        "text",
        "No grade available",
        null,
        disabled
      );
    }

    // Container Type as dropdown if multiple, disabled if only one
    if (field === "containerType") {
      const opts = getContainerTypeOptions();
      if (isBasePurchase && opts.length > 1) {
        return renderDropdown(
          section,
          field,
          label,
          opts,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          disabled
        );
      }
      if (opts.length > 0) {
        return renderInput(section, field, label, "text", "", null, disabled);
      }
      return renderInput(section, field, label, "text", "", null, disabled);
    }

    // FCL Size as dropdown if multiple, disabled if only one
    if (field === "fclSize") {
      const opts = getFCLSizeOptions();
      if (isBasePurchase && opts.length > 1) {
        return renderDropdown(
          section,
          field,
          label,
          opts,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          disabled
        );
      }
      if (opts.length > 0) {
        return renderInput(section, field, label, "text", "", null, disabled);
      }
      return renderInput(section, field, label, "text", "", null, disabled);
    }

    // Packing as dropdown if multiple, disabled if only one
    if (field === "packing") {
      const opts = getPackingOptions();
      if (isBasePurchase && opts.length > 1) {
        return renderDropdown(
          section,
          field,
          label,
          opts,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          disabled
        );
      }
      if (opts.length > 0) {
        return renderInput(section, field, label, "text", "", null, disabled);
      }
      return renderInput(section, field, label, "text", "", null, disabled);
    }

    // Quantity (MTS) as dropdown if multiple, disabled if only one
    if (field === "quantityMTS") {
      const opts = getQuantityMTS_Options();
      if (isBasePurchase && opts.length > 1) {
        return renderDropdown(
          section,
          field,
          label,
          opts,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          disabled
        );
      }
      if (opts.length > 0) {
        return renderInput(section, field, label, "number", "", null, disabled);
      }
      return renderInput(section, field, label, "number", "", null, disabled);
    }

    // No. of Packages as dropdown if multiple, disabled if only one
    if (field === "No_of_Packages") {
      const opts = getNoOfPackagesOptions();
      if (isBasePurchase && opts.length > 1) {
        return renderDropdown(
          section,
          field,
          label,
          opts,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          disabled
        );
      }
      if (opts.length > 0) {
        return renderInput(section, field, label, "text", "", null, disabled);
      }
      return renderInput(section, field, label, "text", "", null, disabled);
    }

    // Price as dropdown if multiple, editable if only one
    if (field === "price") {
      const opts = getPriceOptions();
      if (isBasePurchase && opts.length > 1) {
        return renderDropdown(
          section,
          field,
          label,
          opts,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          disabled
        );
      }
      if (opts.length > 0) {
        return renderInput(section, field, label, "number", "", null, disabled);
      }
      return renderInput(section, field, label, "number", "", null, disabled);
    }

    // Quantity (FCL) as editable number input
    if (field === "quantityFCL") {
      return renderInput(
        section,
        field,
        label,
        "number",
        "Quantity (FCL)",
        null,
        disabled
      );
    }

    // Remarks as editable input in base purchase, disabled otherwise
    if (field === "remarks" && section === "basePurchase") {
      return renderInput(section, field, label, "text", "", null, disabled);
    }

    // Currency as dropdown
    if (field === "selectedCurrency") {
      return renderDropdown(
        section,
        field,
        label,
        currencyOptions,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        disabled
      );
    }

    // Total Quantity - calculated, disabled
    if (field === "totalQuantity") {
      return renderInput(
        section,
        field,
        label,
        "text",
        "Total Quantity",
        null,
        true
      );
    }

    // Total Agent Commission - calculated, disabled
    if (field === "totalAgentCommission") {
      return renderInput(
        section,
        field,
        label,
        "text",
        "Total Agent Commission",
        null,
        true
      );
    }

    // Amount in Selected Currency and Total Value as calculated fields
    if (["amountInSelectedCurrency", "totalValue"].includes(field)) {
      return renderInput(
        section,
        field,
        label,
        "number",
        label,
        null,
        disabled
      );
    }

    // Agent Commission (P/MTS) - display from agent commission, disabled
    if (
      field === "commissionPerMTS" &&
      (section === "sale1" || section === "sale2")
    ) {
      return renderInput(
        section,
        field,
        label,
        "text",
        "Agent Commission per MTS",
        null,
        true
      );
    }

    // Total Agent Commission - calculated, disabled
    if (
      field === "totalAgentCommission" &&
      (section === "sale1" || section === "sale2")
    ) {
      return renderInput(
        section,
        field,
        label,
        "text",
        "Total Agent Commission",
        null,
        true
      );
    }

    // Total Quantity - calculated, disabled
    if (
      field === "totalQuantity" &&
      (section === "sale1" || section === "sale2")
    ) {
      return renderInput(
        section,
        field,
        label,
        "text",
        "Total Quantity",
        null,
        true
      );
    }

    // Forecast Cost Description - dropdown with multi-select
    if (
      field === "forecastCostDescription" &&
      (section === "sale1" || section === "sale2")
    ) {
      const forecastCostDescOptions = forecastCostDescriptions.map((desc) => ({
        value: desc.name,
        label: desc.name,
      }));

      // Handle multi-select value (comma-separated string)
      const sectionState = section === "sale1" ? sale1 : sale2;
      const currentValue = sectionState.forecastCostDescription || "";
      const selectedValues = currentValue
        ? currentValue.split(", ").map((v) => v.trim())
        : [];

      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginBottom: "8px",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              marginBottom: "4px",
            }}
          >
            <label
              style={{
                fontSize: "12px",
                color: "#6b7280",
                fontWeight: "500",
                paddingLeft: "4px",
              }}
            >
              {label}
            </label>
          </div>
          <DropdownBasic
            options={forecastCostDescOptions}
            value={selectedValues}
            onChange={(val) => {
              // Handle multi-select: join all selected values with comma
              let valueToStore = "";
              if (Array.isArray(val)) {
                valueToStore = val.join(", ");
              } else if (val) {
                valueToStore = val;
              }
              handleChange(section, field, valueToStore);
            }}
            placeholder={
              loadingForecastCostDesc
                ? "Loading..."
                : "Select Forecast Cost Description(s)"
            }
            isMulti={true}
            disabled={disabled}
          />
        </div>
      );
    }

    // Forecast Cost (USD)
    if (
      field === "forecastCost" &&
      (section === "sale1" || section === "sale2")
    ) {
      return renderInput(
        section,
        field,
        label,
        "number",
        "Enter Forecast Cost",
        null,
        disabled
      );
    }

    // Forecast Total Cost (USD) - calculated, disabled
    if (
      field === "forecastTotalCost" &&
      (section === "sale1" || section === "sale2")
    ) {
      return renderInput(
        section,
        field,
        label,
        "text",
        "Calculated: Total Quantity × Forecast Cost",
        null,
        true
      );
    }

    // Price for Final Customer - Profit Sharing only
    if (
      field === "priceForFinalCustomer" &&
      (section === "sale1" || section === "sale2")
    ) {
      const sectionState = section === "sale1" ? sale1 : sale2;
      if (sectionState.typeOfSaleContract === "Profit Sharing") {
        return renderInput(
          section,
          field,
          label,
          "number",
          "Enter Price for Final Customer",
          null,
          disabled
        );
      }
      return null;
    }

    // Remarks - editable text input
    if (field === "remarks" && (section === "sale1" || section === "sale2")) {
      return renderInput(
        section,
        field,
        label,
        "text",
        "Remarks",
        null,
        disabled
      );
    }

    // Item field - show as disabled input in other contracts
    if (field === "itemId" && section !== "basePurchase") {
      const selectedItem = eval(section)[field]
        ? section === "purchase2" || section === "sale2"
          ? internalBusinessItems.find(
              (item) => item._id === eval(section)[field]
            )
          : items.find((item) => item._id === eval(section)[field])
        : null;

      return renderInput(
        section,
        field,
        label,
        "text",
        selectedItem
          ? selectedItem.name
          : "Item will be auto-selected from Base Purchase",
        null,
        true
      );
    }

    // Default: use existing logic
    return type === "select"
      ? renderDropdown(
          section,
          field,
          label,
          options,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          disabled
        )
      : renderInput(section, field, label, type, "", null, disabled);
  };

  // Render a searchable dropdown
  const renderDropdown = (
    section,
    field,
    label,
    options,
    isBusiness,
    isItem,
    isSupplier,
    isCustomer,
    isAgent,
    isBank,
    disabled = false,
    isSales,
    isPaymentTerms = false
  ) => {
    let value = eval(section)[field] || "";
    const isRequiredField = isFieldRequired(section, field);
    const labelText = isRequiredField ? `${label} *` : label;

    // For supplier dropdown, use selectedVendorId as value for proper matching
    if (isSupplier) {
      value = eval(section)["selectedVendorId"] || "";
    }

    // For agent dropdown, use agentName as value (matching standard purchase contract)
    if (isAgent) {
      value = eval(section)["agentName"] || "";
    }

    // For sales person dropdown, use selectedSalesId as value (matching the option values)
    if (isSales) {
      value = eval(section)["selectedSalesId"] || "";
    }

    // For finalCustomerName dropdown, use finalCustomerName as value
    if (field === "finalCustomerName") {
      value = eval(section)["finalCustomerName"] || "";
    }

    // Debug logging for customer and bank dropdowns
    if (isCustomer || isBank || isSales) {
      console.log(`renderDropdown for ${field}:`, {
        section,
        field,
        label,
        value,
        options: options.slice(0, 3), // Show first 3 options
        isCustomer,
        isBank,
        isAgent,
        isBusiness,
        isItem,
        isSupplier,
        isSales,
      });
    }

    const isAutoSynced =
      section !== "basePurchase" &&
      commonFields.includes(field) &&
      basePurchase[field] === eval(section)[field];
    const isBaseOnly =
      section !== "basePurchase" && baseOnlyFields.includes(field);
    const shouldHide = disabled && !showDisabledFields;

    if (shouldHide) {
      return null;
    }

    // If this is a dropdown field, always render a dropdown (even if disabled)
    if (dropdownFields.includes(field) || isAgent) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginBottom: "8px",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              marginBottom: "4px",
            }}
          >
            <label
              style={{
                fontSize: "12px",
                color: "#6b7280",
                fontWeight: "500",
                paddingLeft: "4px",
              }}
            >
              {labelText}
            </label>
            {isBaseOnly && (
              <span
                style={{
                  fontSize: "10px",
                  color: "#f59e0b",
                  backgroundColor: "#fffbeb",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  border: "1px solid #f59e0b",
                }}
              ></span>
            )}
          </div>
          <DropdownBasic
            options={options}
            value={value}
            onChange={(val) => {
              console.log(`Dropdown onChange for ${field}:`, {
                val,
                section,
                isSales,
                isCustomer,
                isBank,
                isPaymentTerms,
              });
              if (field === "selectedCurrency") {
                // Find the selected currency and set conversion rate
                const selected = currencyOptions.find((c) => c.value === val);
                handleChange(section, field, val);
                if (selected && selected.conversionRate !== undefined) {
                  handleChange(
                    section,
                    "conversionRate",
                    selected.conversionRate
                  );
                }
              } else if (isPaymentTerms) {
                // Handle payment terms change and auto-update deposit
                const selectedPaymentTerm = paymentTerms.find(
                  (term) => term.name === val
                );
                handleChange(section, field, val);

                if (
                  selectedPaymentTerm &&
                  selectedPaymentTerm.depositPercentage !== undefined &&
                  selectedPaymentTerm.depositPercentage !== null
                ) {
                  handleChange(
                    section,
                    "deposit",
                    selectedPaymentTerm.depositPercentage.toString()
                  );
                  console.log(
                    "Auto-updated deposit to:",
                    selectedPaymentTerm.depositPercentage
                  );
                }
              } else if (isAgent) handleAgentSelect(val, section);
              else if (isBusiness) handleBusinessChange(val);
              else if (isItem) handleItemSelect(val, section);
              else if (isSupplier) {
                // For supplier, we need to find the supplier by value (ID) or label (name)
                const selectedSupplier = options.find(
                  (opt) => opt.value === val || opt.label === val
                );
                if (selectedSupplier) {
                  handleChange(
                    section,
                    "selectedVendorId",
                    selectedSupplier.value
                  );
                  handleChange(section, "SupplierName", selectedSupplier.label);
                }
                // Also call the handleSupplierSelect function for proper handling
                handleSupplierSelect(selectedSupplier?.value || val, section);
              } else if (isCustomer) {
                // Check if this is finalCustomerName field
                const isFinalCustomer = field === "finalCustomerName";
                handleCustomerSelect(val, section, isFinalCustomer);
              } else if (isBank) handleBankSelect(val, section);
              else if (isSales) {
                console.log("Calling handleSalesSelect with:", {
                  val,
                  section,
                });
                handleSalesSelect(val, section);
              } else handleChange(section, field, val);
            }}
            placeholder={`Select ${label}`}
            className="w-full"
            disabled={disabled || (isItem && section !== "basePurchase")}
            required={
              isRequiredField &&
              !(disabled || (isItem && section !== "basePurchase"))
            }
            aria-required={isRequiredField ? "true" : undefined}
            style={{
              backgroundColor: isAutoSynced ? "#f0f9ff" : undefined,
              border: isAutoSynced ? "1px solid #84cc16" : undefined,
              color:
                disabled || (isItem && section !== "basePurchase")
                  ? "#166534"
                  : undefined,
              opacity:
                disabled || (isItem && section !== "basePurchase")
                  ? 0.9
                  : undefined,
              height: "44px", // unify height
              fontSize: "14px",
            }}
          />
        </div>
      );
    }

    // Otherwise, if disabled, render as input
    if (disabled || (isItem && section !== "basePurchase")) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginBottom: "8px",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              marginBottom: "4px",
            }}
          >
            <label
              style={{
                fontSize: "12px",
                color: "#6b7280",
                fontWeight: "500",
                paddingLeft: "4px",
              }}
            >
              {labelText}
            </label>
            {isBaseOnly && (
              <span
                style={{
                  fontSize: "10px",
                  color: "#f59e0b",
                  backgroundColor: "#fffbeb",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  border: "1px solid #f59e0b",
                }}
              ></span>
            )}
          </div>
          <input
            type="text"
            value={
              options?.find((opt) => opt.value === value)?.label || value || ""
            }
            disabled
            required={false}
            style={{
              borderRadius: "16px",
              backgroundColor: isAutoSynced ? "#f0f9ff" : "#F9F9FA",
              border: isAutoSynced ? "1px solid #84cc16" : "1px solid #e5e7eb",
              padding: "12px 20px",
              fontSize: "16px",
              color: "#166534",
              opacity: 0.9,
              cursor: "not-allowed",
            }}
          />
        </div>
      );
    }

    // Otherwise, render a normal dropdown
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginBottom: "8px",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            marginBottom: "4px",
          }}
        >
          <label
            style={{
              fontSize: "12px",
              color: "#6b7280",
              fontWeight: "500",
              paddingLeft: "4px",
            }}
          >
            {labelText}
          </label>
          {isBaseOnly && (
            <span
              style={{
                fontSize: "10px",
                color: "#f59e0b",
                backgroundColor: "#fffbeb",
                padding: "2px 6px",
                borderRadius: "4px",
                border: "1px solid #f59e0b",
              }}
            ></span>
          )}
        </div>
        <DropdownBasic
          options={options}
          value={value}
          onChange={(val) => {
            console.log(`Dropdown onChange for ${field}:`, {
              val,
              section,
              isSales,
              isCustomer,
              isBank,
              isPaymentTerms,
            });
            if (field === "selectedCurrency") {
              // Find the selected currency and set conversion rate
              const selected = currencyOptions.find((c) => c.value === val);
              handleChange(section, field, val);
              if (selected && selected.conversionRate !== undefined) {
                handleChange(
                  section,
                  "conversionRate",
                  selected.conversionRate
                );
              }
            } else if (isPaymentTerms) {
              // Handle payment terms change and auto-update deposit
              const selectedPaymentTerm = paymentTerms.find(
                (term) => term.name === val
              );
              handleChange(section, field, val);

              if (
                selectedPaymentTerm &&
                selectedPaymentTerm.depositPercentage !== undefined &&
                selectedPaymentTerm.depositPercentage !== null
              ) {
                handleChange(
                  section,
                  "deposit",
                  selectedPaymentTerm.depositPercentage.toString()
                );
                console.log(
                  "Auto-updated deposit to:",
                  selectedPaymentTerm.depositPercentage
                );
              }
            } else if (
              field === "forecastCostDescription" &&
              (section === "sale1" || section === "sale2")
            ) {
              // Handle multi-select: join all selected values with comma
              let valueToStore = "";
              if (Array.isArray(val)) {
                valueToStore = val.join(", ");
              } else if (val) {
                valueToStore = val;
              }
              handleChange(section, field, valueToStore);
            } else if (field === "finalCustomerName") {
              // Handle final customer selection for Profit Sharing
              handleCustomerSelect(val, section, true);
            } else if (isAgent) {
              handleAgentSelect(val, section);
              // If this is sale2 and agent is selected, sync commissionPerMTS
              if (section === "sale2") {
                const selectedAgent = agents.find(
                  (a) => a.basicInformation?.vendorDisplayName === val
                );
                if (selectedAgent && sale2.agentName) {
                  // Commission will be entered manually or synced from elsewhere
                }
              }
            } else if (isBusiness) handleBusinessChange(val);
            else if (isItem) handleItemSelect(val, section);
            else if (isSupplier) {
              // For supplier, we need to find the supplier by value (ID) or label (name)
              const selectedSupplier = options.find(
                (opt) => opt.value === val || opt.label === val
              );
              if (selectedSupplier) {
                handleChange(
                  section,
                  "selectedVendorId",
                  selectedSupplier.value
                );
                handleChange(section, "SupplierName", selectedSupplier.label);
              }
              // Also call the handleSupplierSelect function for proper handling
              handleSupplierSelect(selectedSupplier?.value || val, section);
            } else if (isCustomer || field === "finalCustomerName") {
              // Check if this is finalCustomerName field
              const isFinalCustomer = field === "finalCustomerName";
              handleCustomerSelect(val, section, isFinalCustomer);
            } else if (isBank) handleBankSelect(val, section);
            else if (isSales) {
              console.log("Calling handleSalesSelect with:", { val, section });
              handleSalesSelect(val, section);
            } else handleChange(section, field, val);
          }}
          placeholder={`Select ${label}`}
          className="w-full"
          disabled={disabled}
          required={isRequiredField && !disabled}
          aria-required={isRequiredField ? "true" : undefined}
          style={{
            backgroundColor: isAutoSynced ? "#f0f9ff" : undefined,
            border: isAutoSynced ? "1px solid #84cc16" : undefined,
            color: disabled ? "#166534" : undefined,
            opacity: disabled ? 0.9 : undefined,
            height: "44px", // unify height
            fontSize: "14px",
          }}
        />
      </div>
    );
  };

  // Render a text/number/date input
  const renderInput = (
    section,
    field,
    label,
    type = "text",
    placeholder = "",
    icon = null,
    disabled = false,
    displayValue = null
  ) => {
    const isAutoSynced =
      section !== "basePurchase" &&
      commonFields.includes(field) &&
      basePurchase[field] === eval(section)[field];
    const isBaseOnly =
      section !== "basePurchase" && baseOnlyFields.includes(field);
    const shouldHide = disabled && !showDisabledFields;
    const isRequiredField = isFieldRequired(section, field);
    const labelText = isRequiredField ? `${label} *` : label;
    const shouldRequire = isRequiredField && !disabled;

    if (shouldHide) {
      return null;
    }

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginBottom: "8px",
          width: "100%",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            marginBottom: "4px",
          }}
        >
          <label
            style={{
              fontSize: "12px",
              color: "#6b7280",
              fontWeight: "500",
              paddingLeft: "4px",
            }}
          >
            {labelText}
          </label>
          {isBaseOnly && (
            <span
              style={{
                fontSize: "10px",
                color: "#f59e0b",
                backgroundColor: "#fffbeb",
                padding: "2px 6px",
                borderRadius: "4px",
                border: "1px solid #f59e0b",
              }}
            ></span>
          )}
        </div>
        <input
          type={type}
          value={
            displayValue !== null ? displayValue : eval(section)[field] || ""
          }
          onChange={(e) => {
            let value = e.target.value;
            // For month type, ensure value is not below minimum
            if (type === "month" && field === "ETD_Port") {
              const minValue = getCurrentMonthMin();
              value = value < minValue ? minValue : value;
            }
            // For quantityMTS, ensure 2 decimal places
            if (field === "quantityMTS" && type === "number" && value) {
              const numValue = Number.parseFloat(value);
              if (!isNaN(numValue)) {
                value = numValue.toFixed(2);
              }
            }
            handleChange(section, field, value);
          }}
          placeholder={placeholder}
          disabled={disabled}
          required={shouldRequire}
          min={
            type === "month" && field === "ETD_Port"
              ? getCurrentMonthMin()
              : undefined
          }
          step={
            field === "quantityMTS" && type === "number" ? "0.01" : undefined
          }
          style={{
            borderRadius: "16px",
            backgroundColor: isAutoSynced
              ? "rgba(59, 130, 246, 0.05)"
              : "rgba(255, 255, 255, 0.8)",
            border: isAutoSynced
              ? "2px solid var(--p-blue)"
              : "2px solid rgba(226, 232, 240, 0.8)",
            padding: "12px 16px", // unified with dropdown
            height: "44px", // unified control height
            fontSize: "14px", // unified font size
            color: disabled ? "#166534" : "#1e293b",
            outline: "none",
            boxShadow: isAutoSynced
              ? "0 4px 12px rgba(59, 130, 246, 0.15)"
              : "0 2px 8px rgba(0, 0, 0, 0.05)",
            paddingRight: "44px",
            opacity: disabled ? 0.9 : 1,
            cursor: disabled ? "not-allowed" : "text",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            backdropFilter: "blur(10px)",
            ...(disabled
              ? {}
              : {
                  ":focus": {
                    borderColor: "var(--p-blue)",
                    boxShadow: "0 0 0 3px rgba(175, 208, 57, 0.2)",
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                  },
                }),
          }}
          onFocus={(e) => {
            if (!disabled) {
              e.target.style.borderColor = "var(--p-blue)";
              e.target.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
              e.target.style.backgroundColor = "rgba(255, 255, 255, 0.95)";
            }
          }}
          onBlur={(e) => {
            if (!disabled) {
              e.target.style.borderColor = isAutoSynced
                ? "var(--p-blue)"
                : "rgba(226, 232, 240, 0.8)";
              e.target.style.boxShadow = isAutoSynced
                ? "0 4px 12px rgba(59, 130, 246, 0.15)"
                : "0 2px 8px rgba(0, 0, 0, 0.05)";
              e.target.style.backgroundColor = isAutoSynced
                ? "rgba(59, 130, 246, 0.05)"
                : "rgba(255, 255, 255, 0.8)";
            }
          }}
        />
        {icon && (
          <span
            style={{
              position: "absolute",
              right: "16px",
              top: "40px",
              color: "#9ca3af",
              pointerEvents: "none",
            }}
          >
            {icon}
          </span>
        )}
      </div>
    );
  };

  // Render file upload
  const renderFileUpload = () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        marginBottom: "8px",
        width: "100%",
        maxWidth: "672px",
      }}
      onClick={() => fileInputRef.current && fileInputRef.current.click()}
    >
      <label
        style={{
          marginBottom: "4px",
          fontSize: "12px",
          color: "#6b7280",
          fontWeight: "500",
          paddingLeft: "4px",
        }}
      >
        Supporting Document (File)
      </label>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          border: "2px dashed #84cc16",
          borderRadius: "16px",
          backgroundColor: "#F9F9FA",
          padding: "24px 20px",
          cursor: "pointer",
          transition: "border-color 0.2s",
          boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "#84cc16",
          }}
        >
          <FiUploadCloud size={28} />
          <span style={{ fontWeight: "600", fontSize: "16px" }}>
            Upload Image
          </span>
        </div>
        {basePurchase.supportingDocument && (
          <span
            style={{ fontSize: "12px", color: "#4b5563", marginLeft: "16px" }}
          >
            {basePurchase.supportingDocument.name}
          </span>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </div>
  );

  // Render a section with Basic Info and Product Info subsections
  const renderSection = (
    title,
    sectionKey,
    basicFields,
    productFields,
    extra = null
  ) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Basic Info Section */}
      <div>
        <h3
          style={{
            fontSize: "16px",
            fontWeight: "600",
            marginBottom: "16px",
            color: "#1f2937",
            borderBottom: "1px solid #e5e7eb",
            paddingBottom: "8px",
          }}
        >
          Basic Info
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "32px 32px",
            gapY: "16px",
          }}
        >
          {basicFields.map((f) =>
            f.type === "custom" && f.component
              ? f.component()
              : f.type === "select"
              ? renderDropdown(
                  sectionKey,
                  f.name,
                  f.label,
                  f.options,
                  f.isBusiness,
                  f.isItem,
                  f.isSupplier,
                  f.isCustomer && !f.isFinalCustomer, // Only use isCustomer if not isFinalCustomer
                  f.isAgent,
                  f.isBank,
                  f.disabled !== undefined
                    ? f.disabled
                    : !isEditable(sectionKey, f.name),
                  f.isSales
                )
              : f.type === "dropdown-with-add-new"
              ? renderDropdownWithAddNew(
                  sectionKey,
                  f.name,
                  f.label,
                  f.fetchUrl,
                  f.addUrl,
                  f.placeholder,
                  f.disabled !== undefined
                    ? f.disabled
                    : !isEditable(sectionKey, f.name)
                )
              : renderInput(
                  sectionKey,
                  f.name,
                  f.label,
                  f.type,
                  f.placeholder,
                  f.icon,
                  f.disabled !== undefined
                    ? f.disabled
                    : !isEditable(sectionKey, f.name)
                )
          )}
        </div>
      </div>

      {/* Product Info Section */}
      <div>
        <h3
          style={{
            fontSize: "18px",
            fontWeight: "600",
            marginBottom: "16px",
            color: "#1f2937",
            borderBottom: "1px solid #e5e7eb",
            paddingBottom: "8px",
          }}
        >
          Product Info
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "32px 32px",
            gapY: "16px",
          }}
        >
          {productFields.map((f) =>
            renderProductField(
              sectionKey,
              f.name,
              f.label,
              f.type,
              f.options,
              f.disabled !== undefined
                ? f.disabled
                : !isEditable(sectionKey, f.name)
            )
          )}
        </div>
      </div>
      {extra}
    </div>
  );

  // Render dropdown with add new functionality
  const renderDropdownWithAddNew = (
    section,
    field,
    label,
    fetchUrl,
    addUrl,
    placeholder,
    disabled = false
  ) => {
    const isRequiredField = isFieldRequired(section, field);
    const labelText = isRequiredField ? `${label} *` : label;
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginBottom: "8px",
          width: "100%",
        }}
      >
        <DropdownWithAddNewFormSaleC
          label={labelText}
          name={field}
          fieldType="html"
          selectedValue={eval(section)[field] || ""}
          onChange={(value) => handleChange(section, field, value)}
          fetchUrl={fetchUrl}
          addUrl={addUrl}
          businessId={selectedBusiness}
          placeholder={placeholder}
          disabled={disabled}
          required={isRequiredField && !disabled}
        />
      </div>
    );
  };

  // Prepare dropdown options
  const businessOptions = businesses.map((business) => ({
    value: business._id,
    label: business.name,
  }));
  // Only show active items in Base Purchase dropdown
  const itemOptions = items
    .filter((item) => item.status === "Active")
    .map((item) => ({
      value: item._id.toString(),
      label: `${item.name} (${item.grade || "No Grade"}) - ${
        item.packing || "No Packing"
      } - ${item.remarks || "No Remarks"}`,
    }));

  // Only external suppliers for base purchase
  const externalSupplierOptions = suppliers
    .filter((s) => s.basicInformation?.vendorCategory === "External")
    .map((supplier) => ({
      value: supplier._id,
      label: supplier.basicInformation?.vendorDisplayName || supplier.name,
    }));

  const customerOptions = customers.map((customer) => ({
    value:
      customer.basicInformation?.companyName ||
      customer.basicInformation?.customerDisplayName ||
      customer.name,
    label:
      customer.basicInformation?.companyName ||
      customer.basicInformation?.customerDisplayName ||
      customer.name,
  }));

  console.log("Customer options:", customerOptions);
  console.log("Raw customers data:", customers);
  console.log("Current sale1 state:", sale1);
  console.log("Current sale2 state:", sale2);

  const salespersonOptions = salespersons.map((salesperson) => ({
    value: salesperson._id,
    label: salesperson.displayName || salesperson.name,
  }));

  console.log("Salesperson options:", salespersonOptions);
  console.log("Raw salespersons data:", salespersons);

  const agentOptions = agents.map((agent) => ({
    value: agent.basicInformation?.vendorDisplayName || agent.name,
    label: agent.basicInformation?.vendorDisplayName || agent.name,
  }));

  const bankOptions = banks.map((bank) => ({
    value: bank.accountName || bank.name,
    label: bank.accountName || bank.name,
  }));

  console.log("Bank options:", bankOptions);
  console.log("Raw banks data:", banks);

  const contractTypeOptions = [
    { value: "Nominal", label: "Nominal" },
    { value: "Confirmed", label: "Confirmed" },
    { value: "Profit Sharing", label: "Profit Sharing" },
  ];

  const countryOptions = Object.entries(countries).map(([code, country]) => ({
    value: code,
    label: country.name,
  }));

  const sortedPorts = worldPorts
    .sort((a, b) => a?.name?.localeCompare(b?.name))
    .map((port) => ({
      value: port?.id,
      label: `${port?.name} (${port?.country})`,
    }));

  const portOptions = [
    { label: "ANY PORT", value: "Any", key: "Any", first: true },
    // { label: "Any", value: "Any", key: "Any" },
    ...worldPorts.map((port) => ({
      label: `${port.name} (${port.country})`,
      value: port.id,
      key: port.id,
    })),
  ];

  // Helper: Get internal/external options
  const internalBusinessOptions = businesses.map((b) => ({
    value: b._id,
    label: b.name,
  }));
  const internalSupplierOptions = suppliers
    .filter((v) => v.basicInformation?.vendorCategory === "Internal")
    .map((v) => ({
      value: v._id,
      label: v.basicInformation?.vendorDisplayName || v.name,
    }));
  const externalCustomerOptions = customers
    .filter((c) => !businesses.some((b) => b._id === c.business))
    .map((c) => ({
      value: c._id,
      label:
        c.basicInformation?.companyName ||
        c.basicInformation?.customerDisplayName ||
        c.name,
    }));
  const internalCustomerOptions = businesses.map((b) => ({
    value: b._id,
    label: b.name,
  }));

  const internalClientOptions = customers
    .filter((c) => c.basicInformation?.client_type === "Internal")
    .map((c) => ({
      value:
        c.basicInformation?.companyName ||
        c.basicInformation?.customerDisplayName ||
        c.name,
      label:
        c.basicInformation?.companyName ||
        c.basicInformation?.customerDisplayName ||
        c.name,
    }));
  const externalClientOptions = customers
    .filter((c) => c.basicInformation?.client_type === "External")
    .map((c) => ({
      value:
        c.basicInformation?.companyName ||
        c.basicInformation?.customerDisplayName ||
        c.name,
      label:
        c.basicInformation?.companyName ||
        c.basicInformation?.customerDisplayName ||
        c.name,
    }));

  // Only internal customers for Sale Contract 1
  const sale1CustomerOptions = customers
    .filter((c) => c.basicInformation?.client_type === "Internal")
    .map((c) => ({
      value:
        c.basicInformation?.companyName ||
        c.basicInformation?.customerDisplayName ||
        c.name,
      label:
        c.basicInformation?.companyName ||
        c.basicInformation?.customerDisplayName ||
        c.name,
      internalBusiness: c.basicInformation?.internalBusiness,
    }));

  // Only external customers for Sale Contract 2 (from internal business)
  const sale2CustomerOptions = internalBusinessCustomers
    .filter((c) => c.basicInformation?.client_type === "External")
    .map((c) => ({
      value:
        c.basicInformation?.companyName ||
        c.basicInformation?.customerDisplayName ||
        c.name,
      label:
        c.basicInformation?.companyName ||
        c.basicInformation?.customerDisplayName ||
        c.name,
    }));

  console.log("🔍 Sale2 customer options:", sale2CustomerOptions);
  console.log("🔍 Internal business customers:", internalBusinessCustomers);

  // Only internal suppliers for Purchase Contract 2 (from internal business)
  const purchase2SupplierOptions = internalBusinessSuppliers
    .filter((s) => s.basicInformation?.vendorCategory === "Internal")
    .map((s) => ({
      value: s._id,
      label: s.basicInformation?.vendorDisplayName || s.name,
    }));

  console.log("🔍 Purchase2 supplier options:", purchase2SupplierOptions);
  console.log("🔍 Internal business suppliers:", internalBusinessSuppliers);

  // Salespersons for Sale Contract 2 (from internal business)
  const sale2SalespersonOptions = internalBusinessSalespersons.map(
    (salesperson) => ({
      value: salesperson._id,
      label: salesperson.displayName || salesperson.name,
    })
  );

  // Banks for Sale Contract 2 (from internal business)
  const sale2BankOptions = internalBusinessBanks.map((bank) => ({
    value: bank.accountName || bank.name,
    label: bank.accountName || bank.name,
  }));

  // Add a state to track if purchase2 supplier is auto-selected
  const [purchase2SupplierAutoSelected, setPurchase2SupplierAutoSelected] =
    useState(false);

  // When Sale1 customer changes, auto-set business for Purchase2 and Sale2, and fetch items for that business
  useEffect(() => {
    console.log("🔍 Sale1 customer changed:", sale1.buyerCompanyName);
    console.log("🔍 Available customers:", customers);

    const selectedSale1Customer = customers.find(
      (c) =>
        c.basicInformation?.companyName === sale1.buyerCompanyName ||
        c.basicInformation?.customerDisplayName === sale1.buyerCompanyName
    );

    console.log("🔍 Selected Sale1 customer:", selectedSale1Customer);

    if (
      selectedSale1Customer &&
      selectedSale1Customer.basicInformation?.client_type === "Internal"
    ) {
      const internalBusinessId =
        selectedSale1Customer.basicInformation.internalBusiness;
      console.log("🔍 Internal business ID:", internalBusinessId);

      if (internalBusinessId) {
        console.log("🔍 Setting purchase2 business to:", internalBusinessId);
        setPurchase2((prev) => ({ ...prev, business: internalBusinessId }));
        console.log("🔍 Setting sale2 business to:", internalBusinessId);
        setSale2((prev) => ({ ...prev, business: internalBusinessId }));
      }

      // Fetch data for the internal business
      if (internalBusinessId) {
        console.log(
          "🔍 Fetching data for internal business:",
          internalBusinessId
        );

        // Fetch items for the internal business
        axios
          .get(`${Base_URL}/items?businessId=${internalBusinessId}&active=true`)
          .then((res) => {
            const items = res.data?.items || res.data || [];
            console.log("🔍 Fetched internal business items:", items);
            setInternalBusinessItems(items);
          })
          .catch((error) => {
            console.error("❌ Error fetching internal business items:", error);
            setInternalBusinessItems([]);
          });

        // Fetch internal suppliers for purchase2
        axios
          .get(`${Base_URL}/vendors/Supplier/${internalBusinessId}`)
          .then((res) => {
            const allSuppliers = res.data?.data || [];
            // Filter to only internal suppliers for purchase2
            const internalSuppliers = allSuppliers.filter(
              (s) => s.basicInformation?.vendorCategory === "Internal"
            );
            console.log("🔍 Fetched internal suppliers:", internalSuppliers);
            setInternalBusinessSuppliers(internalSuppliers);
          })
          .catch((error) => {
            console.error("❌ Error fetching internal suppliers:", error);
            setInternalBusinessSuppliers([]);
          });

        // Fetch customers for sale2 (external customers)
        axios
          .get(`${Base_URL}/customers_by_business/${internalBusinessId}`)
          .then((res) => {
            const allCustomers = res.data || [];
            // Filter to only external customers for sale2
            const externalCustomers = allCustomers.filter(
              (c) => c.basicInformation?.client_type === "External"
            );
            console.log(
              "🔍 Fetched external customers for sale2:",
              externalCustomers
            );
            setInternalBusinessCustomers(externalCustomers);
          })
          .catch((error) => {
            console.error("❌ Error fetching external customers:", error);
            setInternalBusinessCustomers([]);
          });

        // Fetch salespersons for sale2
        axios
          .get(`${Base_URL}/staff-management/sales_staff/${internalBusinessId}`)
          .then((res) => {
            const salespersons = res.data?.staffList || [];
            console.log(
              "🔍 Fetched internal business salespersons:",
              salespersons
            );
            setInternalBusinessSalespersons(salespersons);
          })
          .catch((error) => {
            console.error(
              "❌ Error fetching internal business salespersons:",
              error
            );
            setInternalBusinessSalespersons([]);
          });

        // Fetch banks for sale2
        axios
          .get(
            `${Base_URL}/bank-management/account/Bank Account/${internalBusinessId}`
          )
          .then((res) => {
            const banks = res.data || [];
            console.log("🔍 Fetched internal business banks:", banks);
            setInternalBusinessBanks(banks);
          })
          .catch((error) => {
            console.error("❌ Error fetching internal business banks:", error);
            setInternalBusinessBanks([]);
          });

        // Fetch forecast cost descriptions for sale2
        setLoadingForecastCostDesc(true);
        axios
          .post(`${Base_URL}/items/Forecast Cost Desc/get_all`, {
            business_id: internalBusinessId,
            FilterStatus: "active",
          })
          .then((res) => {
            if (res.data.success) {
              setForecastCostDescriptions(res.data.data || []);
            } else {
              setForecastCostDescriptions([]);
            }
          })
          .catch((error) => {
            console.error(
              "❌ Error fetching forecast cost descriptions:",
              error
            );
            setForecastCostDescriptions([]);
          })
          .finally(() => setLoadingForecastCostDesc(false));
      }
    } else {
      console.log("🔍 No internal customer selected or customer not found");
      setInternalBusinessItems([]);
      setInternalBusinessSuppliers([]);
      setInternalBusinessCustomers([]);
      setInternalBusinessSalespersons([]);
      setInternalBusinessBanks([]);
    }
  }, [sale1.buyerCompanyName, customers]);

  // Item options for Purchase 2 and Sale 2 (from internal business)
  const internalBusinessItemOptions = internalBusinessItems.map((item) => ({
    value: item._id.toString(),
    label: `${item.name} (${item.grade || "No Grade"}) - ${
      item.packing || "No Packing"
    } - ${item.remarks || "No Remarks"}`,
  }));

  // Ensure Purchase Contract 2 and Sale Contract 2 use the same business
  useEffect(() => {
    if (purchase2.business && sale2.business !== purchase2.business) {
      console.log(
        "🔍 Syncing sale2 business with purchase2 business:",
        purchase2.business
      );
      setSale2((prev) => ({ ...prev, business: purchase2.business }));
    }
  }, [purchase2.business]);

  // Auto-select supplier for purchase2 if only one option, else allow selection
  useEffect(() => {
    console.log(
      "🔍 Auto-selecting supplier for purchase2. Available suppliers:",
      internalBusinessSuppliers
    );
    console.log("🔍 Current purchase2 business:", purchase2.business);
    console.log("🔍 Current sale2 business:", sale2.business);

    if (internalBusinessSuppliers.length === 1) {
      console.log("🔍 Auto-selecting supplier:", internalBusinessSuppliers[0]);
      const supplier = internalBusinessSuppliers[0];
      handleChange("purchase2", "selectedVendorId", supplier._id);
      handleChange(
        "purchase2",
        "SupplierName",
        supplier.basicInformation?.vendorDisplayName ||
          supplier.basicInformation?.companyName ||
          supplier.name ||
          ""
      );
      setPurchase2SupplierAutoSelected(true);
    } else {
      console.log("🔍 Multiple suppliers available, allowing selection");
      setPurchase2SupplierAutoSelected(false);
    }

    if (internalBusinessSuppliers.length === 0) {
      console.log("🔍 No suppliers available");
      handleChange("purchase2", "selectedVendorId", "");
      handleChange("purchase2", "SupplierName", "");
      setPurchase2SupplierAutoSelected(false);
    }
    // eslint-disable-next-line
  }, [internalBusinessSuppliers]);

  // Toggle button for showing/hiding disabled fields
  const renderToggleButton = () => (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        marginBottom: "24px",
      }}
    >
      <button
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 20px",
          borderRadius: "12px",
          backgroundColor: showDisabledFields ? "var(--p-blue)" : "#f1f5f9",
          color: showDisabledFields ? "#ffffff" : "#475569",
          border: "1px solid",
          borderColor: showDisabledFields ? "var(--p-blue)" : "#e2e8f0",
          fontSize: "14px",
          fontWeight: "500",
          cursor: "pointer",
          transition: "all 0.2s ease",
          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
        }}
        onClick={() => setShowDisabledFields(!showDisabledFields)}
      >
        <span style={{ fontSize: "16px" }}>
          {showDisabledFields ? "👁️" : "👁️‍🗨️"}
        </span>
        {showDisabledFields
          ? "Hide Auto-synced Fields"
          : "Show Auto-synced Fields"}
      </button>
    </div>
  );

  // Step navigation component
  const renderStepNavigation = () => {
    const steps = [
      { number: 1, title: "Base Purchase", section: "basePurchase" },
      { number: 2, title: "Sale Contract 1", section: "sale1" },
      { number: 3, title: "Purchase Contract 2", section: "purchase2" },
      { number: 4, title: "Sale Contract 2", section: "sale2" },
    ];

    return (
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          padding: "24px",
          marginBottom: "32px",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          {steps.map((step, index) => {
            const isCompleted = completedSteps.has(step.number);
            const isCurrent = currentStep === step.number;
            const isAccessible =
              step.number <= currentStep || completedSteps.has(step.number - 1);

            return (
              <div
                key={step.number}
                style={{
                  display: "flex",
                  alignItems: "center",
                  flex: "1 1 200px",
                  minWidth: "200px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    cursor: isAccessible ? "pointer" : "not-allowed",
                    padding: "8px",
                    borderRadius: "8px",
                    transition: "background-color 0.2s",
                    width: "100%",
                  }}
                  onClick={() => isAccessible && goToStep(step.number)}
                  onMouseEnter={(e) => {
                    if (isAccessible) {
                      e.target.style.backgroundColor = "#f3f4f6";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = "transparent";
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      backgroundColor: isCompleted
                        ? "#84cc16"
                        : isCurrent
                        ? "var(--p-blue)"
                        : "#e5e7eb",
                      color: isCompleted || isCurrent ? "#ffffff" : "#6b7280",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "600",
                      fontSize: "16px",
                      transition: "all 0.3s ease",
                      flexShrink: 0,
                    }}
                  >
                    {isCompleted ? "✓" : step.number}
                  </div>
                  <div style={{ marginLeft: "12px", minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: isCurrent ? "600" : "500",
                        color: isCurrent
                          ? "#1f2937"
                          : isCompleted
                          ? "#84cc16"
                          : "#6b7280",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {step.title}
                    </div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div
                    style={{
                      flex: "1 1 20px",
                      height: "2px",
                      backgroundColor: completedSteps.has(step.number)
                        ? "#84cc16"
                        : "#e5e7eb",
                      margin: "0 8px",
                      transition: "background-color 0.3s ease",
                      minWidth: "20px",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Restore draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed?.basePurchase ||
          parsed?.sale1 ||
          parsed?.purchase2 ||
          parsed?.sale2
        ) {
          setBasePurchase((prev) => ({
            ...prev,
            ...(parsed.basePurchase || {}),
          }));
          setSale1((prev) => ({ ...prev, ...(parsed.sale1 || {}) }));
          setPurchase2((prev) => ({ ...prev, ...(parsed.purchase2 || {}) }));
          setSale2((prev) => ({ ...prev, ...(parsed.sale2 || {}) }));
          setCurrentStep(parsed.currentStep || 1);
          setSaveStatus("saved");

          // Fix-up: if draft had S1/P2 price equal to base price, bump by +5
          setTimeout(() => {
            const basePriceFromDraft = parsed.basePurchase?.price;
            const basePriceNumber = Number(basePriceFromDraft);
            if (!isNaN(basePriceNumber)) {
              setSale1((prev) => {
                if (
                  prev.price === basePriceFromDraft ||
                  Number(prev.price) === basePriceNumber
                ) {
                  return { ...prev, price: (basePriceNumber + 5).toString() };
                }
                return prev;
              });
              setPurchase2((prev) => {
                if (
                  prev.price === basePriceFromDraft ||
                  Number(prev.price) === basePriceNumber
                ) {
                  return { ...prev, price: (basePriceNumber + 5).toString() };
                }
                return prev;
              });
              // Mark as auto so future base price changes keep them in sync
              setSale1PriceIsAuto(true);
              setPurchase2PriceIsAuto(true);
              prevBasePriceRef.current = basePriceFromDraft || "";
            }
          }, 0);
        }
      }
    } catch (e) {
      // ignore
    }
    // eslint-disable-next-line
  }, []);

  const scheduleAutosave = (payload) => {
    try {
      setSaveStatus("saving");
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        try {
          localStorage.setItem(draftKey, JSON.stringify(payload));
          setSaveStatus("saved");
        } catch (e) {
          setSaveStatus("error");
        }
      }, 600);
    } catch (e) {
      setSaveStatus("error");
    }
  };

  // Watch for changes and autosave (debounced)
  useEffect(() => {
    const payload = {
      basePurchase,
      sale1,
      purchase2,
      sale2,
      currentStep,
      ts: Date.now(),
    };
    scheduleAutosave(payload);
    // eslint-disable-next-line
  }, [basePurchase, sale1, purchase2, sale2, currentStep]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(draftKey);
      setSaveStatus("idle");
      // Reload to fully reset the form state
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } catch (e) {
      // ignore
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
        paddingBottom: "64px",
      }}
    >
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .step-card {
            animation: fadeInUp 0.5s ease-out;
          }
        `}
      </style>
      <div
        style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px 8px" }}
      >
        <div
          style={{
            textAlign: "center",
            padding: "15px 0",
          }}
        >
          <h1
            style={{
              fontSize: "28px",
              fontWeight: "800",
              marginBottom: "10px",
              color: "#1e293b",
              background: "linear-gradient(135deg, #B8CD61, var(--p-blue))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {isFromExistingContract
              ? "Create Two-level Contract from Existing Purchase"
              : "Two-level Purchase/Sale Contract"}
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "#64748b",
              fontWeight: "500",
            }}
          >
            Complete your contract in 4 simple steps
          </p>
        </div>
        {/* Step Navigation */}
        {renderStepNavigation()}

        {isFromExistingContract && (
          <div
            style={{
              backgroundColor: "#f0f9ff",
              border: "1px solid #84cc16",
              borderRadius: "8px",
              padding: "12px 16px",
              marginBottom: "24px",
              color: "#1e40af",
            }}
          >
            <strong>Base Purchase Contract:</strong>{" "}
            {basePurchaseData?.contractNo || "N/A"} -{" "}
            {basePurchaseData?.basicInfo?.selectedVendorId?.basicInformation
              ?.vendorDisplayName ||
              basePurchaseData?.basicInformation?.vendorDisplayName ||
              "N/A"}
          </div>
        )}

        {/* Step Content */}
        <div style={{ marginBottom: "32px" }}>
          {currentStep === 1 && (
            <div>
              <div
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "16px",
                  padding: "32px",
                  marginBottom: "24px",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
              >
                <h2
                  style={{
                    fontSize: "20px",
                    fontWeight: "700",
                    marginBottom: "24px",
                    color: "#1f2937",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <span
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      backgroundColor: "var(--p-blue)",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                  >
                    1
                  </span>
                  Base Purchase Contract
                </h2>
                {renderToggleButton()}
                {renderSection(
                  "Base Purchase",
                  "basePurchase",
                  [
                    {
                      name: "business",
                      label: "Business",
                      type: "select",
                      options: businessOptions,
                      isBusiness: true,
                    },
                    ...(isFromExistingContract
                      ? []
                      : [
                          {
                            name: "selectedVendorId",
                            label: "Supplier Name",
                            type: "select",
                            options: externalSupplierOptions,
                            isSupplier: true,
                          },
                        ]),
                    {
                      name: "agentName",
                      label: "Agent Name",
                      type: "select",
                      options: agentOptions,
                      isAgent: true,
                    },
                    ...(basePurchase.agentName
                      ? [
                          {
                            name: "commissionPerMTS",
                            label: "Agent Commission (P/MTS)",
                            type: "number",
                            placeholder: "e.g. 10",
                          },
                        ]
                      : []),
                    {
                      name: "ETD_Port",
                      label: "Shipment /Delivery Month",
                      type: "month",
                      placeholder: "MM/YYYY",
                    },
                    {
                      name: "supplierContractNo",
                      label: "Supplier Contract No.",
                      type: "text",
                      placeholder: "Enter supplier contract number",
                    },
                    {
                      name: "supplierContractDate",
                      label: "Supplier Contract Date",
                      type: "date",
                      placeholder: "Select contract date",
                      icon: <FiCalendar />,
                    },
                    {
                      name: "contractDate",
                      label: "Contract Date",
                      type: "date",
                      placeholder:
                        "Select Contract Date (Date on which contract agreed)",
                      disabled: true,
                      icon: <FiCalendar />,
                    },
                    {
                      name: "initialDocuments",
                      label: "Initial Contract Documents",
                      type: "custom",
                      component: () => (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            marginBottom: "8px",
                            width: "100%",
                          }}
                        >
                          <DocumentUpload
                            documents={basePurchaseDocuments}
                            onDocumentsChange={setBasePurchaseDocuments}
                            allowMultiple={true}
                            acceptedTypes=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                            maxSizeMB={10}
                            contractType="purchase"
                          />
                        </div>
                      ),
                    },
                  ],
                  [
                    {
                      name: "itemId",
                      label: "Item",
                      type: "select",
                      options: itemOptions,
                      isItem: true,
                    },
                    { name: "grade", label: "Grade", disabled: true },
                    {
                      name: "containerType",
                      label: "Container Type",
                      disabled: true,
                    },
                    { name: "fclSize", label: "FCL Size", disabled: true },
                    {
                      name: "quantityFCL",
                      label: "Quantity (FCL)",
                      type: "number",
                      placeholder: "Quantity (FCL)",
                    },
                    {
                      name: "quantityMTS",
                      label: "Total Quantity (MTS)",
                      type: "number",
                      placeholder: "Total Quantity (MTS)",
                      step: "0.01",
                    },
                    {
                      name: "unitOfContainer",
                      label: "Unit of Container",
                      disabled: true,
                    },
                    {
                      name: "No_of_Packages",
                      label: "No. of Packages",
                      disabled: true,
                    },
                    {
                      name: "totalQuantity",
                      label: "Total Quantity",
                      type: "text",
                      placeholder: "Total Quantity",
                      disabled: true,
                    },
                    {
                      name: "price",
                      label: "Price (Per MT)",
                      type: "number",
                      placeholder: "USD",
                    },
                    {
                      name: "commissionPerMTS",
                      label: "Agent Commission (P/MTS)",
                      type: "text",
                      placeholder: "Agent Commission per MTS",
                      disabled: true,
                    },
                    {
                      name: "totalAgentCommission",
                      label: "Total Agent Commission",
                      type: "text",
                      placeholder: "Total Agent Commission",
                      disabled: true,
                    },
                    {
                      name: "totalValue",
                      label: "Total Value (USD)",
                      type: "number",
                      placeholder: "USD",
                      disabled: true,
                    },
                    {
                      name: "selectedCurrency",
                      label: "Currency",
                      type: "select",
                      options: currencyOptions,
                    },
                    {
                      name: "conversionRate",
                      label: "Conversion Rate",
                      type: "number",
                      placeholder: "Conversion Rate",
                    },
                    {
                      name: "amountInSelectedCurrency",
                      label: "Amount in Selected Currency",
                      type: "number",
                      placeholder: "Amount",
                      disabled: true,
                    },
                    {
                      name: "additionalCharges",
                      label: "Additional Charges (if any)",
                      type: "number",
                      placeholder: "USD",
                    },
                    { name: "packing", label: "Packing", disabled: true },
                    { name: "remarks", label: "Remarks", disabled: true },
                    {
                      name: "origin_country",
                      label: "Country of Origin",
                      type: "select",
                      options: countryOptions,
                    },
                    {
                      name: "portOfLanding",
                      label: "Port of Loading",
                      type: "select",
                      options: portOptions,
                    },
                    {
                      name: "portOfDestination",
                      label: "Port of Destination",
                      type: "select",
                      options: portOptions,
                    },
                    {
                      name: "estimatedDeparture",
                      label: "Estimated time of Departure (ETD)",
                      type: "date",
                      icon: <FiCalendar />,
                    },
                    { name: "paymentTerms", label: "Payment Terms" },
                    {
                      name: "deposit",
                      label: "Deposit %",
                      type: "number",
                      placeholder: "USD",
                    },
                    {
                      name: "breakEvenValue",
                      label: "Breakeven Value",
                      type: "number",
                      placeholder: "Breakeven Value",
                    },
                    { name: "shippingTerms", label: "Shipping Terms" },
                  ]
                )}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <div
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "16px",
                  padding: "32px",
                  marginBottom: "24px",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
              >
                <h2
                  style={{
                    fontSize: "20px",
                    fontWeight: "700",
                    marginBottom: "24px",
                    color: "#1f2937",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <span
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      backgroundColor: "var(--p-blue)",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                  >
                    2
                  </span>
                  Sale Contract 1
                </h2>
                {renderToggleButton()}
                {renderSection(
                  "Sale Contract 1",
                  "sale1",
                  [
                    {
                      name: "ref",
                      label: "REF",
                      type: "text",
                      placeholder: "Enter REF",
                    },
                    {
                      name: "contractCreationDate",
                      label: "Contract Creation Date",
                      type: "date",
                      placeholder: "Select Contract Creation Date",
                      disabled: true,
                      icon: <FiCalendar />,
                    },
                    {
                      name: "contractDate",
                      label: "Contract Date",
                      type: "date",
                      placeholder:
                        "Select Contract Date (Date on which contract agreed)",
                      icon: <FiCalendar />,
                    },
                    {
                      name: "typeOfSaleContract",
                      label: "Type of Sales Contract",
                      type: "select",
                      options: [
                        { value: "Nominal", label: "Nominal" },
                        { value: "Confirmed", label: "Confirmed" },
                        { value: "Profit Sharing", label: "Profit Sharing" },
                      ],
                    },
                    {
                      name: "salesPerson",
                      label: "Sales Person",
                      type: "select",
                      options: salespersonOptions,
                      disabled: false,
                      isSales: true,
                    },
                    ...(sale1.typeOfSaleContract === "Profit Sharing"
                      ? [
                          {
                            name: "finalCustomerName",
                            label: "Final Customer",
                            type: "select",
                            options: sale1CustomerOptions,
                            isCustomer: true,
                            isFinalCustomer: true,
                          },
                          {
                            name: "salesContractNumberByFirstCustomer",
                            label: "Sales Contract Number (by First Customer)",
                            type: "text",
                            placeholder: "Enter Sales Contract Number",
                          },
                        ]
                      : []),
                    {
                      name: "buyerCompanyName",
                      label: "Buyer Company Name",
                      type: "select",
                      options: sale1CustomerOptions,
                      isCustomer: true,
                    },
                    {
                      name: "agentName",
                      label: "Agent Name",
                      type: "select",
                      options: agentOptions,
                      isAgent: true,
                    },
                    ...(sale1.agentName
                      ? [
                          {
                            name: "commissionPerMTS",
                            label: "Agent Commission (P/MTS)",
                            type: "number",
                            placeholder: "e.g. 10",
                          },
                        ]
                      : []),
                    {
                      name: "bankAccount",
                      label: "Bank Account",
                      type: "select",
                      options: bankOptions,
                      isBank: true,
                    },
                    {
                      name: "ETD_Port",
                      label: "ETD Port of Loading",
                      type: "month",
                      placeholder: "MM/YYYY",
                      icon: <FiCalendar />,
                    },
                    {
                      name: "origin_country",
                      label: "Country of origin",
                      type: "select",
                      options: countryOptions,
                    },
                    {
                      name: "port_of_loading",
                      label: "Port of Loading",
                      type: "select",
                      options: portOptions,
                    },
                    {
                      name: "port_of_discharge",
                      label: "Port of Discharge",
                      type: "select",
                      options: portOptions,
                    },
                  ],
                  [
                    {
                      name: "price",
                      label: "Price (Auto: Base + 5)",
                      type: "number",
                      placeholder: "Price",
                      disabled: true,
                    },
                    {
                      name: "totalValue",
                      label: "Total Value (USD)",
                      type: "number",
                      placeholder: "USD",
                      disabled: true,
                    },
                    {
                      name: "selectedCurrency",
                      label: "Currency",
                      type: "select",
                      options: currencyOptions,
                    },
                    {
                      name: "conversionRate",
                      label: "Conversion Rate",
                      type: "number",
                      placeholder: "Conversion Rate",
                    },
                    {
                      name: "amountInSelectedCurrency",
                      label: "Amount in Selected Currency",
                      type: "number",
                      placeholder: "Amount",
                      disabled: true,
                    },
                    {
                      name: "commissionPerMTS",
                      label: "Agent Commission (P/MTS)",
                      type: "text",
                      placeholder: "Agent Commission per MTS",
                      disabled: true,
                    },
                    {
                      name: "totalAgentCommission",
                      label: "Total Agent Commission",
                      type: "text",
                      placeholder: "Total Agent Commission",
                      disabled: true,
                    },
                    {
                      name: "totalQuantity",
                      label: "Total Quantity",
                      type: "text",
                      placeholder: "Total Quantity",
                      disabled: true,
                    },
                    {
                      name: "forecastCostDescription",
                      label: "Forecast Cost Description",
                      type: "select",
                      placeholder: "Select Forecast Cost Description(s)",
                      options: forecastCostDescriptions.map((desc) => ({
                        value: desc.name,
                        label: desc.name,
                      })),
                    },
                    {
                      name: "forecastCost",
                      label: "Forecast Cost (USD)",
                      type: "number",
                      placeholder: "Enter Forecast Cost",
                    },
                    {
                      name: "forecastTotalCost",
                      label: "Forecast Total Cost (USD)",
                      type: "text",
                      placeholder: "Calculated: Total Quantity × Forecast Cost",
                      disabled: true,
                    },
                    { name: "paymentTerms", label: "Payment Terms" },
                    {
                      name: "deposit",
                      label: "Deposit %",
                      type: "number",
                      placeholder: "Deposit %",
                    },
                    { name: "shippingTerms", label: "Shipping Terms" },
                    { name: "remarks", label: "Remarks" },
                  ]
                )}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <div
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "16px",
                  padding: "32px",
                  marginBottom: "24px",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
              >
                <h2
                  style={{
                    fontSize: "20px",
                    fontWeight: "700",
                    marginBottom: "24px",
                    color: "#1f2937",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <span
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      backgroundColor: "var(--p-blue)",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                  >
                    3
                  </span>
                  Purchase Contract 2
                </h2>
                {renderToggleButton()}
                {renderSection(
                  "Purchase Contract 2",
                  "purchase2",
                  [
                    purchase2SupplierAutoSelected &&
                    purchase2SupplierOptions.length === 1
                      ? {
                          name: "selectedVendorId",
                          label: "Supplier Name",
                          type: "select",
                          options: purchase2SupplierOptions,
                          isSupplier: true,
                        }
                      : {
                          name: "selectedVendorId",
                          label: "Supplier Name",
                          type: "select",
                          options: purchase2SupplierOptions,
                          isSupplier: true,
                        },
                  ],
                  [
                    {
                      name: "price",
                      label: "Price (Per MT)(USD) - Auto: Base + 5",
                      type: "number",
                      placeholder: "USD",
                      disabled: true,
                    },
                    {
                      name: "commissionPerMTS",
                      label: "Agent Commission (P/MTS)",
                      type: "text",
                      placeholder: "Agent Commission per MTS",
                      disabled: true,
                    },
                    {
                      name: "totalAgentCommission",
                      label: "Total Agent Commission",
                      type: "text",
                      placeholder: "Total Agent Commission",
                      disabled: true,
                    },
                    {
                      name: "totalQuantity",
                      label: "Total Quantity",
                      type: "text",
                      placeholder: "Total Quantity",
                      disabled: true,
                    },
                    {
                      name: "totalValue",
                      label: "Total Value (USD)",
                      type: "number",
                      placeholder: "USD",
                      disabled: true,
                    },
                    {
                      name: "selectedCurrency",
                      label: "Currency",
                      type: "select",
                      options: currencyOptions,
                    },
                    {
                      name: "conversionRate",
                      label: "Conversion Rate",
                      type: "number",
                      placeholder: "Conversion Rate",
                    },
                    {
                      name: "amountInSelectedCurrency",
                      label: "Amount in Selected Currency",
                      type: "number",
                      placeholder: "Amount",
                      disabled: true,
                    },
                    {
                      name: "additionalCharges",
                      label: "Additional Charges (if any)",
                      type: "number",
                      placeholder: "USD",
                    },
                    {
                      name: "origin_country",
                      label: "Country of Origin",
                      type: "select",
                      options: countryOptions,
                    },
                    {
                      name: "portOfLanding",
                      label: "Port of Loading",
                      type: "select",
                      options: portOptions,
                    },
                    {
                      name: "portOfDestination",
                      label: "Port of Destination",
                      type: "select",
                      options: portOptions,
                    },
                    { name: "paymentTerms", label: "Payment Terms" },
                    {
                      name: "deposit",
                      label: "Deposit %",
                      type: "number",
                      placeholder: "USD",
                    },
                    {
                      name: "breakEvenValue",
                      label: "Breakeven Value",
                      type: "number",
                      placeholder: "Breakeven Value",
                    },
                    { name: "shippingTerms", label: "Shipping Terms" },
                  ]
                )}
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div>
              <div
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "16px",
                  padding: "32px",
                  marginBottom: "24px",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
              >
                <h2
                  style={{
                    fontSize: "20px",
                    fontWeight: "700",
                    marginBottom: "24px",
                    color: "#1f2937",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <span
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      backgroundColor: "var(--p-blue)",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                  >
                    4
                  </span>
                  Sale Contract 2
                </h2>
                {renderToggleButton()}
                {renderSection(
                  "Sale Contract 2",
                  "sale2",
                  [
                    {
                      name: "ref",
                      label: "REF",
                      type: "text",
                      placeholder: "Enter REF",
                    },
                    {
                      name: "contractCreationDate",
                      label: "Contract Creation Date",
                      type: "date",
                      placeholder: "Select Contract Creation Date",
                      disabled: true,
                      icon: <FiCalendar />,
                    },
                    {
                      name: "contractDate",
                      label: "Contract Date",
                      type: "date",
                      placeholder:
                        "Select Contract Date (Date on which contract agreed)",
                      icon: <FiCalendar />,
                    },
                    {
                      name: "typeOfSaleContract",
                      label: "Type of Sales Contract",
                      type: "select",
                      options: [
                        { value: "Nominal", label: "Nominal" },
                        { value: "Confirmed", label: "Confirmed" },
                        { value: "Profit Sharing", label: "Profit Sharing" },
                      ],
                    },
                    {
                      name: "salesPerson",
                      label: "Sales Person",
                      type: "select",
                      options: sale2SalespersonOptions,
                      disabled: false,
                      isSales: true,
                    },
                    {
                      name: "buyerCompanyName",
                      label: "Buyer Company Name",
                      type: "select",
                      options: sale2CustomerOptions,
                      isCustomer: true,
                    },
                    ...(sale2.typeOfSaleContract === "Profit Sharing"
                      ? [
                          {
                            name: "finalCustomerName",
                            label: "Final Customer",
                            type: "select",
                            options: sale2CustomerOptions,
                            isFinalCustomer: true,
                          },
                          {
                            name: "salesContractNumberByFirstCustomer",
                            label: "Sales Contract Number (by First Customer)",
                            type: "text",
                            placeholder: "Enter Sales Contract Number",
                          },
                        ]
                      : []),
                    {
                      name: "agentName",
                      label: "Agent Name",
                      type: "select",
                      options: agentOptions,
                      isAgent: true,
                    },
                    ...(sale2.agentName
                      ? [
                          {
                            name: "commissionPerMTS",
                            label: "Agent Commission (P/MTS)",
                            type: "number",
                            placeholder: "e.g. 10",
                          },
                        ]
                      : []),
                    {
                      name: "bankAccount",
                      label: "Bank Account",
                      type: "select",
                      options: sale2BankOptions,
                      isBank: true,
                    },
                    {
                      name: "ETD_Port",
                      label: "ETD Port of Loading",
                      type: "month",
                      placeholder: "MM/YYYY",
                      icon: <FiCalendar />,
                    },
                    {
                      name: "origin_country",
                      label: "Country of origin",
                      type: "select",
                      options: countryOptions,
                    },
                    {
                      name: "port_of_loading",
                      label: "Port of Loading",
                      type: "select",
                      options: portOptions,
                    },
                    {
                      name: "port_of_discharge",
                      label: "Port of Discharge",
                      type: "select",
                      options: portOptions,
                    },
                  ],
                  [
                    {
                      name: "price",
                      label: "Price",
                      type: "number",
                      placeholder: "Price",
                    },
                    ...(sale2.typeOfSaleContract === "Profit Sharing"
                      ? [
                          {
                            name: "priceForFinalCustomer",
                            label: "Price for Final Customer",
                            type: "number",
                            placeholder: "Enter Price for Final Customer",
                          },
                        ]
                      : []),
                    {
                      name: "totalValue",
                      label: "Total Value (USD)",
                      type: "number",
                      placeholder: "USD",
                      disabled: true,
                    },
                    {
                      name: "selectedCurrency",
                      label: "Currency",
                      type: "select",
                      options: currencyOptions,
                    },
                    {
                      name: "conversionRate",
                      label: "Conversion Rate",
                      type: "number",
                      placeholder: "Conversion Rate",
                    },
                    {
                      name: "amountInSelectedCurrency",
                      label: "Amount in Selected Currency",
                      type: "number",
                      placeholder: "Amount",
                      disabled: true,
                    },
                    {
                      name: "commissionPerMTS",
                      label: "Agent Commission (P/MTS)",
                      type: "text",
                      placeholder: "Agent Commission per MTS",
                      disabled: true,
                    },
                    {
                      name: "totalAgentCommission",
                      label: "Total Agent Commission",
                      type: "text",
                      placeholder: "Total Agent Commission",
                      disabled: true,
                    },
                    {
                      name: "forecastCostDescription",
                      label: "Forecast Cost Description",
                      type: "select",
                      placeholder: "Select Forecast Cost Description(s)",
                      options: forecastCostDescriptions.map((desc) => ({
                        value: desc.name,
                        label: desc.name,
                      })),
                    },
                    {
                      name: "forecastCost",
                      label: "Forecast Cost (USD)",
                      type: "number",
                      placeholder: "Enter Forecast Cost",
                    },
                    {
                      name: "forecastTotalCost",
                      label: "Forecast Total Cost (USD)",
                      type: "text",
                      placeholder: "Calculated: Total Quantity × Forecast Cost",
                      disabled: true,
                    },
                    { name: "paymentTerms", label: "Payment Terms" },
                    {
                      name: "deposit",
                      label: "Deposit %",
                      type: "number",
                      placeholder: "Deposit %",
                    },
                    { name: "shippingTerms", label: "Shipping Terms" },
                    { name: "remarks", label: "Remarks" },
                  ]
                )}
              </div>
            </div>
          )}
        </div>

        {/* Step Navigation Buttons */}
        <div
          className="step-card"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(20px)",
            borderRadius: "24px",
            padding: "24px",
            marginTop: "40px",
            boxShadow:
              "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                color:
                  saveStatus === "saved"
                    ? "#16a34a"
                    : saveStatus === "saving"
                    ? "#2563eb"
                    : saveStatus === "error"
                    ? "#dc2626"
                    : "#6b7280",
              }}
            >
              {saveStatus === "saving" && "Saving…"}
              {saveStatus === "saved" && "Saved ✓"}
              {saveStatus === "error" && "Save failed"}
              {saveStatus === "idle" && "Draft not saved"}
            </div>
            <button
              style={{
                padding: "8px 14px",
                borderRadius: "12px",
                backgroundColor: "#f3f4f6",
                color: "#374151",
                fontWeight: "500",
                border: "1px solid #e5e7eb",
                fontSize: "12px",
                cursor: "pointer",
              }}
              onClick={clearDraft}
            >
              Clear draft
            </button>
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              style={{
                padding: "14px 28px",
                borderRadius: "16px",
                background: "linear-gradient(135deg, #f8fafc, #e2e8f0)",
                color: "#475569",
                fontWeight: "600",
                border: "none",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                fontSize: "15px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                whiteSpace: "nowrap",
                boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
                transform: "translateY(0)",
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 8px 16px rgba(0, 0, 0, 0.15)";
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.1)";
              }}
              onClick={() => history.push("/purchase_contracts")}
              disabled={loading}
            >
              ← Cancel
            </button>

            {currentStep > 1 && (
              <button
                style={{
                  padding: "12px 24px",
                  borderRadius: "12px",
                  backgroundColor: "#ffffff",
                  color: "#374151",
                  fontWeight: "500",
                  border: "1px solid #d1d5db",
                  transition: "all 0.2s",
                  fontSize: "14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  whiteSpace: "nowrap",
                }}
                onClick={prevStep}
                disabled={loading}
              >
                ← Previous
              </button>
            )}

            <div
              style={{
                fontSize: "14px",
                color: "#6b7280",
                marginRight: "16px",
                alignSelf: "center",
                whiteSpace: "nowrap",
              }}
            >
              Step {currentStep} of 4
            </div>

            {currentStep < 4 ? (
              <button
                style={{
                  padding: "12px 24px",
                  borderRadius: "12px",
                  backgroundColor: isStepValid(currentStep)
                    ? "var(--p-blue)"
                    : "#9ca3af",
                  color: "#ffffff",
                  fontWeight: "600",
                  transition: "all 0.2s",
                  fontSize: "14px",
                  cursor: isStepValid(currentStep) ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  whiteSpace: "nowrap",
                }}
                onClick={nextStep}
                disabled={!isStepValid(currentStep) || loading}
              >
                Next →
              </button>
            ) : (
              <>
                {/* Checkbox for Submit to Management */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginRight: "16px",
                    padding: "8px 12px",
                    backgroundColor: "#f8fafc",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <input
                    type="checkbox"
                    id="submitToManagement"
                    checked={submitToManagement}
                    onChange={(e) => setSubmitToManagement(e.target.checked)}
                    disabled={loading}
                    style={{
                      width: "18px",
                      height: "18px",
                      cursor: loading ? "not-allowed" : "pointer",
                      accentColor: "var(--p-blue)",
                    }}
                  />
                  <label
                    htmlFor="submitToManagement"
                    style={{
                      fontSize: "14px",
                      color: "#475569",
                      fontWeight: "500",
                      cursor: loading ? "not-allowed" : "pointer",
                      userSelect: "none",
                    }}
                  >
                    Submit to Management
                  </label>
                </div>
                <button
                  style={{
                    padding: "12px 24px",
                    borderRadius: "12px",
                    backgroundColor: "#84cc16",
                    color: "#ffffff",
                    fontWeight: "600",
                    transition: "all 0.2s",
                    fontSize: "14px",
                    cursor: loading ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    whiteSpace: "nowrap",
                  }}
                  onClick={() => handleSubmit("final")}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div
                        style={{
                          width: "16px",
                          height: "16px",
                          border: "2px solid rgba(255,255,255,0.3)",
                          borderRadius: "50%",
                          borderTopColor: "#ffffff",
                          animation: "spin 1s linear infinite",
                        }}
                      />
                      Processing...
                    </>
                  ) : (
                    <>
                      ✓{" "}
                      {isFromExistingContract
                        ? "Create Two Level Contract"
                        : "Create Contract"}
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div style={{ color: "#ef4444", marginTop: "16px" }}>{error}</div>
        )}
        {success && (
          <div style={{ color: "#16a34a", marginTop: "16px" }}>{success}</div>
        )}
      </div>
    </div>
  );
}
