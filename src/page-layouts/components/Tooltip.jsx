import { Tooltip as ReactTooltip } from "react-tooltip";

export const Tooltip = ({
  id = "tooltip",
  className = "!bg-white !text-gray-800 !border !border-gray-300 !opacity-100",
  noArrow = true,
  place = "top",
  tooltipContent = "",
  children,
}) => {
  return (
    <>
      <div data-tooltip-id={id} data-tooltip-content={tooltipContent}>
        {children}
      </div>
      <ReactTooltip
        id={id}
        className={className}
        noArrow={noArrow}
        place={place}
      />
    </>
  );
};
