import React from "react";
import { FiPlus, FiMoreVertical } from "react-icons/fi";
import useButtonColor from "@/hooks/useButtonColor";
import BackButton from "./BackButton";
import FormInput from "./FormInput";
import { Tooltip } from "./Tooltip";

const DEFAULT_ADD_BUTTON_CLASS =
  "acu-btn-primary h-[42px] whitespace-nowrap flex items-center px-5 py-2 text-white text-sm font-semibold rounded-full hover:brightness-105 transition-[filter]";

const LARGE_ADD_BUTTON_CLASS =
  "acu-btn-primary flex items-center gap-2 px-6 py-3 text-white text-sm font-semibold rounded-full hover:brightness-105 transition-[filter]";

const PageHeader = ({
  title,
  /** Optional line under the title. */
  description,
  /** "default" = compact title (original). "large" = HR list-style hero header. */
  variant = "default",
  onAddNew,
  showAddButton,
  addButtonText = "Add New",
  AddNewButtonIcon,
  addNewButtonClassName = "",
  moreOptions = [],
  onMoreOptionsClick,
  showBackButton = false,
  onBackClick,
  /** Passed to BackButton when using default back (no onBackClick); safe list route after deep links. */
  backFallbackPath = "/",
  filters = [],
  CustomFilterComponent,
  renderActions = null,
  actionsContainerClassName = "",
  buttonColor = useButtonColor(),
  addButtonTooltip = "",
}) => {
  const isLarge = variant === "large";
  const hasActions =
    filters.length > 0 ||
    CustomFilterComponent ||
    renderActions ||
    showAddButton ||
    moreOptions.length > 0;

  const renderActionButtons = () => {
    if (!renderActions) return null;

    if (isLarge) return renderActions;

    return React.Children.map(renderActions, (child) => {
      if (!React.isValidElement(child)) return child;

      const shouldApplyButtonStyle =
        typeof child.type === "string" && child.type === "button";

      if (!shouldApplyButtonStyle) return child;

      return React.cloneElement(child, {
        className: `${DEFAULT_ADD_BUTTON_CLASS} ${child.props.className || ""}`,
      });
    });
  };

  const addButton = showAddButton ? (
    <Tooltip id="add-button-tooltip" tooltipContent={addButtonTooltip}>
      <button
        type="button"
        onClick={onAddNew}
        style={
          buttonColor
            ? {
                background: `linear-gradient(135deg, ${buttonColor} 0%, #A30516 100%)`,
              }
            : undefined
        }
        className={`${
          isLarge ? LARGE_ADD_BUTTON_CLASS : DEFAULT_ADD_BUTTON_CLASS
        } ${addNewButtonClassName}`}
        disabled={!!addButtonTooltip}
      >
        {AddNewButtonIcon ? (
          AddNewButtonIcon
        ) : (
          <FiPlus className={isLarge ? undefined : "mr-2"} size={isLarge ? 20 : undefined} />
        )}
        {addButtonText}
      </button>
    </Tooltip>
  ) : null;

  const moreOptionsButton =
    moreOptions.length > 0 ? (
      <button
        type="button"
        onClick={onMoreOptionsClick}
        className="p-2 text-gray-500 hover:text-gray-700"
      >
        <FiMoreVertical size={24} />
      </button>
    ) : null;

  const filtersBlock =
    filters.length > 0 ? (
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {filters.map((field) => (
          <FormInput key={field.name} {...field} />
        ))}
      </div>
    ) : null;

  return (
    <div className="w-full">
      {showBackButton && (
        <BackButton
          onClick={onBackClick}
          fallbackPath={backFallbackPath}
          className="mb-3 !mt-0"
          compact={!isLarge}
        />
      )}

      <div
        className={`admin-pagehead ${
          description || isLarge ? "items-start" : "items-center"
        }`}
      >
        <div className="min-w-0 flex-1">
          <h1
            className={`truncate ${
              isLarge ? "admin-pagehead__title" : "admin-pagehead__title admin-pagehead__title--sm"
            }`}
          >
            {title}
          </h1>
          {description ? (
            <p className="admin-pagehead__subtitle">{description}</p>
          ) : null}
        </div>

        {hasActions && (
          <div
            className={`flex w-full min-w-0 max-w-full flex-wrap items-center justify-end gap-2 lg:w-auto ${actionsContainerClassName}`}
          >
            {filtersBlock}
            {CustomFilterComponent && <CustomFilterComponent />}
            {renderActionButtons()}
            {addButton}
            {moreOptionsButton}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHeader;
