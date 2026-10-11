import { useState } from "react";
import { IoInformationCircle } from "react-icons/io5";
import { formatDate, formatTime } from "./formatAmount";

const VersionInfo = () => {
  const version = import.meta.env.VITE_APP_VERSION || __APP_VERSION__;
  const deployDate =
    import.meta.env.VITE_APP_DEPLOY_DATE || __APP_DEPLOY_DATE__;
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="fixed bottom-1 right-2 z-50"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <IoInformationCircle className="w-6 h-6 text-gray-500 cursor-help" />

      {showTooltip && (
        <div className="absolute bottom-full right-1 mb-2 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg text-xs text-gray-500 dark:text-gray-400 min-w-[240px]">
          {version && deployDate ? (
            <>
              <div>
                <b>Version: </b> {version}
              </div>
              <div>
                <b>Last Deployment: </b>
                {formatDate(deployDate)}, {formatTime(deployDate)}
              </div>
            </>
          ) : (
            <div>Deployment information is not available.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default VersionInfo;
