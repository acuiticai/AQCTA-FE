import React, { useState, useEffect } from "react";
import axios from "axios";
import { FiUpload, FiX } from "react-icons/fi";
import AdminServices from "@/services/AdminServices";
import useAsync from "@/hooks/useAsync";
import SearchableDropdown from "@/components/SearchableDropdown";
import SingleBusinessField from "@/components/SingleBusinessField";
import { readAssignedBusinessesFallback } from "@/utils/sessionAssignedBusinesses";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const AddLedgerFromStatement = ({ statementData, onClose }) => {
  // State for form data
  const [accountTypes, setAccountTypes] = useState([]);
  const [selectedBusinessName, setSelectedBusinessName] = useState("");

  const [formData, setFormData] = useState({
    business: "",
    reference: statementData?.reference || "",
    type:
      statementData?.deposit && statementData.deposit > 0
        ? "Income"
        : "Expense", // Set based on deposit/withdrawal
    bankAccountId: statementData?.accountId,
    amount: statementData?.deposit
      ? statementData.deposit
      : statementData?.withdrawal || "",
    date: statementData?.date
      ? new Date(statementData.date).toISOString().split("T")[0]
      : "",
    description: statementData?.description || "",
    category: "",
    customerId: "",
    vendorId: "",
    staffId: "",
    salesContractId: "",
    purchaseContractId: "",
    status: "Pending",
    documents: [],
    payee: statementData?.payee || "",
  });

  // States for dropdowns
  const [businesses, setBusinesses] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const { data: staff } = useAsync(AdminServices.getAllStaff);
  const [salesContracts, setSalesContracts] = useState([]);
  const [purchaseContracts, setPurchaseContracts] = useState([]);

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setFormData((prev) => ({
      ...prev,
      documents: [
        ...prev.documents,
        ...files.map((file) => ({
          name: file.name,
          file,
        })),
      ],
    }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    const formDataToSend = new FormData();

    // Append text fields
    Object.keys(formData).forEach((key) => {
      if (key !== "documents") {
        formDataToSend.append(key, formData[key]);
      }
    });

    // Append documents
    formData.documents.forEach((doc) => {
      formDataToSend.append("documents", doc.file);
    });

    try {
      await axios.post(`${Base_URL}/ledger-management/add`, formDataToSend, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      onClose(); // Close modal after successful submission
    } catch (error) {
      console.error("Failed to add ledger entry:", error);
    }
  };

  // Fetch data for dropdowns
  useEffect(() => {
    const parsedBusinesses = readAssignedBusinessesFallback();
    setBusinesses(parsedBusinesses);

    console.log("statementData", statementData);

    // Auto-select business if it matches statementData.business
    if (statementData?.business) {
      const matchedBusiness = parsedBusinesses.find(
        (business) => business._id === statementData.business
      );
      console.log("matchedBusiness", matchedBusiness);
      setSelectedBusinessName(matchedBusiness?.name);
      if (matchedBusiness) {
        setFormData((prev) => ({
          ...prev,
          business: matchedBusiness?._id,
        }));
      }
    } else if (parsedBusinesses.length === 1) {
      setSelectedBusinessName(parsedBusinesses[0]?.name);
      setFormData((prev) => ({
        ...prev,
        business: parsedBusinesses[0]?._id,
      }));
    }

    // Fetch bank accounts
    const fetchBankAccounts = async () => {
      try {
        const response = await axios.get(
          `${Base_URL}/bank-management/accounts`
        );
        setBankAccounts(response.data.accounts);
      } catch (error) {
        console.error("Failed to fetch bank accounts:", error);
      }
    };

    // Fetch customers
    const fetchCustomers = async () => {
      try {
        const response = await axios.get(`${Base_URL}/customers`);
        setCustomers(response.data);
      } catch (error) {
        console.error("Failed to fetch customers:", error);
      }
    };

    // Fetch vendors
    const fetchVendors = async () => {
      try {
        const response = await axios.get(`${Base_URL}/vendors`);
        setVendors(response.data.data);
      } catch (error) {
        console.error("Failed to fetch vendors:", error);
      }
    };

    // Fetch sales contracts
    const fetchSalesContracts = async () => {
      try {
        const response = await axios.get(`${Base_URL}/sales-contracts`);
        setSalesContracts(response.data.contracts);
      } catch (error) {
        console.error("Failed to fetch sales contracts:", error);
      }
    };

    // Fetch purchase contracts
    const fetchPurchaseContracts = async () => {
      try {
        const response = await axios.get(`${Base_URL}/contracts/contracts`);
        setPurchaseContracts(response.data);
      } catch (error) {
        console.error("Failed to fetch purchase contracts:", error);
      }
    };

    const fetchAccountTypes = async () => {
      try {
        const response = await axios.get(`${Base_URL}/account-types`);
        setAccountTypes(response.data);
      } catch (error) {
        console.error("Error fetching account types:", error);
      }
    };

    fetchAccountTypes();
    fetchBankAccounts();
    fetchCustomers();
    fetchVendors();
    fetchSalesContracts();
    fetchPurchaseContracts();
  }, [statementData]);

  // Auto-match vendor if payee is provided
  useEffect(() => {
    if (formData.payee && vendors.length > 0) {
      const matchedVendor = vendors.find((vendor) =>
        vendor.companyInfo?.businessName
          .toLowerCase()
          .includes(formData.payee.toLowerCase())
      );

      if (matchedVendor) {
        setFormData((prev) => ({
          ...prev,
          vendorId: matchedVendor.companyInfo?.businessName,
        }));
      }
    }
  }, [formData.payee, vendors]);

  // Group account types by header
  const groupedAccountTypes = accountTypes.reduce((acc, account) => {
    if (!acc[account.accountHeader]) {
      acc[account.accountHeader] = [];
    }
    acc[account.accountHeader].push(account);
    return acc;
  }, {});

  // Sort accounts within each header
  Object.keys(groupedAccountTypes).forEach((header) => {
    groupedAccountTypes[header].sort((a, b) => a.name.localeCompare(b.name));
  });

  // Filter account types based on transaction type
  const relevantAccountHeader =
    formData.type === "Income" ? "Income" : "Expense";
  const filteredAccountTypes = groupedAccountTypes[relevantAccountHeader] || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-end z-50">
      <div className="bg-white h-full max-w-lg w-full overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Add Statement to Ledger</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <FiX size={24} />
            </button>
          </div>

          <p className="text-gray-600 mb-6">
            Enter the details below to complete the process.
          </p>

          <form onSubmit={handleSubmit}>
            <SingleBusinessField
              selectedValue={formData.business}
              onAutoSelect={(id) => {
                const matched = businesses.find((b) => String(b._id) === String(id));
                setSelectedBusinessName(matched?.name || "");
                setFormData((prev) => ({ ...prev, business: id }));
              }}
            >
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">
                {selectedBusinessName ? selectedBusinessName : "Business"}
              </label>
              <SearchableDropdown
                name="business"
                value={formData.business}
                onChange={handleChange}
                placeholder="Business"
                searchPlaceholder="Search businesses..."
                options={
                  businesses?.map((business) => ({
                    value: business._id,
                    label: business.name,
                  })) || []
                }
                required
              />
            </div>
            </SingleBusinessField>

            {/* Transaction Reference */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">
                Transaction Reference #
              </label>
              <input
                type="text"
                name="reference"
                placeholder="Transaction Reference #"
                className="w-full bg-gray-100 rounded-md py-3 px-4 focus:outline-none"
                value={formData.reference}
                onChange={handleChange}
                required
              />
            </div>

            {/* Transaction Type - Read-only */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">
                Transaction Type
              </label>
              <input
                type="text"
                className="w-full bg-gray-100 rounded-md py-3 px-4 focus:outline-none cursor-not-allowed"
                value={formData.type}
                readOnly
              />
              {/* <p className="text-xs text-gray-500 mt-1">
                {formData.type === "Income" 
                  ? "This is an income transaction based on deposit."
                  : "This is an expense transaction based on withdrawal."}
              </p> */}
            </div>

            {/* Bank Account ID */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">
                Bank Account ID
              </label>
              <SearchableDropdown
                name="bankAccountId"
                value={formData?.bankAccountId}
                onChange={handleChange}
                placeholder={
                  formData?.bankAccountId
                    ? formData?.bankAccountId
                    : "Bank Account ID"
                }
                searchPlaceholder="Search bank accounts..."
                options={bankAccounts.map((account) => ({
                  value: account.accountName,
                  label: account.accountName,
                }))}
                required
              />
            </div>

            {/* Amount - Read-only */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">Amount</label>
              <input
                type="text"
                className="w-full bg-gray-100 rounded-md py-3 px-4 focus:outline-none cursor-not-allowed"
                value={formData.amount}
                readOnly
              />
            </div>

            {/* Date - Read-only */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">Date</label>
              <input
                type="text"
                className="w-full bg-gray-100 rounded-md py-3 px-4 focus:outline-none cursor-not-allowed"
                value={formData.date}
                readOnly
              />
            </div>

            {/* Description */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">
                Description
              </label>
              <input
                type="text"
                name="description"
                placeholder="Description"
                className="w-full bg-gray-100 rounded-md py-3 px-4 focus:outline-none"
                value={formData.description}
                onChange={handleChange}
                required
              />
            </div>

            {/* Category - Filtered based on transaction type */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">
                {formData.type === "Income"
                  ? "Associated Income Category"
                  : "Associated Expense Category"}
              </label>
              <SearchableDropdown
                name="category"
                value={formData.category}
                onChange={handleChange}
                placeholder={
                  formData.type === "Income"
                    ? "Select Income Category"
                    : "Select Expense Category"
                }
                searchPlaceholder="Search categories..."
                options={filteredAccountTypes.map((account) => ({
                  value: account._id,
                  label: account.name,
                }))}
                required
              />
            </div>

            {/* Customer ID - Show only for Income transactions */}
            {formData.type === "Income" && (
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-2">
                  Customer ID (optional)
                </label>
                <SearchableDropdown
                  name="customerId"
                  value={formData.customerId}
                  onChange={handleChange}
                  placeholder="Customer ID"
                  searchPlaceholder="Search customers..."
                  options={
                    customers?.length > 0
                      ? customers?.map((customer) => ({
                          value: customer?.basicInformation?.companyName,
                          label: customer?.basicInformation?.companyName,
                        }))
                      : []
                  }
                />
              </div>
            )}

            {/* Vendor ID - Show only for Expense transactions */}
            {formData.type === "Expense" && (
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-2">
                  Vendor ID (optional)
                </label>
                <SearchableDropdown
                  name="vendorId"
                  value={formData.vendorId}
                  onChange={handleChange}
                  placeholder="Vendor ID"
                  searchPlaceholder="Search vendors..."
                  options={vendors.map((vendor) => ({
                    value: vendor.companyInfo?.businessName,
                    label: vendor.companyInfo?.businessName,
                  }))}
                />
              </div>
            )}

            {/* Staff ID */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">
                Staff ID (optional)
              </label>
              <SearchableDropdown
                name="staffId"
                value={formData.staffId}
                onChange={handleChange}
                placeholder="Staff ID"
                searchPlaceholder="Search staff..."
                options={staff.map((staffMember) => ({
                  value: staffMember?.name,
                  label: staffMember?.name,
                }))}
              />
            </div>

            {/* Sales Contract ID - Show only for Income transactions */}
            {formData.type === "Income" && (
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-2">
                  Sales Contract ID (optional)
                </label>
                <SearchableDropdown
                  name="salesContractId"
                  value={formData.salesContractId}
                  onChange={handleChange}
                  placeholder="Sales Contract ID"
                  searchPlaceholder="Search sales contracts..."
                  options={salesContracts.map((contract) => ({
                    value: contract?.basicInfo?.buyerCompanyName,
                    label: contract?.basicInfo?.buyerCompanyName,
                  }))}
                />
              </div>
            )}

            {/* Purchase Contract ID - Show only for Expense transactions */}
            {formData.type === "Expense" && (
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-2">
                  Purchase Contract ID (optional)
                </label>
                <SearchableDropdown
                  name="purchaseContractId"
                  value={formData.purchaseContractId}
                  onChange={handleChange}
                  placeholder="Purchase Contract ID"
                  searchPlaceholder="Search purchase contracts..."
                  options={purchaseContracts.map((contract) => ({
                    value: contract?.basicInfo?.purchasingCompany,
                    label: contract?.basicInfo?.purchasingCompany,
                  }))}
                />
              </div>
            )}

            {/* Transaction Status */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">
                Transaction Status
              </label>
              <SearchableDropdown
                name="status"
                value={formData.status}
                onChange={handleChange}
                placeholder="Select Status"
                searchPlaceholder="Search status..."
                options={[
                  { value: "Pending", label: "Pending" },
                  { value: "Paid", label: "Paid" },
                  { value: "Cancelled", label: "Cancelled" },
                ]}
                required
              />
            </div>

            {/* Support Documents */}
            <div className="mb-6">
              <label className="block text-sm text-gray-600 mb-2">
                Support Documents
              </label>
              <button
                type="button"
                onClick={() =>
                  document.getElementById("documentUpload").click()
                }
                className="w-full border border-[var(--p-blue)] border-dashed rounded-md py-4 flex flex-col items-center justify-center"
              >
                <FiUpload className="text-[var(--p-blue)] text-xl mb-2" />
                <span className="text-gray-500">Upload Support Documents</span>
              </button>
              <input
                id="documentUpload"
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />

              {formData.documents.length > 0 && (
                <div className="mt-4">
                  <div className="flex flex-wrap gap-3">
                    {formData.documents.map((doc, index) => (
                      <div
                        key={index}
                        className="bg-gray-100 rounded-md p-2 flex items-center justify-between"
                      >
                        <div className="flex items-center">
                          <div className="h-8 w-8 bg-red-500 rounded flex items-center justify-center text-white text-xs mr-2">
                            PDF
                          </div>
                          <span className="text-sm truncate max-w-[150px]">
                            {doc.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="text-gray-600 hover:text-gray-900 ml-2"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              documents: prev.documents.filter(
                                (_, i) => i !== index
                              ),
                            }));
                          }}
                        >
                          <FiX size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 mt-8">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-md text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-[var(--p-blue)] hover:bg-[#9BBE29] rounded-md text-white"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddLedgerFromStatement;
