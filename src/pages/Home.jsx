import React, { useContext, useState, useEffect, useRef } from "react";
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
import { useHistory } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import Cookies from "js-cookie";
import {
  removeFCMToken,
  cleanupNotifications,
} from "@/utils/initializeNotifications";
import axios from "axios";
import useConfigLogo from "@/hooks/useConfigLogo";
import { useTranslation } from "react-i18next";
import ItemsIcon from "@/assets/items.svg";
import SalesIcon from "@/assets/sales.svg";
import PurchaseIcon from "@/assets/purchase.svg";
import OperationsIcon from "@/assets/operations.svg";
import AccountsIcon from "@/assets/accounts.svg";
import BusinessGroupIcon from "@/assets/businessGroup.svg";
// ADDED ICON: If you have a dedicated GlobalSettingsIcon, use it. Otherwise, reuse settings or accounts icon.
import GlobalSettingsIcon from "@/assets/hrMng.svg";
import HRIcon from "@/assets/hrMng.svg";
import FinanceIcon from "@/assets/treasure&Finance.svg";
import DocsIcon from "@/assets/docsManagement.svg";
import ReportsIcon from "@/assets/reports.svg";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import CalendarIcon from "@/assets/calendar.svg";
import { initializeNotifications } from "@/utils/initializeNotifications";
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
import "./home.css";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import { BRANDING_PLACEHOLDER_LOGO } from "@/utils/brandingLogo";

const PLACEHOLDER_LOGO = BRANDING_PLACEHOLDER_LOGO;

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

const LIGHT_DOCS_ICON_BG = "#F3F6F9";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getColumnCount = (width, moduleCount) => {
  const count = Math.max(moduleCount, 1);

  if (width < 600) return Math.min(2, count);
  if (width < 900) return Math.min(3, count);

  const gap = clamp(Math.round(Math.min(width, 900) * 0.016), 12, 18);
  const minCardWidth = 150;
  const maxCardWidth = 260;

  const maxColsByWidth = Math.max(
    3,
    Math.floor((width + gap) / (minCardWidth + gap)),
  );
  const maxCols = Math.min(maxColsByWidth, 6, count);

  let bestCols = Math.min(4, maxCols);
  let bestScore = Infinity;

  for (let cols = 3; cols <= maxCols; cols += 1) {
    const cardWidth = (width - gap * (cols - 1)) / cols;
    if (cardWidth < minCardWidth) break;

    const rows = Math.ceil(count / cols);
    const lastRowEmpty = count % cols === 0 ? 0 : cols - (count % cols);
    const targetWidth = clamp(width / cols - gap, 170, 230);

    const score =
      Math.abs(cardWidth - targetWidth) +
      rows * 10 +
      lastRowEmpty * 14 +
      (cardWidth > maxCardWidth ? (cardWidth - maxCardWidth) * 0.35 : 0);

    if (score < bestScore) {
      bestScore = score;
      bestCols = cols;
    }
  }

  return bestCols;
};

const buildDensityTokens = ({
  cols,
  rows,
  gap,
  padY,
  padX,
  cardWidth,
  cardHeight,
  scale,
  showText,
  compactLayout,
}) => ({
  cols,
  rows,
  gap,
  padY,
  padX,
  cardWidth,
  cardHeight,
  scale,
  showText,
  compactLayout,
  padding: clamp(Math.round(12 * scale), 10, 16),
  radius: clamp(Math.round(16 * scale), 14, 18),
  iconBox: clamp(Math.round(52 * scale), 46, 58),
  iconSize: clamp(Math.round(30 * scale), 26, 32),
  titleSize: clamp(Math.round(16 * scale), 14, 17),
  textSize: clamp(Math.round(12 * scale), 11, 13),
  iconRadius: clamp(Math.round(12 * scale), 10, 14),
  iconMb: clamp(Math.round(6 * scale), 5, 8),
});

const COMPACT_MAX_MODULES = 8;

const COMPACT_CARD_SIZES = {
  1: { w: 300, h: 168 },
  2: { w: 280, h: 160 },
  3: { w: 255, h: 155 },
  4: { w: 240, h: 150 },
  5: { w: 228, h: 148 },
  6: { w: 218, h: 142 },
  7: { w: 212, h: 140 },
  8: { w: 206, h: 138 },
};

const getCompactColumnCount = (width, moduleCount) => {
  if (width < 600) return Math.min(2, moduleCount);
  if (width < 900) return Math.min(3, moduleCount);
  if (moduleCount === 5 && width >= 1180) return 5;
  if (moduleCount >= 6) return Math.min(4, moduleCount);
  if (moduleCount === 5) return 3;
  return moduleCount;
};

const getCompactCardSize = (moduleCount, width, usableWidth, gap, compactCols) => {
  const base = COMPACT_CARD_SIZES[clamp(moduleCount, 1, COMPACT_MAX_MODULES)];
  let cardWidth = base.w;
  let cardHeight = base.h;

  if (width < 900) {
    cardWidth = Math.round(cardWidth * 0.93);
    cardHeight = Math.round(cardHeight * 0.95);
  }

  if (width < 600) {
    cardWidth = clamp(
      Math.floor((usableWidth - gap * (compactCols - 1)) / compactCols),
      148,
      196,
    );
    cardHeight = 134;
  }

  const scale = clamp(
    Math.min(cardHeight / 125, cardWidth / 220),
    0.82,
    1.05,
  );

  return {
    cardWidth,
    cardHeight,
    scale,
    showText: width >= 480 && cardHeight >= 128,
  };
};

const computeModuleDensity = (moduleCount, width, height) => {
  const cols = getColumnCount(width, moduleCount);
  const rows = Math.max(1, Math.ceil(moduleCount / cols));

  const gap = clamp(Math.round(Math.min(width, height) * 0.016), 12, 20);
  const padY = clamp(Math.round(height * 0.02), 8, 18);
  const padX = clamp(Math.round(width * 0.02), 10, 28);

  const usableHeight = Math.max(height - padY * 2, 80);
  const usableWidth = Math.max(width - padX * 2, 120);

  // Few modules: centered cards with a comfortable fixed size — not full-screen stretch.
  if (moduleCount >= 1 && moduleCount <= COMPACT_MAX_MODULES) {
    const compactCols = getCompactColumnCount(width, moduleCount);
    const compactRows = Math.ceil(moduleCount / compactCols);
    const { cardWidth, cardHeight, scale, showText } = getCompactCardSize(
      moduleCount,
      width,
      usableWidth,
      gap,
      compactCols,
    );

    return buildDensityTokens({
      cols: compactCols,
      rows: compactRows,
      gap,
      padY,
      padX,
      cardWidth,
      cardHeight,
      scale,
      showText,
      compactLayout: true,
    });
  }

  // Fill available height — no low artificial cap that leaves empty space
  let cardHeight = (usableHeight - gap * (rows - 1)) / rows;
  let cardWidth = (usableWidth - gap * (cols - 1)) / cols;
  cardHeight = Math.min(Math.max(cardHeight, 0), 150);

  const scale = clamp(Math.min(cardHeight / 125, cardWidth / 220), 0.55, 1.05);
  const showText = scale >= 0.7 && width >= 600 && cardHeight >= 95;

  return buildDensityTokens({
    cols,
    rows,
    gap,
    padY,
    padX,
    cardWidth,
    cardHeight,
    scale,
    showText,
    compactLayout: false,
  });
};

const DEFAULT_DENSITY = computeModuleDensity(15, 1500, 520);

const resolveModuleIconStyle = (title, matchedStatic) => {
  if (matchedStatic?.iconBgColor && matchedStatic?.iconColor) {
    return {
      iconBgColor: matchedStatic.iconBgColor,
      iconColor: matchedStatic.iconColor,
    };
  }

  if (normalizeModuleTitle(title) === "docs management") {
    return {
      iconBgColor: LIGHT_DOCS_ICON_BG,
      iconColor: "#546E7A",
    };
  }

  return {
    iconBgColor: "#F3F4F6",
    iconColor: matchedStatic?.iconColor || "#4F46E5",
  };
};

const normalizeModuleTitle = (str) => str?.toLowerCase()?.trim() || "";

const PRODUCT_HOME_META = {
  dashboard: {
    text: "Overview & insights",
    iconBgColor: "#FDECEE",
    iconColor: "#C5061A",
    moduleKey: "dashboard",
    fallbackRoute: "/dashboard",
  },
  items: {
    text: "Catalog & fee items",
    iconBgColor: "#DDF7E8",
    iconColor: "#1F8A4C",
    moduleKey: "items",
    fallbackRoute: "/items",
  },
  customers: {
    text: "Customer records",
    iconBgColor: "#E8F0FE",
    iconColor: "#A30516",
    moduleKey: "customers",
    fallbackRoute: "/customers",
  },
  operations: {
    text: "Enquiries, applications & projects",
    iconBgColor: "#D7EEFB",
    iconColor: "#FE0032",
    moduleKey: "operations",
    fallbackRoute: "/enquiries",
  },
  finance: {
    text: "Accounts & billing",
    iconBgColor: "#EAF6EF",
    iconColor: "#1F8A4C",
    moduleKey: "finance",
    fallbackRoute: "/accounts",
  },
  hr: {
    text: "People & attendance",
    iconBgColor: "#FDECEE",
    iconColor: "#860412",
    moduleKey: "hr",
    fallbackRoute: "/staff-management",
  },
  "system-settings": {
    text: "Users, roles & preferences",
    iconBgColor: "#E8EEF5",
    iconColor: "#1A2740",
    moduleKey: "system-settings",
    fallbackRoute: "/SystemUsers",
  },
};

const HomePage = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { state, dispatch } = useContext(AdminContext);
  const { adminInfo } = state;

  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [authorizedModules, setAuthorizedModules] = useState([]);
  const [density, setDensity] = useState(DEFAULT_DENSITY);
  const modulesRef = useRef(null);
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

  // Hardcoded list of all possible modules, WITH explicit "Accounts" and "Global Settings"
  const allModules = [
    {
      icon: ItemsIcon,
      title: "Items",
      text: "Manage product inventory",
      route: "/items",
      moduleKey: "items",
      iconBgColor: "#E8F5E9",
      iconColor: "#2E7D32",
    },
    {
      icon: SalesIcon,
      title: "Sales",
      text: "Sales order processing",
      route: "/sales",
      moduleKey: "sales",
      iconBgColor: "#E8F4FD",
      iconColor: "#1565C0",
    },
    {
      icon: PurchaseIcon,
      title: "Purchase",
      text: "Vendor procurement",
      route: "/vendors",
      moduleKey: "purchase",
      iconBgColor: "#FFF3E0",
      iconColor: "#EF6C00",
    },
    {
      icon: OperationsIcon,
      title: "Operations",
      text: "Optimize workflow",
      route: "/campaigns",
      moduleKey: "operations",
      iconBgColor: "#F3E5F5",
      iconColor: "#6A1B9A",
    },
    {
      icon: HRIcon,
      title: "HR",
      text: "Employee management",
      route: "/staff-management",
      moduleKey: "hr",
      iconBgColor: "#FCE4EC",
      iconColor: "#AD1457",
    },
    {
      title: "Analytics & Reports",
      text: "Data analytics and insights",
      route: "/HR-Analytics",
      moduleKey: "analytics & reports",
      iconName: "FiBarChart2",
      iconBgColor: "#F3E8FF",
      iconColor: "#7C3AED",
    },
    {
      title: "Broadcasts",
      text: "Marketing announcements",
      route: "/broadcasts",
      moduleKey: "broadcasts",
      iconName: "FiRadio",
      iconBgColor: "#FFF4E6",
      iconColor: "#EA580C",
    },
    {
      title: "Fleet & Job Scheduling",
      text: "Dispatch and fleet jobs",
      route: "/fleet-jobs",
      moduleKey: "fleet & job scheduling",
      iconName: "FiTruck",
      iconBgColor: "#ECFEFF",
      iconColor: "#0891B2",
    },
    {
      title: "Subscription Management",
      text: "Plans and billing",
      route: "/subscription-management",
      moduleKey: "subscription management",
      iconName: "FiCreditCard",
      iconBgColor: "#EDE9FE",
      iconColor: "#6D28D9",
    },
    {
      icon: HRIcon,
      title: "HR Management",
      text: "Employee management",
      route: "/staff-management",
      moduleKey: "hr",
      iconBgColor: "#FCE4EC",
      iconColor: "#AD1457",
    },
    {
      icon: CalendarIcon,
      title: "Calendar",
      text: "Calendar Events",
      route: "/calendar-events",
      moduleKey: "calendar",
      iconBgColor: "#E0F7FA",
      iconColor: "#00838F",
    },
    {
      icon: FinanceIcon,
      title: "Treasury & Finance",
      text: "Financial strategy",
      route: "/bank-management",
      moduleKey: "treasury & finance",
      iconBgColor: "#EEF2FF",
      iconColor: "#4338CA",
    },
    {
      icon: BusinessGroupIcon,
      title: "Business Group",
      text: "Organize companies and branches",
      route: "/business-group",
      moduleKey: "business group",
      iconBgColor: "#FFF8E1",
      iconColor: "#FF8F00",
    },
    {
      icon: DocsIcon,
      title: t("docsManagement.moduleTitle", { defaultValue: "Docs Management" }),
      text: t("docsManagement.moduleDescription", { defaultValue: "Digital archiving" }),
      route: "/docs-management",
      moduleKey: "docs",
      iconBgColor: LIGHT_DOCS_ICON_BG,
      iconColor: "#546E7A",
    },
    {
      icon: ReportsIcon,
      title: "Reports",
      text: "Data analytics",
      route: "/daily-reports",
      moduleKey: "reports",
      iconBgColor: "#DBEAFE",
      iconColor: "#2563EB",
    },
    {
      icon: AccountsIcon,
      title: "Accounts",
      text: "Manage Accounts",
      route: "/accounts",
      moduleKey: "accounts",
      iconBgColor: "#F1F8E9",
      iconColor: "#558B2F",
    },
    // ADDED EXPLICIT "GLOBAL SETTINGS" MODULE
    {
      icon: GlobalSettingsIcon,
      title: "Global Settings",
      text: "Configure global preferences",
      route: "/setting",
      moduleKey: "global settings",
      iconBgColor: "#F5F5F5",
      iconColor: "#424242",
    },
  ];

  useEffect(() => {
    // Auth and redirect are handled by PageAuth; logging out here raced before parent
    // effects in Edge and cleared a valid session when context lagged localStorage.
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

  // Match sidebar: only modules/submodules assigned to this system user's role.
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

  const accessibleCards = productNavItems.map((item) => {
    const meta = PRODUCT_HOME_META[item.productKey] || {
      text: "Open module",
      iconBgColor: "#F3F4F6",
      iconColor: "#4F46E5",
      moduleKey: item.productKey,
      fallbackRoute: "/",
    };
    const childRoute = item.routes?.find((route) => route.path && route.path !== "#")
      ?.path;
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
      subModules: item.routes || [],
      iconBgColor: meta.iconBgColor,
      iconColor: meta.iconColor,
    };
  });

  useEffect(() => {
    const el = modulesRef.current;
    if (!el) return undefined;

    const updateDensity = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width < 40 || height < 40) return;
      setDensity(
        computeModuleDensity(accessibleCards.length || 1, width, height),
      );
    };

    updateDensity();
    const observer = new ResizeObserver(updateDensity);
    observer.observe(el);
    return () => observer.disconnect();
  }, [accessibleCards.length]);

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

  return (
    <Box className="home-page">
      <Button
        onClick={handleLogoutClick}
        className="home-page__logout"
        startIcon={<LogoutIcon sx={{ fontSize: "18px" }} />}
      >
        Logout
      </Button>

      {/* Simple & Clean Logout Modal with Proper Icon */}
      <Dialog
        open={logoutDialogOpen}
        onClose={handleLogoutCancel}
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-description"
        PaperProps={{
          sx: {
            borderRadius: "16px",
            boxShadow: "0 24px 64px rgba(7, 16, 31, 0.18)",
            overflow: "hidden",
            minWidth: "380px",
            fontFamily: '"Plus Jakarta Sans", "Outfit", sans-serif',
          },
        }}
        BackdropProps={{
          sx: {
            backgroundColor: "rgba(7, 16, 31, 0.45)",
          },
        }}
      >
        <Box
          sx={{
            background:
              "linear-gradient(135deg, #FE0032 0%, #C5061A 48%, #A30516 100%)",
            padding: "24px",
            color: "white",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
          }}
        >
          {/* Icon Circle */}
          <Box
            sx={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              backgroundColor: "rgba(255, 255, 255, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
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

        {/* Content */}
        <DialogContent
          sx={{
            padding: "28px 24px",
            textAlign: "center",
          }}
        >
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
            You'll need to sign in again to access your account.
          </Typography>
        </DialogContent>

        {/* Actions */}
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
              borderRadius: "10px",
              textTransform: "none",
              fontSize: "14px",
              fontWeight: 600,
              color: "#C5061A",
              backgroundColor: "#FDECEE",
              border: "1px solid #C8E8FA",
              cursor: "pointer",
              transition: "background 0.2s ease",
              "&:hover": {
                backgroundColor: "#D7EEFB",
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleLogoutConfirm}
            sx={{
              padding: "10px 28px",
              borderRadius: "10px",
              textTransform: "none",
              fontSize: "14px",
              fontWeight: 600,
              color: "white",
              background:
                "linear-gradient(135deg, #FE0032 0%, #C5061A 50%, #A30516 100%)",
              border: "none",
              cursor: "pointer",
              transition: "filter 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              "&:hover": {
                filter: "brightness(1.05)",
              },
            }}
            autoFocus
            endIcon={<LogoutIcon sx={{ fontSize: "16px" }} />}
          >
            Logout
          </Button>
        </DialogActions>
      </Dialog>

      <Box className="home-page__hero">
        <img
          src={logo}
          alt="AQCTA"
          className="home-page__logo"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = PLACEHOLDER_LOGO;
          }}
        />
        <Typography className="home-page__eyebrow">
          AQC TECHNICAL ASSESSORS (M) SDN. BHD.
        </Typography>
        <Typography className="home-page__title">
          Your conformity assessment workspace, in one place
        </Typography>
        <Typography className="home-page__subtitle">
          Jump into the module you need — clear, fast, and built around how your
          team works.
        </Typography>
      </Box>

      <Box className="home-page__modules" ref={modulesRef}>
        <Box
          className={`home-page__grid${density.compactLayout ? " home-page__grid--compact" : ""}`}
          sx={{
            display: density.compactLayout ? "flex" : "grid",
            flexWrap: density.compactLayout ? "wrap" : undefined,
            gridTemplateColumns: density.compactLayout
              ? undefined
              : `repeat(${density.cols}, minmax(0, 1fr))`,
            gridTemplateRows: density.compactLayout
              ? undefined
              : `repeat(${density.rows}, minmax(0, 1fr))`,
            gap: `${density.gap}px`,
            width: "100%",
            height: "100%",
            alignContent: density.compactLayout ? "center" : "stretch",
            alignItems: density.compactLayout ? "center" : "stretch",
            justifyContent: density.compactLayout ? "center" : "stretch",
            padding: `${density.padY}px ${density.padX}px`,
            boxSizing: "border-box",
          }}
        >
          {accessibleCards.map((card, index) => (
            <Card
              key={`${card.title}-${index}`}
              onClick={() => handleNavigation(card)}
              className="home-page__module-card"
              elevation={0}
              style={{
                "--card-accent": card.iconColor || "#C5061A",
              }}
              sx={{
                width: density.compactLayout ? `${density.cardWidth}px` : "100%",
                height: density.compactLayout ? `${density.cardHeight}px` : "100%",
                flexShrink: density.compactLayout ? 0 : undefined,
                minHeight: 0,
                padding: `${density.padding + 4}px`,
                borderRadius: `${Math.max(density.radius, 16)}px`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                textAlign: "center",
                margin: 0,
                cursor: "pointer",
              }}
            >
              <Box
                className="home-page__module-icon"
                sx={{
                  width: density.iconBox,
                  height: density.iconBox,
                  borderRadius: `${Math.max(density.iconRadius, 14)}px`,
                  mb: `${density.iconMb + 2}px`,
                  backgroundColor: card.iconBgColor || "#FDECEE",
                }}
              >
                {typeof card.icon === "string" ? (
                  <img
                    src={card.icon}
                    alt=""
                    style={{
                      width: density.iconSize,
                      height: density.iconSize,
                    }}
                  />
                ) : typeof card.icon === "function" ? (
                  React.createElement(card.icon, {
                    size: density.iconSize,
                    color: card.iconColor || "#C5061A",
                  })
                ) : (
                  card.icon
                )}
              </Box>
              <Typography
                className="home-page__module-title"
                sx={{
                  fontSize: `${density.titleSize}px`,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  px: 0.25,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {card.title}
              </Typography>
              {density.showText && (
                <Typography
                  className="home-page__module-text"
                  sx={{
                    fontSize: `${density.textSize}px`,
                    lineHeight: 1.3,
                    mt: 0.5,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "100%",
                    px: 0.25,
                  }}
                >
                  {card.text}
                </Typography>
              )}
            </Card>
          ))}
        </Box>
      </Box>

      <Typography className="home-page__footer">
        © {new Date().getFullYear()} AQC TECHNICAL ASSESSORS (M) SDN. BHD.
      </Typography>
    </Box>
  );
};

export default HomePage;
