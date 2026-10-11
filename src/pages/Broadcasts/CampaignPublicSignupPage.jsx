import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Building2,
  CheckCircle2,
  Loader2,
  Megaphone,
  AlertCircle,
} from "lucide-react";
import CampaignPublicServices from "@/services/CampaignPublicServices";
import {
  PHONE_REGIONS,
  formatNationalDisplay,
  formatWhatsappDisplay,
  getDefaultPhoneRegion,
  parseNationalDigits,
  recipientToWhatsappE164,
} from "@/utils/whatsappPhoneFormat";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const resolveLogo = (url) => {
  if (!url || typeof url !== "string") return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  return `${Base_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const CampaignPublicSignupPage = () => {
  const { token } = useParams();
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneRegion, setPhoneRegion] = useState(getDefaultPhoneRegion());
  const [phone, setPhone] = useState("");

  const regionConfig = PHONE_REGIONS[phoneRegion] || PHONE_REGIONS.MY;
  const nationalDisplay = useMemo(
    () => formatNationalDisplay(parseNationalDigits(phone, phoneRegion), phoneRegion),
    [phone, phoneRegion],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const res = await CampaignPublicServices.getContext(token);
        if (cancelled) return;
        if (res.data?.success) {
          setContext(res.data.data);
        } else {
          setLoadError(res.data?.error || "Invalid QR code.");
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err?.response?.data?.error || "This QR code is invalid or has expired.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handlePhoneChange = (rawValue) => {
    const national = parseNationalDigits(rawValue, phoneRegion);
    setPhone(
      national ? formatWhatsappDisplay(national, phoneRegion) : "",
    );
  };

  const handleRegionChange = (nextRegion) => {
    if (nextRegion === phoneRegion) return;
    const national = parseNationalDigits(phone, phoneRegion);
    setPhoneRegion(nextRegion);
    setPhone(national ? formatWhatsappDisplay(national, nextRegion) : "");
  };

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setSubmitError("");

      const trimmedName = name.trim();
      const trimmedEmail = email.trim();
      const whatsappNumber = recipientToWhatsappE164(
        { whatsappNumber: phone, phoneRegion },
        phoneRegion,
      );

      if (!trimmedName) {
        setSubmitError("Full name is required.");
        return;
      }
      if (!trimmedEmail && !whatsappNumber) {
        setSubmitError("Please provide an email or phone number.");
        return;
      }
      if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        setSubmitError("Please enter a valid email address.");
        return;
      }

      setSubmitting(true);
      try {
        const res = await CampaignPublicServices.submitSignup(token, {
          name: trimmedName,
          email: trimmedEmail,
          whatsappNumber,
        });
        if (res.data?.success) {
          setSuccess(true);
        } else {
          setSubmitError(res.data?.error || "Sign-up failed.");
        }
      } catch (err) {
        setSubmitError(
          err?.response?.data?.error || "Sign-up failed. Please try again.",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [name, email, phone, phoneRegion, token],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-[var(--p-blue)]" size={32} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto text-red-500 mb-3" size={36} />
          <h1 className="text-lg font-bold text-gray-900 mb-2">QR not available</h1>
          <p className="text-sm text-gray-600">{loadError}</p>
        </div>
      </div>
    );
  }

  const { campaign, business } = context || {};
  const logoUrl = resolveLogo(business?.image);

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={40} />
          <h1 className="text-xl font-bold text-gray-900 mb-2">You&apos;re signed up!</h1>
          <p className="text-sm text-gray-600">
            You&apos;ve joined <strong>{campaign?.title}</strong>. You&apos;ll
            receive messages from <strong>{campaign?.title}</strong>.
          </p>
        </div>
      </div>
    );
  }

  if (!campaign?.signupOpen) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
          <Megaphone className="mx-auto text-amber-500 mb-3" size={36} />
          <h1 className="text-lg font-bold text-gray-900 mb-2">Sign-ups closed</h1>
          <p className="text-sm text-gray-600">
            This campaign is no longer accepting new sign-ups.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/80 to-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          <div className="bg-[var(--p-blue)] px-6 py-8 text-white text-center">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className="h-12 w-12 rounded-xl mx-auto mb-3 object-cover bg-white/10"
              />
            ) : (
              <div className="h-12 w-12 rounded-xl mx-auto mb-3 bg-white/20 flex items-center justify-center">
                <Building2 size={22} />
              </div>
            )}
            <p className="text-xs uppercase tracking-wider text-white/80 mb-1">
              {business?.name || "Campaign sign-up"}
            </p>
            <h1 className="text-2xl font-bold">{campaign?.title || "Campaign"}</h1>
            {campaign?.messageContent ? (
              <p className="mt-3 text-sm text-white/90 line-clamp-3">
                {campaign.messageContent}
              </p>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <p className="text-sm text-gray-600">
              Enter your details to join this campaign as a recipient.
            </p>

            {submitError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {submitError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Full name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-[var(--p-blue)] focus:ring-1 focus:ring-[var(--p-blue)]/20 outline-none"
                autoComplete="name"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Phone / WhatsApp
              </label>
              <div className="flex gap-2">
                <select
                  className="w-[4.5rem] shrink-0 border border-gray-200 rounded-lg px-1 py-2.5 text-sm bg-white focus:border-[var(--p-blue)] outline-none"
                  value={phoneRegion}
                  onChange={(e) => handleRegionChange(e.target.value)}
                  aria-label="Country code"
                >
                  {Object.values(PHONE_REGIONS).map((cfg) => (
                    <option key={cfg.code} value={cfg.code}>
                      {cfg.dialCode}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={nationalDisplay}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder={regionConfig.placeholder}
                  className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-[var(--p-blue)] focus:ring-1 focus:ring-[var(--p-blue)]/20 outline-none"
                  inputMode="numeric"
                  autoComplete="tel"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-[var(--p-blue)] focus:ring-1 focus:ring-[var(--p-blue)]/20 outline-none"
                autoComplete="email"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Provide email or phone (at least one required).
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-lg bg-[var(--p-blue)] text-white text-sm font-semibold hover:opacity-95 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Signing up…
                </>
              ) : (
                "Sign up"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CampaignPublicSignupPage;
