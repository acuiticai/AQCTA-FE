import React, { useState, useEffect } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Shield,
  Save,
  Settings,
  Download,
  Plus,
  Trash2,
  X,
  AlertTriangle,
} from "lucide-react";
import Header from "@/components/header/Header";
import AppLayout from "../../app-layout";
import SettingsOrgBanner from "../../SettingsOrgBanner";
import { notifyError, notifySuccess } from "@/utils/toast";
import YearPicker from "@/pages/Payroll/components/YearPicker";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const inputCls =
  "w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all";
const inlineInputCls =
  "px-3 py-1.5 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all";
const bandInputCls =
  "w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all text-right tabular-nums";
const checkboxCls =
  "rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4";

/** Custom confirm modal to replace browser default */
const ConfirmModal = ({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel,
  confirmTone = "danger",
}) => {
  const { t } = useTranslation();
  const tp = (key, fallback, options) =>
    t(`settingsPage.payroll.${key}`, { defaultValue: fallback, ...options });
  if (!open) return null;
  const isDanger = confirmTone === "danger";
  const resolvedConfirmLabel =
    confirmLabel || tp("statutory.confirmModal.defaultDelete", "Delete");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-sm mx-4 p-0 overflow-hidden animate-in fade-in zoom-in-95">
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
              isDanger ? "bg-red-50" : "bg-blue-50"
            }`}
          >
            <AlertTriangle
              className={`w-5 h-5 ${
                isDanger ? "text-red-500" : "text-[var(--p-blue)]"
              }`}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{message}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 bg-gray-50 border-t border-gray-100 mt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {tp("statutory.confirmModal.cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-1.5 text-xs font-medium text-white rounded-lg transition-colors ${
              isDanger
                ? "bg-red-500 hover:bg-red-600"
                : "bg-[var(--p-blue)] hover:brightness-95"
            }`}
          >
            {resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

/** Reusable band table editor for EPF contribution schedules */
const BandTableEditor = ({
  bands = [],
  onChange,
  wageLabel,
  canAdd = true,
  canUpdate = true,
  canDelete = true,
}) => {
  const { t } = useTranslation();
  const tp = (key, fallback, options) =>
    t(`settingsPage.payroll.${key}`, { defaultValue: fallback, ...options });
  const resolvedWageLabel = wageLabel ?? tp("statutory.band.wageLabelDefault", "Wage");
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: "",
    message: "",
    onConfirm: null,
  });
  const addRow = () => {
    if (!canAdd) return;
    onChange([
      ...bands,
      { wageFrom: 0, wageTo: 0, employerAmount: 0, employeeAmount: 0 },
    ]);
  };
  const updateRow = (i, field, val) => {
    if (!canUpdate) return;
    onChange(
      bands.map((b, idx) =>
        idx === i ? { ...b, [field]: val === "" ? "" : Number(val) } : b,
      ),
    );
  };
  const blurRow = (i, field) => {
    if (!canUpdate) return;
    onChange(
      bands.map((b, idx) =>
        idx === i ? { ...b, [field]: Number(b[field]) || 0 } : b,
      ),
    );
  };
  const removeRow = (i) => {
    if (!canDelete) return;
    setConfirmModal({
      open: true,
      title: tp("statutory.confirm.deleteBandRowTitle", "Delete Band Row"),
      message: tp(
        "statutory.confirm.deleteBandRowMessage",
        "Remove band row #{{n}}? This action cannot be undone.",
        { n: i + 1 },
      ),
      onConfirm: () => {
        onChange(bands.filter((_, idx) => idx !== i));
        setConfirmModal({ open: false });
      },
    });
  };
  const deleteAll = () => {
    if (!canDelete) return;
    setConfirmModal({
      open: true,
      title: tp("statutory.confirm.deleteAllBandsTitle", "Delete All Band Rows"),
      message: tp(
        "statutory.confirm.deleteAllBandsMessage",
        "This will remove all {{n}} EPF band rows. This action cannot be undone.",
        { n: bands.length },
      ),
      onConfirm: () => {
        onChange([]);
        setConfirmModal({ open: false });
      },
    });
  };

  return (
    <div className="mt-3">
      <div className="overflow-x-auto rounded-xl border border-gray-200/80 shadow-sm max-h-[500px] overflow-y-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-10">
                #
              </th>
              <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                {tp("statutory.band.wageFromRm", "{{wageLabel}} From (RM)", {
                  wageLabel: resolvedWageLabel,
                })}
              </th>
              <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                {tp("statutory.band.wageToRm", "{{wageLabel}} To (RM)", {
                  wageLabel: resolvedWageLabel,
                })}
              </th>
              <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                {tp("statutory.band.employerRm", "Employer (RM)")}
              </th>
              <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                {tp("statutory.band.employeeRm", "Employee (RM)")}
              </th>
              <th className="px-2 py-2.5 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {bands.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-gray-400"
                >
                  {tp(
                    "statutory.band.empty",
                    "No bands configured. Add rows or seed defaults.",
                  )}
                </td>
              </tr>
            ) : (
              bands.map((b, i) => (
                <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-2 py-1.5 text-center text-[11px] text-gray-400 font-medium">
                    {i + 1}
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      step="0.01"
                      value={b.wageFrom}
                      onChange={(e) => updateRow(i, "wageFrom", e.target.value)}
                      onBlur={() => blurRow(i, "wageFrom")}
                      disabled={!canUpdate}
                      className={bandInputCls}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      step="0.01"
                      value={b.wageTo}
                      onChange={(e) => updateRow(i, "wageTo", e.target.value)}
                      onBlur={() => blurRow(i, "wageTo")}
                      disabled={!canUpdate}
                      className={bandInputCls}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      step="0.01"
                      value={b.employerAmount}
                      onChange={(e) =>
                        updateRow(i, "employerAmount", e.target.value)
                      }
                      onBlur={() => blurRow(i, "employerAmount")}
                      disabled={!canUpdate}
                      className={bandInputCls}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      step="0.01"
                      value={b.employeeAmount}
                      onChange={(e) =>
                        updateRow(i, "employeeAmount", e.target.value)
                      }
                      onBlur={() => blurRow(i, "employeeAmount")}
                      disabled={!canUpdate}
                      className={bandInputCls}
                    />
                  </td>
                  <td className="px-2 py-1 text-center">
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title={tp("common.removeRow", "Remove row")}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 mt-2">
        {canAdd && (
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--p-blue)] hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> {tp("common.addRow", "Add Row")}
          </button>
        )}
        {bands.length > 0 && (
          <>
            {canDelete && (
              <button
                type="button"
                onClick={deleteAll}
                className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> {tp("common.deleteAll", "Delete All")}
              </button>
            )}
            <span className="text-[11px] text-gray-400 ml-auto tabular-nums">
              {tp("statutory.band.count", "{{n}} band(s)", { n: bands.length })}
            </span>
          </>
        )}
      </div>
      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ open: false })}
      />
    </div>
  );
};
/** SOCSO Act 4 Band Table Editor – editable with CRUD */
const SocsoBandTableEditor = ({
  bands = [],
  onChange,
  canAdd = true,
  canUpdate = true,
  canDelete = true,
}) => {
  const { t } = useTranslation();
  const tp = (key, fallback, options) =>
    t(`settingsPage.payroll.${key}`, { defaultValue: fallback, ...options });
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: "",
    message: "",
    onConfirm: null,
  });
  const addRow = () => {
    if (!canAdd) return;
    onChange([
      ...bands,
      {
        wageFrom: 0,
        wageTo: 0,
        firstCatEmployer: 0,
        firstCatEmployee: 0,
        firstCatTotal: 0,
        secondCatEmployer: 0,
      },
    ]);
  };
  const updateRow = (i, field, val) => {
    if (!canUpdate) return;
    const updated = bands.map((b, idx) => {
      if (idx !== i) return b;
      const next = {
        ...b,
        [field]:
          field === "wageTo" && val === ""
            ? null
            : val === ""
              ? ""
              : Number(val),
      };
      // Auto-calculate total when employer/employee changes
      if (field === "firstCatEmployer" || field === "firstCatEmployee") {
        next.firstCatTotal =
          Math.round(
            ((Number(next.firstCatEmployer) || 0) +
              (Number(next.firstCatEmployee) || 0)) *
              100,
          ) / 100;
      }
      return next;
    });
    onChange(updated);
  };
  const blurRow = (i, field) => {
    if (!canUpdate) return;
    const updated = bands.map((b, idx) => {
      if (idx !== i) return b;
      const next = {
        ...b,
        [field]:
          field === "wageTo" && (b[field] === "" || b[field] == null)
            ? null
            : Number(b[field]) || 0,
      };
      next.firstCatTotal =
        Math.round(
          ((Number(next.firstCatEmployer) || 0) +
            (Number(next.firstCatEmployee) || 0)) *
            100,
        ) / 100;
      return next;
    });
    onChange(updated);
  };
  const removeRow = (i) => {
    if (!canDelete) return;
    setConfirmModal({
      open: true,
      title: tp("statutory.confirm.deleteBandRowTitle", "Delete Band Row"),
      message: tp(
        "statutory.confirm.deleteSocsoRowMessage",
        "Remove SOCSO band row #{{n}}? This action cannot be undone.",
        { n: i + 1 },
      ),
      onConfirm: () => {
        onChange(bands.filter((_, idx) => idx !== i));
        setConfirmModal({ open: false });
      },
    });
  };
  const deleteAll = () => {
    if (!canDelete) return;
    setConfirmModal({
      open: true,
      title: tp(
        "statutory.confirm.deleteAllSocsoTitle",
        "Delete All SOCSO Bands",
      ),
      message: tp(
        "statutory.confirm.deleteAllSocsoMessage",
        "This will remove all {{n}} SOCSO band rows. This action cannot be undone.",
        { n: bands.length },
      ),
      onConfirm: () => {
        onChange([]);
        setConfirmModal({ open: false });
      },
    });
  };

  return (
    <div className="mt-3">
      <div className="overflow-x-auto rounded-xl border border-gray-200/80 shadow-sm max-h-[500px] overflow-y-auto">
        <table className="min-w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              <th
                rowSpan={2}
                className="bg-gradient-to-r from-gray-50 to-slate-50 px-2 py-2 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-8 border-b border-gray-200"
              >
                #
              </th>
              <th
                rowSpan={2}
                className="bg-gradient-to-r from-gray-50 to-slate-50 px-2 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-r border-b border-gray-200"
              >
                {tp("statutory.socso.headerFromRm", "From (RM)")}
              </th>
              <th
                rowSpan={2}
                className="bg-gradient-to-r from-gray-50 to-slate-50 px-2 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-r border-b border-gray-200"
              >
                {tp("statutory.socso.headerToRm", "To (RM)")}
              </th>
              <th
                colSpan={3}
                className="bg-[#4CAF50] px-3 py-2 text-center text-[10px] font-bold text-white uppercase tracking-wider border-r border-gray-200"
              >
                {tp(
                  "statutory.socso.headerFirstCategory",
                  "First Category (Employment Injury & Invalidity Scheme)",
                )}
              </th>
              <th className="bg-[#00ACC1] px-3 py-2 text-center text-[10px] font-bold text-white uppercase tracking-wider">
                {tp(
                  "statutory.socso.headerSecondCategory",
                  "Second Category (Employment Injury Scheme)",
                )}
              </th>
              <th
                rowSpan={2}
                className="bg-gradient-to-r from-gray-50 to-slate-50 px-1 py-2 w-8 border-b border-gray-200"
              ></th>
            </tr>
            <tr>
              <th className="bg-[#66BB6A] px-2 py-1.5 text-center text-[9px] font-semibold text-white uppercase tracking-wider border-r border-white/30 border-b border-gray-200">
                {tp("statutory.socso.headerEmployers", "Employer's")}
              </th>
              <th className="bg-[#66BB6A] px-2 py-1.5 text-center text-[9px] font-semibold text-white uppercase tracking-wider border-r border-white/30 border-b border-gray-200">
                {tp("statutory.socso.headerEmployees", "Employee's")}
              </th>
              <th className="bg-[#66BB6A] px-2 py-1.5 text-center text-[9px] font-semibold text-white uppercase tracking-wider border-r border-b border-gray-200">
                {tp(
                  "statutory.socso.headerTotalContribution",
                  "Total Contribution",
                )}
              </th>
              <th className="bg-[#26C6DA] px-2 py-1.5 text-center text-[9px] font-semibold text-white uppercase tracking-wider border-b border-gray-200">
                {tp(
                  "statutory.socso.headerEmployerOnly",
                  "Contribution By Employer Only",
                )}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {bands.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-sm text-gray-400"
                >
                  {tp(
                    "statutory.socso.bandEmpty",
                    "No SOCSO bands configured. Add rows or seed official Act 4 rates.",
                  )}
                </td>
              </tr>
            ) : (
              bands.map((b, i) => (
                <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-2 py-1 text-center text-[11px] text-gray-400 font-medium">
                    {i + 1}
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      step="0.01"
                      value={b.wageFrom}
                      onChange={(e) => updateRow(i, "wageFrom", e.target.value)}
                      onBlur={() => blurRow(i, "wageFrom")}
                      className={bandInputCls}
                    />
                  </td>
                  <td className="px-1 py-1 border-r border-gray-100">
                    <input
                      type="number"
                      step="0.01"
                      value={b.wageTo ?? ""}
                      onChange={(e) => updateRow(i, "wageTo", e.target.value)}
                      onBlur={() => blurRow(i, "wageTo")}
                      className={bandInputCls}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      step="0.01"
                      value={b.firstCatEmployer}
                      onChange={(e) =>
                        updateRow(i, "firstCatEmployer", e.target.value)
                      }
                      onBlur={() => blurRow(i, "firstCatEmployer")}
                      className={bandInputCls}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      step="0.01"
                      value={b.firstCatEmployee}
                      onChange={(e) =>
                        updateRow(i, "firstCatEmployee", e.target.value)
                      }
                      onBlur={() => blurRow(i, "firstCatEmployee")}
                      className={bandInputCls}
                    />
                  </td>
                  <td className="px-1 py-1 border-r border-gray-100">
                    <span className="block text-center text-[11px] font-semibold text-gray-700 tabular-nums py-1.5">
                      {(
                        b.firstCatTotal ??
                        (Number(b.firstCatEmployer) || 0) +
                          (Number(b.firstCatEmployee) || 0)
                      ).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      step="0.01"
                      value={b.secondCatEmployer}
                      onChange={(e) =>
                        updateRow(i, "secondCatEmployer", e.target.value)
                      }
                      onBlur={() => blurRow(i, "secondCatEmployer")}
                      className={bandInputCls}
                    />
                  </td>
                  <td className="px-1 py-1 text-center">
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title={tp("common.removeRow", "Remove row")}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 mt-2">
        {canAdd && (
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--p-blue)] hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> {tp("common.addRow", "Add Row")}
          </button>
        )}
        {bands.length > 0 && (
          <>
            {canDelete && (
              <button
                type="button"
                onClick={deleteAll}
                className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> {tp("common.deleteAll", "Delete All")}
              </button>
            )}
            <span className="text-[11px] text-gray-400 ml-auto tabular-nums">
              {tp(
                "statutory.socso.bandCountSuffix",
                "{{n}} band(s) – PERKESO Act 4",
                { n: bands.length },
              )}
            </span>
          </>
        )}
      </div>
      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ open: false })}
      />
    </div>
  );
};

/** EIS Act 800 Band Table Editor – editable with CRUD */
const EisBandTableEditor = ({
  bands = [],
  onChange,
  canAdd = true,
  canUpdate = true,
  canDelete = true,
}) => {
  const { t } = useTranslation();
  const tp = (key, fallback, options) =>
    t(`settingsPage.payroll.${key}`, { defaultValue: fallback, ...options });
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: "",
    message: "",
    onConfirm: null,
  });
  const addRow = () => {
    if (!canAdd) return;
    onChange([
      ...bands,
      {
        wageFrom: 0,
        wageTo: 0,
        employerAmount: 0,
        employeeAmount: 0,
        total: 0,
      },
    ]);
  };
  const updateRow = (i, field, val) => {
    if (!canUpdate) return;
    const updated = bands.map((b, idx) => {
      if (idx !== i) return b;
      const next = {
        ...b,
        [field]:
          field === "wageTo" && val === ""
            ? null
            : val === ""
              ? ""
              : Number(val),
      };
      if (field === "employerAmount" || field === "employeeAmount") {
        next.total =
          Math.round(
            ((Number(next.employerAmount) || 0) +
              (Number(next.employeeAmount) || 0)) *
              100,
          ) / 100;
      }
      return next;
    });
    onChange(updated);
  };
  const blurRow = (i, field) => {
    if (!canUpdate) return;
    const updated = bands.map((b, idx) => {
      if (idx !== i) return b;
      const next = {
        ...b,
        [field]:
          field === "wageTo" && (b[field] === "" || b[field] == null)
            ? null
            : Number(b[field]) || 0,
      };
      next.total =
        Math.round(
          ((Number(next.employerAmount) || 0) +
            (Number(next.employeeAmount) || 0)) *
            100,
        ) / 100;
      return next;
    });
    onChange(updated);
  };
  const removeRow = (i) => {
    if (!canDelete) return;
    setConfirmModal({
      open: true,
      title: tp("statutory.confirm.deleteBandRowTitle", "Delete Band Row"),
      message: tp(
        "statutory.confirm.deleteEisRowMessage",
        "Remove EIS band row #{{n}}? This action cannot be undone.",
        { n: i + 1 },
      ),
      onConfirm: () => {
        onChange(bands.filter((_, idx) => idx !== i));
        setConfirmModal({ open: false });
      },
    });
  };
  const deleteAll = () => {
    if (!canDelete) return;
    setConfirmModal({
      open: true,
      title: tp(
        "statutory.confirm.deleteAllEisTitle",
        "Delete All EIS Bands",
      ),
      message: tp(
        "statutory.confirm.deleteAllEisMessage",
        "This will remove all {{n}} EIS band rows. This action cannot be undone.",
        { n: bands.length },
      ),
      onConfirm: () => {
        onChange([]);
        setConfirmModal({ open: false });
      },
    });
  };

  return (
    <div className="mt-3">
      <div className="overflow-x-auto rounded-xl border border-gray-200/80 shadow-sm max-h-[500px] overflow-y-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-8">
                #
              </th>
              <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                {tp("statutory.eis.headerFromRm", "From (RM)")}
              </th>
              <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                {tp("statutory.eis.headerToRm", "To (RM)")}
              </th>
              <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                {tp("statutory.eis.headerEmployerRm", "Employer (RM)")}
              </th>
              <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                {tp("statutory.eis.headerEmployeeRm", "Employee (RM)")}
              </th>
              <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                {tp("statutory.eis.headerTotalRm", "Total (RM)")}
              </th>
              <th className="px-1 py-2.5 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {bands.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-gray-400"
                >
                  {tp(
                    "statutory.eis.bandEmpty",
                    "No EIS bands configured. Add rows or seed official Act 800 rates.",
                  )}
                </td>
              </tr>
            ) : (
              bands.map((b, i) => (
                <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-2 py-1 text-center text-[11px] text-gray-400 font-medium">
                    {i + 1}
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      step="0.01"
                      value={b.wageFrom}
                      onChange={(e) => updateRow(i, "wageFrom", e.target.value)}
                      onBlur={() => blurRow(i, "wageFrom")}
                      className={bandInputCls}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      step="0.01"
                      value={b.wageTo ?? ""}
                      onChange={(e) => updateRow(i, "wageTo", e.target.value)}
                      onBlur={() => blurRow(i, "wageTo")}
                      className={bandInputCls}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      step="0.01"
                      value={b.employerAmount}
                      onChange={(e) =>
                        updateRow(i, "employerAmount", e.target.value)
                      }
                      onBlur={() => blurRow(i, "employerAmount")}
                      className={bandInputCls}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      step="0.01"
                      value={b.employeeAmount}
                      onChange={(e) =>
                        updateRow(i, "employeeAmount", e.target.value)
                      }
                      onBlur={() => blurRow(i, "employeeAmount")}
                      className={bandInputCls}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <span className="block text-center text-[11px] font-semibold text-gray-700 tabular-nums py-1.5">
                      {(
                        b.total ??
                        (Number(b.employerAmount) || 0) +
                          (Number(b.employeeAmount) || 0)
                      ).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-1 py-1 text-center">
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title={tp("common.removeRow", "Remove row")}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 mt-2">
        {canAdd && (
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--p-blue)] hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> {tp("common.addRow", "Add Row")}
          </button>
        )}
        {bands.length > 0 && (
          <>
            {canDelete && (
              <button
                type="button"
                onClick={deleteAll}
                className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> {tp("common.deleteAll", "Delete All")}
              </button>
            )}
            <span className="text-[11px] text-gray-400 ml-auto tabular-nums">
              {tp(
                "statutory.eis.bandCountSuffix",
                "{{n}} band(s) – SIP Act 800",
                { n: bands.length },
              )}
            </span>
          </>
        )}
      </div>
      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ open: false })}
      />
    </div>
  );
};

const StatutorySettings = () => {
  const { t } = useTranslation();
  const tp = (key, fallback, options) =>
    t(`settingsPage.payroll.${key}`, { defaultValue: fallback, ...options });
  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();
  const location = useLocation();
  const selectedOrg = new URLSearchParams(location.search).get("selectedOrg");
  const [year, setYear] = useState(new Date().getFullYear());
  const [formData, setFormData] = useState(getDefaultConfig());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isSeedingSocso, setIsSeedingSocso] = useState(false);
  const [isSeedingEis, setIsSeedingEis] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: "",
    message: "",
    confirmLabel: "",
    confirmTone: "primary",
    onConfirm: null,
  });
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("success");
  const [activeTab, setActiveTab] = useState("epf");

  function getDefaultConfig() {
    return {
      business: selectedOrg,
      country: "MY",
      year,
      effectiveFrom: `${year}-01-01`,
      epf: {
        enabled: true,
        employerNumber: "",
        rates: {
          partA: { employerRate: 13, employeeRate: 11, effectiveMonth: null },
          partB: { employerRate: 0, employeeRate: 0, effectiveMonth: null },
          partC: { employerRate: 4, employeeRate: 0, effectiveMonth: null },
          partD: { employerRate: 0, employeeRate: 0, effectiveMonth: null },
          partE: { employerRate: 4, employeeRate: 0, effectiveMonth: null },
        },
        useTableLookup: false,
        wageThresholdForHigherRate: 5000,
        bands: [],
      },
      socso: {
        enabled: true,
        maxInsurableWage: 6000,
        firstCategory: { employerRate: 1.75, employeeRate: 0.5 },
        secondCategory: { employerRate: 1.25, employeeRate: 0 },
        useTableLookup: false,
        bands: [],
      },
      eis: {
        enabled: true,
        maxInsurableWage: 6000,
        employerRate: 0.2,
        employeeRate: 0.2,
        useTableLookup: false,
        bands: [],
      },
      pcb: {
        enabled: true,
        nonResidentFlatRate: 30,
        residentBands: [],
        personalRelief: 9000,
        epfReliefMax: 4000,
      },
      hrdf: { enabled: false, employerRate: 1 },
    };
  }

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const { data } = await axios.get(
        `${Base_URL}/payroll/statutory-config/${selectedOrg}/${year}`,
      );
      const { _id, __v, createdAt, updatedAt, ...cleanData } = data;
      setFormData(cleanData);
    } catch {
      setFormData(getDefaultConfig());
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!canUpdate) return;
    setIsSaving(true);
    setMessage("");
    try {
      await axios.post(`${Base_URL}/payroll/statutory-config`, {
        ...formData,
        business: selectedOrg,
        year,
      });
      setMessageTone("success");
      setMessage(
        tp(
          "statutory.toast.saveSuccessInline",
          "Statutory config saved successfully!",
        ),
      );
      notifySuccess(
        tp("statutory.toast.saveSuccessNotify", "Statutory config saved"),
      );
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessageTone("error");
      setMessage(
        err.response?.data?.message ||
          tp("statutory.toast.saveFail", "Failed to save"),
      );
      notifyError(
        err.response?.data?.message ||
          tp("statutory.toast.saveFail", "Failed to save"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (selectedOrg) fetchConfig();
    else setIsLoading(false);
  }, [selectedOrg, year]);

  const closeConfirmModal = () =>
    setConfirmModal((prev) => ({ ...prev, open: false }));

  const handleSeedDefaults = () => {
    if (!canAdd) return;
    setConfirmModal({
      open: true,
      title: tp(
        "statutory.confirm.seedDefaultsTitle",
        "Seed Malaysian Defaults",
      ),
      message: tp(
        "statutory.confirm.seedDefaultsMessage",
        "This will replace the current statutory default tables for the selected organization and year where the backend seed action applies.",
      ),
      confirmLabel: tp(
        "statutory.confirm.seedDefaultsBtn",
        "Seed Defaults",
      ),
      confirmTone: "primary",
      onConfirm: async () => {
        closeConfirmModal();
        setIsSeeding(true);
        try {
          const { data } = await axios.post(
            `${Base_URL}/payroll/statutory-config/seed-defaults`,
            { business: selectedOrg, year },
          );
          notifySuccess(
            data.message ||
              tp(
                "statutory.toast.seedDefaultsSuccess",
                "Malaysian defaults seeded",
              ),
          );
          fetchConfig();
        } catch (err) {
          notifyError(
            err.response?.data?.message ||
              tp("statutory.toast.seedDefaultsFail", "Failed to seed defaults"),
          );
        } finally {
          setIsSeeding(false);
        }
      },
    });
  };

  const handleSeedSocsoBands = () => {
    if (!canAdd) return;
    setConfirmModal({
      open: true,
      title: tp("statutory.confirm.seedSocsoTitle", "Seed SOCSO Bands"),
      message: tp(
        "statutory.confirm.seedSocsoMessage",
        "This will load the official Act 4 SOCSO band table for the selected organization and year, including the row for wages above RM6,000.",
      ),
      confirmLabel: tp("statutory.confirm.seedSocsoBtn", "Seed SOCSO"),
      confirmTone: "primary",
      onConfirm: async () => {
        closeConfirmModal();
        setIsSeedingSocso(true);
        try {
          const { data } = await axios.post(
            `${Base_URL}/payroll/statutory-config/seed-socso-bands`,
            { business: selectedOrg, year },
          );
          notifySuccess(
            data.message ||
              tp("statutory.toast.seedSocsoSuccess", "SOCSO bands seeded"),
          );
          fetchConfig();
        } catch (err) {
          notifyError(
            err.response?.data?.message ||
              tp(
                "statutory.toast.seedSocsoFail",
                "Failed to seed SOCSO bands",
              ),
          );
        } finally {
          setIsSeedingSocso(false);
        }
      },
    });
  };

  const handleSeedEisBands = () => {
    if (!canAdd) return;
    setConfirmModal({
      open: true,
      title: tp("statutory.confirm.seedEisTitle", "Seed EIS Bands"),
      message: tp(
        "statutory.confirm.seedEisMessage",
        "This will load the official Act 800 EIS band table for the selected organization and year, including the row for wages above RM6,000.",
      ),
      confirmLabel: tp("statutory.confirm.seedEisBtn", "Seed EIS"),
      confirmTone: "primary",
      onConfirm: async () => {
        closeConfirmModal();
        setIsSeedingEis(true);
        try {
          const { data } = await axios.post(
            `${Base_URL}/payroll/statutory-config/seed-eis-bands`,
            { business: selectedOrg, year },
          );
          notifySuccess(
            data.message ||
              tp("statutory.toast.seedEisSuccess", "EIS bands seeded"),
          );
          fetchConfig();
        } catch (err) {
          notifyError(
            err.response?.data?.message ||
              tp("statutory.toast.seedEisFail", "Failed to seed EIS bands"),
          );
        } finally {
          setIsSeedingEis(false);
        }
      },
    });
  };

  const updateNestedField = (section, field, value) => {
    setFormData((f) => ({
      ...f,
      [section]: { ...f[section], [field]: value },
    }));
  };

  const updateEPFRate = (part, field, value) => {
    const parsed =
      value === null ? null : value === "" ? "" : parseFloat(value);
    setFormData((f) => ({
      ...f,
      epf: {
        ...f.epf,
        rates: {
          ...f.epf.rates,
          [part]: { ...f.epf.rates[part], [field]: parsed },
        },
      },
    }));
  };

  const blurEPFRate = (part, field) => {
    setFormData((f) => ({
      ...f,
      epf: {
        ...f.epf,
        rates: {
          ...f.epf.rates,
          [part]: {
            ...f.epf.rates[part],
            [field]: parseFloat(f.epf.rates[part]?.[field]) || 0,
          },
        },
      },
    }));
  };

  if (!selectedOrg) {
    return (
      <AppLayout>
        <Header />
        <div className="p-6 bg-white h-full max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-[var(--p-blue)]" />
              {tp("statutory.pageTitle", "Statutory Configuration")}
            </h1>
          </div>
          <SettingsOrgBanner />
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
            {tp(
              "statutory.selectBusinessBanner",
              "Select a business to configure statutory settings.",
            )}
          </div>
        </div>
      </AppLayout>
    );
  }

  const tabs = [
    { key: "epf", label: tp("statutory.tabs.epf", "EPF") },
    { key: "socso", label: tp("statutory.tabs.socso", "SOCSO") },
    { key: "eis", label: tp("statutory.tabs.eis", "EIS") },
    { key: "pcb", label: tp("statutory.tabs.pcb", "PCB") },
    { key: "hrdf", label: tp("statutory.tabs.hrdf", "HRDF") },
  ];

  const monthKeys = [
    ["jan", "Jan"],
    ["feb", "Feb"],
    ["mar", "Mar"],
    ["apr", "Apr"],
    ["may", "May"],
    ["jun", "Jun"],
    ["jul", "Jul"],
    ["aug", "Aug"],
    ["sep", "Sep"],
    ["oct", "Oct"],
    ["nov", "Nov"],
    ["dec", "Dec"],
  ];

  const epfCategories = [
    {
      key: "partA",
      desc: tp("statutory.epf.partADesc", "Malaysian below 60"),
    },
    {
      key: "partB",
      desc: tp("statutory.epf.partBDesc", "Non-Malaysian below 60"),
    },
    { key: "partC", desc: tp("statutory.epf.partCDesc", "PR above 60") },
    {
      key: "partD",
      desc: tp("statutory.epf.partDDesc", "Non-Malaysian above 60"),
    },
    {
      key: "partE",
      desc: tp("statutory.epf.partEDesc", "Malaysian above 60"),
    },
  ];

  const socsoCategories = [
    {
      key: "firstCategory",
      code: tp("statutory.socso.firstCatCode", "1st"),
      desc: tp(
        "statutory.socso.firstCatDesc",
        "Employment Injury + Invalidity",
      ),
    },
    {
      key: "secondCategory",
      code: tp("statutory.socso.secondCatCode", "2nd"),
      desc: tp("statutory.socso.secondCatDesc", "Employment Injury Only"),
    },
  ];

  return (
    <AppLayout>
      <Header />
      <div className="p-6 bg-white h-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-8 flex-wrap gap-3">
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-[var(--p-blue)]" />
            {tp("statutory.pageTitle", "Statutory Configuration")}
          </h1>
          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-end">
            {canAdd && (
              <button
                onClick={handleSeedDefaults}
                disabled={isSeeding}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
              >
                <Settings className="w-4 h-4" />
                {isSeeding
                  ? tp("statutory.seeding", "Seeding...")
                  : tp(
                      "statutory.seedMalaysianDefaults",
                      "Seed Malaysian Defaults",
                    )}
              </button>
            )}
            <label className="block text-sm font-medium text-gray-700 mb-0 whitespace-nowrap">
              {tp("statutory.yearLabel", "Year:")}
            </label>
            <YearPicker
              value={year}
              onChange={(yr) =>
                setYear(yr ? Number(yr) : new Date().getFullYear())
              }
              allowAll={false}
              inputClassName={`${inputCls} w-28 sm:w-40 cursor-pointer flex items-center gap-2 whitespace-nowrap select-none`}
              popupAlign="right"
            />
          </div>
        </div>
        <SettingsOrgBanner />

        {message && (
          <div
            className={`mb-4 px-4 py-3 rounded-lg text-sm ${messageTone === "success" ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}
          >
            {message}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8 text-sm text-gray-500">
            {tp("common.loading", "Loading...")}
          </div>
        ) : (
          <>
            <div className="flex gap-1 mb-6 bg-gray-100/80 p-1 rounded-xl w-fit">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === tab.key ? "bg-white text-[var(--p-blue)] shadow-sm font-semibold" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6 rounded-xl border border-gray-200/80 shadow-md font-sans text-[#303030] font-normal mb-6">
              {activeTab === "epf" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formData.epf?.enabled ?? true}
                        onChange={(e) =>
                          updateNestedField("epf", "enabled", e.target.checked)
                        }
                        className={checkboxCls}
                      />
                      {tp("statutory.epf.enabled", "EPF Enabled")}
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="block text-sm font-medium text-gray-700">
                        {tp("statutory.epf.employerRefNo", "Employer Ref No:")}
                      </label>
                      <input
                        value={formData.epf?.employerNumber || ""}
                        onChange={(e) =>
                          updateNestedField(
                            "epf",
                            "employerNumber",
                            e.target.value,
                          )
                        }
                        className={`${inlineInputCls} w-48`}
                      />
                    </div>
                  </div>
                  <h3 className="text-base font-semibold text-gray-800 mt-4">
                    {tp(
                      "statutory.epf.ratesTitle",
                      "EPF Contribution Rates (%)",
                    )}
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-gray-200/80 shadow-sm">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            {tp("statutory.table.category", "Category")}
                          </th>
                          <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            {tp("statutory.table.description", "Description")}
                          </th>
                          <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            {tp("statutory.table.employerPct", "Employer %")}
                          </th>
                          <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            {tp("statutory.table.employeePct", "Employee %")}
                          </th>
                          <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            {tp(
                              "statutory.table.effectiveMonth",
                              "Effective Month",
                            )}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {epfCategories.map((r) => (
                          <tr key={r.key} className="hover:bg-gray-50">
                            <td className="px-6 py-3 font-mono text-sm text-gray-600 uppercase">
                              {r.key}
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-600">
                              {r.desc}
                            </td>
                            <td className="px-6 py-3">
                              <input
                                type="number"
                                step="0.01"
                                value={
                                  formData.epf?.rates?.[r.key]?.employerRate ??
                                  0
                                }
                                onChange={(e) =>
                                  updateEPFRate(
                                    r.key,
                                    "employerRate",
                                    e.target.value,
                                  )
                                }
                                onBlur={() =>
                                  blurEPFRate(r.key, "employerRate")
                                }
                                className={`${inlineInputCls} w-24`}
                              />
                            </td>
                            <td className="px-6 py-3">
                              <input
                                type="number"
                                step="0.01"
                                value={
                                  formData.epf?.rates?.[r.key]?.employeeRate ??
                                  0
                                }
                                onChange={(e) =>
                                  updateEPFRate(
                                    r.key,
                                    "employeeRate",
                                    e.target.value,
                                  )
                                }
                                onBlur={() =>
                                  blurEPFRate(r.key, "employeeRate")
                                }
                                className={`${inlineInputCls} w-24`}
                              />
                            </td>
                            <td className="px-6 py-3">
                              <select
                                value={
                                  formData.epf?.rates?.[r.key]
                                    ?.effectiveMonth || ""
                                }
                                onChange={(e) =>
                                  updateEPFRate(
                                    r.key,
                                    "effectiveMonth",
                                    e.target.value
                                      ? Number(e.target.value)
                                      : null,
                                  )
                                }
                                className={`${inlineInputCls} w-32`}
                              >
                                <option value="">
                                  {tp("statutory.effectiveMonth.always", "Always")}
                                </option>
                                {monthKeys.map(([key, fallback], i) => (
                                  <option key={i + 1} value={i + 1}>
                                    {tp(`statutory.months.${key}`, fallback)}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center gap-4 mt-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formData.epf?.useTableLookup ?? false}
                        onChange={(e) =>
                          updateNestedField(
                            "epf",
                            "useTableLookup",
                            e.target.checked,
                          )
                        }
                        className={checkboxCls}
                      />
                      {tp(
                        "statutory.useBandTableLookup",
                        "Use Band Table Lookup (instead of percentage rates)",
                      )}
                    </label>
                  </div>
                  {formData.epf?.useTableLookup && (
                    <>
                      <h3 className="text-base font-semibold text-gray-800 mt-4">
                        {tp(
                          "statutory.epf.bandTableTitle",
                          "EPF Contribution Band Table (Third Schedule)",
                        )}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {tp(
                          "statutory.epf.bandTableHelper",
                          "When band table lookup is enabled, the engine matches employee wages to the band range and uses the fixed RM amounts instead of percentage rates.",
                        )}
                      </p>
                      <BandTableEditor
                        bands={formData.epf?.bands || []}
                        onChange={(bands) =>
                          updateNestedField("epf", "bands", bands)
                        }
                        canAdd={canAdd}
                        canUpdate={canUpdate}
                        canDelete={canDelete}
                      />
                    </>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="block text-sm font-medium text-gray-700">
                      {tp(
                        "statutory.epf.higherRateThreshold",
                        "Higher Rate Wage Threshold (RM):",
                      )}
                    </label>
                    <input
                      type="number"
                      value={formData.epf?.wageThresholdForHigherRate ?? 5000}
                      onChange={(e) =>
                        updateNestedField(
                          "epf",
                          "wageThresholdForHigherRate",
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                      onBlur={(e) =>
                        updateNestedField(
                          "epf",
                          "wageThresholdForHigherRate",
                          Number(e.target.value) || 5000,
                        )
                      }
                      className={`${inlineInputCls} w-28`}
                    />
                  </div>
                </div>
              )}

              {activeTab === "socso" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formData.socso?.enabled ?? true}
                        onChange={(e) =>
                          updateNestedField(
                            "socso",
                            "enabled",
                            e.target.checked,
                          )
                        }
                        className={checkboxCls}
                      />
                      {tp("statutory.socso.enabled", "SOCSO Enabled")}
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="block text-sm font-medium text-gray-700">
                        {tp(
                          "statutory.socso.maxInsurableWage",
                          "Max Insurable Wage (RM):",
                        )}
                      </label>
                      <input
                        type="number"
                        value={formData.socso?.maxInsurableWage ?? 6000}
                        onChange={(e) =>
                          updateNestedField(
                            "socso",
                            "maxInsurableWage",
                            e.target.value === "" ? "" : Number(e.target.value),
                          )
                        }
                        onBlur={(e) =>
                          updateNestedField(
                            "socso",
                            "maxInsurableWage",
                            Number(e.target.value) || 6000,
                          )
                        }
                        className={`${inlineInputCls} w-28`}
                      />
                    </div>
                  </div>

                  <h3 className="text-base font-semibold text-gray-800 mt-4">
                    {tp(
                      "statutory.socso.ratesTitle",
                      "SOCSO Contribution Rates (%)",
                    )}
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-gray-200/80 shadow-sm">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            {tp("statutory.table.category", "Category")}
                          </th>
                          <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            {tp("statutory.table.description", "Description")}
                          </th>
                          <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            {tp("statutory.table.employerPct", "Employer %")}
                          </th>
                          <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            {tp("statutory.table.employeePct", "Employee %")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {socsoCategories.map((row) => (
                          <tr key={row.key} className="hover:bg-gray-50">
                            <td className="px-6 py-3 font-mono text-sm text-gray-600 uppercase">
                              {row.code}
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-600">
                              {row.desc}
                            </td>
                            <td className="px-6 py-3">
                              <input
                                type="number"
                                step="0.01"
                                value={
                                  formData.socso?.[row.key]?.employerRate ?? 0
                                }
                                onChange={(e) =>
                                  setFormData((f) => ({
                                    ...f,
                                    socso: {
                                      ...f.socso,
                                      [row.key]: {
                                        ...f.socso[row.key],
                                        employerRate:
                                          e.target.value === ""
                                            ? ""
                                            : parseFloat(e.target.value),
                                      },
                                    },
                                  }))
                                }
                                onBlur={() =>
                                  setFormData((f) => ({
                                    ...f,
                                    socso: {
                                      ...f.socso,
                                      [row.key]: {
                                        ...f.socso[row.key],
                                        employerRate:
                                          parseFloat(
                                            f.socso?.[row.key]?.employerRate,
                                          ) || 0,
                                      },
                                    },
                                  }))
                                }
                                className={`${inlineInputCls} w-24`}
                              />
                            </td>
                            <td className="px-6 py-3">
                              <input
                                type="number"
                                step="0.01"
                                value={
                                  formData.socso?.[row.key]?.employeeRate ?? 0
                                }
                                onChange={(e) =>
                                  setFormData((f) => ({
                                    ...f,
                                    socso: {
                                      ...f.socso,
                                      [row.key]: {
                                        ...f.socso[row.key],
                                        employeeRate:
                                          e.target.value === ""
                                            ? ""
                                            : parseFloat(e.target.value),
                                      },
                                    },
                                  }))
                                }
                                onBlur={() =>
                                  setFormData((f) => ({
                                    ...f,
                                    socso: {
                                      ...f.socso,
                                      [row.key]: {
                                        ...f.socso[row.key],
                                        employeeRate:
                                          parseFloat(
                                            f.socso?.[row.key]?.employeeRate,
                                          ) || 0,
                                      },
                                    },
                                  }))
                                }
                                className={`${inlineInputCls} w-24`}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center gap-4 mt-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formData.socso?.useTableLookup ?? false}
                        onChange={(e) =>
                          updateNestedField(
                            "socso",
                            "useTableLookup",
                            e.target.checked,
                          )
                        }
                        className={checkboxCls}
                      />
                      {tp(
                        "statutory.useBandTableLookup",
                        "Use Band Table Lookup (instead of percentage rates)",
                      )}
                    </label>
                  </div>

                  {formData.socso?.useTableLookup && (
                    <>
                      <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                        <h3 className="text-base font-semibold text-gray-800">
                          {tp(
                            "statutory.socso.bandTableTitle",
                            "SOCSO Contribution Band Table (Act 4)",
                          )}
                        </h3>
                        {canAdd && (
                          <button
                            type="button"
                            onClick={handleSeedSocsoBands}
                            disabled={isSeedingSocso}
                            className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                          >
                            <Download className="w-4 h-4" />
                            {isSeedingSocso
                              ? tp("statutory.seeding", "Seeding...")
                              : tp(
                                  "statutory.btn.seedSocsoBands",
                                  "Seed SOCSO Bands (Act 4)",
                                )}
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {tp(
                          "statutory.socso.bandTableHelper",
                          "When band table lookup is enabled, the engine matches insurable wages to the official PERKESO Act 4 schedule.",
                        )}
                      </p>
                      <SocsoBandTableEditor
                        bands={formData.socso?.bands || []}
                        onChange={(bands) =>
                          updateNestedField("socso", "bands", bands)
                        }
                        canAdd={canAdd}
                        canUpdate={canUpdate}
                        canDelete={canDelete}
                      />
                    </>
                  )}
                </div>
              )}

              {activeTab === "eis" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formData.eis?.enabled ?? true}
                        onChange={(e) =>
                          updateNestedField("eis", "enabled", e.target.checked)
                        }
                        className={checkboxCls}
                      />
                      {tp("statutory.eis.enabled", "EIS Enabled")}
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="block text-sm font-medium text-gray-700">
                        {tp(
                          "statutory.eis.maxInsurableWage",
                          "Max Insurable Wage (RM):",
                        )}
                      </label>
                      <input
                        type="number"
                        value={formData.eis?.maxInsurableWage ?? 6000}
                        onChange={(e) =>
                          updateNestedField(
                            "eis",
                            "maxInsurableWage",
                            e.target.value === "" ? "" : Number(e.target.value),
                          )
                        }
                        onBlur={(e) =>
                          updateNestedField(
                            "eis",
                            "maxInsurableWage",
                            Number(e.target.value) || 6000,
                          )
                        }
                        className={`${inlineInputCls} w-28`}
                      />
                    </div>
                  </div>

                  <h3 className="text-base font-semibold text-gray-800 mt-4">
                    {tp(
                      "statutory.eis.ratesTitle",
                      "EIS Contribution Rates (%)",
                    )}
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-gray-200/80 shadow-sm">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            {tp("statutory.table.description", "Description")}
                          </th>
                          <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            {tp("statutory.table.employerPct", "Employer %")}
                          </th>
                          <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            {tp("statutory.table.employeePct", "Employee %")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        <tr className="hover:bg-gray-50">
                          <td className="px-6 py-3 text-sm text-gray-600">
                            {tp(
                              "statutory.eis.rowDesc",
                              "Employment Insurance System contributions",
                            )}
                          </td>
                          <td className="px-6 py-3">
                            <input
                              type="number"
                              step="0.01"
                              value={formData.eis?.employerRate ?? 0.2}
                              onChange={(e) =>
                                updateNestedField(
                                  "eis",
                                  "employerRate",
                                  e.target.value === ""
                                    ? ""
                                    : parseFloat(e.target.value),
                                )
                              }
                              onBlur={() =>
                                updateNestedField(
                                  "eis",
                                  "employerRate",
                                  parseFloat(formData.eis?.employerRate) || 0,
                                )
                              }
                              className={`${inlineInputCls} w-24`}
                            />
                          </td>
                          <td className="px-6 py-3">
                            <input
                              type="number"
                              step="0.01"
                              value={formData.eis?.employeeRate ?? 0.2}
                              onChange={(e) =>
                                updateNestedField(
                                  "eis",
                                  "employeeRate",
                                  e.target.value === ""
                                    ? ""
                                    : parseFloat(e.target.value),
                                )
                              }
                              onBlur={() =>
                                updateNestedField(
                                  "eis",
                                  "employeeRate",
                                  parseFloat(formData.eis?.employeeRate) || 0,
                                )
                              }
                              className={`${inlineInputCls} w-24`}
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center gap-4 mt-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formData.eis?.useTableLookup ?? false}
                        onChange={(e) =>
                          updateNestedField(
                            "eis",
                            "useTableLookup",
                            e.target.checked,
                          )
                        }
                        className={checkboxCls}
                      />
                      {tp(
                        "statutory.useBandTableLookup",
                        "Use Band Table Lookup (instead of percentage rates)",
                      )}
                    </label>
                  </div>

                  {formData.eis?.useTableLookup && (
                    <>
                      <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                        <h3 className="text-base font-semibold text-gray-800">
                          {tp(
                            "statutory.eis.bandTableTitle",
                            "EIS Contribution Band Table (Act 800)",
                          )}
                        </h3>
                        {canAdd && (
                          <button
                            type="button"
                            onClick={handleSeedEisBands}
                            disabled={isSeedingEis}
                            className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                          >
                            <Download className="w-4 h-4" />
                            {isSeedingEis
                              ? tp("statutory.seeding", "Seeding...")
                              : tp(
                                  "statutory.btn.seedEisBands",
                                  "Seed EIS Bands (Act 800)",
                                )}
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {tp(
                          "statutory.eis.bandTableHelper",
                          "When band table lookup is enabled, the engine matches insurable wages to the official SIP Act 800 schedule.",
                        )}
                      </p>
                      <EisBandTableEditor
                        bands={formData.eis?.bands || []}
                        onChange={(bands) =>
                          updateNestedField("eis", "bands", bands)
                        }
                        canAdd={canAdd}
                        canUpdate={canUpdate}
                        canDelete={canDelete}
                      />
                    </>
                  )}
                </div>
              )}

              {activeTab === "pcb" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formData.pcb?.enabled ?? true}
                        onChange={(e) =>
                          updateNestedField("pcb", "enabled", e.target.checked)
                        }
                        className={checkboxCls}
                      />
                      {tp("statutory.pcb.enabled", "PCB Enabled")}
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="block text-sm font-medium text-gray-700">
                        {tp(
                          "statutory.pcb.employerTaxNo",
                          "Employer Tax No (LHDN/CP39):",
                        )}
                      </label>
                      <input
                        value={formData.pcb?.employerTaxNumber || ""}
                        onChange={(e) =>
                          updateNestedField(
                            "pcb",
                            "employerTaxNumber",
                            e.target.value,
                          )
                        }
                        className={`${inlineInputCls} w-48`}
                        placeholder={tp(
                          "statutory.pcb.employerTaxPlaceholder",
                          "e.g. C1234567890",
                        )}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {tp(
                          "statutory.pcb.nonResidentFlatRate",
                          "Non-Resident Flat Rate %",
                        )}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.pcb?.nonResidentFlatRate ?? 30}
                        onChange={(e) =>
                          updateNestedField(
                            "pcb",
                            "nonResidentFlatRate",
                            e.target.value === ""
                              ? ""
                              : parseFloat(e.target.value),
                          )
                        }
                        onBlur={(e) =>
                          updateNestedField(
                            "pcb",
                            "nonResidentFlatRate",
                            parseFloat(e.target.value) || 30,
                          )
                        }
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {tp(
                          "statutory.pcb.personalRelief",
                          "Personal Relief (RM)",
                        )}
                      </label>
                      <input
                        type="number"
                        value={formData.pcb?.personalRelief ?? 9000}
                        onChange={(e) =>
                          updateNestedField(
                            "pcb",
                            "personalRelief",
                            e.target.value === "" ? "" : Number(e.target.value),
                          )
                        }
                        onBlur={(e) =>
                          updateNestedField(
                            "pcb",
                            "personalRelief",
                            Number(e.target.value) || 9000,
                          )
                        }
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {tp(
                          "statutory.pcb.epfReliefMax",
                          "EPF Relief Max (RM)",
                        )}
                      </label>
                      <input
                        type="number"
                        value={formData.pcb?.epfReliefMax ?? 4000}
                        onChange={(e) =>
                          updateNestedField(
                            "pcb",
                            "epfReliefMax",
                            e.target.value === "" ? "" : Number(e.target.value),
                          )
                        }
                        onBlur={(e) =>
                          updateNestedField(
                            "pcb",
                            "epfReliefMax",
                            Number(e.target.value) || 4000,
                          )
                        }
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "hrdf" && (
                <div className="space-y-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.hrdf?.enabled ?? false}
                      onChange={(e) =>
                        updateNestedField("hrdf", "enabled", e.target.checked)
                      }
                      className={checkboxCls}
                    />
                    {tp("statutory.hrdf.enabled", "HRDF Enabled")}
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="block text-sm font-medium text-gray-700">
                      {tp("statutory.hrdf.employerRate", "Employer Rate %")}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.hrdf?.employerRate ?? 1}
                      onChange={(e) =>
                        updateNestedField(
                          "hrdf",
                          "employerRate",
                          e.target.value === ""
                            ? ""
                            : parseFloat(e.target.value),
                        )
                      }
                      onBlur={(e) =>
                        updateNestedField(
                          "hrdf",
                          "employerRate",
                          parseFloat(e.target.value) || 1,
                        )
                      }
                      className={`${inlineInputCls} w-24`}
                    />
                  </div>
                </div>
              )}
            </div>

            {canUpdate && (
              <div className="flex justify-end items-center mt-6 space-x-4">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
                  style={{ backgroundColor: "var(--p-blue)" }}
                >
                  <Save className="w-4 h-4" />
                  {isSaving
                    ? tp("statutory.saving", "Saving...")
                    : tp(
                        "statutory.saveStatutoryConfig",
                        "Save Statutory Config",
                      )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel || tp("common.confirm", "Confirm")}
        confirmTone={confirmModal.confirmTone}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirmModal}
      />
    </AppLayout>
  );
};

export default StatutorySettings;
