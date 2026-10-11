import React, { useState, useEffect, useCallback, useContext } from "react";
import { AdminContext } from "@/context/AdminContext";
import {
    Download,
    FileText,
    User,
    Eye,
    RefreshCw,
    FileSpreadsheet,
    Printer,
    Calendar,
    DollarSign,
    TrendingUp,
    Filter,
    Search
} from "lucide-react";
import axios from "axios";
import { useHistory } from "react-router-dom";
import { formatDate, formatAmount, formatCurrencyAmount } from "@/components/formatAmount";
import { notifyError, notifySuccess } from "@/utils/toast";
import { PageHeader, DataTable } from "@/page-layouts/index";
import CustomerInvoiceServices from "@/services/CustomerInvoiceServices";
import { useTranslation } from "react-i18next";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

export default function CustomerStatementGenerator() {
    const { t } = useTranslation();
    const history = useHistory();
    const { state } = useContext(AdminContext);
    const { adminInfo } = state;

    // State management
    const [businesses, setBusinesses] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [statements, setStatements] = useState([]);
    const [allStatements, setAllStatements] = useState([]);
    const [currencies, setCurrencies] = useState([]);

    const [selectedBusiness, setSelectedBusiness] = useState("");
    const [selectedCustomer, setSelectedCustomer] = useState("");
    const [selectedCurrency, setSelectedCurrency] = useState("");
    const [dateFrom, setDateFrom] = useState(null);
    const [dateTo, setDateTo] = useState(null);

    // Table state
    const [loading, setLoading] = useState(false);
    const [filterLoading, setFilterLoading] = useState(false);
    const [totalResults, setTotalResults] = useState(0);
    const [recordsPerPage, setRecordsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState("");

    const toYMD = (d) => {
        if (!d) return null;
        const dateObj = d instanceof Date ? d : new Date(d);
        if (Number.isNaN(dateObj.getTime())) return null;
        return dateObj.toISOString().slice(0, 10);
    };

    // Modal state
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    // Stats state
    const [stats, setStats] = useState({
        totalCustomers: 0,
        totalBalance: 0,
        activeStatements: 0
    });

    // Reset stats when no business is selected
    useEffect(() => {
        if (!selectedBusiness && businesses.length > 0) {
            // Load all business customers when no specific business is selected
            loadAllBusinessCustomers(businesses);
        }
    }, [selectedBusiness, businesses]);

    // Regenerate statements when date range changes in all-business mode
    useEffect(() => {
        if (!selectedBusiness && businesses.length > 0) {
            loadAllBusinessCustomers(businesses);
        }
    }, [dateFrom, dateTo]);

    // 1. Initial Data Fetch
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const storedBusinesses = localStorage.getItem("businesses");
                if (storedBusinesses) {
                    const parsedData = JSON.parse(storedBusinesses);
                    setBusinesses(parsedData);
                    // Load all customers from all businesses by default
                    await loadAllBusinessCustomers(parsedData);
                }
            } catch (error) {
                console.error("Error fetching initial data:", error);
                notifyError(t("accounts.customerInvoices.statements.loadFailed"));
            }
        };
        fetchInitialData();
    }, []);

    // Load customers from all businesses
    const loadAllBusinessCustomers = async (businessList) => {
        try {
            const allCustomersPromises = businessList.map(async (business) => {
                const response = await axios.get(`${Base_URL}/customers`, {
                    params: { businessId: business._id },
                });
                const customers = response?.data?.customers || [];
                return customers.map(customer => ({
                    ...customer,
                    businessId: business._id,
                    businessName: business.name
                }));
            });

            const allCustomersResults = await Promise.all(allCustomersPromises);
            const allCustomersFlat = allCustomersResults.flat();
            setCustomers(allCustomersFlat);
            
            // Generate statements for all customers
            await generateStatementsForCustomers(allCustomersFlat, businessList);
            
        } catch (error) {
            console.error("Error loading all business customers:", error);
            setCustomers([]);
        }
    };

    // 2. Fetch Customers & Currencies when Business Changes
    useEffect(() => {
        if (selectedBusiness) {
            const fetchCustomersForBusiness = async () => {
                try {
                    const response = await axios.get(`${Base_URL}/customers`, {
                        params: { businessId: selectedBusiness },
                    });
                    const customerList = response?.data?.customers || [];
                    setCustomers(customerList);
                } catch (error) {
                    console.error("Error fetching customers for business:", error);
                    setCustomers([]);
                }
            };

            const fetchCurrenciesForBusiness = async () => {
                try {
                    const response = await axios.get(
                        `${Base_URL}/finance/currencies?business_id=${selectedBusiness}`
                    );
                    setCurrencies(response?.data?.data || []);
                    const baseCurrency = response?.data?.data?.find(
                        (currency) => currency.is_base
                    );
                    setSelectedCurrency(baseCurrency?._id || "");
                } catch (error) {
                    console.error("Error fetching currencies for business:", error);
                }
            };

            fetchCustomersForBusiness();
            fetchCurrenciesForBusiness();
        }
    }, [selectedBusiness]);

    // Generate Statements for all customers across all businesses
    const generateStatementsForCustomers = async (customerList, businessList) => {
        setLoading(true);
        try {
            const statementPromises = customerList.map(async (customer) => {
                try {
                    const requestData = {
                        businessId: customer.businessId,
                        customerId: customer._id,
                        dateFrom: toYMD(dateFrom),
                        dateTo: toYMD(dateTo),
                        currencyId: selectedCurrency || null,
                    };

                    const previewResponse = await axios.post(
                        `${Base_URL}/proforma-invoice/customer-statement-preview`,
                        requestData
                    );

                    if (previewResponse.data.success) {
                        return {
                            ...customer,
                            statementData: previewResponse.data.data,
                            generatedAt: new Date(),
                            businessId: customer.businessId,
                            businessName: customer.businessName,
                            currency: previewResponse.data.data.summary.currency
                        };
                    }
                    return null;
                } catch (error) {
                    console.error(`Error generating statement for ${customer.name}:`, error);
                    return {
                        ...customer,
                        statementData: null,
                        generatedAt: new Date(),
                        businessId: customer.businessId,
                        businessName: customer.businessName,
                        error: error.message
                    };
                }
            });

            const results = await Promise.all(statementPromises);
            const validStatements = results.filter(result => result !== null);
            const statementsWithData = validStatements.filter(stmt => stmt.statementData);

            setAllStatements(validStatements);
            filterAndPaginate(validStatements, currentPage, recordsPerPage, searchTerm, selectedCustomer);

            // Calculate stats - total customers includes all, active statements only those with data
            const totalBalance = statementsWithData.reduce((sum, stmt) => 
                sum + (stmt.statementData?.summary?.balanceDue || 0), 0
            );

            setStats({
                totalCustomers: customerList.length, // Total all customers
                totalBalance: totalBalance,
                activeStatements: statementsWithData.length // Only those with statement data
            });

        } catch (error) {
            console.error("Error generating statements:", error);
            notifyError(t("accounts.customerInvoices.statements.generateFailed"));
        } finally {
            setLoading(false);
        }
    };

    // Generate statements for specific business when selected
    const generateStatementsForBusiness = useCallback(async () => {
        if (!selectedBusiness) return;

        setLoading(true);
        try {
            const statementPromises = customers.map(async (customer) => {
                try {
                    const requestData = {
                        businessId: selectedBusiness,
                        customerId: customer._id,
                        dateFrom: toYMD(dateFrom),
                        dateTo: toYMD(dateTo),
                        currencyId: selectedCurrency || null,
                    };

                    const previewResponse = await axios.post(
                        `${Base_URL}/proforma-invoice/customer-statement-preview`,
                        requestData
                    );

                    if (previewResponse.data.success) {
                        return {
                            ...customer,
                            statementData: previewResponse.data.data,
                            generatedAt: new Date(),
                            businessId: selectedBusiness,
                            currency: previewResponse.data.data.summary.currency
                        };
                    }
                    return null;
                } catch (error) {
                    console.error(`Error generating statement for ${customer.name}:`, error);
                    return {
                        ...customer,
                        statementData: null,
                        generatedAt: new Date(),
                        businessId: selectedBusiness,
                        error: error.message
                    };
                }
            });

            const results = await Promise.all(statementPromises);
            const validStatements = results.filter(result => result !== null);
            const statementsWithData = validStatements.filter(stmt => stmt.statementData);

            setAllStatements(validStatements);
            filterAndPaginate(validStatements, currentPage, recordsPerPage, searchTerm, selectedCustomer);

            // Calculate stats - total customers includes all, active statements only those with data
            const totalBalance = statementsWithData.reduce((sum, stmt) => 
                sum + (stmt.statementData?.summary?.balanceDue || 0), 0
            );

            setStats({
                totalCustomers: customers.length, // Total all customers in this business
                totalBalance: totalBalance,
                activeStatements: statementsWithData.length // Only those with statement data
            });

        } catch (error) {
            console.error("Error generating statements:", error);
            notifyError(t("accounts.customerInvoices.statements.generateFailed"));
        } finally {
            setLoading(false);
        }
    }, [selectedBusiness, customers, dateFrom, dateTo, selectedCurrency, currentPage, recordsPerPage, searchTerm]);

    // Trigger statement generation when dependencies change
    useEffect(() => {
        if (selectedBusiness && customers.length > 0) {
            generateStatementsForBusiness();
        }
    }, [selectedBusiness, customers, generateStatementsForBusiness]);

    // Clear search when customer is selected
    useEffect(() => {
        if (selectedCustomer) {
            setSearchTerm("");
        }
    }, [selectedCustomer]);

    // Filter and paginate statements
    const filterAndPaginate = (data, page, limit, search, customerId, showLoading = false) => {
        if (showLoading) {
            setFilterLoading(true);
        }

        const activeCustomerId = customerId ?? selectedCustomer;
        let filteredData = data;

        // Only show customers with statement data
        filteredData = filteredData.filter((item) => item.statementData);

        // Apply search filter only if no customer is selected
        if (search && !activeCustomerId) {
            const lowerSearch = search.toLowerCase();
            filteredData = filteredData.filter(
                (item) =>
                    (item.basicInformation?.customerDisplayName || item.name || "")
                        .toLowerCase()
                        .includes(lowerSearch) ||
                    (item.basicInformation?.customerEmail || "")
                        .toLowerCase()
                        .includes(lowerSearch)
            );
        }

        // Apply customer filter (this takes priority over search)
        if (activeCustomerId) {
            filteredData = filteredData.filter((item) => item._id === activeCustomerId);
        }

        setTotalResults(filteredData.length);

        // Client-side pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedData = filteredData.slice(startIndex, endIndex);

        setStatements(paginatedData);

        if (showLoading) {
            setTimeout(() => setFilterLoading(false), 300);
        }
    };

    // Handle page change
    const handlePageChange = (page) => {
        setCurrentPage(page);
        filterAndPaginate(allStatements, page, recordsPerPage, searchTerm, selectedCustomer);
    };

    // Handle search
    const handleSearch = (e) => {
        const value = e.target.value;
        setSearchTerm(value);
        setSelectedCustomer("");
        setCurrentPage(1);
        filterAndPaginate(allStatements, 1, recordsPerPage, value, "", true);
    };

    // Handle business change
    const onChange = async (value) => {
        const nextBusinessId =
            typeof value === "string" ? value : value?.target?.value ?? value?.value ?? "";

        setSelectedBusiness(nextBusinessId);
        setSelectedCustomer("");
        setSearchTerm("");
        setCurrentPage(1);

        // Prevent double generation: clear old customers so generation won't run
        // against stale (previous-business/all-business) customer list.
        setCustomers([]);

        if (!nextBusinessId) {
            loadAllBusinessCustomers(businesses);
        }
    };

    // Preview statement
    const handlePreviewStatement = async (customer) => {
        setPreviewLoading(true);
        setPreviewModalOpen(true);
        setPreviewData(null);
        setPreviewUrl(null);

        try {
            const requestData = {
                businessId: customer.businessId || selectedBusiness,
                customerId: customer._id,
                dateFrom: toYMD(dateFrom),
                dateTo: toYMD(dateTo),
                currencyId: selectedCurrency || null,
            };

            // Get preview data
            const previewResponse = await axios.post(
                `${Base_URL}/proforma-invoice/customer-statement-preview`,
                requestData
            );

            // Get PDF
            const pdfResponse = await axios.post(
                `${Base_URL}/proforma-invoice/customer-statement`,
                requestData,
                { responseType: "blob" }
            );

            if (previewResponse.data.success) {
                setPreviewData(previewResponse.data.data);
            }

            const blob = new Blob([pdfResponse.data], { type: "application/pdf" });
            const url = window.URL.createObjectURL(blob);
            setPreviewUrl(url);

        } catch (error) {
            console.error("Error previewing statement:", error);
            notifyError(t("accounts.customerInvoices.statements.previewFailed"));
        } finally {
            setPreviewLoading(false);
        }
    };

    // Download PDF for single customer
    const handleDownloadPDF = async (customer) => {
        try {
            const requestData = {
                businessId: customer.businessId || selectedBusiness,
                customerId: customer._id,
                dateFrom: dateFrom || null,
                dateTo: dateTo || null,
                currencyId: selectedCurrency || null,
            };

            const response = await axios.post(
                `${Base_URL}/proforma-invoice/customer-statement`,
                requestData,
                { responseType: "blob" }
            );

            const blob = new Blob([response.data], { type: "application/pdf" });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            const customerName = customer.basicInformation?.customerDisplayName || customer.name || "statement";
            link.setAttribute("download", `Statement-${customerName}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            notifySuccess(t("accounts.customerInvoices.statements.pdfDownloaded"));
        } catch (error) {
            notifyError(t("accounts.customerInvoices.statements.pdfDownloadFailed"));
        }
    };

    // Download CSV for single customer
    const handleDownloadCSV = async (customer) => {
        try {
            const requestData = {
                businessId: customer.businessId || selectedBusiness,
                customerId: customer._id,
                dateFrom: dateFrom || null,
                dateTo: dateTo || null,
                currencyId: selectedCurrency || null,
            };

            const response = await axios.post(
                `${Base_URL}/proforma-invoice/customer-statement-csv`,
                requestData,
                { responseType: "blob" }
            );

            const blob = new Blob([response.data], { type: "text/csv" });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            const customerName = customer.basicInformation?.customerDisplayName || customer.name || "statement";
            link.setAttribute("download", `Statement-${customerName}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            notifySuccess(t("accounts.customerInvoices.statements.csvDownloaded"));
        } catch (error) {
            notifyError(t("accounts.customerInvoices.statements.csvDownloadFailed"));
        }
    };

    // Refresh statements
    const handleRefreshStatements = async () => {
        if (selectedBusiness) {
            await generateStatementsForBusiness();
        } else {
            await loadAllBusinessCustomers(businesses);
        }
    };

    // Download all statements as PDF (zip)
    const handleDownloadAllPDF = async () => {
        setLoading(true);
        try {
            // This would need to be implemented on backend
            notifyError(t("accounts.customerInvoices.statements.bulkPdfUnavailable"));
        } catch (error) {
            notifyError(t("accounts.customerInvoices.statements.allPdfDownloadFailed"));
        } finally {
            setLoading(false);
        }
    };

    // Download all statements as CSV
    const handleDownloadAllCSV = async () => {
        setLoading(true);
        try {
            // This would need to be implemented on the backend
            notifyError(t("accounts.customerInvoices.statements.bulkCsvUnavailable"));
        } catch (error) {
            notifyError(t("accounts.customerInvoices.statements.allCsvDownloadFailed"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6">
            <PageHeader
                title={t("accounts.customerInvoices.statements.title")}
                showAddButton={false}
            />

            {/* Premium Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 mt-6">
                {/* Total Customers Card */}
                <div className="relative overflow-hidden bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group">
                    <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-blue-50 to-transparent opacity-50"></div>
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">{t("accounts.customerInvoices.statements.totalCustomers")}</p>
                            <h3 className="text-3xl font-bold text-gray-800 tracking-tight">{stats.totalCustomers}</h3>
                            <p className="text-xs text-blue-500 font-medium mt-2 flex items-center bg-blue-50 w-fit px-2 py-1 rounded-full">
                                <User size={12} className="mr-1" /> {t("accounts.customerInvoices.statements.activeAccounts")}
                            </p>
                        </div>
                        <div className="p-4 bg-blue-100 text-blue-600 rounded-2xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                            <User size={32} strokeWidth={1.5} />
                        </div>
                    </div>
                    <User className="absolute -bottom-4 -right-4 text-blue-50 w-32 h-32 -rotate-12 transition-transform duration-500 group-hover:rotate-0" strokeWidth={0.5} />
                </div>

                {/* Customers With Due Card */}
                <div className="relative overflow-hidden bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group">
                    <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-orange-50 to-transparent opacity-50"></div>
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">{t("accounts.customerInvoices.statements.customersWithDue")}</p>
                            <h3 className="text-3xl font-bold text-gray-800 tracking-tight">
                                {allStatements.filter(stmt => stmt.statementData && stmt.statementData.summary.balanceDue > 0).length}
                            </h3>
                            <p className="text-xs text-orange-500 font-medium mt-2 flex items-center bg-orange-50 w-fit px-2 py-1 rounded-full">
                                <DollarSign size={12} className="mr-1" /> {t("accounts.customerInvoices.statements.outstandingBalance")}
                            </p>
                        </div>
                        <div className="p-4 bg-orange-100 text-orange-600 rounded-2xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                            <DollarSign size={32} strokeWidth={1.5} />
                        </div>
                    </div>
                    <DollarSign className="absolute -bottom-4 -right-4 text-orange-50 w-32 h-32 -rotate-12 transition-transform duration-500 group-hover:rotate-0" strokeWidth={0.5} />
                </div>

                {/* Active Statements Card */}
                <div className="relative overflow-hidden bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group">
                    <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-green-50 to-transparent opacity-50"></div>
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">{t("accounts.customerInvoices.statements.activeStatements")}</p>
                            <h3 className="text-3xl font-bold text-gray-800 tracking-tight">{stats.activeStatements}</h3>
                            <p className="text-xs text-green-500 font-medium mt-2 flex items-center bg-green-50 w-fit px-2 py-1 rounded-full">
                                <TrendingUp size={12} className="mr-1" /> {t("accounts.customerInvoices.statements.withActivity")}
                            </p>
                        </div>
                        <div className="p-4 bg-green-100 text-green-600 rounded-2xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                            <FileText size={32} strokeWidth={1.5} />
                        </div>
                    </div>
                    <FileText className="absolute -bottom-4 -right-4 text-green-50 w-32 h-32 -rotate-12 transition-transform duration-500 group-hover:rotate-0" strokeWidth={0.5} />
                </div>
            </div>

            {/* Action Buttons */}
            {/* <div className="flex flex-wrap gap-3 mb-6">
                <button
                    onClick={handleDownloadAllPDF}
                    disabled={loading || statements.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-black text-white text-sm font-medium rounded-lg shadow hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Download size={16} /> Download All PDFs
                </button>
                <button
                    onClick={handleDownloadAllCSV}
                    disabled={loading || statements.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg shadow hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <FileSpreadsheet size={16} /> Download All CSVs
                </button>
                <button
                    onClick={handleRefreshStatements}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> 
                    {loading ? "Generating..." : "Refresh Statements"}
                </button>
            </div> */}

            {/* Data Table */}
            <div className="bg-gray-50 rounded-lg">
                <DataTable
                    headers={[
                        t("accounts.customerInvoices.statements.customerName"),
                        t("accounts.customerInvoices.statements.statementDate"),
                        t("accounts.customerInvoices.statements.totalInvoiced"),
                        t("accounts.customerInvoices.statements.totalPaid"),
                        t("accounts.customerInvoices.statements.balanceDue"),
                        t("common.status"),
                        t("common.actions"),
                    ]}
                    data={statements}
                    loading={loading || filterLoading}
                    currentPage={currentPage}
                    totalPages={Math.ceil(totalResults / recordsPerPage)}
                    recordsPerPage={recordsPerPage}
                    onPageChange={handlePageChange}
                    onRecordsPerPageChange={(value) => {
                        setRecordsPerPage(value);
                        setCurrentPage(1);
                        filterAndPaginate(allStatements, 1, value, searchTerm, selectedCustomer);
                    }}
                    renderRow={(customer) => (
                        <tr className="border-b border-gray-200" key={customer._id}>
                            <td className="py-4">
                                <div>
                                    <div className="font-medium text-gray-900">
                                        {customer.basicInformation?.customerDisplayName || customer.name}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {customer.basicInformation?.customerEmail || t("accounts.customerInvoices.statements.noEmail")}
                                    </div>
                                    {customer.businessName && (
                                        <div className="text-xs text-blue-600 font-medium">
                                            {customer.businessName}
                                        </div>
                                    )}
                                </div>
                            </td>
                            <td className="py-4">
                                {customer.statementData ? 
                                    formatDate(customer.generatedAt) : 
                                    <span className="text-gray-400">{t("accounts.customerInvoices.statements.noData")}</span>
                                }
                            </td>
                            <td className="py-4">
                                {customer.statementData ? 
                                    formatCurrencyAmount(
                                      customer.statementData.summary.currency,
                                      customer.statementData.summary.totalInvoiced,
                                    ) : 
                                    <span className="text-gray-400">-</span>
                                }
                            </td>
                            <td className="py-4">
                                {customer.statementData ? 
                                    formatCurrencyAmount(
                                      customer.statementData.summary.currency,
                                      customer.statementData.summary.totalPaid,
                                    ) : 
                                    <span className="text-gray-400">-</span>
                                }
                            </td>
                            <td className="py-4">
                                {customer.statementData ? 
                                    <div className="font-medium text-blue-600">
                                        {formatCurrencyAmount(
                                          customer.statementData.summary.currency,
                                          customer.statementData.summary.balanceDue,
                                        )}
                                    </div> : 
                                    <span className="text-gray-400">-</span>
                                }
                            </td>
                            <td className="py-4">
                                {customer.statementData ? (
                                    <span className="px-2 py-1 text-xs font-semibold leading-tight rounded-full bg-green-100 text-green-700">
                                        {t("common.active")}
                                    </span>
                                ) : (
                                    <span className="px-2 py-1 text-xs font-semibold leading-tight rounded-full bg-gray-100 text-gray-700">
                                        {t("accounts.customerInvoices.statements.noData")}
                                    </span>
                                )}
                            </td>
                            <td className="py-4">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handlePreviewStatement(customer)}
                                        disabled={!customer.statementData}
                                        className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        title={t("accounts.customerInvoices.statements.previewStatement")}
                                    >
                                        <Eye size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDownloadPDF(customer)}
                                        disabled={!customer.statementData}
                                        className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        title={t("accounts.customerInvoices.statements.downloadPdf")}
                                    >
                                        <Download size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDownloadCSV(customer)}
                                        disabled={!customer.statementData}
                                        className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        title={t("accounts.customerInvoices.statements.downloadCsv")}
                                    >
                                        <FileSpreadsheet size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    )}
                    emptyMessage={customers.length === 0 ? t("accounts.customerInvoices.statements.loading") : t("accounts.customerInvoices.statements.noneFound")}
                    filters={[
                        {
                            isBusinessDropdown: true,
                            businessDropdownProps: {
                                adminId: adminInfo?.id,
                                selectedBusiness: selectedBusiness,
                                onChange: onChange,
                                placeholder: t("accounts.customerInvoices.statements.selectBusiness"),
                            },
                        },

                        {
                            isDatePicker: true,
                            value: dateFrom,
                            onChange: (val) => {
                                setDateFrom(val);
                                setCurrentPage(1);
                            },
                            placeholder: t("accounts.customerInvoices.statements.dateFrom"),
                        },
                        {
                            isDatePicker: true,
                            value: dateTo,
                            onChange: (val) => {
                                setDateTo(val);
                                setCurrentPage(1);
                            },
                            placeholder: t("accounts.customerInvoices.statements.dateTo"),
                        },
                           {
                            type: "select",
                            placeholder: t("accounts.customerInvoices.allCustomers"),
                            value: selectedCustomer,
                            onChange: (value) => {
                                const nextCustomerId =
                                    typeof value === "string"
                                        ? value
                                        : value?.target?.value ?? value?.value ?? "";

                                setSelectedCustomer(nextCustomerId);
                                setCurrentPage(1);

                                // If a customer is selected, clear search to avoid conflicts.
                                // If cleared (""), keep current searchTerm.
                                const nextSearch = nextCustomerId ? "" : searchTerm;
                                if (nextCustomerId) {
                                    setSearchTerm("");
                                }

                                // Only filter existing data, don't regenerate
                                filterAndPaginate(
                                    allStatements,
                                    1,
                                    recordsPerPage,
                                    nextSearch,
                                    nextCustomerId,
                                    true
                                );
                            },
                            options: [
                                { value: "", label: t("accounts.customerInvoices.allCustomers") },
                                ...customers.map(c => ({
                                    value: c._id,
                                    label: c.basicInformation?.customerDisplayName || c.name || t("accounts.customerInvoices.statements.unknownCustomer")
                                }))
                            ]
                        },
                    ]}
                    searchValue={searchTerm}
                    onSearch={handleSearch}
                    searchPlaceholder={t("accounts.customerInvoices.statements.searchCustomer")}
                />
            </div>

            {/* Preview Modal */}
            {previewModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                            <h3 className="text-lg font-semibold text-gray-900">
                                {t("accounts.customerInvoices.statements.previewTitle", {
                                    customer: previewData?.customer?.name || t("accounts.customerInvoices.customer"),
                                })}
                            </h3>
                            <div className="flex items-center gap-3">
                                {previewUrl && (
                                    <>
                                        <button
                                            onClick={() => window.open(previewUrl, '_blank')}
                                            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                            <Printer size={16} /> {t("common.print")}
                                        </button>
                                        <button
                                            onClick={() => {
                                                const link = document.createElement("a");
                                                link.href = previewUrl;
                                                link.setAttribute("download", `Statement-${previewData?.customer?.name || 'statement'}.pdf`);
                                                document.body.appendChild(link);
                                                link.click();
                                                link.remove();
                                            }}
                                            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                                        >
                                            <Download size={16} /> {t("common.download")}
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={() => {
                                        setPreviewModalOpen(false);
                                        setPreviewData(null);
                                        setPreviewUrl(null);
                                    }}
                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                    aria-label={t("common.close")}
                                >
                                    ×
                                </button>
                            </div>
                        </div>

                        {/* Modal Content - Scrollable */}
                        <div className="flex-1 overflow-y-auto">
                            {previewLoading ? (
                                <div className="min-h-full flex items-center justify-center py-20">
                                    <div className="text-center">
                                        <RefreshCw size={32} className="animate-spin text-blue-600 mx-auto mb-4" />
                                        <p className="text-gray-500">{t("accounts.customerInvoices.statements.loadingPreview")}</p>
                                    </div>
                                </div>
                            ) : previewData && previewUrl ? (
                                <div className="space-y-0">
                                    {/* Statement Summary - Horizontal */}
                                    <div className="p-6 border-b border-gray-200">
                                        <h4 className="font-semibold text-gray-900 mb-4">{t("accounts.customerInvoices.statements.summary")}</h4>
                                        
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="bg-gray-50 p-4 rounded-lg">
                                                <div className="text-sm text-gray-500">{t("accounts.customerInvoices.statements.totalInvoiced")}</div>
                                                <div className="text-xl font-bold text-gray-900">
                                                    {formatCurrencyAmount(
                                                      previewData.summary.currency,
                                                      previewData.summary.totalInvoiced,
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className="bg-green-50 p-4 rounded-lg">
                                                <div className="text-sm text-green-600">{t("accounts.customerInvoices.statements.totalPaid")}</div>
                                                <div className="text-xl font-bold text-green-700">
                                                    {formatCurrencyAmount(
                                                      previewData.summary.currency,
                                                      previewData.summary.totalPaid,
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className="bg-blue-50 p-4 rounded-lg">
                                                <div className="text-sm text-blue-600">{t("accounts.customerInvoices.statements.balanceDue")}</div>
                                                <div className="text-xl font-bold text-blue-700">
                                                    {formatCurrencyAmount(
                                                      previewData.summary.currency,
                                                      previewData.summary.balanceDue,
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Transactions Table */}
                                    <div className="p-6 border-b border-gray-200">
                                        <h5 className="font-medium text-gray-900 mb-3">{t("accounts.customerInvoices.statements.transactionHistory")}</h5>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                    <tr>
                                                        <th className="px-4 py-3">{t("common.date")}</th>
                                                        <th className="px-4 py-3">{t("common.type")}</th>
                                                        <th className="px-4 py-3">{t("common.details")}</th>
                                                        <th className="px-4 py-3 text-right">{t("accounts.customerInvoices.statements.debit")}</th>
                                                        <th className="px-4 py-3 text-right">{t("accounts.customerInvoices.statements.credit")}</th>
                                                        <th className="px-4 py-3 text-right">{t("accounts.customerInvoices.statements.balance")}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 text-sm">
                                                    {previewData.transactions.map((transaction, index) => (
                                                        <tr key={index} className="hover:bg-blue-50/30 transition-colors">
                                                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                                                {formatDate(transaction.date)}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="font-medium text-gray-900">{transaction.type}</div>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="text-gray-600 truncate max-w-xs" title={transaction.details}>
                                                                    {transaction.details}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-gray-900 text-right font-medium">
                                                                {transaction.amount > 0 ? formatAmount(transaction.amount) : '-'}
                                                            </td>
                                                            <td className="px-4 py-3 text-green-600 text-right font-medium">
                                                                {transaction.payments > 0 ? formatAmount(transaction.payments) : '-'}
                                                            </td>
                                                            <td className="px-4 py-3 text-blue-700 text-right font-bold bg-gray-50/50">
                                                                {formatAmount(transaction.balance)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* PDF Preview */}
                                    <div className="p-6 bg-gray-100">
                                        <h5 className="font-medium text-gray-900 mb-3">{t("accounts.customerInvoices.statements.documentPreview")}</h5>
                                        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                                            <iframe 
                                                src={`${previewUrl}#toolbar=0&navpanes=0`} 
                                                className="w-full h-[600px]" 
                                                title={t("accounts.customerInvoices.statements.previewStatement")}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="min-h-full flex items-center justify-center py-20">
                                    <div className="text-center text-gray-500">
                                        <FileText size={48} className="mx-auto mb-4 opacity-20" />
                                        <p>{t("accounts.customerInvoices.statements.noPreview")}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
