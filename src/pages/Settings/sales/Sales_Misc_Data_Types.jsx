import { useState, useEffect, useContext } from "react";
import { Plus, ChevronDown, X, Edit, Trash2, Eye } from "lucide-react";
import Header from "@/components/header/Header";
import AppLayout from "../app-layout";
import axios from "axios";
import { useLocation } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import ToggleSwitch from "@/components/toggle/ToggleSwitch";
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiUploadCloud,
  FiXCircle,
  FiEye,
} from "react-icons/fi";
import { useTableSorting, SortIcon } from "@/utils/tableSorting.jsx";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import SettingsOrgBanner from "../SettingsOrgBanner";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";
import { notifyError, notifySuccess } from "@/utils/toast";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ItemTable = ({
  items,
  onEdit,
  onDelete,
  onToggleStatus,
  onView,
  activeTab,
  sortKey,
  sortDirection,
  handleSort,
  canUpdate,
  canDelete,
}) => (
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th
            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            onClick={() => handleSort("name")}
          >
            <div className="flex items-center space-x-1">
              <span>Name</span>
              <SortIcon
                sortKey="name"
                currentSortKey={sortKey}
                sortDirection={sortDirection}
              />
            </div>
          </th>
          {activeTab === "Payment Terms" && (
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Number of Days
            </th>
          )}
          {activeTab === "Invoice Recurrence" && (
            <>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Every
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Unit
              </th>
            </>
          )}
          {activeTab === "Terms and Conditions" && (
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Content
            </th>
          )}
          {activeTab === "Address Types" && (
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              System Type
            </th>
          )}
          {activeTab === "Sales Person" && (
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Commission (%)
            </th>
          )}
          <th
            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            onClick={() => handleSort("status")}
          >
            <div className="flex items-center space-x-1">
              <span>Status</span>
              <SortIcon
                sortKey="status"
                currentSortKey={sortKey}
                sortDirection={sortDirection}
              />
            </div>
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {items.map((item) => {
          const isLoginUserDefault = Boolean(item.isLoginUserDefaultSalesperson);
          return (
            <tr key={item._id}>
              <td className="px-6 py-4 whitespace-nowrap">
                {item.name}
                {isLoginUserDefault && (
                  <span className="ml-2 text-xs text-gray-500">(login user)</span>
                )}
              </td>
              {activeTab === "Payment Terms" && (
                <td className="px-6 py-4 whitespace-nowrap">
                  {item.numberOfDays ?? 0}
                </td>
              )}
              {activeTab === "Invoice Recurrence" && (
                <>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.repeatInterval ?? 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap capitalize">
                    {item.repeatUnit === "day"
                      ? "Day(s)"
                      : item.repeatUnit === "week"
                        ? "Week(s)"
                        : item.repeatUnit === "year"
                          ? "Year(s)"
                          : "Month(s)"}
                  </td>
                </>
              )}
              {activeTab === "Terms and Conditions" && (
                <td
                  className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate"
                  title={item.content || ""}
                >
                  {(item.content || "").slice(0, 80)}
                  {(item.content || "").length > 80 ? "…" : ""}
                </td>
              )}
              {activeTab === "Address Types" && (
                <td className="px-6 py-4 whitespace-nowrap">
                  {item.systemType || "OTHER"}
                </td>
              )}
              {activeTab === "Sales Person" && (
                <td className="px-6 py-4 whitespace-nowrap">
                  {Number(item.commission ?? 0)}
                </td>
              )}
              <td className="px-6 py-4 whitespace-nowrap">
                <ToggleSwitch
                  isOn={item.status === "active"}
                  handleToggle={() => canUpdate && onToggleStatus(item)}
                />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                {activeTab === "Sales Person" && (
                  <button
                    onClick={() => onView(item)}
                    className="text-gray-600 hover:text-gray-900 mr-2"
                    title="View details"
                  >
                    <FiEye className="w-5 h-5" />
                  </button>
                )}
                {canUpdate && (
                  <button
                    onClick={() => onEdit(item)}
                    className="text-blue-600 hover:text-blue-900 mr-2"
                    title={
                      isLoginUserDefault
                        ? "Edit commission for login user"
                        : "Edit"
                    }
                  >
                    <FiEdit className="w-5 h-5" />
                  </button>
                )}
                {canDelete && !isLoginUserDefault && (
                  <button
                    onClick={() => onDelete(item._id)}
                    className="text-red-600 hover:text-red-900 mr-2"
                  >
                    <FiTrash2 className="w-5 h-5" />
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const SalesPersonViewModal = ({ isOpen, onClose, item }) => {
  if (!isOpen || !item) return null;

  const commission = Number(item.commission ?? 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[400px] max-w-[90%]">
          <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Sales Person Details</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-medium text-gray-500">Name</dt>
            <dd className="text-gray-900 mt-0.5">{item.name || "-"}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">Status</dt>
            <dd className="text-gray-900 mt-0.5 capitalize">
              {item.status === "active" ? "Active" : "Inactive"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">Commission (%)</dt>
            <dd className="text-gray-900 mt-0.5">{commission}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">Is Sales Person</dt>
            <dd className="text-gray-900 mt-0.5">
              {item.isSalesPerson ? "Yes" : "No"}
            </dd>
          </div>
          {item.email && (
            <div>
              <dt className="font-medium text-gray-500">Email</dt>
              <dd className="text-gray-900 mt-0.5">{item.email}</dd>
            </div>
          )}
        </dl>
        <div className="flex justify-end mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const AddEditModal = ({ isOpen, onClose, type, item, onSubmit, staffOptions = [] }) => {
  const isPaymentTerms = type === "Payment Terms";
  const isTermsAndConditions = type === "Terms and Conditions";
  const isInvoiceRecurrence = type === "Invoice Recurrence";
  const isAddressTypes = type === "Address Types";
  const isSalesPerson = type === "Sales Person";
  const isLoginUserSalesperson =
    isSalesPerson &&
    Boolean(item?.isLoginUserDefaultSalesperson);
  const [formData, setFormData] = useState({
    _id: "",
    name: "",
    status: "active",
    numberOfDays: 0,
    content: "",
    repeatInterval: 1,
    repeatUnit: "month",
    systemType: "OTHER",
    staffId: "",
    isSalesPerson: true,
    commission: 0,
  });
  const [errors, setErrors] = useState({});

  // Update form data when the modal opens or item changes
  useEffect(() => {
    if (item) {
      setFormData({
        _id: item._id || "",
        name: item.name || "",
        status: item.status || "active",
        numberOfDays: item.numberOfDays ?? 0,
        content: item.content ?? "",
        repeatInterval: item.repeatInterval ?? 1,
        repeatUnit: item.repeatUnit || "month",
        systemType: item.systemType || "OTHER",
        staffId: item._id || "",
        isSalesPerson: Boolean(item.isSalesPerson),
        commission: Number(item.commission ?? 0),
      });
    } else {
      setFormData({
        _id: "",
        name: "",
        status: "active",
        numberOfDays: 0,
        content: "",
        repeatInterval: 1,
        repeatUnit: "month",
        systemType: "OTHER",
        staffId: "",
        isSalesPerson: true,
        commission: 0,
      });
    }
    setErrors({});
  }, [item, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: value }));
    if (errors[name]) {
      setErrors((prevErrors) => {
        const newErrors = { ...prevErrors };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (isSalesPerson && !isLoginUserSalesperson) {
      if (!formData.staffId) {
        newErrors.staffId = "Please select a staff member";
      }
      const commissionVal = parseFloat(formData.commission);
      if (
        formData.commission !== "" &&
        formData.commission != null &&
        (!Number.isFinite(commissionVal) || commissionVal < 0)
      ) {
        newErrors.commission = "Commission must be zero or a positive number";
      }
    }
    if (isPaymentTerms) {
      const days = parseInt(formData.numberOfDays, 10);
      if (!Number.isInteger(days) || days < 0) {
        newErrors.numberOfDays = "Please enter the number of days";
      }
    }
    if (isInvoiceRecurrence) {
      const ri = parseInt(formData.repeatInterval, 10);
      if (!Number.isInteger(ri) || ri < 1) {
        newErrors.repeatInterval = "Interval must be at least 1";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className={`bg-white rounded-lg p-6 max-w-[90%] ${isTermsAndConditions ? "w-[520px]" : isInvoiceRecurrence ? "w-[440px]" : "w-[400px]"}`}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">
            {item ? "Edit" : "Add New"} {type}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isSalesPerson && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder={isTermsAndConditions ? "e.g. Standard, Net 30" : undefined}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
                required
              />
            </div>
          )}

          {isSalesPerson && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isLoginUserSalesperson ? "Sales Person" : "Staff Selection"}{" "}
                  {!isLoginUserSalesperson && (
                    <span className="text-red-500">*</span>
                  )}
                </label>
                {isLoginUserSalesperson ? (
                  <input
                    type="text"
                    value={formData.name || item?.name || ""}
                    readOnly
                    className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700"
                  />
                ) : (
                  <select
                    name="staffId"
                    value={formData.staffId}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
                    required
                    disabled={Boolean(item?._id)}
                  >
                    <option value="">Select staff</option>
                    {staffOptions.map((staff) => (
                      <option key={staff._id} value={staff._id}>
                        {staff.name}
                      </option>
                    ))}
                  </select>
                )}
                {errors.staffId && (
                  <p className="mt-1 text-xs text-red-500">{errors.staffId}</p>
                )}
                {isLoginUserSalesperson && (
                  <p className="mt-1 text-xs text-gray-500">
                    Default salesperson for your account in this organization.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Is Sales Person
                </label>
                <ToggleSwitch
                  isOn={Boolean(formData.isSalesPerson)}
                  handleToggle={() => {
                    if (isLoginUserSalesperson) return;
                    setFormData((prev) => ({
                      ...prev,
                      isSalesPerson: !prev.isSalesPerson,
                    }));
                  }}
                />
                {isLoginUserSalesperson && (
                  <p className="mt-1 text-xs text-gray-500">
                    Always enabled for the logged-in user.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Commission (%)
                </label>
                <input
                  type="number"
                  name="commission"
                  min={0}
                  step="0.01"
                  value={formData.commission}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Enter a number only (e.g. 5 for 5%).
                </p>
                {errors.commission && (
                  <p className="mt-1 text-xs text-red-500">{errors.commission}</p>
                )}
              </div>
            </>
          )}

          {isPaymentTerms && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Days <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="numberOfDays"
                min={0}
                value={formData.numberOfDays}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
                required={isPaymentTerms}
              />
              {errors.numberOfDays && (
                <p className="mt-1 text-xs text-red-500">{errors.numberOfDays}</p>
              )}
            </div>
          )}

          {isInvoiceRecurrence && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Repeat every <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="repeatInterval"
                  min={1}
                  value={formData.repeatInterval}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
                  required
                />
                {errors.repeatInterval && (
                  <p className="mt-1 text-xs text-red-500">{errors.repeatInterval}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit <span className="text-red-500">*</span>
                </label>
                <select
                  name="repeatUnit"
                  value={formData.repeatUnit}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
                >
                  <option value="day">Day(s)</option>
                  <option value="week">Week(s)</option>
                  <option value="month">Month(s)</option>
                  <option value="year">Year(s)</option>
                </select>
              </div>
            </div>
          )}

          {isTermsAndConditions && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Content <span className="text-red-500">*</span>
              </label>
              <textarea
                name="content"
                value={formData.content}
                onChange={handleChange}
                rows={6}
                placeholder="Enter terms and conditions text..."
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent resize-y"
              />
              <p className="mt-1 text-xs text-gray-500">
                Same as Create Customer Invoice — this content can be used on invoices.
              </p>
            </div>
          )}
          {isAddressTypes && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                System Type <span className="text-red-500">*</span>
              </label>
              <select
                name="systemType"
                value={formData.systemType}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
                required
              >
                <option value="BILLING">BILLING</option>
                <option value="SHIPPING">SHIPPING</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors"
            >
              {item ? "Update" : "Add"} {type}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[350px] max-w-[90%]">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Are you sure?
        </h2>
        <p className="text-sm text-gray-600">
          Do you really want to delete this item? This action cannot be undone.
        </p>

        <div className="flex justify-end mt-6 space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

const EstimatesPage = () => {
  const [activeTab, setActiveTab] = useState("Address Types");
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locations, setLocation] = useState("All");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState(null);
  const [deleteAllModalOpen, setDeleteAllModalOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [staffOptions, setStaffOptions] = useState([]);
  const [viewItem, setViewItem] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const checkTokenExpired = useCheckTokenExpired(); // ✅ hook used properly
  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();

  const [organization, setOrganization] = useState(null); // Set initially as null
  const [isOrgLoaded, setIsOrgLoaded] = useState(false); // To track when organization is loaded
  const location = useLocation();

  // Sorting functionality
  const { sortedData, sortKey, sortDirection, handleSort } =
    useTableSorting(items);

  const dropdownOptions = Array.from(
    new Set((items || []).map((item) => item.name).filter(Boolean))
  );

  const filteredItems =
    locations === "All"
      ? sortedData
      : sortedData.filter((item) => item.name === locations);

  const mapStaffToSalespersonRow = (staff, { isLoginDefault = false } = {}) => ({
    ...staff,
    _id: String(staff._id),
    staffRecordId: String(staff._id),
    name: staff.displayName || staff.fullName || staff.name || "Unnamed Staff",
    email: staff.email || adminInfo?.email || "",
    status: staff.isSalesPerson === false ? "inactive" : "active",
    isSalesPerson: Boolean(staff.isSalesPerson),
    commission: Number(staff.commission ?? 0),
    ...(isLoginDefault ? { isLoginUserDefaultSalesperson: true } : {}),
  });

  const mapStandaloneSalesPersonRow = (sp, { isLoginDefault = false } = {}) => ({
    ...sp,
    _id: String(sp.systemUserId || sp._id),
    staffRecordId: null,
    salesPersonRecordId: sp.salesPersonRecordId || sp._id,
    systemUserId: String(sp.systemUserId || sp._id),
    name: sp.displayName || sp.name || sp.email || "Sales person",
    email: sp.email || "",
    status: sp.status === "inactive" ? "inactive" : "active",
    isSalesPerson: sp.status !== "inactive",
    commission: Number(sp.commission ?? 0),
    isStandaloneSalesPerson: true,
    ...(isLoginDefault ? { isLoginUserDefaultSalesperson: true } : {}),
  });

  const getStaffSystemUserId = (staff) => {
    if (staff?.systemUserId == null) return "";
    if (typeof staff.systemUserId === "object" && staff.systemUserId._id != null) {
      return String(staff.systemUserId._id);
    }
    return String(staff.systemUserId);
  };

  const matchLoginUserStaff = (staff, userId, loginEmail, loginStaffFromApi) => {
    const su = getStaffSystemUserId(staff);
    const em = typeof staff.email === "string" ? staff.email.toLowerCase().trim() : "";
    const idMatch =
      loginStaffFromApi?._id && String(staff._id) === String(loginStaffFromApi._id);
    return Boolean(
      userId &&
        (idMatch || su === String(userId) || (loginEmail && em === loginEmail))
    );
  };

  const buildLoginUserDisplayRow = (standaloneForUser = null) => {
    const userId = adminInfo?.id || adminInfo?._id;
    if (!userId) return null;

    if (standaloneForUser) {
      return mapStandaloneSalesPersonRow(standaloneForUser, {
        isLoginDefault: true,
      });
    }

    const displayName = [
      adminInfo?.name,
      adminInfo?.last_name || adminInfo?.lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    return {
      _id: String(userId),
      staffRecordId: null,
      systemUserId: String(userId),
      name: displayName || adminInfo?.email || "Current user",
      email: adminInfo?.email || "",
      status: "active",
      isSalesPerson: true,
      isLoginUserDefaultSalesperson: true,
      isStandaloneSalesPerson: true,
      commission: 0,
    };
  };

  const saveSalesPersonSettings = async ({
    staffId,
    systemUserId,
    commission,
    isSalesPerson,
  }) => {
    const response = await axios.put(
      `${BASE_URL}/sales-persons/upsert`,
      {
        business: organization,
        staffId: staffId || undefined,
        systemUserId: systemUserId || undefined,
        commission,
        isSalesPerson,
      },
      { headers }
    );
    return response;
  };

  const resolveLoginUserStaffId = async (staffList = []) => {
    const userId = adminInfo?.id || adminInfo?._id;
    const loginEmail = (adminInfo?.email || "").toLowerCase().trim();

    if (editItem?.staffRecordId) return editItem.staffRecordId;
    if (editItem?._id && !editItem?.isStandaloneSalesPerson) {
      return editItem._id;
    }

    const fromList = staffList.find((staff) =>
      matchLoginUserStaff(staff, userId, loginEmail, null)
    );
    if (fromList?._id) return String(fromList._id);

    const fromOptions = staffOptions.find((staff) =>
      matchLoginUserStaff(staff, userId, loginEmail, null)
    );
    if (fromOptions?._id && !fromOptions?.isStandaloneSalesPerson) {
      return String(fromOptions._id);
    }

    if (userId && organization) {
      try {
        const res = await axios.get(`${BASE_URL}/staff-management`, {
          headers,
          params: { business: organization, id: userId, page: 1, limit: 1 },
        });
        if (checkTokenExpired(res)) return null;
        const staff = res?.data?.staffList?.[0];
        if (staff?._id) return String(staff._id);
      } catch {
        // no staff profile — standalone sales person is allowed
      }
    }

    return null;
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const selectedOrg = searchParams.get("selectedOrg");

    if (selectedOrg) {
      setOrganization(selectedOrg);
    }

    setIsOrgLoaded(true); // Organization has been fetched
  }, [location]);

  useEffect(() => {
    if (isOrgLoaded && organization) {
      // Ensure organization is loaded before fetching items
      fetchItems(activeTab, organization);
    }
  }, [
    activeTab,
    organization,
    isOrgLoaded,
    adminInfo?.id,
    adminInfo?._id,
    adminInfo?.email,
    adminInfo?.name,
    adminInfo?.last_name,
    adminInfo?.lastName,
  ]);

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  // Invoice / sales document settings + Address Types
  const tabs = [
    "Address Types",
    "Payment Terms",
    "Sales Person",
    "Invoice Recurrence",
    "Delivery Terms",
    "Shipping Terms",
    "Delivery Methods",
    "Terms and Conditions",
  ];
  // Still hidden (not typically invoice-related):
  // "Business Type", "Contract Type", "Product Type", "Forecast Cost Desc",
  // "Packing", "ETD Ports", "Loading Port", "Discharge Port", "Country of Origin",

  const handleAddNew = () => {
    if (!canAdd) return;
    setEditItem(null);
    setModalOpen(true);
  };

  const handleEdit = (item) => {
    if (!canUpdate) return;
    setEditItem(item);
    setModalOpen(true);
  };

  const handleSubmit = async (item) => {
    if ((editItem && !canUpdate) || (!editItem && !canAdd)) return;
    try {
      if (activeTab === "Sales Person") {
        const commissionVal = parseFloat(item.commission);
        const normalizedCommission =
          Number.isFinite(commissionVal) && commissionVal >= 0 ? commissionVal : 0;
        const isLoginUserRow = Boolean(editItem?.isLoginUserDefaultSalesperson);
        const activeAsSalesPerson = Boolean(item.isSalesPerson);

        if (isLoginUserRow) {
          const targetStaffId = await resolveLoginUserStaffId(staffOptions);
          const userId = adminInfo?.id || adminInfo?._id;
          const response = await saveSalesPersonSettings({
            staffId: targetStaffId || undefined,
            systemUserId: userId,
            commission: normalizedCommission,
            isSalesPerson: activeAsSalesPerson,
          });
          if (checkTokenExpired(response)) return;
          fetchItems(activeTab, organization);
          setModalOpen(false);
          return;
        }

        if (editItem?.isStandaloneSalesPerson && editItem?.systemUserId) {
          const response = await saveSalesPersonSettings({
            systemUserId: editItem.systemUserId,
            commission: normalizedCommission,
            isSalesPerson: activeAsSalesPerson,
          });
          if (checkTokenExpired(response)) return;
          fetchItems(activeTab, organization);
          setModalOpen(false);
          return;
        }

        const targetStaffId = editItem?._id || item.staffId;
        if (!targetStaffId) {
          notifyError("Please select a staff member");
          return;
        }

        const response = await saveSalesPersonSettings({
          staffId: targetStaffId,
          commission: normalizedCommission,
          isSalesPerson: activeAsSalesPerson,
        });
        if (checkTokenExpired(response)) return;
        fetchItems(activeTab, organization);
        setModalOpen(false);
        return;
      }
      const payload = {
        name: item.name,
        status: item.status,
        business_id: organization,
      };
      if (activeTab === "Payment Terms" && item.numberOfDays !== undefined) {
        payload.numberOfDays = parseInt(item.numberOfDays, 10);
      }
      if (activeTab === "Terms and Conditions" && item.content !== undefined) {
        payload.content = item.content;
      }
      if (activeTab === "Invoice Recurrence") {
        payload.repeatInterval = parseInt(item.repeatInterval, 10);
        payload.repeatUnit = item.repeatUnit;
      }
      if (activeTab === "Address Types") {
        payload.systemType = item.systemType || "OTHER";
      }

      if (editItem) {
        const response = await axios.put(
          `${BASE_URL}/items/${activeTab}/update/${editItem._id}`,
          payload,
          { headers }
        );
        if (checkTokenExpired(response)) return;
        fetchItems(activeTab, organization);
      } else {
        const response = await axios.post(
          `${BASE_URL}/items/${activeTab}/add`,
          payload,
          { headers }
        );
        if (checkTokenExpired(response)) return;
        fetchItems(activeTab, organization);
      }
      setModalOpen(false);
      setActiveTab((prevTab) => prevTab);
    } catch (err) {
      console.error("Failed to save item", err);
      notifyError(
        err.response?.data?.message || "Failed to save item"
      );
    }
  };

  const fetchItems = async (ActiveTab, selectedOrg) => {
    console.log("response");
    if (!selectedOrg) return;
    setLoading(true);
    try {
      if (ActiveTab === "Sales Person") {
        const userId = adminInfo?.id || adminInfo?._id;
        const [staffResponse, loginStaffResponse, salesPersonsResponse] =
          await Promise.all([
            axios.get(`${BASE_URL}/staff-management`, {
              headers,
              params: { business: selectedOrg, page: 1, limit: 9999 },
            }),
            userId
              ? axios
                  .get(`${BASE_URL}/staff-management`, {
                    headers,
                    params: {
                      business: selectedOrg,
                      id: userId,
                      page: 1,
                      limit: 1,
                    },
                  })
                  .catch(() => null)
              : Promise.resolve(null),
            axios
              .get(`${BASE_URL}/sales-persons`, {
                headers,
                params: { business: selectedOrg },
              })
              .catch(() => null),
          ]);
        if (checkTokenExpired(staffResponse)) return;
        if (loginStaffResponse && checkTokenExpired(loginStaffResponse)) return;
        if (salesPersonsResponse && checkTokenExpired(salesPersonsResponse)) return;

        const staffList = Array.isArray(staffResponse?.data?.staffList)
          ? staffResponse.data.staffList
          : [];
        const loginStaffFromApi = loginStaffResponse?.data?.staffList?.[0] || null;
        const standaloneSalesPersons = Array.isArray(
          salesPersonsResponse?.data?.data
        )
          ? salesPersonsResponse.data.data
          : [];

        const mappedStaff = staffList
          .filter((staff) => staff.status !== "Terminated")
          .map((staff) => ({
            ...staff,
            name: staff.displayName || staff.fullName || "Unnamed Staff",
            status: staff.isSalesPerson ? "active" : "inactive",
            commission: Number(staff.commission ?? 0),
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        const loginEmail = (adminInfo?.email || "").toLowerCase().trim();
        const isLoginUserStaff = (staff) =>
          matchLoginUserStaff(staff, userId, loginEmail, loginStaffFromApi);

        const loginStaffInList = mappedStaff.find((staff) =>
          isLoginUserStaff(staff)
        );
        const resolvedLoginStaff = loginStaffFromApi || loginStaffInList || null;
        const loginStandalone = standaloneSalesPersons.find(
          (sp) => String(sp.systemUserId) === String(userId)
        );

        const staffSystemUserIds = new Set(
          mappedStaff.map((s) => getStaffSystemUserId(s)).filter(Boolean)
        );

        let displayedStaff = mappedStaff.map((staff) =>
          isLoginUserStaff(staff)
            ? mapStaffToSalespersonRow(staff, { isLoginDefault: true })
            : staff
        );

        standaloneSalesPersons.forEach((sp) => {
          if (!sp.systemUserId) return;
          if (staffSystemUserIds.has(String(sp.systemUserId))) return;
          if (String(sp.systemUserId) === String(userId)) return;
          displayedStaff.push(mapStandaloneSalesPersonRow(sp));
        });

        if (userId) {
          const loginRow = resolvedLoginStaff
            ? mapStaffToSalespersonRow(resolvedLoginStaff, { isLoginDefault: true })
            : loginStandalone
              ? mapStandaloneSalesPersonRow(loginStandalone, { isLoginDefault: true })
              : buildLoginUserDisplayRow();

          if (loginRow) {
            const loginIdx = displayedStaff.findIndex(
              (staff) =>
                staff.isLoginUserDefaultSalesperson ||
                String(staff._id) === String(loginRow._id) ||
                (loginRow.staffRecordId &&
                  String(staff._id) === String(loginRow.staffRecordId))
            );

            if (loginIdx >= 0) {
              displayedStaff[loginIdx] = {
                ...displayedStaff[loginIdx],
                ...loginRow,
                _id: String(loginRow._id || displayedStaff[loginIdx]._id),
              };
              const [pinned] = displayedStaff.splice(loginIdx, 1);
              displayedStaff.unshift(pinned);
            } else {
              displayedStaff.unshift(loginRow);
            }
          }
        }

        setStaffOptions(mappedStaff);
        setItems(displayedStaff);
        return;
      }
      let payload = {
        business_id: selectedOrg,
        FilterStatus: "",
        FilterName: "",
      };
      console.log("payload", payload);

      let response = await axios.post(
        `${BASE_URL}/items/${ActiveTab}/get_all`,
        payload,
        { headers }
      );
      console.log("response", response);
      if (checkTokenExpired(response)) return;
      setItems(response.data.data);
    } catch (err) {
      notifyError("Failed to fetch items");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (_id) => {
    if (activeTab === "Sales Person") return;
    if (!canDelete) return;
    setDeleteItemId(_id); // Store the item ID for deletion
    setDeleteModalOpen(true); // Open the delete confirmation modal
  };

  const handleDeleteClick = async () => {
    if (!canDelete) return;
    if (!deleteItemId) return;

    try {
      const response = await axios.delete(
        `${BASE_URL}/items/${activeTab}/delete/${deleteItemId}`,
        { headers }
      );
      if (checkTokenExpired(response)) return;
      fetchItems(activeTab, organization);
    } catch (err) {
      notifyError(err.response?.data?.message || "Failed to delete item");
    } finally {
      setDeleteModalOpen(false);
      setDeleteItemId(null);
    }
  };

  const handleToggleStatus = async (item) => {
    if (!canUpdate) return;
    try {
      if (activeTab === "Sales Person") {
        const nextActive = item.status !== "active";
        let response;
        if (item.isStandaloneSalesPerson && item.systemUserId) {
          response = await saveSalesPersonSettings({
            systemUserId: item.systemUserId,
            commission: Number(item.commission ?? 0),
            isSalesPerson: nextActive,
          });
        } else if (item.isLoginUserDefaultSalesperson) {
          const userId = adminInfo?.id || adminInfo?._id;
          const staffId = item.staffRecordId || (await resolveLoginUserStaffId(staffOptions));
          response = await saveSalesPersonSettings({
            staffId: staffId || undefined,
            systemUserId: userId,
            commission: Number(item.commission ?? 0),
            isSalesPerson: nextActive,
          });
        } else {
          response = await saveSalesPersonSettings({
            staffId: item._id,
            commission: Number(item.commission ?? 0),
            isSalesPerson: nextActive,
          });
        }
        if (checkTokenExpired(response)) return;
        fetchItems(activeTab, organization);
        notifySuccess("Status updated successfully");
        return;
      }
      let payload = {
        name: item.name,
        status: item.status === "active" ? "inactive" : "active",
        business_id: organization,
      };

      console.log("payload", payload);
      const response = await axios.put(
        `${BASE_URL}/items/${activeTab}/update/${item._id}`,
        payload,
        { headers }
      );
      if (checkTokenExpired(response)) return;
      fetchItems(activeTab, organization);
    } catch (err) {
      notifyError(
        err.response?.data?.message || "Failed to update item status"
      );
    }
  };

  const handleView = (item) => {
    setViewItem(item);
    setViewModalOpen(true);
  };

  const handleDeleteAllTermsAndConditions = async () => {
    if (!organization || activeTab !== "Terms and Conditions") return;
    setDeletingAll(true);
    try {
      const response = await axios.post(
        `${BASE_URL}/items/Terms and Conditions/delete_all`,
        { business_id: organization },
        { headers }
      );
      if (checkTokenExpired(response)) return;
      setDeleteAllModalOpen(false);
      fetchItems(activeTab, organization);
    } catch (err) {
      notifyError(err.response?.data?.message || "Failed to delete all");
    } finally {
      setDeletingAll(false);
    }
  };

  return (
    <AppLayout>
      <Header />
      <div className="p-6 bg-white h-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-xl font-semibold text-gray-900">
            Misc. Data Types
          </h1>
          {canAdd && (
            <button
              onClick={handleAddNew}
              className="flex items-center px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add New
            </button>
          )}
        </div>
        <SettingsOrgBanner />

        <div className="border-b border-gray-200 mb-6">
          <nav className="flex -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  fetchItems(tab, organization);
                }}
                className={`mr-8 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab
                    ? "border-[#A6C437] text-[#A6C437]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {!isOrgLoaded && !organization ? (
          <div className="fixed inset-0 flex items-center justify-center bg-white">
            <p className="text-gray-600">Loading organization...</p>
          </div>
        ) : loading ? (
          <div>Loading...</div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <label className="text-sm font-medium text-gray-700">
                {activeTab}
              </label>
              <div className="flex items-center gap-3">
                {activeTab === "Terms and Conditions" && items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDeleteAllModalOpen(true)}
                    className="px-3 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Delete all
                  </button>
                )}
                <div className="relative">
                <select
                  value={locations}
                  onChange={(e) => setLocation(e.target.value)}
                  className="appearance-none bg-white border border-gray-300 rounded-lg py-2 pl-4 pr-10 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
                >
                  <option value="All">All</option>
                  {dropdownOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm">
              <ItemTable
                items={filteredItems}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleStatus={handleToggleStatus}
                onView={handleView}
                activeTab={activeTab}
                sortKey={sortKey}
                sortDirection={sortDirection}
                handleSort={handleSort}
                canUpdate={canUpdate}
                canDelete={activeTab === "Sales Person" ? false : canDelete}
              />
            </div>
          </div>
        )}
        <AddEditModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          type={activeTab}
          organization={organization}
          item={editItem}
          onSubmit={handleSubmit}
          staffOptions={staffOptions}
        />
        <SalesPersonViewModal
          isOpen={viewModalOpen && activeTab === "Sales Person"}
          onClose={() => {
            setViewModalOpen(false);
            setViewItem(null);
          }}
          item={viewItem}
        />
        <DeleteConfirmationModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleDeleteClick}
        />
        {deleteAllModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-[380px] max-w-[90%]">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Delete all Terms and Conditions?
              </h2>
              <p className="text-sm text-gray-600">
                This will permanently remove all {items.length} Terms and Conditions for this organization. This action cannot be undone.
              </p>
              <div className="flex justify-end mt-6 space-x-3">
                <button
                  onClick={() => setDeleteAllModalOpen(false)}
                  disabled={deletingAll}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAllTermsAndConditions}
                  disabled={deletingAll}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deletingAll ? "Deleting..." : "Delete all"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default EstimatesPage;
