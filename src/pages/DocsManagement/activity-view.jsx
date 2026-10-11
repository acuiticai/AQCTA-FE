import FileTypeIcon from "./FileIcon"; // Import FileTypeIcon
import { useTranslation } from "react-i18next";

const ActivityView = ({ activities }) => {
  const { t } = useTranslation();
  const dm = (key, defaultValue, options = {}) =>
    t(`docsManagement.${key}`, { defaultValue, ...options });

  return (
    <div className="p-4">
      {activities.map((group, index) => (
        <div key={index} className="mb-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">
            {group.period}
          </h3>
          {group.items.map((activity, activityIndex) => (
            <div key={activityIndex} className="mb-4">
              <div className="flex items-start space-x-3 mb-2">
                <img
                  src={
                    activity.userAvatar || "/placeholder.svg?height=32&width=32"
                  }
                  alt={activity.userName}
                  className="w-8 h-8 rounded-full"
                />
                <div>
                  <p className="text-sm">
                    <span className="font-medium">{activity.userName}</span>{" "}
                    {activity.action}
                  </p>
                  <p className="text-xs text-gray-500">{activity.timestamp}</p>
                </div>
              </div>
              <div className="pl-11 space-y-2">
                {activity.files.map((file, fileIndex) => (
                  <div
                    key={fileIndex}
                    className="flex items-center space-x-2 p-2 bg-gray-50 rounded"
                  >
                    <FileTypeIcon type={file.type} />
                    <span className="text-sm text-gray-900">{file.name}</span>
                  </div>
                ))}
              </div>
              <button className="text-sm text-[var(--p-blue)] pl-11 mt-2 hover:underline">
                {dm("showAll", "Show All")}
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default ActivityView;
