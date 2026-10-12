import React, { useContext, useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import SearchIcon from "@mui/icons-material/Search";
import { useHistory } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import Cookies from "js-cookie";
import {
  removeFCMToken,
  cleanupNotifications,
} from "@/utils/initializeNotifications";
import axios from "axios";
import useConfigLogo from "@/hooks/useConfigLogo";
import OperationsIcon from "@/assets/operations.svg";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import { buildProductSidebar } from "@/utils/hiddenSidebarPaths";
import * as CiIcons from "react-icons/ci";
import * as FiIcons from "react-icons/fi";
import * as AiIcons from "react-icons/ai";
import * as PiIcons from "react-icons/pi";
import * as LiaIcons from "react-icons/lia";
import * as GiIcons from "react-icons/gi";
import * as BiIcons from "react-icons/bi";
import * as FaIcons from "react-icons/fa";
import * as Fa6Icons from "react-icons/fa6";
import * as MdIcons from "react-icons/md";
import * as TbIcons from "react-icons/tb";
import { AQCTA_IDENTITY } from "@/config/aqctaIdentity";
import { BRANDING_PLACEHOLDER_LOGO } from "@/utils/brandingLogo";
import "./home.css";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
const PLACEHOLDER_LOGO = BRANDING_PLACEHOLDER_LOGO;

const CIRCLE_ACCENT = "#fe3a55";
const CIRCLE_DARK = "#4a4a4a";

const iconLibraries = {
  ...CiIcons,
  ...FiIcons,
  ...AiIcons,
  ...PiIcons,
  ...LiaIcons,
  ...GiIcons,
  ...BiIcons,
  ...FaIcons,
  ...Fa6Icons,
  ...MdIcons,
  ...TbIcons,
};

const PRODUCT_HOME_META = {
  dashboard: {
    text: "Overview & insights for your team",
    moduleKey: "dashboard",
    fallbackRoute: "/dashboard",
    cta: "Access Now",
  },
  items: {
    text: "Catalog & fee items in one place",
    moduleKey: "items",
    fallbackRoute: "/items",
    cta: "Go There",
  },
  customers: {
    text: "Customer records and contact details",
    moduleKey: "customers",
    fallbackRoute: "/customers",
    cta: "Access Now",
  },
  operations: {
    text: "Enquiries, applications & projects",
    moduleKey: "operations",
    fallbackRoute: "/enquiries",
    cta: "Go There",
  },
  finance: {
    text: "Accounts, billing and payments",
    moduleKey: "finance",
    fallbackRoute: "/accounts",
    cta: "Access Now",
  },
  hr: {
    text: "People, attendance and HR tools",
    moduleKey: "hr",
    fallbackRoute: "/staff-management",
    cta: "Go There",
  },
  "system-settings": {
    text: "Users, roles & preferences",
    moduleKey: "system-settings",
    fallbackRoute: "/SystemUsers",
    cta: "Access Now",
  },
};

const HomePage = () => {
  const history = useHistory();
  const { state, dispatch } = useContext(AdminContext);
  const { adminInfo } = state;

  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [authorizedModules, setAuthorizedModules] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const checkTokenExpired = useCheckTokenExpired();

  const handleLogoutClick = () => setLogoutDialogOpen(true);
  const handleLogoutCancel = () => setLogoutDialogOpen(false);
  const handleLogoutConfirm = async () => {
    try {
      if (adminInfo?.id) {
        await removeFCMToken(adminInfo.id, "web");
      }
    } catch (error) {
      console.warn("Failed to remove FCM token during logout:", error);
    }
    dispatch({ type: "USER_LOGOUT" });
    Cookies.remove("adminInfo");
    cleanupNotifications();
    setLogoutDialogOpen(false);
    history.push("/login");
  };

  useEffect(() => {
    if (!adminInfo?.token) {
      return;
    }

    const headers = {
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    };

    axios
      .get(`${Base_URL}/Module/get_Dynamic_Modules/${adminInfo?.id}`, {
        headers,
      })
      .then((response) => {
        if (checkTokenExpired(response)) return;
        setAuthorizedModules(response.data?.role?.modules || []);
      })
      .catch((error) => console.error("Error fetching user modules:", error));
  }, [adminInfo]);

  const productNavItems = buildProductSidebar(authorizedModules, {
    ...iconLibraries,
    FiGrid: FiIcons.FiGrid,
    FiList: FiIcons.FiList,
    FiUsers: FiIcons.FiUsers,
    FiUserCheck: FiIcons.FiUserCheck,
    FiBriefcase: FiIcons.FiBriefcase,
    FiCreditCard: FiIcons.FiCreditCard,
    FiSettings: FiIcons.FiSettings,
  });

  const accessibleCards = productNavItems.map((item, index) => {
    const meta = PRODUCT_HOME_META[item.productKey] || {
      text: "Open this module to continue",
      moduleKey: item.productKey,
      fallbackRoute: "/",
      cta: "Access Now",
    };
    const childRoute = item.routes?.find(
      (route) => route.path && route.path !== "#",
    )?.path;
    const route =
      childRoute ||
      (item.path && item.path !== "#" ? item.path : meta.fallbackRoute);

    return {
      icon: item.icon || OperationsIcon,
      title: item.name,
      text: meta.text,
      route,
      moduleKey: meta.moduleKey,
      productKey: item.productKey,
      cta: meta.cta,
      circleColor: index % 2 === 0 ? CIRCLE_DARK : CIRCLE_ACCENT,
    };
  });

  const search = searchQuery.trim().toLowerCase();
  const filteredCards = search
    ? accessibleCards.filter(
        (card) =>
          card.title.toLowerCase().includes(search) ||
          card.text.toLowerCase().includes(search),
      )
    : accessibleCards;

  const handleNavigation = (card) => {
    if (card.productKey === "system-settings") {
      history.push("/SystemUsers");
      return;
    }
    if (card.productKey === "dashboard") {
      history.push("/dashboard");
      return;
    }
    history.push(card.route);
  };

  const logo = useConfigLogo();
  const displayName = adminInfo?.name?.split(" ")?.[0] || "there";

  return (
    <Box className="home-page">
      <Box className="home-page__header">
        <Box className="home-page__header-brand">
          <Box className="home-page__logo-plate">
            <img
              src={logo}
              alt={AQCTA_IDENTITY.shortName}
              className="home-page__logo"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = PLACEHOLDER_LOGO;
              }}
            />
          </Box>
        </Box>
        <Typography className="home-page__heading">
          Workspace Dashboard
        </Typography>
        <Typography className="home-page__welcome">
          Hey {displayName}! Welcome to your AQCTA workspace.
        </Typography>
        <span className="home-page__header-line" aria-hidden="true" />
      </Box>

      <Dialog
        open={logoutDialogOpen}
        onClose={handleLogoutCancel}
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-description"
        PaperProps={{
          sx: {
            borderRadius: "12px",
            boxShadow: "0 24px 64px rgba(7, 16, 31, 0.18)",
            overflow: "hidden",
            minWidth: "380px",
            fontFamily: '"Plus Jakarta Sans", "Outfit", sans-serif',
          },
        }}
        BackdropProps={{
          sx: { backgroundColor: "rgba(7, 16, 31, 0.45)" },
        }}
      >
        <Box
          sx={{
            background:
              "linear-gradient(135deg, #FE3A55 0%, #C5061A 48%, #A30516 100%)",
            padding: "24px",
            color: "white",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <Box
            sx={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              backgroundColor: "rgba(255, 255, 255, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ExitToAppIcon sx={{ fontSize: "28px", color: "white" }} />
          </Box>
          <DialogTitle
            id="logout-dialog-title"
            sx={{
              padding: 0,
              fontSize: "20px",
              fontWeight: 600,
              color: "white",
              textAlign: "center",
            }}
          >
            Logout Confirmation
          </DialogTitle>
        </Box>

        <DialogContent sx={{ padding: "28px 24px", textAlign: "center" }}>
          <DialogContentText
            id="logout-dialog-description"
            sx={{
              color: "#333",
              fontSize: "15px",
              lineHeight: "1.8",
              marginBottom: "12px",
              fontWeight: 500,
            }}
          >
            Are you sure you want to log out from your account?
          </DialogContentText>
          <Typography
            variant="caption"
            sx={{
              color: "#666",
              fontSize: "13px",
              display: "block",
              lineHeight: "1.6",
            }}
          >
            You&apos;ll need to sign in again to access your account.
          </Typography>
        </DialogContent>

        <DialogActions
          sx={{
            padding: "16px 24px 24px",
            gap: "12px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Button
            onClick={handleLogoutCancel}
            sx={{
              padding: "10px 28px",
              borderRadius: "4px",
              textTransform: "none",
              fontSize: "14px",
              fontWeight: 600,
              color: "#C5061A",
              backgroundColor: "#FDECEE",
              border: "1px solid #F5C2C9",
              "&:hover": { backgroundColor: "#F8D7DC" },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleLogoutConfirm}
            sx={{
              padding: "10px 28px",
              borderRadius: "4px",
              textTransform: "none",
              fontSize: "14px",
              fontWeight: 600,
              color: "white",
              background: "#fe3a55",
              "&:hover": { background: "#C5061A" },
            }}
            autoFocus
            endIcon={<LogoutIcon sx={{ fontSize: "16px" }} />}
          >
            Logout
          </Button>
        </DialogActions>
      </Dialog>

      <Box className="home-page__body">
        <Box className="home-page__search-section">
          <Box className="home-page__search">
            <SearchIcon className="home-page__search-icon" />
            <input
              type="search"
              className="home-page__search-input"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search modules"
            />
          </Box>
        </Box>

        <Box className="home-page__modules">
          <Box className="home-page__grid">
            {filteredCards.length === 0 ? (
              <Typography className="home-page__empty">
                No modules match your search.
              </Typography>
            ) : (
              filteredCards.map((card, index) => (
                <Card
                  key={`${card.title}-${index}`}
                  onClick={() => handleNavigation(card)}
                  className="home-page__module-card"
                  elevation={0}
                  style={{ animationDelay: `${Math.min(index, 8) * 0.04}s` }}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleNavigation(card);
                    }
                  }}
                >
                  <Box
                    className="home-page__module-icon"
                    sx={{ backgroundColor: card.circleColor }}
                  >
                    {typeof card.icon === "string" ? (
                      <img
                        src={card.icon}
                        alt=""
                        style={{ width: 26, height: 26 }}
                      />
                    ) : typeof card.icon === "function" ? (
                      React.createElement(card.icon, {
                        size: 26,
                        color: "#ffffff",
                      })
                    ) : (
                      card.icon
                    )}
                  </Box>
                  <Typography className="home-page__module-title">
                    {card.title}
                  </Typography>
                  <Typography className="home-page__module-text">
                    {card.text}
                  </Typography>
                  <Box className="home-page__module-cta" component="span">
                    {card.cta}
                    <span className="home-page__module-cta-arrow" aria-hidden>
                      →
                    </span>
                  </Box>
                </Card>
              ))
            )}
          </Box>
        </Box>
      </Box>

      <Box className="home-page__logout-wrap">
        <Typography className="home-page__support-label">
          Need to leave?
        </Typography>
        <Button
          onClick={handleLogoutClick}
          className="home-page__logout"
          startIcon={<LogoutIcon sx={{ fontSize: "16px" }} />}
        >
          Logout
        </Button>
      </Box>
    </Box>
  );
};

export default HomePage;
