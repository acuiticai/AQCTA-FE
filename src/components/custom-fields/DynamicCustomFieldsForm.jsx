import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import {
  fetchDefinitions,
  fetchValues,
} from "@/services/customFieldServices";
import CustomFieldDefinitionControl from "./CustomFieldDefinitionControl";
import { resolveCustomFieldUIProfile } from "./customFieldUIRegistry";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const MODULE_SCREEN_DEFAULT_COLUMNS = {
  "inventory:item": 2,
  "inventory:category": 2,
  "inventory:stock_group": 2,
  "inventory:customer": 2,
  "sales:customer": 2,
  "purchase:customer": 2,
  /** Match invoice / SO / PO header rows (Order no. etc.): `md:grid-cols-3` */
  "sales:sales_order": 3,
  "purchase:purchase_order": 3,
  "purchase:vendor_invoice": 3,
  "sales:invoice": 3,
};

function gridTemplateClass(columns, gapClass, useBreakpointGrid) {
  const g = gapClass || "gap-4";
  if (useBreakpointGrid) {
    if (columns === 1) return `grid grid-cols-1 ${g} items-start`;
    if (columns === 2)
      return `grid grid-cols-1 md:grid-cols-2 ${g} items-start`;
    if (columns === 3)
      return `grid grid-cols-1 md:grid-cols-3 ${g} items-start`;
    return `grid grid-cols-1 md:grid-cols-4 ${g} items-start`;
  }
  if (columns === 1) return `grid grid-cols-1 ${g} items-start`;
  if (columns === 2) return `grid grid-cols-2 ${g} items-start`;
  if (columns === 3) return `grid grid-cols-3 ${g} items-start`;
  return `grid grid-cols-4 ${g} items-start`;
}

function fullRowSpanClass(columns) {
  if (columns <= 1) return "";
  if (columns === 2) return "col-span-2";
  if (columns === 3) return "col-span-3";
  return "col-span-4";
}

function normalizeEntityId(value) {
  if (!value) return "";
  if (typeof value === "object") {
    return String(value._id || value.id || "").trim();
  }
  return String(value).trim();
}

export default function DynamicCustomFieldsForm({
  businessId,
  module,
  screen,
  recordId,
  values,
  onValuesChange,
  headers,
  readOnly = false,
  columns = 2,
  /** When embedded inside a single Form cell, force a 1-column layout. */
  inline = false,
  caption = null,
  /** Optional map of field_key → error message (inline validation). */
  fieldErrors = null,
  /**
   * Optional UI profile registry key applied to every field (overrides per-definition keys).
   * Normally omitted so each definition uses `ui_profile_key` or `${module}:${screen}`.
   */
  uiProfileKey = null,
  /** If set, only render definitions where this returns true. */
  matchDefinition = null,
  /** If set, exclude definitions where this returns true. */
  omitDefinition = null,
  /**
   * Match `Form` fieldsRowGapClassName (e.g. gap-4). Falls back to profile.gridGapClass.
   */
  fieldsRowGapClassName = null,
  /**
   * Vertical gap between rows of fields. Match `Form` fieldsStackSpacingClassName (e.g. space-y-4).
   */
  fieldsStackSpacingClassName = null,
  /**
   * When false (default), use the same non-responsive grid as `Form` (grid-cols-2, etc.).
   * When true, use `grid-cols-1 md:grid-cols-*` like invoice / order header sections.
   */
  useBreakpointGrid = false,
  /**
   * Free grid cells on the parent `Form` row (from `mergeIntoParentGrid` + `display: contents`).
   * First N narrow custom fields render as siblings in that row; the rest render in a full-width block below.
   */
  rowHeadroom = 0,
  /** Optional class on the outer wrapper (default layout); use to align with parent Form spacing. */
  className = "",
}) {
  const [defs, setDefs] = useState([]);
  const [loading, setLoading] = useState(false);
  const loadKeyRef = useRef("");
  /** Parent often passes an inline handler; keep latest without re-firing the load effect. */
  const onValuesChangeRef = useRef(onValuesChange);
  onValuesChangeRef.current = onValuesChange;
  const normalizedBusinessId = normalizeEntityId(businessId);
  const normalizedRecordId = normalizeEntityId(recordId);
  const authHeader =
    headers?.authorization || headers?.Authorization || "";

  useEffect(() => {
    const key = `${normalizedBusinessId}|${module}|${screen}|${normalizedRecordId || "new"}`;
    if (!normalizedBusinessId || !module || !screen || !authHeader) {
      setDefs([]);
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function run() {
      loadKeyRef.current = key;
      setLoading(true);
      try {
        const list = await fetchDefinitions(
          { businessId: normalizedBusinessId, module, screen },
          headers,
        );
        if (cancelled || loadKeyRef.current !== key) return;
        setDefs(list);

        const merged = { ...(values || {}) };
        if (normalizedRecordId) {
          const stored = await fetchValues(
            {
              businessId: normalizedBusinessId,
              module,
              screen,
              recordId: normalizedRecordId,
            },
            headers,
          );
          if (cancelled || loadKeyRef.current !== key) return;
          for (const d of list) {
            if (stored[d.field_key] !== undefined) {
              merged[d.field_key] = stored[d.field_key];
            } else if (
              merged[d.field_key] === undefined &&
              d.default_value !== null &&
              d.default_value !== undefined
            ) {
              merged[d.field_key] = d.default_value;
            }
          }
        } else {
          for (const d of list) {
            if (
              merged[d.field_key] === undefined &&
              d.default_value !== null &&
              d.default_value !== undefined
            ) {
              merged[d.field_key] = d.default_value;
            }
          }
        }
        onValuesChangeRef.current(merged);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled && loadKeyRef.current === key) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [normalizedBusinessId, module, screen, normalizedRecordId, authHeader]);

  const patch = (fieldKey, v) => {
    onValuesChangeRef.current({ ...(values || {}), [fieldKey]: v });
  };

  const uploadFile = async (file) => {
    const fd = new FormData();
    fd.append("image", file);
    const res = await axios.post(`${Base_URL}/upload`, fd, {
      headers: {
        authorization: headers?.authorization || headers?.Authorization,
      },
    });
    return res.data?.url || "";
  };

  if (!normalizedBusinessId || !module || !screen) return null;
  if (loading) return null;
  if (!defs.length) return null;

  const visibleDefs = defs.filter((d) => {
    if (matchDefinition && !matchDefinition(d)) return false;
    if (omitDefinition && omitDefinition(d)) return false;
    return true;
  });

  if (!visibleDefs.length) return null;

  const baseProfile = resolveCustomFieldUIProfile(module, screen);
  const rowGap =
    fieldsRowGapClassName ?? baseProfile.gridGapClass ?? "gap-4";
  const stackSpacing =
    fieldsStackSpacingClassName ??
    baseProfile.stackSpacingClass ??
    "space-y-4";

  const defaultColumns =
    MODULE_SCREEN_DEFAULT_COLUMNS[`${module}:${screen}`] || 2;
  const requestedColumns =
    Number(columns) > 0 ? Number(columns) : Number(defaultColumns);
  const safeColumns = inline
    ? 1
    : Math.min(Math.max(requestedColumns || defaultColumns, 1), 4);

  const gridColsClass = gridTemplateClass(
    safeColumns,
    rowGap,
    useBreakpointGrid,
  );

  const fullSpanClass = fullRowSpanClass(safeColumns);

  const resolveProfile = (d) =>
    resolveCustomFieldUIProfile(module, screen, uiProfileKey || d.ui_profile_key);

  const isFullWidthType = (d, profile) =>
    safeColumns !== 1 &&
    (profile.fullWidthDataTypes?.has?.(d.data_type) ||
      d.data_type === "multi_line_text" ||
      d.data_type === "formula" ||
      d.data_type === "multi_select" ||
      d.data_type === "external_lookup");

  const buildRowsFromDefs = (list) => {
    const out = [];
    let curRow = [];
    const flush = () => {
      if (curRow.length) out.push(curRow);
      curRow = [];
    };
    for (const d of list) {
      const profile = resolveProfile(d);
      const spanFull = isFullWidthType(d, profile);
      if (spanFull) {
        flush();
        out.push([d]);
        continue;
      }
      curRow.push(d);
      if (curRow.length >= safeColumns) flush();
    }
    flush();
    return out;
  };

  const renderRowGrids = (rowList) =>
    rowList.map((row, rowIdx) => (
      <div
        key={`cf-row-${rowIdx}`}
        className={gridColsClass}
        style={{ alignItems: "stretch" }}
      >
        {row.map((d) => {
          const profile = resolveProfile(d);
          const spanFull = isFullWidthType(d, profile);
          const wrapClass = spanFull ? fullSpanClass : "";
          return (
            <div
              key={d._id}
              className={`${wrapClass || ""} min-w-0 w-full flex flex-col`}
            >
              <CustomFieldDefinitionControl
                definition={d}
                value={values?.[d.field_key]}
                onPatch={patch}
                readOnly={readOnly}
                profile={profile}
                fieldError={fieldErrors?.[d.field_key]}
                uploadFile={uploadFile}
              />
            </div>
          );
        })}

        {safeColumns > 1 &&
          row.length > 0 &&
          !(
            row.length === 1 &&
            isFullWidthType(row[0], resolveProfile(row[0]))
          ) &&
          row.length < safeColumns &&
          Array.from({ length: safeColumns - row.length }).map((_, i) => (
            <div key={`cf-empty-${rowIdx}-${i}`} className="min-w-0 w-full" />
          ))}
      </div>
    ));

  const effectiveHeadroom = inline
    ? 0
    : Math.max(0, Math.min(Number(rowHeadroom) || 0, safeColumns));

  const splitLeadingForParentRow = (list, maxLeading) => {
    if (!maxLeading || maxLeading < 1) {
      return { leading: [], rest: list };
    }
    const leading = [];
    for (const d of list) {
      const profile = resolveProfile(d);
      if (isFullWidthType(d, profile)) break;
      if (leading.length >= maxLeading) break;
      leading.push(d);
    }
    return { leading, rest: list.slice(leading.length) };
  };

  if (effectiveHeadroom > 0) {
    const { leading, rest } = splitLeadingForParentRow(
      visibleDefs,
      effectiveHeadroom,
    );

    if (leading.length > 0) {
      return (
        <>
          {leading.map((d) => {
            const profile = resolveProfile(d);
            return (
              <div key={d._id} className="min-w-0 w-full flex flex-col">
                <CustomFieldDefinitionControl
                  definition={d}
                  value={values?.[d.field_key]}
                  onPatch={patch}
                  readOnly={readOnly}
                  profile={profile}
                  fieldError={fieldErrors?.[d.field_key]}
                  uploadFile={uploadFile}
                />
              </div>
            );
          })}
          {rest.length > 0 ? (
            <div className={`${fullSpanClass} min-w-0 w-full`}>
              {caption ? (
                <p className="text-xs text-gray-500 mb-3">{caption}</p>
              ) : null}
              <div className={stackSpacing}>
                {renderRowGrids(buildRowsFromDefs(rest))}
              </div>
            </div>
          ) : caption ? (
            <div className={`${fullSpanClass} min-w-0 w-full`}>
              <p className="text-xs text-gray-500 mb-3">{caption}</p>
            </div>
          ) : null}
        </>
      );
    }
  }

  const rows = buildRowsFromDefs(visibleDefs);

  return (
    <div
      className={["w-full", "min-w-0", className].filter(Boolean).join(" ")}
    >
      {caption ? (
        <p className="text-xs text-gray-500 mb-3">{caption}</p>
      ) : null}
      <div className={stackSpacing}>{renderRowGrids(rows)}</div>
    </div>
  );
}
