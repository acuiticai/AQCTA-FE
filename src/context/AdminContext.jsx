import Cookies from "js-cookie";
import React, { createContext, useReducer } from "react";
import AdminServices from "@/services/AdminServices";
import { logoutUser } from "@/utils/generic";

const initialState = {
  adminInfo: localStorage.getItem("adminInfo")
    ? JSON.parse(localStorage.getItem("adminInfo"))
    : null,
};

// Default value so public pages (e.g. /register) never crash if a consumer
// mounts briefly outside the provider (HMR / suspense edge cases).
export const AdminContext = createContext({
  state: initialState,
  dispatch: () => {},
});

function reducer(state, action) {
  switch (action.type) {
    case "USER_LOGIN": {
      localStorage.setItem("adminInfo", JSON.stringify(action.payload)); // Save adminInfo to localStorage
      console.debug({ action });
      return { ...state, adminInfo: action.payload };
    }

    case "USER_LOGOUT":
      logoutUser();

      return {
        ...state,
        adminInfo: null,
      };

    case "UPDATE_ADMIN_INFO":
      localStorage.setItem(
        "adminInfo",
        JSON.stringify({ ...state.adminInfo, ...action.payload })
      );
      return { ...state, adminInfo: { ...state.adminInfo, ...action.payload } };

    default:
      return state;
  }
}

export const AdminProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = { state, dispatch };
  return (
    <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
  );
};
