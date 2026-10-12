import Loader from "./Loader";
import { FiInfo } from "react-icons/fi"; // Add this at the top for the info icon

const SummaryCard = ({
  title,
  value,
  isHighlighted = false,
  iconColor,
  backgroundColor,
  Icon = null,
  renderIconAsComponent = false,
  /** When set with renderIconAsComponent, icon is shown in a filled circle (E-Invoices style). Token name for var(--token), e.g. "summary-dark" */
  iconBackdrop = "",
  size = "md",
  wrapperWidth = "100%",
  highlightColor = "green-50",
  tooltip = "",
  showPercentage = false,
}) => {
  const bgColor = isHighlighted
    ? highlightColor
    : backgroundColor
    ? backgroundColor
    : "white";

  // Show % symbol next to value for rate fields
  const isRate = title.toLowerCase().includes("rate");

  return (
    <div
      className={`admin-stat-card relative h-[${
        renderIconAsComponent && Icon ? "130px" : "96px"
      }]`}
      style={{ backgroundColor: `var(--${bgColor})` }}
    >
      {/* Tooltip Icon */}
      {tooltip && (
        <div className="absolute top-[10px] right-[10px] group cursor-pointer z-10">
          <FiInfo className="w-4 h-4 text-gray-400 hover:text-gray-700" />
          <div
            className="absolute right-0 mt-1 w-max min-w-[120px] max-w-[220px] bg-white text-gray-900 text-xs rounded px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-200 shadow-lg"
            style={{ top: "20px", right: 0, whiteSpace: "pre-line" }}
          >
            {tooltip}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-[8px]">
        {Icon && (
          <div className="flex items-center gap-2 mb-[8px]">
            {renderIconAsComponent ? (
              iconBackdrop ? (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm"
                  style={{
                    backgroundColor: iconBackdrop.startsWith("#")
                      ? iconBackdrop
                      : `var(--${iconBackdrop})`,
                  }}
                >
                  <Icon
                    className="w-5 h-5 text-white"
                    strokeWidth={2.25}
                    aria-hidden
                  />
                </div>
              ) : (
                <Icon
                  className={`w-[32px] h-[32px] rounded-lg bg-${
                    iconColor || "gray-100"
                  } fill-${iconColor || "gray-100"}`}
                  style={{ color: `var(--${iconColor || "gray-100"})` }}
                />
              )
            ) : (
              <img
                src={Icon || "/placeholder.svg"}
                alt={title}
                className={`w-[32px] h-[32px] rounded-lg bg-${
                  iconColor || "gray-100"
                } fill-${iconColor || "gray-100"}`}
              />
            )}
          </div>
        )}

        <h2
          className={`text-[${
            size === "sm" ? "12px" : "16px"
          }] font-semibold text-gray-900`}
        >
          {value}
          {isRate && <span className="ml-1 align-middle">%</span>}
        </h2>

        <span
          className={`text-gray-500 text-[${
            size === "sm" ? "10px" : "14px"
          }] font-medium`}
        >
          {title}
        </span>
      </div>
    </div>
  );
};

const SummaryCards = ({
  cards,
  columnsCount = 4,
  renderIconAsComponent = false,
  size = "md",
  showGraph = false,
  showPercentage = false,
  wrapperWidth = "100%",
  width = "100%",
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="bg-white rounded-lg py-4 w-full ml-[-10px] h-[250px] flex flex-col items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (showGraph) {
    // Find the max value for scaling
    const max = Math.max(...cards.map((card) => card.value || 0), 1);

    // Calculate the max label width (icon + title)
    const maxLabelLength = Math.max(
      ...cards.map((card) => (card.title ? card.title.length : 0))
    );
    // Estimate width: 8px per char + 32px for icon + 16px padding
    const labelWidth = Math.max(120, maxLabelLength * 7 + 48);

    return (
      <div className="w-full flex flex-col items-start justify-start">
        <div
          className="flex flex-col gap-2 w-full bg-white"
          style={{ width: width }}
        >
          {/* Graph Items */}
          <div className="space-y-2">
            {cards.map((card, idx) => {
              const barWidth = Math.max(((card.value || 0) / max) * 200, 8); // Increased max width
              const color = card.backgroundColor
                ? `rgb(var(--${card.backgroundColor}-rgb))`
                : "#3B82F6"; // Better default blue color

              return (
                <div
                  key={card.title || idx}
                  className="flex items-center justify-between w-full group hover:bg-gray-50 rounded-lg p-2 mt-6 transition-colors duration-200"
                >
                  {/* Left side: Icon and Title */}
                  <div
                    className="flex items-center gap-3 flex-shrink-0"
                    style={{
                      minWidth: `${labelWidth - 40}px`,
                      maxWidth: `${labelWidth - 40}px`,
                    }}
                  >
                    {card.Icon && (
                      <div className="flex-shrink-0">
                        {renderIconAsComponent ? (
                          <card.Icon
                            className="w-6 h-6 rounded-md p-1"
                            style={{
                              backgroundColor: `${color}20`,
                              color: color,
                            }}
                          />
                        ) : (
                          <div
                            className="w-6 h-6 rounded-md p-1 flex items-center justify-center"
                            style={{ backgroundColor: `${color}20` }}
                          >
                            <img
                              src={card.Icon || "/placeholder.svg"}
                              alt={card.title}
                              className="w-4 h-4"
                            />
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex flex-col w-fit flex-1">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {card.title}
                      </span>
                      {card.tooltip && (
                        <span className="text-xs text-gray-500 truncate">
                          {card.tooltip.split("\n")[0]}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right side: Bar and Value */}
                  <div className="flex items-center flex-1 min-w-0 ml-2">
                    {/* Progress Bar Container */}
                    <div className="flex-1 bg-gray-100 rounded-full h-2 min-w-[100px] relative overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out relative"
                        style={{
                          width: `${((card.value || 0) / max) * 100}%`,
                          background: `linear-gradient(90deg, ${color}, ${color})`,
                          minWidth: card.value > 0 ? "8px" : "0px",
                        }}
                      ></div>
                    </div>

                    {/* Value Display */}
                    <div className="flex items-center gap-2 flex-shrink-0 pr-2">
                      <span
                        className="text-sm font-bold tabular-nums min-w-[20px] text-right"
                        style={{ color: color }}
                      >
                        {card.value}
                      </span>
                      {showPercentage && (
                        <div className="text-xs text-gray-400 w-8">
                          {Math.round(((card.value || 0) / max) * 100)}%
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-${columnsCount} gap-4 mb-6`}
    >
      {cards.map((card, index) => (
        <SummaryCard
          key={index}
          title={card.title}
          value={card.value}
          isHighlighted={card.isHighlighted}
          Icon={card.Icon}
          iconColor={card.iconColor}
          backgroundColor={card.backgroundColor}
          renderIconAsComponent={card.renderIconAsComponent !== undefined ? card.renderIconAsComponent : renderIconAsComponent}
          size={size}
          wrapperWidth={wrapperWidth}
          highlightColor={card.highlightColor}
          tooltip={card.tooltip}
          showPercentage={showPercentage}
          iconBackdrop={card.iconBackdrop}
        />
      ))}
    </div>
  );
};

export default SummaryCards;
