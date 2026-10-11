import React, { useEffect } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { useDailyReportsPermissions } from "@/hooks/useDailyReportsPermissions";

/**
 * Redirects Create-only users from listing/dashboard/view/edit to the Create page.
 * Create-only = has Create permission but no View, Update, or Delete.
 * Only /daily-reports/create is allowed for Create-only users.
 */
const CREATE_PATH = "/daily-reports/create";

export const DailyReportsGuard = ({ children }) => {
  const { isCreateOnly } = useDailyReportsPermissions();
  const history = useHistory();
  const location = useLocation();
  const currentPath = location.pathname;

  useEffect(() => {
    if (!isCreateOnly) return;

    const isCreatePage = currentPath === CREATE_PATH;
    if (!isCreatePage) {
      history.replace(CREATE_PATH);
    }
  }, [isCreateOnly, currentPath, history]);

  return children;
};

export default DailyReportsGuard;
