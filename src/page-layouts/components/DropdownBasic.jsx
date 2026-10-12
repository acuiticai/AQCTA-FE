import React from "react";
import Select from "react-select";
import CreatableSelect from "react-select/creatable";
import BusinessDropdown from "./helpers/BusinessDropdown";
import _ from "lodash";
import { sortAlphabetically } from "@/utils/sortAlphabetically";
import { AdminContext } from "@/context/AdminContext";
import { useContext } from "react";

const DropdownBasic = ({
  options = [],
  value = "",
  onChange,
  placeholder,
  className = "",
  style = {},
  error = "",
  shouldShowError = false,
  showErrorText = true,
  grouped = false,
  isMulti = false,
  isCreatable = false,
  customClassName = "",
  isDisabled = false,
  inActive = false,
  size = "md", // size can be 'sm', 'md', 'lg'
  // dedicatedly for business dropdown
  isBusinessDropdown = false,
  businessDropdownProps = {},
  theme = "",
  defaultMenuPlacement = false,
  menuHeight = "300px",
  sortOptions = true,
  isClearable = true,
  /** Match Add Account / SearchableDropdown: full-width in forms; pass a px width for compact toolbars. */
  width = "100%",
  /**
   * "filterPill" = DataTable filters.
   * "document" = invoice / order header fields (white, rounded-lg, ~phone-fax sizing).
   */
  appearance = "default",
  /** When using `appearance="document"`, use gray focus ring/border instead of primary (orange) — e.g. Selection Criteria card. */
  documentNeutralFocus = false,
  /**
   * When `isMulti`, resolve chip/value objects from this list instead of `options`.
   * Use when `options` is filtered for the menu (e.g. hide already-selected rows) but labels must still match selected ids.
   */
  multiValueSourceOptions,
  ...props
}) => {
  const { styles: overrideStyles } = props;
  // Helper to check for 'All' or 'all'
  const isFirstOption = (option) =>
    _.toLower(option?.label) === "all" ||
    _.toLower(option?.value) === "all" ||
    option?.first;

  const isLastOption = (option) => option?.last;

  const formatOptions = () => {
    if (!grouped && options.length > 0) {
      const firstOptions = options.filter(isFirstOption);
      const lastOptions = options.filter(isLastOption);
      const emptyValueOptions = options.filter(
        (option) =>
          !isFirstOption(option) &&
          !isLastOption(option) &&
          (option?.value === "" ||
            option?.value === null ||
            option?.value === undefined),
      );
      const otherOptions = options.filter(
        (option) =>
          !isFirstOption(option) &&
          option?.value !== "" &&
          option?.value != null &&
          !isLastOption(option),
      );

      const otherSorted = sortOptions
        ? sortAlphabetically(otherOptions, "label")
        : otherOptions;

      // 🟢 Ensure firstOptions always come first, unsorted
      const formatted = [
        ...firstOptions,
        ...emptyValueOptions,
        ...otherSorted,
        ...lastOptions,
      ].map((option) => ({
        ...option,
        label: option.label,
        value: option.value,
      }));

      // Avoid passing [] to react-select (breaks control layout when only placeholders exist)
      if (formatted.length === 0) {
        return options.map((option) => ({
          ...option,
          label: option.label,
          value: option.value,
        }));
      }

      return formatted;
    }

    const groupedOptions = options
      .filter((option) => option.value !== "")
      .map((groupItem) => {
        const raw = groupItem.options || [];
        const groupOptions = sortOptions
          ? sortAlphabetically(raw, "label")
          : raw;

        return {
          label: groupItem.label || groupItem.group, // Use label if available, fallback to group
          options: groupOptions.map((option) => ({
            label: option.label,
            value: option.value,
          })),
        };
      });

    return sortOptions
      ? sortAlphabetically(groupedOptions, "label")
      : groupedOptions;
  };

  const formatValue = () => {
    if (value === "" || value === null || value === undefined) {
      return isMulti ? [] : null;
    }

    if (isMulti) {
      if (!Array.isArray(value)) return [];
      if (isCreatable) {
        return value.map((v) => ({ label: v, value: v }));
      }
      const source =
        Array.isArray(multiValueSourceOptions) && multiValueSourceOptions.length > 0
          ? multiValueSourceOptions
          : options;
      return value
        .map((v) => {
          if (v == null || v === "") return null;
          const sv = String(v);
          return source.find((opt) => String(opt.value) === sv) ?? null;
        })
        .filter(Boolean);
    }

    // Handle grouped options
    if (grouped) {
      for (const group of options) {
        const foundOption = group.options?.find(
          (opt) => String(opt.value) === String(value),
        );
        if (foundOption) {
          return foundOption;
        }
      }
      return isCreatable && value ? { label: value, value } : null;
    }

    const found = options.find((opt) => String(opt.value) === String(value));
    if (found) return found;
    return isCreatable && value ? { label: value, value } : null;
  };

  const handleSelectChange = async (selectedOption) => {
    if (isMulti) {
      // if (selectedOption?.at?.(-1)?.is_disabled === true) {
      //   return
      // }
      onChange(selectedOption?.map((opt) => opt.value) || []);
    } else {
      onChange(selectedOption?.value ?? "");
    }
  };

  const customStyles = {
    // Control: align with SearchableDropdown on Add Account (white field, gray-300 border, rounded-lg)
    control: (provided, state) => {
      const err = Boolean(error && shouldShowError);
      const openOrFocused = state.isFocused || state.menuIsOpen;
      const border = err
        ? "2px solid #EF4444"
        : openOrFocused
          ? "2px solid var(--p-blue)"
          : "1px solid #D1D5DB";
      const bg = "#f3f4f6";
      return {
        ...provided,
        display: "flex",
        flexDirection: "row",
        // Keep value + chevron on one row (default react-select uses flex-wrap: wrap)
        flexWrap: isMulti ? provided.flexWrap : "nowrap",
        border,
        borderRadius: "12px",
        boxShadow: "none",
        minHeight: "38px",
        alignItems: "center",
        backgroundColor: bg,
        padding: "2px 8px",
        // Avoid minWidth: "100%" which overflows grid cells and breaks the control box
        minWidth: 0,
        width: style?.width ?? (width === "100%" ? "100%" : width),
        maxWidth: "100%",
        color: state.isDisabled ? "#9ca3af" : provided.color,
        cursor: state.isDisabled ? "not-allowed" : "pointer",
        opacity: state.isDisabled ? 0.65 : 1,
        "&:hover": {
          boxShadow: "none",
          border: err
            ? "2px solid #EF4444"
            : openOrFocused
              ? "2px solid var(--p-blue)"
              : "1px solid #9CA3AF",
        },
        ...(inActive && {
          pointerEvents: "none",
          color: "var(--p-blue-dark)",
        }),
      };
    },
    valueContainer: (provided) => ({
      ...provided,
      ...(isMulti
        ? {}
        : {
            flexWrap: "nowrap",
            minWidth: 0,
            overflow: "hidden",
          }),
    }),
    indicatorsContainer: (provided) => ({
      ...provided,
      flexShrink: 0,
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? "var(--p-blue-light)"
        : state.isFocused
          ? "var(--gray-100)"
          : "white",
      color: state.isSelected ? "white" : "var(--p-black)",
      "&:active": {
        color: state.isSelected ? "white" : "var(--p-black)",
        backgroundColor: state.isSelected
          ? "var(--p-blue-light)"
          : state.isFocused
            ? "var(--gray-100)"
            : "white",
      },
    }),
    multiValue: (provided) => ({
      ...provided,
      backgroundColor: "var(--p-gray-dark)",
      borderRadius: "8px",
      margin: "4px",
      marginLeft: "0px",
      color: inActive ? "var(--p-blue-dark)" : "black",
    }),
    multiValueLabel: (provided) => ({
      ...provided,
      color: inActive ? "var(--p-blue-dark)" : "black",
    }),
    multiValueRemove: (provided) => ({
      ...provided,
      color: inActive ? "var(--p-blue-dark)" : "black",
      borderRadius: "0px 8px 8px 0px",
    }),
    singleValue: (base, state) => ({
      ...base,
      color: state.isDisabled
        ? "lightgray"
        : inActive
          ? "var(--p-blue-dark)"
          : base.color,
    }),
    placeholder: (provided, state) => ({
      ...provided,
      color: state.isDisabled
        ? "lightgray"
        : inActive
          ? "var(--p-blue-light-2)"
          : "var(--placeholder-text)",
    }),
  };

  const documentAppearanceOverrides =
    appearance === "document"
      ? {
        control: (provided, state) => {
          const err = Boolean(error && shouldShowError);
          const openOrFocused = state.isFocused || state.menuIsOpen;
          const base = customStyles.control(provided, state);
          const neutral = documentNeutralFocus;
          const borderIdle = "1px solid #D1D5DB";
          const borderHover = "1px solid #9CA3AF";
          const borderFocusPrimary = "1px solid var(--p-blue)";
          const borderFocusNeutral = "1px solid #9CA3AF";
          const focusBorder = neutral
            ? borderFocusNeutral
            : borderFocusPrimary;
          const focusShadow = neutral ? "none" : "0 0 0 1px var(--p-blue)";
          return {
            ...base,
            borderRadius: "8px",
            minHeight: "42px",
            padding: "2px 10px",
            border: err
              ? "2px solid #EF4444"
              : openOrFocused
                ? focusBorder
                : borderIdle,
            boxShadow: openOrFocused ? focusShadow : "none",
            fontSize: "14px",
            "&:hover": {
              ...base["&:hover"],
              boxShadow: "none",
              border: err
                ? "2px solid #EF4444"
                : openOrFocused
                  ? focusBorder
                  : borderHover,
            },
          };
        },
        valueContainer: (provided) => ({
          ...provided,
          paddingLeft: 2,
          paddingRight: 2,
        }),
      }
      : null;

  const filterPillStyleOverrides =
    appearance === "filterPill"
      ? {
        control: (provided, state) => {
          const err = Boolean(error && shouldShowError);
          const openOrFocused = state.isFocused || state.menuIsOpen;
          const base = customStyles.control(provided, state);
          return {
            ...base,
            backgroundColor:
              state.isDisabled || inActive ? "#E5E7EB" : "#F3F4F6",
            border: err
              ? "2px solid #EF4444"
              : openOrFocused
                ? "1px solid #D1D5DB"
                : "1px solid transparent",
            borderRadius: "10px",
            boxShadow: "none",
            minHeight: "36px",
            padding: "2px 8px 2px 6px",
            "&:hover": {
              boxShadow: "none",
              border: err
                ? "2px solid #EF4444"
                : openOrFocused
                  ? "1px solid #D1D5DB"
                  : "1px solid #E5E7EB",
            },
          };
        },
        placeholder: (provided, state) => ({
          ...customStyles.placeholder(provided, state),
          color: state.isDisabled ? "#9ca3af" : "#94a3b8",
        }),
        singleValue: (provided, state) => ({
          ...customStyles.singleValue(provided, state),
          color: state.isDisabled ? "#9ca3af" : "#475569",
        }),
        indicatorSeparator: (provided) => ({
          ...provided,
          backgroundColor: "#D1D5DB",
          marginTop: 10,
          marginBottom: 10,
        }),
        dropdownIndicator: (provided, state) => ({
          ...provided,
          color: "#9CA3AF",
          padding: "4px 2px 4px 6px",
          opacity: state.isDisabled ? 0.5 : 1,
        }),
        clearIndicator: (provided) => ({
          ...provided,
          color: "#9CA3AF",
          padding: "4px 4px 4px 2px",
        }),
        valueContainer: (provided) => ({
          ...provided,
          paddingLeft: 4,
          paddingRight: 4,
        }),
      }
      : null;

  const mergedStyles =
    filterPillStyleOverrides || documentAppearanceOverrides
      ? {
        ...customStyles,
        ...(documentAppearanceOverrides || {}),
        ...(filterPillStyleOverrides || {}),
      }
      : customStyles;

  const composeSelectStyles = (baseStyles, incomingStyles) => {
    if (!incomingStyles) return baseStyles;
    const output = { ...baseStyles };
    Object.entries(incomingStyles).forEach(([key, incomingStyle]) => {
      const baseStyle = baseStyles[key];
      if (typeof incomingStyle === "function") {
        output[key] = (provided, state) => {
          const baseResult =
            typeof baseStyle === "function"
              ? baseStyle(provided, state)
              : provided;
          return incomingStyle(baseResult, state);
        };
      } else if (incomingStyle && typeof incomingStyle === "object") {
        const baseResult =
          typeof baseStyle === "function" ? {} : (baseStyle || {});
        output[key] = { ...baseResult, ...incomingStyle };
      } else {
        output[key] = incomingStyle;
      }
    });
    return output;
  };

  const resolvedStyles = composeSelectStyles(mergedStyles, overrideStyles);

  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  const placeholderValue =
    placeholder ||
    (!grouped && options?.length && !options?.[0]?.value
      ? options?.[0]?.label
      : "Select");

  const SelectComponent = isCreatable ? CreatableSelect : Select;

  return (
    <>
      {isBusinessDropdown ? (
        <BusinessDropdown
          adminId={businessDropdownProps.adminId || adminInfo?.id}
          {...businessDropdownProps}
          isClearable={isClearable}
          size={size}
          customClassName={`${className} ${customClassName}`}
        />
      ) : (
        <div
          className={`w-full min-w-0 max-w-full epics-dropdown${
            appearance === "document" ? " epics-dropdown--document" : ""
          }`}
        >
          <SelectComponent
            options={formatOptions()}
            value={formatValue()}
            onChange={handleSelectChange}
            placeholder={placeholderValue}
            className={`epics-dropdown ${className} ${customClassName}`.trim()}
            classNamePrefix="epics-dropdown"
            instanceId={
              props.name
                ? `epics-${String(props.name).replace(/[^a-zA-Z0-9_-]/g, "-")}`
                : undefined
            }
            styles={{
              ...resolvedStyles,
              menuPortal: (base, state) => ({
                ...(typeof resolvedStyles.menuPortal === "function"
                  ? resolvedStyles.menuPortal(base, state)
                  : base),
                zIndex: 2147483647,
                pointerEvents: "auto",
              }),
              menu: (base, state) => ({
                ...(typeof resolvedStyles.menu === "function"
                  ? resolvedStyles.menu(base, state)
                  : base),
                borderRadius: appearance === "filterPill" ? "10px" : "12px",
                border: "1px solid #D1D5DB",
                boxShadow:
                  "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
                overflow: "hidden",
                zIndex: 2147483647,
                pointerEvents: "auto",
              }),
            }}
            menuPortalTarget={
              typeof window !== "undefined" ? document.body : null
            }
            menuShouldBlockScroll={false}
            menuShouldScrollIntoView={false}
            openMenuOnClick
            isMulti={isMulti}
            isDisabled={isDisabled}
            menuPlacement="auto"
            menuPosition="fixed"
            isClearable={isClearable}
            name={props.name}
            onBlur={props.onBlur}
            inputId={
              props.inputId ||
              props.id ||
              (props.name
                ? `epics-input-${String(props.name).replace(/[^a-zA-Z0-9_-]/g, "-")}`
                : undefined)
            }
          />
        </div>
      )}
      {error && shouldShowError && showErrorText && (
        <p className="text-red-500 text-xs mt-1">{error}</p>
      )}
    </>
  );
};

export default DropdownBasic;
