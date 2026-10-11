import { useState, useRef, useEffect, useContext } from "react";
import { FiX } from "react-icons/fi";
import dummyAvatar from "@/assets/DocIcons/PDF.svg";
import PDFIcon from "@/assets/DocIcons/PDF.svg";
import { FiFolder } from "react-icons/fi";
import axios from "axios";
import { Divider } from "@mui/material";
import moment from "moment";
import SharePopup from "./SharePopup";
import { AdminContext } from "@/context/AdminContext";
import { formatTime } from "@/components/formatAmount";
import { useTranslation } from "react-i18next";
import { getSoleAssignedBusinessId } from "@/utils/sessionAssignedBusinesses";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const FileDetails = ({ item, onClose }) => {
  const { t } = useTranslation();
  const dm = (key, defaultValue, options = {}) =>
    t(`docsManagement.${key}`, { defaultValue, ...options });
  const [activeTab, setActiveTab] = useState("details");
  const [loading, setLoading] = useState("details");
  const [data, setData] = useState([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [selectedBusiness, setSelectedBusinesses] = useState(
    () =>
      getSoleAssignedBusinessId() ||
      adminInfo?.businesses?.[0]?._id ||
      null
  );

  const [dateFormat, setDateFormat] = useState("YYYY-MM-DD"); // Default Date Format
  const [timeFormat, setTimeFormat] = useState("HH:mm:ss"); // Default Time Format

  useEffect(() => {
    const fetchConfiguration = async () => {
      try {
        const response = await axios.get(`${Base_URL}/configuration`);
        if (response.data && response.data.length > 0) {
          console.log("✅ Configuration Fetched:", response.data[0]);
          setDateFormat(response.data[0].date_format || "YYYY-MM-DD");
          setTimeFormat(response.data[0].time_format || "HH:mm:ss");
        }
      } catch (error) {
        console.error("❌ Error fetching configuration:", error);
      }
    };

    fetchConfiguration();
  }, []);

  const formatDateTime = (dateString) => {
    return moment(dateString).format(`${dateFormat} ${timeFormat}`);
  };

  if (!item) return null;
  console.log("item", item);
  const handleShare = () => {
    setShowShareModal(true);
  };
  // Ref to track the modal
  const modalRef = useRef(null);

  useEffect(() => {
    fetchData();

    // Event listener to detect clicks outside
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose(); // Close when clicking outside
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const confirmShare = async (item, selectedUsers, generalAccess) => {
    try {
      const payload = {
        users: selectedUsers.map((user) => ({
          userId: user._id,
          role: user.role,
          temporaryUntil: user.temporaryUntil,
        })),
      };

      await axios.post(
        `${Base_URL}/documents/share/${item._id}/${item.type}`,
        payload
      );

      alert(
        item.type === "folder"
          ? dm(
              "accessSharedSuccessFolder",
              "Access shared successfully to folder and its contents!"
            )
          : dm(
              "accessSharedSuccessFile",
              "Access shared successfully to file!"
            )
      );
      onClose();
    } catch (error) {
      console.error(`Error sharing ${item.type}:`, error);
      alert(dm("failedShareAccess", "Failed to share access. Please try again."));
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${Base_URL}/documents/${item.type}Details/${item._id}`
      );
      console.log("Fetched folder structure:", response.data);
      setLoading(false);
      setData(response.data);
    } catch (error) {
      setLoading(false);
      console.error("Error fetching folder structure:", error);
    }
  };

  const activityData = [
    {
      user: "UserName",
      action: "shared",
      count: "23 items",
      time: "3:25AM Nov 25",
      files: [
        { name: "File Name.pdf", type: "pdf" },
        { name: "fileName.svg", type: "svg" },
        { name: "fileName.docx", type: "doc" },
        { name: "fileName.docx", type: "doc" },
        { name: "fileName.docx", type: "doc" },
      ],
    },
    {
      user: "UserName",
      action: "shared",
      count: "23 items",
      time: "3:25AM Nov 25",
      files: [
        { name: "File Name.pdf", type: "pdf" },
        { name: "fileName.svg", type: "svg" },
        { name: "fileName.docx", type: "doc" },
        { name: "fileName.docx", type: "doc" },
        { name: "fileName.docx", type: "doc" },
        { name: "fileName.docx", type: "doc" },
      ],
    },
    {
      user: "UserName",
      action: "shared",
      count: "23 items",
      time: "3:25AM Nov 25",
      files: [
        { name: "File Name.pdf", type: "pdf" },
        { name: "fileName.svg", type: "svg" },
        { name: "fileName.docx", type: "doc" },
        { name: "fileName.docx", type: "doc" },
        { name: "fileName.docx", type: "doc" },
        { name: "fileName.docx", type: "doc" },
      ],
    },
  ];

  return (
    <div
      ref={modalRef}
      style={{
        position: "fixed",
        top: "10vh",
        right: "2vw",
        width: "350px",
        height: "85vh",
        maxHeight: "85vh",
        background: "#EBFAE4",
        boxShadow: "-2px 0px 10px rgba(0,0,0,0.1)",
        padding: "20px",
        zIndex: 1000,
        overflowY: "auto",
        borderRadius: "15px",
      }}
    >
      {showShareModal && (
        <SharePopup
          item={item}
          selectedBusiness={selectedBusiness}
          onClose={() => setShowShareModal(false)}
          onShare={confirmShare}
          // onDetails={confirmDetails}
        />
      )}
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2 style={{ fontSize: "1rem", fontWeight: "600", color: "#333" }}>
          {data ? data.name : dm("loading", "Loading...")}
        </h2>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          <FiX size={20} />
        </button>
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", alignItems: "center", marginTop: "15px" }}>
        {["details", "activity"].map((tab) => (
          <span
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: "0.9rem",
              fontWeight: "500",
              color: activeTab === tab ? "#000" : "#666",
              borderBottom: `2px solid ${
                activeTab === tab ? "#000" : "#BADA55"
              }`,
              paddingBottom: "5px",
              cursor: "pointer",
            }}
          >
            {tab === "details"
              ? dm("details", "Details")
              : dm("activity", "Activity")}
          </span>
        ))}
      </div>

      {activeTab === "details" ? (
        <>
          {/* File Preview */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              marginTop: "20px",
              marginBottom: "15px",
            }}
          >
            {item.type === "folder" ? (
              <FiFolder
                style={{
                  width: item.type === "folder" ? "120px" : "180px",
                  height: "auto",
                  margin: "30px",
                  objectFit: "contain",
                  borderRadius: "8px",
                }}
              />
            ) : (
              <img
                src={
                  data?.name && /\.(png|jpe?g|gif|svg|webp)$/i.test(data.name)
                    ? data.url
                    : data?.type === "pdf"
                    ? PDFIcon
                    : dummyAvatar
                }
                alt={dm("filePreview", "File Preview")}
                style={{
                  width: item.type === "folder" ? "120px" : "180px",
                  height: "auto",
                  margin: "30px",
                  objectFit: "contain",
                  borderRadius: "8px",
                }}
              />
            )}
          </div>

          {/* Who has access */}
          <div>
            <h3
              style={{
                fontSize: "0.9rem",
                fontWeight: "500",
                marginBottom: "5px",
              }}
            >
              {dm("whoHasAccess", "Who has access")}
            </h3>
            {/* <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "10px" }}> */}
            {/* {[...Array(6)].map((_, index) => (
                <img
                  key={index}
                  src={dummyAvatar || "/placeholder.svg"}
                  alt="User"
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "50%",
                    border: "2px solid white",
                    boxShadow: "0px 0px 5px rgba(0,0,0,0.1)",
                  }}
                />
              ))}
            </div> */}
            {data?.sharedWith?.length > 0 && (
              <div style={{ marginTop: "15px" }}>
                <h3
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: "500",
                    marginBottom: "5px",
                  }}
                >
                  {dm("sharedWith", "Shared With")}
                </h3>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  {/* Owner's Image */}
                  <img
                    src={
                      `${data?.uploadedBy?.image || data?.createdBy?.image}` ||
                      "/placeholder.svg"
                    }
                    alt={dm("owner", "Owner")}
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "50%",
                      border: "2px solid white",
                      boxShadow: "0px 0px 5px rgba(0,0,0,0.1)",
                    }}
                  />
                  {/* Separator */}
                  <Divider orientation="vertical" flexItem />
                  {/* Shared With Users' Images */}
                  {data?.sharedWith?.map((share, index) => (
                    <img
                      key={index}
                      src={`${share?.user?.image}` || "/placeholder.svg"}
                      alt="User"
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "50%",
                        border: "2px solid white",
                        boxShadow: "0px 0px 5px rgba(0,0,0,0.1)",
                      }}
                    />
                  ))}
                </div>

                {/* Shared With Text */}
                <p
                  style={{
                    fontSize: "0.8rem",
                    color: "#555",
                    marginTop: "5px",
                  }}
                >
                  {dm(
                    "ownedBySharedWith",
                    "Owned by {{owner}}. Shared with {{names}}{{others}}",
                    {
                      owner:
                        data?.uploadedBy?.name || data?.createdBy?.name || "",
                      names: data.sharedWith
                        .slice(0, 2)
                        .map((share) => share?.user?.name)
                        .filter(Boolean)
                        .join(", "),
                      others:
                        data?.sharedWith?.length > 2
                          ? dm("andOthers", ", and {{count}} others.", {
                              count: data.sharedWith.length - 2,
                            })
                          : ".",
                    }
                  )}
                </p>
              </div>
            )}

            <button
              style={{
                marginTop: "10px",
                padding: "8px 12px",
                background: "#10B981",
                color: "white",
                borderRadius: "5px",
                border: "none",
                cursor: "pointer",
                width: "100%",
              }}
              onClick={() => {
                handleShare(item);
              }}
            >
              {dm("manageAccess", "Manage Access")}
            </button>
          </div>

          {/* Folder/File Details */}
          <div style={{ marginTop: "20px" }}>
            <h3
              style={{
                fontSize: "0.9rem",
                fontWeight: "500",
                marginBottom: "5px",
              }}
            >
              {dm("folderDetails", "Folder Details")}
            </h3>
            {[
              { label: dm("type", "Type"), value: `${item.type}` },
              {
                label: dm("owner", "Owner"),
                value: `${data?.uploadedBy?.name || data?.createdBy?.name}`,
              },
              {
                label: dm("createdOn", "Created On"),
                value: formatDateTime(data?.createdAt),
              },
            ].map((detail, index) => (
              <p key={index} style={{ fontSize: "0.8rem", color: "#555" }}>
                <strong>{detail.label}:</strong> {detail.value}
              </p>
            ))}
          </div>
        </>
      ) : (
        // Activity Tab Content
        <div style={{ marginTop: "20px", marginBottom: "200px" }}>
          {activityData.map((activity, index) => (
            <div key={index} style={{ marginBottom: "20px" }}>
              <h3
                style={{
                  fontSize: "0.9rem",
                  fontWeight: "500",
                  marginBottom: "15px",
                }}
              >
                {dm("lastWeek", "Last Week")}
              </h3>
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "flex-start",
                }}
              >
                <img
                  src={dummyAvatar || "/placeholder.svg"}
                  alt="User"
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "50%",
                  }}
                />
                <div>
                  <p
                    style={{
                      fontSize: "0.8rem",
                      color: "#555",
                      marginBottom: "5px",
                    }}
                  >
                    {activity.user} {activity.action} {activity.count}
                  </p>
                  <p style={{ fontSize: "0.8rem", color: "#888" }}>
                    {formatTime(activity.time)}
                  </p>

                  {/* Files List */}
                  <div style={{ marginTop: "10px" }}>
                    {activity.files.map((file, fileIndex) => (
                      <div
                        key={fileIndex}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          marginBottom: "5px",
                        }}
                      >
                        <div
                          style={{
                            width: "24px",
                            height: "24px",
                            background:
                              file.type === "pdf"
                                ? "#FF4444"
                                : file.type === "svg"
                                ? "#FF44FF"
                                : "#4444FF",
                            borderRadius: "4px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontSize: "0.7rem",
                            textTransform: "uppercase",
                          }}
                        >
                          {file.type}
                        </div>
                        <span style={{ fontSize: "0.8rem" }}>{file.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <button
            style={{
              background: "transparent",
              border: "none",
              color: "#10B981",
              fontSize: "0.8rem",
              cursor: "pointer",
              padding: "5px 0",
            }}
          >
            {dm("showAll", "Show All")}
          </button>
        </div>
      )}
    </div>
  );
};

export default FileDetails;

// import { useState, useEffect } from "react";
// import { FiX } from "react-icons/fi";
// import dummyAvatar from "@/assets/information.svg";
// import dummyFileIcon from "@/assets/information.svg";
// import axios from "axios";

// const FileDetails = ({ item, onClose }) => {
//   const [activeTab, setActiveTab] = useState("details");
//   const [loading, setLoading] = useState(false);
//   const [data, setData] = useState(null);
//   const activityData = [
//     {
//       user: "UserName",
//       action: "shared",
//       count: "23 items",
//       time: "3:25AM Nov 25",
//       files: [
//         { name: "File Name.pdf", type: "pdf" },
//         { name: "fileName.svg", type: "svg" },
//         { name: "fileName.docx", type: "doc" },
//         { name: "fileName.docx", type: "doc" },
//         { name: "fileName.docx", type: "doc" },
//       ],
//     },
//     {
//       user: "UserName",
//       action: "shared",
//       count: "23 items",
//       time: "3:25AM Nov 25",
//       files: [
//         { name: "File Name.pdf", type: "pdf" },
//         { name: "fileName.svg", type: "svg" },
//         { name: "fileName.docx", type: "doc" },
//         { name: "fileName.docx", type: "doc" },
//         { name: "fileName.docx", type: "doc" },
//         { name: "fileName.docx", type: "doc" },
//       ],
//     },
//     {
//       user: "UserName",
//       action: "shared",
//       count: "23 items",
//       time: "3:25AM Nov 25",
//       files: [
//         { name: "File Name.pdf", type: "pdf" },
//         { name: "fileName.svg", type: "svg" },
//         { name: "fileName.docx", type: "doc" },
//         { name: "fileName.docx", type: "doc" },
//         { name: "fileName.docx", type: "doc" },
//         { name: "fileName.docx", type: "doc" },
//       ],
//     },
//   ];

//   useEffect(() => {
//     if (item) fetchData();
//   }, [item]);

//   const fetchData = async () => {
//     try {
//       setLoading(true);
//       const response = await axios.get(
//         `${Base_URL}/documents/${item.type}Details/${item._id}`
//       );
//       setData(response.data);
//       setLoading(false);
//     } catch (error) {
//       setLoading(false);
//       console.error("Error fetching details:", error);
//     }
//   };

//   if (!item) return null;

//   return (
//     <div
//       style={{
//         position: "fixed",
//         top: 100,
//         right: 30,
//         width: "350px",
//         height: "90vh",
//         background: "#EBFAE4",
//         boxShadow: "-2px 0px 10px rgba(0,0,0,0.1)",
//         padding: "20px",
//         zIndex: 1000,
//         overflowY: "auto",
//         borderRadius: "15px",
//       }}
//     >
//       {/* Header */}
//       <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
//         <h2 style={{ fontSize: "1rem", fontWeight: "600", color: "#333" }}>
//           {data ? data.name : "Loading..."}
//         </h2>
//         <button
//           onClick={onClose}
//           style={{ background: "transparent", border: "none", cursor: "pointer" }}
//         >
//           <FiX size={20} />
//         </button>
//       </div>

//       {/* Navigation */}
//       <div style={{ display: "flex", alignItems: "center", marginTop: "15px" }}>
//         {["details", "activity"].map((tab) => (
//           <span
//             key={tab}
//             onClick={() => setActiveTab(tab)}
//             style={{
//               flex: 1,
//               textAlign: "center",
//               fontSize: "0.9rem",
//               fontWeight: "500",
//               color: activeTab === tab ? "#000" : "#666",
//               borderBottom: `2px solid ${activeTab === tab ? "#000" : "#BADA55"}`,
//               paddingBottom: "5px",
//               cursor: "pointer",
//             }}
//           >
//             {tab.charAt(0).toUpperCase() + tab.slice(1)}
//           </span>
//         ))}
//       </div>

//       {loading ? (
//         <p>Loading...</p>
//       ) : activeTab === "details" ? (
//         <>
//           {/* File Preview */}
//           {data?.url && (
//             <div style={{ textAlign: "center", marginTop: "20px", marginBottom: "15px" }}>
//               <img
//                 src={data.url || dummyFileIcon}
//                 alt="File Preview"
//                 style={{ width: "120px", height: "auto" }}
//               />
//             </div>
//           )}

//           {/* File / Folder Details */}
//           {data && (
//             <div>
//               <h3 style={{ fontSize: "0.9rem", fontWeight: "500", marginBottom: "5px" }}>
//                 Details
//               </h3>
//               <p><strong>Type:</strong> {data.type || "Unknown"}</p>
//               {data.uploadedBy && (
//                 <p><strong>Uploaded By:</strong> {data.uploadedBy.name} ({data.uploadedBy.email})</p>
//               )}
//               <p><strong>Uploaded At:</strong> {new Date(data.uploadDate).toLocaleString()}</p>
//               <p><strong>Status:</strong> {data.status}</p>
//             </div>
//           )}

//           {/* Shared With */}
//           {data?.sharedWith?.length > 0 && (
//             <div style={{ marginTop: "15px" }}>
//               <h3 style={{ fontSize: "0.9rem", fontWeight: "500", marginBottom: "5px" }}>Shared With</h3>
//               {data.sharedWith.map((share, index) => (
//                 <p key={index} style={{ fontSize: "0.8rem", color: "#555" }}>
//                   {share.user.name} ({share.user.email}) - {share.role}
//                 </p>
//               ))}
//             </div>
//           )}

//           {/* Folder-Specific Details */}
//           {data?.subfolders && (
//             <div style={{ marginTop: "15px" }}>
//               <h3 style={{ fontSize: "0.9rem", fontWeight: "500", marginBottom: "5px" }}>Subfolders</h3>
//               {data.subfolders.length > 0 ? (
//                 data.subfolders.map((folder) => (
//                   <p key={folder.id} style={{ fontSize: "0.8rem", color: "#555" }}>
//                     {folder.name}
//                   </p>
//                 ))
//               ) : (
//                 <p style={{ fontSize: "0.8rem", color: "#888" }}>No subfolders found</p>
//               )}
//             </div>
//           )}

//           {/* Folder-Specific Files */}
//           {data?.files && (
//             <div style={{ marginTop: "15px" }}>
//               <h3 style={{ fontSize: "0.9rem", fontWeight: "500", marginBottom: "5px" }}>Files</h3>
//               {data.files.length > 0 ? (
//                 data.files.map((file) => (
//                   <p key={file.id} style={{ fontSize: "0.8rem", color: "#555" }}>
//                     {file.name} - {file.type}
//                   </p>
//                 ))
//               ) : (
//                 <p style={{ fontSize: "0.8rem", color: "#888" }}>No files found</p>
//               )}
//             </div>
//           )}
//         </>
//       ) : (
//         // Activity Tab Content
//         <div style={{ marginTop: "20px", marginBottom: "200px" }}>
//           {activityData.map((activity, index) => (
//             <div key={index} style={{ marginBottom: "20px" }}>
//               <h3 style={{ fontSize: "0.9rem", fontWeight: "500", marginBottom: "15px" }}>Last Week</h3>
//               <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
//                 <img
//                   src={dummyAvatar || "/placeholder.svg"}
//                   alt="User"
//                   style={{
//                     width: "30px",
//                     height: "30px",
//                     borderRadius: "50%",
//                   }}
//                 />
//                 <div>
//                   <p style={{ fontSize: "0.8rem", color: "#555", marginBottom: "5px" }}>
//                     {activity.user} {activity.action} {activity.count}
//                   </p>
//                   <p style={{ fontSize: "0.8rem", color: "#888" }}>{activity.time}</p>

//                   {/* Files List */}
//                   <div style={{ marginTop: "10px" }}>
//                     {activity.files.map((file, fileIndex) => (
//                       <div
//                         key={fileIndex}
//                         style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "5px" }}
//                       >
//                         <div
//                           style={{
//                             width: "24px",
//                             height: "24px",
//                             background:
//                               file.type === "pdf"
//                                 ? "#FF4444"
//                                 : file.type === "svg"
//                                   ? "#FF44FF"
//                                   : "#4444FF",
//                             borderRadius: "4px",
//                             display: "flex",
//                             alignItems: "center",
//                             justifyContent: "center",
//                             color: "white",
//                             fontSize: "0.7rem",
//                             textTransform: "uppercase",
//                           }}
//                         >
//                           {file.type}
//                         </div>
//                         <span style={{ fontSize: "0.8rem" }}>{file.name}</span>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               </div>
//             </div>
//           ))}
//           <button
//             style={{
//               background: "transparent",
//               border: "none",
//               color: "#10B981",
//               fontSize: "0.8rem",
//               cursor: "pointer",
//               padding: "5px 0",
//             }}
//           >
//             Show All
//           </button>
//         </div>
//       )}
//     </div>
//   );
// };

// export default FileDetails;
