# Translation Implementation Guide

This guide will help you implement translations (i18n) in your React components using i18next.

## Table of Contents

1. [Overview](#overview)
2. [Step 1: Add Translation Keys](#step-1-add-translation-keys)
3. [Step 2: Use Translations in Components](#step-2-use-translations-in-components)
4. [Step 3: Common Patterns](#step-3-common-patterns)
5. [Step 4: Best Practices](#step-4-best-practices)
6. [Step 5: Testing Translations](#step-5-testing-translations)
7. [Troubleshooting](#troubleshooting)

---

## Overview

Our project uses **i18next** and **react-i18next** for internationalization. We support three languages:

- **English (en)** - Default language
- **Bahasa Indonesia (id)**
- **Arabic (ar)**

Translation files are located in:

```
src/utils/translation/
├── en.json  (English)
├── id.json  (Bahasa Indonesia)
└── ar.json  (Arabic)
```

---

## Step 1: Add Translation Keys

### 1.1 Identify Text to Translate

Before adding keys, identify all user-facing text in your component:

- Button labels
- Headers and titles
- Placeholder text
- Error messages
- Tooltips
- Table headers
- Status labels

### 1.2 Add Keys to Translation Files

**Location:** `src/utils/translation/en.json`, `id.json`, `ar.json`

**Format:** Use descriptive, hierarchical keys when possible.

#### ✅ Good Key Naming:

```json
{
  "Shipment": "Shipment",
  "Shipment ID": "Shipment ID",
  "Search by Shipment ID": "Search by Shipment ID",
  "Shipments Overview": "Shipments Overview",
  "In Pre-Shipment": "In Pre-Shipment",
  "In Post-Shipment": "In Post-Shipment"
}
```

#### ❌ Avoid:

```json
{
  "text1": "Shipment",
  "label": "Shipment ID",
  "placeholder": "Search by Shipment ID"
}
```

### 1.3 Add to All Language Files

**You must add the same key to all three language files:**

#### `en.json` (English):

```json
{
  "MyNewKey": "My New Text"
}
```

#### `id.json` (Bahasa Indonesia):

```json
{
  "MyNewKey": "Teks Baru Saya"
}
```

#### `ar.json` (Arabic):

```json
{
  "MyNewKey": "نصي الجديد"
}
```

**⚠️ Important:** If you forget to add a key to a language file, the system will fall back to English.

### 1.4 Key Naming Conventions

- Use **PascalCase** for multi-word keys: `"ShipmentID"`, `"SearchByShipmentID"`
- Use **descriptive names** that indicate context: `"ShipmentsOverview"` not `"Title"`
- Keep keys **consistent** across similar components
- Use **hierarchical structure** for related keys:
  ```json
  {
    "Shipment": "Shipment",
    "ShipmentID": "Shipment ID",
    "ShipmentStatus": "Shipment Status",
    "ShipmentDetails": "Shipment Details"
  }
  ```

---

## Step 2: Use Translations in Components

### 2.1 Import the Hook

At the top of your component file:

```jsx
import { useTranslation } from "react-i18next";
```

### 2.2 Initialize the Hook

Inside your component function:

```jsx
const MyComponent = () => {
  const { t } = useTranslation();

  // ... rest of your component
};
```

### 2.3 Replace Hardcoded Text

Replace all hardcoded strings with `t("YourKey")`:

#### Before:

```jsx
<h1>Shipments Overview</h1>
<button>Add New</button>
<input placeholder="Search by Shipment ID" />
```

#### After:

```jsx
<h1>{t("Shipments Overview")}</h1>
<button>{t("Add New")}</button>
<input placeholder={t("Search by Shipment ID")} />
```

### 2.4 Complete Example

```jsx
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

const ShipmentComponent = () => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div>
      <h1>{t("Shipments Overview")}</h1>

      <div>
        <input
          type="text"
          placeholder={t("Search by Shipment ID")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <button>{t("Add New")}</button>

      <table>
        <thead>
          <tr>
            <th>{t("Shipment ID")}</th>
            <th>{t("Status")}</th>
            <th>{t("Actions")}</th>
          </tr>
        </thead>
      </table>
    </div>
  );
};

export default ShipmentComponent;
```

---

## Step 3: Common Patterns

### 3.1 Translations in JSX Attributes

```jsx
// Placeholder
<input placeholder={t("Search")} />

// Title/Tooltip
<button title={t("Edit")}>{t("Edit")}</button>

// Aria labels
<button aria-label={t("Close")}>
  <CloseIcon />
</button>

// Alt text
<img src="logo.png" alt={t("Company Logo")} />
```

### 3.2 Translations in Arrays/Objects

```jsx
const { t } = useTranslation();

const tableHeaders = [t("Shipment ID"), t("Status"), t("Date"), t("Actions")];

const statusOptions = [
  { label: t("Pending"), value: "pending" },
  { label: t("Completed"), value: "completed" },
  { label: t("Cancelled"), value: "cancelled" },
];
```

### 3.3 Translations with Variables/Interpolation

For dynamic content with variables:

**In translation files:**

```json
{
  "WelcomeMessage": "Welcome, {{name}}!",
  "ItemsCount": "You have {{count}} items",
  "TimeAgo": "{{count}}m ago"
}
```

**In component:**

```jsx
const { t } = useTranslation();

// Simple variable
<p>{t("WelcomeMessage", { name: "John" })}</p>
// Output: "Welcome, John!"

// With count
<p>{t("ItemsCount", { count: 5 })}</p>
// Output: "You have 5 items"

// Pluralization (automatic)
<p>{t("TimeAgo", { count: 30 })}</p>
// Output: "30m ago"
```

### 3.4 Conditional Translations

```jsx
const { t } = useTranslation();

const statusLabel = isActive ? t("Active") : t("Inactive");

// Or in JSX
<span>{isActive ? t("Active") : t("Inactive")}</span>;
```

### 3.5 Translations in Functions

```jsx
const { t } = useTranslation();

const handleSubmit = () => {
  if (!formData.name) {
    toast.error(t("Name is required"));
    return;
  }
  // ... submit logic
};

const formatStatus = (status) => {
  const statusMap = {
    pending: t("Pending"),
    completed: t("Completed"),
    cancelled: t("Cancelled"),
  };
  return statusMap[status] || t("Unknown");
};
```

### 3.6 Translations in Data Tables

```jsx
const { t } = useTranslation();

<DataTable
  headers={[t("Shipment ID"), t("Status"), t("Date"), t("Actions")]}
  title={t("Shipments Overview")}
  searchPlaceholder={t("Search by Shipment ID")}
  // ... other props
/>;
```

### 3.7 Translations in Modals/Dialogs

```jsx
const { t } = useTranslation();

<Modal title={t("Edit Shipment")} onClose={() => setOpen(false)}>
  <form>
    <label>{t("Shipment ID")}</label>
    <input />

    <div>
      <button onClick={() => setOpen(false)}>{t("Cancel")}</button>
      <button type="submit">{t("Save")}</button>
    </div>
  </form>
</Modal>;
```

---

## Step 4: Best Practices

### ✅ DO:

1. **Always use translation keys** for user-facing text
2. **Add keys to all three language files** (en, id, ar)
3. **Use descriptive key names** that are self-documenting
4. **Keep keys consistent** across similar components
5. **Test with different languages** to ensure UI doesn't break
6. **Use interpolation** for dynamic content instead of string concatenation
7. **Group related keys** together in translation files

### ❌ DON'T:

1. **Don't hardcode text** that users will see
2. **Don't use generic keys** like "text1", "label", "button"
3. **Don't forget to add keys** to all language files
4. **Don't concatenate translated strings** - use interpolation instead
5. **Don't translate** technical terms, error codes, or API responses
6. **Don't use translations** for:
   - Console logs
   - Debug messages
   - Internal variable names
   - API endpoints
   - Code comments

### Example: String Concatenation (❌ Bad)

```jsx
// ❌ DON'T DO THIS
<p>
  {t("You have")} {count} {t("items")}
</p>
```

### Example: Interpolation (✅ Good)

```jsx
// ✅ DO THIS INSTEAD
// In translation file:
{
  "ItemCount": "You have {{count}} items"
}

// In component:
<p>{t("ItemCount", { count })}</p>
```

---

## Step 5: Testing Translations

### 5.1 Test Language Switching

1. Open your component in the browser
2. Click the language switcher in the header (🌐 icon)
3. Switch between English, Bahasa Indonesia, and Arabic
4. Verify all text changes correctly
5. Check that UI layout doesn't break (especially with longer Arabic text)

### 5.2 Check for Missing Translations

1. Open browser console
2. If a key is missing, i18next will log a warning
3. Add the missing key to all language files

### 5.3 Test RTL (Right-to-Left) Layout

Arabic is RTL, so test:

- Text alignment
- Button positions
- Modal layouts
- Table columns
- Navigation menus

---

## Troubleshooting

### Issue: Translation not showing / Key not found

**Symptoms:** Text shows the key name instead of translation (e.g., "MyKey" instead of "My Text")

**Solutions:**

1. Check that the key exists in `en.json`
2. Verify the key name matches exactly (case-sensitive)
3. Check browser console for i18next warnings
4. Ensure you've imported `useTranslation` and called `const { t } = useTranslation()`

### Issue: Translation shows in English only

**Symptoms:** Text always shows in English, even when switching languages

**Solutions:**

1. Check that the key exists in `id.json` and `ar.json`
2. Verify the JSON files are valid (no syntax errors)
3. Clear browser cache and localStorage
4. Check `src/i18n.js` configuration

### Issue: UI breaks with longer translations

**Symptoms:** Layout breaks when switching to Arabic (which tends to be longer)

**Solutions:**

1. Use CSS `min-width` and `max-width` appropriately
2. Use `truncate` class for long text: `className="truncate"`
3. Test with all languages during development
4. Consider using shorter keys or abbreviations for Arabic

### Issue: Variables not interpolating

**Symptoms:** `{{name}}` shows literally instead of the value

**Solutions:**

1. Check that you're passing the variable object: `t("Key", { name: "John" })`
2. Verify the key in JSON uses double curly braces: `"{{name}}"`
3. Check that interpolation is enabled in `i18n.js` (it should be by default)

### Issue: Translation key with special characters

**Symptoms:** Key not working with spaces or special characters

**Solutions:**

1. Use PascalCase or camelCase for keys: `"ShipmentID"` instead of `"Shipment ID"`
2. If you must use spaces, ensure exact match in JSON
3. Prefer descriptive keys without special characters

---

## Quick Reference Checklist

When implementing translations in a new component:

- [ ] Import `useTranslation` from `react-i18next`
- [ ] Initialize `const { t } = useTranslation()` in component
- [ ] Identify all user-facing text
- [ ] Add keys to `en.json` with English translations
- [ ] Add same keys to `id.json` with Bahasa Indonesia translations
- [ ] Add same keys to `ar.json` with Arabic translations
- [ ] Replace all hardcoded strings with `t("Key")`
- [ ] Test language switching in browser
- [ ] Verify UI doesn't break with different languages
- [ ] Check browser console for missing key warnings

---

## Example: Complete Component Translation

### Before Translation:

```jsx
import React, { useState } from "react";

const ShipmentList = () => {
  const [search, setSearch] = useState("");

  return (
    <div>
      <h1>Shipments Overview</h1>

      <div>
        <input
          placeholder="Search by Shipment ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button>Add New</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Shipment ID</th>
            <th>Status</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>SH-001</td>
            <td>Pending</td>
            <td>2024-01-15</td>
            <td>
              <button>Edit</button>
              <button>Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default ShipmentList;
```

### After Translation:

#### 1. Add keys to translation files:

**`en.json`:**

```json
{
  "Shipments Overview": "Shipments Overview",
  "Search by Shipment ID": "Search by Shipment ID",
  "Add New": "Add New",
  "Shipment ID": "Shipment ID",
  "Status": "Status",
  "Date": "Date",
  "Actions": "Actions",
  "Pending": "Pending",
  "Edit": "Edit",
  "Delete": "Delete"
}
```

**`id.json`:**

```json
{
  "Shipments Overview": "Ringkasan Pengiriman",
  "Search by Shipment ID": "Cari berdasarkan ID Pengiriman",
  "Add New": "Tambah Baru",
  "Shipment ID": "ID Pengiriman",
  "Status": "Status",
  "Date": "Tanggal",
  "Actions": "Tindakan",
  "Pending": "Menunggu",
  "Edit": "Edit",
  "Delete": "Hapus"
}
```

**`ar.json`:**

```json
{
  "Shipments Overview": "نظرة عامة على الشحنات",
  "Search by Shipment ID": "البحث عن طريق معرف الشحنة",
  "Add New": "إضافة جديد",
  "Shipment ID": "معرف الشحنة",
  "Status": "الحالة",
  "Date": "التاريخ",
  "Actions": "الإجراءات",
  "Pending": "قيد الانتظار",
  "Edit": "تعديل",
  "Delete": "حذف"
}
```

#### 2. Update component:

```jsx
import React, { useState } from "react";
import { useTranslation } from "react-i18next"; // ✅ Added

const ShipmentList = () => {
  const { t } = useTranslation(); // ✅ Added
  const [search, setSearch] = useState("");

  return (
    <div>
      <h1>{t("Shipments Overview")}</h1> {/* ✅ Translated */}

      <div>
        <input
          placeholder={t("Search by Shipment ID")} {/* ✅ Translated */}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button>{t("Add New")}</button> {/* ✅ Translated */}
      </div>

      <table>
        <thead>
          <tr>
            <th>{t("Shipment ID")}</th> {/* ✅ Translated */}
            <th>{t("Status")}</th> {/* ✅ Translated */}
            <th>{t("Date")}</th> {/* ✅ Translated */}
            <th>{t("Actions")}</th> {/* ✅ Translated */}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>SH-001</td>
            <td>{t("Pending")}</td> {/* ✅ Translated */}
            <td>2024-01-15</td>
            <td>
              <button>{t("Edit")}</button> {/* ✅ Translated */}
              <button>{t("Delete")}</button> {/* ✅ Translated */}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default ShipmentList;
```

---

## Need Help?

If you encounter issues or have questions:

1. Check this guide first
2. Review existing translated components in `src/pages/Operations/`
3. Check browser console for i18next warnings
4. Verify translation files are valid JSON
5. Ask the team for assistance

---

**Last Updated:** 2024
**Maintained by:** Development Team
