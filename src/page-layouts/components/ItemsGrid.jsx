import React, { useState } from "react";
import { Monitor, Trash2, Eye } from "lucide-react";
import { formatDate } from "@/components/formatAmount";
import Loader from "./Loader";
import { CustomModal } from "./CustomModal";
import _ from "lodash";

const ItemsGrid = ({
  items = [],
  onDelete,
  highlightId,
  highlightKey,
  loading = false,
  renderIcon,
  showKeys,
  detailsKeys,
  renderDetails,
  renderBadge,
  renderActions,
  emptyStateTitle = "No items found",
  emptyStateSubtitle = "Add your first item to get started",
  highlightClassName = "border-[#bcd374] shadow-md",
  defaultClassName = "border-gray-100 hover:border-[#bcd374]/50",
  containerClassName = "",
  modalTitle = "Item Details",
}) => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = (item) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
  };

  const defaultRenderIcon = (item) => (
    <Monitor className="w-8 h-8 text-gray-600 group-hover:text-[#bcd374] transition-colors" />
  );

  const defaultRenderDetails = (item) => (
    <div className="space-y-2">
      {Object.entries(item)
        .filter(
          ([key]) =>
            !["_id", "id", "deviceType", "deviceLabel"].includes(key) &&
            showKeys?.includes(key)
        )
        .map(([key, value]) => (
          <div key={key} className="text-sm">
            <span className="text-gray-500">
              {key === "ipAddress" ? "IP Address" : _.startCase(key)}:
            </span>{" "}
            <span className="text-gray-700">
              {key.toLowerCase().includes("date") ||
              key.toLowerCase().includes("used")
                ? formatDate(value)
                : value}
            </span>
          </div>
        ))}
    </div>
  );

  const renderModalContent = (item) => (
    <div className="space-y-6">
      {/* Header with Icon and Title */}
      <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
        <div className="p-3 bg-gray-50 rounded-lg">
          {renderIcon ? renderIcon(item) : defaultRenderIcon(item)}
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            {item.deviceLabel || item.title || item.name}
          </h3>
          <p className="text-sm text-gray-500">
            {item.deviceType && _.capitalize(item.deviceType)}
          </p>
        </div>
      </div>

      {/* Complete Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {detailsKeys?.map((key) => {
          const value = item[key];
          if (value === undefined || value === null) return null;

          return (
            <div key={key} className="space-y-1">
              <span className="text-sm font-medium text-gray-500">
                {key === "ipAddress" ? "IP Address" : _.startCase(key)}:
              </span>
              <div className="text-sm text-gray-700">
                {key.toLowerCase().includes("date") ||
                key.toLowerCase().includes("used") ||
                key.toLowerCase().includes("created")
                  ? formatDate(value)
                  : typeof value === "boolean"
                  ? value
                    ? "Yes"
                    : "No"
                  : String(value)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const defaultRenderBadge = (item) => {
    if (!item.isActive && typeof item.isActive !== "boolean") return null;
    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${
          item.isActive
            ? "text-green-600 bg-green-50"
            : "text-gray-600 bg-gray-50"
        }`}
      >
        {item.isActive ? "Active" : "Inactive"}
      </span>
    );
  };

  const defaultRenderActions = (item) => {
    return (
      <div className="flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            openModal(item);
          }}
          className="p-2 text-gray-400 hover:text-[#bcd374] rounded-lg hover:bg-[#bcd374]/10"
          title="View Details"
        >
          <Eye className="w-4 h-4" />
        </button>
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item._id || item.id);
            }}
            className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader size="lg" />
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <Monitor className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-lg">{emptyStateTitle}</p>
        <p className="text-sm">{emptyStateSubtitle}</p>
      </div>
    );
  }

  return (
    <>
      <div
        className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${containerClassName}`}
      >
        {items.map((item) => {
          const itemId = item._id || item.id;
          const isHighlighted =
            highlightId &&
            (item._id === highlightId ||
              item.id === highlightId ||
              item[highlightKey] === highlightId);
          return (
            <div
              key={itemId}
              className={`group relative bg-white rounded-lg border hover:shadow-lg cursor-pointer ${
                isHighlighted ? highlightClassName : defaultClassName
              }`}
              onClick={() => openModal(item)}
            >
              <div className="p-4 pb-6">
                {/* Header: Icon and Title */}
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className={`p-3 bg-gray-50 rounded-lg ${
                      isHighlighted ? "bg-[#bcd374]/10" : ""
                    } group-hover:bg-[#bcd374]/10`}
                  >
                    {renderIcon ? renderIcon(item) : defaultRenderIcon(item)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">
                      {item.deviceLabel || item.title || item.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {item.deviceType && _.capitalize(item.deviceType)}
                    </p>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 mb-6">
                  {renderDetails
                    ? renderDetails(item)
                    : defaultRenderDetails(item)}
                </div>

                {/* Badge */}
                <div className="absolute bottom-1 right-1">
                  {renderBadge ? renderBadge(item) : defaultRenderBadge(item)}
                </div>

                {/* Actions */}
                <div className="absolute top-1 right-1">
                  {renderActions
                    ? renderActions(item)
                    : defaultRenderActions(item)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Details Modal */}
      <CustomModal
        open={isModalOpen}
        onClose={closeModal}
        title={modalTitle}
        showActions={false}
      >
        {selectedItem && renderModalContent(selectedItem)}
      </CustomModal>
    </>
  );
};

export { ItemsGrid };
