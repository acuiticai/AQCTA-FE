import { useState, useEffect, useContext } from 'react';
import { AdminContext } from "@/context/AdminContext";

export const usePermissions = () => {
  const [pagePermissions, setPagePermissions] = useState([]);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  const checkPagePermissions = () => {
    if (adminInfo && adminInfo.role.modules) {
      const currentPath = window.location.pathname;
      let matchedPermissions = [];

      adminInfo.role.modules.forEach((module) => {
        // Check main module
        if (currentPath === module.path) {
          matchedPermissions = module.permissions;
        }

        // Check submodules
        if (module.subModules?.length > 0) {
          module.subModules.forEach((subModule) => {
            if (currentPath === subModule.path) {
              matchedPermissions = subModule.permissions;
            }
          });
        }
      });

      setPagePermissions(matchedPermissions);
    }
  };

  // Check permissions when location changes
  useEffect(() => {
    checkPagePermissions();
  }, [window.location.pathname, adminInfo]);

  // Function to check if user has a specific permission
  const hasPermission = (permission) => {
    return pagePermissions.includes(permission);
  };

  return {
    hasPermission,
    pagePermissions,
  };
};

// Optional: Higher Order Component for permission-based rendering
export const withPermission = (WrappedComponent, requiredPermission) => {
  return function PermissionWrapper(props) {
    const { hasPermission } = usePermissions();
    
    if (!hasPermission(requiredPermission)) {
      return null; // Or return an unauthorized component
    }

    return <WrappedComponent {...props} />;
  };
};

// Optional: Permission Guard Component
export const PermissionGuard = ({ permission, children }) => {
  const { hasPermission } = usePermissions();
  
  if (!hasPermission(permission)) {
    return null; // Or return an unauthorized component
  }

  return children;
};