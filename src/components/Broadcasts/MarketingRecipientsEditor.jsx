import React from "react";
import { FiDownload, FiTrash2, FiUpload, FiUserPlus } from "react-icons/fi";
import { Users } from "lucide-react";
import {
  PHONE_REGIONS,
  formatNationalDisplay,
  formatWhatsappDisplay,
  getDefaultPhoneRegion,
  getRecipientPhoneRegion,
  parseNationalDigits,
} from "@/utils/whatsappPhoneFormat";

const emptyRecipient = () => ({
  name: "",
  email: "",
  whatsappNumber: "",
  phoneRegion: getDefaultPhoneRegion(),
});

export { emptyRecipient };

export default function MarketingRecipientsEditor({
  recipients = [],
  onChange,
  onImportClick,
  onExportClick,
  exportDisabled = false,
  announcementTitle = "",
}) {
  const list = recipients.length > 0 ? recipients : [emptyRecipient()];

  const updateAt = (index, patch) => {
    const next = list.map((r, i) => (i === index ? { ...r, ...patch } : r));
    onChange(next);
  };

  const removeAt = (index) => {
    if (list.length <= 1) {
      onChange([emptyRecipient()]);
      return;
    }
    onChange(list.filter((_, i) => i !== index));
  };

  const addRow = (count = 1) => {
    onChange([
      ...list,
      ...Array.from({ length: count }, emptyRecipient),
    ]);
  };

  const handleWhatsappChange = (index, rawValue, region) => {
    const national = parseNationalDigits(rawValue, region);
    const formatted = national
      ? formatWhatsappDisplay(national, region)
      : "";
    updateAt(index, { whatsappNumber: formatted, phoneRegion: region });
  };

  const handlePhoneRegionChangeAt = (index, nextRegion) => {
    const row = list[index];
    const currentRegion = getRecipientPhoneRegion(row);
    if (nextRegion === currentRegion) return;
    const national = parseNationalDigits(row.whatsappNumber, currentRegion);
    const formatted = national
      ? formatWhatsappDisplay(national, nextRegion)
      : "";
    updateAt(index, { phoneRegion: nextRegion, whatsappNumber: formatted });
  };

  const filledCount = list.filter(
    (r) => r.name?.trim() || r.email?.trim() || r.whatsappNumber?.trim(),
  ).length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--p-blue)]/10 text-[var(--p-blue)]">
            <Users size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              Manual recipients
              <span className="ml-2 font-normal text-gray-500">({filledCount})</span>
            </p>
            <p className="text-xs text-gray-500">
              {announcementTitle
                ? `Everyone in “${announcementTitle}” gets the same message`
                : "Name + email or WhatsApp · Tab to move between fields"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onExportClick ? (
            <button
              type="button"
              onClick={onExportClick}
              disabled={exportDisabled || filledCount === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiDownload size={15} />
              Export
            </button>
          ) : null}
          <button
            type="button"
            onClick={onImportClick}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white rounded-lg bg-emerald-600 hover:bg-emerald-700"
          >
            <FiUpload size={15} />
            Import file
          </button>
          <button
            type="button"
            onClick={() => addRow(1)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50"
          >
            <FiUserPlus size={15} />
            Add 1
          </button>
          <button
            type="button"
            onClick={() => addRow(5)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50"
          >
            +5 rows
          </button>
          <button
            type="button"
            onClick={() => addRow(10)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white rounded-lg bg-[var(--p-blue)] hover:opacity-90"
          >
            +10 rows
          </button>
        </div>
      </div>

      <p className="px-4 py-2 text-xs text-gray-500 bg-blue-50/50 border-b border-blue-100/60">
        For many people, use <strong>Import file</strong> (CSV/Excel). For a few, type below or use
        Add rows.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left sticky top-0 z-[1] shadow-[0_1px_0_0_rgb(229,231,235)]">
            <tr>
              <th className="px-3 py-2.5 font-medium text-gray-600 w-10">#</th>
              <th className="px-3 py-2.5 font-medium text-gray-600 min-w-[140px]">
                Name *
              </th>
              <th className="px-3 py-2.5 font-medium text-gray-600 min-w-[200px]">
                WhatsApp
              </th>
              <th className="px-3 py-2.5 font-medium text-gray-600 min-w-[160px]">
                Email
              </th>
              <th className="px-3 py-2.5 w-12" />
            </tr>
          </thead>
          <tbody>
            {list.map((r, idx) => {
              const region = getRecipientPhoneRegion(r);
              const regionConfig = PHONE_REGIONS[region] || PHONE_REGIONS.MY;
              const nationalDisplay = formatNationalDisplay(
                parseNationalDigits(r.whatsappNumber, region),
                region,
              );

              return (
                <tr
                  key={idx}
                  className={`border-t border-gray-100 hover:bg-blue-50/30 transition-colors ${
                    idx % 2 === 1 ? "bg-gray-50/40" : "bg-white"
                  }`}
                >
                  <td className="px-3 py-2 text-gray-400 text-xs">{idx + 1}</td>
                  <td className="px-2 py-2">
                    <input
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:border-[var(--p-blue)] focus:ring-1 focus:ring-[var(--p-blue)]/20 outline-none"
                      value={r.name}
                      onChange={(e) => updateAt(idx, { name: e.target.value })}
                      placeholder="Full name"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex gap-1.5 min-w-[200px]">
                      <select
                        className="w-[4.25rem] shrink-0 border border-gray-200 rounded-lg px-1 py-2 text-sm bg-white focus:border-[var(--p-blue)] focus:ring-1 focus:ring-[var(--p-blue)]/20 outline-none"
                        value={region}
                        onChange={(e) =>
                          handlePhoneRegionChangeAt(idx, e.target.value)
                        }
                        title={regionConfig.label}
                        aria-label="Country code"
                      >
                        {Object.values(PHONE_REGIONS).map((cfg) => (
                          <option key={cfg.code} value={cfg.code}>
                            {cfg.dialCode}
                          </option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:border-[var(--p-blue)] focus:ring-1 focus:ring-[var(--p-blue)]/20 outline-none"
                        value={nationalDisplay}
                        onChange={(e) =>
                          handleWhatsappChange(idx, e.target.value, region)
                        }
                        placeholder={regionConfig.placeholder}
                        inputMode="numeric"
                        autoComplete="tel"
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="email"
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:border-[var(--p-blue)] focus:ring-1 focus:ring-[var(--p-blue)]/20 outline-none"
                      value={r.email}
                      onChange={(e) => updateAt(idx, { email: e.target.value })}
                      placeholder="name@company.com"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      onClick={() => removeAt(idx)}
                      title="Remove"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filledCount === 0 && (
        <p className="px-4 py-2 text-xs text-amber-700 bg-amber-50 border-t border-amber-100">
          Add at least one recipient with a name and email or WhatsApp number.
        </p>
      )}
    </div>
  );
}
