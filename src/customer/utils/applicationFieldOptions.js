/**
 * Maps admin-configured field option groups to wizard select fields.
 */
export const FIELD_OPTION_GROUPS = {
  application_purpose: "Application Purpose",
  certification_type: "Certification Type",
  inspection_category: "Inspection Category",
  inspection_service: "Inspection Service",
};

/** Rich metadata for the Global Settings admin UI. */
export const FIELD_GROUP_META = {
  application_purpose: {
    label: "Application Purpose",
    description:
      "Dropdown on the conformity assessment wizard — Application Details step.",
    service: "Conformity Assessment",
    wizardStep: "Application Details",
  },
  certification_type: {
    label: "Assessment Type",
    description:
      "Dropdown on the conformity assessment wizard — Application Details step.",
    service: "Conformity Assessment",
    wizardStep: "Application Details",
  },
  inspection_service: {
    label: "Inspection Service",
    description:
      "Dropdown on the inspection wizard — Project & Inspection step.",
    service: "Inspection",
    wizardStep: "Project & Inspection",
  },
  inspection_category: {
    label: "Inspection Category",
    description:
      "Dropdown on the inspection wizard — Project & Inspection step.",
    service: "Inspection",
    wizardStep: "Project & Inspection",
  },
};

export const FIELD_GROUP_SECTIONS = [
  {
    title: "Conformity Assessment Application",
    subtitle: "Customer assessment form dropdowns",
    groupKeys: ["application_purpose", "certification_type"],
  },
  {
    title: "Inspection Application (legacy)",
    subtitle: "Hidden from demo pickers — kept for legacy rows",
    groupKeys: ["inspection_service", "inspection_category"],
  },
];

/** Build `{ groupKey: string[] }` from API rows. */
export function groupFieldOptions(rows = []) {
  const grouped = {};
  for (const row of rows) {
    if (!row?.groupKey || !row?.name) continue;
    if (!grouped[row.groupKey]) grouped[row.groupKey] = [];
    grouped[row.groupKey].push(row.name);
  }
  return grouped;
}

/** Inject resolved option lists into a step field spec. */
export function resolveStepFields(fields = [], optionMap = {}) {
  return fields.map((field) => {
    if (field.type !== "select" || !field.optionsKey) return field;
    return {
      ...field,
      options: optionMap[field.optionsKey] || [],
    };
  });
}

/** Count rows per groupKey. */
export function countByGroup(rows = []) {
  const counts = {};
  for (const row of rows) {
    if (!row?.groupKey) continue;
    if (!counts[row.groupKey]) counts[row.groupKey] = { total: 0, active: 0 };
    counts[row.groupKey].total += 1;
    if (row.status === "Active") counts[row.groupKey].active += 1;
  }
  return counts;
}
