import React, { useState, useEffect, useContext } from "react";
import { AdminContext } from "@/context/AdminContext";
import { Monitor, Clock, ArrowLeft } from "lucide-react";
import DropdownBasic from "@/page-layouts/components/DropdownBasic";
import { useHistory } from "react-router-dom";

const PosHeader = ({
  orderNumber,
  businesses = [],
  selectedBusiness,
  onBusinessChange,
}) => {
  const {
    state: { adminInfo },
  } = useContext(AdminContext);
  const history = useHistory();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const cashierName =
    adminInfo?.name || adminInfo?.email?.split("@")[0] || "Cashier";

  const currentBizName =
    businesses.find((b) => b._id === selectedBusiness)?.name || "";

  return (
    <header className="flex items-center justify-between h-[52px] px-4 bg-white border-b border-gray-200 shrink-0">
      {/* Left: back + branding */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => history.push("/dashboard")}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          title="Back to Dashboard"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <Monitor size={18} className="text-[var(--p-blue)]" />
          <span className="text-sm font-bold text-gray-800">POS Terminal</span>
        </div>
        {orderNumber && (
          <span className="ml-2 px-2 py-0.5 text-[10px] font-medium bg-[var(--p-blue)]/10 text-[var(--p-blue)] rounded-full">
            {orderNumber}
          </span>
        )}
      </div>

      {/* Right: business selector + cashier + clock */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        {/* Business selector (only if multiple businesses) */}
        {businesses.length > 1 ? (
          <div className="w-[320px]">
            <DropdownBasic
              value={selectedBusiness}
              onChange={(value) => onBusinessChange(value || "")}
              options={businesses.map((b) => ({
                value: b._id,
                label: b.name,
              }))}
              placeholder="Select Business"
              width="320px"
              appearance="filterPill"
              isClearable={true}
            />
          </div>
        ) : (
          currentBizName && (
            <span className="text-xs font-medium text-gray-600">
              {currentBizName}
            </span>
          )
        )}
        <span>{cashierName}</span>
        <div className="flex items-center gap-1">
          <Clock size={12} />
          <span>
            {time.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    </header>
  );
};

export default React.memo(PosHeader);
