import React, { useState, useEffect, useContext } from "react";
import {
  FiGrid,
  FiUsers,
  FiUser,
  FiCompass,
  FiSettings,
  FiSlack,
  FiReport,
  FiGlobe,
  FiTarget,
} from "react-icons/fi";
import { fetchConfiguration } from "@/components/formatAmount";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import axios from "axios"; // For API calls
import { AdminContext } from "@/context/AdminContext";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const iconMap = {
  FiGrid: FiGrid,
  FiUsers: FiUsers,
  FiUser: FiUser,
  FiCompass: FiCompass,
  FiSettings: FiSettings,
  FiSlack: FiSlack,
  FiReport: FiSettings,
  FiGlobe: FiGlobe,
  FiTarget: FiTarget,
};

const Sidebar = () => {
  const checkTokenExpired = useCheckTokenExpired(); // ✅ hook used properly
  const [sidebar, setSidebar] = useState([]);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = adminInfo
    ? {
        "Content-Type": "application/json",
        authorization: `Bearer ${adminInfo.token}`,
      }
    : {};
  let payload = {};

  useEffect(() => {
    axios
      .post(`${Base_URL}/Module/get_all_modules`, payload, { headers })
      .then((response) => {
        // if (checkTokenExpired(response)) return;
        const modules = response.data.map((item) => ({
          path: item.path && !item.path.startsWith('/') ? `/${item.path}` : item.path,
          icon: iconMap[item.icon] || FiGrid, // Default icon if not matched
          name: item.name,
          routes: item.routes
            ? item.routes.map((subItem) => ({
                path: subItem.path && !subItem.path.startsWith('/') ? `/${subItem.path}` : subItem.path,
                name: subItem.name,
              }))
            : undefined,
        }));
        console.log("modules", modules);
        setSidebar(modules);
      })
      .catch((error) => {
        console.error("Error fetching sidebar modules:", error);
      });
  }, []);

  useEffect(() => {
    console.log("Message fetchConfiguration: ");

    fetchConfiguration(adminInfo?.token);
  }, []);

  return (
    <div>
      {sidebar.map((menu, index) => (
        <div key={index}>
          {menu.icon && <menu.icon />}
          <span>{menu.name}</span>
          {menu.routes && (
            <ul>
              {menu.routes.map((route, idx) => (
                <li key={idx}>
                  <a href={route.path}>{route.name}</a>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
};

export default Sidebar;

// import {
//   FiGrid,
//   FiUsers,
//   FiUser,
//   FiCompass,
//   FiSettings,
//   FiSlack,
//   FiGlobe,
//   FiTarget,
// } from "react-icons/fi";

// /**
//  * ⚠ These are used just to render the Sidebar!
//  * You can include any link here, local or external.
//  *
//  * If you're looking to actual Router routes, go to
//  * `routes/index.js`
//  */
// const sidebar = [
//   {
//     path: "/dashboard", // the url
//     icon: FiGrid, // icon
//     name: "Dashboard", // name that appear in Sidebar
//   },

//   {
//     icon: FiSlack,
//     name: "Catalog",
//     routes: [
//       {
//         path: "/products",
//         name: "Products",
//       },
//       {
//         path: "/categories",
//         name: "Categories",
//       },
//       {
//         path: "/attributes",
//         name: "Attributes",
//       },
//       {
//         path: "/coupons",
//         name: "Coupons",
//       },
//     ],
//   },

//   {
//     path: "/customers",
//     icon: FiUsers,
//     name: "Customers",
//   },
//   {
//     path: "/orders",
//     icon: FiCompass,
//     name: "Orders",
//   },

//   {
//     path: "/our-staff",
//     icon: FiUser,
//     name: "OurStaff",
//   },

//   {
//     icon: FiGlobe,
//     name: "International",
//     routes: [
//       {
//         path: "/languages",
//         name: "Languages",
//       },
//       {
//         path: "/currencies",
//         name: "Currencies",
//       },
//     ],
//   },
//   {
//     icon: FiSlack,
//     name: "Pages",
//     routes: [
//       // submenu

//       {
//         path: "/404",
//         name: "404",
//       },
//       {
//         path: "/coming-soon",
//         name: "Coming Soon",
//       },
//     ],
//   },
//   {
//     icon: FiSettings,
//     name: "Settings",
//     routes: [
//       {
//         path: "/SystemUsers",
//         name: "System Users",
//       },
//       {
//         path: "/ConfigTab",
//         name: "Configurations",
//       },
//       {
//         path: "/UserRoles",
//         name: "User Roles",
//       },
//       {
//         path: "/business",
//         icon: FiUser,
//         name: "Business",
//       },
//       {
//         path: "/EmailTemplates",
//         name: "Email Templates",
//       },
//       {
//         path: "/ActivityLogs",
//         name: "Activity Logs",
//       },
//       {
//         path: "/Modules",
//         name: "Modules",
//       },
//       {
//         path: "/EmailLogs",
//         name: "Email Logs",
//       },
//       {
//         path: "/settings?settingTab=common-settings",
//         name: "Dastar Configuration",
//       },
//       {
//         path: "/store/customization",
//         name: 'Store Home',
//       },
//       {
//         path: "/store/store-settings",
//         name: 'Store Setting',
//       },

//     ],
//   },
// ];

// export default sidebar;
