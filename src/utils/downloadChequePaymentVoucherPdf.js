import axios from "axios";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { buildChequeVoucherElement } from "@/utils/chequeVoucherTemplate";
import flexaLogoAsset from "@/assets/img/logo/logo-color.svg";
import flexaErpBrandLogo from "@/assets/img/logo/flexa-erp-brand.png";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
const BRANDING_CACHE_KEY = "branding_logo";

function resolveBankLogoUrl(cheque) {
  const bank = cheque?.bankAccountId;
  return (
    cheque?.bankLogoUrl ||
    cheque?.bankLogo ||
    (bank && typeof bank === "object" ? bank.logo : null) ||
    cheque?.businessLogo ||
    (cheque?.business_id && typeof cheque.business_id === "object"
      ? cheque.business_id.logo || cheque.business_id.image
      : null) ||
    ""
  );
}

function normalizeAssetUrl(raw) {
  const u = String(raw || "")
    .replace(/&amp;/g, "&")
    .trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u) || u.startsWith("data:")) return u;
  const base = String(Base_URL || "").replace(/\/$/, "");
  if (!base) return u;
  return u.startsWith("/") ? `${base}${u}` : `${base}/${u}`;
}

async function fetchImageAsDataUrl(url) {
  const abs = normalizeAssetUrl(url);
  if (!abs) return null;
  if (abs.startsWith("data:")) return abs;
  for (const cred of ["include", "omit"]) {
    try {
      const res = await fetch(abs, { mode: "cors", credentials: cred });
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!blob.size || (blob.type && !blob.type.startsWith("image/"))) continue;
      const dataUrl = await new Promise((resolve) => {
        const r = new FileReader();
        r.onloadend = () =>
          resolve(typeof r.result === "string" ? r.result : null);
        r.onerror = () => resolve(null);
        r.readAsDataURL(blob);
      });
      if (dataUrl) return dataUrl;
    } catch {
      /* next */
    }
  }
  return null;
}

async function loadFlexaLogoDataUrl(token) {
  const cached =
    typeof localStorage !== "undefined"
      ? localStorage.getItem(BRANDING_CACHE_KEY)
      : null;
  if (cached?.startsWith("data:image")) return cached;

  if (token && Base_URL) {
    try {
      const res = await axios.get(`${Base_URL}/branding/logo`, {
        headers: { authorization: `Bearer ${token}` },
        withCredentials: true,
      });
      const url = res.data?.logo || res.data?.url || res.data;
      if (typeof url === "string" && url.startsWith("data:image")) return url;
      if (typeof url === "string" && url) {
        const loaded = await fetchImageAsDataUrl(url);
        if (loaded) return loaded;
      }
    } catch {
      /* fallback */
    }
  }

  const brandPng = await fetchImageAsDataUrl(flexaErpBrandLogo);
  if (brandPng) return brandPng;
  return fetchImageAsDataUrl(flexaLogoAsset);
}

async function enrichChequeForPdf(cheque, { token } = {}) {
  if (!cheque?._id || !token) return cheque;
  const needsBank =
    !cheque.bankAccountLabel &&
    !(cheque.bankAccountId && typeof cheque.bankAccountId === "object");
  const needsLogo = !resolveBankLogoUrl(cheque) && !cheque.businessLogo;
  if (!needsBank && !needsLogo) return cheque;

  try {
    const res = await axios.get(`${Base_URL}/cheques/${cheque._id}`, {
      headers: { authorization: `Bearer ${token}` },
      withCredentials: true,
    });
    const detail = res.data?.data;
    if (!detail) return cheque;
    return {
      ...cheque,
      ...detail,
      bankAccountLabel:
        cheque.bankAccountLabel ||
        (detail.bankAccountId
          ? [
              detail.bankAccountId.accountName,
              detail.bankAccountId.accountNumber,
              detail.bankAccountId.bankName,
            ]
              .filter(Boolean)
              .join(" · ")
          : null),
      businessLogo:
        cheque.businessLogo ||
        detail.business_id?.logo ||
        detail.business_id?.image ||
        null,
      bankLogo:
        cheque.bankLogo ||
        detail.bankLogo ||
        detail.bankAccountId?.logo ||
        null,
    };
  } catch {
    return cheque;
  }
}

async function waitForImages(root) {
  const imgs = root.querySelectorAll("img");
  await Promise.all(
    Array.from(imgs).map((img) =>
      img.decode
        ? img.decode().catch(() => {})
        : new Promise((resolve) => {
            if (img.complete) resolve();
            else {
              img.onload = resolve;
              img.onerror = resolve;
            }
          }),
    ),
  );
}

/**
 * Client-side cheque payment voucher PDF (HTML → canvas → PDF).
 * @param {object} cheque
 * @param {{ token?: string }} [options]
 */
export async function downloadChequePaymentVoucherPdf(cheque, options = {}) {
  if (!cheque) return;

  const { token } = options;
  const enriched = await enrichChequeForPdf(cheque, { token });

  const [flexaLogo, bankLogo] = await Promise.all([
    loadFlexaLogoDataUrl(token),
    fetchImageAsDataUrl(resolveBankLogoUrl(enriched)),
  ]);

  const mount = document.createElement("div");
  mount.style.cssText =
    "position:fixed;left:-9999px;top:0;z-index:-1;background:#f1f5f9;padding:24px 24px 32px;";
  const node = buildChequeVoucherElement(enriched, {
    flexaLogoDataUrl: flexaLogo,
    bankLogoDataUrl: bankLogo,
  });
  mount.appendChild(node);
  document.body.appendChild(mount);

  try {
    await waitForImages(mount);
    const canvas = await html2canvas(mount, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#f1f5f9",
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const marginTop = 28;
    const marginX = 28;
    const maxW = pageW - marginX * 2;
    const imgH = (canvas.height * maxW) / canvas.width;
    pdf.addImage(imgData, "PNG", marginX, marginTop, maxW, imgH);

    const safeFile =
      String(enriched.chequeNumber || "voucher")
        .replace(/[^a-zA-Z0-9-_]/g, "_")
        .slice(0, 80) || "voucher";
    pdf.save(`Cheque-Voucher-${safeFile}.pdf`);
  } finally {
    if (mount.parentNode) document.body.removeChild(mount);
  }
}
