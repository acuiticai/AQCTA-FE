import useButtonColor from "@/hooks/useButtonColor";
import FormInput from "./FormInput";
import PageHeader from "./PageHeader";
import BackButton from "./BackButton";
import Loader from "./Loader";
import FooterButtons from "./FooterButtons";
import { notifyError, notifySuccess } from "@/utils/toast";
import { useMemo, useState } from "react";
import { filterFormFieldsForSingleBusiness } from "@/utils/singleBusinessFormFields";

const Form = ({
  formFields = [],
  handleSubmit,
  handleCancel,
  isOpen = true,
  showBackButton = false,
  onBackClick,
  title = "",
  customLabelWidth = "w-1/4",
  submitSuccessMessage = "",
  submitErrorMessage = "",
  afterSubmit,
  showFooterButtons = true,
  noDefaultValidation = false,
  fieldsPerRow = 1,
  labelAndFieldDirection = "row",
  isLoading = false,
  disableReSubmission = true,
  showCancelButton = true,
  cancelButtonText = "Cancel",
  saveButtonText = "Save",
  isSubmitting = false,
  isView = false,
  extendedFooterButtons = [],
  disableSaveButton = false,
  /** Override theme button color (e.g. live preview on Configurations). */
  buttonColor: buttonColorProp,
  /** Rendered after form fields, immediately above Save / Cancel (e.g. custom fields). */
  beforeFooter = null,
  /** Tailwind classes: vertical rhythm on the <form> (between field block, beforeFooter, footer). */
  formOuterSpacingClassName = "space-y-6 mt-4",
  /** Tailwind classes: vertical gap between each row of fields. */
  fieldsStackSpacingClassName = "space-y-6",
  /** Tailwind classes: horizontal/vertical gap inside a multi-column row (grid). */
  fieldsRowGapClassName = "gap-6",
  /** Tighten vertical space between label and input for all fields in this form. */
  tightLabelInputSpacing = false,
}) => {
  const themeButtonColor = useButtonColor();
  const buttonColor = buttonColorProp || themeButtonColor;
  const [loading, setLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Cap fieldsPerRow at 2 and ensure it's at least 1
  const maxFieldsPerRow = Math.min(Math.max(fieldsPerRow, 1), 2);

  /** Preserve field order; chunk into rows by fieldsPerRow (supports colSpan). */
  const groupFieldsIntoRows = (fields, maxPerRow) => {
    const visible = fields.filter(
      (field) => field?.show === undefined || field?.show === true,
    );
    const rows = [];
    let current = [];
    let currentSlots = 0;

    const fieldSlotSize = (field) =>
      Math.min(
        Number(field?.colSpan) > 0 ? Number(field.colSpan) : 1,
        maxPerRow,
      );

    for (const field of visible) {
      if (field.fullWidth) {
        if (current.length) {
          rows.push(current);
          current = [];
          currentSlots = 0;
        }
        rows.push([field]);
        continue;
      }

      const need = fieldSlotSize(field);
      if (current.length && currentSlots + need > maxPerRow) {
        rows.push(current);
        current = [];
        currentSlots = 0;
      }
      current.push(field);
      currentSlots += need;
    }
    if (current.length) rows.push(current);
    return rows;
  };

  const fieldRows = useMemo(() => {
    const visibleFields = filterFormFieldsForSingleBusiness(formFields);
    return groupFieldsIntoRows(visibleFields, maxFieldsPerRow);
  }, [formFields, maxFieldsPerRow]);

  // Prevent form submission when Enter is pressed in dropdown/select fields
  const handleFormKeyDown = (e) => {
    if (e.key === "Enter") {
      const activeElement = document.activeElement;
      const target = e.target;
      
      // Check if react-select menu is currently open anywhere on the page
      const reactSelectMenus = document.querySelectorAll('[class*="react-select__menu"], [id*="react-select"]');
      const isReactSelectMenuOpen = Array.from(reactSelectMenus).some(menu => {
        const style = window.getComputedStyle(menu);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      });
      
      // Check if the active element or target is inside a react-select component
      const isInReactSelect = activeElement?.closest('[class*="react-select"]') ||
                              target?.closest('[class*="react-select"]') ||
                              activeElement?.closest('[id*="react-select"]') ||
                              target?.closest('[id*="react-select"]');
      
      // Check if the active element is a select dropdown
      const isSelectElement = activeElement?.tagName === "SELECT" || target?.tagName === "SELECT";
      
      // Check if the active element is in a searchable dropdown
      const isInSearchableDropdown = activeElement?.closest('[class*="searchable-dropdown"]') ||
                                     target?.closest('[class*="searchable-dropdown"]') ||
                                     activeElement?.closest('[class*="dropdown"]') ||
                                     target?.closest('[class*="dropdown"]');
      
      // Check if input is a react-select input
      const isReactSelectInput = activeElement?.getAttribute('id')?.includes('react-select') ||
                                target?.getAttribute('id')?.includes('react-select') ||
                                activeElement?.classList.toString().includes('react-select') ||
                                target?.classList.toString().includes('react-select');
      
      // If any of these conditions are true, prevent form submission
      if (isReactSelectMenuOpen || isInReactSelect || isSelectElement || isInSearchableDropdown || isReactSelectInput) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }
  };

  return isLoading ? (
    <div className="flex justify-center items-center h-full">
<Loader />
    </div>
  ) : (
    <form
      noValidate
      onKeyDown={handleFormKeyDown}
      onSubmit={async (e) => {
        try {
          e.preventDefault();
          e.stopPropagation();
          setLoading(true);
          const response = await handleSubmit(e);
          if (submitSuccessMessage) {
            if (response?.success) {
              notifySuccess(submitSuccessMessage, afterSubmit);
              setIsSubmitted(true);
            }
          }

          setLoading(false);
        } catch (error) {
          notifyError(
            submitErrorMessage || error?.message || "Something went wrong"
          );
          console.error(error);
          setLoading(false);
        }
      }}
      className={formOuterSpacingClassName}
    >
      {" "}
      {showBackButton && <BackButton onClick={onBackClick} />}
      {title && <PageHeader title={title} />}
      <div className="rounded-xl relative">
        {isOpen && (
          <div className={fieldsStackSpacingClassName}>
            {fieldRows.map((row, rowIndex) => (
              <div
                key={rowIndex}
                className={`grid ${fieldsRowGapClassName} items-start ${
                  maxFieldsPerRow === 1 ||
                  row?.some((field) => field?.fullWidth)
                    ? "grid-cols-1"
                    : maxFieldsPerRow === 2
                    ? "grid-cols-2"
                    : "grid-cols-1"
                }`}
                style={{ alignItems: "stretch" }}
              >
                {row.map((field, fieldIndex) => {
                  const slotsBefore = row
                    .slice(0, fieldIndex)
                    .reduce(
                      (sum, f) =>
                        sum +
                        Math.min(
                          Number(f?.colSpan) > 0 ? Number(f.colSpan) : 1,
                          maxFieldsPerRow,
                        ),
                      0,
                    );
                  const rowHeadroom = Math.max(0, maxFieldsPerRow - slotsBefore);

                  return (
                    <div
                      key={rowIndex + fieldIndex + field?.name}
                      className={
                        field?.mergeIntoParentGrid
                          ? "contents"
                          : `w-full min-w-0 flex flex-col ${
                              field?.colSpan === 2 && maxFieldsPerRow === 2
                                ? "col-span-2"
                                : ""
                            }`
                      }
                    >
                      {field.icon &&
                        console.log("Field icon for", field.name, field.icon)}
                      <FormInput
                        {...field}
                        description={field.description || field.helpText}
                        tightLabelInputSpacing={
                          field?.tightLabelInputSpacing ?? tightLabelInputSpacing
                        }
                        defaultRequired={
                          noDefaultValidation ? false : field?.required
                        }
                        direction={
                          field?.direction || labelAndFieldDirection || "row"
                        }
                        customLabelWidth={customLabelWidth}
                        rowHeadroom={
                          field?.mergeIntoParentGrid ? rowHeadroom : 0
                        }
                      />
                    </div>
                  );
                })}
                {Array.from({
                  length: Math.max(
                    0,
                    maxFieldsPerRow -
                      row.reduce(
                        (sum, f) =>
                          sum +
                          Math.min(
                            Number(f?.colSpan) > 0 ? Number(f.colSpan) : 1,
                            maxFieldsPerRow,
                          ),
                        0,
                      ),
                  ),
                }).map((_, emptyIndex) => (
                  <div
                    key={`empty-${rowIndex}-${emptyIndex}`}
                    className="w-full min-w-0"
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      {beforeFooter}
      {showFooterButtons && (
        <FooterButtons
          onCancel={handleCancel}
          buttonColor={buttonColor}
          loading={isSubmitting || loading}
          disableSubmission={
            disableSaveButton ||
            (isSubmitted && disableReSubmission ? isSubmitted : false)
          }
          showCancelButton={showCancelButton}
          cancelButtonText={cancelButtonText}
          saveButtonText={saveButtonText}
          extendedButtons={extendedFooterButtons}
        />
      )}
    </form>
  );
};

export default Form;
