import React, { useEffect, useMemo, useState } from "react";

import { StepHeading, StepNote } from "../../../components/wizard/ApplicationWizard";
import Combobox from "../../../components/ui/Combobox";
import {
  FormGrid,
  TextField,
  TextareaField,
  MultiEntryField,
} from "../../../components/ui/Field";
import CustomerCategoryServices from "../../../services/categoryService";
import {
  PRODUCT_MULTI_FIELDS,
  toStringList,
} from "../../../utils/productMultiFields";

/**
 * Product Details step: product name, standard number/title, multi-entry
 * Type/Model/Rating/Size/Brand (FOR-01), Class/Category, then that category's
 * dynamic productFields.
 */
export default function ProductDetailsStep({
  title,
  subtitle,
  values = {},
  errors = {},
  onChange,
  note,
  /** Optional admin override: `async () => categoriesArray`. */
  fetchCategories,
}) {
  const [categories, setCategories] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCats(true);
      setLoadError("");
      try {
        let list;
        if (typeof fetchCategories === "function") {
          list = await fetchCategories();
        } else {
          const res = await CustomerCategoryServices.getActiveCategories();
          list = res.data?.categories || res.data || [];
        }
        if (!cancelled) setCategories(Array.isArray(list) ? list : []);
      } catch (err) {
        if (!cancelled) {
          setCategories([]);
          setLoadError(
            err?.response?.data?.message ||
              "Could not load categories. Try again later.",
          );
        }
      } finally {
        if (!cancelled) setLoadingCats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchCategories]);

  const categoryOptions = useMemo(
    () =>
      categories.map((c) => ({
        value: String(c._id),
        label: c.name,
      })),
    [categories],
  );

  const selectedCategory = useMemo(
    () =>
      categories.find((c) => String(c._id) === String(values.categoryId)) ||
      null,
    [categories, values.categoryId],
  );

  const dynamicFields = useMemo(() => {
    const fields =
      selectedCategory?.productFields || values.categoryProductFields;
    if (!Array.isArray(fields)) return [];
    return [...fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [selectedCategory, values.categoryProductFields]);

  const set = (name) => (next) => {
    onChange?.(name, next?.target ? next.target.value : next);
  };

  const setMulti = (name) => (list) => {
    onChange?.(name, Array.isArray(list) ? list : []);
  };

  const handleCategoryChange = (categoryId) => {
    const cat = categories.find((c) => String(c._id) === String(categoryId));
    onChange?.({
      categoryId: categoryId || "",
      category: cat?.name || "",
      categoryProductFields: cat?.productFields || [],
      categoryFieldValues: {},
    });
  };

  const setDynamicValue = (key, allowMultiple = false) => (next) => {
    const value = next?.target ? next.target.value : next;
    const prev = values.categoryFieldValues || {};
    onChange?.("categoryFieldValues", {
      ...prev,
      [key]: allowMultiple ? toStringList(value) : value,
    });
  };

  return (
    <>
      <StepHeading title={title} subtitle={subtitle} />

      <FormGrid>
        <TextField
          name="productName"
          label="Product Name *"
          value={values.productName ?? ""}
          error={errors.productName}
          onChange={set("productName")}
          placeholder="e.g. Shirt"
        />

        <TextField
          name="standardNumber"
          label="Standard Number"
          value={values.standardNumber ?? ""}
          error={errors.standardNumber}
          onChange={set("standardNumber")}
          placeholder="e.g. MS 123:2020"
        />

        <TextField
          name="standardTitle"
          label="Standard Title"
          value={values.standardTitle ?? ""}
          error={errors.standardTitle}
          onChange={set("standardTitle")}
          placeholder="e.g. Specification for…"
        />

        {PRODUCT_MULTI_FIELDS.map((field) => (
          <MultiEntryField
            key={field.name}
            name={field.name}
            label={`${field.label}${field.name === "brands" ? " *" : ""}`}
            values={toStringList(values[field.name])}
            error={errors[field.name]}
            placeholder={field.placeholder}
            onChange={setMulti(field.name)}
            hint={
              field.name === "types" || field.name === "models"
                ? "Add at least one type or model — type each value and press Enter"
                : "Add multiple values — type each one and press Enter"
            }
          />
        ))}

        <Combobox
          name="categoryId"
          label="Class / Category *"
          placeholder={
            loadingCats ? "Loading categories…" : "Select class / category"
          }
          options={categoryOptions}
          value={values.categoryId ?? ""}
          error={errors.categoryId || loadError}
          disabled={loadingCats}
          onChange={handleCategoryChange}
        />

        {dynamicFields.map((field) => {
          const name = `categoryField:${field.key}`;
          const allowMultiple = Boolean(field.allowMultiple);
          const raw = values.categoryFieldValues?.[field.key];
          const label = field.required ? `${field.label} *` : field.label;
          const error = errors[name];
          const shared = {
            key: field.key,
            name,
            label,
            error,
            placeholder: field.placeholder || undefined,
          };

          if (allowMultiple && field.type !== "select" && field.type !== "textarea") {
            return (
              <MultiEntryField
                {...shared}
                values={toStringList(raw)}
                placeholder={
                  field.placeholder || "Type and press Enter to add"
                }
                hint="Multiple entries allowed"
                onChange={setDynamicValue(field.key, true)}
              />
            );
          }

          if (field.type === "select") {
            return (
              <Combobox
                {...shared}
                value={raw ?? ""}
                placeholder={field.placeholder || "Select"}
                options={field.options || []}
                onChange={setDynamicValue(field.key)}
              />
            );
          }

          if (field.type === "textarea") {
            return (
              <TextareaField
                {...shared}
                value={raw ?? ""}
                rows={3}
                onChange={setDynamicValue(field.key)}
              />
            );
          }

          return (
            <TextField
              {...shared}
              value={raw ?? ""}
              type={field.type === "number" ? "number" : "text"}
              onChange={setDynamicValue(field.key)}
            />
          );
        })}
      </FormGrid>

      {note && <StepNote title={note.title}>{note.body}</StepNote>}
    </>
  );
}

/** Required dynamic field keys for wizard validation (from stored category fields). */
export function getRequiredCategoryFieldKeys(categoryProductFields = []) {
  if (!Array.isArray(categoryProductFields)) return [];
  return categoryProductFields
    .filter((f) => f.required)
    .map((f) => f.key)
    .filter(Boolean);
}
