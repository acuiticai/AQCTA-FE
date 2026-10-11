import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import ReactSelect from "react-select";
import ModalPortal from "@/components/ModalPortal";
import reactSelectConfig from "@/utils/react-select-style-config";

export default function AddDepartmentModal({
  isOpen,
  onClose,
  item,
  staffList = [],
  onSubmit,
  showPrivateToggle = false,
  overlayClassName = "z-50",
}) {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  const [formData, setFormData] = useState({
    _id: "",
    name: "",
    manager: null,
    code: "",
    status: "Active",
    isPrivate: false,
  });

  useEffect(() => {
    if (item) {
      setFormData({
        _id: item._id || "",
        name: item.name || "",
        manager: item?.manager?._id
          ? {
              _id: item.manager._id,
              displayName: item.manager.displayName || "",
            }
          : null,
        code: item.code || "",
        status: item.status || "Active",
        isPrivate: Boolean(item.isPrivate),
      });
    } else {
      setFormData({
        _id: "",
        name: "",
        manager: null,
        code: "",
        status: "Active",
        isPrivate: false,
      });
    }
  }, [item, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    onSubmit({
      ...formData,
      manager: formData.manager || { _id: "", displayName: "" },
    });
  };

  if (!isOpen) return null;

  const departmentNameLabel = thr("departments.departmentName", "Department Name");
  const departmentCodeLabel = thr("departments.departmentCode", "Department Code");

  return (
    <ModalPortal>
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center ${overlayClassName}`}
      >
        <div className="bg-white rounded-lg p-6 w-[400px] max-w-[90%]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">
              {item
                ? thr("departments.editDepartment", "Edit Department")
                : thr("departments.addNewDepartment", "Add New Department")}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
          {/* Temporarily disabled: private department toggle UI.
              Uncomment this block to re-enable later. */}
          {/* {showPrivateToggle && !item ? (
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={Boolean(formData.isPrivate)}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, isPrivate: e.target.checked }))
                }
                className="h-4 w-4 rounded border-gray-300 text-[var(--p-blue)] focus:ring-[var(--p-blue)]"
              />
              {thr("departments.privateDepartmentToggle", "Private department (only linked staff can use this)")}
            </label>
          ) : null} */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {departmentNameLabel} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              placeholder={departmentNameLabel}
              value={formData.name}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {departmentCodeLabel} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="code"
              placeholder={departmentCodeLabel}
              value={formData.code}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {thr("departments.departmentManager", "Department Manager")}
            </label>
            <ReactSelect
              value={
                formData.manager?._id
                  ? staffList.find((o) => o._id === formData.manager._id) ||
                    null
                  : null
              }
              onChange={(selectedOption) =>
                setFormData((prev) => ({
                  ...prev,
                  manager: selectedOption
                    ? {
                        _id: selectedOption._id,
                        displayName: selectedOption.displayName,
                      }
                    : null,
                }))
              }
              placeholder={thr(
                "departments.selectDepartmentManager",
                "Select Department Manager",
              )}
              options={staffList}
              getOptionLabel={(e) => e.displayName}
              getOptionValue={(e) => e._id}
              isClearable
              className="react-select-container"
              classNamePrefix="react-select"
              isSearchable
              menuPlacement="auto"
              styles={{
                ...reactSelectConfig,
                control: (base, state) => ({
                  ...(reactSelectConfig.control?.(base, state) || base),
                  backgroundColor: "#ffffff",
                  borderColor: "#d1d5db",
                  borderWidth: "1px",
                }),
              }}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors"
              style={{ backgroundColor: "var(--p-blue)" }}
            >
              {item
                ? thr("departments.updateDepartment", "Update Department")
                : thr("departments.addDepartment", "Add Department")}
            </button>
          </div>
        </div>
        </div>
      </div>
    </ModalPortal>
  );
}
