import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { Download, Search, RefreshCw, DollarSign } from "lucide-react";
import {
  DataTable,
  InputField,
  DropdownBasic,
  FormInput,
  Loader,
} from "@/page-layouts/index";
import { formatDate } from "@/components/formatAmount";
import { toast } from "react-toastify";
import { AdminContext } from "@/context/AdminContext";
import BusinessDropdown from "@/page-layouts/components/helpers/BusinessDropdown";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const SalesWithoutPurchaseReports = () => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {};
  const adminId = adminInfo?.id || adminInfo?._id;

  const [searchParams, setSearchParams] = useState({
    search: "",
    year: "",
    month: "",
    investor: "",
    business: "",
    customerName: "",
    typeOfProduct: "",
    subSalesContractNo: "",
    startDate: "",
    endDate: "",
    // Force only Sales Without Purchase
    salesStatus: "SALES WITHOUT PURCHASE",
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [customerOptions, setCustomerOptions] = useState([]);
  const [productTypeOptions, setProductTypeOptions] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [baseCurrency, setBaseCurrency] = useState("USD");

  const currentYear = new Date().getFullYear();
  const yearOptions = [
    { value: "", label: "All Years" },
    ...Array.from({ length: 11 }, (_, i) => {
      const year = currentYear - i;
      return { value: year.toString(), label: year.toString() };
    }),
  ];

  const monthOptions = [
    { value: "", label: "All Months" },
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  const investorOptions = [
    { value: "", label: "All Investors" },
    { value: "BARENA", label: "BARENA" },
    { value: "BAHMAN", label: "BAHMAN" },
  ];

  const [items, setItems] = useState([]);

  const fetchProductTypes = async () => {
    try {
      let businessIds = [];
      const storedBusinesses = localStorage.getItem("businesses");
      if (storedBusinesses) {
        const businessesArr = JSON.parse(storedBusinesses);
        businessIds = businessesArr.map((b) => b._id);
      }

      let query = {};
      if (searchParams.business) {
        query.businessId = searchParams.business;
      } else if (businessIds.length > 0) {
        query.businessIds = businessIds;
      }

      const response = await axios.get(`${Base_URL}/items`, { params: query });

      if (response.status === 200 && response.data) {
        const itemsData = Array.isArray(response.data)
          ? response.data
          : response.data.items || [];
        setItems(itemsData);

        const uniqueTypes = [
          ...new Map(
            itemsData
              .map((item) => {
                const itemName =
                  item.name || item.title || item.typeOfProduct || "";
                return [itemName, { value: itemName, label: itemName }];
              })
              .filter(([name]) => name && name.trim() !== "")
          ).values(),
        ].sort((a, b) => a.label.localeCompare(b.label));

        setProductTypeOptions([
          { value: "", label: "All Products" },
          ...uniqueTypes,
        ]);
      }
    } catch (err) {
      console.error("Error fetching product types:", err);
      setProductTypeOptions([
        { value: "", label: "All Products" },
        { value: "LATEX", label: "LATEX" },
        { value: "NATURAL", label: "NATURAL" },
        { value: "SYNTHETIC", label: "SYNTHETIC" },
        { value: "CARBON BLACK", label: "CARBON BLACK" },
        { value: "NATURAL RUBBER", label: "NATURAL RUBBER" },
        { value: "RUBBER", label: "RUBBER" },
        { value: "OTHER", label: "OTHER" },
      ]);
    }
  };

  const fetchCustomerOptions = async () => {
    try {
      const response = await axios.get(`${Base_URL}/customers`);
      if (response.status) {
        const customers = response?.data.customers || response?.data || [];
        const transformedCustomers = customers.map((customer) => ({
          value: customer._id,
          label:
            customer?.basicInfo?.buyerCompanyName ||
            customer?.basicInformation?.customerDisplayName ||
            customer?.basicInformation?.companyName ||
            customer?.companyName ||
            customer?.name ||
            "Unknown Customer",
        }));

        setCustomerOptions([
          { value: "", label: "All Customers" },
          ...transformedCustomers,
        ]);
      } else {
        setCustomerOptions([{ value: "", label: "All Customers" }]);
      }
    } catch (error) {
      console.error("❌ Error fetching customers:", error);
      setCustomerOptions([{ value: "", label: "All Customers" }]);
    }
  };

  const fetchData = async (page = 1, perPage = limit) => {
    setLoading(true);
    try {
      let paramsToSend = { ...searchParams };
      if (paramsToSend.customerName) {
        const selectedCustomer = customerOptions.find(
          (opt) => opt.value === paramsToSend.customerName
        );
        if (selectedCustomer) {
          paramsToSend.customerName = selectedCustomer.label;
        }
      }

      const cleanParams = Object.fromEntries(
        Object.entries({
          page,
          limit: perPage,
          ...paramsToSend,
        }).filter(
          ([, v]) =>
            v !== "" && v !== null && v !== undefined && v !== "undefined"
        )
      );

      const res = await axios.get(`${Base_URL}/sales-reports`, {
        params: cleanParams,
      });

      if (res.data.success) {
        setRecords(res.data.data || []);
        setCurrentPage(res.data.currentPage || 1);
        setTotalPages(res.data.totalPages || 1);
        setLimit(res.data.limit || 10);
        setTotal(res.data.total || 0);
        setBaseCurrency(res.data.baseCurrency || "USD");
      }
    } catch (err) {
      console.error("❌ API Error:", err);
      toast.error("Failed to fetch sales without purchase reports");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(currentPage, limit);
    fetchCustomerOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, limit]);

  useEffect(() => {
    fetchProductTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.business]);

  useEffect(() => {
    fetchProductTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchData(1, limit);
  };

  const handleReset = () => {
    const resetParams = {
      search: "",
      year: "",
      month: "",
      investor: "",
      business: "",
      customerName: "",
      typeOfProduct: "",
      subSalesContractNo: "",
      startDate: "",
      endDate: "",
      salesStatus: "SALES WITHOUT PURCHASE",
    };

    setSearchParams(resetParams);
    setResetKey((prev) => prev + 1);
    setCurrentPage(1);

    setLoading(true);
    const cleanParams = Object.fromEntries(
      Object.entries({
        page: 1,
        limit,
        ...resetParams,
      }).filter(
        ([, v]) =>
          v !== "" && v !== null && v !== undefined && v !== "undefined"
      )
    );

    axios
      .get(`${Base_URL}/sales-reports`, { params: cleanParams })
      .then((res) => {
        if (res.data.success) {
          setRecords(res.data.data || []);
          setCurrentPage(res.data.currentPage || 1);
          setTotalPages(res.data.totalPages || 1);
          setLimit(res.data.limit || 10);
          setTotal(res.data.total || 0);
        }
      })
      .catch((err) => {
        console.error("❌ API Error:", err);
        toast.error("Failed to fetch sales without purchase reports");
        setRecords([]);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleDownload = async () => {
    setExcelLoading(true);
    try {
      let paramsToSend = { ...searchParams };
      if (paramsToSend.customerName) {
        const selectedCustomer = customerOptions.find(
          (opt) => opt.value === paramsToSend.customerName
        );
        if (selectedCustomer) {
          paramsToSend.customerName = selectedCustomer.label;
        }
      }

      const cleanParams = Object.fromEntries(
        Object.entries(paramsToSend).filter(
          ([, v]) =>
            v !== "" && v !== null && v !== undefined && v !== "undefined"
        )
      );

      const params = new URLSearchParams(cleanParams).toString();
      const url = `${Base_URL}/sales-reports/export/swp-excel?${params}`;

      const response = await axios.get(url, {
        responseType: "blob",
        timeout: 60000,
      });

      const blob = new Blob([response.data]);
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `sales-without-purchase-${Date.now()}.xlsx`;
      link.click();

      toast.success("Sales Without Purchase report exported successfully");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export Sales Without Purchase report");
    } finally {
      setExcelLoading(false);
    }
  };

  const filteredRecords = records.filter((rec) => {
    const q = searchQuery.toLowerCase();
    return (
      (rec.customerName || "").toLowerCase().includes(q) ||
      (rec.subSalesContractNo || "").toLowerCase().includes(q) ||
      (rec.company || "").toLowerCase().includes(q)
    );
  });

  const formatCurrency = (value) => {
    if (!value && value !== 0) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: baseCurrency || "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatCurrencyWithCode = (
    value,
    currencyCode = baseCurrency || "USD"
  ) => {
    if (!value && value !== 0) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(value);
  };

  const getShipmentEstMonth = (rec) => {
    if (rec.year && rec.month) {
      const date = new Date(rec.year, rec.month - 1, 1);
      return date.toLocaleString("en-US", { month: "long", year: "numeric" });
    }
    if (rec.shippingInfo?.initialETD) {
      return formatDate(rec.shippingInfo.initialETD);
    }
    return "-";
  };

  const getPaymentReceived = (rec) => {
    const spi = rec.spi?.receivedAmount || 0;
    const sci = rec.sci?.receivedAmount || 0;
    return spi + sci;
  };

  return (
    <div
      className="p-6 bg-gray-50 min-h-screen"
      style={{ overflowX: "hidden" }}
    >
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Sales Without Purchase Reports
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Detailed list of sales contracts without any linked purchase,
              matching Excel layout.
            </p>
            {baseCurrency && baseCurrency !== "USD" && (
              <p className="text-sm text-gray-600 mt-1">
                Base Currency:{" "}
                <span className="font-semibold">{baseCurrency}</span>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              onClick={handleDownload}
              disabled={excelLoading}
            >
              {excelLoading ? (
                <>
                  <Loader color="white" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" /> Excel
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <div className="relative">
            <InputField
              type="text"
              name="search"
              value={searchParams.search || ""}
              placeholder="Search by name, contract, company..."
              className="pl-10 text-sm"
              onChange={(e) =>
                setSearchParams((prev) => ({ ...prev, search: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
            />
            <Search className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
          </div>

          <DropdownBasic
            placeholder="Year"
            name="year"
            value={searchParams.year || ""}
            onChange={(val) =>
              setSearchParams((prev) => ({ ...prev, year: val }))
            }
            options={yearOptions}
            className="text-sm"
          />

          <DropdownBasic
            placeholder="Month"
            name="month"
            value={searchParams.month || ""}
            onChange={(val) =>
              setSearchParams((prev) => ({ ...prev, month: val }))
            }
            options={monthOptions}
            className="text-sm"
          />

          <DropdownBasic
            placeholder="Investor"
            name="investor"
            value={searchParams.investor || ""}
            onChange={(val) =>
              setSearchParams((prev) => ({ ...prev, investor: val }))
            }
            options={investorOptions}
            className="text-sm"
          />

          {adminId ? (
            <BusinessDropdown
              adminId={adminId}
              selectedBusiness={searchParams.business || ""}
              onChange={(val) => {
                setSearchParams((prev) => ({
                  ...prev,
                  business: val,
                  customerName: "",
                }));
              }}
              placeholder="Business"
              className="text-sm"
            />
          ) : (
            <InputField
              type="text"
              name="business"
              value=""
              placeholder="Business (Loading...)"
              className="text-sm"
              disabled
            />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <DropdownBasic
            placeholder="Customer Name"
            name="customerName"
            value={searchParams.customerName || ""}
            onChange={(val) =>
              setSearchParams((prev) => ({ ...prev, customerName: val }))
            }
            options={customerOptions}
            className="text-sm"
            disabled={customerOptions.length <= 1}
          />

          <DropdownBasic
            placeholder="Product Type"
            name="typeOfProduct"
            value={searchParams.typeOfProduct || ""}
            onChange={(val) =>
              setSearchParams((prev) => ({ ...prev, typeOfProduct: val }))
            }
            options={productTypeOptions}
            className="text-sm"
          />

          <InputField
            type="text"
            name="subSalesContractNo"
            value={searchParams.subSalesContractNo || ""}
            placeholder="Contract No."
            className="text-sm"
            onChange={(e) =>
              setSearchParams((prev) => ({
                ...prev,
                subSalesContractNo: e.target.value,
              }))
            }
          />

          <FormInput
            key={resetKey}
            type="date-range"
            initialStartDate={searchParams.startDate}
            initialEndDate={searchParams.endDate}
            onChange={(value) => {
              setSearchParams((prev) => ({
                ...prev,
                startDate: value.startDate,
                endDate: value.endDate,
              }));
            }}
            marginLeft="-44px"
          />

          <div className="flex gap-2">
            <button
              onClick={handleSearch}
              className="bg-[var(--p-blue)] hover:bg-[#9FBF29] text-white flex items-center justify-center px-6 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Search className="mr-2" size={16} />
              Search
            </button>
            <button
              onClick={handleReset}
              className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg flex items-center justify-center transition-colors"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <style>{`
          .swp-table-wrapper {
            width: 100%;
            max-width: 100vw;
            overflow-x: auto;
            overflow-y: visible;
            -webkit-overflow-scrolling: touch;
            position: relative;
            scrollbar-width: thin;
            scrollbar-color: #cbd5e1 #f1f5f9;
            isolation: isolate;
          }

          .swp-table-wrapper::-webkit-scrollbar {
            height: 8px;
          }

          .swp-table-wrapper::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 4px;
          }

          .swp-table-wrapper::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
          }

          .swp-table-wrapper::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }

          /* Ensure DataTable layout doesn't hide overflow */
          .swp-table-wrapper .data-table-layout {
            width: 100%;
            max-width: 100%;
            overflow: visible;
          }

          /* Override any overflow-x-hidden on nested divs inside DataTable */
          .swp-table-wrapper .data-table-layout > div > div.overflow-x-hidden,
          .swp-table-wrapper .data-table-layout .overflow-x-hidden,
          .swp-table-wrapper .data-table-layout > div.overflow-x-hidden,
          .swp-table-wrapper .overflow-x-hidden {
            overflow-x: auto !important;
            overflow-y: visible !important;
            max-width: 100% !important;
            width: 100% !important;
          }

          /* Generic class selector override */
          .swp-table-wrapper [class*="overflow-x-hidden"] {
            overflow-x: auto !important;
            overflow-y: visible !important;
          }

          /* Make table expand to show all columns */
          .swp-table-wrapper .data-table-layout table,
          .swp-table-wrapper table {
            min-width: max-content !important;
            width: max-content !important;
            table-layout: auto !important;
            display: table !important;
          }

          /* Prevent wrapping */
          .swp-table-wrapper .data-table-layout table td,
          .swp-table-wrapper .data-table-layout table th,
          .swp-table-wrapper table td,
          .swp-table-wrapper table th {
            white-space: nowrap !important;
          }

          .swp-table-wrapper > * {
            max-width: 100%;
          }
        `}</style>
        <div className="swp-table-wrapper">
          <DataTable
            noBackground={true}
            noPadding={true}
            containerClassName="w-full"
            headers={[
              "Status",
              "Sales Contract Date",
              "Type Sales Contract",
              "Type",
              "Customer",
              "Unit Price (USD/MT)",
              "MTS",
              "Value (USD)",
              "Grade",
              "Shipment Estimation Month",
              "Packing",
              "Remarks",
              "Payment Received (USD)",
            ]}
            data={filteredRecords}
            searchValue={searchQuery}
            onSearch={setSearchQuery}
            searchPlaceholder="Search in results..."
            totalPages={totalPages}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            recordsPerPage={limit}
            onRecordsPerPageChange={setLimit}
            loading={loading}
            colWidths={{
              Status: "100px",
              "Sales Contract Date": "130px",
              "Type Sales Contract": "140px",
              Type: "100px",
              Customer: "220px",
              "Unit Price (USD/MT)": "150px",
              MTS: "120px",
              "Value (USD)": "140px",
              Grade: "100px",
              "Shipment Estimation Month": "180px",
              Packing: "160px",
              Remarks: "200px",
              "Payment Received (USD)": "180px",
            }}
            renderRow={(rec) => {
              return (
                <tr
                  key={rec._id}
                  className="border-b hover:bg-gray-50 transition-colors"
                >
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200">
                      SWP
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.contractDate ? formatDate(rec.contractDate) : "-"}
                  </td>
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.investor || "-"}
                  </td>
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.typeOfProduct || "-"}
                  </td>
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.customerName || rec.company || "-"}
                  </td>
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {rec.priceUSDPerMT
                      ? formatCurrency(rec.priceUSDPerMT)
                      : "-"}
                  </td>
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {rec.quantityMTS?.toFixed(2) || "-"}
                  </td>
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    <div className="flex flex-col items-end">
                      <span className="font-medium">
                        {formatCurrency(rec.totalSalesValueUSD)}
                      </span>
                      {rec.currency &&
                        rec.currency !== baseCurrency &&
                        rec.totalSalesValueOriginal && (
                          <span className="text-xs text-gray-500 mt-1">
                            ≈{" "}
                            {formatCurrencyWithCode(
                              rec.totalSalesValueOriginal,
                              rec.currency
                            )}
                          </span>
                        )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.grade || "-"}
                  </td>
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {getShipmentEstMonth(rec)}
                  </td>
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.deliveryTerms || "-"}
                  </td>
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.projectStatus || rec.finalProjectStatus || "-"}
                  </td>
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(getPaymentReceived(rec))}
                  </td>
                </tr>
              );
            }}
          />
        </div>
        <div className="px-6 py-3 bg-gray-50 border-t text-xs text-gray-500 flex items-center justify-between">
          <span className="text-gray-400 text-xs">← Scroll →</span>
          <span className="text-gray-500">
            Total records: <span className="font-semibold">{total}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default SalesWithoutPurchaseReports;
