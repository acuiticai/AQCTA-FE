import React from "react";
import { useRouteAuth } from "@/hooks/useRouteAuth";

const ProtectedRoute = ({ children }) => {
  const { loading, authorized } = useRouteAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!authorized) {
    return null; // Don't render anything while redirecting
  }

  return children;
};

export default ProtectedRoute; 