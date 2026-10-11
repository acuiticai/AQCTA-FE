import React from "react";
import { useHistory } from "react-router-dom";
import { FiGrid, FiList, FiRefreshCw, FiX } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import FileUpload from "../../../assets/img/icons/document-upload.svg";
import FileUploadPro from "../../../assets/img/icons/proicons_folder.svg";
import searchIcon01 from "../../../assets/img/icons/searchIcon01.svg";
import searchIcon02 from "../../../assets/img/icons/searchIcon02.svg";
import Information from "@/assets/information.svg";
import { DropdownBasic } from "@/page-layouts/index";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

const Header = ({
  title,
  businesses = [],
  selectedBusiness,
  onBusinessChange,
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onRefresh,
  onUpload,
  onNewFolder,
  buttonColor = "var(--p-blue)",
  setShowFilterPopup,
}) => {
  const history = useHistory();
  const { t } = useTranslation();
  const dm = (key, defaultValue, options = {}) =>
    t(`docsManagement.${key}`, { defaultValue, ...options });
  const isSingleBusiness = isSingleAssignedBusiness();

  const displayTitle = title || dm("myDrive", "My Drive");

  return (
    <header>
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "1rem 24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "28px",
            gap: "12px",
          }}
        >
          <h1
            style={{
              fontSize: "24px",
              fontFamily: "inherit",
              fontWeight: "500",
              color: "#1A202C",
              whiteSpace: "nowrap",
            }}
          >
            {displayTitle}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: "30px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "17px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "9px",
                  marginRight: "12px",
                }}
              >
                {onUpload && (
                  <label htmlFor="file-upload" style={{ cursor: "pointer" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "6px",
                        background: "#F3F4F6",
                        color: "#FFFFFF",
                        borderRadius: "0.5rem",
                        cursor: "pointer",
                        transition: "background 0.2s",
                        width: "40px",
                        height: "40px",
                      }}
                    >
                      <img
                        src={FileUpload}
                        alt={dm("upload", "Upload")}
                        style={{ width: "24px", height: "24px" }}
                      />
                    </div>
                    <input
                      id="file-upload"
                      type="file"
                      style={{ display: "none" }}
                      onChange={onUpload}
                    />
                  </label>
                )}
                {onNewFolder && (
                  <button
                    onClick={onNewFolder}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "6px",
                      background: "#F3F4F6",
                      borderRadius: "0.5rem",
                      cursor: "pointer",
                      transition: "background 0.2s",
                      width: "40px",
                      height: "40px",
                    }}
                  >
                    <img
                      src={FileUploadPro}
                      alt={dm("newFolder", "New Folder")}
                      width={24}
                      height={24}
                      style={{ width: "24px", height: "24px" }}
                    />
                  </button>
                )}
              </div>

              {!isSingleBusiness && (
                <div
                  style={{
                    background: "rgb(242, 242, 242)",
                    borderRadius: "8px",
                  }}
                >
                  <DropdownBasic
                    value={selectedBusiness}
                    onChange={onBusinessChange}
                    options={businesses.map((biz) => ({
                      label: dm("organization", "Organization: {{name}}", {
                        name: biz.name,
                      }),
                      value: biz._id,
                    }))}
                  />
                </div>
              )}

              <div style={{ position: "relative" }}>
                <img
                  src={searchIcon01}
                  alt={dm("searchIcon", "Search Icon")}
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "8%",
                    transform: "translateY(-50%)",
                    width: "16px",
                    height: "16px",
                    color: "#9ca3af",
                  }}
                />
                <input
                  type="text"
                  placeholder={dm("searchPlaceholder", "Search")}
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  style={{
                    padding: "9.8px 32px",
                    background: "#F2F2F2",
                    borderLeft: "1px solid rgb(229, 231, 235)",
                    fontSize: "0.875rem",
                    borderRadius: "8px",
                    width: "160px",
                    outline: "none",
                  }}
                />
                <img
                  onClick={() => setShowFilterPopup(true)}
                  src={searchIcon02}
                  alt={dm("shortcutIcon", "Shortcut Icon")}
                  style={{
                    position: "absolute",
                    top: "50%",
                    right: "8%",
                    transform: "translateY(-50%)",
                    width: "16px",
                    height: "16px",
                    color: "#9ca3af",
                    cursor: "pointer",
                  }}
                />
              </div>
            </div>

            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <button
                onClick={() => onViewModeChange("grid")}
                style={{
                  padding: "0.5rem",
                  borderRadius: "0.5rem",
                  background: viewMode === "grid" ? buttonColor : "#F4F4F4",
                  color: viewMode === "grid" ? "white" : "black",
                  cursor: "pointer",
                }}
              >
                <FiGrid style={{ fontSize: "1.3rem" }} />
              </button>
              <button
                onClick={() => onViewModeChange("list")}
                style={{
                  padding: "0.5rem",
                  borderRadius: "0.5rem",
                  background: viewMode === "list" ? buttonColor : "#F4F4F4",
                  color: viewMode === "list" ? "white" : "black",
                  cursor: "pointer",
                }}
              >
                <FiList style={{ fontSize: "1.3rem" }} />
              </button>

              <button
                onClick={onRefresh}
                style={{
                  padding: "0.5rem",
                  borderRadius: "0.5rem",
                  background: "#F4F4F4",
                  color: "black",
                  cursor: "pointer",
                }}
              >
                <FiRefreshCw style={{ fontSize: "1.25rem" }} />
              </button>

              <button
                onClick={onRefresh}
                style={{
                  padding: "0.5rem",
                  borderRadius: "0.5rem",
                  background: "#F4F4F4",
                  marginRight: "20px",
                  color: "black",
                  cursor: "pointer",
                  width: "40px",
                  height: "40px",
                }}
              >
                <img
                  src={Information}
                  alt={dm("information", "Information")}
                  style={{ width: "24px", height: "24px" }}
                />
              </button>

              <button
                onClick={() => history.push("/home")}
                style={{
                  padding: "0.5rem",
                  borderRadius: "0.5rem",
                  background: "#F4F4F4",
                  color: "black",
                  cursor: "pointer",
                }}
              >
                <FiX style={{ fontSize: "1.25rem" }} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
