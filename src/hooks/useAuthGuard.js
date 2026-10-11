import { useContext, useEffect } from "react";
import { useHistory } from "react-router-dom";
import Cookies from "js-cookie";
import { AdminContext } from "@/context/AdminContext";

// 🔐 Hook: use on protected pages
export function useAuthGuard() {
  const { state, dispatch } = useContext(AdminContext);
  const { adminInfo } = state;
  const history = useHistory();

  useEffect(() => {
    if (!adminInfo?.token) {
      dispatch({ type: "USER_LOGOUT" });
      Cookies.remove("adminInfo");
      history?.push?.("/login");
    }
  }, [adminInfo?.token, dispatch, history]);
}

// 🚨 Function: use after API calls to check for token expiration (non-hook, use useCheckTokenExpired in components)
export function checkTokenExpired(response) {
  if (response?.data?.token === "expired") {
    Cookies.remove("adminInfo");
    localStorage.removeItem("adminInfo");
    window.location.href = "/login";
    return true;
  }
  return false;
}
