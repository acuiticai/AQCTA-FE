import React, { useId, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import {
  eyeSvg,
  pencilSvg,
  binSvg,
  viewPdfSvg,
  approveContractSvg,
  approveSvg,
  duplicateSvg,
} from "@/assets/img/icons";
import { MdEmail } from "react-icons/md";
import { IoMdGitCompare } from "react-icons/io";
import { FaShip } from "react-icons/fa";
import { MdSwapHoriz, MdAssignment, MdClose, MdAddCircle, MdLink, MdPersonAdd, MdDescription } from "react-icons/md";
import { GiBodySwapping } from "react-icons/gi";
import { FiClock, FiDownload, FiCopy, FiSlash, FiUpload, FiTrash2 } from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";
import { FaLayerGroup } from "react-icons/fa";
import { HiDotsVertical } from "react-icons/hi";
import { QrCode, Play, ListChecks } from "lucide-react";

import { Tooltip } from "react-tooltip";

const Button = ({
  icon: Icon,
  onClick,
  className = "",
  disabled = false,
  loading = false,
}) => {
  return (
    <button
      onClick={onClick}
      className={`p-2 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 rounded-lg flex items-center transition-all duration-200 ease-in-out hover:scale-105 active:scale-95 group ${className} ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
      disabled={disabled}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
      ) : (
        Icon
      )}
    </button>
  );
};

// Dropdown component for additional actions
const ActionsDropdown = ({ items, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: "auto",
    bottom: "auto",
    right: 0,
  });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const inTrigger = triggerRef.current?.contains(event.target);
      const inMenu = menuRef.current?.contains(event.target);
      if (!inTrigger && !inMenu) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  const updateDropdownPosition = () => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const menuHeight =
      menuRef.current?.offsetHeight ||
      Math.min(items.length * 48 + 80, 300);
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const right = Math.max(8, window.innerWidth - rect.right);
    const gap = 8;

    // Open below the trigger; flip above only when there is no room underneath
    const openBelow =
      spaceBelow >= menuHeight + gap || spaceBelow >= spaceAbove;

    if (openBelow) {
      setDropdownPosition({
        top: rect.bottom + gap,
        bottom: "auto",
        right,
      });
    } else {
      setDropdownPosition({
        top: "auto",
        bottom: window.innerHeight - rect.top + gap,
        right,
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Measure after paint so bottom/top use real menu height
      const frame = requestAnimationFrame(updateDropdownPosition);
      const handleScroll = () => updateDropdownPosition();
      const handleResize = () => updateDropdownPosition();

      window.addEventListener("scroll", handleScroll, true);
      window.addEventListener("resize", handleResize);

      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("scroll", handleScroll, true);
        window.removeEventListener("resize", handleResize);
      };
    }
  }, [isOpen, items.length]);

  const handleItemClick = (item) => {
    if (item.onClick) {
      item.onClick();
    }
    setIsOpen(false);
  };

  const menu = isOpen
    ? createPortal(
        <div
          ref={menuRef}
          className="fixed w-56 bg-white border border-gray-200 rounded-xl shadow-2xl"
          style={{
            zIndex: 99999,
            top: dropdownPosition.top,
            bottom: dropdownPosition.bottom,
            right: dropdownPosition.right,
            maxHeight: "300px",
          }}
        >
          {/* Header */}
          <div className="px-4 py-2 border-b border-gray-100 flex-shrink-0">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              More Actions
            </h4>
          </div>

          {/* Scrollable Action Items */}
          <div className="py-1 max-h-52 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
            {items.map((item, index) => {
              const itemDisabled =
                disabled || (item.permission && item.permission != true);
              const className =
                "w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gradient-to-r hover:from-p-blue/5 hover:to-p-blue/10 hover:text-gray-900 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 ease-in-out group/item";
              const content = (
                <>
                  <div className="pointer-events-none flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 group-hover/item:bg-p-blue/10 transition-colors duration-150">
                    <ActionButton
                      {...item}
                      href={undefined}
                      target={undefined}
                      onClick={undefined}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 group-hover/item:text-gray-900 truncate">
                      {item.title || item.tooltip || item.action}
                    </div>
                    {item.description && (
                      <div className="text-xs text-gray-500 mt-0.5 truncate">
                        {item.description}
                      </div>
                    )}
                  </div>
                </>
              );

              if (item.href && !itemDisabled) {
                return (
                  <a
                    key={`${item.action}-${index}`}
                    href={item.href}
                    target={item.target || "_self"}
                    rel={
                      item.target === "_blank"
                        ? "noopener noreferrer"
                        : undefined
                    }
                    className={className}
                    onClick={() => setIsOpen(false)}
                  >
                    {content}
                  </a>
                );
              }

              return (
                <button
                  key={`${item.action}-${index}`}
                  onClick={() => handleItemClick(item)}
                  disabled={itemDisabled}
                  className={className}
                >
                  {content}
                </button>
              );
            })}
          </div>

          {/* Footer decoration */}
          <div className="px-4 py-2 border-t border-gray-100 flex-shrink-0">
            <div className="flex items-center justify-center">
              <div className="w-8 h-0.5 bg-gradient-to-r from-transparent via-gray-300 to-transparent rounded-full"></div>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="p-2 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 rounded-lg flex items-center transition-all duration-200 ease-in-out hover:scale-105 active:scale-95 group"
      >
        <HiDotsVertical className="text-gray-500 group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200" />
      </button>
      {menu}
    </div>
  );
};

const ActionButton = ({
  action,
  permission = true,
  fillColor = "gray-600",
  ...props
}) => {
  if (!permission) return <></>;

  switch (action) {
    case ACTION_BUTTON_TYPES.VIEW:
      return (
        <Button
          key={action}
          icon={
            <img
              src={eyeSvg}
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.CHANGE_STATUS:
      return (
        <Button
          key={action}
          icon={
            <MdSwapHoriz
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.APPROVE_ACCOUNTS:
      return (
        <Button
          key={action}
          icon={
            <MdEmail
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.EDIT:
      return (
        <Button
          key={action}
          icon={
            <img
              src={pencilSvg}
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.DELETE:
      return (
        <Button
          key={action}
          icon={
            <img
              src={binSvg}
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.REQUEST_APPROVAL:
      return (
        <Button
          key={action}
          icon={
            <img
              src={approveContractSvg}
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.APPROVE:
      return (
        <Button
          key={action}
          icon={
            <img
              src={approveSvg}
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.REQUEST_MODIFICATION:
      return (
        <Button
          key={action}
          icon={
            <ListChecks
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.REJECT:
      return (
        <Button
          key={action}
          icon={
            <MdClose
              className={`text-${fillColor} group-hover:text-red-600 min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.VIEW_PDF:
      return (
        <Button
          key={action}
          icon={
            <img
              src={viewPdfSvg}
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.ASSIGN:
      return (
        <Button
          key={action}
          icon={
            <MdAssignment
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.GRAPH:
      return (
        <Button
          key={action}
          icon={
            <IoMdGitCompare
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.WORKFLOW:
      return (
        <Button
          key={action}
          icon={
            <ListChecks
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.SHIPMENT:
      return (
        <Button
          key={action}
          icon={
            <FaShip
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.SWAP:
      return (
        <Button
          key={action}
          icon={
            <GiBodySwapping
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.DUPLICATE:
      return (
        <Button
          key={action}
          icon={
            <img
              src={duplicateSvg}
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.HISTORY:
      return (
        <Button
          key={action}
          icon={
            <FiClock
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.TWO_LEVEL:
      return (
        <Button
          key={action}
          icon={
            <FaLayerGroup
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.SEND_EMAIL:
      return (
        <Button
          key={action}
          icon={
            <MdEmail
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.TOGGLE_ACTIVE:
      return (
        <Button
          key={action}
          icon={
            <MdSwapHoriz
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.ADD_COUNT:
      return (
        <Button
          key={action}
          icon={
            <MdAddCircle
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.WHATSAPP_DELIVERY:
      return (
        <Button
          key={action}
          icon={
            <FaWhatsapp
              className={`text-${fillColor} group-hover:text-green-600 min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.EXPORT:
      return (
        <Button
          key={action}
          icon={
            <FiDownload
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.CAMPAIGN_QR:
      return (
        <Button
          key={action}
          icon={
            <QrCode
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.RUN_CAMPAIGN:
      return (
        <Button
          key={action}
          icon={
            <Play
              className={`text-${fillColor} group-hover:text-green-600 min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.COPY_LINK:
      return (
        <Button
          key={action}
          icon={
            <FiCopy
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.GENERATE_LINK:
      return (
        <Button
          key={action}
          icon={
            <MdLink
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.DEACTIVATE:
      return (
        <Button
          key={action}
          icon={
            <FiSlash
              className={`text-${fillColor} group-hover:text-red-600 min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.CREATE_CUSTOMER:
      return (
        <Button
          key={action}
          icon={
            <MdPersonAdd
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.CONVERT_TO_APPLICATION:
      return (
        <Button
          key={action}
          icon={
            <MdDescription
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.DOWNLOAD:
      return (
        <Button
          key={action}
          icon={
            <FiDownload
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.UPLOAD:
      return (
        <Button
          key={action}
          icon={
            <FiUpload
              className={`text-${fillColor} group-hover:text-p-blue min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    case ACTION_BUTTON_TYPES.REMOVE_FILE:
      return (
        <Button
          key={action}
          icon={
            <FiTrash2
              className={`text-${fillColor} group-hover:text-red-600 min-w-5 w-5 min-h-4 h-4 transition-colors duration-200`}
            />
          }
          {...props}
        />
      );
    default:
      return null;
  }
};

/**
 * Optional RBAC: when set, VIEW/EDIT/DELETE visibility follows these flags
 * (API: View, ViewDetails, Update, Delete). Other action types are unchanged.
 */
function mergeItemPermissionWithRbac(item, rbac) {
  if (item.permission === false) return false;
  if (!rbac) return item.permission !== false;
  switch (item.action) {
    case ACTION_BUTTON_TYPES.VIEW:
      return !!(rbac.canView || rbac.canViewDetails);
    case ACTION_BUTTON_TYPES.EDIT:
      return !!rbac.canUpdate;
    case ACTION_BUTTON_TYPES.DELETE:
      return !!rbac.canDelete;
    default:
      return item.permission !== false;
  }
}

const ActionButtonWithTooltip = ({ item, backgroundColor }) => {
  const tooltipId = useId();
  return (
    <div
      data-tooltip-id={tooltipId}
      data-tooltip-content={item.title || item.tooltip}
      className={`bg-${backgroundColor} rounded-md`}
    >
      <ActionButton {...item} />
      <Tooltip
        id={tooltipId}
        place="top"
        effect="solid"
        style={{
          zIndex: 10000,
        }}
        delayShow={200}
        noArrow={true}
        className="!bg-white !text-gray-800 !border !border-gray-300 !opacity-100"
      />
    </div>
  );
};

/**
 * @description This component is used to render a list of action buttons
 * @param {Object} items - array of objects with the following properties:
 * @param {string} items.action - the action to perform
 * @param {string} items.title - the title of the action
 * @param {Function} items.onClick - the function to call when the action is clicked
 * @param {boolean} items.permission - the permission to check if the action should be shown
 * @param {{ canView?: boolean, canViewDetails?: boolean, canUpdate?: boolean, canDelete?: boolean }} [rbac] - optional module RBAC flags
 * @param {number} maxVisibleActions - maximum number of actions to show before using dropdown (default: 3)
 * @returns {React.ReactNode} - The rendered action buttons
 */
const ActionButtons = ({
  items = [],
  disabled = false,
  isCell = false,
  /** When true, icon row is centered in the cell (e.g. HR leave/claim tables). */
  justifyCenter = false,
  displayOnly = false,
  width = "full",
  backgroundColor = "transparent",
  maxVisibleActions = 3,
  rbac = null,
}) => {
  // Filter items based on permissions (+ optional rbac for view/edit/delete)
  const visibleItems = items
    .map((item) => ({
      ...item,
      permission: mergeItemPermissionWithRbac(item, rbac),
    }))
    .filter((item) => item.permission !== false);

  // Split items into visible and dropdown items
  const itemsToShow = visibleItems.slice(0, maxVisibleActions);
  const itemsForDropdown = visibleItems.slice(maxVisibleActions);

  return (
    <div
      className={`${
        !displayOnly ? "action-buttons-container" : ""
      } flex items-center ${
        justifyCenter ? "justify-center" : "justify-start"
      } gap-0.5 space-x-0 ${
        justifyCenter ? "w-full" : `w-${width}`
      } min-w-fit ${
        isCell
          ? justifyCenter
            ? "py-0 px-1"
            : "py-2 px-1 border-b border-[#f2f2f2]"
          : ""
      } bg-transparent rounded-lg`}
    >
      {/* Render visible action buttons */}
      {itemsToShow.map((item, index) => (
        <ActionButtonWithTooltip
          key={`${item.action}-${index}`}
          item={item}
          backgroundColor={backgroundColor}
        />
      ))}

      {/* Render dropdown if there are additional actions */}
      {itemsForDropdown.length > 0 && (
        <div className={`bg-${backgroundColor} rounded-lg`}>
          <ActionsDropdown items={itemsForDropdown} disabled={disabled} />
        </div>
      )}
    </div>
  );
};

export default ActionButtons;
