import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import SettingServices from "@/services/SettingServices";
import { notifyError, notifySuccess } from "@/utils/toast";

const CloneSettingsModal = ({ open, onClose, businesses }) => {
  const { t } = useTranslation();
  const ts = (key, defaultValue, options) =>
    t(`settingsPage.clone.${key}`, { defaultValue, ...options });

  const [sourceBusinessId, setSourceBusinessId] = useState("");
  const [targetBusinessIds, setTargetBusinessIds] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [, setTick] = useState(0);

  const otherBusinesses = useMemo(() => {
    if (!sourceBusinessId) return businesses || [];
    return (businesses || []).filter((b) => b._id !== sourceBusinessId);
  }, [businesses, sourceBusinessId]);

  const isAllSelected =
    otherBusinesses.length > 0 &&
    targetBusinessIds.length === otherBusinesses.length;

  useEffect(() => {
    if (!open) {
      setSourceBusinessId("");
      setTargetBusinessIds([]);
      setIsLoading(false);
      setStartedAt(null);
    }
  }, [open]);

  useEffect(() => {
    if (!isLoading || !startedAt) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [isLoading, startedAt]);

  const toggleTarget = (id) => {
    setTargetBusinessIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const onChangeSource = (value) => {
    setSourceBusinessId(value);
    setTargetBusinessIds([]);
  };

  const onSelectAllToggle = () => {
    if (isAllSelected) setTargetBusinessIds([]);
    else setTargetBusinessIds(otherBusinesses.map((b) => b._id));
  };

  const handleClone = async () => {
    if (!sourceBusinessId)
      return notifyError(
        ts("selectSourceRequired", "Please select a source business."),
      );
    if (!targetBusinessIds.length)
      return notifyError(
        ts(
          "selectTargetRequired",
          "Please select at least one target business.",
        ),
      );

    setIsLoading(true);
    setStartedAt(Date.now());
    try {
      const res = await SettingServices.cloneSettings(
        sourceBusinessId,
        targetBusinessIds
      );
      notifySuccess(
        res?.message || ts("cloneSuccess", "Settings cloned successfully."),
      );
      onClose?.();
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
          err?.message ||
          ts("cloneFailed", "Failed to clone settings."),
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => (isLoading ? null : onClose?.())}
      />

      <div className="relative w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold">
              {ts("title", "Clone Settings")}
            </h3>
            <p className="text-sm text-gray-500">
              {ts(
                "description",
                "Copy settings from one business to one or more businesses.",
              )}
            </p>
          </div>
          <button
            className="rounded p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-60"
            onClick={() => onClose?.()}
            disabled={isLoading}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {ts("sourceBusiness", "Source business")}
            </label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437]"
              value={sourceBusinessId}
              onChange={(e) => onChangeSource(e.target.value)}
              disabled={isLoading}
            >
              <option value="">
                {ts("selectSourceBusiness", "Select source business")}
              </option>
              {(businesses || []).map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                {ts("targetBusinesses", "Target businesses")}
              </label>
              <button
                type="button"
                className="text-sm text-[#6B7F1D] hover:underline disabled:opacity-60"
                onClick={onSelectAllToggle}
                disabled={isLoading || otherBusinesses.length === 0}
              >
                {isAllSelected
                  ? ts("clearAll", "Clear all")
                  : ts("selectAll", "Select all")}
              </button>
            </div>

            {!sourceBusinessId ? (
              <div className="rounded-md border border-dashed border-gray-300 p-3 text-sm text-gray-500">
                {ts(
                  "selectSourceToChooseTargets",
                  "Select a source business to choose targets.",
                )}
              </div>
            ) : otherBusinesses.length === 0 ? (
              <div className="rounded-md border border-dashed border-gray-300 p-3 text-sm text-gray-500">
                {ts("noOtherBusinesses", "No other businesses available.")}
              </div>
            ) : (
              <div className="max-h-64 overflow-auto rounded-md border border-gray-200">
                <ul className="divide-y divide-gray-100">
                  {otherBusinesses.map((b) => (
                    <li key={b._id} className="flex items-center px-3 py-2">
                      <input
                        id={`target-${b._id}`}
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-[#A6C437] focus:ring-[#A6C437]"
                        checked={targetBusinessIds.includes(b._id)}
                        onChange={() => toggleTarget(b._id)}
                        disabled={isLoading}
                      />
                      <label
                        htmlFor={`target-${b._id}`}
                        className="ml-3 text-sm text-gray-700 select-none cursor-pointer"
                      >
                        {b.name}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {isLoading && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
              <div className="text-sm font-medium text-gray-800">
                {ts("cloning", "Cloning…")}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {startedAt
                  ? ts("elapsed", "Elapsed: {{seconds}}s", {
                      seconds: Math.floor((Date.now() - startedAt) / 1000),
                    })
                  : ts(
                      "mayTakeWhile",
                      "This may take a little while for large businesses.",
                    )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t px-5 py-4">
          <button
            type="button"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
            onClick={() => onClose?.()}
            disabled={isLoading}
          >
            {ts("cancel", "Cancel")}
          </button>
          <button
            type="button"
            className="rounded-md bg-[#A6C437] px-4 py-2 text-sm font-medium text-white hover:bg-[#93B02F] disabled:opacity-60"
            onClick={handleClone}
            disabled={isLoading}
          >
            {isLoading
              ? ts("cloningDots", "Cloning...")
              : ts("clone", "Clone")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CloneSettingsModal;
