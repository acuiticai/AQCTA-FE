import { useState, useEffect, useContext } from "react";
import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { useLocation } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import ToggleSwitch from "@/components/toggle/ToggleSwitch";
import Select from "react-select";
import { countries } from "countries-list";
import { CustomModal, DataTable, ActionButtons } from "@/page-layouts";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import { notifySuccess, notifyError } from "@/utils/toast";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

/** ISO currency code → display symbol saved in settings (MYR → RM). */
const toCurrencyDisplaySymbol = (isoCode) => {
  const code = String(isoCode || "").trim().toUpperCase();
  if (!code) return "";
  if (code === "MYR") return "RM";
  return code;
};

const formatRate = (rate, decimals = 4) => {
  if (rate == null) return "";
  const rounded = parseFloat(rate.toFixed(decimals));
  return rounded
    .toString()
    .replace(/(\.\d*?[1-9])0+$/, "$1")
    .replace(/\.$/, "");
};

const CurrencyModal = ({
  isOpen,
  onClose,
  item,
  onSubmit,
  businessId,
  isFirstCurrency,
  canSubmit,
}) => {
  const { t } = useTranslation();
  const tc = (key, fallback, options) =>
    t(`settingsPage.finance.currency.${key}`, {
      defaultValue: fallback,
      ...options,
    });

  const [formData, setFormData] = useState({
    business_id: businessId || "",
    name: "",
    symbol: "",
    prefix: "",
    suffix: "",
    conversion_rate_to_base: "",
    is_base: false,
  });

  const [selectedCurrency, setSelectedCurrency] = useState(null);
  const [errors, setErrors] = useState({
    currency: "",
    rate: "",
  });
  const [touched, setTouched] = useState({
    currency: false,
    rate: false,
  });

  const currencyOptions = Object.entries(countries)
    .filter(([, country]) => country.currency)
    .map(([code, country]) => {
      const symbol = Array.isArray(country.currency)
        ? country.currency[0]
        : country.currency;
      return {
        value: symbol,
        label: `${country.name} (${symbol})`,
        prefix: code,
      };
    });

  useEffect(() => {
    if (!isOpen) return;
    if (item) {
      const matchedCountry = Object.entries(countries).find(
        ([code, country]) => {
          const curr = Array.isArray(country.currency)
            ? country.currency[0]
            : country.currency;
          const itemSymbol = String(item.symbol || "").toUpperCase();
          return (
            curr === item.symbol ||
            toCurrencyDisplaySymbol(curr) === itemSymbol ||
            code === item.prefix
          );
        },
      );

      const matchedOption = matchedCountry
        ? currencyOptions.find(
            (opt) =>
              opt.value ===
              (Array.isArray(matchedCountry[1].currency)
                ? matchedCountry[1].currency[0]
                : matchedCountry[1].currency),
          ) || null
        : null;

      setFormData({
        ...item,
        business_id: businessId,
      });

      setSelectedCurrency(matchedOption);
    } else {
      setFormData({
        business_id: businessId || "",
        name: "",
        symbol: "",
        prefix: "",
        suffix: "",
        conversion_rate_to_base: isFirstCurrency ? 1 : "",
        is_base: isFirstCurrency ? true : false,
      });

      setSelectedCurrency(null);
    }
  }, [isOpen, item, businessId, isFirstCurrency]);

  const validate = (field) => {
    setErrors((prev) => {
      const next = { ...prev };

      if (!field || field === "currency") {
        next.currency = !selectedCurrency
          ? tc("currencyRequired", "Currency is required")
          : "";
      }

      if (!field || field === "rate") {
        const hasValue =
          formData.conversion_rate_to_base !== "" &&
          formData.conversion_rate_to_base !== null;
        next.rate =
          !isFirstCurrency && !hasValue
            ? tc("rateRequired", "Conversion rate is required")
            : "";
      }

      return next;
    });
  };

  const handleCurrencySelect = (selectedOption) => {
    setSelectedCurrency(selectedOption);
    const isoCode =
      typeof selectedOption.value === "string"
        ? selectedOption.value
        : Array.isArray(selectedOption.value)
          ? selectedOption.value[0] || ""
          : "";
    const symbol = toCurrencyDisplaySymbol(isoCode);
    setFormData((prev) => ({
      ...prev,
      name: selectedOption.label,
      symbol,
      prefix: selectedOption.prefix || "",
      suffix: selectedOption.suffix || "",
    }));

    if (touched.currency) {
      validate("currency");
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (name === "conversion_rate_to_base" && touched.rate) {
      validate("rate");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched({ currency: true, rate: true });

    const currencyError = !selectedCurrency
      ? tc("currencyRequired", "Currency is required")
      : "";
    const rateMissing =
      !isFirstCurrency &&
      (formData.conversion_rate_to_base === "" ||
        formData.conversion_rate_to_base === null);
    const rateError = rateMissing
      ? tc("rateRequired", "Conversion rate is required")
      : "";

    setErrors({
      currency: currencyError,
      rate: rateError,
    });

    if (currencyError || rateError) {
      return;
    }

    onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg overflow-visible relative z-[60]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {item
              ? tc("editCurrency", "Edit Currency")
              : tc("addCurrency", "Add Currency")}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="block mb-1">
              {tc("selectCurrency", "Select Currency")}
              <span className="text-red-500">*</span>
            </span>
            <Select
              options={currencyOptions}
              getOptionValue={(opt) => opt.value}
              onChange={handleCurrencySelect}
              isDisabled={false}
              value={
                selectedCurrency
                  ? currencyOptions.find(
                      (opt) => opt.value === selectedCurrency.value,
                    ) || selectedCurrency
                  : null
              }
              className="mt-1"
              menuPortalTarget={document.body}
              menuPosition="fixed"
              menuPlacement="auto"
              styles={{
                menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                control: (base) => ({
                  ...base,
                  borderColor:
                    (!item &&
                      (touched.currency || errors.currency) &&
                      errors.currency) ||
                    base.borderColor,
                  "&:hover": {
                    borderColor:
                      (!item &&
                        (touched.currency || errors.currency) &&
                        errors.currency) ||
                      base.borderColor,
                  },
                  boxShadow: "none",
                }),
              }}
            />
            {errors.currency && touched.currency && (
              <p className="mt-1 text-sm text-red-500">{errors.currency}</p>
            )}
          </label>

          <label className="block">
            <span className="block mb-1">
              {tc("conversionRate", "Conversion Rate")}
              <span className="text-red-500">*</span>
            </span>
            <input
              type="number"
              name="conversion_rate_to_base"
              value={formData.conversion_rate_to_base}
              onChange={handleChange}
              onBlur={() =>
                setTouched((prev) => {
                  const next = { ...prev, rate: true };
                  validate("rate");
                  return next;
                })
              }
              className={`w-full p-2 border rounded ${
                !isFirstCurrency && errors.rate && touched.rate
                  ? "border-red-500"
                  : "border-gray-300"
              }`}
              required
              disabled={isFirstCurrency}
            />
            {!isFirstCurrency && errors.rate && touched.rate && (
              <p className="mt-1 text-sm text-red-500">{errors.rate}</p>
            )}
          </label>
          {isFirstCurrency && (
            <p className="text-sm text-green-600 mt-1">
              {tc("baseCurrencyHint", "This will be your base currency.")}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer disabled:opacity-50"
          >
            {item ? tc("update", "Update") : tc("save", "Save")}
          </button>
        </form>
      </div>
    </div>
  );
};

const CurrencyManagement = () => {
  const { t } = useTranslation();
  const tc = (key, fallback, options) =>
    t(`settingsPage.finance.currency.${key}`, {
      defaultValue: fallback,
      ...options,
    });

  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const location = useLocation();
  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();
  const [currencies, setCurrencies] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState(null);
  const [businessId, setBusinessId] = useState(null);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(() => {
    try {
      const c = localStorage.getItem("configurations");
      if (c) {
        const parsed = JSON.parse(c);
        const p = parsed && parsed.table_entries_per_page;
        if (Number.isFinite(p) && p > 0) return Number(p);
      }
    } catch (_) {}
    return 10;
  });

  const handleSearch = (searchValue) => {
    setSearchTerm(searchValue ? searchValue.trim() : "");
    setCurrentPage(1);
  };

  const filteredCurrencies = currencies.filter((currency) => {
    const nameMatch = currency.name
      ? currency.name.toLowerCase().includes(searchTerm.toLowerCase())
      : false;
    const symbolMatch = currency.symbol
      ? currency.symbol.toLowerCase().includes(searchTerm.toLowerCase())
      : false;
    const prefixMatch = currency.prefix
      ? currency.prefix.toLowerCase().includes(searchTerm.toLowerCase())
      : false;
    const suffixMatch = currency.suffix
      ? currency.suffix.toLowerCase().includes(searchTerm.toLowerCase())
      : false;
    return nameMatch || symbolMatch || prefixMatch || suffixMatch;
  });

  const paginatedCurrencies = filteredCurrencies.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage,
  );

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const selectedOrg = searchParams.get("selectedOrg");

    if (selectedOrg) {
      setBusinessId(selectedOrg);
      fetchCurrencies(selectedOrg);
    }
  }, [location]);

  const fetchCurrencies = async (business_id) => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${BASE_URL}/finance/currencies?business_id=${business_id}`,
        { headers },
      );
      setCurrencies(response.data.data || []);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching currencies:", error);
      setLoading(false);
    }
  };

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [currencyToDelete, setCurrencyToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleSubmit = async (formData) => {
    if ((editingCurrency && !canUpdate) || (!editingCurrency && !canAdd))
      return;
    try {
      formData.business_id = businessId;
      const symbolNorm = (formData.symbol || "").toString().trim().toUpperCase();

      const isDuplicate = currencies.some((c) => {
        const existingNorm = (c.symbol || "").toString().trim().toUpperCase();
        if (existingNorm !== symbolNorm) return false;
        if (editingCurrency) return c._id !== editingCurrency._id;
        return true;
      });
      if (isDuplicate) {
        notifyError(
          tc(
            "duplicateError",
            "This currency is already added for this business. Please use a different currency or edit the existing one.",
          ),
        );
        return;
      }

      if (editingCurrency) {
        await axios.put(
          `${BASE_URL}/finance/currencies/${editingCurrency._id}`,
          formData,
          { headers },
        );
        notifySuccess(tc("updatedSuccess", "Currency updated successfully"));
      } else {
        await axios.post(`${BASE_URL}/finance/currencies`, formData, {
          headers,
        });
        notifySuccess(tc("createdSuccess", "Currency created successfully"));
      }
      setModalOpen(false);
      setEditingCurrency(null);
      fetchCurrencies(businessId);
    } catch (error) {
      console.error("Error saving currency:", error);
      notifyError(
        error?.response?.data?.error ||
          tc("saveFailed", "Failed to save currency. Please try again."),
      );
    }
  };

  const handleEdit = (item) => {
    if (!canUpdate) return;
    setEditingCurrency(item);
    setModalOpen(true);
  };

  const handleDeleteClick = (item) => {
    if (!canDelete) return;
    setCurrencyToDelete(item);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!currencyToDelete || !canDelete) return;
    try {
      setDeleteLoading(true);
      await axios.delete(
        `${BASE_URL}/finance/currencies/${currencyToDelete._id}`,
        { headers },
      );
      notifySuccess(tc("deletedSuccess", "Currency deleted successfully"));
      setDeleteModalOpen(false);
      setCurrencyToDelete(null);
      fetchCurrencies(businessId);
    } catch (error) {
      console.error("Error deleting currency:", error);
      notifyError(
        error?.response?.data?.error ||
          tc("deleteFailed", "Failed to delete currency. Please try again."),
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleToggleBase = async (item) => {
    if (!canUpdate) return;
    try {
      if (!item.is_base) {
        await axios.put(
          `${BASE_URL}/finance/currencies/${item._id}`,
          { ...item, is_base: true },
          { headers },
        );
        fetchCurrencies(businessId);
      }
    } catch (error) {
      console.error("Error setting base currency:", error);
    }
  };

  return (
    <div className="p-6 bg-white shadow rounded-lg">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-xl font-semibold text-gray-900">
          {tc("title", "Currency")}
        </h1>
        {canAdd && (
          <button
            onClick={() => {
              setEditingCurrency(null);
              setModalOpen(true);
            }}
            className="flex items-center px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            {tc("addNew", "Add New")}
          </button>
        )}
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-w-0 max-w-full overflow-hidden">
        <DataTable
          loading={loading}
          searchValue={searchTerm}
          onSearch={handleSearch}
          searchPlaceholder={tc("searchPlaceholder", "Search currencies...")}
          totalRecords={filteredCurrencies.length}
          recordsPerPage={recordsPerPage}
          onRecordsPerPageChange={(perPage) => {
            setRecordsPerPage(perPage);
            setCurrentPage(1);
          }}
          totalPages={Math.ceil(filteredCurrencies.length / recordsPerPage)}
          currentPage={currentPage}
          onPageChange={(page) => setCurrentPage(page)}
          headers={[
            tc("currencyName", "Currency Name"),
            tc("symbol", "Symbol"),
            tc("prefixSuffix", "Prefix / Suffix"),
            tc("conversionRateHeader", "Conversion Rate"),
            tc("baseCurrency", "Base Currency"),
            tc("actions", "Actions"),
          ]}
          data={paginatedCurrencies}
          renderRow={(item) => (
            <tr key={item?._id} className="border-b hover:bg-gray-50">
              <td className="px-6 py-4 text-sm font-medium text-gray-900">
                {item?.name}
              </td>
              <td className="px-6 py-4 text-sm text-gray-700">{item?.symbol}</td>
              <td className="px-6 py-4 text-sm text-gray-700">
                {item?.prefix} / {item?.suffix}
              </td>
              <td className="px-6 py-4 text-sm text-gray-700">
                {item?.conversion_rate_to_base
                  ? formatRate(item.conversion_rate_to_base)
                  : ""}
              </td>
              <td className="px-6 py-4 text-sm text-gray-700">
                <ToggleSwitch
                  isOn={item?.is_base}
                  handleToggle={() => handleToggleBase(item)}
                  disabled={!canUpdate}
                />
              </td>
              <td className="px-6 py-4 text-sm text-gray-500 font-medium">
                <div className="flex space-x-2 items-center">
                  <ActionButtons
                    rbac={{
                      canUpdate,
                      canDelete,
                    }}
                    items={[
                      {
                        tooltip: tc("edit", "Edit"),
                        action: ACTION_BUTTON_TYPES.EDIT,
                        onClick: () => handleEdit(item),
                        disabled: item?.is_base,
                      },
                      {
                        tooltip: tc("delete", "Delete"),
                        action: ACTION_BUTTON_TYPES.DELETE,
                        onClick: () => handleDeleteClick(item),
                        disabled: item?.is_base,
                      },
                    ]}
                  />
                </div>
              </td>
            </tr>
          )}
        />
      </div>

      <CurrencyModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingCurrency(null);
        }}
        item={editingCurrency}
        onSubmit={handleSubmit}
        businessId={businessId}
        isFirstCurrency={currencies.length === 0}
        canSubmit={editingCurrency ? canUpdate : canAdd}
      />

      <CustomModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setCurrencyToDelete(null);
        }}
        title={tc("deleteTitle", "Delete Currency")}
        width="500px"
        showActions={true}
        actions={[
          {
            label: tc("cancel", "Cancel"),
            secondary: true,
            onClick: () => {
              setDeleteModalOpen(false);
              setCurrencyToDelete(null);
            },
          },
          {
            label: deleteLoading
              ? tc("deleting", "Deleting...")
              : tc("delete", "Delete"),
            primary: true,
            onClick: handleConfirmDelete,
            disabled: deleteLoading,
            danger: true,
          },
        ]}
      >
        {currencyToDelete && (
          <p className="text-gray-700">
            {tc(
              "deleteConfirm",
              "Are you sure you want to delete {{name}} ({{symbol}})? This action cannot be undone.",
              {
                name: currencyToDelete.name,
                symbol: currencyToDelete.symbol,
              },
            )}
          </p>
        )}
      </CustomModal>
    </div>
  );
};

export default CurrencyManagement;
