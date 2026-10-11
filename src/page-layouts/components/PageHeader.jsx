import React from "react";
import { FiPlus, FiMoreVertical } from "react-icons/fi";
import useButtonColor from "@/hooks/useButtonColor";
import { BackButton, FormInput } from "../index";
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
      <div className="flex items-center flex-wrap gap-2 min-w-0">
        {filters.map((field) => (
          <FormInput key={field.name} {...field} />
        ))}
      </div>
    ) : null;

  if (isLarge) {
    return (
      <div className="mb-8 w-full">
        {showBackButton && (
          <BackButton
            onClick={onBackClick}
            fallbackPath={backFallbackPath}
            className="mb-4 !mt-0"
          />
        )}

        <div className="flex w-full min-w-0 flex-col gap-4 rounded-[18px] border border-[#e6eef6] bg-white p-5 shadow-[0_10px_30px_rgba(7,16,31,0.05)] lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div className="min-w-0 flex-1">
            <div
              className="mb-2 h-1.5 w-12 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, #FE0032 0%, #C5061A 50%, #A30516 100%)",
              }}
            />
            <h1
              className="truncate text-3xl font-bold tracking-tight text-[#07101f]"
              style={{ fontFamily: '"Outfit", "Plus Jakarta Sans", sans-serif' }}
            >
              {title}
            </h1>
            {description ? (
              <p className="mt-2 text-[15px] text-[#5a6b80]">{description}</p>
            ) : null}
          </div>

          {hasActions && (
            <div
              className={`flex w-full min-w-0 max-w-full flex-wrap items-center justify-end gap-3 lg:w-auto lg:gap-4 ${actionsContainerClassName}`}
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
  }

  return (
    <div className="w-full">
      <div
        className={`mb-6 flex w-full flex-wrap justify-between gap-3 rounded-[18px] border border-[#e6eef6] bg-white px-4 py-4 shadow-[0_10px_30px_rgba(7,16,31,0.05)] sm:px-5 ${
          description ? "items-start" : "items-center"
        }`}
      >
        <div
          className={`flex min-w-0 flex-1 gap-3 ${
            description ? "items-start" : "items-center"
          }`}
        >
          {showBackButton && (
            <BackButton
              compact
              onClick={onBackClick}
              fallbackPath={backFallbackPath}
              className={description ? "mt-0.5" : ""}
            />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div
              className="mb-1 h-1 w-10 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, #FE0032 0%, #C5061A 50%, #A30516 100%)",
              }}
            />
            <h1
              className="truncate text-xl font-bold leading-tight tracking-tight text-[#07101f]"
              style={{ fontFamily: '"Outfit", "Plus Jakarta Sans", sans-serif' }}
            >
              {title}
            </h1>
            {description ? (
              <p className="text-sm text-[#5a6b80]">{description}</p>
            ) : null}
          </div>
        </div>

        {hasActions && (
          <div
            className={`flex items-center flex-wrap gap-2 w-full 2xl:w-auto justify-end min-w-0 ${actionsContainerClassName}`}
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
