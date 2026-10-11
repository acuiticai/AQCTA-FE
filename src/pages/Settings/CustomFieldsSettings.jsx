import React, { useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AdminContext } from "@/context/AdminContext";
import DropdownBasic from "@/page-layouts/components/DropdownBasic";
import Header from "@/components/header/Header";
import AppLayout from "@/pages/Settings/app-layout";
import { notifyError, notifySuccess } from "@/utils/toast";
import {
  CUSTOM_FIELD_DATA_TYPES,
  CUSTOM_FIELD_LOOKUP_TARGETS,
  CUSTOM_FIELD_MODULES,
  CUSTOM_FIELD_MODULE_LABELS,
  CUSTOM_FIELD_SCREENS_BY_MODULE,
  MODULE_SCREEN_DEFAULTS,
  getCustomFieldScreenLabel,
  CUSTOMER_FIELD_TRANSACTION_OPTIONS_BY_MODULE,
} from "@/utils/customFieldConstants";
import {
  fetchGroupedModulesForUser,
  getMappableSubsForParent,
  listParentsWithCustomFieldSubs,
} from "@/utils/customFieldDynamicScope";
import {
  createDefinition,
  deleteDefinition,
  fetchDefinitions,
  updateDefinition,
} from "@/services/customFieldServices";
import SettingsOrgBanner from "@/pages/Settings/SettingsOrgBanner";
import FieldHelpHint from "@/components/custom-fields/FieldHelpHint";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";
import { Trash2, Plus, Pencil, X, Eye, Layers } from "lucide-react";

function placeholderSupportsType(dataType) {
  return [
    "single_line_text",
    "multi_line_text",
    "email",
    "url",
    "phone",
    "number",
    "decimal",
    "currency",
    "percentage",
    "date",
    "datetime",
    "dropdown",
    "formula",
    "lookup",
  ].includes(dataType);
}

function dataTypeSetupHint(t, dataType) {
  const hints = {
    single_line_text: t(
      "settingsPage.customFields.dataTypeHelp.single_line_text",
      "Optional placeholder text appears inside the input. Help text shows in the (?) tooltip.",
    ),
    multi_line_text: t(
      "settingsPage.customFields.dataTypeHelp.multi_line_text",
      "Long text; default can be multiple lines.",
    ),
    email: t("settingsPage.customFields.dataTypeHelp.email", "Validates email format on save."),
    url: t("settingsPage.customFields.dataTypeHelp.url", "Must start with http:// or https://"),
    phone: t("settingsPage.customFields.dataTypeHelp.phone", "Optional placeholder (e.g. +60 …)."),
    number: t(
      "settingsPage.customFields.dataTypeHelp.number",
      "Whole numbers; set a numeric default below.",
    ),
    decimal: t(
      "settingsPage.customFields.dataTypeHelp.decimal",
      "Decimals allowed; set default below.",
    ),
    currency: t(
      "settingsPage.customFields.dataTypeHelp.currency",
      "Numeric amount; currency symbol is usually in the main form.",
    ),
    percentage: t(
      "settingsPage.customFields.dataTypeHelp.percentage",
      "Numeric (e.g. 10 for 10%).",
    ),
    date: t("settingsPage.customFields.dataTypeHelp.date", "Default uses the date picker format."),
    datetime: t(
      "settingsPage.customFields.dataTypeHelp.datetime",
      "Default uses datetime-local format.",
    ),
    checkbox: t("settingsPage.customFields.dataTypeHelp.checkbox", "Default = checked or not."),
    auto_number: t(
      "settingsPage.customFields.dataTypeHelp.auto_number",
      "Prefix here; next number is assigned when a record is saved.",
    ),
    dropdown: t(
      "settingsPage.customFields.dataTypeHelp.dropdown",
      "Add options in the picklist below (Zoho-style).",
    ),
    multi_select: t(
      "settingsPage.customFields.dataTypeHelp.multi_select",
      "Add options below; users can tick multiple.",
    ),
    lookup: t(
      "settingsPage.customFields.dataTypeHelp.lookup",
      "Users enter / pick a linked record id on the form.",
    ),
    external_lookup: t(
      "settingsPage.customFields.dataTypeHelp.external_lookup",
      "Configure API URL and JSON paths below.",
    ),
    file: t(
      "settingsPage.customFields.dataTypeHelp.file",
      "On orders/invoices, users upload a file; value stored as URL.",
    ),
    image: t(
      "settingsPage.customFields.dataTypeHelp.image",
      "On forms, users upload an image; value stored as URL.",
    ),
    formula: t(
      "settingsPage.customFields.dataTypeHelp.formula",
      "Store an expression; evaluated or filled manually on the client.",
    ),
  };
  return hints[dataType] || "";
}

const DATA_TYPE_LABEL_FALLBACKS = {
  single_line_text: "Single line text",
  multi_line_text: "Multi-line text",
  email: "Email",
  url: "URL",
  phone: "Phone",
  number: "Number",
  decimal: "Decimal",
  currency: "Currency",
  percentage: "Percentage",
  date: "Date",
  datetime: "Date & time",
  checkbox: "Checkbox",
  auto_number: "Auto number",
  dropdown: "Dropdown",
  multi_select: "Multi-select",
  lookup: "Lookup",
  external_lookup: "External lookup",
  file: "File",
  image: "Image",
  formula: "Formula",
};

function dataTypeLabel(t, dataType) {
  return t(
    `settingsPage.customFields.dataTypes.${dataType}`,
    DATA_TYPE_LABEL_FALLBACKS[dataType] || dataType,
  );
}

function moduleLabel(t, module) {
  return t(
    `settingsPage.customFields.modules.${module}`,
    CUSTOM_FIELD_MODULE_LABELS[module] || module,
  );
}

function screenLabel(t, module, screen) {
  return t(
    `settingsPage.customFields.screens.${module}_${screen}`,
    getCustomFieldScreenLabel(module, screen),
  );
}

function lookupTargetLabel(t, target) {
  return t(
    `settingsPage.customFields.lookupTargets.${target.module}_${target.screen}`,
    target.label,
  );
}

function transactionOptionLabel(t, opt) {
  return t(
    `settingsPage.customFields.transactionOptions.${String(opt.value).replace(":", "_")}`,
    opt.label,
  );
}

function CustomFieldFormPreview({ form }) {
  const { t } = useTranslation();
  const labelText =
    form.label?.trim() || t("settingsPage.customFields.fieldLabelFallback", "Field label");
  const req = form.is_required ? (
    <span className="text-red-500 ml-0.5">*</span>
  ) : null;
  const baseInput =
    "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-600 pointer-events-none select-none shadow-inner";
  const opts = (form.optionsList || [])
    .map((s) => String(s).trim())
    .filter(Boolean);
  const defStr =
    form.default_value === null || form.default_value === undefined
      ? ""
      : Array.isArray(form.default_value)
        ? form.default_value.join(", ")
        : String(form.default_value);

  let body;
  switch (form.data_type) {
    case "checkbox":
      body = (
        <label className="inline-flex items-center gap-2 text-sm text-gray-800">
          <input type="checkbox" disabled checked={!!form.default_value} className="rounded border-gray-300" />
          <span>
            {labelText}
            {req}
          </span>
        </label>
      );
      break;
    case "multi_line_text":
    case "formula":
      body = (
        <div>
          <span className="block text-sm font-medium text-gray-800 mb-1">
            {labelText}
            {req}
          </span>
          <textarea
            readOnly
            rows={2}
            value={defStr}
            placeholder={
              form.input_format?.trim() ||
              t("settingsPage.customFields.longTextPlaceholder", "Long text…")
            }
            className={`${baseInput} resize-none min-h-[3rem]`}
          />
        </div>
      );
      break;
    case "dropdown":
      body = (
        <div>
          <span className="block text-sm font-medium text-gray-800 mb-1">
            {labelText}
            {req}
          </span>
          <div className={baseInput}>
            {opts[0] || t("settingsPage.customFields.selectPlaceholder", "— Select —")}
          </div>
        </div>
      );
      break;
    case "multi_select":
      body = (
        <div>
          <span className="block text-sm font-medium text-gray-800 mb-1">
            {labelText}
            {req}
          </span>
          <div className="flex flex-wrap gap-2 text-xs text-gray-600">
            {(opts.length
              ? opts
              : [
                  t("settingsPage.customFields.multiSelectOption1", "Option 1"),
                  t("settingsPage.customFields.multiSelectOption2", "Option 2"),
                ]
            ).map((o) => (
              <span
                key={o}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 border border-gray-200"
              >
                <span className="w-3 h-3 rounded border border-gray-300 bg-white" />
                {o}
              </span>
            ))}
          </div>
        </div>
      );
      break;
    case "date":
    case "datetime":
      body = (
        <div>
          <span className="block text-sm font-medium text-gray-800 mb-1">
            {labelText}
            {req}
          </span>
          <div className={baseInput}>
            {form.data_type === "datetime" ? "YYYY-MM-DD HH:mm" : "YYYY-MM-DD"}
          </div>
        </div>
      );
      break;
    case "number":
    case "decimal":
    case "currency":
    case "percentage":
      body = (
        <div>
          <span className="block text-sm font-medium text-gray-800 mb-1">
            {labelText}
            {req}
          </span>
          <div className={baseInput}>{defStr || "0"}</div>
        </div>
      );
      break;
    case "auto_number":
      body = (
        <div>
          <span className="block text-sm font-medium text-gray-800 mb-1">
            {labelText}
            {req}
          </span>
          <div className={`${baseInput} bg-gray-50`}>
            {(form.auto_number_prefix || "") + "…"}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            {t("settingsPage.customFields.assignedWhenSaved", "Assigned when saved")}
          </p>
        </div>
      );
      break;
    case "lookup":
      body = (
        <div>
          <span className="block text-sm font-medium text-gray-800 mb-1">
            {labelText}
            {req}
          </span>
          <div className={baseInput}>
            {t("settingsPage.customFields.linkedRecordPlaceholder", "Linked record…")}
          </div>
        </div>
      );
      break;
    case "external_lookup":
      body = (
        <div>
          <span className="block text-sm font-medium text-gray-800 mb-1">
            {labelText}
            {req}
          </span>
          <div className={baseInput}>
            {t("settingsPage.customFields.externalValuePlaceholder", "External value…")}
          </div>
        </div>
      );
      break;
    case "file":
    case "image":
      body = (
        <div>
          <span className="block text-sm font-medium text-gray-800 mb-1">
            {labelText}
            {req}
          </span>
          <div className="text-xs text-gray-500 border border-dashed border-gray-300 rounded-lg px-3 py-4 text-center bg-white">
            {form.data_type === "image"
              ? t("settingsPage.customFields.imageUpload", "Image upload")
              : t("settingsPage.customFields.fileUpload", "File upload")}
          </div>
        </div>
      );
      break;
    default:
      body = (
        <div>
          <span className="block text-sm font-medium text-gray-800 mb-1">
            {labelText}
            {req}
          </span>
          <div className={baseInput}>
            {defStr || "—"}
          </div>
        </div>
      );
  }

  return (
    <div className="rounded-xl border border-orange-100 bg-gradient-to-b from-orange-50/50 to-white p-4 shadow-sm ring-1 ring-orange-100/70">
      <div className="flex items-center gap-2 text-[var(--p-blue-dark2)] mb-3">
        <Eye className="w-4 h-4 shrink-0 opacity-80" />
        <span className="text-xs font-semibold uppercase tracking-wide">
          {t("settingsPage.customFields.preview", "Preview")}
        </span>
      </div>
      <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
        {body}
        {form.help_text?.trim() ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <span>{t("settingsPage.customFields.helpTooltipLabel", "Help (tooltip):")}</span>
            <FieldHelpHint text={form.help_text} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

const emptyForm = () => ({
  label: "",
  data_type: "single_line_text",
  is_required: false,
  is_unique: false,
  show_in_pdf: false,
  show_in_datatable: false,
  default_value: "",
  help_text: "",
  data_privacy: "none",
  input_format: "",
  position: 0,
  optionsList: [""],
  lookup_module: "",
  lookup_screen: "",
  external_url: "",
  external_valuePath: "",
  external_labelPath: "",
  formula_expression: "",
  auto_number_prefix: "",
  show_in_transactions: false,
  transaction_targets: [],
});

function DeleteConfirmationModal({ isOpen, onClose, onConfirm, description }) {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg p-6 w-[350px] max-w-[90%]">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {t("settingsPage.customFields.deleteConfirmTitle", "Are you sure?")}
        </h2>
        <p className="text-sm text-gray-600">{description}</p>

        <div className="flex justify-end mt-6 space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors"
          >
            {t("settingsPage.customFields.cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            {t("settingsPage.customFields.delete", "Delete")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CustomFieldsSettings({ embedded = false }) {
  const { t } = useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const location = useLocation();
  const { canAdd: allowAdd, canUpdate: allowUpdate, canDelete: allowDelete } =
    useSettingsCrudPermissions();
  const showRowActions = allowUpdate || allowDelete;
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const selectedOrg = useMemo(() => {
    const q = new URLSearchParams(location.search);
    return q.get("selectedOrg") || "";
  }, [location.search]);

  const [module, setModule] = useState("sales");
  const [screen, setScreen] = useState(MODULE_SCREEN_DEFAULTS.sales);
  const showVendorInvoiceListColumn =
    module === "purchase" && screen === "vendor_invoice";
  const [groupedModules, setGroupedModules] = useState([]);
  const [selectedParentId, setSelectedParentId] = useState("");
  const [selectedSubId, setSelectedSubId] = useState("");
  const [scopeLoading, setScopeLoading] = useState(true);
  const [scopeListSource, setScopeListSource] = useState("pending");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(() => emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteFieldId, setDeleteFieldId] = useState(null);
  const [deleteFieldLabel, setDeleteFieldLabel] = useState("");

  const ensurePicklistOptions = (list) =>
    Array.isArray(list) && list.length ? [...list] : [""];

  const setOptionAt = (index, value) => {
    setForm((prev) => {
      const next = [...(prev.optionsList || [""])];
      next[index] = value;
      return { ...prev, optionsList: next };
    });
  };

  const addOptionRow = () => {
    setForm((prev) => ({
      ...prev,
      optionsList: [...ensurePicklistOptions(prev.optionsList), ""],
    }));
  };

  const removeOptionRow = (index) => {
    setForm((prev) => {
      const cur = ensurePicklistOptions(prev.optionsList);
      if (cur.length <= 1) return { ...prev, optionsList: [""] };
      cur.splice(index, 1);
      return { ...prev, optionsList: cur.length ? cur : [""] };
    });
  };

  useEffect(() => {
    if (!adminInfo?.id || !adminInfo?.token) {
      setScopeLoading(false);
      setGroupedModules([]);
      setScopeListSource("fallback");
      setModule("sales");
      setScreen(MODULE_SCREEN_DEFAULTS.sales);
      setSelectedParentId("");
      setSelectedSubId("");
      return;
    }
    let cancelled = false;
    (async () => {
      setScopeLoading(true);
      try {
        const grouped = await fetchGroupedModulesForUser(adminInfo, headers);
        if (cancelled) return;
        const parents = listParentsWithCustomFieldSubs(grouped);
        if (parents.length) {
          setGroupedModules(grouped);
          setScopeListSource("dynamic");
          const p0 = parents[0];
          const subs = getMappableSubsForParent(p0);
          const s0 = subs[0];
          setSelectedParentId(String(p0._id));
          setSelectedSubId(String(s0._id));
          setModule(s0.module);
          setScreen(s0.screen);
        } else {
          setGroupedModules([]);
          setScopeListSource("fallback");
          setSelectedParentId("");
          setSelectedSubId("");
          setModule("sales");
          setScreen(MODULE_SCREEN_DEFAULTS.sales);
        }
      } catch (e) {
        if (!cancelled) {
          setGroupedModules([]);
          setScopeListSource("fallback");
          setSelectedParentId("");
          setSelectedSubId("");
          setModule("sales");
          setScreen(MODULE_SCREEN_DEFAULTS.sales);
          notifyError(
            e?.response?.data?.message ||
              t(
                "settingsPage.customFields.toast.couldNotLoadModuleAccess",
                "Could not load module access; using built-in module list.",
              ),
          );
        }
      } finally {
        if (!cancelled) setScopeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminInfo?.id, adminInfo?.token, adminInfo?.role?.isSuperAdmin]);

  const parentsWithSubs = useMemo(
    () => listParentsWithCustomFieldSubs(groupedModules),
    [groupedModules],
  );

  const selectedParent = useMemo(
    () =>
      parentsWithSubs.find((p) => String(p._id) === String(selectedParentId)),
    [parentsWithSubs, selectedParentId],
  );

  const mappableSubs = useMemo(
    () => (selectedParent ? getMappableSubsForParent(selectedParent) : []),
    [selectedParent],
  );

  const selectedSubMeta = useMemo(
    () => mappableSubs.find((s) => String(s._id) === String(selectedSubId)),
    [mappableSubs, selectedSubId],
  );

  const staticScreenOptions = useMemo(
    () =>
      (CUSTOM_FIELD_SCREENS_BY_MODULE[module] || []).map((o) => ({
        ...o,
        label: screenLabel(t, module, o.value),
      })),
    [module, t],
  );

  const parentScopeOptions = useMemo(
    () =>
      parentsWithSubs.map((p) => ({
        value: String(p._id),
        label:
          String(p.name || "").trim() ||
          t("settingsPage.customFields.module", "Module"),
      })),
    [parentsWithSubs, t],
  );

  const subScopeOptions = useMemo(
    () =>
      mappableSubs.map((s) => ({
        value: String(s._id),
        label: s.name,
      })),
    [mappableSubs],
  );

  const fallbackModuleOptions = useMemo(
    () =>
      CUSTOM_FIELD_MODULES.map((m) => ({
        value: m,
        label: moduleLabel(t, m),
      })),
    [t],
  );

  const load = async () => {
    if (!selectedOrg) return;
    setLoading(true);
    try {
      const data = await fetchDefinitions(
        {
          businessId: selectedOrg,
          module,
          screen,
          includeInactive: true,
        },
        headers,
      );
      setRows(data);
    } catch (e) {
      notifyError(
        e?.response?.data?.message ||
          t("settingsPage.customFields.toast.failedToLoadFields", "Failed to load fields"),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [selectedOrg, module, screen]);

  const openCreate = () => {
    if (!allowAdd) {
      notifyError(
        t(
          "settingsPage.customFields.toast.noPermissionAdd",
          "You do not have permission to add custom fields.",
        ),
      );
      return;
    }
    setEditingId(null);
    setForm({ ...emptyForm(), position: rows.length });
    setFormOpen(true);
  };

  const openEdit = (r) => {
    if (!allowUpdate) {
      notifyError(
        t(
          "settingsPage.customFields.toast.noPermissionEdit",
          "You do not have permission to edit custom fields.",
        ),
      );
      return;
    }
    setEditingId(r._id);
    const dv = r.default_value;
    let defaultForForm = "";
    if (r.data_type === "checkbox") {
      defaultForForm = !!dv;
    } else if (r.data_type === "multi_select" && Array.isArray(dv)) {
      defaultForForm = dv.join(", ");
    } else if (dv !== null && dv !== undefined) {
      defaultForForm = String(dv);
    }
    setForm({
      ...emptyForm(),
      label: r.label,
      data_type: r.data_type,
      is_required: !!r.is_required,
      is_unique: !!r.is_unique,
      show_in_pdf: !!r.show_in_pdf,
      show_in_datatable: !!r.show_in_datatable,
      default_value: defaultForForm,
      help_text: r.help_text || "",
      data_privacy: r.data_privacy || "none",
      input_format: r.input_format || "",
      position: r.position ?? 0,
      optionsList: ensurePicklistOptions(r.options),
      lookup_module: r.lookup_module || "",
      lookup_screen: r.lookup_screen || "",
      external_url: r.external_lookup_config?.url || "",
      external_valuePath: r.external_lookup_config?.valuePath || "",
      external_labelPath: r.external_lookup_config?.labelPath || "",
      formula_expression: r.formula_expression || "",
      auto_number_prefix: r.auto_number_prefix || "",
      show_in_transactions: !!r.show_in_transactions,
      transaction_targets: Array.isArray(r.transaction_targets)
        ? [...r.transaction_targets]
        : [],
    });
    setFormOpen(true);
  };

  const saveField = async () => {
    if (editingId ? !allowUpdate : !allowAdd) {
      notifyError(
        editingId
          ? t(
              "settingsPage.customFields.toast.noPermissionUpdate",
              "You do not have permission to update custom fields.",
            )
          : t(
              "settingsPage.customFields.toast.noPermissionAdd",
              "You do not have permission to add custom fields.",
            ),
      );
      return;
    }
    if (!selectedOrg) {
      notifyError(
        t(
          "settingsPage.customFields.toast.selectBusinessFirst",
          "Select a business from Settings first",
        ),
      );
      return;
    }
    if (!form.label?.trim()) {
      notifyError(t("settingsPage.customFields.toast.labelRequired", "Label is required"));
      return;
    }
    const options = (form.optionsList || [])
      .map((s) => String(s).trim())
      .filter(Boolean);
    if (
      (form.data_type === "dropdown" || form.data_type === "multi_select") &&
      options.length === 0
    ) {
      notifyError(
        t(
          "settingsPage.customFields.toast.addAtLeastOneOption",
          "Add at least one option for dropdown / multi-select",
        ),
      );
      return;
    }
    let defaultVal = form.default_value;
    if (form.data_type === "checkbox") {
      defaultVal = !!form.default_value;
    } else if (form.data_type === "number" || form.data_type === "decimal") {
      if (form.default_value === "" || form.default_value === undefined) {
        defaultVal = null;
      } else {
        const n = Number(form.default_value);
        defaultVal = Number.isFinite(n) ? n : null;
      }
    } else if (
      form.data_type === "multi_select" &&
      typeof form.default_value === "string" &&
      form.default_value.trim()
    ) {
      defaultVal = form.default_value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (
      defaultVal === "" ||
      defaultVal === undefined ||
      defaultVal === null
    ) {
      defaultVal = null;
    }
    const bodyBase = {
      label: form.label.trim(),
      data_type: form.data_type,
      is_required: form.is_required,
      is_unique: form.is_unique,
      show_in_pdf: form.show_in_pdf,
      default_value: defaultVal,
      help_text: form.help_text,
      data_privacy: form.data_privacy,
      input_format: form.input_format,
      position: Number(form.position) || 0,
      options:
        form.data_type === "dropdown" || form.data_type === "multi_select"
          ? options
          : [],
      lookup_module:
        form.data_type === "lookup" ? form.lookup_module : "",
      lookup_screen:
        form.data_type === "lookup" ? form.lookup_screen : "",
      external_lookup_config:
        form.data_type === "external_lookup"
          ? {
              url: form.external_url,
              valuePath: form.external_valuePath,
              labelPath: form.external_labelPath,
            }
          : {},
      formula_expression:
        form.data_type === "formula" ? form.formula_expression : "",
      auto_number_prefix:
        form.data_type === "auto_number" ? form.auto_number_prefix : "",
    };

    if (module === "purchase" && screen === "vendor_invoice") {
      bodyBase.show_in_datatable = !!form.show_in_datatable;
    }

    if (module === "inventory" && screen === "item") {
      bodyBase.show_in_transactions = !!form.show_in_transactions;
      bodyBase.transaction_targets =
        form.show_in_transactions && Array.isArray(form.transaction_targets)
          ? form.transaction_targets.filter(Boolean)
          : [];
    }

    try {
      if (editingId) {
        await updateDefinition(
          editingId,
          { business_id: selectedOrg, ...bodyBase },
          headers,
        );
        notifySuccess(t("settingsPage.customFields.toast.fieldUpdated", "Field updated"));
      } else {
        await createDefinition(
          {
            business_id: selectedOrg,
            module,
            screen,
            ...bodyBase,
          },
          headers,
        );
        notifySuccess(t("settingsPage.customFields.toast.fieldCreated", "Field created"));
      }
      setFormOpen(false);
      load();
    } catch (e) {
      notifyError(
        e?.response?.data?.message ||
          t("settingsPage.customFields.toast.saveFailed", "Save failed"),
      );
    }
  };

  const openDeleteField = (r) => {
    if (!allowDelete) {
      notifyError(
        t(
          "settingsPage.customFields.toast.noPermissionDelete",
          "You do not have permission to delete custom fields.",
        ),
      );
      return;
    }
    setDeleteFieldId(r._id);
    setDeleteFieldLabel(
      String(r.label || "").trim() ||
        t("settingsPage.customFields.thisField", "this field"),
    );
    setDeleteModalOpen(true);
  };

  const confirmDeleteField = async () => {
    if (!allowDelete) {
      notifyError(
        t(
          "settingsPage.customFields.toast.noPermissionDelete",
          "You do not have permission to delete custom fields.",
        ),
      );
      setDeleteModalOpen(false);
      return;
    }
    if (!deleteFieldId || !selectedOrg) {
      setDeleteModalOpen(false);
      return;
    }
    try {
      await deleteDefinition(deleteFieldId, selectedOrg, headers);
      notifySuccess(t("settingsPage.customFields.toast.deleted", "Deleted"));
      setDeleteModalOpen(false);
      setDeleteFieldId(null);
      setDeleteFieldLabel("");
      load();
    } catch (e) {
      notifyError(
        e?.response?.data?.message ||
          t("settingsPage.customFields.toast.deleteFailed", "Delete failed"),
      );
    }
  };

  const toggleActive = async (r) => {
    if (!allowUpdate) {
      notifyError(
        t(
          "settingsPage.customFields.toast.noPermissionUpdate",
          "You do not have permission to update custom fields.",
        ),
      );
      return;
    }
    try {
      await updateDefinition(
        r._id,
        { business_id: selectedOrg, is_active: !r.is_active },
        headers,
      );
      load();
    } catch (e) {
      notifyError(
        e?.response?.data?.message ||
          t("settingsPage.customFields.toast.updateFailed", "Update failed"),
      );
    }
  };

  const dataTypeHint = dataTypeSetupHint(t, form.data_type);
  const contextSubtitle =
    scopeListSource === "dynamic" && selectedParent && selectedSubMeta
      ? `${String(selectedParent.name || "").trim()} › ${selectedSubMeta.name}`
      : `${moduleLabel(t, module)} › ${screenLabel(t, module, screen)}`;

  const scopeReady =
    scopeListSource === "fallback"
      ? !scopeLoading
      : !scopeLoading &&
        parentsWithSubs.length > 0 &&
        !!selectedParent &&
        mappableSubs.length > 0;

  const shellClass = embedded
    ? "bg-white max-h-[90vh] overflow-y-auto overflow-x-hidden"
    : "p-6 bg-white h-full max-h-[90vh] overflow-y-auto overflow-x-hidden";

  const body = (
    <>
      <div className={shellClass}>
          {!embedded ? (
            <>
          <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[var(--p-blue)] mb-1">
                <Layers className="w-5 h-5" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {t("settingsPage.customFields.kicker", "Settings")}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                {t("settingsPage.customFields.pageTitle", "Custom fields")}
              </h1>
              <p className="text-sm text-gray-600 mt-1 max-w-xl">
                {t(
                  "settingsPage.customFields.pageDescription",
                  "Choose a module from your access, then a submodule (e.g. Item, Category, Stock). Same source as roles: your dynamic modules, or the full module tree for super admin.",
                )}
              </p>
            </div>
          </div>

          <SettingsOrgBanner />
            </>
          ) : null}

          {!selectedOrg ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-lg text-sm mb-6">
              {embedded
                ? t(
                    "settingsPage.customFields.selectBusinessEmbedded",
                    "Select a business above (URL must include ",
                  )
                : t(
                    "settingsPage.customFields.selectBusinessStandalone",
                    "Open Settings, choose a business, then open Custom fields from the sidebar (URL must include ",
                  )}
              <code className="bg-amber-100 px-1">?selectedOrg=...</code>
              {t("settingsPage.customFields.urlParamClose", ").")}
            </div>
          ) : null}

          <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm p-5 mb-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              {t("settingsPage.customFields.scope", "Scope")}
            </p>
            <div className="flex flex-wrap gap-5 items-end">
              {scopeListSource === "dynamic" && !scopeLoading ? (
                <>
                  <div className="min-w-[200px] flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      {t("settingsPage.customFields.module", "Module")}
                    </label>
                    <div className="bg-white rounded-lg">
                      <DropdownBasic
                        className="w-full"
                        width="100%"
                        options={parentScopeOptions}
                        value={
                          parentsWithSubs.some(
                            (p) => String(p._id) === String(selectedParentId),
                          )
                            ? String(selectedParentId)
                            : ""
                        }
                        onChange={(pid) => {
                          const p = parentsWithSubs.find(
                            (x) => String(x._id) === String(pid),
                          );
                          if (!p) return;
                          const subs = getMappableSubsForParent(p);
                          const s0 = subs[0];
                          if (!s0) return;
                          setSelectedParentId(String(p._id));
                          setSelectedSubId(String(s0._id));
                          setModule(s0.module);
                          setScreen(s0.screen);
                        }}
                        placeholder={t("settingsPage.customFields.noModules", "No modules")}
                        isDisabled={!parentsWithSubs.length}
                        isClearable={false}
                        sortOptions={false}
                      />
                    </div>
                  </div>
                  <div className="min-w-[200px] flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      {t("settingsPage.customFields.submodule", "Submodule")}
                    </label>
                    <div className="bg-white rounded-lg">
                      <DropdownBasic
                        className="w-full"
                        width="100%"
                        options={subScopeOptions}
                        value={
                          mappableSubs.some(
                            (s) => String(s._id) === String(selectedSubId),
                          )
                            ? String(selectedSubId)
                            : ""
                        }
                        onChange={(sid) => {
                          const row = mappableSubs.find(
                            (s) => String(s._id) === String(sid),
                          );
                          if (!row) return;
                          setSelectedSubId(String(row._id));
                          setModule(row.module);
                          setScreen(row.screen);
                        }}
                        placeholder={t(
                          "settingsPage.customFields.noSubmodules",
                          "No submodules",
                        )}
                        isDisabled={!mappableSubs.length}
                        isClearable={false}
                        sortOptions={false}
                      />
                    </div>
                  </div>
                </>
              ) : null}

              {scopeListSource === "fallback" && !scopeLoading ? (
                <>
                  <div className="min-w-[200px] flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      {t("settingsPage.customFields.module", "Module")}
                    </label>
                    <div className="bg-white rounded-lg">
                      <DropdownBasic
                        className="w-full"
                        width="100%"
                        options={fallbackModuleOptions}
                        value={module}
                        onChange={(m) => {
                          setModule(m);
                          const opts = CUSTOM_FIELD_SCREENS_BY_MODULE[m] || [];
                          const next =
                            opts[0]?.value ||
                            MODULE_SCREEN_DEFAULTS[m] ||
                            "sales_order";
                          setScreen(next);
                        }}
                        placeholder={t("settingsPage.customFields.module", "Module")}
                        isClearable={false}
                        sortOptions={false}
                      />
                    </div>
                  </div>
                  <div className="min-w-[200px] flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      {t("settingsPage.customFields.submodule", "Submodule")}
                    </label>
                    <div className="bg-white rounded-lg">
                      <DropdownBasic
                        className="w-full"
                        width="100%"
                        options={staticScreenOptions}
                        value={screen}
                        onChange={(nextScreen) => setScreen(nextScreen)}
                        placeholder={t("settingsPage.customFields.submodule", "Submodule")}
                        isClearable={false}
                        sortOptions={false}
                      />
                    </div>
                  </div>
                </>
              ) : null}

              {scopeLoading ? (
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    {t("settingsPage.customFields.moduleAccess", "Module access")}
                  </label>
                  <div className="border border-[var(--p-blue-light-2)]/70 rounded-xl px-3 py-2.5 text-sm text-gray-500 bg-gray-50/50">
                    {t("settingsPage.customFields.loadingModules", "Loading modules…")}
                  </div>
                </div>
              ) : null}

              {allowAdd ? (
                <div className="flex-1 min-w-[140px] flex justify-end">
                  <button
                    type="button"
                    onClick={openCreate}
                    disabled={!selectedOrg || !scopeReady}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--p-blue)] text-white rounded-xl text-sm font-medium shadow-sm hover:bg-[var(--p-blue-dark)] disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <Plus className="w-4 h-4" />
                    {t("settingsPage.customFields.addField", "Add field")}
                  </button>
                </div>
              ) : null}
            </div>
            {scopeListSource === "fallback" && !scopeLoading ? (
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mt-3">
                {t(
                  "settingsPage.customFields.fallbackNotice",
                  "Using built-in module list (no navigation match for your role or list failed to load). Submodule names are fixed labels, not from your role menu.",
                )}
              </p>
            ) : null}
            {selectedOrg ? (
              <p className="text-xs text-gray-500 mt-4 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-700">
                  {contextSubtitle}
                </span>
                <span className="text-gray-400">
                  {t("settingsPage.customFields.apiPrefix", "API:")} {module}/{screen}
                </span>
              </p>
            ) : null}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">
                {t("settingsPage.customFields.loading", "Loading…")}
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-gray-50 text-left">
                    <tr>
                      <th className="px-4 py-3 font-semibold">
                        {t("settingsPage.customFields.table.label", "Label")}
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        {t("settingsPage.customFields.table.key", "Key")}
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        {t("settingsPage.customFields.table.type", "Type")}
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        {t("settingsPage.customFields.table.pdf", "PDF")}
                      </th>
                      {showVendorInvoiceListColumn ? (
                        <th className="px-4 py-3 font-semibold">
                          {t("settingsPage.customFields.table.list", "List")}
                        </th>
                      ) : null}
                      <th className="px-4 py-3 font-semibold">
                        {t("settingsPage.customFields.table.active", "Active")}
                      </th>
                      {showRowActions ? (
                        <th className="px-4 py-3 font-semibold w-28">
                          {t("settingsPage.customFields.table.actions", "Actions")}
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r._id} className="border-t border-gray-100">
                        <td className="px-4 py-2 break-words">{r.label}</td>
                        <td className="px-4 py-2 font-mono text-xs break-all">{r.field_key}</td>
                        <td className="px-4 py-2 break-words">{dataTypeLabel(t, r.data_type)}</td>
                        <td className="px-4 py-2">
                          {r.show_in_pdf ? t("settingsPage.customFields.table.yes", "Yes") : ""}
                        </td>
                        {showVendorInvoiceListColumn ? (
                          <td className="px-4 py-2">
                            {r.show_in_datatable
                              ? t("settingsPage.customFields.table.yes", "Yes")
                              : ""}
                          </td>
                        ) : null}
                        <td className="px-4 py-2">
                          {allowUpdate ? (
                            <button
                              type="button"
                              onClick={() => toggleActive(r)}
                              className="text-[var(--p-blue)] underline"
                            >
                              {r.is_active === false
                                ? t("settingsPage.customFields.table.inactive", "Inactive")
                                : t("settingsPage.customFields.table.active", "Active")}
                            </button>
                          ) : (
                            <span className="text-gray-600">
                              {r.is_active === false
                                ? t("settingsPage.customFields.table.inactive", "Inactive")
                                : t("settingsPage.customFields.table.active", "Active")}
                            </span>
                          )}
                        </td>
                        {showRowActions ? (
                          <td className="px-4 py-2 flex gap-2">
                            {allowUpdate ? (
                              <button
                                type="button"
                                onClick={() => openEdit(r)}
                                className="p-1 text-gray-600 hover:text-[var(--p-blue)]"
                                title={t("settingsPage.customFields.edit", "Edit")}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            ) : null}
                            {allowDelete ? (
                              <button
                                type="button"
                                onClick={() => openDeleteField(r)}
                                className="p-1 text-red-600 hover:text-red-800"
                                title={t("settingsPage.customFields.delete", "Delete")}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                    {!rows.length ? (
                      <tr>
                        <td
                          colSpan={
                            (showVendorInvoiceListColumn ? 6 : 5) +
                            (showRowActions ? 1 : 0)
                          }
                          className="px-4 py-8 text-center text-gray-500"
                        >
                          {t(
                            "settingsPage.customFields.table.noFields",
                            "No fields for this module/screen.",
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
          </div>
      </div>

      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeleteFieldId(null);
          setDeleteFieldLabel("");
        }}
        onConfirm={confirmDeleteField}
        description={
          <>
            {t(
              "settingsPage.customFields.deleteConfirmPrefix",
              "Do you really want to delete the custom field",
            )}{" "}
            <strong>{deleteFieldLabel}</strong>
            {t(
              "settingsPage.customFields.deleteConfirmSuffix",
              "? This action cannot be undone.",
            )}
          </>
        }
      />

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200/80 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingId
                    ? t("settingsPage.customFields.editField", "Edit field")
                    : t("settingsPage.customFields.newField", "New field")}
                </h2>
                <p className="text-sm text-gray-500 mt-1">{contextSubtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                aria-label={t("settingsPage.customFields.close", "Close")}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-10">
                <div className="lg:col-span-3 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">
                  {t("settingsPage.customFields.label", "Label")}
                </label>
                <input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                  placeholder={t("settingsPage.customFields.labelPlaceholder", "Display name")}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">
                  {t("settingsPage.customFields.dataType", "Data type")}
                </label>
                <select
                  value={form.data_type}
                  onChange={(e) => {
                    const next = e.target.value;
                    setForm((prev) => {
                      const nextForm = { ...prev, data_type: next };
                      if (
                        (next === "dropdown" || next === "multi_select") &&
                        (!prev.optionsList || prev.optionsList.every((x) => !String(x).trim()))
                      ) {
                        nextForm.optionsList = [""];
                      }
                      return nextForm;
                    });
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                >
                  {CUSTOM_FIELD_DATA_TYPES.map((dt) => (
                    <option key={dt} value={dt}>
                      {dataTypeLabel(t, dt)}
                    </option>
                  ))}
                </select>
                {dataTypeHint ? (
                  <p className="text-[11px] text-gray-500 mt-1.5 leading-snug">
                    {dataTypeHint}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_required}
                    onChange={(e) =>
                      setForm({ ...form, is_required: e.target.checked })
                    }
                  />
                  {t("settingsPage.customFields.required", "Required")}
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_unique}
                    onChange={(e) =>
                      setForm({ ...form, is_unique: e.target.checked })
                    }
                  />
                  {t("settingsPage.customFields.unique", "Unique")}
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.show_in_pdf}
                    onChange={(e) =>
                      setForm({ ...form, show_in_pdf: e.target.checked })
                    }
                  />
                  {t("settingsPage.customFields.showInPdf", "Show in PDF")}
                </label>
                {showVendorInvoiceListColumn ? (
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!form.show_in_datatable}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          show_in_datatable: e.target.checked,
                        })
                      }
                    />
                    {t(
                      "settingsPage.customFields.showInVendorInvoiceList",
                      "Show in vendor invoice list",
                    )}
                  </label>
                ) : null}
              </div>
              {module === "inventory" && screen === "item" ? (
                <div className="rounded-lg border border-sky-100 bg-sky-50/60 p-3 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-1.5">
                      {t(
                        "settingsPage.customFields.showWhenCreatingTransactions",
                        "Show when creating transactions",
                      )}
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="show_in_transactions"
                          checked={!!form.show_in_transactions}
                          onChange={() =>
                            setForm((prev) => ({
                              ...prev,
                              show_in_transactions: true,
                            }))
                          }
                        />
                        {t("settingsPage.customFields.yes", "Yes")}
                      </label>
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="show_in_transactions"
                          checked={!form.show_in_transactions}
                          onChange={() =>
                            setForm((prev) => ({
                              ...prev,
                              show_in_transactions: false,
                              transaction_targets: [],
                            }))
                          }
                        />
                        {t("settingsPage.customFields.no", "No")}
                      </label>
                    </div>
                  </div>
                  {form.show_in_transactions ? (
                    <div className="pt-1 border-t border-sky-200/80 space-y-2">
                      <p className="text-xs font-semibold text-gray-700">
                        {t("settingsPage.customFields.includeInModules", "Include in modules")}
                      </p>
                      <p className="text-[11px] text-gray-600 leading-snug">
                        {t(
                          "settingsPage.customFields.includeInModulesHelpPrefix",
                          "Also show this item field on selected documents (values are stored on each line). Recurring invoice can use its own checkbox; if a field should appear on both customer and recurring screens, select both (or keep only Customer invoice—recurring screens still show fields that list",
                        )}{" "}
                        <span className="font-mono text-[10px]">sales:invoice</span>{" "}
                        {t(
                          "settingsPage.customFields.includeInModulesHelpSuffix",
                          "for backward compatibility).",
                        )}
                      </p>
                      {(CUSTOMER_FIELD_TRANSACTION_OPTIONS_BY_MODULE[module] || []).map(
                        (opt) => (
                          <label
                            key={opt.value}
                            className="flex items-center gap-2 text-sm text-gray-800"
                          >
                            <input
                              type="checkbox"
                              checked={(form.transaction_targets || []).includes(
                                opt.value,
                              )}
                              onChange={(e) => {
                                const on = e.target.checked;
                                setForm((prev) => {
                                  const cur = new Set(prev.transaction_targets || []);
                                  if (on) cur.add(opt.value);
                                  else cur.delete(opt.value);
                                  return {
                                    ...prev,
                                    transaction_targets: [...cur],
                                  };
                                });
                              }}
                            />
                            {transactionOptionLabel(t, opt)}
                          </label>
                        ),
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {/* <div>
                <label className="text-xs font-medium text-gray-600">
                  Data privacy
                </label>
                <select
                  value={form.data_privacy}
                  onChange={(e) =>
                    setForm({ ...form, data_privacy: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                >
                  {CUSTOM_FIELD_DATA_PRIVACY.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div> */}
              <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-3 space-y-2">
                <p className="text-xs font-semibold text-gray-700">
                  {t(
                    "settingsPage.customFields.defaultValueHeading",
                    "Default value (by field type)",
                  )}
                </p>
                {form.data_type === "checkbox" ? (
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!form.default_value}
                      onChange={(e) =>
                        setForm({ ...form, default_value: e.target.checked })
                      }
                    />
                    {t("settingsPage.customFields.checkedByDefault", "Checked by default")}
                  </label>
                ) : form.data_type === "multi_line_text" ||
                  form.data_type === "formula" ? (
                  <textarea
                    value={
                      typeof form.default_value === "string"
                        ? form.default_value
                        : ""
                    }
                    onChange={(e) =>
                      setForm({ ...form, default_value: e.target.value })
                    }
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                    placeholder={t(
                      "settingsPage.customFields.optionalDefaultTextPlaceholder",
                      "Optional default text",
                    )}
                  />
                ) : form.data_type === "dropdown" ? (
                  <select
                    value={
                      typeof form.default_value === "string"
                        ? form.default_value
                        : ""
                    }
                    onChange={(e) =>
                      setForm({ ...form, default_value: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">
                      {t("settingsPage.customFields.noDefaultOption", "— No default —")}
                    </option>
                    {(form.optionsList || [])
                      .map((s) => String(s).trim())
                      .filter(Boolean)
                      .map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                  </select>
                ) : form.data_type === "multi_select" ? (
                  <div>
                    <p className="text-[11px] text-gray-500 mb-1">
                      {t(
                        "settingsPage.customFields.multiSelectDefaultsHint",
                        "Comma-separated defaults (must match options above)",
                      )}
                    </p>
                    <input
                      value={
                        Array.isArray(form.default_value)
                          ? form.default_value.join(", ")
                          : String(form.default_value || "")
                      }
                      onChange={(e) =>
                        setForm({ ...form, default_value: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                      placeholder={t(
                        "settingsPage.customFields.multiSelectPlaceholder",
                        "Option A, Option B",
                      )}
                    />
                  </div>
                ) : form.data_type === "number" ||
                  form.data_type === "decimal" ||
                  form.data_type === "currency" ||
                  form.data_type === "percentage" ? (
                  <input
                    type="number"
                    step={
                      form.data_type === "number" ? "1" : "0.01"
                    }
                    value={
                      form.default_value === null ||
                      form.default_value === undefined ||
                      form.default_value === ""
                        ? ""
                        : form.default_value
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        default_value:
                          e.target.value === "" ? "" : e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  />
                ) : form.data_type === "date" ||
                  form.data_type === "datetime" ? (
                  <input
                    type={
                      form.data_type === "datetime" ? "datetime-local" : "date"
                    }
                    value={
                      typeof form.default_value === "string"
                        ? form.default_value
                        : ""
                    }
                    onChange={(e) =>
                      setForm({ ...form, default_value: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  />
                ) : (
                  <input
                    value={
                      typeof form.default_value === "string" ||
                      typeof form.default_value === "number"
                        ? String(form.default_value)
                        : ""
                    }
                    onChange={(e) =>
                      setForm({ ...form, default_value: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                    placeholder={t("settingsPage.customFields.optionalPlaceholder", "Optional")}
                  />
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">
                  {t("settingsPage.customFields.helpText", "Help text")}
                </label>
                <input
                  value={form.help_text}
                  onChange={(e) =>
                    setForm({ ...form, help_text: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                  placeholder={t(
                    "settingsPage.customFields.helpTextPlaceholder",
                    "Shown in the (?) tooltip on the form",
                  )}
                />
              </div>
              {placeholderSupportsType(form.data_type) ? (
                <div>
                  <label className="text-xs font-medium text-gray-600">
                    {t("settingsPage.customFields.placeholderLabel", "Placeholder")}
                  </label>
                  <input
                    value={form.input_format}
                    onChange={(e) =>
                      setForm({ ...form, input_format: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                    placeholder={
                      form.data_type === "dropdown"
                        ? t(
                            "settingsPage.customFields.placeholderDropdownHint",
                            "First row text when nothing is selected",
                          )
                        : t(
                            "settingsPage.customFields.placeholderGenericHint",
                            "Grey hint text inside the input",
                          )
                    }
                  />
                </div>
              ) : null}
              {/* <div>
                <label className="text-xs font-medium text-gray-600">
                  Position (sort order)
                </label>
                <input
                  type="number"
                  value={form.position}
                  onChange={(e) =>
                    setForm({ ...form, position: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                />
              </div> */}

              {(form.data_type === "dropdown" ||
                form.data_type === "multi_select") && (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-gray-700">
                      {t("settingsPage.customFields.picklistOptions", "Picklist options")}
                    </label>
                    <button
                      type="button"
                      onClick={addOptionRow}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--p-blue)] hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {t("settingsPage.customFields.addOption", "Add option")}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    {t(
                      "settingsPage.customFields.picklistHint",
                      "Same style as Zoho: one row per choice. Order is preserved.",
                    )}
                  </p>
                  <ul className="space-y-2">
                    {ensurePicklistOptions(form.optionsList).map((opt, idx) => (
                      <li
                        key={idx}
                        className="flex items-center gap-2"
                      >
                        <span className="text-xs text-gray-400 w-6 shrink-0">
                          {idx + 1}.
                        </span>
                        <input
                          value={opt}
                          onChange={(e) => setOptionAt(idx, e.target.value)}
                          placeholder={t(
                            "settingsPage.customFields.optionPlaceholder",
                            "Option {{number}}",
                            { number: idx + 1 },
                          )}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => removeOptionRow(idx)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                          title={t("settingsPage.customFields.remove", "Remove")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {form.data_type === "lookup" && (
                <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                  <label className="text-xs font-semibold text-gray-700">
                    {t("settingsPage.customFields.lookupTarget", "Lookup target")}
                  </label>
                  <select
                    value={`${form.lookup_module}|${form.lookup_screen}`}
                    onChange={(e) => {
                      const [lm, ls] = e.target.value.split("|");
                      setForm({
                        ...form,
                        lookup_module: lm,
                        lookup_screen: ls,
                      });
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                  >
                    <option value="|">
                      {t("settingsPage.customFields.selectPlaceholder", "— Select —")}
                    </option>
                    {CUSTOM_FIELD_LOOKUP_TARGETS.map((lt) => (
                      <option
                        key={`${lt.module}-${lt.screen}`}
                        value={`${lt.module}|${lt.screen}`}
                      >
                        {lookupTargetLabel(t, lt)} ({lt.module}/{lt.screen})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {form.data_type === "formula" && (
                <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                  <label className="text-xs font-semibold text-gray-700">
                    {t("settingsPage.customFields.formulaExpression", "Formula expression")}
                  </label>
                  <textarea
                    value={form.formula_expression}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        formula_expression: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 font-mono text-xs"
                    placeholder={t(
                      "settingsPage.customFields.formulaPlaceholder",
                      "e.g. subtotal * 0.01",
                    )}
                  />
                </div>
              )}

              {form.data_type === "auto_number" && (
                <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                  <label className="text-xs font-semibold text-gray-700">
                    {t("settingsPage.customFields.autoNumberPrefix", "Auto number prefix")}
                  </label>
                  <input
                    value={form.auto_number_prefix}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        auto_number_prefix: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                    placeholder={t(
                      "settingsPage.customFields.autoNumberPrefixPlaceholder",
                      "SO-CF-",
                    )}
                  />
                </div>
              )}

              {form.data_type === "external_lookup" && (
                <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-700">
                    {t("settingsPage.customFields.externalApi", "External API")}
                  </p>
                  <input
                    placeholder={t(
                      "settingsPage.customFields.externalApiUrlPlaceholder",
                      "External API URL",
                    )}
                    value={form.external_url}
                    onChange={(e) =>
                      setForm({ ...form, external_url: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    placeholder={t(
                      "settingsPage.customFields.valueJsonPathPlaceholder",
                      "Value JSON path",
                    )}
                    value={form.external_valuePath}
                    onChange={(e) =>
                      setForm({ ...form, external_valuePath: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    placeholder={t(
                      "settingsPage.customFields.labelJsonPathPlaceholder",
                      "Label JSON path",
                    )}
                    value={form.external_labelPath}
                    onChange={(e) =>
                      setForm({ ...form, external_labelPath: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              )}

                </div>
                <div className="lg:col-span-2 lg:min-h-[120px]">
                  <div className="lg:sticky lg:top-0">
                    <CustomFieldFormPreview form={form} />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50/90 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50"
              >
                {t("settingsPage.customFields.cancel", "Cancel")}
              </button>
              {(editingId ? allowUpdate : allowAdd) ? (
                <button
                  type="button"
                  onClick={saveField}
                  className="px-5 py-2 text-sm bg-[var(--p-blue)] text-white rounded-lg font-medium shadow-sm hover:bg-[var(--p-blue-dark)]"
                >
                  {t("settingsPage.customFields.save", "Save")}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

  if (embedded) {
    return body;
  }

  return (
    <AppLayout>
      <Header />
      {body}
    </AppLayout>
  );
}
