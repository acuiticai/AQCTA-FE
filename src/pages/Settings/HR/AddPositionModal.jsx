import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import ModalPortal from "@/components/ModalPortal";

export default function AddPositionModal({
  isOpen,
  onClose,
  item,
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
    code: "",
    status: "Active",
    isPrivate: false,
  });

  useEffect(() => {
    if (item) {
      setFormData({
        _id: item._id || "",
        name: item.name || "",
        code: item.code || "",
        status: item.status || "Active",
        isPrivate: Boolean(item.isPrivate),
      });
    } else {
      setFormData({
        _id: "",
        name: "",
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
    onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center ${overlayClassName}`}
      >
        <div className="bg-white rounded-lg p-6 w-[400px] max-w-[90%]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">
              {item
                ? thr("positions.editPosition", "Edit Position")
                : thr("positions.addNewPosition", "Add New Position")}
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
          {showPrivateToggle && !item ? (
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={Boolean(formData.isPrivate)}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, isPrivate: e.target.checked }))
                }
                className="h-4 w-4 rounded border-gray-300 text-[var(--p-blue)] focus:ring-[var(--p-blue)]"
              />
              {thr(
                "positions.privatePositionToggle",
                "Private position (only linked staff can use this)",
              )}
            </label>
          ) : null}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {thr("positions.positionName", "Position Name")}
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {thr("positions.positionCode", "Position Code")}
            </label>
            <input
              type="text"
              name="code"
              value={formData.code}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-transparent"
              required
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
                ? thr("positions.updatePosition", "Update Position")
                : thr("positions.addPosition", "Add Position")}
            </button>
          </div>
        </div>
        </div>
      </div>
    </ModalPortal>
  );
}
