// hooks/useCheckTokenExpired.js
import { useContext } from "react";
import { useHistory } from "react-router-dom";
import Cookies from "js-cookie";
import { AdminContext } from "@/context/AdminContext";

export default function useCheckTokenExpired() {
  const { dispatch } = useContext(AdminContext);
  const history = useHistory();
  return (response) => {
    // console.log("response USER_LOGOUT", response);
    // We are not checking for token expire in this hook, anymore
    // if (response?.data?.token === "expired") {
    //   dispatch({ type: "USER_LOGOUT" });
    //   Cookies.remove("adminInfo");
    //   history.push("/login");
    //   return true;
    // }
    return false;
  };
}
