import React, { useContext, useEffect, useState } from "react";
import { AdminContext } from "@/context/AdminContext";
import { useHistory } from "react-router-dom";
import { getCachedDynamicModulesPayload } from "@/utils/sessionApiCache";

const RouteGuard = ({ children, requiredPath }) => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [modules, setModules] = useState([]);
  const history = useHistory();

  useEffect(() => {
    if (!adminInfo?.token) {
      setLoading(false);
      return;
    }

    fetchModules();
  }, [adminInfo]);

  useEffect(() => {
    if (modules.length > 0 && requiredPath) {
      checkAuthorization(requiredPath);
    }
  }, [modules, requiredPath]);

  const fetchModules = async () => {
    try {
      // Use the same API as sidebar to get only user's assigned modules
      const data = await getCachedDynamicModulesPayload(
        adminInfo.id,
        adminInfo.token,
      );

      const roleDetails = data.role;
      const authorizedModules = roleDetails.modules || [];

      // Process modules to match the expected format
      const groupedModules = authorizedModules.map((parent) => ({
        _id: parent._id,
        module: parent.name,
        path: parent.path,
        permissions: parent.permissions || [],
        subModules: parent.subModules.map((child) => ({
          _id: child._id,
          module: child.name,
          path: child.path,
          permissions: child.permissions || [],
        })),
      }));

      setModules(groupedModules);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching modules:", error);
      setLoading(false);
    }
  };

  const checkAuthorization = (path) => {
    // Allow access to dashboard and home pages
    if (path === "/" || path === "/dashboard" || path === "/home") {
      setAuthorized(true);
      return;
    }

    // Allow access to unauthorized page itself
    if (path === "/unauthorized") {
      setAuthorized(true);
      return;
    }

    let hasAccess = false;

    // Check if the path matches any of the user's assigned modules or submodules
    for (const module of modules) {
      // Check exact path match first
      if (path === module.path) {
        hasAccess = true;
        break;
      }

      // Check if path starts with module path (for nested routes)
      if (path.startsWith(module.path) && module.path !== "/") {
        hasAccess = true;
        break;
      }

      // Check submodules
      for (const subModule of module.subModules) {
        if (path === subModule.path) {
          hasAccess = true;
          break;
        }

        if (path.startsWith(subModule.path) && subModule.path !== "/") {
          hasAccess = true;
          break;
        }
      }

      if (hasAccess) break;
    }

    setAuthorized(hasAccess);
  };

  useEffect(() => {
    if (!loading) {
      if (!adminInfo?.token) {
        history.replace("/login");
      } else if (!authorized) {
        history.replace("/unauthorized");
      }
    }
  }, [loading, adminInfo, authorized, history]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!authorized) {
    return null; // Don't render anything while redirecting
  }

  return children;
};

export default RouteGuard; 