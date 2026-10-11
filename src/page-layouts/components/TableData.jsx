import { Tooltip } from "react-tooltip";
import { useId } from "react";
import { extractContent } from "@/utils/generic";

export const TableData = ({ children, tooltip, className = "" }) => {
  const tooltipId = useId();

  const content = extractContent(children);

  return (
    <td className={`py-2 px-4 w-full ${className}`}>
      <div
        className="max-w-fit !overflow-hidden !text-ellipsis !whitespace-nowrap"
        data-tooltip-id={tooltipId}
        data-tooltip-content={
          tooltip || (content != "-" && content != "N/A" ? content : undefined)
        }
      >
        <Tooltip
          id={tooltipId}
          effect="solid"
          style={{
            zIndex: 1000,
          }}
          delayShow={200}
          noArrow={true}
          className="!bg-white !text-gray-800 !border !border-gray-300 !opacity-100 !max-w-fit !max-h-fit !overflow-hidden"
        />
        {children}
      </div>
    </td>
  );
};
