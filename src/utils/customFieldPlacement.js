import { CUSTOM_FIELD_PLACEMENT } from "@/utils/customFieldConstants";

function getScreenPlacement(module, screen) {
  return (
    CUSTOM_FIELD_PLACEMENT?.[module]?.[screen] || CUSTOM_FIELD_PLACEMENT.default
  );
}

function normalizeFieldName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

export function shouldRenderCustomFieldAtSlot(module, screen, slot) {
  const placement = getScreenPlacement(module, screen);
  return (placement?.slots || []).includes(slot);
}

export function injectCustomFieldsInFormFields({
  formFields = [],
  module,
  screen,
  customFieldComponent,
}) {
  if (!Array.isArray(formFields) || !customFieldComponent) {
    return { formFieldsWithCustomFields: formFields, renderInFooter: false };
  }

  const placement = getScreenPlacement(module, screen);
  const slots = placement?.slots || [];
  const anchors = placement?.fieldAnchors || {};

  let targetIndex = -1;
  for (const slot of slots) {
    const slotAnchors = anchors[slot];
    if (!Array.isArray(slotAnchors) || slotAnchors.length === 0) continue;

    targetIndex = formFields.findIndex((field) => {
      const fieldName = normalizeFieldName(field?.name);
      return slotAnchors.some((anchor) => fieldName.includes(normalizeFieldName(anchor)));
    });

    if (targetIndex !== -1) break;
  }

  if (targetIndex === -1) {
    return {
      formFieldsWithCustomFields: formFields,
      renderInFooter: slots.includes("before_footer"),
    };
  }

  const injectedField = {
    type: "raw-custom",
    name: "__custom_fields_anchor__",
    /** Pack into the same grid row as the preceding native field when a slot is free. */
    fullWidth: false,
    mergeIntoParentGrid: true,
    component: customFieldComponent,
  };

  const nextFields = [...formFields];
  nextFields.splice(targetIndex, 0, injectedField);

  return { formFieldsWithCustomFields: nextFields, renderInFooter: false };
}
